import type { z } from "zod";
import type { El } from "@/lib/render/node";
import type { Block } from "@/lib/schema/site";
import type { BlockContext } from "./parts";

export type BlockCategory = "structure" | "hero" | "content" | "trust" | "conversion" | "utility";

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  structure: "Struttura",
  hero: "Apertura",
  content: "Contenuto",
  trust: "Fiducia",
  conversion: "Conversione",
  utility: "Utility",
};

export type BlockDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  type: string;
  variant: string;
  label: string;
  category: BlockCategory;
  /** A cosa serve, usato anche come suggerimento per il modello AI. */
  description: string;
  schema: S;
  /** Props valide di partenza: nessun blocco viene inserito incompleto. */
  defaults: z.output<S>;
  tags: string[];
  /** Settori in cui il blueprint lo propone per primo. */
  sectors?: string[];
  build: (props: z.output<S>, ctx: BlockContext, block: Block) => El;
};

export function defineBlock<S extends z.ZodTypeAny>(definition: BlockDefinition<S>): BlockDefinition<S> {
  return definition;
}
