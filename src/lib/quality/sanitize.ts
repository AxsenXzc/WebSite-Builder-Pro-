/**
 * Sanitizzazione del markup generato (SVG di logo, HTML custom).
 *
 * Regola: nessuno script, nessun gestore di eventi, nessun riferimento a
 * `javascript:` entra in un sito esportato. Il markup non fidato è ammesso solo
 * come SVG e solo dopo essere passato di qui.
 */

const FORBIDDEN_TAGS = [
  "script",
  "foreignobject",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "audio",
  "video",
  "animate",
  "set",
  "handler",
];

const FORBIDDEN_ATTR_PATTERN = /^(on[a-z-]+|xlink:href|href|src|action|formaction|style)$/i;

/** Estrae il primo elemento `<svg>…</svg>` presente nel testo. */
export function extractSvg(markup: string): string | null {
  const match = /<svg[\s\S]*?<\/svg>/i.exec(markup);
  return match ? match[0] : null;
}

export type SanitizeResult = {
  ok: boolean;
  svg: string;
  removed: string[];
};

/**
 * Rende un SVG sicuro da incorporare. Non tenta di essere un parser completo:
 * rimuove le costruzioni pericolose note e le dichiara nel report, così un
 * fallimento è visibile invece che silenzioso.
 */
export function sanitizeSvg(input: string): SanitizeResult {
  const removed: string[] = [];
  const extracted = extractSvg(input);
  if (!extracted) return { ok: false, svg: "", removed: ["nessun elemento <svg> trovato"] };

  let output = extracted;
  for (const tag of FORBIDDEN_TAGS) {
    // Prima l'elemento intero (apertura + contenuto + chiusura): rimuovere solo
    // il tag di apertura lascerebbe in giro `</script>` e il contenuto.
    const element = new RegExp(`<\\s*${tag}\\b[\\s\\S]*?<\\/\\s*${tag}\\s*>`, "gi");
    const openTag = new RegExp(`<\\s*${tag}\\b[^>]*\\/?>`, "gi");
    const closing = new RegExp(`<\\/\\s*${tag}\\s*>`, "gi");
    const wholeElement = element.test(output);
    const leftover = wholeElement === false && (openTag.test(output) || closing.test(output));
    if (wholeElement || leftover) {
      removed.push(`${wholeElement ? "elemento" : "tag"} <${tag}>`);
      output = output.replace(element, "").replace(openTag, "").replace(closing, "");
    }
  }

  // Attributi: eventi, riferimenti esterni, style inline.
  output = output.replace(/([a-zA-Z-:]+)\s*=\s*("([^"]*)"|'([^']*)')/g, (full, name: string, _quoted, doubleValue, singleValue) => {
    const value = typeof doubleValue === "string" ? doubleValue : typeof singleValue === "string" ? singleValue : "";
    if (FORBIDDEN_ATTR_PATTERN.test(name)) {
      removed.push(`attributo ${name}`);
      return "";
    }
    if (/^\s*(javascript|data:text\/html|vbscript):/i.test(value)) {
      removed.push(`valore pericoloso in ${name}`);
      return "";
    }
    return full;
  });

  output = output.replace(/\{\{|\}\}/g, "");
  const ok = removed.length === 0;
  return { ok, svg: output.trim(), removed };
}

/** Verifica rapida: serve a far fallire un export che contiene script non voluti. */
export function containsExecutableMarkup(html: string): { safe: boolean; reasons: string[] } {
  const reasons: string[] = [];
  // Sono ammessi esattamente due script: il nostro site.js e i dati strutturati
  // JSON-LD (che non eseguono codice). Tutto il resto è un errore bloccante.
  const scrubbed = html
    .replace(/<script[^>]*\bsrc=["'][^"']*site\.js["'][^>]*><\/script>/gi, "")
    .replace(/<script[^>]*\btype=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");
  if (/<script\b/i.test(scrubbed)) {
    reasons.push("script inline non previsto");
  }
  if (/\son[a-z]+\s*=\s*["']/i.test(html)) reasons.push("gestore di evento inline");
  if (/javascript:/i.test(html)) reasons.push("URL javascript:");
  if (/<iframe\b/i.test(html)) reasons.push("iframe incorporato");
  return { safe: reasons.length === 0, reasons };
}
