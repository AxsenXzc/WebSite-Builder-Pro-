import { blockId, type Block, type BlockStyle } from "@/lib/schema/site";
import { findDefinition } from "@/lib/schema/registry";

let counter = 0;

export function resetBlockCounter(): void {
  counter = 0;
}

/**
 * Costruisce un blocco applicando lo schema del suo registry.
 *
 * Le default del blocco vengono fuse con le props fornite e poi RI-PAR SATE:
 * è impossibile che il composer produca un blocco con props invalide.
 */
export function mk(
  type: string,
  variant: string,
  props: Record<string, unknown> = {},
  style: Partial<BlockStyle> = {},
  motion: Block["motion"] = "none",
): Block {
  const definition = findDefinition(type, variant);
  if (!definition) throw new Error(`Blocco sconosciuto: ${type}:${variant}`);

  const merged = definition.schema.parse({
    ...(structuredClone(definition.defaults) as Record<string, unknown>),
    ...props,
  }) as Record<string, unknown>;

  counter += 1;
  return {
    id: blockId(type, counter),
    type,
    variant,
    props: merged,
    style: {
      width: "default",
      background: "none",
      align: "left",
      space: "normal",
      hideOnMobile: false,
      ...style,
    },
    motion,
  };
}

export function link(label: string, href: string, emphasis: "primary" | "secondary" | "ghost" | "link" = "link") {
  return { label, href, emphasis, external: false };
}

export function art(seed: number, hue: number, style: "mesh" | "stripes" | "dots" | "waves" | "grid", intensity = 0.6) {
  return { seed, hue, style, intensity };
}
