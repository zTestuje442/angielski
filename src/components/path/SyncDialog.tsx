import { useRef, useState } from "react";
import { isSyncKey } from "../../lib/sync.ts";
import type { SyncStatus } from "../../lib/useSync.ts";

export interface SyncProps {
  status: SyncStatus;
  key: string;
  enabled: boolean;
  connect: (code: string) => void;
}

function statusText(s: SyncStatus): string {
  switch (s.state) {
    case "off": return "Synchronizacja nie jest skonfigurowana: brak VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY w pliku .env. Postęp zapisuje się tylko na tym komputerze.";
    case "idle": return "Czekam na pierwszą synchronizację.";
    case "syncing": return "Synchronizuję…";
    case "ok": return `Zsynchronizowano o ${s.at.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}.`;
    case "error": return `Nie udało się zsynchronizować (${s.message}). Postęp jest zapisany na tym komputerze i wyśle się przy następnej próbie.`;
  }
}

export function SyncButton({ sync }: { sync: SyncProps }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button className="link-btn" type="button" onClick={() => dialog.current?.showModal()}>
        Synchronizacja{sync.status.state === "error" ? " (błąd)" : ""}
      </button>
      <dialog ref={dialog} className="sync-dialog" aria-labelledby="sync-title">
        <SyncPanel sync={sync} onClose={() => dialog.current?.close()} />
      </dialog>
    </>
  );
}

function SyncPanel({ sync, onClose }: { sync: SyncProps; onClose: () => void }) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = () => {
    if (!isSyncKey(code)) {
      setMessage({ ok: false, text: "To nie jest poprawny kod. Ma postać xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx." });
      return;
    }
    sync.connect(code);
    setCode("");
    setMessage({ ok: true, text: "Połączono. Postęp z tego komputera dołączy do wspólnego." });
  };

  return (
    <div className="sync-panel">
      <h2 id="sync-title">Synchronizacja</h2>
      <p role="status" className="sync-status">{statusText(sync.status)}</p>
      {sync.enabled && (
        <>
          <section>
            <h3>Kod tego komputera</h3>
            {showKey ? (
              <p className="sync-key">
                <code>{sync.key}</code>
                <button className="btn quiet" type="button" onClick={async () => {
                  await navigator.clipboard.writeText(sync.key);
                  setCopied(true);
                }}>{copied ? "Skopiowano" : "Kopiuj"}</button>
              </p>
            ) : (
              <button className="btn quiet" type="button" onClick={() => setShowKey(true)}>Pokaż kod synchronizacji</button>
            )}
            <p className="muted">Wpisz ten kod na drugim komputerze. Kod działa jak hasło do Twojego postępu.</p>
          </section>
          <form onSubmit={e => { e.preventDefault(); submit(); }}>
            <h3>Wpisz kod z innego komputera</h3>
            <div className="sync-connect">
              <input className="free-input" aria-label="Kod synchronizacji" value={code} autoComplete="off" spellCheck={false}
                onChange={e => { setCode(e.target.value); setMessage(null); }} />
              <button className="btn" type="submit" disabled={!code.trim()}>Połącz</button>
            </div>
            {message && <p className={message.ok ? "sync-msg" : "sync-msg is-bad"}>{message.text}</p>}
          </form>
        </>
      )}
      <button className="link-btn" type="button" onClick={onClose}>Zamknij</button>
    </div>
  );
}
