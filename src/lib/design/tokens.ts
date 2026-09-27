import {
  adjust,
  contrastRatio,
  ensureContrast,
  oklchCss,
  type Oklch,
  type Palette,
} from "./oklch";

/**
 * Token di un tema. Sono l'unico canale con cui lo stile entra nel sito:
 * i blocchi usano classi semantiche, il CSS esportato legge queste variabili.
 * Cambiare stile = cambiare variabili, mai riscrivere contenuti.
 */

export type ThemeMode = "light" | "dark";

export type ThemeTokens = {
  bg: string;
  bgElevated: string;
  bgMuted: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  primaryHover: string;
  accent: string;
  accentText: string;
  ring: string;
  shadowColor: string;
  overlay: string;
};

export type StylePreset =
  | "editorial"
  | "luxury"
  | "brutalist"
  | "glass"
  | "minimal"
  | "tech"
  | "organic"
  | "retro";

export type PresetVars = {
  radius: string;
  radiusLarge: string;
  shadow: string;
  borderWidth: string;
  headingWeight: string;
  headingTracking: string;
  headingTransform: "none" | "uppercase";
  bodyWeight: string;
  sectionPadding: string;
  density: string;
  labelTransform: "none" | "uppercase";
  labelTracking: string;
  motion: string;
  cardBackground: string;
  dividerStyle: string;
};

/** Otto direzioni visive. Il restyle tocca SOLO questi valori. */
export const STYLE_PRESETS: Record<StylePreset, PresetVars> = {
  editorial: {
    radius: "2px",
    radiusLarge: "4px",
    shadow: "0 1px 0 0 var(--border)",
    borderWidth: "1px",
    headingWeight: "700",
    headingTracking: "-0.03em",
    headingTransform: "none",
    bodyWeight: "400",
    sectionPadding: "6.5rem",
    density: "1",
    labelTransform: "uppercase",
    labelTracking: "0.16em",
    motion: "220ms cubic-bezier(0.22, 1, 0.36, 1)",
    cardBackground: "var(--bg-elevated)",
    dividerStyle: "1px solid var(--border)",
  },
  luxury: {
    radius: "0px",
    radiusLarge: "0px",
    shadow: "none",
    borderWidth: "1px",
    headingWeight: "300",
    headingTracking: "0.02em",
    headingTransform: "none",
    bodyWeight: "300",
    sectionPadding: "8rem",
    density: "1.15",
    labelTransform: "uppercase",
    labelTracking: "0.3em",
    motion: "600ms cubic-bezier(0.16, 1, 0.3, 1)",
    cardBackground: "transparent",
    dividerStyle: "1px solid var(--border)",
  },
  brutalist: {
    radius: "0px",
    radiusLarge: "0px",
    shadow: "6px 6px 0 0 var(--text)",
    borderWidth: "2px",
    headingWeight: "800",
    headingTracking: "-0.02em",
    headingTransform: "uppercase",
    bodyWeight: "500",
    sectionPadding: "4.5rem",
    density: "0.95",
    labelTransform: "uppercase",
    labelTracking: "0.08em",
    motion: "120ms linear",
    cardBackground: "var(--bg)",
    dividerStyle: "2px solid var(--text)",
  },
  glass: {
    radius: "18px",
    radiusLarge: "26px",
    shadow: "0 18px 50px -20px var(--shadow-color)",
    borderWidth: "1px",
    headingWeight: "600",
    headingTracking: "-0.02em",
    headingTransform: "none",
    bodyWeight: "400",
    sectionPadding: "6rem",
    density: "1.05",
    labelTransform: "uppercase",
    labelTracking: "0.12em",
    motion: "340ms cubic-bezier(0.22, 1, 0.36, 1)",
    cardBackground: "color-mix(in oklab, var(--bg-elevated) 78%, transparent)",
    dividerStyle: "1px solid var(--border)",
  },
  minimal: {
    radius: "8px",
    radiusLarge: "12px",
    shadow: "none",
    borderWidth: "1px",
    headingWeight: "600",
    headingTracking: "-0.025em",
    headingTransform: "none",
    bodyWeight: "400",
    sectionPadding: "5.5rem",
    density: "1",
    labelTransform: "none",
    labelTracking: "0.02em",
    motion: "180ms ease-out",
    cardBackground: "var(--bg-elevated)",
    dividerStyle: "1px solid var(--border)",
  },
  tech: {
    radius: "10px",
    radiusLarge: "16px",
    shadow: "0 0 0 1px var(--border), 0 20px 40px -28px var(--shadow-color)",
    borderWidth: "1px",
    headingWeight: "650",
    headingTracking: "-0.035em",
    headingTransform: "none",
    bodyWeight: "400",
    sectionPadding: "6rem",
    density: "1",
    labelTransform: "uppercase",
    labelTracking: "0.14em",
    motion: "260ms cubic-bezier(0.2, 0.7, 0.2, 1)",
    cardBackground: "var(--bg-elevated)",
    dividerStyle: "1px solid var(--border)",
  },
  organic: {
    radius: "28px",
    radiusLarge: "40px",
    shadow: "0 22px 60px -30px var(--shadow-color)",
    borderWidth: "1px",
    headingWeight: "500",
    headingTracking: "-0.01em",
    headingTransform: "none",
    bodyWeight: "400",
    sectionPadding: "7rem",
    density: "1.1",
    labelTransform: "none",
    labelTracking: "0.02em",
    motion: "420ms cubic-bezier(0.34, 1.2, 0.4, 1)",
    cardBackground: "var(--bg-elevated)",
    dividerStyle: "1px solid var(--border)",
  },
  retro: {
    radius: "0px",
    radiusLarge: "2px",
    shadow: "0 0 0 1px var(--border)",
    borderWidth: "1px",
    headingWeight: "700",
    headingTracking: "0.01em",
    headingTransform: "uppercase",
    bodyWeight: "400",
    sectionPadding: "5rem",
    density: "1",
    labelTransform: "uppercase",
    labelTracking: "0.22em",
    motion: "90ms steps(2, end)",
    cardBackground: "var(--bg-elevated)",
    dividerStyle: "1px dashed var(--border)",
  },
};

