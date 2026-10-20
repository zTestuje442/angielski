import { useState } from "react";
import { FORM_ID, type ExerciseProps } from "./parts.tsx";

export function Cloze({ exercise, answered, onSubmit, onReady }: ExerciseProps) {
  const [value, setValue] = useState("");
  const [before, rest] = exercise.prompt.split("___");
  // Interpunkcja tuż po luce zostaje z polem w jednej linii.
  const [, glued, after] = rest.match(/^([.,!?;:]*)([\s\S]*)$/) ?? ["", "", rest];
  return (
    <form id={FORM_ID} onSubmit={e => { e.preventDefault(); if (value.trim()) onSubmit({ type: "text", value }); }}>
      <p className="sentence">
        {before}
        <span className="nowrap">
          <input className="gap" aria-label="Luka" value={value} readOnly={answered} autoFocus autoComplete="off"
            autoCapitalize="off" spellCheck={false} style={{ width: `${Math.max(6, value.length + 2)}ch` }}
            onChange={e => { setValue(e.target.value); onReady(e.target.value.trim() !== ""); }} />
          {glued}
        </span>
        {after}
      </p>
    </form>
  );
}
