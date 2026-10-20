// Zadanie otwarte Writing: własny tekst, lista do samosprawdzenia, tekst wzorcowy i „Sprawdź z Claude”.
import { useEffect, useState } from "react";
import { countWords, reviewPrompt } from "../../lib/claudePrompt.ts";
import type { Topic, WritingTask } from "../../types.ts";
import { Markdown } from "../Markdown.tsx";
import { Sign } from "../path/Sign.tsx";

const draftKey = (topicId: string) => `szlak.writing.${topicId}`;

function readDraft(topicId: string): string {
  try { return localStorage.getItem(draftKey(topicId)) ?? ""; } catch { return ""; }
}

/** 1 słowo, 2–4 słowa, 5+ słów (ale 22–24 słowa). */
function wordsPl(n: number): string {
  const d = n % 10, t = n % 100;
  return n === 1 ? "słowo" : d >= 2 && d <= 4 && (t < 12 || t > 14) ? "słowa" : "słów";
}

export function WritingScreen({ topic, task, onExit }: { topic: Topic; task: WritingTask; onExit: () => void }) {
  const [text, setText] = useState(() => readDraft(topic.id));
  const [checked, setChecked] = useState<boolean[]>(() => task.checklist.map(() => false));
  const [showModel, setShowModel] = useState(false);
  const [copied, setCopied] = useState(false);
  const n = countWords(text);
  const [min, max] = task.words;

  useEffect(() => {
    try { localStorage.setItem(draftKey(topic.id), text); } catch { /* szkic zostaje w pamięci */ }
  }, [text, topic.id]);

  const copy = async () => {
    await navigator.clipboard.writeText(reviewPrompt(task, topic.level, text));
    setCopied(true);
  };

  return (
    <div className="session">
      <header className="ex-head">
        <button className="link-btn" type="button" onClick={onExit}>Wróć do ścieżki</button>
        <span className="where"><Sign level={topic.level} size="s" />{topic.title} · zadanie otwarte</span>
        <span />
      </header>
      <main className="writing">
        <section className="writing-task">
          <Markdown text={task.task} />
        </section>
        <label className="writing-label" htmlFor="writing-text">Twój tekst</label>
        <textarea id="writing-text" className="free-input writing-text" value={text} rows={12} spellCheck lang="en"
          onChange={e => { setText(e.target.value); setCopied(false); }} />
        <p className={`word-count${n >= min && n <= max ? " in-range" : ""}`} aria-live="polite">
          {n} {wordsPl(n)} · zalecane {min}–{max}
        </p>

        <fieldset className="checklist">
          <legend>Sprawdź sam, zanim wyślesz</legend>
          {task.checklist.map((c, i) => (
            <label key={i}>
              <input type="checkbox" checked={checked[i]}
                onChange={() => setChecked(checked.map((v, j) => (j === i ? !v : v)))} />
              {c}
            </label>
          ))}
        </fieldset>

        <div className="writing-actions">
          <button className="btn" type="button" disabled={!text.trim()} onClick={copy}>
            {copied ? "Skopiowano" : "Sprawdź z Claude"}
          </button>
          <p className="kbd-note">
            {copied
              ? <>Wklej polecenie w nowym czacie: <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">otwórz claude.ai</a>.</>
              : "Kopiuje do schowka gotowe polecenie z Twoim tekstem."}
          </p>
        </div>

        <button className="link-btn" type="button" aria-expanded={showModel} onClick={() => setShowModel(!showModel)}>
          {showModel ? "Ukryj tekst wzorcowy" : "Pokaż tekst wzorcowy"}
        </button>
        {showModel && (
          <article className="writing-model" aria-label="Tekst wzorcowy" lang="en">
            {task.model.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para.split("\n").flatMap((line, j) => (j ? [<br key={j} />, line] : [line]))}</p>
            ))}
          </article>
        )}
      </main>
    </div>
  );
}
