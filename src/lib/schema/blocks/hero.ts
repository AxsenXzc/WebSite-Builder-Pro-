import { z } from "zod";
import { el, type El } from "@/lib/render/node";
import { icon } from "@/lib/render/icons";
import { LinkSchema, MediaSchema } from "@/lib/schema/site";
import { defineBlock } from "./types";
import { container, ctaRow, eyebrow, heading, lead, media, section } from "./parts";

const HeroProps = z.object({
  eyebrow: z.string().default(""),
  title: z.string(),
  subtitle: z.string().default(""),
  primaryCta: LinkSchema.optional(),
  secondaryCta: LinkSchema.optional(),
  image: MediaSchema.optional(),
  badges: z.array(z.string()).default([]),
  stats: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
});

const DEFAULT_HERO = {
  eyebrow: "",
  title: "Titolo principale",
  subtitle: "",
  badges: [],
  stats: [],
};

function heroActions(props: z.output<typeof HeroProps>): El | null {
  const links = [props.primaryCta, props.secondaryCta].filter(Boolean) as z.output<typeof LinkSchema>[];
  if (links.length === 0) return null;
  return ctaRow(links);
}

function heroBadges(props: z.output<typeof HeroProps>): El | null {
  if (props.badges.length === 0) return null;
  return el(
    "ul",
    { class: "atl-badges" },
    ...props.badges.map((badge) => el("li", { class: "atl-badge" }, icon("check", 15), el("span", null, badge))),
  );
}

function heroStats(props: z.output<typeof HeroProps>): El | null {
  if (props.stats.length === 0) return null;
  return el(
    "dl",
    { class: "atl-stats atl-stats--inline" },
    ...props.stats.flatMap((stat) => [
      el("dt", { class: "atl-stat__value" }, stat.value),
      el("dd", { class: "atl-stat__label" }, stat.label),
    ]),
  );
}

export const heroSplit = defineBlock({
  type: "hero",
  variant: "split",
  label: "Hero affiancata",
  category: "hero",
  description: "Testo a sinistra e visual a destra: la struttura di apertura più leggibile e affidabile.",
  schema: HeroProps,
  defaults: HeroProps.parse({ ...DEFAULT_HERO }),
  tags: ["apertura", "hero", "conversione"],
  sectors: ["saas", "agency", "generic", "artisan", "fitness"],
  build: (props, ctx, block) =>
    section(block, [
      container([
        el(
          "div",
          { class: "atl-hero atl-hero--split" },
          el(
            "div",
            { class: "atl-hero__content" },
            eyebrow(props.eyebrow),
            heading(1, props.title),
            props.subtitle ? lead(props.subtitle) : null,
            heroActions(props),
            heroBadges(props),
          ),
          el(
            "div",
            { class: "atl-hero__visual" },
            media(
              props.image ?? {
                alt: `${ctx.site.businessName}: immagine di apertura`,
                art: { seed: 7, hue: ctx.site.theme.palette.primary.h, style: "mesh", intensity: 0.7 },
              },
            ),
            heroStats(props),
          ),
        ),
      ]),
    ], "atl-hero-section"),
});

export const heroCentered = defineBlock({
  type: "hero",
  variant: "centered",
  label: "Hero centrata",
  category: "hero",
  description: "Testo centrato con visual ampio sotto: funziona bene per studio, servizi e lanci.",
  schema: HeroProps,
  defaults: HeroProps.parse({ ...DEFAULT_HERO }),
  tags: ["apertura", "hero", "centrata"],
  sectors: ["legal", "medical", "education", "generic"],
  build: (props, ctx, block) =>
    section(block, [
      container([
        el(
          "div",
          { class: "atl-hero atl-hero--centered" },
          eyebrow(props.eyebrow),
          heading(1, props.title),
          props.subtitle ? lead(props.subtitle) : null,
          heroActions(props),
          heroBadges(props),
          media(
            props.image ?? {
              alt: `${ctx.site.businessName}: immagine di apertura`,
              art: { seed: 11, hue: ctx.site.theme.palette.primary.h, style: "waves", intensity: 0.55 },
            },
            "atl-hero__wide",
          ),
        ),
      ]),
    ], "atl-hero-section"),
});

export const heroEditorial = defineBlock({
  type: "hero",
  variant: "editorial",
  label: "Hero editoriale",
  category: "hero",
  description: "Titolo grande, sommario su due colonne e immagine a tutta larghezza: taglio da rivista.",
  schema: HeroProps.extend({ standfirst: z.string().default("") }),
  defaults: HeroProps.extend({ standfirst: z.string().default("") }).parse({ ...DEFAULT_HERO, standfirst: "" }),
  tags: ["apertura", "editoriale", "rivista"],
  sectors: ["agency", "restaurant", "artisan", "realestate"],
  build: (props, ctx, block) =>
    section(block, [
      container([
        eyebrow(props.eyebrow),
        heading(1, props.title, "atl-heading--display"),
        el(
          "div",
          { class: "atl-editorial__grid" },
          props.subtitle ? lead(props.subtitle) : null,
          props.standfirst ? el("p", { class: "atl-text" }, props.standfirst) : null,
        ),
        heroActions(props),
      ], "atl-hero__editorial"),
      container([media(props.image ?? {
        alt: `${ctx.site.businessName}: immagine di apertura`,
        art: { seed: 23, hue: ctx.site.theme.palette.accent.h, style: "stripes", intensity: 0.6 },
      }, "atl-hero__wide")], "atl-container--flush"),
    ], "atl-hero-section atl-hero-section--editorial"),
});
