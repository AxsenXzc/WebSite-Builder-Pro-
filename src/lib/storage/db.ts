import Dexie, { type Table } from "dexie";
import type { Site } from "@/lib/schema/site";

/**
 * Persistenza locale.
 *
 * Il progetto vive in IndexedDB: nessun account, nessun server, nessuna
 * configurazione. Il cloud (Supabase) è un adapter opzionale che si aggiunge
 * dopo, senza cambiare questa interfaccia.
 */

export type SiteRecord = {
  id: string;
  name: string;
  slug: string;
  sector: string;
  preset: string;
  provider?: string;
  structuralHash: string;
  createdAt: string;
  updatedAt: string;
  /** Workspace a cui appartiene il progetto: `provider:id` dell'utente. */
  owner: string;
  site: Site;
};

export type VersionRecord = {
  id?: number;
  siteId: string;
  label: string;
  createdAt: string;
  site: Site;
};

export type SettingRecord = { key: string; value: string };

export type GenerationRunRecord = {
  id?: number;
  createdAt: string;
  siteId: string;
  provider?: string;
  elapsedMs: number;
  warnings: string[];
};

class AtelierDatabase extends Dexie {
  sites!: Table<SiteRecord, string>;
  versions!: Table<VersionRecord, number>;
  settings!: Table<SettingRecord, string>;
  runs!: Table<GenerationRunRecord, number>;

  constructor() {
    super("atelier");
    this.version(1).stores({
      sites: "id, updatedAt, slug, name, sector",
      versions: "++id, siteId, createdAt",
      settings: "key",
      runs: "++id, siteId, createdAt",
    });

    // v2 — i progetti appartengono a un workspace (`owner`). I record creati
    // prima dell'accesso restano visibili alla sessione locale: non si perde
    // niente e nessuno si ritrova un archivio vuoto.
    this.version(2)
      .stores({
        sites: "id, updatedAt, owner, slug, name, sector",
        versions: "++id, siteId, createdAt",
        settings: "key",
        runs: "++id, siteId, createdAt",
      })
      .upgrade((tx) =>
        tx
          .table<SiteRecord, string>("sites")
          .toCollection()
          .modify((record) => {
            if (!record.owner) record.owner = "local:ospite";
          }),
      );
  }
}

let instance: AtelierDatabase | null = null;

/** IndexedDB non esiste sul server: qui lo diciamo chiaramente invece di romperci. */
export function hasLocalDatabase(): boolean {
  return typeof indexedDB !== "undefined";
}

export function getDb(): AtelierDatabase {
  if (!hasLocalDatabase()) {
    throw new Error("Il database locale non è disponibile in questo contesto (serve il browser).");
  }
  if (!instance) instance = new AtelierDatabase();
  return instance;
}
