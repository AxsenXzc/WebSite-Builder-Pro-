/**
 * Piano di sincronizzazione.
 *
 * Funzione pura: confronta ciò che il browser conosce con ciò che il cloud
 * dichiara e decide cosa spingere, cosa tirare e cosa cancellare. La regola è
 * last-write-wins sull'istante `updatedAt` — la stessa che il database applica
 * lato server — così due dispositivi possono sincronizzare in qualunque ordine
 * senza cancellarsi a vicenda il lavoro.
 *
 * Il cloud conserva anche le *tombe* (`tombstones`): l'istante di ogni
 * eliminazione. Servono a distinguere «questo progetto non esiste ancora qui»
 * da «questo progetto è stato cancellato su un altro dispositivo»: senza di
 * esse, una sincronizzazione resusciterebbe i progetti eliminati altrove.
 *
 * Quando una tomba non è più vecchia di nessuna copia viva, la cancellazione
 * vince su entrambi gli archivi: il piano la propaga al cloud e toglie la
 * copia locale. Una riscrittura successiva alla tomba è invece una resurrezione
 * lecita, e il progetto torna a viaggiare nella direzione della copia più
 * recente.
 *
 * Nessun accesso a database o rete: è verificabile nei test, byte per byte.
 */

export type LocalRow = {
  id: string;
  updatedAt: string;
};

export type CloudRow = {
  project_id: string;
  name: string;
  slug: string;
  preset: string;
  updated_at: string;
};

export type CloudTombstone = {
  project_id: string;
  deleted_at: string;
};

export type SyncPlan = {
  /** Progetti locali da spingere verso il cloud. */
  push: string[];
  /** Progetti del cloud da scaricare nel browser. */
  pull: string[];
  /** Progetti locali da cancellare: eliminati altrove dopo l'ultima modifica. */
  deleteLocal: string[];
  /** Eliminazioni da propagare al cloud, con l'istante della tomba. */
  pushDeletes: { project_id: string; deleted_at: string }[];
};

function instant(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Confronto fra l'istante locale e quello del cloud.
 *
 * Ritorna `1` se la copia locale è più recente, `-1` se lo è quella del cloud,
 * `0` se sono la stessa versione. Il caso di parità conta: dopo una spinta il
 * cloud conserva esattamente l'istante del documento locale, quindi trattare
 * il pari come «vince il locale» rispingerebbe tutto a ogni sincronizzazione
 * e il sistema non convergerebbe mai a «niente da fare».
 */
function compareInstants(localUpdatedAt: string, cloudUpdatedAt: string): number {
  const local = instant(localUpdatedAt);
  const cloud = instant(cloudUpdatedAt);
  if (local === cloud) return 0;
  return local > cloud ? 1 : -1;
}

export function planSync(local: LocalRow[], cloud: CloudRow[], tombe: CloudTombstone[]): SyncPlan {
  const plan: SyncPlan = { push: [], pull: [], deleteLocal: [], pushDeletes: [] };

  const localById = new Map(local.map((row) => [row.id, row]));
  const cloudById = new Map(cloud.map((row) => [row.project_id, row]));
  const tombByProject = new Map(tombe.map((row) => [row.project_id, row]));

  /** La tomba ha l'ultima parola quando non è più vecchia di nessuna copia viva. */
  const tombWins = (deletedAt: string, ...writes: string[]): boolean =>
    writes.every((write) => instant(deletedAt) >= instant(write));

  // Cosa dice il cloud: per ogni progetto remoto decidiamo chi ha l'ultima parola.
  for (const row of cloud) {
    const localRow = localById.get(row.project_id);
    const tomb = tombByProject.get(row.project_id);

    if (localRow) {
      // Il progetto esiste da entrambe le parti. Prima di tutto la tomba: se
      // nessuna delle due copie è stata riscritta dopo la cancellazione, il
      // progetto è morto e la cancellazione va propagata al cloud **e** tolta
      // di qui. Senza questo controllo la cancellazione resterebbe prigioniera
      // nei due archivi, ciascuno con la propria copia viva.
      if (tomb && tombWins(tomb.deleted_at, localRow.updatedAt, row.updated_at)) {
        plan.pushDeletes.push({ project_id: row.project_id, deleted_at: tomb.deleted_at });
        plan.deleteLocal.push(row.project_id);
        continue;
      }
      const order = compareInstants(localRow.updatedAt, row.updated_at);
      if (order > 0) plan.push.push(row.project_id);
      else if (order < 0) plan.pull.push(row.project_id);
      // Pari: le due copie sono la stessa versione, non si sposta niente.
      continue;
    }

    // Il progetto non è in questo browser: o è nuovo (creato altrove) o qui è
    // già stato cancellato in una sincronizzazione precedente. La tomba, quando
    // è più recente della copia, dice che la cancellazione ha già vinto.
    if (tomb && instant(tomb.deleted_at) >= instant(row.updated_at)) {
      plan.pushDeletes.push({ project_id: row.project_id, deleted_at: tomb.deleted_at });
    } else {
      plan.pull.push(row.project_id);
    }
  }

  // Cosa dice il browser: i progetti che il cloud non conosce, o spingono o
  // sono morti altrove dopo la loro ultima modifica.
  for (const row of local) {
    if (cloudById.has(row.id)) continue;
    // Simmetrico al caso remoto: a parità di istante la tomba vince, così le
    // due direzioni non possono raccontare storie diverse sullo stesso progetto.
    const tomb = tombByProject.get(row.id);
    if (tomb && instant(tomb.deleted_at) >= instant(row.updatedAt)) {
      plan.deleteLocal.push(row.id);
    } else {
      plan.push.push(row.id);
    }
  }

  return plan;
}

/** «1 inviato», «2 inviati»: il conteggio non deve storpiare la frase. */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Sommario leggibile per la nota dell'interfaccia. */
export function describePlan(plan: SyncPlan): string {
  const parts: string[] = [];
  if (plan.push.length) parts.push(plural(plan.push.length, "inviato", "inviati"));
  if (plan.pull.length) parts.push(plural(plan.pull.length, "scaricato", "scaricati"));
  if (plan.deleteLocal.length) parts.push(plural(plan.deleteLocal.length, "rimosso qui", "rimossi qui"));
  if (plan.pushDeletes.length) parts.push(plural(plan.pushDeletes.length, "cancellazione propagata", "cancellazioni propagate"));
  return parts.length ? parts.join(", ") : "tutto già allineato";
}
