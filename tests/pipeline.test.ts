import { describe, expect, it, vi } from "vitest";
import { applyBlueprint, normalizeFontPairing, normalizePreset, withStageDeadline } from "@/lib/ai/compile";
import { composeSite } from "@/lib/compiler/offline-composer";
import { BriefSchema } from "@/lib/schema/site";

// Il modulo `ai` viene sostituito: qui interessa il comportamento del
// compilatore quando un provider non risponde, non il provider stesso.
vi.mock("ai", () => ({
  generateText: vi.fn(async () => {
    throw new Error("in questa suite non si chiamano provider");
  }),
  Output: { object: (input: unknown) => input },
}));

describe("scadenza degli stadi AI", () => {
  it("una chiamata che risponde passa liscia, con il segnale pronto", async () => {
    const seen: string[] = [];
    const value = await withStageDeadline(1500, async (signal) => {
      seen.push(`abortito: ${signal.aborted}`);
      return "ok";
    });
    expect(value).toBe("ok");
    expect(seen).toEqual(["abortito: false"]);
  });

  it("una chiamata che ignora l'abortSignal viene comunque abbandonata", async () => {
    const started = Date.now();
    const controller = { signal: null as AbortSignal | null };

    await expect(
      withStageDeadline(300, (signal) => {
        controller.signal = signal;
        return new Promise<string>(() => {
          /* un provider che non risponde mai */
        });
      }),
    ).rejects.toThrow(/tempo massimo/i);

    expect(Date.now() - started).toBeLessThan(2000);
    expect(controller.signal?.aborted).toBe(true);
  });

  it("un errore del provider arriva al chiamante, senza essere mascherato", async () => {
    await expect(
      withStageDeadline(1000, async () => {
        throw new Error("429 Too Many Requests");
      }),
    ).rejects.toThrow("429");
  });

  it("il limite viene contenuto fra 250 ms e 60 s", async () => {
    // Un budget assurdo non deve diventare un'attesa infinita.
    const started = Date.now();
    await expect(withStageDeadline(0, () => new Promise<string>(() => {}))).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(1500);
  });
});

describe("lettura tollerante del blueprint", () => {
  const brief = BriefSchema.parse({ prompt: "Studio di architettura a Bologna, ristrutturazioni di interni" });

  it("riconosce lo stile anche scritto male", () => {
    expect(normalizePreset("tech")).toBe("tech");
    expect(normalizePreset("  Editorial ")).toBe("editorial");
    expect(normalizePreset("Brutalist (manifesto)")).toBe("brutalist");
    expect(normalizePreset("Luxury minimal")).toBe("luxury");
    expect(normalizePreset("" )).toBeNull();
    expect(normalizePreset("fantasia")).toBeNull();
  });

  it("riconosce la tipografia per id o per nome leggibile", () => {
    expect(normalizeFontPairing("grotesk-inter")).toBe("grotesk-inter");
    expect(normalizeFontPairing("Playfair + Source Sans")).toBe("playfair-source");
    expect(normalizeFontPairing("JetBrains Mono + Work Sans")).toBe("jetbrains-work");
    expect(normalizeFontPairing("comic sans")).toBeNull();
  });

  it("un blueprint approssimativo non rompe il sito: si applica ciò che è valido", () => {
    const site = composeSite(brief, { now: "2026-09-27T09:00:00.000Z" });
    const applied = applyBlueprint(site, {
      preset: "NON ESISTE",
      fontPairing: "FS Albert",
      paletteHue: undefined,
      tagline: "Ristrutturiamo appartamenti storici senza snaturarli.",
      tone: "semplice e concreto",
      pages: [],
    });

    expect(applied.site.theme.preset).toBe(site.theme.preset);
    expect(applied.site.theme.fontPairing).toBe(site.theme.fontPairing);
    expect(applied.site.theme.palette).toEqual(site.theme.palette);
    expect(applied.site.brand.tagline).toContain("Ristrutturiamo");
    expect(applied.warnings.length).toBe(2);
  });

  it("quando il modello è preciso, il blueprint si applica per intero", () => {
    const site = composeSite(brief, { now: "2026-09-27T09:00:00.000Z" });
    const applied = applyBlueprint(site, {
      preset: "tech",
      fontPairing: "jetbrains-work",
      paletteHue: 210,
      tagline: "Studio di architettura a Bologna: ristrutturazioni con progetto e cantiere seguiti.",
      tone: "tecnico",
      pages: [{ path: "/", seoTitle: "Titolo nuovo", seoDescription: "Descrizione nuova" }],
    });

    expect(applied.site.theme.preset).toBe("tech");
    expect(applied.site.theme.fontPairing).toBe("jetbrains-work");
    expect(applied.site.theme.palette.primary.h).toBe(210);
    expect(applied.site.pages[0]?.seo.title).toBe("Titolo nuovo");
    expect(applied.warnings.length).toBe(0);
  });
});
