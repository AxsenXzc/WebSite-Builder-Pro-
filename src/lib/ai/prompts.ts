import { catalogForPrompt } from "@/lib/schema/registry";
import { styleBrief, styleBriefForPrompt, styleMenuForPrompt } from "@/lib/design/style-briefs";

/**
 * Se l'utente ha già scelto lo stile, il modello lo riceve come vincolo (con il
 * brief completo); se non l'ha scelto, riceve il menù delle direzioni possibili.
 */
function styleChoiceForPrompt(preset: Brief["stylePreset"]): string {
  if (preset) {
    return `Direzione visiva richiesta (non cambiarla):\n${styleBriefForPrompt(preset)}`;
  }
  return `Direzioni visive disponibili (scegline UNA; da qui dipendono struttura, tipografia e ritmo di animazione, non solo i colori):\n${styleMenuForPrompt()}`;
}
import type { Brief, Page, Site } from "@/lib/schema/site";

/**
 * Prompt del compilatore.
 *
 * Regola fissa: il modello NON decide la struttura del markup. Riceve il
 * catalogo dei blocchi disponibili e riscrive solo i contenuti, in italiano,
 * con vincoli di lunghezza. Così l'output resta valido per costruzione.
 */

export const BRIEF_SYSTEM = `Sei il direttore creativo di uno studio che progetta siti per attività italiane.
Lavori su contenuti concreti: niente slogan vuoti, niente "soluzioni innovative", niente superlatìvi.
Ogni frase deve poter essere verificata o smentita da chi legge.
Rispondi sempre in italiano e sempre nel formato richiesto.`;

export function briefPrompt(brief: Brief, site: Site): string {
  return `Brief dell'attività:
"${brief.prompt}"
Nome: ${site.businessName}
Settore riconosciuto: ${site.sector}
Città: ${site.brand.contact.city || "non indicata"}
Tono richiesto: ${brief.tone}

Contenuti attuali (da migliorare, non da copiare):
- titolo: ${site.pages[0]?.seo.title ?? ""}
- promessa: ${site.brand.tagline}
- servizi: ${site.pages[0]?.blocks.find((block) => block.type === "features")?.props
    ? JSON.stringify(site.pages[0].blocks.find((block) => block.type === "features")?.props.items)
    : "nessuno"}

${styleChoiceForPrompt(brief.stylePreset)}

Compito:
1. ${brief.stylePreset ? "Mantieni la direzione visiva indicata sopra" : "Scegli la direzione visiva più adatta fra quelle elencate sopra"} (campo preset: solo l'identificativo, es. "tech").
2. Scegli la coppia di font fra: ${["grotesk-inter", "playfair-source", "fraunces-lato", "dm-serif-dm-sans", "archivo-ibm", "bricolage-manrope", "libre-frank", "jetbrains-work"].join(", ")}.
3. Indica una tinta di base (0-360) coerente con il settore e diversa dal blu standard se il settore lo consente.
4. Scrivi una promessa (tagline) di massimo 90 caratteri, specifica e verificabile.
5. Per ogni pagina scrivi titolo e descrizione SEO (150-158 caratteri) che contengano il nome dell'attività e la città se indicata.`;
}

export const COPY_SYSTEM = `Sei un copywriter italiano che scrive per siti di piccole e medie imprese.
Scrivi frasi brevi e concrete. Usa il "tu" se il tono è informale, il "voi" se è formale.
Vietato: "leader del settore", "eccellenza", "soluzioni a 360 gradi", "passione per il nostro lavoro",
punti esclamativi, emoji, e qualunque promessa non verificabile.
Non inventare numeri, certificazioni o nomi di clienti: se serve un dato, usa quello fornito.`;

export function copyPrompt(site: Site, page: Page): string {
  const sections = page.blocks
    .map((block) => {
      const label = `${block.type}:${block.variant}`;
      const items = (block.props as { items?: { title?: string; question?: string }[] }).items;
      const preview = items && items.length > 0 ? ` → ${items.map((item) => item.title ?? item.question ?? "").join(" | ")}` : "";
      return `- ${label}${preview}`;
    })
    .join("\n");

  return `Attività: ${site.businessName} (${site.sector})${site.brand.contact.city ? `, ${site.brand.contact.city}` : ""}
Promessa attuale: ${site.brand.tagline}
Tono: ${site.brand.tone.personality}

${styleBriefForPrompt(site.theme.preset)}

Pagina da riscrivere: "${page.title}" (${page.path})
Sezioni presenti:
${sections}

Catalogo dei blocchi disponibili (solo per capire cosa esiste):
${catalogForPrompt()}

Compito: riscrivi i contenuti di QUESTA pagina.
- hero: occhiello, titolo (max 60 caratteri) e sottotitolo (max 180 caratteri)
- servizi: 6 voci con titolo (max 40) e testo (max 130)
- processo: 3-5 tappe con titolo e descrizione breve
- faq: 4 domande reali con risposte di 2-3 frasi
- testimonianze: 3 voci credibili, con nome di persona e ruolo, senza nomi di aziende famose
- invito finale (cta): titolo e testo
- SEO: titolo (max 60) e descrizione (150-158 caratteri)`;
}

export const SECTION_SYSTEM = `Sei un progettista di pagine web. Devi solo migliorare il contenuto indicato,
mantenendo lo stesso tipo di blocco e la stessa lingua. Rispondi nel formato richiesto, senza commenti.`;

export function sectionPrompt(site: Site, page: Page, instruction: string, blockSummary: string): string {
  return `Attività: ${site.businessName} (${site.sector}). Tono: ${site.brand.tone.personality}.
Pagina: ${page.title}.
${styleBriefForPrompt(site.theme.preset)}
Blocco selezionato: ${blockSummary}

Richiesta dell'utente: "${instruction}"

Riscrivi i contenuti del blocco rispettando la richiesta. Mantieni le lunghezze indicate.`;
}
