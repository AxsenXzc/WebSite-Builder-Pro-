import { createHmac } from "node:crypto";
import type { CloudConfig } from "./config";

/**
 * Firma delle richieste verso l'archivio cloud.
 *
 * Ogni chiamata porta un corpo `{ payload, ts, sig }`: `payload` è il JSON
 * dell'operazione, `ts` è l'istante in millisecondi e `sig` è l'HMAC-SHA256 di
 * `payload.ts` con `ATELIER_CLOUD_SECRET`. Il database rifiuta tutto ciò che
 * non è firmato o è più vecchio di cinque minuti: chi dispone della sola
 * chiave publishable non può né leggere né scrivere.
 */

export const SIGNED_BODY_MAX_CHARS = 2_000_000;

export function signedBody<T>(payload: T, secret: string): string {
  const body = JSON.stringify(payload);
  if (body.length > SIGNED_BODY_MAX_CHARS) {
    throw new Error(`Corpo della richiesta troppo grande (${body.length} caratteri).`);
  }
  const ts = Date.now();
  const sig = createHmac("sha256", secret).update(`${body}.${ts}`).digest("base64url");
  return JSON.stringify({ payload: body, ts, sig });
}

/** Finestra di validità della firma: cinque minuti su orologi ragionevoli. */
export const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

export function verifySignature(raw: string, secret: string, now = Date.now()): { ok: true; payload: string } | { ok: false; reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "Corpo non leggibile" };
  }
  if (typeof parsed !== "object" || parsed === null) return { ok: false, reason: "Corpo non leggibile" };
  const { payload, ts, sig } = parsed as { payload?: unknown; ts?: unknown; sig?: unknown };
  if (typeof payload !== "string" || payload.length > SIGNED_BODY_MAX_CHARS) return { ok: false, reason: "Payload assente o troppo grande" };
  if (typeof ts !== "number" || !Number.isFinite(ts)) return { ok: false, reason: "Istante assente" };
  if (Math.abs(now - ts) > SIGNATURE_TOLERANCE_MS) return { ok: false, reason: "Firma fuori finestra" };
  if (typeof sig !== "string") return { ok: false, reason: "Firma assente" };
  const expected = createHmac("sha256", secret).update(`${payload}.${ts}`).digest("base64url");
  if (sig.length !== expected.length || sig !== expected) return { ok: false, reason: "Firma non valida" };
  return { ok: true, payload };
}

export type RpcResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

/** Chiamata a una RPC firmata, con la gestione degli errori già tradotta. */
export async function callRpc<T>(
  config: CloudConfig,
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${config.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: signedBody(args, config.secret),
      cache: "no-store",
    });
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : "Rete non raggiungibile" };
  }

  if (!response.ok) {
    let message = `Supabase ha risposto ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      /* corpo non JSON: resta il messaggio di stato */
    }
    return { ok: false, status: response.status, message };
  }

  if (response.status === 204) return { ok: true, data: undefined as T };
  const text = await response.text();
  if (!text.trim()) return { ok: true, data: undefined as T };
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: response.status, message: "Risposta non è JSON valido" };
  }
}
