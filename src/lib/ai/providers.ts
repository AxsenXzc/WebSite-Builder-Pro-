import { createCerebras } from "@ai-sdk/cerebras";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * Provider gratuiti.
 *
 * I limiti sono quelli verificati a settembre 2026 e servono al ledger per
 * stimare le quote residue: se un provider cambia i suoi numeri, si aggiorna
 * una riga qui e il router si adegua senza altri interventi.
 */

export type ProviderId = "gemini" | "groq" | "cerebras" | "openrouter" | "cloudflare";

export type ProviderSpec = {
  id: ProviderId;
  label: string;
  /** Variabili d'ambiente accettate, in ordine di preferenza. */
  envKeys: string[];
  defaultModel: string;
  limits: { rpm: number; rpd: number; tpm: number; tpd: number };
  /** 1 = qualità migliore, 5 = più economico. Usato per ordinare le catene. */
  tier: number;
  signupUrl: string;
  note: string;
  requiresAccountId?: boolean;
};

export const PROVIDERS: ProviderSpec[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
    defaultModel: "gemini-2.5-flash",
    limits: { rpm: 15, rpd: 1_500, tpm: 1_000_000, tpd: 4_000_000 },
    tier: 1,
    signupUrl: "https://aistudio.google.com/apikey",
    note: "Miglior equilibrio: ~1.500 richieste al giorno, legge immagini, output strutturato affidabile.",
  },
  {
    id: "groq",
    label: "Groq",
    envKeys: ["GROQ_API_KEY"],
    defaultModel: "llama-3.3-70b-versatile",
    limits: { rpm: 30, rpd: 1_000, tpm: 12_000, tpd: 200_000 },
    tier: 2,
    signupUrl: "https://console.groq.com/keys",
    note: "Il più veloce: ideale per iterare sulle sezioni. Limite giornaliero di token contenuto.",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    envKeys: ["CEREBRAS_API_KEY"],
    defaultModel: "llama-3.3-70b",
    limits: { rpm: 30, rpd: 14_400, tpm: 60_000, tpd: 1_000_000 },
    tier: 3,
    signupUrl: "https://cloud.cerebras.ai",
    note: "Un milione di token al giorno gratis: perfetto per grandi volumi di testo. Contesto limitato a 8k.",
  },
  {
    id: "openrouter",
    label: "OpenRouter (modelli gratuiti)",
    envKeys: ["OPENROUTER_API_KEY"],
    defaultModel: "openrouter/free",
    limits: { rpm: 20, rpd: 50, tpm: 20_000, tpd: 200_000 },
    tier: 4,
    signupUrl: "https://openrouter.ai/keys",
    note: "Fallback universale: il router `/free` sceglie fra i modelli gratuiti disponibili.",
  },
  {
    id: "cloudflare",
    label: "Cloudflare Workers AI",
    envKeys: ["CLOUDFLARE_API_TOKEN"],
    defaultModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    limits: { rpm: 300, rpd: 10_000, tpm: 100_000, tpd: 500_000 },
    tier: 4,
    signupUrl: "https://dash.cloudflare.com/profile/api-tokens",
    note: "10.000 neurons al giorno gratis, utili anche per generare immagini. Richiede l'ID account.",
    requiresAccountId: true,
  },
];

export const PROVIDER_IDS = PROVIDERS.map((provider) => provider.id);

export function providerSpec(id: ProviderId): ProviderSpec {
  const spec = PROVIDERS.find((provider) => provider.id === id);
  if (!spec) throw new Error(`Provider sconosciuto: ${id}`);
  return spec;
}

export type ProviderKeys = Partial<Record<ProviderId, string>> & { cloudflareAccountId?: string };

/** Chiavi effettive: quelle fornite dall'utente hanno priorità su quelle d'ambiente. */
export function resolveKeys(keys: ProviderKeys = {}): ProviderKeys {
  const env = process.env;
  const resolved: ProviderKeys = { ...keys };

  for (const spec of PROVIDERS) {
    if (resolved[spec.id]) continue;
    for (const envKey of spec.envKeys) {
      const value = env[envKey];
      if (value) {
        resolved[spec.id] = value;
        break;
      }
    }
  }
  resolved.cloudflareAccountId = resolved.cloudflareAccountId || env.CLOUDFLARE_ACCOUNT_ID;
  return resolved;
}

/** Provider realmente utilizzabili con le chiavi presenti. */
export function availableProviders(keys: ProviderKeys): ProviderId[] {
  return PROVIDERS.filter((spec) => Boolean(keys[spec.id])).map((spec) => spec.id);
}

/** Costruisce il modello AI SDK per un provider. */
export function resolveModel(id: ProviderId, model: string, keys: ProviderKeys): LanguageModel {
  const apiKey = keys[id];
  if (!apiKey) throw new Error(`Chiave mancante per ${id}`);

  switch (id) {
    case "gemini":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "groq":
      return createGroq({ apiKey })(model);
    case "cerebras":
      return createCerebras({ apiKey })(model);
    case "openrouter":
      return createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        headers: { "HTTP-Referer": "https://atelier.local", "X-Title": "Atelier" },
      })(model);
    case "cloudflare": {
      const accountId = keys.cloudflareAccountId;
      if (!accountId) throw new Error("Serve l'ID account Cloudflare per usare Workers AI");
      return createOpenAICompatible({
        name: "cloudflare",
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
        apiKey,
      })(model);
    }
    default: {
      const exhaustive: never = id;
      throw new Error(`Provider non gestito: ${String(exhaustive)}`);
    }
  }
}

/** Diagnostica senza rete: dice cosa manca e cosa è pronto. */
export function keysReport(keys: ProviderKeys): { id: ProviderId; label: string; ready: boolean; missing?: string; note: string; signupUrl: string }[] {
  return PROVIDERS.map((spec) => {
    const hasKey = Boolean(keys[spec.id]);
    const needsAccount = Boolean(spec.requiresAccountId) && !keys.cloudflareAccountId;
    return {
      id: spec.id,
      label: spec.label,
      ready: hasKey && !needsAccount,
      missing: !hasKey ? "chiave API assente" : needsAccount ? "ID account assente" : undefined,
      note: spec.note,
      signupUrl: spec.signupUrl,
    };
  });
}
