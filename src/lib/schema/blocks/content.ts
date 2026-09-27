import { z } from "zod";
import { el, type Child } from "@/lib/render/node";
import { icon } from "@/lib/render/icons";
import { MediaSchema } from "@/lib/schema/site";
import { defineBlock } from "./types";
import { card, container, eyebrow, grid, heading, iconBadge, lead, media, paragraph, section } from "./parts";

const FeatureItem = z.object({
  icon: z.string().default("sparkles"),
  title: z.string(),
  text: z.string().default(""),
});

const FeaturesProps = z.object({
  eyebrow: z.string().default(""),
  title: z.string().default(""),
  intro: z.string().default(""),
  items: z.array(FeatureItem).default([]),
});

function featureCard(item: z.output<typeof FeatureItem>): Child {
  return card(
    [
      iconBadge(item.icon),
      heading(3, item.title, "atl-card__title"),
      item.text ? paragraph(item.text, "atl-text--muted") : null,
    ],
    "atl-card--feature",
  );
}

export const featuresGrid = defineBlock({
  type: "features",
  variant: "grid",
  label: "Servizi a griglia",
  category: "content",
  description: "Griglia di servizi con icona, titolo e descrizione: la sezione più usata dai siti di servizi.",
  schema: FeaturesProps,
  defaults: FeaturesProps.parse({ items: [] }),
  tags: ["servizi", "features", "griglia"],
  sectors: ["legal", "medical", "agency", "generic", "saas", "artisan", "fitness"],
  build: (props, _ctx, block) =>
    section(block, [
      container([
        el("div", { class: "atl-head" }, eyebrow(props.eyebrow), heading(2, props.title), props.intro ? lead(props.intro) : null),
        grid(3, props.items.map(featureCard)),
      ]),
    ]),
});

export const featuresBento = defineBlock({
  type: "features",
  variant: "bento",
  label: "Servizi bento",
  category: "content",
  description: "Prima voce in evidenza, le altre in griglia: gerarchia visiva senza perdere contenuto.",
  schema: FeaturesProps,
  defaults: FeaturesProps.parse({ items: [] }),
  tags: ["servizi", "bento", "gerarchia"],
  sectors: ["saas", "agency", "ecommerce"],
  build: (props, _ctx, block) => {
    const [first, ...rest] = props.items;
    return section(block, [
      container([
        el("div", { class: "atl-head" }, eyebrow(props.eyebrow), heading(2, props.title), props.intro ? lead(props.intro) : null),
        el(
          "div",
          { class: "atl-bento" },
          first ? el("div", { class: "atl-bento__lead" }, featureCard(first)) : null,
          el("div", { class: "atl-bento__rest" }, ...rest.map((item) => featureCard(item))),
        ),
      ]),
    ]);
  },
});

export const featuresAlternating = defineBlock({
  type: "features",
  variant: "alternating",
  label: "Servizi alternati",
  category: "content",
  description: "Ogni servizio con la sua immagine, alternata destra/sinistra: più spazio, più racconto.",
  schema: FeaturesProps.extend({ image: MediaSchema.optional() }),
  defaults: FeaturesProps.extend({ image: MediaSchema.optional() }).parse({ items: [] }),
  tags: ["servizi", "alternato", "immagini"],
  sectors: ["artisan", "realestate", "restaurant", "fitness"],
  build: (props, ctx, block) =>
    section(block, [
      container([
        el("div", { class: "atl-head" }, eyebrow(props.eyebrow), heading(2, props.title), props.intro ? lead(props.intro) : null),
        el(
          "div",
          { class: "atl-alternating" },
          ...props.items.map((item, index) =>
            el(
              "div",
              { class: `atl-alternating__row ${index % 2 === 1 ? "atl-alternating__row--flip" : ""}` },
              el("div", { class: "atl-alternating__text" }, iconBadge(item.icon), heading(3, item.title), paragraph(item.text, "atl-text--muted")),
              media(
                props.image ?? {
                  alt: `${item.title}: dettaglio`,
                  art: { seed: index + 3, hue: ctx.site.theme.palette.primary.h + index * 24, style: index % 2 === 0 ? "mesh" : "dots", intensity: 0.5 },
                },
              ),
            ),
          ),
        ),
      ]),
    ]),
});

const StepsProps = z.object({
  eyebrow: z.string().default(""),
  title: z.string().default(""),
  items: z.array(z.object({ title: z.string(), text: z.string().default("") })).default([]),
});

export const stepsTimeline = defineBlock({
  type: "steps",
  variant: "timeline",
  label: "Processo a tappe",
  category: "content",
  description: "Le fasi del lavoro numerate: riduce le domande prima del preventivo.",
  schema: StepsProps,
  defaults: StepsProps.parse({ items: [] }),
  tags: ["processo", "come funziona", "tappe"],
  sectors: ["agency", "legal", "medical", "artisan", "realestate"],
  build: (props, _ctx, block) =>
    section(block, [
      container([
        el("div", { class: "atl-head" }, eyebrow(props.eyebrow), heading(2, props.title)),
        el(
          "ol",
          { class: "atl-timeline" },
          ...props.items.map((item, index) =>
            el(
              "li",
              { class: "atl-timeline__item" },
              el("span", { class: "atl-timeline__index" }, String(index + 1).padStart(2, "0")),
              el("div", null, heading(3, item.title, "atl-card__title"), item.text ? paragraph(item.text, "atl-text--muted") : null),
            ),
          ),
        ),
      ]),
    ]),
});

const GalleryProps = z.object({
  eyebrow: z.string().default(""),
  title: z.string().default(""),
  images: z.array(MediaSchema).default([]),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
});

