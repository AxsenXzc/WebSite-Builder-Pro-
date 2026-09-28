import type { Site } from "@/lib/schema/site";
import { callRpc } from "./sign";
import type { CloudConfig } from "./config";
import type { CloudRow, CloudTombstone } from "@/lib/storage/sync-plan";

/**
 * Operazioni verso l'archivio cloud, lato server.
 *
 * Ogni funzione parla con `atelier_cloud_entry`, la RPC che verifica la firma
 * HMAC e inoltra all'operazione richiesta. L'owner arriva sempre dal chiamante
 * (che l'ha derivato dalla sessione): nessun dato di percorso è deciso qui.
 */

type EntryResult<T> = { ok: true; rows: T } | { ok: false; status: number; message: string };

async function entry<T>(config: CloudConfig, args: Record<string, unknown>): Promise<EntryResult<T>> {
  const result = await callRpc<{ rows?: T }>(config, "atelier_cloud_entry", args);
  if (!result.ok) return { ok: false, status: result.status, message: result.message };
  return { ok: true, rows: (result.data?.rows ?? ([] as unknown)) as T };
}

export async function cloudList(config: CloudConfig, owner: string, tsHead: string | null): Promise<EntryResult<CloudRow[]>> {
  return entry<CloudRow[]>(config, { op: "list", owner, ts_head: tsHead });
}

export async function cloudSites(
  config: CloudConfig,
  owner: string,
  ids: string[],
): Promise<EntryResult<{ project_id: string; site: unknown; updated_at: string }[]>> {
  return entry<{ project_id: string; site: unknown; updated_at: string }[]>(config, { op: "sites", owner, ids });
}

export type CloudPushRow = {
  project_id: string;
  name: string;
  slug: string;
  preset: string;
  site: Site;
  updated_at: string;
};

export async function cloudUpserts(config: CloudConfig, owner: string, rows: CloudPushRow[]): Promise<EntryResult<unknown>> {
  return entry<unknown>(config, { op: "upserts", owner, rows });
}

export async function cloudDeletes(
  config: CloudConfig,
  owner: string,
  rows: { project_id: string; deleted_at: string }[],
): Promise<EntryResult<unknown>> {
  return entry<unknown>(config, { op: "deletes", owner, rows });
}

export async function cloudTombstones(config: CloudConfig, owner: string): Promise<EntryResult<CloudTombstone[]>> {
  return entry<CloudTombstone[]>(config, { op: "tombstones", owner });
}

export type CloudStats = { owners: number; projects: number; newest: string | null };

export async function cloudStats(config: CloudConfig): Promise<EntryResult<CloudStats[]>> {
  return entry<CloudStats[]>(config, { op: "stats" });
}
