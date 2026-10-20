// Synchronizacja postępu przez Supabase (funkcje get_progress / save_progress, patrz docs/supabase.sql).
// Bez logowania: losowy kod (UUID) w localStorage. Kod idzie tylko w treści żądania, nigdy w URL-u.
import { mergeProgress, parseProgress, type Progress } from "./progress.ts";

export interface SyncConfig {
  url: string;      // VITE_SUPABASE_URL
  anonKey: string;  // VITE_SUPABASE_ANON_KEY
}

const KEY = "szlak.syncKey";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSyncKey = (s: string) => UUID.test(s.trim());

/** Kod tego komputera; tworzony przy pierwszym uruchomieniu. */
export function getSyncKey(storage: Storage): string {
  const existing = storage.getItem(KEY);
  if (existing && isSyncKey(existing)) return existing;
  const key = crypto.randomUUID();
  storage.setItem(KEY, key);
  return key;
}

export function setSyncKey(storage: Storage, key: string): void {
  if (!isSyncKey(key)) throw new Error("Nieprawidłowy kod");
  storage.setItem(KEY, key.trim().toLowerCase());
}

async function rpc(cfg: SyncConfig, fn: string, body: object, fetchFn: typeof fetch): Promise<unknown> {
  const headers: Record<string, string> = { apikey: cfg.anonKey, "Content-Type": "application/json" };
  // Klucz anon w starym formacie (JWT) idzie też jako Bearer; nowy klucz „publishable” wystarcza w apikey.
  if (cfg.anonKey.startsWith("eyJ")) headers.Authorization = `Bearer ${cfg.anonKey}`;
  // Panel Supabase podaje URL projektu albo „API URL” z /rest/v1 — oba działają.
  const base = cfg.url.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const res = await fetchFn(`${base}/rest/v1/rpc/${fn}`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${fn}: HTTP ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Pobiera postęp z Supabase, łączy z lokalnym i zapisuje wynik. Zwraca połączony postęp. */
export async function syncProgress(cfg: SyncConfig, key: string, local: Progress, fetchFn: typeof fetch = fetch): Promise<Progress> {
  const remote = parseProgress(await rpc(cfg, "get_progress", { k: key }, fetchFn));
  const merged = mergeProgress(local, remote);
  await rpc(cfg, "save_progress", { k: key, d: merged }, fetchFn);
  return merged;
}
