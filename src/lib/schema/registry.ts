import { z } from "zod";
import { el, type El } from "@/lib/render/node";
import { blockId, type Block } from "@/lib/schema/site";
import { CATEGORY_LABELS, type BlockCategory, type BlockDefinition } from "./blocks/types";
import { footerColumns, footerMinimal, navbarCentered, navbarClassic, navbarMinimal } from "./blocks/structure";
import { heroCentered, heroEditorial, heroSplit } from "./blocks/hero";
import {
  featuresAlternating,
  featuresBento,
  featuresGrid,
  galleryGrid,
  logosStrip,
  richTextProse,
  statsCards,
  stepsTimeline,
  teamGrid,
} from "./blocks/content";
import { faqAccordion, faqTwoColumn, testimonialsCards, testimonialsFeature } from "./blocks/trust";
import { contactSplit, ctaBanner, ctaSplit, pricingList, pricingTiers } from "./blocks/conversion";
import { cookieNotice, legalDocument, postsList } from "./blocks/utility";

/** Tutta la libreria, in un unico posto. Aggiungere un blocco lo espone ovunque. */
export const BLOCKS: BlockDefinition[] = [
  navbarClassic,
  navbarCentered,
  navbarMinimal,
  footerColumns,
  footerMinimal,
  heroSplit,
  heroCentered,
  heroEditorial,
  featuresGrid,
  featuresBento,
  featuresAlternating,
  stepsTimeline,
  galleryGrid,
  teamGrid,
  statsCards,
  logosStrip,
  richTextProse,
  testimonialsCards,
  testimonialsFeature,
  faqAccordion,
  faqTwoColumn,
  pricingTiers,
  pricingList,
  ctaBanner,
  ctaSplit,
  contactSplit,
  postsList,
  cookieNotice,
  legalDocument,
];

const INDEX = new Map<string, BlockDefinition>();
for (const definition of BLOCKS) {
  INDEX.set(`${definition.type}:${definition.variant}`, definition);
}

export function findDefinition(type: string, variant: string): BlockDefinition | undefined {
  return INDEX.get(`${type}:${variant}`);
}

export function defaultVariant(type: string): string | undefined {
  return BLOCKS.find((definition) => definition.type === type)?.variant;
}

export function variantsOf(type: string): BlockDefinition[] {
  return BLOCKS.filter((definition) => definition.type === type);
}

export function blockTypes(): string[] {
  return [...new Set(BLOCKS.map((definition) => definition.type))];
}

export type CatalogEntry = {
  key: string;
  type: string;
  variant: string;
  label: string;
  description: string;
  tags: string[];
  category: BlockCategory;
};

export type CatalogGroup = {
  category: BlockCategory;
  label: string;
  entries: CatalogEntry[];
};

const CATEGORY_ORDER: BlockCategory[] = ["structure", "hero", "content", "trust", "conversion", "utility"];

/** Catalogo raggruppato, usato dalla palette dell'editor e dai prompt. */
export function blockCatalog(): CatalogGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    entries: BLOCKS.filter((definition) => definition.category === category).map((definition) => ({
      key: `${definition.type}:${definition.variant}`,
      type: definition.type,
      variant: definition.variant,
      label: definition.label,
      description: definition.description,
      tags: definition.tags,
      category: definition.category,
    })),
  })).filter((group) => group.entries.length > 0);
}

/** Crea un blocco già completo di props valide. Mai un blocco mezzo vuoto. */
export function createBlock(type: string, variant: string, index = 0): Block | null {
  const definition = findDefinition(type, variant);
  if (!definition) return null;
  return {
    id: blockId(type, index),
    type,
    variant,
    props: structuredClone(definition.defaults) as Record<string, unknown>,
    style: {
      width: "default",
      background: "none",
      align: "left",
      space: "normal",
      hideOnMobile: false,
    },
    motion: "none",
  };
}

export type ValidationResult = { ok: boolean; errors: string[]; block: Block };

/**
 * Valida le props di un blocco contro il suo schema.
 * Se non sono valide, il blocco viene riparato con i default: l'editor non deve
 * mai trovarsi in uno stato in cui una sezione non si può disegnare.
 */
export function validateBlock(block: Block): ValidationResult {
  const definition = findDefinition(block.type, block.variant);
  if (!definition) return { ok: false, errors: [`Blocco sconosciuto: ${block.type}:${block.variant}`], block };
  const parsed = definition.schema.safeParse(block.props);
  if (parsed.success) return { ok: true, errors: [], block };
  const errors = parsed.error.issues.map((issue) => `${issue.path.join(".") || "props"}: ${issue.message}`);
  return {
    ok: false,
    errors,
    block: { ...block, props: structuredClone(definition.defaults) as Record<string, unknown> },
  };
}

/**
 * Costruisce l'albero del blocco. È l'unico punto di ingresso usato sia dalla
 * preview React sia dall'export HTML: qualunque cosa succeda, restituisce un `El`.
 */
export function buildBlock(block: Block, ctx: Parameters<BlockDefinition["build"]>[1]): El {
  const definition = findDefinition(block.type, block.variant);
  if (!definition) {
    return el("section", { class: "atl-section", "data-block": block.id }, el("p", { class: "atl-text" }, `Blocco non disponibile: ${block.type}`));
  }
  const parsed = definition.schema.safeParse(block.props);
  const props = (parsed.success ? parsed.data : structuredClone(definition.defaults)) as never;
  try {
    return definition.build(props, ctx, block);
  } catch (error) {
    return el(
      "section",
      { class: "atl-section", "data-block": block.id },
      el("p", { class: "atl-text" }, `Errore nel blocco ${block.type}: ${error instanceof Error ? error.message : "sconosciuto"}`),
    );
  }
}

/** Descrive la libreria per i prompt del modello: una riga per blocco. */
export function catalogForPrompt(): string {
  return BLOCKS.map((definition) => `${definition.type}:${definition.variant} — ${definition.description}`).join("\n");
}

/** Schema JSON per un blocco, utile a costruire il contratto di output dell'AI. */
export function blockJsonSchema(type: string, variant: string): Record<string, unknown> | null {
  const definition = findIndexDefinition(type, variant);
  if (!definition) return null;
  return z.toJSONSchema(definition.schema, { io: "input" }) as Record<string, unknown>;
}

function findIndexDefinition(type: string, variant: string): BlockDefinition | undefined {
  return INDEX.get(`${type}:${variant}`);
}
