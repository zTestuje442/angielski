// transform i translate: zdanie wejściowe + pole na całe zdanie.
import { useState } from "react";
import { FORM_ID, PromptLines, type ExerciseProps } from "./parts.tsx";

export function FreeText({ exercise, answered, onSubmit, onReady }: ExerciseProps) {
  const [value, setValue] = useState("");
  return (
    <form id={FORM_ID} onSubmit={e => { e.preventDefault(); if (value.trim()) onSubmit({ type: "text", value }); }}>
      <PromptLines prompt={exercise.prompt} />
      <input className="free-input" aria-label="Twoja odpowiedź" value={value} readOnly={answered} autoFocus
        autoComplete="off" spellCheck={false} onChange={e => { setValue(e.target.value); onReady(e.target.value.trim() !== ""); }} />
    </form>
  );
}
