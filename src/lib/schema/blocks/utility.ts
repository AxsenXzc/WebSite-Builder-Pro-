import { z } from "zod";
import { el } from "@/lib/render/node";
import { icon } from "@/lib/render/icons";
import { LinkSchema } from "@/lib/schema/site";
import { defineBlock } from "./types";
import { container, eyebrow, heading, legalBody, paragraph, section } from "./parts";

const NoticeProps = z.object({
  text: z.string().default(
    "Usiamo cookie tecnici e, solo con il tuo consenso, cookie di misurazione per migliorare il sito.",
  ),
  acceptLabel: z.string().default("Accetta tutti"),
  rejectLabel: z.string().default("Solo necessari"),
  privacyLink: LinkSchema.optional(),
  cookieLink: LinkSchema.optional(),
});

/**
 * Banner cookie con consenso granulare.
 * Non carica nulla prima del consenso: gli script di misurazione si attivano solo
 * dopo, e la scelta è registrata localmente. Rifiutare è semplice quanto accettare.
 */
export const cookieNotice = defineBlock({
  type: "notice",
  variant: "cookie",
  label: "Banner cookie",
  category: "utility",
  description: "Consenso con accetta/rifiuta allo stesso livello, link a privacy e cookie policy, nessuno script prima del consenso.",
  schema: NoticeProps,
  defaults: NoticeProps.parse({}),
  tags: ["cookie", "gdpr", "consenso", "privacy"],
  sectors: ["restaurant", "legal", "medical", "fitness", "saas", "ecommerce", "agency", "artisan", "realestate", "education", "generic"],
  build: (props, ctx, block) =>
    section(block, [
      container([
        el(
          "div",
          { class: "atl-cookie", role: "dialog", "aria-live": "polite", "aria-label": "Preferenze cookie", "data-atl-consent": "true" },
          el("p", { class: "atl-cookie__text" }, props.text),
          el(
            "div",
            { class: "atl-cookie__actions" },
            el("button", { class: "atl-cta atl-cta--primary", type: "button", "data-atl-consent-accept": "true" }, el("span", null, props.acceptLabel)),
            el("button", { class: "atl-cta atl-cta--secondary", type: "button", "data-atl-consent-reject": "true" }, el("span", null, props.rejectLabel)),
          ),
          el(
            "div",
            { class: "atl-cookie__links" },
            props.privacyLink ? el("a", { href: props.privacyLink.href }, props.privacyLink.label) : null,
            props.cookieLink ? el("a", { href: props.cookieLink.href }, props.cookieLink.label) : null,
            el("span", { class: "atl-cookie__owner" }, ctx.site.businessName),
          ),
        ),
      ]),
    ], "atl-notice", { hidden: true }),
});

const LegalProps = z.object({
  kind: z.enum(["privacy", "cookie", "terms"]).default("privacy"),
  title: z.string().default(""),
});

export const legalDocument = defineBlock({
  type: "legal",
  variant: "document",
  label: "Documento legale",
  category: "utility",
  description: "Privacy, cookie policy e termini generati con i dati reali dell'attività, non con segnaposto.",
  schema: LegalProps,
  defaults: LegalProps.parse({}),
  tags: ["privacy", "cookie", "termini", "gdpr"],
  sectors: ["restaurant", "legal", "medical", "fitness", "saas", "ecommerce", "agency", "artisan", "realestate", "education", "generic"],
  build: (props, ctx, block) =>
    section(block, [
      container([
        props.title ? heading(1, props.title, "atl-heading--page") : null,
        el("div", { class: "atl-prose atl-prose--legal" }, ...legalBody(ctx.site, props.kind)),
      ]),
    ], "atl-section--prose"),
});

const PostsProps = z.object({
  eyebrow: z.string().default(""),
  title: z.string().default(""),
  intro: z.string().default(""),
  collectionId: z.string().default("articles"),
  limit: z.number().min(1).max(24).default(6),
  basePath: z.string().default("/blog"),
});

export const postsList = defineBlock({
  type: "posts",
  variant: "list",
  label: "Elenco articoli",
  category: "content",
  description: "Ultimi articoli della raccolta con data, categoria e sommario.",
  schema: PostsProps,
  defaults: PostsProps.parse({}),
  tags: ["blog", "articoli", "news", "cms"],
  sectors: ["saas", "agency", "legal", "medical", "education"],
  build: (props, ctx, block) => {
    const collection = ctx.site.collections.find((item) => item.id === props.collectionId);
    const items = (collection?.items ?? []).slice(0, props.limit);

    if (items.length === 0) {
      return section(block, [
        container([
          el("div", { class: "atl-head" }, eyebrow(props.eyebrow), heading(2, props.title || "Blog"), paragraph("Nessun articolo pubblicato: aggiungine dalla sezione Contenuti.", "atl-text--muted")),
        ]),
      ]);
    }

    return section(block, [
      container([
        el("div", { class: "atl-head" }, eyebrow(props.eyebrow), heading(2, props.title || "Blog"), props.intro ? paragraph(props.intro, "atl-lead") : null),
        el(
          "ul",
          { class: "atl-posts" },
          ...items.map((item) =>
            el(
              "li",
              { class: "atl-posts__item" },
              el("a", { class: "atl-posts__link", href: `${props.basePath}/${item.id}` },
                el("span", { class: "atl-eyebrow" }, [item.tag, item.date].filter(Boolean).join(" · ")),
                heading(3, item.title, "atl-card__title"),
                paragraph(item.excerpt, "atl-text--muted"),
                el("span", { class: "atl-link" }, "Leggi", icon("arrowRight", 15)),
              ),
            ),
          ),
        ),
      ]),
    ]);
  },
});
