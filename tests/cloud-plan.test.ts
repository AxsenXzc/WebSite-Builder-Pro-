import { describe, expect, it } from "vitest";
import { describePlan, planSync, type CloudRow, type CloudTombstone, type LocalRow } from "@/lib/storage/sync-plan";
import { chunkBySize, jsonSize } from "@/lib/cloud/batch";

/**
 * Il piano di sincronizzazione è la parte che decide cosa perde e cosa vince:
 * va verificato caso per caso, senza rete e senza database.
 */

const T = (iso: string) => iso;

function cloudRow(project_id: string, updated_at: string): CloudRow {
  return { project_id, name: project_id, slug: project_id, preset: "minimal", updated_at };
}

function localRow(id: string, updatedAt: string): LocalRow {
  return { id, updatedAt };
}

describe("piano di sincronizzazione — progetti presenti da entrambe le parti", () => {
  it("a parità di istante non si muove niente: è la stessa versione", () => {
    const plan = planSync([localRow("a", T("2026-09-27T10:00:00.000Z"))], [cloudRow("a", T("2026-09-27T10:00:00.000Z"))], []);
    expect(plan).toEqual({ push: [], pull: [], deleteLocal: [], pushDeletes: [] });
  });

  it("il giro dopo una spinta non rispinge niente (il cloud conserva l'istante locale)", () => {
    // Il cloud restituisce `updated_at` con lo stesso istante del documento
    // locale, ma scritto in un altro formato (offset invece di `Z`).
    const plan = planSync(
      [localRow("a", T("2026-09-27T10:00:00.000Z"))],
      [cloudRow("a", T("2026-09-27T10:00:00.000+00:00"))],
      [],
    );
    expect(plan).toEqual({ push: [], pull: [], deleteLocal: [], pushDeletes: [] });
    expect(describePlan(plan)).toBe("tutto già allineato");
  });

  it("se il browser è più recente il progetto sale", () => {
    const plan = planSync([localRow("a", T("2026-09-27T11:00:00.000Z"))], [cloudRow("a", T("2026-09-27T10:00:00.000Z"))], []);
    expect(plan.push).toEqual(["a"]);
    expect(plan.pull).toEqual([]);
  });

  it("se il cloud è più recente il progetto scende", () => {
    const plan = planSync([localRow("a", T("2026-09-27T09:00:00.000Z"))], [cloudRow("a", T("2026-09-27T10:00:00.000Z"))], []);
    expect(plan.pull).toEqual(["a"]);
    expect(plan.push).toEqual([]);
  });

  it("un istante illeggibile non fa esplodere il confronto: vale come zero", () => {
    const plan = planSync([localRow("a", "non-una-data")], [cloudRow("a", T("2026-09-27T10:00:00.000Z"))], []);
    expect(plan.pull).toEqual(["a"]);
  });
});

describe("piano di sincronizzazione — progetti da un solo lato", () => {
  it("un progetto solo locale sale", () => {
    const plan = planSync([localRow("solo-qui", T("2026-09-27T10:00:00.000Z"))], [], []);
    expect(plan.push).toEqual(["solo-qui"]);
  });

  it("un progetto solo nel cloud scende", () => {
    const plan = planSync([], [cloudRow("altrove", T("2026-09-27T10:00:00.000Z"))], []);
    expect(plan.pull).toEqual(["altrove"]);
  });

  it("due archivi indipendenti si compongono in un piano solo", () => {
    const plan = planSync(
      [localRow("qui", T("2026-09-27T10:00:00.000Z")), localRow("comune", T("2026-09-27T12:00:00.000Z"))],
      [cloudRow("altrove", T("2026-09-27T10:00:00.000Z")), cloudRow("comune", T("2026-09-27T09:00:00.000Z"))],
      [],
    );
    expect(plan.push.sort()).toEqual(["comune", "qui"]);
    expect(plan.pull).toEqual(["altrove"]);
    expect(describePlan(plan)).toContain("2 inviati");
    expect(describePlan({ push: ["a"], pull: [], deleteLocal: [], pushDeletes: [] })).toBe("1 inviato");

    // A un secondo passaggio, dopo che il browser ha scaricato «altrove» e ha
    // spinto gli altri due, il piano si svuota.
    const again = planSync(
      [
        localRow("qui", T("2026-09-27T10:00:00.000Z")),
        localRow("comune", T("2026-09-27T12:00:00.000Z")),
        localRow("altrove", T("2026-09-27T10:00:00.000Z")),
      ],
      [cloudRow("altrove", T("2026-09-27T10:00:00.000Z")), cloudRow("comune", T("2026-09-27T12:00:00.000Z")), cloudRow("qui", T("2026-09-27T10:00:00.000Z"))],
      [],
    );
    expect(again).toEqual({ push: [], pull: [], deleteLocal: [], pushDeletes: [] });
  });
});

