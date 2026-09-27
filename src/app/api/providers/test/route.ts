import { generateText } from "ai";
import { z } from "zod";
import { classifyProviderError } from "@/lib/ai/quota-ledger";
import { PROVIDERS, providerSpec, resolveModel, type ProviderId } from "@/lib/ai/providers";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verifica una chiave con una richiesta minuscola: costo trascurabile, esito immediato. */

const RequestSchema = z.object({
  provider: z.enum(PROVIDERS.map((item) => item.id) as [ProviderId, ...ProviderId[]]),
  apiKey: z.string().min(4),
  accountId: z.string().optional(),
});

export async function POST(request: Request): Promise<Response> {
  let payload: z.infer<typeof RequestSchema>;
  try {
    payload = RequestSchema.parse(await request.json());
  } catch (error) {
    // Stesso contratto d'errore delle altre route, più `ok: false`: l'interfaccia
    // legge l'esito da un solo campo e il codice d'errore resta stabile.
    return Response.json(
      {
        ok: false,
        error: "Richiesta non valida",
        code: "VALIDATION",
        hint: error instanceof Error ? error.message.split("\n")[0] : undefined,
      },
      { status: 422 },
    );
  }

  const spec = providerSpec(payload.provider);
  const started = Date.now();

  try {
    const model = resolveModel(payload.provider, spec.defaultModel, {
      [payload.provider]: payload.apiKey,
      cloudflareAccountId: payload.accountId,
    });

    const { text, usage } = await generateText({
      model,
      prompt: "Rispondi esattamente con: ok",
      maxOutputTokens: 12,
    });

    return Response.json({
      ok: true,
      provider: payload.provider,
      model: spec.defaultModel,
      message: `Chiave valida. Risposta: "${text.trim().slice(0, 40)}"`,
      tokens: usage?.totalTokens ?? null,
      ms: Date.now() - started,
    });
  } catch (error) {
    // Una chiave sbagliata non è un errore del server: si racconta e si va avanti.
    const classified = classifyProviderError(error);
    const hint =
      classified.kind === "auth"
        ? "La chiave non è valida o non ha i permessi necessari."
        : classified.kind === "rate"
          ? "La chiave funziona ma la quota è momentaneamente esaurita: riprova fra poco."
          : classified.kind === "context"
            ? "Richiesta troppo lunga per il contesto di questo modello."
            : "Controlla la connessione e riprova.";
    return Response.json({
      ok: false,
      provider: payload.provider,
      model: spec.defaultModel,
      kind: classified.kind,
      message: classified.message.slice(0, 300),
      hint,
      ms: Date.now() - started,
    });
  }
}