export const PRESET_LABELS: Record<StylePreset, string> = {
  editorial: "Editorial",
  luxury: "Luxury",
  brutalist: "Brutalist",
  glass: "Glass",
  minimal: "Minimal",
  tech: "Tech",
  organic: "Organic",
  retro: "Retro terminal",
};

/** Nomi dei font per ogni accoppiamento (tutti disponibili gratuitamente). */
export type FontPairing = {
  id: string;
  label: string;
  heading: string;
  body: string;
  mono?: string;
  googleFamily: string;
};

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: "grotesk-inter",
    label: "Grotesk + Inter",
    heading: "'Space Grotesk', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    googleFamily: "family=Space+Grotesk:wght@400;500;700&family=Inter:wght@300;400;500;600",
  },
  {
    id: "playfair-source",
    label: "Playfair + Source Sans",
    heading: "'Playfair Display', Georgia, serif",
    body: "'Source Sans 3', system-ui, sans-serif",
    googleFamily: "family=Playfair+Display:wght@400;500;700&family=Source+Sans+3:wght@300;400;600",
  },
  {
    id: "fraunces-lato",
    label: "Fraunces + Lato",
    heading: "'Fraunces', Georgia, serif",
    body: "'Lato', system-ui, sans-serif",
    googleFamily: "family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Lato:wght@300;400;700",
  },
  {
    id: "dm-serif-dm-sans",
    label: "DM Serif + DM Sans",
    heading: "'DM Serif Display', Georgia, serif",
    body: "'DM Sans', system-ui, sans-serif",
    googleFamily: "family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;700",
  },
  {
    id: "archivo-ibm",
    label: "Archivo + IBM Plex",
    heading: "'Archivo', system-ui, sans-serif",
    body: "'IBM Plex Sans', system-ui, sans-serif",
    googleFamily: "family=Archivo:wght@400;600;800&family=IBM+Plex+Sans:wght@300;400;600",
  },
  {
    id: "bricolage-manrope",
    label: "Bricolage + Manrope",
    heading: "'Bricolage Grotesque', system-ui, sans-serif",
    body: "'Manrope', system-ui, sans-serif",
    googleFamily: "family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700&family=Manrope:wght@300;400;600",
  },
  {
    id: "libre-frank",
    label: "Libre Caslon + Frank Ruhl",
    heading: "'Libre Caslon Display', Georgia, serif",
    body: "'Frank Ruhl Libre', Georgia, serif",
    googleFamily: "family=Libre+Caslon+Display&family=Frank+Ruhl+Libre:wght@300;400;700",
  },
  {
    id: "jetbrains-work",
    label: "JetBrains Mono + Work Sans",
    heading: "'JetBrains Mono', ui-monospace, monospace",
    body: "'Work Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    googleFamily: "family=JetBrains+Mono:wght@400;600;800&family=Work+Sans:wght@300;400;600",
  },
];

/** Scala tipografica modulare, generata dalle variabili di tema. */
export const TYPE_SCALE = {
  xs: "clamp(0.75rem, 0.72rem + 0.15vw, 0.8125rem)",
  sm: "clamp(0.875rem, 0.84rem + 0.18vw, 0.9375rem)",
  base: "clamp(1rem, 0.96rem + 0.2vw, 1.0625rem)",
  lg: "clamp(1.125rem, 1.06rem + 0.3vw, 1.25rem)",
  xl: "clamp(1.375rem, 1.26rem + 0.5vw, 1.625rem)",
  "2xl": "clamp(1.75rem, 1.5rem + 1vw, 2.25rem)",
  "3xl": "clamp(2.25rem, 1.75rem + 2vw, 3.25rem)",
  "4xl": "clamp(2.75rem, 1.9rem + 3.4vw, 4.5rem)",
  "5xl": "clamp(3.25rem, 1.9rem + 5.4vw, 6rem)",
} as const;

/**
 * Costruisce i token di un tema a partire dalla palette del brand,
 * con OGNI coppia testo/sfondo già portata a contrasto AA o superiore.
 */
