import { PRESET_LABELS, STYLE_PRESETS, type StylePreset } from "@/lib/design/tokens";
import { STYLE_BRIEFS } from "@/lib/design/style-briefs";

const ORDER: StylePreset[] = ["editorial", "luxury", "brutalist", "glass", "minimal", "tech", "organic", "retro"];

/** Le variabili dei preset parlano del tema generato: qui le riportiamo all'app. */
function toAppTokens(value: string): string {
  return value
    .replace(/var\(--text\)/g, "var(--color-ink-100)")
    .replace(/var\(--border\)/g, "var(--color-surface-700)")
    .replace(/var\(--bg-elevated\)/g, "var(--color-surface-850)")
    .replace(/var\(--bg\)/g, "var(--color-surface-950)")
    .replace(/var\(--shadow-color\)/g, "rgba(0, 0, 0, 0.6)");
}

/**
 * Le otto direzioni visive, mostrate con i loro valori veri: raggio, bordo,
 * peso e spaziatura sono quelli che il sito generato userà davvero.
 */
export function PresetGallery() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ORDER.map((preset) => {
        const vars = STYLE_PRESETS[preset];
        const brief = STYLE_BRIEFS[preset];
        return (
          <article key={preset} className="card card-hover grid gap-3 p-4">
            <div
              className="grid gap-2 border border-surface-700/70 bg-surface-950 p-3"
              style={{
                borderRadius: vars.radiusLarge,
                borderWidth: vars.borderWidth,
                boxShadow: toAppTokens(vars.shadow),
                borderTopStyle: vars.dividerStyle.includes("dashed") ? "dashed" : "solid",
              }}
            >
              <span
                className="text-[10px]"
                style={{
                  textTransform: vars.labelTransform,
                  letterSpacing: vars.labelTracking,
                  color: "var(--color-ink-500)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Apertura
              </span>
              <span
                className="text-[15px] leading-tight"
                style={{
                  fontWeight: vars.headingWeight,
                  letterSpacing: vars.headingTracking,
                  textTransform: vars.headingTransform,
                }}
              >
                {brief.mood.split(":")[0]}
              </span>
              <span className="h-6 rounded-[2px] bg-gradient-to-r from-accent-600/50 to-violet-500/40" style={{ borderRadius: vars.radius }} />
              <span
                className="border-t border-surface-700/70 pt-2 text-[11px] text-ink-600"
                style={{ borderTopStyle: vars.dividerStyle.includes("dashed") ? "dashed" : "solid" }}
              >
                {vars.radius} · {vars.borderWidth} · {vars.motion.split(" ")[0]}
              </span>
            </div>

            <div className="grid gap-1">
              <h3 className="text-sm font-semibold">{PRESET_LABELS[preset]}</h3>
              <p className="text-[11px] text-ink-500">{brief.voice.split(".")[0]}.</p>
              <p className="text-[11px] text-ink-600">
                <span className="mono-label">evita</span> {brief.avoid[0]?.toLowerCase()}.
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
