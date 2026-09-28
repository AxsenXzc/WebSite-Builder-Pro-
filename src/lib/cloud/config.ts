/**
 * Configurazione dell'archivio cloud.
 *
 * Tre variabili, tutte lato server: l'URL e la chiave publishable di Supabase
 * (riconoscibili pubblicamente, servono solo a indirizzare le RPC) e il segreto
 * di firma `ATELIER_CLOUD_SECRET`, senza il quale nessuna richiesta al database
 * viene inoltrata. Le chiavi non raggiungono mai il browser.
 *
 * Per URL e chiave valgono anche i nomi con prefisso `NEXT_PUBLIC_`: sono quelli
 * che usa il client Supabase e li troviamo in molte guide, quindi accettarli
 * evita che una configurazione corretta venga dichiarata incompleta. Il segreto
 * di firma no: quello non ha una versione pubblica.
 */

export type CloudConfig = {
  url: string;
  apiKey: string;
  secret: string;
};

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

/** I valori presenti nell'ambiente, senza giudizio sulla completezza. */
function readEnv(): { url: string; apiKey: string; secret: string } {
  return {
    url: clean(process.env.SUPABASE_URL) || clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    apiKey:
      clean(process.env.SUPABASE_PUBLISHABLE_KEY) ||
      clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
      clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    secret: clean(process.env.ATELIER_CLOUD_SECRET),
  };
}

export function cloudConfig(): CloudConfig | null {
  const { url, apiKey, secret } = readEnv();
  if (!url || !apiKey || !secret) return null;
  return { url: url.replace(/\/+$/, ""), apiKey, secret };
}

/** Lo stato cloud si esprime in una riga, senza esporre valori. */
export type CloudStatus = {
  configured: boolean;
  missing: string[];
};

export function cloudStatus(): CloudStatus {
  const { url, apiKey, secret } = readEnv();
  const missing: string[] = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!apiKey) missing.push("SUPABASE_PUBLISHABLE_KEY");
  if (!secret) missing.push("ATELIER_CLOUD_SECRET");
  return { configured: missing.length === 0, missing };
}