describe("piano di sincronizzazione — tombe (le cancellazioni non si annullano da sole)", () => {
  const tomb = (project_id: string, deleted_at: string): CloudTombstone => ({ project_id, deleted_at });

  it("un progetto cancellato altrove non viene resuscitato: si cancella qui", () => {
    const plan = planSync(
      [localRow("morto", T("2026-09-27T08:00:00.000Z"))],
      [],
      [tomb("morto", T("2026-09-27T09:00:00.000Z"))],
    );
    expect(plan.deleteLocal).toEqual(["morto"]);
    expect(plan.push).toEqual([]);
  });

  it("una scrittura nello stesso istante della tomba non resuscita: resta morto", () => {
    const plan = planSync([localRow("morto", T("2026-09-27T09:00:00.000Z"))], [], [tomb("morto", T("2026-09-27T09:00:00.000Z"))]);
    expect(plan.deleteLocal).toEqual(["morto"]);
    expect(plan.push).toEqual([]);
  });

  it("una modifica successiva alla cancellazione è una resurrezione lecita", () => {
    const plan = planSync(
      [localRow("rinato", T("2026-09-27T10:00:00.000Z"))],
      [],
      [tomb("rinato", T("2026-09-27T09:00:00.000Z"))],
    );
    expect(plan.push).toEqual(["rinato"]);
    expect(plan.deleteLocal).toEqual([]);
  });

  it("una copia rimasta nel cloud viene eliminata quando la tomba è più recente", () => {
    const plan = planSync([], [cloudRow("morto", T("2026-09-27T08:00:00.000Z"))], [tomb("morto", T("2026-09-27T09:00:00.000Z"))]);
    expect(plan.pushDeletes).toEqual([{ project_id: "morto", deleted_at: "2026-09-27T09:00:00.000Z" }]);
    expect(plan.pull).toEqual([]);
  });

  it("a parità di istante la tomba vince: il progetto resta morto", () => {
    const plan = planSync([], [cloudRow("morto", T("2026-09-27T09:00:00.000Z"))], [tomb("morto", T("2026-09-27T09:00:00.000Z"))]);
    expect(plan.pushDeletes).toHaveLength(1);
    expect(plan.pull).toEqual([]);
  });

  it("una scrittura più recente della tomba riporta il progetto nel browser", () => {
    const plan = planSync([], [cloudRow("vivo", T("2026-09-27T10:00:00.000Z"))], [tomb("vivo", T("2026-09-27T09:00:00.000Z"))]);
    expect(plan.pull).toEqual(["vivo"]);
    expect(plan.pushDeletes).toEqual([]);
  });

  it("una tomba più recente di entrambe le copie cancella su tutti e due gli archivi", () => {
    // È il caso in cui la cancellazione rischia di restare prigioniera: le due
    // copie sono identiche e la tomba dice che il progetto è morto.
    const plan = planSync(
      [localRow("morto", T("2026-09-27T08:00:00.000Z"))],
      [cloudRow("morto", T("2026-09-27T08:00:00.000Z"))],
      [tomb("morto", T("2026-09-27T09:00:00.000Z"))],
    );
    expect(plan.pushDeletes).toEqual([{ project_id: "morto", deleted_at: "2026-09-27T09:00:00.000Z" }]);
    expect(plan.deleteLocal).toEqual(["morto"]);
    expect(plan.push).toEqual([]);
    expect(plan.pull).toEqual([]);
  });

  it("a parità di istante fra copie e tomba la cancellazione vince comunque", () => {
    const plan = planSync(
      [localRow("morto", T("2026-09-27T09:00:00.000Z"))],
      [cloudRow("morto", T("2026-09-27T09:00:00.000Z"))],
      [tomb("morto", T("2026-09-27T09:00:00.000Z"))],
    );
    expect(plan.pushDeletes).toHaveLength(1);
    expect(plan.deleteLocal).toEqual(["morto"]);
  });

  it("una modifica locale dopo la cancellazione salva la copia locale", () => {
    const plan = planSync(
      [localRow("rinato", T("2026-09-27T10:00:00.000Z"))],
      [cloudRow("rinato", T("2026-09-27T08:00:00.000Z"))],
      [tomb("rinato", T("2026-09-27T09:00:00.000Z"))],
    );
    expect(plan.push).toEqual(["rinato"]);
    expect(plan.deleteLocal).toEqual([]);
    expect(plan.pushDeletes).toEqual([]);
  });

  it("una scrittura nel cloud dopo la cancellazione riporta il progetto qui", () => {
    const plan = planSync(
      [localRow("rinato", T("2026-09-27T08:00:00.000Z"))],
      [cloudRow("rinato", T("2026-09-27T10:00:00.000Z"))],
      [tomb("rinato", T("2026-09-27T09:00:00.000Z"))],
    );
    expect(plan.pull).toEqual(["rinato"]);
    expect(plan.deleteLocal).toEqual([]);
    expect(plan.pushDeletes).toEqual([]);
  });

  it("una tomba di un progetto mai visto non fa nulla", () => {
    const plan = planSync([], [], [tomb("fantasma", T("2026-09-27T09:00:00.000Z"))]);
    expect(plan).toEqual({ push: [], pull: [], deleteLocal: [], pushDeletes: [] });
    expect(describePlan(plan)).toBe("tutto già allineato");
  });
});

