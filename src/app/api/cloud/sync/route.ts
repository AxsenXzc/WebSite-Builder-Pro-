import { errorResponse, badRequest } from "@/lib/util/api-error";
import { cloudJson, requireCloudContext } from "@/lib/cloud/server";
import { cloudDeletes, cloudList, cloudSites, cloudTombstones } from "@/lib/cloud/repo";
import { describePlan, planSync, type CloudRow, type CloudTombstone, type LocalRow } from "@/lib/storage/sync-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_INDEX_ROWS = 500;

/**
 * Sincronizzazione bidirezionale.
 *
 * Il client manda l'indice del proprio archivio (identificativi e istanti, non
 * i documenti) e le proprie tombe; il server costruisce il piano last-write-wins
 * contro il cloud, propaga subito le eliminazioni più recenti e restituisce:
 * i documenti da scaricare (già letti dal cloud) e l'elenco di ciò che il
 * client deve spingere con la chiamata `/api/cloud/push` successiva.
 *
 * L'owner arriva dalla sessione (con identificativo di dispositivo per le
 * sessioni locali): il client non può scegliere di quale bucket leggere.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const ctx = requireCloudContext(request);

    const body = (await request.json().catch(() => null)) as { local?: unknown; deletions?: unknown } | null;
    if (!body || typeof body !== "object") badRequest("Corpo della richiesta assente");

    const local = readIndex(body.local);
    const deletions = readDeletions(body.deletions);

    const [list, remoteTombe] = await Promise.all([
      cloudList(ctx.config, ctx.owner, null),
      cloudTombstones(ctx.config, ctx.owner),
    ]);
    if (!list.ok) return cloudJson({ ok: false, message: list.message }, ctx, { status: 502 });
    if (!remoteTombe.ok) return cloudJson({ ok: false, message: remoteTombe.message }, ctx, { status: 502 });

    // Tombe efficaci: quelle del cloud, aggiornate dalle più recenti dichiarate
    // dal client (una cancellazione fatta qui deve vincere anche sul piano).
    const effective = new Map<string, CloudTombstone>();
    for (const tomb of remoteTombe.rows) effective.set(tomb.project_id, tomb);
    for (const tomb of deletions) {
      const existing = effective.get(tomb.project_id);
      if (!existing || Date.parse(tomb.deleted_at) > Date.parse(existing.deleted_at)) {
        effective.set(tomb.project_id, tomb);
      }
    }

    const plan = planSync(local, list.rows, [...effective.values()]);

    // Le eliminazioni da propagare partono subito: il push dei contenuti resta
    // al client, che possiede i documenti.
    if (plan.pushDeletes.length) {
      const result = await cloudDeletes(ctx.config, ctx.owner, plan.pushDeletes);
      if (!result.ok) return cloudJson({ ok: false, message: result.message }, ctx, { status: 502 });
    }

    const pulled: { site: unknown; updated_at: string }[] = [];
    if (plan.pull.length) {
      const sites = await cloudSites(ctx.config, ctx.owner, plan.pull);
      if (!sites.ok) return cloudJson({ ok: false, message: sites.message }, ctx, { status: 502 });
      pulled.push(...sites.rows.map((row) => ({ site: row.site, updated_at: row.updated_at })));
    }

    return cloudJson(
      {
        ok: true,
        plan,
        pulled,
        propagated: plan.pushDeletes.length,
        note: describePlan(plan),
      },
      ctx,
    );
  } catch (error) {
    return errorResponse(error, { route: "cloud/sync" });
  }
}

function readIndex(value: unknown): LocalRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is { id: unknown; updatedAt: unknown } => typeof row === "object" && row !== null)
    .slice(0, MAX_INDEX_ROWS)
    .map((row) => ({ id: String(row.id ?? ""), updatedAt: String(row.updatedAt ?? "") }))
    .filter((row) => row.id && row.updatedAt);
}

function readDeletions(value: unknown): CloudTombstone[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is { id: unknown; deletedAt: unknown } => typeof row === "object" && row !== null)
    .slice(0, MAX_INDEX_ROWS)
    .map((row) => ({ project_id: String(row.id ?? ""), deleted_at: String(row.deletedAt ?? "") }))
    .filter((row) => row.project_id && row.deleted_at);
}
