import { motion } from "motion/react";
import { useEffect, useState, type CSSProperties } from "react";
import { hasContent, hasWritingTask, linksFor } from "../../content.ts";
import { isLinkDone, isSetPassed, isTopicDone, type Progress } from "../../lib/progress.ts";
import type { Topic } from "../../types.ts";
import { Markdown } from "../Markdown.tsx";
import { Sign } from "./Sign.tsx";

const MIN_PER_SET = 5;

interface Props {
  path: Topic[];
  progress: Progress;
  today: Topic | undefined;
  markerAt: string | undefined;
  justDone: string | undefined;
  onStart: (topic: Topic, setId: string) => void;
  onWriting: (topic: Topic) => void;
  onLink: (url: string, done: boolean) => void;
}

export function Trail({ path, progress, today, markerAt, justDone, onStart, onWriting, onLink }: Props) {
  // Naraz otwarty jest jeden panel. Dopóki użytkownik nic nie kliknie, jest to panel „dziś”
  // (także gdy „dziś” zmieni się po synchronizacji).
  const [choice, setChoice] = useState<{ id: string | undefined } | null>(null);
  const opened = choice ? choice.id : today?.id;

  // Po otwarciu tematu kliknięciem przewiń tak, żeby był widoczny: zwinięcie panelu powyżej
  // (np. z rozwiniętym wyjaśnieniem) przesuwa całą ścieżkę w górę.
  useEffect(() => {
    if (!choice?.id) return;
    const el = document.querySelector<HTMLElement>(`[data-topic="${choice.id}"]`);
    if (!el) return;
    const { top, bottom } = el.getBoundingClientRect();
    if (top >= 0 && bottom <= window.innerHeight) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
  }, [choice]);

  return (
    <ol className="trail" style={{ "--lvl": `var(--${path[0]?.level})` } as CSSProperties}>
      {path.map((t, i) => {
        const done = isTopicDone(progress, t);
        const isToday = t.id === today?.id;
        const isOpen = t.id === opened;
        const toggle = () => setChoice({ id: isOpen ? undefined : t.id });
        const last = i === path.length - 1;
        return (
          <li key={t.id} className={done ? "done" : isToday ? "today" : "ahead"} data-topic={t.id}>
            <span className="marker">
              {markerAt === t.id && <motion.span className="here-ring" layoutId="here-ring" transition={{ duration: 0.6, ease: [0, 0, 0.3, 1] }} />}
              <Sign level={t.level} size={isToday ? "l" : "m"} />
            </span>
            {!last && <Segment walked={done} />}
            {isToday ? (
              <div className="signpost" aria-current="step">
                <div>
                  <Sign level={t.level} />
                  <h2>
                    <button type="button" className="signpost-btn" aria-expanded={isOpen} onClick={toggle}>{t.title}</button>
                  </h2>
                  <span className="time">ok. {t.sets.filter(s => !isSetPassed(progress, s)).length * MIN_PER_SET} min</span>
                </div>
              </div>
            ) : (
              <button type="button" className="node-title" aria-expanded={isOpen} onClick={toggle}>
                <span>
                  {t.title}
                  {done && <DoneIcon draw={t.id === justDone} />}
                </span>
              </button>
            )}
            {isOpen && <TopicPanel topic={t} progress={progress} onStart={onStart} onWriting={onWriting} onLink={onLink} />}
          </li>
        );
      })}
    </ol>
  );
}

function TopicPanel({ topic, progress, onStart, onWriting, onLink }:
  { topic: Topic; progress: Progress; onStart: Props["onStart"]; onWriting: Props["onWriting"]; onLink: Props["onLink"] }) {
  const openTask = hasWritingTask(topic) &&
    <button className="btn quiet" type="button" onClick={() => onWriting(topic)}>Zadanie otwarte</button>;
  if (!hasContent(topic)) return <><p className="panel-note">Ćwiczenia do tego tematu są w przygotowaniu.</p>{openTask}</>;
  const next = topic.sets.find(s => !isSetPassed(progress, s)) ?? topic.sets[0];
  return (
    <div className="topic-panel">
      <ul className="sets" aria-label="Zestawy">
        {topic.sets.map((s, i) => {
          const result = progress.sets[s];
          const passed = isSetPassed(progress, s);
          return (
            <li key={s}>
              <button type="button" className="set-btn" onClick={() => onStart(topic, s)} data-set={s}>
                <span className={passed ? "dot on" : "dot"} aria-hidden="true" />
                Zestaw {i + 1}
                {result && <span className="score">{result.bestScore}%</span>}
                <span className="visually-hidden">{passed ? ", zaliczony" : ", niezaliczony"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {topic.explanation && (
        <details className="explanation">
          <summary>Wyjaśnienie</summary>
          <Markdown text={topic.explanation} />
        </details>
      )}
      <ExtraLinks topic={topic} progress={progress} onLink={onLink} />
      <div className="panel-actions">
        <button className="btn" type="button" onClick={() => onStart(topic, next)}>
          {isSetPassed(progress, next) ? "Powtórz zestaw 1" : `Zacznij zestaw ${topic.sets.indexOf(next) + 1}`}
        </button>
        {openTask}
      </div>
    </div>
  );
}

/** „Dodatkowo”: lekcje z innych serwisów, otwierane w nowej karcie, z własnym checkboxem „zrobione”. */
function ExtraLinks({ topic, progress, onLink }: { topic: Topic; progress: Progress; onLink: Props["onLink"] }) {
  const links = linksFor(topic);
  if (!links.length) return null;
  return (
    <section className="extra" aria-labelledby={`extra-${topic.id}`}>
      <h3 id={`extra-${topic.id}`}>Dodatkowo</h3>
      <ul>
        {links.map(l => (
          <li key={l.url}>
            <input type="checkbox" checked={isLinkDone(progress, l.url)} aria-label={`${l.title} (${l.source}): zrobione`}
              onChange={e => onLink(l.url, e.target.checked)} />
            <a href={l.url} target="_blank" rel="noopener noreferrer">{l.title}</a>
            <span className="extra-source">{l.source}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Segment({ walked }: { walked: boolean }) {
  return (
    <svg className={walked ? "seg walked" : "seg"} aria-hidden="true">
      {walked && <line className="casing" x1="6" y1="0" x2="6" y2="100%" />}
      <line className="fill" x1="6" y1="0" x2="6" y2="100%" />
    </svg>
  );
}

function DoneIcon({ draw }: { draw: boolean }) {
  return (
    <svg className="done-icon" viewBox="0 0 18 18" role="img" aria-label="zrobione">
      <motion.path d="M3.5 9.5l3.5 3.5 7.5-8" initial={{ pathLength: draw ? 0 : 1 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }} />
    </svg>
  );
}