export const galleryGrid = defineBlock({
  type: "gallery",
  variant: "grid",
  label: "Galleria",
  category: "content",
  description: "Griglia di immagini con didascalie: lavori, piatti, ambienti, prodotti.",
  schema: GalleryProps,
  defaults: GalleryProps.parse({ images: [] }),
  tags: ["galleria", "lavori", "portfolio"],
  sectors: ["restaurant", "artisan", "realestate", "agency", "ecommerce"],
  build: (props, _ctx, block) =>
    section(block, [
      container([
        el("div", { class: "atl-head" }, eyebrow(props.eyebrow), heading(2, props.title)),
        grid(props.columns, props.images.map((image) => media(image, "atl-media--tile"))),
      ]),
    ]),
});

const TeamProps = z.object({
  eyebrow: z.string().default(""),
  title: z.string().default(""),
  people: z
    .array(z.object({ name: z.string(), role: z.string().default(""), bio: z.string().default(""), image: MediaSchema.optional(), email: z.string().default("") }))
    .default([]),
});

export const teamGrid = defineBlock({
  type: "team",
  variant: "grid",
  label: "Squadra",
  category: "content",
  description: "Persone con ruolo e breve biografia: fondamentale nei settori di fiducia.",
  schema: TeamProps,
  defaults: TeamProps.parse({ people: [] }),
  tags: ["team", "persone", "chi siamo"],
  sectors: ["legal", "medical", "agency", "realestate", "education"],
  build: (props, ctx, block) =>
    section(block, [
      container([
        el("div", { class: "atl-head" }, eyebrow(props.eyebrow), heading(2, props.title)),
        grid(3, props.people.map((person) =>
          card([
            media(
              person.image ?? {
                alt: `Ritratto di ${person.name}`,
                art: { seed: person.name.length * 7, hue: ctx.site.theme.palette.accent.h, style: "mesh", intensity: 0.45 },
              },
              "atl-media--portrait",
            ),
            heading(3, person.name, "atl-card__title"),
            person.role ? el("p", { class: "atl-eyebrow" }, person.role) : null,
            person.bio ? paragraph(person.bio, "atl-text--muted") : null,
            person.email ? el("a", { class: "atl-link", href: `mailto:${person.email}` }, person.email) : null,
          ], "atl-card--person"),
        )),
      ]),
    ]),
});

const StatsProps = z.object({
  eyebrow: z.string().default(""),
  title: z.string().default(""),
  items: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
});

export const statsCards = defineBlock({
  type: "stats",
  variant: "cards",
  label: "Numeri",
  category: "trust",
  description: "Numeri verificabili con etichetta: prova concreta, non slogan.",
  schema: StatsProps,
  defaults: StatsProps.parse({ items: [] }),
  tags: ["numeri", "risultati", "fiducia"],
  sectors: ["agency", "fitness", "saas", "education", "medical"],
  build: (props, _ctx, block) =>
    section(block, [
      container([
        props.title ? el("div", { class: "atl-head" }, eyebrow(props.eyebrow), heading(2, props.title)) : null,
        el(
          "dl",
          { class: "atl-stats atl-stats--cards" },
          ...props.items.flatMap((item) => [
            el("div", { class: "atl-stat" }, el("dt", { class: "atl-stat__value" }, item.value), el("dd", { class: "atl-stat__label" }, item.label)),
          ]),
        ),
      ]),
    ]),
});

const LogosProps = z.object({
  title: z.string().default(""),
  items: z.array(z.string()).default([]),
});

export const logosStrip = defineBlock({
  type: "logos",
  variant: "strip",
  label: "Loghi e clienti",
  category: "trust",
  description: "Marchi o clienti citati: se non hai loghi reali, usa nomi di settori serviti.",
  schema: LogosProps,
  defaults: LogosProps.parse({ items: [] }),
  tags: ["clienti", "loghi", "partnership"],
  sectors: ["agency", "saas", "ecommerce"],
  build: (props, _ctx, block) =>
    section(block, [
      container([
        props.title ? el("p", { class: "atl-eyebrow atl-center" }, props.title) : null,
        el(
          "ul",
          { class: "atl-logos" },
          ...props.items.map((item) => el("li", { class: "atl-logos__item" }, icon("award", 16), el("span", null, item))),
        ),
      ]),
    ]),
});

const RichTextProps = z.object({
  eyebrow: z.string().default(""),
  title: z.string().default(""),
  paragraphs: z.array(z.string()).default([]),
  bullets: z.array(z.string()).default([]),
  columns: z.union([z.literal(1), z.literal(2)]).default(1),
});

export const richTextProse = defineBlock({
  type: "richtext",
  variant: "prose",
  label: "Testo lungo",
  category: "content",
  description: "Paragrafi ed elenchi: chi siamo, storia, metodo, spiegazioni.",
  schema: RichTextProps,
  defaults: RichTextProps.parse({ paragraphs: [], bullets: [] }),
  tags: ["testo", "chi siamo", "storia"],
  sectors: ["legal", "medical", "education", "artisan", "generic"],
  build: (props, _ctx, block) =>
    section(block, [
      container([
        eyebrow(props.eyebrow),
        props.title ? heading(2, props.title) : null,
        el(
          "div",
          { class: `atl-prose ${props.columns === 2 ? "atl-prose--two" : ""}` },
          ...props.paragraphs.map((text) => paragraph(text)),
          props.bullets.length > 0
            ? el("ul", { class: "atl-list" }, ...props.bullets.map((bullet) => el("li", null, icon("check", 16), el("span", null, bullet))))
            : null,
        ),
      ]),
    ], "atl-section--prose"),
});
