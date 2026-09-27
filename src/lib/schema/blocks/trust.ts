import { z } from "zod";
import { el } from "@/lib/render/node";
import { icon } from "@/lib/render/icons";
import { defineBlock } from "./types";
import { card, container, eyebrow, grid, heading, paragraph, section } from "./parts";

const TestimonialItem = z.object({
  quote: z.string(),
  author: z.string(),
  role: z.string().default(""),
  rating: z.number().min(0).max(5).default(5),
  city: z.string().default(""),
});

const TestimonialsProps = z.object({
  eyebrow: z.string().default(""),
  title: z.string().default(""),
  items: z.array(TestimonialItem).default([]),
});

function stars(rating: number) {
  return el(
    "div",
    { class: "atl-stars", role: "img", "aria-label": `Valutazione ${rating} su 5` },
    ...Array.from({ length: 5 }, (_, index) => icon("star", 15, index < rating ? "atl-star is-on" : "atl-star")),
  );
}

export const testimonialsCards = defineBlock({
  type: "testimonials",
  variant: "cards",
  label: "Testimonianze a schede",
  category: "trust",
  description: "Citazioni con autore, ruolo e valutazione: prova sociale immediata.",
  schema: TestimonialsProps,
  defaults: TestimonialsProps.parse({ items: [] }),
  tags: ["recensioni", "testimonianze", "fiducia"],
  sectors: ["legal", "medical", "agency", "fitness", "artisan", "realestate", "generic"],
  build: (props, _ctx, block) =>
    section(block, [
      container([
        el("div", { class: "atl-head" }, eyebrow(props.eyebrow), heading(2, props.title)),
        grid(3, props.items.map((item) =>
          card([
            stars(item.rating),
            el("blockquote", { class: "atl-quote" }, paragraph(item.quote)),
            el(
              "footer",
              { class: "atl-quote__footer" },
              el("span", { class: "atl-quote__author" }, item.author),
              item.role || item.city ? el("span", { class: "atl-quote__role" }, [item.role, item.city].filter(Boolean).join(" · ")) : null,
            ),
          ], "atl-card--quote"),
        )),
      ]),
    ]),
});

export const testimonialsFeature = defineBlock({
  type: "testimonials",
  variant: "feature",
  label: "Testimonianza singola",
  category: "trust",
  description: "Una sola voce ampia, con grande rilievo tipografico: efficace dopo i risultati.",
  schema: TestimonialsProps,
  defaults: TestimonialsProps.parse({ items: [] }),
  tags: ["recensione", "citazione"],
  sectors: ["luxury", "legal", "agency"],
  build: (props, _ctx, block) => {
    const first = props.items[0];
    if (!first) {
      return section(block, [container([el("div", { class: "atl-head" }, heading(2, props.title))])]);
    }
    return section(block, [
      container([
        el(
          "figure",
          { class: "atl-feature-quote" },
          icon("quote", 32, "atl-feature-quote__mark"),
          el("blockquote", null, el("p", { class: "atl-feature-quote__text" }, first.quote)),
          el(
            "figcaption",
            { class: "atl-feature-quote__caption" },
            stars(first.rating),
            el("span", { class: "atl-quote__author" }, first.author),
            first.role ? el("span", { class: "atl-quote__role" }, first.role) : null,
          ),
        ),
      ]),
    ]);
  },
});

const FaqProps = z.object({
  eyebrow: z.string().default(""),
  title: z.string().default(""),
  intro: z.string().default(""),
  items: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
});

/**
 * FAQ con `<details>`/`<summary>`: si aprono e si chiudono senza JavaScript,
 * sono raggiungibili da tastiera e annunciate correttamente dai lettori di schermo.
 */
function faqDetails(props: z.output<typeof FaqProps>) {
  return el(
    "div",
    { class: "atl-faq" },
    ...props.items.map((item) =>
      el(
        "details",
        { class: "atl-faq__item" },
        el("summary", { class: "atl-faq__question" }, el("span", null, item.question), icon("chevronDown", 18, "atl-faq__chevron")),
        el("div", { class: "atl-faq__answer" }, paragraph(item.answer)),
      ),
    ),
  );
}

export const faqAccordion = defineBlock({
  type: "faq",
  variant: "accordion",
  label: "FAQ a fisarmonica",
  category: "conversion",
  description: "Domande frequenti in fisarmonica: elimina le obiezioni prima del contatto.",
  schema: FaqProps,
  defaults: FaqProps.parse({ items: [] }),
  tags: ["faq", "domande", "obiezioni"],
  sectors: ["legal", "medical", "saas", "fitness", "artisan", "education", "generic", "restaurant"],
  build: (props, _ctx, block) =>
    section(block, [
      container([
        el("div", { class: "atl-head" }, eyebrow(props.eyebrow), heading(2, props.title), props.intro ? paragraph(props.intro, "atl-lead") : null),
        faqDetails(props),
      ]),
    ]),
});

export const faqTwoColumn = defineBlock({
  type: "faq",
  variant: "two-column",
  label: "FAQ su due colonne",
  category: "conversion",
  description: "Domande e risposte affiancate: utile quando le risposte sono brevi e molte.",
  schema: FaqProps,
  defaults: FaqProps.parse({ items: [] }),
  tags: ["faq", "colonne"],
  sectors: ["saas", "medical", "agency"],
  build: (props, _ctx, block) =>
    section(block, [
      container([
        el("div", { class: "atl-head" }, eyebrow(props.eyebrow), heading(2, props.title)),
        el(
          "dl",
          { class: "atl-faq-grid" },
          ...props.items.flatMap((item) => [
            el("dt", { class: "atl-faq-grid__q" }, item.question),
            el("dd", { class: "atl-faq-grid__a" }, paragraph(item.answer)),
          ]),
        ),
      ]),
    ]),
});