export function buildThemeTokens(palette: Palette, mode: ThemeMode): ThemeTokens {
  const dark = mode === "dark";
  const neutralHue = palette.neutral.h;

  const bg: Oklch = dark
    ? { l: 0.16, c: 0.014, h: neutralHue }
    : { l: 0.99, c: 0.004, h: neutralHue };
  const bgElevated: Oklch = dark
    ? { l: 0.21, c: 0.016, h: neutralHue }
    : { l: 0.97, c: 0.006, h: neutralHue };
  const bgMuted: Oklch = dark
    ? { l: 0.25, c: 0.018, h: neutralHue }
    : { l: 0.94, c: 0.008, h: neutralHue };
  const border: Oklch = dark
    ? { l: 0.32, c: 0.02, h: neutralHue }
    : { l: 0.88, c: 0.012, h: neutralHue };

  // Il testo deve restare leggibile su OGNI superficie del tema, non solo sulla
  // pagina: il vincolo viene applicato in sequenza a sfondo, superficie elevata
  // e superficie attenuata, perché una scheda può avere un fondo diverso.
  const surfaces = [bg, bgElevated, bgMuted];
  const ensureOnAll = (color: Oklch, target: number): Oklch =>
    surfaces.reduce((current, surface) => ensureContrast(current, surface, target), color);

  const text = ensureOnAll(dark ? { l: 0.97, c: 0.006, h: neutralHue } : { l: 0.2, c: 0.02, h: neutralHue }, 7);
  const textMuted = ensureOnAll(
    dark ? { l: 0.74, c: 0.015, h: neutralHue } : { l: 0.45, c: 0.02, h: neutralHue },
    4.5,
  );

  const primary = adjust(palette.primary, { l: dark ? Math.min(0.78, palette.primary.l + 0.12) : palette.primary.l });
  const primaryText = ensureContrast({ l: dark ? 0.16 : 0.99, c: 0.01, h: primary.h }, primary, 4.5);
  const primaryHover = adjust(primary, { l: dark ? Math.min(0.86, primary.l + 0.08) : Math.max(0.2, primary.l - 0.08) });

  const accent = adjust(palette.accent, { l: dark ? Math.min(0.82, palette.accent.l + 0.08) : palette.accent.l - 0.06 });
  const accentText = ensureContrast({ l: dark ? 0.16 : 0.99, c: 0.01, h: accent.h }, accent, 4.5);

  return {
    bg: oklchCss(bg),
    bgElevated: oklchCss(bgElevated),
    bgMuted: oklchCss(bgMuted),
    text: oklchCss(text),
    textMuted: oklchCss(textMuted),
    border: oklchCss(border),
    primary: oklchCss(primary),
    primaryText: oklchCss(primaryText),
    primaryHover: oklchCss(primaryHover),
    accent: oklchCss(accent),
    accentText: oklchCss(accentText),
    ring: oklchCss(adjust(primary, { l: Math.min(0.9, primary.l + 0.2), c: primary.c })),
    shadowColor: oklchCss({ l: 0.2, c: 0.03, h: neutralHue }, 0.45),
    overlay: oklchCss({ l: 0.1, c: 0.01, h: neutralHue }, 0.62),
  };
}

/** Verifica che ogni coppia critica del tema rispetti il contrasto minimo. */
export function auditThemeContrast(tokens: ThemeTokens): { pair: string; ratio: number; ok: boolean }[] {
  const bodyBg = parseOklchToken(tokens.bg);
  const elevated = parseOklchToken(tokens.bgElevated);
  const muted = parseOklchToken(tokens.bgMuted);
  const primary = parseOklchToken(tokens.primary);
  const accent = parseOklchToken(tokens.accent);

  const pairs: { pair: string; fg: Oklch; bg: Oklch; min: number }[] = [
    { pair: "text/bg", fg: parseOklchToken(tokens.text), bg: bodyBg, min: 4.5 },
    { pair: "text-muted/bg", fg: parseOklchToken(tokens.textMuted), bg: bodyBg, min: 4.5 },
    { pair: "text/bg-elevated", fg: parseOklchToken(tokens.text), bg: elevated, min: 4.5 },
    { pair: "text-muted/bg-elevated", fg: parseOklchToken(tokens.textMuted), bg: elevated, min: 4.5 },
    { pair: "text/bg-muted", fg: parseOklchToken(tokens.text), bg: muted, min: 4.5 },
    { pair: "text-muted/bg-muted", fg: parseOklchToken(tokens.textMuted), bg: muted, min: 4.5 },
    { pair: "primary-text/primary", fg: parseOklchToken(tokens.primaryText), bg: primary, min: 4.5 },
    { pair: "accent-text/accent", fg: parseOklchToken(tokens.accentText), bg: accent, min: 4.5 },
  ];

  return pairs.map(({ pair, fg, bg, min }) => {
    const ratio = contrastRatio(fg, bg);
    return { pair, ratio: Number(ratio.toFixed(2)), ok: ratio >= min };
  });
}

/** Legge un token `oklch(l c h)` già serializzato. */
export function parseOklchToken(token: string): Oklch {
  const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(token);
  if (!match) return { l: 0.5, c: 0, h: 0 };
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
}
