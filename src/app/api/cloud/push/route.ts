import { errorResponse, badRequest, validationFailed } from "@/lib/util/api-error";
import { cloudJson, requireCloudContext } from "@/lib/cloud/server";
import { cloudUpserts, type CloudPushRow } from "@/lib/cloud/repo";
import { chunkBySize, jsonSize } from "@/lib/cloud/batch";
import { SiteSchema } from "@/lib/schema/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SITES_PER_REQUEST = 50;

/**
 * Scrittura dei progetti nel cloud.
 *
 * Il client invia i documenti completi (solo quelli che il piano ha dichiarato
 * da spingere); qui vengono riverificati con lo stesso schema dell'import,
 * suddivisi in lotti che rispettano il tetto della busta firmata e scritti con
 * la regola last-write-wins del database: due dispositivi possono spingere in
 * qualunque ordine senza cancellarsi a vicenda il lavoro.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const ctx = requireCloudContext(request);

    const body = (await request.json().catch(() => null)) as { sites?: unknown } | null;
    if (!body || !Array.isArray(body.sites)) badRequest("Elenco dei progetti assente");
    if (body.sites.length === 0) return cloudJson({ ok: true, pushed: 0 }, ctx);
    if (body.sites.length > MAX_SITES_PER_REQUEST) {
      badRequest(`Troppi progetti in una richiesta (massimo ${MAX_SITES_PER_REQUEST})`);
    }

    const rows: CloudPushRow[] = [];
    for (const raw of body.sites) {
      const parsed = SiteSchema.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const where = issue?.path.join(".") || "struttura";
        validationFailed(`Progetto non valido: campo «${where}» — ${issue?.message ?? "non valido"}`);
      }
      const site = parsed.data;
      rows.push({
        project_id: site.id,
        name: site.name,
        slug: site.slug,
        preset: site.theme.preset,
        site,
        updated_at: site.updatedAt || site.createdAt || new Date().toISOString(),
      });
    }

    let pushed = 0;
    for (const chunk of chunkBySize(rows, jsonSize, 1_200_000)) {
      const result = await cloudUpserts(ctx.config, ctx.owner, chunk);
      if (!result.ok) {
        return cloudJson({ ok: false, pushed, message: result.message }, ctx, { status: 502 });
      }
      pushed += chunk.length;
    }

    return cloudJson({ ok: true, pushed }, ctx);
  } catch (error) {
    return errorResponse(error, { route: "cloud/push" });
  }
}
