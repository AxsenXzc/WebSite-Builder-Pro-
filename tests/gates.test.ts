import { describe, expect, it } from "vitest";
import { composeSite } from "@/lib/compiler/offline-composer";
import { renderSite } from "@/lib/export/render-site";
import { runGates } from "@/lib/quality/gates";
import { sanitizeSvg, containsExecutableMarkup } from "@/lib/quality/sanitize";
import { BriefSchema, type Site } from "@/lib/schema/site";

const NOW = "2026-09-26T10:00:00.000Z";

function buildSite(prompt: string, domain = "https://esempio.it"): Site {
  const site = composeSite(BriefSchema.parse({ prompt }), { now: NOW });
  return { ...site, meta: { ...site.meta, domain } };
}

function withFiles(site: Site) {
  return renderSite(site).map((file) => ({ path: file.path, contents: file.contents }));
}

describe("gate di qualità", () => {
  const site = buildSite("Studio di architettura a Bologna specializzato in ristrutturazioni");

  it("un sito generato supera i controlli senza errori", () => {
    const report = runGates(site, withFiles(site));
    const blocking = report.issues.filter((issue) => issue.severity === "error");
    expect(blocking.map((issue) => `${issue.title}: ${issue.detail}`)).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("misura il sito in modo utile e verificabile", () => {
    const report = runGates(site, withFiles(site));
    expect(report.stats.pages).toBeGreaterThanOrEqual(6);
    expect(report.stats.blocks).toBeGreaterThan(30);
    expect(report.stats.words).toBeGreaterThan(600);
    expect(report.stats.contrastFailures).toBe(0);
    // Nessuna singola pagina può superare il budget di peso.
    for (const file of withFiles(site).filter((item) => item.path.endsWith(".html"))) {
      expect(file.contents.length, `${file.path} troppo pesante`).toBeLessThan(200_000);
    }
  });

  it("avvisa quando manca il dominio, senza bloccare l'export", () => {
    const withoutDomain = buildSite("Pizzeria a Milano", "");
    const report = runGates(withoutDomain, withFiles(withoutDomain));
    expect(report.issues.some((issue) => issue.id === "domain")).toBe(true);
    expect(report.ok).toBe(true);
  });

  it("segnala una pagina senza titolo SEO come errore bloccante", () => {
    const broken: Site = {
      ...site,
      pages: site.pages.map((page) => (page.id === "home" ? { ...page, seo: { ...page.seo, title: "ab" } } : page)),
    };
    const report = runGates(broken, withFiles(broken));
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.id === "seo-title")).toBe(true);
  });

  it("spiega sempre come si risolve un problema", () => {
    const report = runGates(site, withFiles(site));
    for (const issue of report.issues) {
      expect(issue.fix.length).toBeGreaterThan(10);
    }
  });
});

describe("sicurezza del markup", () => {
  it("rimuove script, gestori di eventi e riferimenti pericolosi dagli SVG", () => {
    const malicious = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><a href="javascript:alert(2)"><rect onclick="alert(3)" width="10" height="10"/></a><circle cx="5" cy="5" r="2"/></svg>`;
    const result = sanitizeSvg(malicious);
    expect(result.svg).not.toMatch(/script/i);
    expect(result.svg).not.toMatch(/javascript:/i);
    expect(result.svg).not.toMatch(/onclick/i);
    expect(result.svg).toContain("circle");
    expect(result.removed.length).toBeGreaterThan(0);
  });

  it("rifiuta markup che non contiene un elemento svg", () => {
    expect(sanitizeSvg("<div>ciao</div>").ok).toBe(false);
  });

  it("accetta il nostro site.js", () => {
    expect(containsExecutableMarkup('<p>ok</p><script src="/site.js" defer></script>').safe).toBe(true);
  });

  it("accetta i dati strutturati JSON-LD", () => {
    expect(containsExecutableMarkup('<script type="application/ld+json">{"a":1}</script>').safe).toBe(true);
  });

  it("rifiuta uno script inline non previsto", () => {
    expect(containsExecutableMarkup("<script>alert(1)</script>").safe).toBe(false);
  });

  it("rifiuta i gestori di evento inline", () => {
    expect(containsExecutableMarkup('<a onclick="x()">x</a>').safe).toBe(false);
  });

  it("rifiuta gli URL javascript:", () => {
    expect(containsExecutableMarkup('<a href="javascript:x()">x</a>').safe).toBe(false);
  });
});
