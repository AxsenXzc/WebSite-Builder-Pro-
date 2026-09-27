/**
 * Colore in OKLCH: conversioni, armonie, contrasto WCAG corretto aritmeticamente.
 *
 * Il punto non è "scegliere colori carini": è garantire che ogni coppia
 * testo/sfondo rispetti WCAG AA prima ancora che il sito venga generato.
 */

export type Oklch = { l: number; c: number; h: number };
export type Rgb = { r: number; g: number; b: number };

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/** PRNG deterministico: stesso seed, stessa palette. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash FNV-1a: trasforma un brief in un seed stabile. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function fromLinear(channel: number): number {
  const value = clamp(channel);
  return value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

/** OKLCH → sRGB (0..1, già gamma-encoded). */
export function oklchToRgb(color: Oklch): Rgb {
  const hRad = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hRad);
  const b = color.c * Math.sin(hRad);

  const l = color.l + 0.3963377774 * a + 0.2158037573 * b;
  const m = color.l - 0.1055613458 * a - 0.0638541728 * b;
  const s = color.l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;

  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const blue = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return { r: fromLinear(r), g: fromLinear(g), b: fromLinear(blue) };
}

/** Luminanza relativa secondo WCAG, calcolata sui canali lineari. */
export function relativeLuminance(color: Oklch): number {
  const rgb = oklchToRgb(color);
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

/** Rapporto di contrasto WCAG fra due colori (1..21). */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Porta il colore di primo piano fino al contrasto richiesto agendo SOLO sulla
 * luminosità: la tinta resta quella del brand, cambia quanto è chiara.
 */
export function ensureContrast(fg: Oklch, bg: Oklch, target = 4.5): Oklch {
  if (contrastRatio(fg, bg) >= target) return fg;

  // La direzione non si può indovinare dal solo sfondo: su una tinta media
  // (un rosa a L 0.69) il testo chiaro resta sotto soglia e quello scuro invece
  // funziona. Si esplorano ENTRAMBE le direzioni e si sceglie il candidato meno
  // diverso dal colore di partenza: la tinta resta riconoscibile.
  const candidates: Oklch[] = [];
  for (let step = 1; step <= 24; step += 1) {
    const delta = (step / 24) * 0.9;
    candidates.push({ ...fg, l: clamp(fg.l - delta) });
    candidates.push({ ...fg, l: clamp(fg.l + delta) });
  }
  candidates.push({ l: 0, c: 0, h: fg.h }, { l: 1, c: 0, h: fg.h });

  const nearestReaching = (threshold: number): Oklch | null => {
    let best: Oklch | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      if (contrastRatio(candidate, bg) < threshold) continue;
      const distance = Math.abs(candidate.l - fg.l) + candidate.c / 1000;
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  };

  // Un piccolo margine evita che l'arrotondamento dei token riporti la coppia
  // sotto la soglia dichiarata.
  const near = nearestReaching(target * 1.02) ?? nearestReaching(target);
  if (near) return near;

  // Nessuna luminosità basta: si rinuncia alla tinta e si usa bianco o nero.
  const black: Oklch = { l: 0, c: 0, h: fg.h };
  const white: Oklch = { l: 1, c: 0, h: fg.h };
  return contrastRatio(black, bg) >= contrastRatio(white, bg) ? black : white;
}

export function oklchCss(color: Oklch, alpha?: number): string {
  const l = Number(color.l.toFixed(4));
  const c = Number(color.c.toFixed(4));
  const h = Number(color.h.toFixed(2));
  if (alpha !== undefined) return `oklch(${l} ${c} ${h} / ${alpha})`;
  return `oklch(${l} ${c} ${h})`;
}

export function adjust(color: Oklch, patch: Partial<Oklch>): Oklch {
  return { ...color, ...patch };
}

/** Palette armonica a partire da una tinta, con contrasti già verificati. */
export type Palette = {
  primary: Oklch;
  accent: Oklch;
  neutral: Oklch;
  harmony: "analogous" | "complementary" | "triadic" | "split";
};

const HARMONIES: Record<Palette["harmony"], (h: number) => number> = {
  analogous: (h) => (h + 30) % 360,
  complementary: (h) => (h + 180) % 360,
  triadic: (h) => (h + 120) % 360,
  split: (h) => (h + 150) % 360,
};

/** Tinta armonica coerente con il tipo di armonia scelto. */
export function harmonyHue(hue: number, harmony: Palette["harmony"]): number {
  return HARMONIES[harmony](hue);
}

export function buildPalette(opts: {
  seed: number;
  harmony?: Palette["harmony"];
  primaryL?: number;
  primaryC?: number;
}): Palette {
  const random = mulberry32(opts.seed);
  const hue = Math.round(random() * 360);
  const harmony = opts.harmony ?? (["analogous", "complementary", "triadic", "split"] as const)[
    Math.floor(random() * 4)
  ]!;
  const accentHue = HARMONIES[harmony](hue);

  return {
    primary: { l: opts.primaryL ?? 0.5 + random() * 0.12, c: opts.primaryC ?? 0.12 + random() * 0.09, h: hue },
    accent: { l: 0.66 + random() * 0.1, c: 0.1 + random() * 0.08, h: accentHue },
    neutral: { l: 0.62, c: 0.012, h: hue },
    harmony,
  };
}

/** Firma leggibile di una palette, usata per i controlli di unicità. */
export function paletteSignature(palette: Palette): string {
  const round = (value: number, digits: number) => Number(value.toFixed(digits));
  return [
    round(palette.primary.l, 2),
    round(palette.primary.c, 2),
    Math.round(palette.primary.h / 15) * 15,
    palette.harmony,
  ].join(":");
}
