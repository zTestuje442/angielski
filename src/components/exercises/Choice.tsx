import { useEffect, useState } from "react";
import { matchesText } from "../../lib/check.ts";
import { shuffle } from "../../lib/shuffle.ts";
import { PromptLines, type ExerciseProps } from "./parts.tsx";

// Pytania prawda/fałsz/brak informacji mają stałą kolejność opcji; pozostałe są tasowane.
const TRUE_FALSE = ["True", "False", "Not given"];
const ordered = (opts: string[]) =>
  opts.every(o => TRUE_FALSE.includes(o)) ? TRUE_FALSE.filter(o => opts.includes(o)) : shuffle(opts);

export function Choice({ exercise, answered, onSubmit }: ExerciseProps) {
  const [options] = useState(() => ordered([exercise.answer as string, ...(exercise.distractors ?? [])]));
  const [chosen, setChosen] = useState<string | null>(null);

  const choose = (o: string) => {
    if (answered) return;
    setChosen(o);
    onSubmit({ type: "text", value: o });
  };

  // Skróty klawiszowe 1–4.
  useEffect(() => {
    if (answered) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= options.length && !e.ctrlKey && !e.altKey && !e.metaKey) choose(options[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <PromptLines prompt={exercise.prompt} />
      <div className="options">
        {options.map((o, i) => {
          const isRight = answered && matchesText(o, exercise.answer as string);
          const isWrong = answered && o === chosen && !isRight;
          return (
            <button key={o} type="button" className={`option${isRight ? " is-ok" : ""}${isWrong ? " is-bad" : ""}`}
              aria-disabled={answered} onClick={() => choose(o)}>
              <kbd>{i + 1}</kbd>{o}
            </button>
          );
        })}
      </div>
    </>
  );
}
