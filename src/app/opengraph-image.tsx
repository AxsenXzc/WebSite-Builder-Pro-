import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/util/site-url";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Immagine di anteprima per i social.
 *
 * È disegnata con lo stesso linguaggio della vetrina: fondo notte, accento
 * ciano, monogramma. Niente fotografie e niente testo che dipenda da un font
 * scaricato: così l'immagine si genera sempre, anche in build isolate.
 */
export default function OpengraphImage() {
  const chips = ["local-first", "nessuna chiave obbligatoria", "anteprima = export"];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "64px 72px",
          background: "linear-gradient(140deg, #0b0d12 0%, #101827 55%, #0b0d12 100%)",
          color: "#f4f6fb",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 62,
              height: 62,
              borderRadius: 18,
              border: "1px solid rgba(96,180,255,0.45)",
              background: "rgba(56,140,255,0.16)",
              color: "#7ec8ff",
              fontSize: 34,
            }}
          >
            A
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700 }}>{SITE_NAME}</div>
            <div style={{ display: "flex", fontSize: 19, color: "#8896b3" }}>website builder AI</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontSize: 66, fontWeight: 700, lineHeight: 1.08, maxWidth: 900 }}>
            Un prompt. Un sito che sembra fatto da uno studio.
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#a9b6d0", maxWidth: 900 }}>
            Compilatore deterministico, editor visuale, gate di qualità ed export statico senza lock-in.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {chips.map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                padding: "10px 20px",
                borderRadius: 999,
                border: "1px solid rgba(120,140,175,0.4)",
                color: "#c3cde2",
                fontSize: 22,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
