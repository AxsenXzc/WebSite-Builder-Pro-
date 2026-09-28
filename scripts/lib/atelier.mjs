/**
 * Utilità condivise dagli script di rilascio.
 *
 * Gli script girano con Node puro (`node scripts/…`), fuori dal bundler: non
 * possono importare `src/lib/cloud/sign.ts` perché gli alias `@/` e i file
 * TypeScript non esistono in quel contesto. Le poche righe di firma e di
 * lettura delle variabili sono quindi ripetute qui — di proposito — con la
 * stessa formula del database: `hmac(sha256, payload || '.' || ts)` in base64url.
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

/** Legge un file `.env` senza dipendenze: righe `CHIAVE=valore`, `#` commenta. */
export function readEnvFile(path) {
  let raw = "";
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;
    const split = text.indexOf("=");
    if (split === -1) continue;
    const key = text.slice(0, split).trim();
    let value = text.slice(split + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) values[key] = value;
  }
  return values;
}

/** Il file `.env.local` fornisce i valori; l'ambiente reale ha la precedenza. */
export function mergedEnv(file = ".env.local") {
  const fromFile = readEnvFile(file);
  const merged = { ...fromFile };
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string" && value.trim()) merged[key] = value.trim();
  }
  return merged;
}

/** Mostra un valore senza stamparlo: per log e schermate condivise. */
export function mask(value) {
  if (!value) return "(vuota)";
  if (value.length <= 8) return `${value.slice(0, 2)}…${value.slice(-2)}`;
  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} caratteri)`;
}

/**
 * La busta firmata attesa da `atelier_cloud_entry`.
 * Ritorna anche il `payload` in chiaro: serve per diagnosi leggibili.
 */
export function signedBody(payload, secret, now = Date.now()) {
  const body = JSON.stringify(payload);
  const ts = now;
  const sig = createHmac("sha256", secret).update(`${body}.${ts}`).digest("base64url");
  return { body: JSON.stringify({ payload: body, ts, sig }), payload: body, ts, sig };
}

/** Chiama la porta firmata dell'archivio. Nessuna eccezione: si legge lo stato. */
export async function callEntry({ url, apiKey, secret }, args, { timeoutMs = 15000 } = {}) {
  const target = `${url.replace(/\/+$/, "")}/rest/v1/rpc/atelier_cloud_entry`;
  let response;
  try {
    response = await fetch(target, {
      method: "POST",
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: signedBody(args, secret).body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : "rete non raggiungibile" };
  }

  const text = await response.text();
  if (!response.ok) {
    let message = `Supabase ha risposto ${response.status}`;
    try {
      const parsed = JSON.parse(text);
      message = parsed.message ?? parsed.error ?? message;
    } catch {
      /* corpo non JSON: resta lo stato */
    }
    return { ok: false, status: response.status, message };
  }

  try {
    return { ok: true, status: response.status, data: text.trim() ? JSON.parse(text) : null };
  } catch {
    return { ok: false, status: response.status, message: "risposta non JSON" };
  }
}
