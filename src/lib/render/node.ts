/**
 * Modello di markup unico del progetto.
 *
 * Ogni blocco della libreria produce un albero di `El` — mai JSX, mai stringhe HTML.
 * Da questo unico albero derivano DUE consumatori:
 *   - `renderHtml`  → l'HTML del sito esportato
 *   - `renderReact` → gli elementi React dell'anteprima nell'editor
 *
 * La parità fra anteprima ed export è quindi garantita per costruzione: non esiste
 * un secondo posto in cui il markup possa divergere.
 */

export type AttrValue = string | number | boolean | null | undefined;

export type El = {
  tag: string;
  attrs?: Record<string, AttrValue>;
  children?: Child[];
};

/** Nodo di testo. */
export type Text = string;

/** Frammento di markup già serializzato (SVG del logo, script di anteprima). */
/** Elementi il cui contenuto è testo non interpretato: dentro non si fa escape. */
export const RAW_TEXT_TAGS = new Set(["script", "style"]);

export type RawHtml = { raw: string };

export type Child = El | Text | RawHtml | null | undefined | false;

export const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** Crea un elemento. */
export function el(tag: string, attrs?: Record<string, AttrValue> | null, ...children: Child[]): El {
  return { tag, attrs: attrs ?? undefined, children };
}

/** Markup già serializzato e fidato (già sanitizzato a monte). */
export function raw(html: string): RawHtml {
  return { raw: html };
}

export function isEl(node: Child): node is El {
  return typeof node === "object" && node !== null && !("raw" in node);
}

export function isRaw(node: Child): node is RawHtml {
  return typeof node === "object" && node !== null && "raw" in node;
}

/** Unisce classi condizionali. */
export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Rende piatto un albero di figli, scartando i vuoti. */
export function flatten(children: Child[]): Exclude<Child, null | undefined | false>[] {
  const out: Exclude<Child, null | undefined | false>[] = [];
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      out.push(...flatten(child as Child[]));
      continue;
    }
    out.push(child as Exclude<Child, null | undefined | false>);
  }
  return out;
}

/** Solo testo, senza tag: utile per controlli di lunghezza e hash dei contenuti. */
export function collectText(node: Child): string {
  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string") return node;
  if (isRaw(node)) return "";
  if (!node.children) return "";
  return flatten(node.children).map(collectText).join(" ");
}
