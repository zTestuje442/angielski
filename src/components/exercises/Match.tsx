// Łączenie par: wybierz element z lewej, potem z prawej. Ponowny wybór zmienia parę.
import { useState } from "react";
import { splitPair } from "../../lib/check.ts";
import { shuffle } from "../../lib/shuffle.ts";
import { FORM_ID, type ExerciseProps } from "./parts.tsx";

export function Match({ exercise, answered, onSubmit, onReady }: ExerciseProps) {
  const pairs = (exercise.answer as string[]).map(splitPair);
  const left = pairs.map(([l]) => l);
  const [right] = useState(() => shuffle(pairs.map(([, r]) => r)));
  const [active, setActive] = useState<string | null>(left[0]);
  const [given, setGiven] = useState<Record<string, string>>({});

  const pairNo = (l: string) => left.indexOf(l) + 1;
  const leftOf = (r: string) => Object.keys(given).find(l => given[l] === r);

  const pick = (r: string) => {
    if (answered || !active) return;
    const next = Object.fromEntries(Object.entries(given).filter(([, v]) => v !== r));
    next[active] = r;
    setGiven(next);
    onReady(Object.keys(next).length === left.length);
    setActive(left.find(l => !next[l]) ?? null);
  };

  return (
    <form id={FORM_ID} onSubmit={e => { e.preventDefault(); onSubmit({ type: "match", value: given }); }}>
      <p className="prompt-note">{exercise.prompt}</p>
      <div className="match">
        <ul aria-label="Lewa kolumna">
          {left.map(l => (
            <li key={l}>
              <button type="button" className="match-item" aria-pressed={active === l} disabled={answered} onClick={() => setActive(l)}>
                {given[l] && <span className="pair-no">{pairNo(l)}</span>}{l}
              </button>
            </li>
          ))}
        </ul>
        <ul aria-label="Prawa kolumna">
          {right.map(r => {
            const l = leftOf(r);
            return (
              <li key={r}>
                <button type="button" className="match-item" disabled={answered} onClick={() => pick(r)}>
                  {l && <span className="pair-no">{pairNo(l)}</span>}{r}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </form>
  );
}
