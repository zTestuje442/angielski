// Prompt do wklejenia w czacie claude.ai (bez API): sprawdzenie tekstu z zadania otwartego Writing.
import type { Level, WritingTask } from "../types.ts";

export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

export function reviewPrompt(task: WritingTask, level: Level, text: string): string {
  const [min, max] = task.words;
  return [
    `Uczę się angielskiego na poziomie ${level}. Napisałem tekst na takie zadanie:`,
    "",
    task.task.replace(/\*\*/g, ""),
    `(zalecana długość: ${min}–${max} słów, mój tekst ma ${countWords(text)})`,
    "",
    "Sprawdź go jak nauczyciel. Odpowiadaj po polsku.",
    "1. Wypisz błędy (gramatyka, słownictwo, pisownia, interpunkcja): cytat → poprawka → krótkie wyjaśnienie.",
    "2. Oceń, czy tekst wykonuje polecenie. Sprawdź te punkty:",
    ...task.checklist.map(c => `   - ${c}`),
    `3. Podaj poprawioną wersję tekstu: zachowaj moje pomysły i styl, nie podnoś poziomu powyżej ${level}.`,
    "4. Na koniec daj jedną najważniejszą wskazówkę na przyszłość.",
    "",
    "Mój tekst:",
    '"""',
    text.trim(),
    '"""',
  ].join("\n");
}
