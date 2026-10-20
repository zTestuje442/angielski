import type { Given } from "../../lib/check.ts";
import type { Exercise } from "../../types.ts";

/** Formularz zadania; przycisk „Sprawdź” w dolnym pasku jest z nim powiązany atrybutem form. */
export const FORM_ID = "exercise-form";

export interface ExerciseProps {
  exercise: Exercise;
  answered: boolean;
  onSubmit: (given: Given) => void;
  onReady: (ready: boolean) => void;   // czy da się już sprawdzić odpowiedź; wołane w obsłudze zdarzeń, nie w efekcie
}

/** Polecenie z treści: wszystkie linie poza ostatnią to dopiski, ostatnia to zdanie. */
export function PromptLines({ prompt }: { prompt: string }) {
  const lines = prompt.split("\n");
  return (
    <>
      {lines.slice(0, -1).map((l, i) => <p key={i} className="prompt-note">{l}</p>)}
      <p className="sentence">{lines[lines.length - 1]}</p>
    </>
  );
}
