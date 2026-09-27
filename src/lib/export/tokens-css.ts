import { FONT_PAIRINGS, STYLE_PRESETS, TYPE_SCALE, buildThemeTokens } from "@/lib/design/tokens";
import type { ThemeTokens } from "@/lib/design/tokens";
import type { Site } from "@/lib/schema/site";

/**
 * `tokens.css` — l'unico punto in cui lo stile entra nel sito esportato.
 *
 * Il foglio di stile è costante e statico; qui cambiano solo le variabili.
 * È questo che rende il restyle istantaneo e sicuro: nessuna regola viene
 * riscritta, nessun contenuto viene toccato.
 */

export type ResolvedTheme = {
  tokens: ThemeTokens;
  preset: (typeof STYLE_PRESETS)[keyof typeof STYLE_PRESETS];
  fontHeading: string;
  fontBody: string;
  fontMono: string;
  googleFamilies: string;
  pairingId: string;
};

export function resolveTheme(site: Site): ResolvedTheme {
  const presetVars = STYLE_PRESETS[site.theme.preset] ?? STYLE_PRESETS.editorial;
  const pairing = FONT_PAIRINGS.find((item) => item.id === site.theme.fontPairing) ?? FONT_PAIRINGS[0];
  const tokens = buildThemeTokens(site.theme.palette, site.theme.mode);

  return {
    tokens,
    preset: presetVars,
    fontHeading: pairing.heading,
    fontBody: pairing.body,
    fontMono: pairing.mono ?? "ui-monospace, SFMono-Regular, monospace",
    googleFamilies: pairing.googleFamily,
    pairingId: pairing.id,
  };
}

export function tokensCss(site: Site, resolved: ResolvedTheme): string {
  const { tokens, preset: vars } = resolved;
  const scale = Object.entries(TYPE_SCALE)
    .map(([name, value]) => `  --text-${name}: ${value};`)
    .join("\n");

  return `/* Atelier — variabili di tema. Modifica qui i valori, non il foglio di stile. */
:root {
  color-scheme: ${site.theme.mode};

${scale}

  --font-heading: ${resolved.fontHeading};
  --font-body: ${resolved.fontBody};
  --font-mono: ${resolved.fontMono};

  --bg: ${tokens.bg};
  --bg-elevated: ${tokens.bgElevated};
  --bg-muted: ${tokens.bgMuted};
  --text: ${tokens.text};
  --text-muted: ${tokens.textMuted};
  --border: ${tokens.border};
  --primary: ${tokens.primary};
  --primary-text: ${tokens.primaryText};
  --primary-hover: ${tokens.primaryHover};
  --accent: ${tokens.accent};
  --accent-text: ${tokens.accentText};
  --ring: ${tokens.ring};
  --shadow-color: ${tokens.shadowColor};
  --overlay: ${tokens.overlay};

  --radius: ${vars.radius};
  --radius-large: ${vars.radiusLarge};
  --shadow: ${vars.shadow};
  --border-width: ${vars.borderWidth};
  --heading-weight: ${vars.headingWeight};
  --heading-tracking: ${vars.headingTracking};
  --heading-transform: ${vars.headingTransform};
  --body-weight: ${vars.bodyWeight};
  --section-padding: ${vars.sectionPadding};
  --density: ${vars.density};
  --label-transform: ${vars.labelTransform};
  --label-tracking: ${vars.labelTracking};
  --motion: ${vars.motion};
  --card-background: ${vars.cardBackground};
  --divider: ${vars.dividerStyle};

  --container: 74rem;
  --container-wide: 88rem;
  --container-narrow: 48rem;
  --gutter: clamp(1.25rem, 4vw, 2.75rem);
}
`;
}
