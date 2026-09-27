"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { composeSite } from "@/lib/compiler/offline-composer";
import { renderSite, renderSingleFileHtml } from "@/lib/export/render-site";
import { downloadText } from "@/lib/export/build-zip";
import { runGates, type GateReport } from "@/lib/quality/gates";
import { BriefSchema } from "@/lib/schema/site";
import { PRESET_LABELS } from "@/lib/design/tokens";

/**
 * Il sito qui sotto non è un'immagine: è un sito generato adesso, in questo
 * browser, dal composer deterministico. Nessuna chiave, nessuna richiesta di
 * rete, nessun template: le misure accanto ai pulsanti sono quelle reali del
 * file prodotto, calcolate dai gate di qualità.
 */

const DEMOS = [
  {
    label: "Pizzeria a Milano",
    businessName: "Forno Lucarelli",
    prompt: "Pizzeria napoletana a Milano con forno a legna e menu senza glutine, aperta a cena",
  },
  {
    label: "Studio di architettura",
    businessName: "Studio Marani",
    prompt: "Studio di architettura a Bologna specializzato in ristrutturazioni di appartamenti storici",
  },
  {
    label: "Software per studi medici",
    businessName: "Cartella Viva",
    prompt: "Software gestionale per studi medici che gestisce appuntamenti e referti in modo semplice",
  },
  {
    label: "Personal trainer",
    businessName: "Luca Ferretti",
    prompt: "Personal trainer a Roma specializzato in ricomposizione corporea dopo i 40 anni, in piccoli gruppi",
  },
];

type Built = {
  html: string;
  gates: GateReport;
  preset: string;
  pages: number;
  ms: number;
};

export function DemoFrame() {
  const [index, setIndex] = useState(0);
  // Il tempo di generazione esiste solo nel browser: prima del montaggio non lo
  // mostriamo, altrimenti il markup del server e quello del client differiscono.
  const [mounted, setMounted] = useState(false);
  const demo = DEMOS[index]!;

  useEffect(() => setMounted(true), []);

  const built = useMemo<Built | null>(() => {
    try {
      const started = performance.now();
      const brief = BriefSchema.parse({ prompt: demo.prompt, businessName: demo.businessName });
      const site = composeSite(brief, { now: "2026-09-27T09:00:00.000Z" });
      const files = renderSite(site).map((file) => ({ path: file.path, contents: file.contents }));
      return {
        html: renderSingleFileHtml(site),
        gates: runGates(site, files),
        preset: PRESET_LABELS[site.theme.preset],
        pages: site.pages.length,
        ms: Math.round(performance.now() - started),
      };
    } catch {
      return null;
    }
  }, [demo]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {DEMOS.map((item, position) => (
          <button
            key={item.label}
            type="button"
            className={`btn ${position === index ? "btn-outline border-accent-500/50 text-ink-100" : "btn-ghost"}`}
            onClick={() => setIndex(position)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="stage-frame overflow-hidden">
        {/* Barra del browser finta: serve a dire che qui c'è una pagina, non un disegno. */}
        <div className="flex items-center gap-3 border-b border-surface-700/70 bg-surface-900 px-3 py-2">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-ok-500/70" />
          </span>
          <span className="flex-1 truncate rounded-tool border border-surface-700/60 bg-surface-950 px-2 py-1 font-mono text-[11px] text-ink-600">
            https://{demo.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.it — generato in locale
          </span>
          <span className="chip">{mounted && built ? `${built.ms} ms · 0 chiamate di rete` : "generazione locale"}</span>
        </div>

        {built ? (
          <iframe
            title={`Anteprima generata: ${demo.businessName}`}
            srcDoc={built.html}
            sandbox="allow-scripts"
            className="h-[520px] w-full bg-white"
          />
        ) : (
          <div className="grid h-[520px] place-items-center text-sm text-ink-500">Anteprima non disponibile.</div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-600">
          <li>
            stile <span className="text-ink-300">{built?.preset ?? "—"}</span>
          </li>
          <li>
            pagine <span className="text-ink-300">{built?.pages ?? "—"}</span>
          </li>
          <li>
            parole <span className="text-ink-300">{built?.gates.stats.words ?? "—"}</span>
          </li>
          <li>
            contrasto{" "}
            <span className="text-ink-300">
              {built ? `${built.gates.stats.contrastPairs - built.gates.stats.contrastFailures}/${built.gates.stats.contrastPairs}` : "—"}
            </span>
          </li>
          <li>
            peso <span className="text-ink-300">{built ? `${built.gates.stats.estimatedKb} KB` : "—"}</span>
          </li>
          <li>
            errori <span className={built && built.gates.errors > 0 ? "text-danger-500" : "text-ok-500"}>{built?.gates.errors ?? "—"}</span>
          </li>
        </ul>

        <div className="flex flex-wrap gap-2">
          {built ? (
            <button
              type="button"
              className="btn"
              onClick={() => downloadText(built.html, `${demo.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`)}
            >
              Scarica questo file
            </button>
          ) : null}
          <Link className="btn btn-primary" href={`/login?next=${encodeURIComponent(`/nuovo?prompt=${encodeURIComponent(demo.prompt)}`)}`}>
            Apri un sito tuo
          </Link>
        </div>
      </div>
    </div>
  );
}
