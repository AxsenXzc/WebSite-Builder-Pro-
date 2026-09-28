-- Archivio cloud di Atelier — schema e funzioni interne.
--
-- Prima parte dell'impianto: le tabelle e le funzioni che leggono e scrivono.
-- La seconda parte (`002-cloud-entry.sql`) aggiunge la porta firmata: da sola,
-- questa migrazione non espone niente a Internet.
--
-- Regole che valgono per tutto lo schema:
--   * `atelier` non è fra gli schemi esposti via REST e i ruoli Web non hanno
--     privilegi su di esso: le tabelle non hanno un endpoint.
--   * Le funzioni sono `security definer` con `search_path = ''`: girano con i
--     privilegi del proprietario e ogni nome va qualificato.
--   * L'`owner` (workspace) non è mai deciso dal client: arriva dall'identità
--     della sessione, e ogni funzione lo riceve come primo argomento.

create schema if not exists atelier;

-- Nessun ruolo pubblico entra nello schema: si passa solo dalle funzioni.
revoke all on schema atelier from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------

-- Un progetto per riga: il documento completo vive in `site` (jsonb), i campi
-- affiancati servono all'indice leggero della sincronizzazione.
create table if not exists atelier.projects (
  owner      text        not null,
  project_id text        not null,
  name       text        not null,
  slug       text        not null,
  preset     text        not null,
  site       jsonb       not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (owner, project_id)
);

-- L'elenco di un workspace è sempre «i suoi progetti, dal più recente».
create index if not exists projects_owner_updated_idx
  on atelier.projects (owner, updated_at desc);

-- Tombe: l'istante di ogni cancellazione. Sono il motivo per cui un progetto
-- eliminato su un dispositivo non viene riportato indietro da un altro.
create table if not exists atelier.tombstones (
  owner      text        not null,
  project_id text        not null,
  deleted_at timestamptz not null default now(),
  primary key (owner, project_id)
);

create index if not exists tombstones_owner_idx
  on atelier.tombstones (owner, deleted_at desc);

-- Segreti dell'istanza (il segreto di firma della busta). Nessun ruolo Web ha
-- privilegi qui: li leggono solo le funzioni `security definer`.
create table if not exists atelier.secrets (
  name  text primary key,
  value text not null
);

revoke all on atelier.projects, atelier.tombstones, atelier.secrets from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funzioni interne
--
-- Non sono chiamabili dall'esterno: `002-cloud-entry.sql` revoca loro
-- l'esecuzione pubblica e le lascia raggiungibili soltanto dalla porta firmata.
-- ---------------------------------------------------------------------------

-- Indice leggero: solo i metadati, mai il documento. `p_ts_head` permette una
-- sincronizzazione incrementale (null = tutto).
create or replace function public.atelier_cloud_list(p_owner text, p_ts_head text)
returns table(project_id text, name text, slug text, preset text, updated_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select q.project_id, q.name, q.slug, q.preset, q.updated_at, q.created_at
  from atelier.projects q
  where q.owner = p_owner
    and (p_ts_head is null or q.updated_at > p_ts_head::timestamptz)
  order by q.updated_at desc
$$;

-- I documenti richiesti, per identificativo.
create or replace function public.atelier_cloud_sites(p_owner text, p_ids text[])
returns table(project_id text, site jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select q.project_id, q.site, q.updated_at
  from atelier.projects q
  where q.owner = p_owner and q.project_id = any(p_ids)
$$;

-- Scrittura dei progetti, con la regola last-write-wins applicata dal database:
-- due dispositivi possono spingere in qualunque ordine senza cancellarsi il
-- lavoro a vicenda.
create or replace function public.atelier_cloud_upserts(p_owner text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  v_updated timestamptz;
begin
  for r in select * from jsonb_array_elements(p_rows)
  loop
    v_updated := coalesce((r->>'updated_at')::timestamptz, now());

    -- Guardia anti-resurrezione: se esiste una cancellazione più recente,
    -- la scrittura riguarda una copia non aggiornata e viene ignorata.
    if exists (
      select 1 from atelier.tombstones s
      where s.owner = p_owner and s.project_id = r->>'project_id' and s.deleted_at > v_updated
    ) then
      continue;
    end if;

    insert into atelier.projects as t (owner, project_id, name, slug, preset, site, updated_at, created_at)
    values (
      p_owner,
      r->>'project_id',
      coalesce(nullif(r->>'name', ''), 'Progetto'),
      coalesce(nullif(r->>'slug', ''), 'progetto'),
      coalesce(nullif(r->>'preset', ''), 'editorial'),
      r->'site',
      v_updated,
      now()
    )
    on conflict (owner, project_id) do update
      set name       = excluded.name,
          slug       = excluded.slug,
          preset     = excluded.preset,
          site       = excluded.site,
          updated_at = excluded.updated_at
      where t.updated_at <= excluded.updated_at;

    -- La scrittura è arrivata dopo la cancellazione: la tombstone cessa.
    delete from atelier.tombstones s
    where s.owner = p_owner
      and s.project_id = r->>'project_id'
      and s.deleted_at <= v_updated;
  end loop;
end;
$$;

-- Le cancellazioni: la riga sparisce solo se la tomba non è più vecchia della
-- copia, e la tomba resta (è la memoria che impedisce le resurrezioni).
create or replace function public.atelier_cloud_deletes(p_owner text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  for r in select * from jsonb_array_elements(p_rows)
  loop
    delete from atelier.projects t
    where t.owner = p_owner
      and t.project_id = r->>'project_id'
      and (r->>'deleted_at')::timestamptz >= t.updated_at;

    insert into atelier.tombstones as s (owner, project_id, deleted_at)
    values (p_owner, r->>'project_id', coalesce((r->>'deleted_at')::timestamptz, now()))
    on conflict (owner, project_id) do update
      set deleted_at = greatest(s.deleted_at, excluded.deleted_at);
  end loop;
end;
$$;

-- Le tombe di un workspace, per il confronto dei piani di sincronizzazione.
create or replace function public.atelier_cloud_tombstones(p_owner text)
returns table(project_id text, deleted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select t.project_id, t.deleted_at from atelier.tombstones t where t.owner = p_owner
$$;

-- Numeri complessivi dell'archivio: nessun contenuto, solo conteggi.
create or replace function public.atelier_cloud_stats()
returns table(owners bigint, projects bigint, newest timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct q.owner), count(*), max(q.updated_at) from atelier.projects q
$$;
