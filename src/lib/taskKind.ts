// Rodzaj zadania z punktu widzenia ucznia: co trzeba zrobić. Pokazywany jako ikona z podpisem.
// Przekształcenia (transform) rozróżniamy po poleceniu z pierwszej linii treści.
import type { Exercise } from "../types.ts";

export const TASK_KINDS = {
  translate: "Tłumaczenie",
  question: "Pytanie",
  negative: "Przeczenie",
  combine: "Łączenie zdań",
  rewrite: "Przekształcenie",
  gap: "Luka",
  choose: "Wybór",
  truefalse: "Prawda czy fałsz",
  match: "Pary",
  order: "Układanie",
  fix: "Poprawianie błędu",
} as const;

export type TaskKind = keyof typeof TASK_KINDS;

const TRUE_FALSE = ["True", "False", "Not given"];

export function taskKind(e: Exercise): TaskKind {
  switch (e.type) {
    case "translate": return "translate";
    case "cloze": return "gap";
    case "match": return "match";
    case "tiles": return "order";
    case "error": return "fix";
    case "choice":
      return TRUE_FALSE.includes(e.answer as string) && (e.distractors ?? []).every(d => TRUE_FALSE.includes(d)) ? "truefalse" : "choose";
    case "transform": {
      const instruction = e.prompt.split("\n")[0];
      if (/^(Zamień na pytanie|Zadaj pytanie|Zapytaj|Dodaj question tag)/i.test(instruction)) return "question";
      if (/^(Napisz przeczenie|Zmień na zakaz|Zamień na przeczenie)/i.test(instruction)) return "negative";
      if (/^Połącz/i.test(instruction)) return "combine";
      if (/^Ułóż/i.test(instruction)) return "order";
      return "rewrite";
    }
  }
}
