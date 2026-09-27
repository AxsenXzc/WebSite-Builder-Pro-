import type { ProviderId } from "@/lib/ai/providers";

/**
 * Custodia delle chiavi API.
 *
 * Due modalità, entrambe senza inviare nulla a terzi:
 *   - con passphrase: le chiavi vengono cifrate (PBKDF2 + AES-GCM) e salvate
 *     nel browser; la passphrase non viene mai memorizzata;
 *   - senza passphrase: restano in memoria per la sessione e spariscono alla
 *     chiusura della scheda.
 * In ogni caso le chiavi viaggiano solo verso le route interne dell'app.
 */

export type StoredKeys = Partial<Record<ProviderId, string>> & { cloudflareAccountId?: string };

const STORAGE_KEY = "atelier.keys.v1";
const SESSION_KEY = "atelier.keys.session.v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 210_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function saveKeysEncrypted(keys: StoredKeys, passphrase: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const payload = encoder.encode(JSON.stringify(keys));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, payload);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ v: 1, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(new Uint8Array(cipher)) }),
  );
  sessionStorage.removeItem(SESSION_KEY);
}

export async function loadKeysEncrypted(passphrase: string): Promise<StoredKeys> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error("Nessuna chiave salvata in questo browser.");
  const parsed = JSON.parse(raw) as { salt: string; iv: string; data: string };
  const key = await deriveKey(passphrase, fromBase64(parsed.salt));
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(parsed.iv) as BufferSource },
      key,
      fromBase64(parsed.data) as BufferSource,
    );
    return JSON.parse(decoder.decode(plain)) as StoredKeys;
  } catch {
    throw new Error("Passphrase errata: non riesco a decifrare le chiavi.");
  }
}

/** Modalità sessione: nessuna cifratura, nessuna persistenza oltre la scheda. */
export function saveKeysForSession(keys: StoredKeys): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(keys));
}

export function loadSessionKeys(): StoredKeys {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StoredKeys;
  } catch {
    return {};
  }
}

export function hasEncryptedKeys(): boolean {
  return typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) !== null;
}

export function clearKeys(): void {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

/** Riassunto per l'interfaccia: mostra solo gli ultimi caratteri, mai la chiave intera. */
export function maskKey(value: string | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 3)}••••${value.slice(-4)}`;
}
