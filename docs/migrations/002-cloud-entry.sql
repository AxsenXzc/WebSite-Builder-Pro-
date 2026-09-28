-- Archivio cloud di Atelier — punto d'ingresso firmato.
--
-- La tabella dei progetti vive nello schema `atelier` (mai esposto via REST,
-- senza privilegi per i ruoli Web). Le RPC interne non sono più chiamabili
-- direttamente: l'unica porta è `atelier_cloud_entry`, che verifica la busta
-- HMAC `{ payload, ts, sig }` prima di eseguire l'operazione richiesta.
-- I tre campi della busta sono parametri nominali della funzione: il corpo
-- JSON della richiesta li mappa direttamente. I nomi devono restare
-- esattamente `payload`, `ts`, `sig`, perché PostgREST risolve gli argomenti
-- per nome contro il corpo inviato. Il segreto di firma vive in
-- `atelier.secrets`, raggiungibile solo dalle funzioni security definer.

create extension if not exists pgcrypto;

create table if not exists atelier.secrets (
  name text primary key,
  value text not null
);

-- Il valore viene impostato durante il provisioning; qui si aggiorna se cambia.
insert into atelier.secrets (name, value)
-- Sostituisci il segnaposto con il valore di ATELIER_CLOUD_SECRET: deve essere
-- identico a quello dell'applicazione, altrimenti ogni firma viene rifiutata.
values ('atelier_cloud_secret', '<ATELIER_CLOUD_SECRET>')
on conflict (name) do update set value = excluded.value;

revoke all on atelier.secrets from anon, authenticated;

-- Le RPC interne perdono l'esecuzione pubblica: solo l'entry firma.
revoke execute on function
  public.atelier_cloud_list(text, text),
  public.atelier_cloud_sites(text, text[]),
  public.atelier_cloud_upserts(text, jsonb),
  public.atelier_cloud_deletes(text, jsonb),
  public.atelier_cloud_tombstones(text),
  public.atelier_cloud_stats()
from public, anon, authenticated;

create or replace function public._atelier_b64url_decode(input text)
returns bytea
language sql
immutable
as $$
  select decode(
    rpad(translate(input, '-_', '+/'), (length(translate(input, '-_', '+/')) + 3) / 4 * 4, '='),
    'base64'
  )
$$;

create or replace function public.atelier_cloud_entry(payload text, ts bigint, sig text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_secret text;
  v_args jsonb;
  v_op text;
  v_owner text;
begin
  if payload is null or sig is null or ts is null then
    raise exception 'busta incompleta';
  end if;
  if length(payload) > 2000000 then
    raise exception 'payload troppo grande';
  end if;
  if abs(v_now - ts) > 300000 then
    raise exception 'firma fuori finestra';
  end if;

  select s.value into v_secret from atelier.secrets s where s.name = 'atelier_cloud_secret' limit 1;
  if v_secret is null or v_secret = '' then
    raise exception 'segreto di firma non configurato';
  end if;

  -- `hmac` vive nell'estensione pgcrypto (schema `extensions`): con
  -- `search_path = ''` va qualificato, mentre `decode` è nel catalogo.
  if public._atelier_b64url_decode(sig)
     <> extensions.hmac(convert_to(payload || '.' || ts::text, 'utf8'), convert_to(v_secret, 'utf8'), 'sha256')
  then
    raise exception 'firma non valida';
  end if;

  v_args := payload::jsonb;
  v_op := v_args->>'op';
  v_owner := v_args->>'owner';
  -- `stats` è l'unica operazione che non riguarda un workspace.
  if v_op <> 'stats' and (v_owner is null or length(v_owner) > 200) then
    raise exception 'workspace assente o troppo lungo';
  end if;

  case v_op
    when 'list' then
      -- Gli istanti escono sempre come ISO 8601 in UTC con la `Z`: il formato
      -- interno di Postgres (`+00:00`) confronterebbe male con le stringhe che
      -- produce il browser.
      return jsonb_build_object(
        'rows',
        coalesce((
          select jsonb_agg(
            (to_jsonb(x) - 'created_at' - 'updated_at')
            || jsonb_build_object(
                 'updated_at',
                 to_char(x.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
               )
          )
          from public.atelier_cloud_list(v_owner, v_args->>'ts_head') x
        ), '[]'::jsonb)
      );
    when 'sites' then
      return jsonb_build_object(
        'rows',
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'project_id', x.project_id,
            'site', x.site,
            'updated_at', to_char(x.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          ))
          from public.atelier_cloud_sites(v_owner,
            (select array_agg(value::text) from jsonb_array_elements_text(v_args->'ids'))
          ) x
        ), '[]'::jsonb)
      );
    when 'upserts' then
      perform public.atelier_cloud_upserts(v_owner, v_args->'rows');
      return jsonb_build_object('done', true);
    when 'deletes' then
      perform public.atelier_cloud_deletes(v_owner, v_args->'rows');
      return jsonb_build_object('done', true);
    when 'tombstones' then
      return jsonb_build_object(
        'rows',
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'project_id', x.project_id,
            'deleted_at', to_char(x.deleted_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          ))
          from public.atelier_cloud_tombstones(v_owner) x
        ), '[]'::jsonb)
      );
    when 'stats' then
      return jsonb_build_object(
        'rows',
        coalesce((select jsonb_agg(to_jsonb(x)) from public.atelier_cloud_stats() x), '[]'::jsonb)
      );
    else
      raise exception 'operazione sconosciuta: %', coalesce(v_op, '(null)');
  end case;
end;
$$;

revoke execute on function public._atelier_b64url_decode(text) from public, anon, authenticated;
revoke execute on function public.atelier_cloud_entry(text, bigint, text) from public;
grant execute on function public.atelier_cloud_entry(text, bigint, text) to anon, authenticated;
