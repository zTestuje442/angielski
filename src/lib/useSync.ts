// Kiedy synchronizować: przy starcie, po każdej zmianie postępu (z opóźnieniem) i po powrocie do karty.
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { mergeProgress, type Progress } from "./progress.ts";
import { getSyncKey, setSyncKey, syncProgress, type SyncConfig } from "./sync.ts";

const env = import.meta.env;
const config: SyncConfig | null = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
  ? { url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY }
  : null;

const DELAY_MS = 1500;

export type SyncStatus =
  | { state: "off" }                  // brak konfiguracji w .env
  | { state: "idle" }
  | { state: "syncing" }
  | { state: "ok"; at: Date }
  | { state: "error"; message: string };

export function useSync(progress: Progress, setProgress: Dispatch<SetStateAction<Progress>>) {
  const [status, setStatus] = useState<SyncStatus>(config ? { state: "idle" } : { state: "off" });
  const [key, setKey] = useState(() => getSyncKey(localStorage));
  const latest = useRef(progress);
  const keyRef = useRef(key);
  const synced = useRef<string | null>(null);  // JSON postępu po ostatniej udanej synchronizacji
  const busy = useRef(false);
  const again = useRef(false);

  const sync = useCallback(async () => {
    if (!config) return;
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    do {
      again.current = false;
      setStatus({ state: "syncing" });
      try {
        const merged = await syncProgress(config, keyRef.current, latest.current);
        synced.current = JSON.stringify(mergeProgress(latest.current, merged));
        setProgress(p => mergeProgress(p, merged));
        setStatus({ state: "ok", at: new Date() });
      } catch (e) {
        setStatus({ state: "error", message: e instanceof Error ? e.message : String(e) });
      }
    } while (again.current);  // ktoś poprosił o synchronizację w trakcie — powtórz z nowym stanem
    busy.current = false;
  }, [setProgress]);

  useEffect(() => {
    latest.current = progress;
    if (!config || JSON.stringify(progress) === synced.current) return;
    const timer = setTimeout(() => void sync(), synced.current === null ? 0 : DELAY_MS);
    return () => clearTimeout(timer);
  }, [progress, sync]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void sync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [sync]);

  /** Przełącza na kod z innego komputera i od razu łączy postęp. Rzuca błąd przy złym formacie. */
  const connect = useCallback((code: string) => {
    setSyncKey(localStorage, code);
    keyRef.current = getSyncKey(localStorage);
    setKey(keyRef.current);
    void sync();
  }, [sync]);

  return { status, key, connect, enabled: config !== null };
}
