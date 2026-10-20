// Kliknij błędne słowo, potem wpisz poprawkę.
import { useState } from "react";
import { bareWord, tokenize } from "../../lib/check.ts";
import { FORM_ID, type ExerciseProps } from "./parts.tsx";

export function ErrorSpot({ exercise, answered, onSubmit, onReady }: ExerciseProps) {
  const tokens = tokenize(exercise.prompt);
  const [picked, setPicked] = useState<number | null>(null);
  const [value, setValue] = useState("");

  return (
    <form id={FORM_ID} onSubmit={e => {
      e.preventDefault();
      if (picked !== null && value.trim()) onSubmit({ type: "error", word: bareWord(tokens[picked]), correction: value });
    }}>
      <p className="sentence tokens">
        {tokens.map((t, i) => (
          <button key={i} type="button" className="token" aria-pressed={picked === i} disabled={answered}
            onClick={() => { setPicked(i); onReady(value.trim() !== ""); }}>{t}</button>
        ))}
      </p>
      {picked !== null && (
        <label className="correction">
          Poprawka dla „{bareWord(tokens[picked])}”:
          <input className="free-input" value={value} readOnly={answered} autoFocus autoComplete="off" spellCheck={false}
            onChange={e => { setValue(e.target.value); onReady(e.target.value.trim() !== ""); }} />
        </label>
      )}
    </form>
  );
}
