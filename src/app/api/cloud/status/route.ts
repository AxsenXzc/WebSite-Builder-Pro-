import { errorResponse, unauthorized } from "@/lib/util/api-error";
import { sessionFromRequest } from "@/lib/auth/server";
import { cloudStatus } from "@/lib/cloud/config";
import { cloudJson, requireCloudContext } from "@/lib/cloud/server";
import { cloudList, cloudTombstones } from "@/lib/cloud/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stato dell'archivio per la persona collegata.
 *
 * Non tocca i contenuti: dice solo se il cloud è configurato, quante righe ci
 * sono nel bucket del workspace e quante tombe (eliminazioni) sono note. Serve
 * al pannello della dashboard per decidere cosa proporre.
 *
 * L'owner arriva dallo stesso `requireCloudContext` usato da `/sync` e `/push`:
 * lo stato deve descrivere esattamente il bucket che la sincronizzazione
 * scriverà, altrimenti i numeri mostrati sarebbero di un altro archivio.
 * Quando il cloud non è configurato la risposta resta un JSON leggibile — con
 * l'elenco delle variabili mancanti — invece di un errore: il pannello deve
 * poterlo spiegare.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    if (!sessionFromRequest(request)) unauthorized("Serve una sessione per leggere lo stato dell'archivio");

    const status = cloudStatus();
    if (!status.configured) {
      return Response.json({ configured: false, missing: status.missing, session: true });
    }

    const ctx = requireCloudContext(request);
    const [list, tombe] = await Promise.all([
      cloudList(ctx.config, ctx.owner, null),
      cloudTombstones(ctx.config, ctx.owner),
    ]);

    if (!list.ok) {
      // Il cloud è configurato ma non raggiungibile: si dice con chiarezza,
      // l'interfaccia mostra il messaggio invece di un errore opaco.
      return cloudJson({ configured: true, reachable: false, message: list.message }, ctx);
    }

    return cloudJson(
      {
        configured: true,
        reachable: true,
        ownerKind: ctx.owner.startsWith("local:") ? "dispositivo" : "account",
        remoteProjects: list.rows.length,
        remoteTombstones: tombe.ok ? tombe.rows.length : 0,
        newest: list.rows[0]?.updated_at ?? null,
      },
      ctx,
    );
  } catch (error) {
    return errorResponse(error, { route: "cloud/status" });
  }
}
