import { motion } from "motion/react";
import { useState, type ComponentType, type ReactNode } from "react";
import { checkAnswer, correctAnswerText, type Given } from "../../lib/check.ts";
import type { ExerciseType, PlayableExercise } from "../../types.ts";
import { Choice } from "./Choice.tsx";
import { Cloze } from "./Cloze.tsx";
import { ErrorSpot } from "./ErrorSpot.tsx";
import { FreeText } from "./FreeText.tsx";
import { Match } from "./Match.tsx";
import { FORM_ID, type ExerciseProps } from "./parts.tsx";
import { Tiles } from "./Tiles.tsx";

const VIEWS: Record<ExerciseType, ComponentType<ExerciseProps>> = {
  cloze: Cloze, tiles: Tiles, choice: Choice, match: Match, error: ErrorSpot, transform: FreeText, translate: FreeText,
};

const INSTRUCTIONS: Record<ExerciseType, string> = {
  cloze: "Uzupełnij lukę.",
  tiles: "Ułóż kafelki we właściwej kolejności.",
  choice: "Wybierz poprawną odpowiedź.",
  match: "Połącz w pary.",
  error: "Kliknij błędne słowo i wpisz poprawkę.",
  transform: "Przekształć zdanie.",
  translate: "Przetłumacz na angielski.",
};

const ENTER = <><kbd>Enter</kbd> sprawdza</>;
const KEYS: Record<ExerciseType, ReactNode> = {
  cloze: ENTER, transform: ENTER, translate: ENTER, error: ENTER,
  tiles: <>W zdaniu: <kbd>Spacja</kbd> i strzałki przesuwają kafelek, <kbd>Backspace</kbd> go odkłada</>,
  choice: <>Klawisze <kbd>1</kbd>–<kbd>4</kbd> wybierają odpowiedź</>,
  match: null,
};

interface Props {
  exercise: PlayableExercise;
  retryNote: string;                  // co dzieje się z błędnym zadaniem
  onAnswered: (correct: boolean) => void;
  onNext: () => void;
}

export function ExerciseView({ exercise, retryNote, onAnswered, onNext }: Props) {
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const View = VIEWS[exercise.type];
  const answered = correct !== null;

  const submit = (given: Given) => {
    if (answered) return;
    const ok = checkAnswer(exercise, given);
    setCorrect(ok);
    onAnswered(ok);
  };

  const task = (
    <div className={`ex-body${answered ? (correct ? " was-ok" : " was-bad") : ""}`} data-exercise={exercise.id}>
      <p className="instr">{INSTRUCTIONS[exercise.type]}</p>
      <View exercise={exercise} answered={answered} onSubmit={submit} onReady={setReady} />
    </div>
  );

  // Dolny pasek: po lewej informacja, po prawej przycisk, który prowadzi dalej.
  const bar = (
    <div className={`action-bar${answered ? (correct ? " is-ok" : " is-bad") : ""}`}>
      <div className={`bar-inner${exercise.passage ? " wide" : ""}`}>
        {answered ? (
          <motion.div key="feedback" className="bar-info feedback" role="status"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <svg className="fb-icon" viewBox="0 0 22 22" aria-hidden="true">
              <motion.path d={correct ? "M4 11.5l4.5 4.5 9.5-10" : "M5 5l12 12M17 5L5 17"}
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35 }} />
            </svg>
            <span className="verdict">{correct ? "Dobrze" : "Jeszcze nie"}</span>
            {!correct && <p>Poprawnie: <strong>{correctAnswerText(exercise)}</strong></p>}
            <p>{exercise.explanation}</p>
            {!correct && <p className="muted">{retryNote}</p>}
          </motion.div>
        ) : (
          <div className="bar-info">
            {exercise.hint && (showHint
              ? <p className="hint">{exercise.hint}</p>
              : <button className="link-btn" type="button" onClick={() => setShowHint(true)}>Podpowiedź</button>)}
            {KEYS[exercise.type] && <p className="kbd-note">{KEYS[exercise.type]}</p>}
          </div>
        )}
        <div className="bar-action">
          {answered
            ? <button className="btn btn-next" type="button" autoFocus onClick={onNext}>Dalej</button>
            : exercise.type !== "choice" && <button className="btn btn-next" type="submit" form={FORM_ID} disabled={!ready}>Sprawdź</button>}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="ex-main">
        {exercise.passage ? (
          <div className="with-passage">
            <article className="passage" aria-label="Tekst do zadania">
              <h2>{exercise.passage.title}</h2>
              {exercise.passage.text.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para.split("\n").flatMap((line, j) => (j ? [<br key={j} />, line] : [line]))}</p>
              ))}
            </article>
            <div className="passage-task">{task}</div>
          </div>
        ) : task}
      </div>
      {bar}
    </>
  );
}
