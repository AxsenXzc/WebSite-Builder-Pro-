"use client";

import { useEffect, useState } from "react";
import { PROVIDERS, type ProviderId } from "@/lib/ai/providers";
import { testProviderKey } from "@/lib/ai/client";
import {
  clearKeys,
  hasEncryptedKeys,
  loadKeysEncrypted,
  loadSessionKeys,
  maskKey,
  saveKeysEncrypted,
  saveKeysForSession,
  type StoredKeys,
} from "@/lib/storage/secure-keys";

type KeyState = { value: string; status: "vuota" | "verificata" | "errore" | "verifica"; message?: string };

/** Separatore delle migliaia scritto a mano: `toLocaleString` cambia fra Node e browser. */
function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Chiavi dei provider AI.
 *
 * Sono opzionali per costruzione: il composer genera comunque un sito completo.
 * Restano nel browser — in memoria per la sessione, oppure cifrate AES-GCM con
 * una passphrase che non viene mai salvata.
 */
export function KeysPanel({
  compact = false,
  activeKeys,
  onStatus,
}: {
  compact?: boolean;
  activeKeys?: () => StoredKeys;
  onStatus?: (message: string) => void;
}) {
  const [keys, setKeys] = useState<Record<string, KeyState>>({});
  const [passphrase, setPassphrase] = useState("");
  const [remember, setRemember] = useState(false);
  const [cloudflareAccountId, setCloudflareAccountId] = useState("");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadSessionKeys();
    if (Object.keys(saved).length === 0) return;
    const next: Record<string, KeyState> = {};
    for (const [id, value] of Object.entries(saved)) {
      if (id === "cloudflareAccountId") continue;
      next[id] = { value: maskKey(value as string), status: "verificata", message: "caricata dalla sessione" };
    }
    setKeys(next);
    setCloudflareAccountId((saved.cloudflareAccountId as string) ?? "");
  }, []);

  const collect = (): StoredKeys => {
    if (activeKeys) return activeKeys();
    const raw = loadSessionKeys();
    const out: StoredKeys = { ...raw };
    for (const [id, state] of Object.entries(keys)) {
      if (state.value && !state.value.includes("••••")) out[id as ProviderId] = state.value.trim();
    }
    if (cloudflareAccountId) out.cloudflareAccountId = cloudflareAccountId.trim();
    return out;
  };

  async function verifyProvider(id: ProviderId) {
    const state = keys[id];
    if (!state?.value || state.value.includes("••••")) return;
    setKeys((current) => ({ ...current, [id]: { ...current[id], status: "verifica" } }));
    const result = await testProviderKey({
      provider: id,
      apiKey: state.value.trim(),
      accountId: cloudflareAccountId || undefined,
    });
    setKeys((current) => ({
      ...current,
      [id]: {
        ...current[id],
        status: result.ok ? "verificata" : "errore",
        message: result.ok ? result.message : `${result.hint ?? ""} ${result.message}`.trim(),
      },
    }));
  }

  async function persist() {
    const payload = collect();
    const message =
      remember && passphrase.length >= 8
        ? "Chiavi cifrate (AES-GCM) e salvate in questo browser. La passphrase non viene mai memorizzata."
        : "Chiavi tenute in memoria per questa sessione. Per salvarle cifrate serve una passphrase di almeno 8 caratteri.";
    if (remember && passphrase.length >= 8) {
      await saveKeysEncrypted(payload, passphrase);
    } else {
      saveKeysForSession(payload);
    }
    setNote(message);
    onStatus?.(message);
  }

  return (
    <div className="grid gap-3">
      <p className="text-xs text-ink-500">
        Senza chiavi l&apos;app genera comunque un sito completo, con il composer deterministico. Con una chiave gratuita, l&apos;AI
        riscrive i testi e sceglie la direzione creativa, con una catena di ripiego fra provider.
      </p>

      {PROVIDERS.map((provider) => {
        const state = keys[provider.id] ?? { value: "", status: "vuota" as const };
        return (
          <div key={provider.id} className="grid gap-1">
            <div className="flex items-center justify-between">
              <span className="label">{provider.label}</span>
              <a className="text-[10px] text-accent-400 underline" href={provider.signupUrl} target="_blank" rel="noreferrer">
                ottieni gratis
              </a>
            </div>
            <div className="flex gap-2">
              <input
                className="field"
                type="password"
                placeholder={`${groupThousands(provider.limits.rpd)} richieste/giorno`}
                value={state.value}
                onChange={(event) =>
                  setKeys((current) => ({ ...current, [provider.id]: { value: event.target.value, status: "vuota" } }))
                }
              />
              <button type="button" className="btn" onClick={() => void verifyProvider(provider.id)} disabled={state.status === "verifica"}>
                {state.status === "verifica" ? "…" : "Testa"}
              </button>
            </div>
            {provider.id === "cloudflare" ? (
              <input
                className="field mt-1"
                placeholder="ID account Cloudflare"
                value={cloudflareAccountId}
                onChange={(event) => setCloudflareAccountId(event.target.value)}
              />
            ) : null}
            <span
              className={
                state.status === "verificata"
                  ? "text-[10px] text-ok-500"
                  : state.status === "errore"
                    ? "text-[10px] text-danger-500"
                    : "text-[10px] text-ink-600"
              }
            >
              {state.message ?? provider.note}
            </span>
          </div>
        );
      })}

      <div className="grid gap-2 border-t border-surface-800 pt-3">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          Salva le chiavi cifrate in questo browser
        </label>
        {remember ? (
          <input
            className="field"
            type="password"
            placeholder="Passphrase (min. 8 caratteri)"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => void persist()}>
            Salva chiavi
          </button>
          {hasEncryptedKeys() ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                try {
                  const loaded = await loadKeysEncrypted(passphrase);
                  saveKeysForSession(loaded);
                  setNote("Chiavi decifrate e caricate per questa sessione.");
                } catch (caught) {
                  setNote(caught instanceof Error ? caught.message : "Decifratura non riuscita");
                }
              }}
            >
              Carica chiavi salvate
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              clearKeys();
              setKeys({});
              setNote("Chiavi rimosse da questo browser.");
            }}
          >
            Rimuovi
          </button>
        </div>
        {note ? <p className="text-[11px] text-ink-500">{note}</p> : null}
        {compact ? (
          <p className="text-[11px] text-ink-600">
            Puoi modificare queste chiavi anche dopo, dalla voce <span className="text-ink-500">Chiavi AI</span>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
