import { RAW_TEXT_TAGS, VOID_TAGS, flatten, isRaw, type El } from "./node";
import type { Child } from "./node";

/** Escape per il contenuto testuale. */
export function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape per i valori degli attributi. */
export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function serializeAttrs(attrs: Record<string, string | number | boolean | null | undefined> | undefined): string {
  if (!attrs) return "";
  const entries = Object.entries(attrs).filter(([, value]) => value !== null && value !== undefined && value !== false);
  if (entries.length === 0) return "";
  return entries
    .map(([name, value]) => (value === true ? ` ${name}=""` : ` ${name}="${escapeAttr(String(value))}"`))
    .join("");
}

export type HtmlOptions = {
  /** Indenta l'output per leggibilità (l'HTML resta identico, cambia solo la formattazione). */
  pretty?: boolean;
  /** Livello di indentazione iniziale. */
  depth?: number;
};

/**
 * Serializza un albero in HTML. Deterministico: stesso albero, stessa stringa,
 * stesso ordine di attributi (quello di definizione).
 */
export function renderHtml(node: Child, options: HtmlOptions = {}): string {
  const { pretty = false, depth = 0 } = options;
  const pad = pretty ? "  ".repeat(depth) : "";
  const nl = pretty ? "\n" : "";

  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string") return `${pad}${escapeText(node)}`;
  if (isRaw(node)) return `${pad}${node.raw}`;

  const element = node as El;
  const attrs = serializeAttrs(element.attrs);
  const children = flatten(element.children ?? []);
  // Dentro <script> e <style> il testo è codice, non prosa: si scrive così com'è.
  // Escapere lì dentro produrrebbe `&amp;&amp;` e il browser non eseguirebbe nulla.
  const rawText = RAW_TEXT_TAGS.has(element.tag);

  if (VOID_TAGS.has(element.tag)) return `${pad}<${element.tag}${attrs}>`;
  if (children.length === 0) return `${pad}<${element.tag}${attrs}></${element.tag}>`;

  const onlyText = children.every((child) => typeof child === "string");
  if (onlyText) {
    const inline = rawText
      ? children.join("")
      : children.map((child) => renderHtml(child, { pretty: false })).join("");
    return `${pad}<${element.tag}${attrs}>${inline}</${element.tag}>`;
  }

  if (rawText) {
    const inline = children
      .map((child) => (typeof child === "string" ? child : renderHtml(child, { pretty: false })))
      .join("");
    return `${pad}<${element.tag}${attrs}>${inline}</${element.tag}>`;
  }

  const inner = children
    .map((child) => renderHtml(child, { pretty, depth: depth + 1 }))
    .filter((chunk) => chunk.length > 0)
    .join(nl);

  return `${pad}<${element.tag}${attrs}>${nl}${inner}${nl}${pad}</${element.tag}>`;
}

/** Concatena più alberi in un unico documento HTML completo. */
export function renderDocument(head: Child[], body: Child[], options: HtmlOptions = {}): string {
  const pretty = options.pretty ?? true;
  const headHtml = head.map((node) => renderHtml(node, { pretty, depth: 1 })).join("\n");
  const bodyHtml = body.map((node) => renderHtml(node, { pretty, depth: 1 })).join("\n");
  return `<!doctype html>\n<html lang="it">\n<head>\n${headHtml}\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>\n`;
}
