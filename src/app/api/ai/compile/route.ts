import { BriefSchema, SECTORS, STYLE_PRESET_NAMES } from "@/lib/schema/site";
import { compileSite, type CompileEvent } from "@/lib/ai/compile";
import { QuotaLedger } from "@/lib/ai/quota-ledger";
import type { ProviderKeys } from "@/lib/ai/providers";
import { ApiError, errorResponse } from "@/lib/util/api-error";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compilazione di un sito.
 *
 * Risponde in streaming: l'editor mostra gli stadi mentre accadono, e riceve il
 * sito completo nell'evento finale. Le chiavi arrivano dal client (cifrate a
 * riposo nel browser) e vengono usate solo all'interno di questa richiesta.
 */

const RequestSchema = z.object({
  prompt: z.string().min(3),
  businessName: z.string().default(""),
  sector: z.enum(SECTORS).default("generic"),
  stylePreset: z.enum(STYLE_PRESET_NAMES).optional(),
  tone: z.string().default("professionale"),
  contacts: z
    .object({
      email: z.string().default(""),
      phone: z.string().default(""),
      city: z.string().default(""),
      address: z.string().default(""),
    })
    .default({ email: "", phone: "", city: "", address: "" }),
  keys: z.record(z.string(), z.string()).default({}),
  knownSignatures: z.array(z.string()).default([]),
  variation: z.number().default(0),
  maxAiPages: z.number().min(0).max(12).default(4),
});

// Il ledger vive nel processo del server: così le quote già consumate sono note
// anche alle richieste successive (salvo riavvio).
const globalLedger = globalThis as unknown as { atelierLedger?: QuotaLedger };
function ledger(): QuotaLedger {
  if (!globalLedger.atelierLedger) globalLedger.atelierLedger = new QuotaLedger();
  return globalLedger.atelierLedger;
}

export async function POST(request: Request): Promise<Response> {
  let payload: z.infer<typeof RequestSchema>;
  let brief: ReturnType<typeof BriefSchema.parse>;
  try {
    payload = RequestSchema.parse(await request.json());
    brief = BriefSchema.parse({
      prompt: payload.prompt,
      businessName: payload.businessName,
      sector: payload.sector,
      stylePreset: payload.stylePreset,
      tone: payload.tone,
      contacts: payload.contacts,
    });
  } catch (error) {
    return errorResponse(
      new ApiError(
        "Richiesta non valida",
        422,
        "VALIDATION",
        error instanceof Error ? error.message.split("\n")[0] : undefined,
      ),
      { route: "ai/compile" },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: CompileEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await compileSite({
          brief,
          keys: payload.keys as ProviderKeys,
          ledger: ledger(),
          knownSignatures: payload.knownSignatures,
          variation: payload.variation,
          maxAiPages: payload.maxAiPages,
          onEvent: send,
        });
      } catch (error) {
        send({
          type: "warning",
          message: `Errore durante la compilazione: ${error instanceof Error ? error.message : "sconosciuto"}`,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}
