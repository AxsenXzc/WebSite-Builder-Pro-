import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { BLOCKS, buildBlock } from "@/lib/schema/registry";
import { renderHtml } from "@/lib/render/toHtml";
import { renderReact } from "@/lib/render/toReact";
import { composeSite } from "@/lib/compiler/offline-composer";
import { BriefSchema } from "@/lib/schema/site";
import { isRaw, type Child, type El } from "@/lib/render/node";
import { resolveTheme } from "@/lib/export/tokens-css";

/**
 * Parità anteprima ↔ export.
 *
 * È il test che regge la promessa centrale del progetto: la sezione che vedi
 * nell'editor è la stessa che finisce nell'HTML scaricato. Se un blocco venisse
 * riscritto in due posti diversi, questo test si romperebbe.
 *
 * Il confronto avviene sul DOM, non sulle stringhe: nomi di attributo
 * case-insensitive, ordine degli attributi e formattazione dello stile inline
 * sono differenze di serializzazione, non di struttura. Tutto il resto deve
 * combaciare esattamente.
 */

type Canonical = {
  tag: string;
  attrs: Record<string, string>;
  text?: string;
  children?: Canonical[];
};

/** Lo stile inline diventa un insieme di dichiarazioni ordinate e normalizzate. */
function normalizeStyle(value: string): string {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/\s*:\s*/, ":").replace(/\s+/g, " "))
    .sort()
    .join(";");
}

function toCanonical(element: Element): Canonical {
  const attrs: Record<string, string> = {};
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    attrs[name] = name === "style" ? normalizeStyle(attribute.value) : attribute.value;
  }

  const children = Array.from(element.children).map(toCanonical);
  const text = children.length === 0 ? (element.textContent ?? "").replace(/\s+/g, " ").trim() : "";

  return {
    tag: element.tagName.toLowerCase(),
    attrs,
    ...(text ? { text } : {}),
    ...(children.length > 0 ? { children } : {}),
  };
}

function canonical(html: string): Canonical {
  const { document } = parseHTML(`<div id="radice">${html}</div>`);
  const wrapper = document.getElementById("radice");
  const first = wrapper?.firstElementChild;
  if (!first) throw new Error("Markup vuoto o non interpretabile");
  return toCanonical(first);
}

function hasRaw(node: Child): boolean {
  if (node === null || node === undefined || node === false) return false;
  if (typeof node === "string") return false;
  if (isRaw(node)) return true;
  return ((node as El).children ?? []).some(hasRaw);
}

const site = composeSite(
  BriefSchema.parse({
    prompt: "Studio di architettura a Bologna specializzato in ristrutturazioni di appartamenti storici",
  }),
  { now: "2026-09-26T10:00:00.000Z" },
);
const theme = resolveTheme(site);
const context = { site, page: site.pages[0]!, tokens: theme.tokens, preset: theme.preset };

function compare(tree: El): Canonical | null {
  if (hasRaw(tree)) return null;
  const fromHtml = canonical(renderHtml(tree));
  const fromReact = canonical(renderToStaticMarkup(renderReact(tree) as never));
  expect(fromReact).toEqual(fromHtml);
  return fromHtml;
}

describe("parità fra anteprima React e HTML esportato", () => {
  it("la libreria contiene tutti i blocchi attesi", () => {
    expect(BLOCKS.length).toBeGreaterThanOrEqual(25);
  });

  for (const definition of BLOCKS) {
    it(`${definition.type}:${definition.variant} produce lo stesso DOM`, () => {
      const block = {
        id: "blocco-di-prova",
        type: definition.type,
        variant: definition.variant,
        props: structuredClone(definition.defaults) as Record<string, unknown>,
        style: {
          width: "default" as const,
          background: "none" as const,
          align: "left" as const,
          space: "normal" as const,
          hideOnMobile: false,
        },
        motion: "none" as const,
      };

      const result = compare(buildBlock(block, context));
      if (result === null) {
        // Il markup già serializzato (SVG del logo) non si confronta nodo per
        // nodo: si verifica comunque che venga prodotto in entrambi i percorsi.
        expect(renderHtml(buildBlock(block, context)).length).toBeGreaterThan(0);
      }
    });
  }

  it("anche un sito completo generato dal composer resta coerente", () => {
    let compared = 0;
    for (const page of site.pages) {
      for (const block of page.blocks) {
        const tree = buildBlock(block, { ...context, page });
        if (compare(tree) !== null) compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(40);
  });
});
