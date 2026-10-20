// Przebieg zestawu (lub powtórek): błędne zadania wracają na koniec, wynik liczony z pierwszej próby.
import { motion } from "motion/react";
import { useState } from "react";
import { PASS_SCORE } from "../../lib/progress.ts";
import type { Level, PlayableExercise } from "../../types.ts";
import { Sign } from "../path/Sign.tsx";
import { ExerciseView } from "./ExerciseView.tsx";

interface Props {
  mode: "set" | "reviews";
  title: string;
  level?: Level;
  exercises: PlayableExercise[];
  onFirstTry: (exerciseId: string, correct: boolean) => void;
  onFinish: (score: number) => void;
  onRestart: () => void;
  onExit: () => void;
}

export function Session({ mode, title, level, exercises, onFirstTry, onFinish, onRestart, onExit }: Props) {
  const [queue, setQueue] = useState(exercises);
  const [pos, setPos] = useState(0);
  const [first, setFirst] = useState<Record<string, boolean>>({});
  const [solved, setSolved] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const current = queue[pos];

  const answered = (ok: boolean) => {
    if (!(current.id in first)) {
      setFirst(f => ({ ...f, [current.id]: ok }));
      onFirstTry(current.id, ok);
    }
    if (ok) setSolved(s => [...s, current.id]);
    else setQueue(q => [...q, current]);
  };

  const next = () => {
    if (pos + 1 < queue.length) return setPos(pos + 1);
    const s = Math.round((exercises.filter(e => first[e.id]).length / exercises.length) * 100);
    setScore(s);
    onFinish(s);
  };

  return (
    <div className="session">
      <header className="ex-head">
        <button className="link-btn" type="button" onClick={onExit}>{score === null ? "Zakończ" : "Wróć do ścieżki"}</button>
        <span className="where">{level && <Sign level={level} size="s" />}{title}</span>
        <span className="counter">
          {score === null && (pos >= exercises.length ? "Powtórka: " : "")}
          {score === null && `Pytanie ${exercises.findIndex(e => e.id === current.id) + 1} z ${exercises.length}`}
        </span>
      </header>
      <div className="dashes" aria-hidden="true">
        {exercises.map(e => {
          const now = score === null && e.id === current.id;
          const state = solved.includes(e.id) ? (first[e.id] ? "ok" : "fixed") : first[e.id] === false ? "bad" : "";
          return (
            <span key={e.id} className={`dash ${state}${now ? " now" : ""}`}>
              {solved.includes(e.id) && <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.3 }} />}
            </span>
          );
        })}
      </div>
      {score === null
        ? <ExerciseView key={pos} exercise={current} onAnswered={answered} onNext={next}
            retryNote={mode === "set" ? "Zadanie wróci na koniec zestawu i do powtórek." : "Zadanie wróci na koniec i zostaje w powtórkach."} />
        : <Summary mode={mode} score={score} total={exercises.length} firstOk={exercises.filter(e => first[e.id]).length}
            onRestart={onRestart} onExit={onExit} />}
    </div>
  );
}

function Summary({ mode, score, total, firstOk, onRestart, onExit }:
  { mode: Props["mode"]; score: number; total: number; firstOk: number; onRestart: () => void; onExit: () => void }) {
  const passed = score >= PASS_SCORE;
  return (
    <div className="summary" role="status">
      {mode === "set" ? (
        <>
          <h1>Wynik: {score}%</h1>
          <p>{passed ? "Zestaw zaliczony." : `Do zaliczenia potrzeba ${PASS_SCORE}%. Spróbuj jeszcze raz.`}</p>
        </>
      ) : (
        <>
          <h1>Powtórki zrobione</h1>
          <p>Poprawnie za pierwszym razem: {firstOk} z {total}. Pozostałe zostają w powtórkach.</p>
        </>
      )}
      <div className="ex-actions">
        <button className="btn" type="button" autoFocus onClick={onExit}>Wróć do ścieżki</button>
        {mode === "set" && <button className="btn quiet" type="button" onClick={onRestart}>Powtórz zestaw</button>}
      </div>
    </div>
  );
}
