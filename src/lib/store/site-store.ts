"use client";

import { create } from "zustand";
import { findDefinition, variantsOf, createBlock, defaultVariant } from "@/lib/schema/registry";
import type { Block, BlockStyle, Page, Site } from "@/lib/schema/site";
import type { StylePreset } from "@/lib/design/tokens";
import { FONT_PAIRINGS } from "@/lib/design/tokens";

/**
 * Stato dell'editor.
 *
 * Ogni mutazione passa da `commit`, che spinge lo stato precedente nella
 * cronologia: undo e redo funzionano sempre, senza eccezioni per tipo di modifica.
 */

export type StudioState = {
  site: Site | null;
  pagePath: string;
  selectedBlockId: string | null;
  device: "mobile" | "tablet" | "desktop";
  zoom: number;
  history: Site[];
  future: Site[];
  savedAt: string | null;
  dirty: boolean;

  load: (site: Site) => void;
  setPage: (path: string) => void;
  select: (blockId: string | null) => void;
  setDevice: (device: StudioState["device"]) => void;
  setZoom: (zoom: number) => void;
  markSaved: () => void;

  commit: (mutate: (site: Site) => Site) => void;
  updateBlockProps: (blockId: string, patch: Record<string, unknown>) => void;
  updateBlockStyle: (blockId: string, patch: Partial<BlockStyle>) => void;
  setBlockVariant: (blockId: string, variant: string) => void;
  setBlockMotion: (blockId: string, motion: Block["motion"]) => void;
  addBlock: (type: string, variant?: string, afterBlockId?: string | null) => void;
  removeBlock: (blockId: string) => void;
  duplicateBlock: (blockId: string) => void;
  moveBlock: (blockId: string, direction: -1 | 1) => void;

  setPreset: (preset: StylePreset) => void;
  setMode: (mode: "light" | "dark") => void;
  setFontPairing: (id: string) => void;
  setPaletteHue: (hue: number) => void;
  setPaletteOption: (key: "primary" | "accent", patch: { l?: number; c?: number; h?: number }) => void;
  setDomain: (domain: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

const HISTORY_LIMIT = 40;

function updatePage(site: Site, path: string, mutate: (page: Page) => Page): Site {
  return { ...site, pages: site.pages.map((page) => (page.path === path ? mutate(page) : page)) };
}

function updateBlock(page: Page, blockId: string, mutate: (block: Block) => Block): Page {
  return { ...page, blocks: page.blocks.map((block) => (block.id === blockId ? mutate(block) : block)) };
}

export const useStudio = create<StudioState>((set, get) => ({
  site: null,
  pagePath: "/",
  selectedBlockId: null,
  device: "desktop",
  zoom: 1,
  history: [],
  future: [],
  savedAt: null,
  dirty: false,

  load: (site) =>
    set({
      site,
      pagePath: site.pages[0]?.path ?? "/",
      selectedBlockId: null,
      history: [],
      future: [],
      dirty: false,
    }),

  setPage: (path) => set({ pagePath: path, selectedBlockId: null }),
  select: (blockId) => set({ selectedBlockId: blockId }),
  setDevice: (device) => set({ device }),
  setZoom: (zoom) => set({ zoom: Math.min(1.5, Math.max(0.4, zoom)) }),
  markSaved: () => set({ savedAt: new Date().toISOString(), dirty: false }),

  commit: (mutate) => {
    const { site, history } = get();
    if (!site) return;
    const next = mutate(site);
    if (next === site) return;
    set({
      site: { ...next, updatedAt: new Date().toISOString() },
      history: [...history.slice(-HISTORY_LIMIT), site],
      future: [],
      dirty: true,
    });
  },

  updateBlockProps: (blockId, patch) =>
    get().commit((site) =>
      updatePage(site, get().pagePath, (page) =>
        updateBlock(page, blockId, (block) => {
          const definition = findDefinition(block.type, block.variant);
          if (!definition) return block;
          const parsed = definition.schema.safeParse({ ...block.props, ...patch });
          // Una modifica non valida viene ignorata invece di corrompere il blocco.
          return parsed.success ? { ...block, props: parsed.data as Record<string, unknown> } : block;
        }),
      ),
    ),

  updateBlockStyle: (blockId, patch) =>
    get().commit((site) =>
      updatePage(site, get().pagePath, (page) => updateBlock(page, blockId, (block) => ({ ...block, style: { ...block.style, ...patch } }))),
    ),

  setBlockVariant: (blockId, variant) =>
    get().commit((site) =>
      updatePage(site, get().pagePath, (page) =>
        updateBlock(page, blockId, (block) => {
          const definition = findDefinition(block.type, variant);
          if (!definition) return block;
          // Cambiando variante le props vengono riallineate allo schema della nuova.
          const parsed = definition.schema.safeParse(block.props);
          return {
            ...block,
            variant,
            props: parsed.success ? (parsed.data as Record<string, unknown>) : (structuredClone(definition.defaults) as Record<string, unknown>),
          };
        }),
      ),
    ),

  setBlockMotion: (blockId, motion) =>
    get().commit((site) => updatePage(site, get().pagePath, (page) => updateBlock(page, blockId, (block) => ({ ...block, motion })))),

  addBlock: (type, variant, afterBlockId) => {
    const state = get();
    const page = state.site?.pages.find((item) => item.path === state.pagePath);
    if (!page) return;
    const chosen = variant ?? defaultVariant(type);
    if (!chosen) return;
    const block = createBlock(type, chosen, page.blocks.length + 1);
    if (!block) return;

    get().commit((site) =>
      updatePage(site, state.pagePath, (current) => {
        const index = afterBlockId ? current.blocks.findIndex((item) => item.id === afterBlockId) : -1;
        const blocks = [...current.blocks];
        blocks.splice(index >= 0 ? index + 1 : blocks.length, 0, block);
        return { ...current, blocks };
      }),
    );
    set({ selectedBlockId: block.id });
  },

  removeBlock: (blockId) => {
    get().commit((site) => updatePage(site, get().pagePath, (page) => ({ ...page, blocks: page.blocks.filter((block) => block.id !== blockId) })));
    if (get().selectedBlockId === blockId) set({ selectedBlockId: null });
  },

  duplicateBlock: (blockId) => {
    const page = get().site?.pages.find((item) => item.path === get().pagePath);
    const source = page?.blocks.find((block) => block.id === blockId);
    if (!source) return;
    const copy: Block = {
      ...structuredClone(source),
      id: `${source.type}-${Math.random().toString(36).slice(2, 7)}`,
    };
    get().commit((site) =>
      updatePage(site, get().pagePath, (current) => {
        const index = current.blocks.findIndex((block) => block.id === blockId);
        const blocks = [...current.blocks];
        blocks.splice(index + 1, 0, copy);
        return { ...current, blocks };
      }),
    );
    set({ selectedBlockId: copy.id });
  },

  moveBlock: (blockId, direction) => {
    get().commit((site) =>
      updatePage(site, get().pagePath, (page) => {
        const index = page.blocks.findIndex((block) => block.id === blockId);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= page.blocks.length) return page;
        const blocks = [...page.blocks];
        const [moved] = blocks.splice(index, 1);
        blocks.splice(target, 0, moved);
        return { ...page, blocks };
      }),
    );
  },

  setPreset: (preset) => get().commit((site) => ({ ...site, theme: { ...site.theme, preset } })),
  setMode: (mode) => get().commit((site) => ({ ...site, theme: { ...site.theme, mode } })),
  setFontPairing: (id) =>
    get().commit((site) => {
      const pairing = FONT_PAIRINGS.find((item) => item.id === id);
      return pairing ? { ...site, theme: { ...site.theme, fontPairing: pairing.id } } : site;
    }),
  setPaletteHue: (hue) =>
    get().commit((site) => ({
      ...site,
      theme: {
        ...site.theme,
        palette: { ...site.theme.palette, primary: { ...site.theme.palette.primary, h: Math.round(hue) } },
      },
    })),
  setPaletteOption: (key, patch) =>
    get().commit((site) => ({
      ...site,
      theme: { ...site.theme, palette: { ...site.theme.palette, [key]: { ...site.theme.palette[key], ...patch } } },
    })),
  setDomain: (domain) =>
    get().commit((site) => ({ ...site, meta: { ...site.meta, domain: domain.trim() } })),

  undo: () => {
    const { history, site, future } = get();
    if (history.length === 0 || !site) return;
    const previous = history[history.length - 1];
    set({ site: previous, history: history.slice(0, -1), future: [site, ...future].slice(0, HISTORY_LIMIT), dirty: true });
  },

  redo: () => {
    const { future, site, history } = get();
    if (future.length === 0 || !site) return;
    const next = future[0];
    set({ site: next, future: future.slice(1), history: [...history, site], dirty: true });
  },

  canUndo: () => get().history.length > 0,
  canRedo: () => get().future.length > 0,
}));

/** Blocchi disponibili per il tipo selezionato, usati dall'inspector. */
export function variantOptions(type: string): { variant: string; label: string }[] {
  return variantsOf(type).map((definition) => ({ variant: definition.variant, label: definition.label }));
}
