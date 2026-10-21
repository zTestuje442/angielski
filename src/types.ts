export const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type Level = (typeof LEVELS)[number];

export const SECTIONS = ["grammar", "vocabulary", "sentences", "reading", "writing"] as const;
export type Section = (typeof SECTIONS)[number];

export interface Topic {
  id: string;            // np. "b1-present-perfect-for-since"
  section: Section;
  level: Level;
  order: number;         // kolejność na ścieżce w obrębie działu i poziomu (1, 2, 3…)
  title: string;         // PL, np. "Present Perfect: for i since"
  explanation: string;   // oryginalne, krótkie wyjaśnienie PL (markdown), max ~250 słów; puste do fazy 4
  sets: string[];        // id zestawów ćwiczeń, min. 3
}

export const EXERCISE_TYPES = ["cloze", "tiles", "choice", "match", "error", "transform", "translate"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export interface Exercise {
  id: string;
  type: ExerciseType;
  prompt: string;              // polecenie / zdanie z luką oznaczoną "___"
  meaning?: string;            // PL: znaczenie zdania z luką, widoczne pod nim (cloze bez wskazówki w nawiasie)
  answer: string | string[];   // dla match: pary, dla tiles: kolejność
  accept?: string[];           // dodatkowe poprawne warianty (skróty, alternatywy)
  distractors?: string[];      // choice, tiles (1–2 zbędne kafelki od B1)
  hint?: string;
  explanation: string;         // PL: dlaczego tak, 1–2 zdania
}

export interface ExerciseSet {
  id: string;
  topicId: string;
  exercises: Exercise[];       // 8–12 zadań, min. 3 typy
}

/** Reading: jeden tekst = jeden zestaw (data/readings/<level>/<setId>.json). */
export interface ReadingSet extends ExerciseSet {
  title: string;
  text: string;                // akapity oddzielone pustą linią
}

/** Writing: jedno zadanie otwarte na temat (data/writing/<level>/<topicId>.json). */
export interface WritingTask {
  topicId: string;
  task: string;                // polecenie PL (markdown)
  words: [number, number];     // zalecana długość tekstu
  model: string;               // tekst wzorcowy EN
  checklist: string[];         // lista do samosprawdzenia PL
}

/** Zadanie gotowe do pokazania; pytania do tekstu niosą ten tekst ze sobą (także w powtórkach). */
/** Link „Dodatkowo” (data/external-links.json: topicId → ExternalLink[]). */
export interface ExternalLink {
  title: string;
  url: string;
  source: "PEG" | "BC" | "ang.pl";
}

export type PlayableExercise =Exercise & { passage?: { title: string; text: string } };
