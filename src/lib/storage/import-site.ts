import { SiteSchema, type Site } from "@/lib/schema/site";

/**
 * Reimportazione di un progetto.
 *
 * Il file `progetto.atelier.json` che finisce nell'archivio esportato è il sito
 * completo: qui lo rileggiamo attraverso lo stesso schema con cui è stato
 * scritto, quindi un file corrotto o di un'altra epoca viene rifiutato con un
 * motivo leggibile invece di entrare nell'editor e romperlo.
 *
 * Funzione pura: nessun accesso al database, così è verificabile nei test.
 */

export type ImportResult = { ok: true; site: Site } | { ok: false; error: string };

export function parseImportedSite(text: string): ImportResult {
  if (!text.trim()) return { ok: false, error: "Il file è vuoto." };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Il file non è JSON valido: prendi `progetto.atelier.json` dall'archivio esportato." };
  }

  // Un archivio può contenere anche un file di progetto annidato: se il JSON è
  // un oggetto con `site`, usiamo quello.
  const candidate =
    typeof raw === "object" && raw !== null && "site" in raw ? (raw as { site: unknown }).site : raw;

  const parsed = SiteSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "struttura del file";
    return { ok: false, error: `Il file non è un progetto Atelier: campo «${where}» — ${issue?.message ?? "non valido"}.` };
  }

  if (parsed.data.pages.length === 0) {
    return { ok: false, error: "Il progetto non contiene pagine." };
  }

  return { ok: true, site: parsed.data };
}

/** Nome di file leggibile per un progetto, usato dall'import e dall'export. */
export function projectFileName(site: Site): string {
  return `${site.slug || "progetto"}.atelier.json`;
}
