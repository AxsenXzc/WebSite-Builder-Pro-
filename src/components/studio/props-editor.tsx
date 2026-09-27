"use client";

import { useState } from "react";

/**
 * Editor delle props.
 *
 * Non serve un'interfaccia scritta a mano per ciascuno dei ~30 blocchi: la
 * struttura delle props è già descritta dallo schema zod, quindi l'editor la
 * segue. Aggiungere un blocco nuovo lo rende subito modificabile.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const LABELS: Record<string, string> = {
  eyebrow: "Occhiello",
  title: "Titolo",
  subtitle: "Sottotitolo",
  intro: "Introduzione",
  text: "Testo",
  items: "Voci",
  plans: "Piani",
  name: "Nome",
  label: "Etichetta",
  href: "Link",
  alt: "Testo alternativo",
  src: "Percorso immagine",
  caption: "Didascalia",
  icon: "Icona",
  question: "Domanda",
  answer: "Risposta",
  quote: "Citazione",
  author: "Autore",
  role: "Ruolo",
  price: "Prezzo",
  period: "Periodo",
  features: "Caratteristiche",
  description: "Descrizione",
  note: "Nota",
  links: "Link",
  columns: "Colonne",
  people: "Persone",
  images: "Immagini",
  stats: "Numeri",
  value: "Valore",
  badges: "Etichette",
  primaryCta: "Azione principale",
  secondaryCta: "Azione secondaria",
  image: "Immagine",
  art: "Arte procedurale",
  style: "Stile",
  seed: "Seme",
  hue: "Tinta",
  intensity: "Intensità",
};

const HIDDEN_KEYS = new Set(["icon", "seed", "harmony", "editorial"]);

function humanize(key: string): string {
  return LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function isPlainObject(value: unknown): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function PropsEditor({
  value,
  onChange,
  depth = 0,
}: {
  value: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  depth?: number;
}) {
  const entries = Object.entries(value).filter(([key]) => !HIDDEN_KEYS.has(key) && key !== "id");

  return (
    <div className="grid gap-3">
      {entries.map(([key, field]) => (
        <NodeEditor
          key={key}
          label={humanize(key)}
          value={field as Json}
          depth={depth}
          onChange={(next) => onChange({ [key]: next })}
        />
      ))}
    </div>
  );
}

function NodeEditor({
  label,
  value,
  onChange,
  depth,
}: {
  label: string;
  value: Json;
  onChange: (next: Json) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 2);

  if (typeof value === "string") {
    const long = value.length > 70 || value.includes("\n");
    return (
      <Field label={label}>
        {long ? (
          <textarea className="field min-h-20 resize-y" value={value} onChange={(event) => onChange(event.target.value)} />
        ) : (
          <input className="field" value={value} onChange={(event) => onChange(event.target.value)} />
        )}
      </Field>
    );
  }

  if (typeof value === "number") {
    return (
      <Field label={label}>
        <input
          type="number"
          className="field"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </Field>
    );
  }

  if (typeof value === "boolean") {
    return (
      <label className="flex items-center gap-2 text-xs text-ink-300">
        <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
        {label}
      </label>
    );
  }

  if (Array.isArray(value)) {
    const isPrimitive = value.every((item) => typeof item === "string" || typeof item === "number");

    return (
      <div className="panel-flat p-2">
        <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
          <span className="label">{label}</span>
          <span className="chip">{value.length}</span>
        </button>

        {open ? (
          <div className="mt-2 grid gap-2">
            {value.map((item, index) => (
              <div key={index} className="grid gap-1 border-l border-surface-700 pl-2">
                {isPrimitive ? (
                  <div className="flex gap-1">
                    <input
                      className="field"
                      value={String(item)}
                      onChange={(event) => {
                        const next = [...value];
                        next[index] = typeof item === "number" ? Number(event.target.value) : event.target.value;
                        onChange(next);
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost px-2"
                      title="Rimuovi"
                      onClick={() => onChange(value.filter((_, position) => position !== index))}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-1">
                    <div className="flex items-center justify-between">
                      <span className="label">#{index + 1}</span>
                      <button
                        type="button"
                        className="btn btn-ghost px-2"
                        title="Rimuovi"
                        onClick={() => onChange(value.filter((_, position) => position !== index))}
                      >
                        ×
                      </button>
                    </div>
                    <PropsEditor
                      value={item as Record<string, unknown>}
                      depth={depth + 1}
                      onChange={(patch) => {
                        const next = [...value];
                        next[index] = { ...(item as Record<string, unknown>), ...patch } as Json;
                        onChange(next);
                      }}
                    />
                  </div>
                )}
              </div>
            ))}

            {isPrimitive ? (
              <button type="button" className="btn btn-ghost justify-start" onClick={() => onChange([...value, ""])}>
                + Aggiungi voce
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost justify-start"
                onClick={() => {
                  const template = value[0];
                  const empty = isPlainObject(template)
                    ? Object.fromEntries(Object.keys(template).map((key) => [key, typeof template[key] === "number" ? 0 : ""]))
                    : {};
                  onChange([...value, empty as Json]);
                }}
              >
                + Aggiungi elemento
              </button>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  if (isPlainObject(value)) {
    return (
      <div className="panel-flat p-2">
        <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
          <span className="label">{label}</span>
          <span className="chip">{open ? "chiudi" : "apri"}</span>
        </button>
        {open ? (
          <div className="mt-2">
            <PropsEditor value={value} depth={depth + 1} onChange={(patch) => onChange({ ...value, ...patch } as Json)} />
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