describe("sommario del piano", () => {
  it("racconta tutte le direzioni del lavoro", () => {
    const note = describePlan({
      push: ["a"],
      pull: ["b", "c"],
      deleteLocal: ["d"],
      pushDeletes: [{ project_id: "e", deleted_at: "2026-09-27T09:00:00.000Z" }],
    });
    expect(note).toBe("1 inviato, 2 scaricati, 1 rimosso qui, 1 cancellazione propagata");
  });

  it("quando non c'è niente da fare lo dice in chiaro", () => {
    expect(describePlan({ push: [], pull: [], deleteLocal: [], pushDeletes: [] })).toBe("tutto già allineato");
  });
});

describe("lotti della busta firmata", () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({ index, body: "x".repeat(100) }));

  it("nessun lotto supera il tetto e nessuna riga si perde", () => {
    const chunks = chunkBySize(rows, jsonSize, 1000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(jsonSize(chunk)).toBeLessThanOrEqual(1000);
    }
    expect(chunks.flat()).toEqual(rows);
  });

  it("una riga sola più grande del tetto non resta senza lotto", () => {
    const big = [{ body: "y".repeat(5000) }];
    const chunks = chunkBySize(big, jsonSize, 1000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(big);
  });

  it("un elenco vuoto non produce lotti", () => {
    expect(chunkBySize([], jsonSize, 1000)).toEqual([]);
  });

  it("un valore non serializzabile pesa zero invece di far fallire il lotto", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(jsonSize(cyclic)).toBe(0);
  });
});
