// Sprawdzanie odpowiedzi: tylko answer + accept, po normalizacji. Bez „prawie dobrze”.
import type { Exercise } from "../types.ts";

// Skróty jednoznaczne rozwijamy zawsze. 's i 'd są dwuznaczne (is/has/dopełniacz, would/had) — patrz matchesText.
const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon't\b/g, "will not"],
  [/\bshan't\b/g, "shall not"],
  [/\bcan't\b/g, "can not"],
  [/\bcannot\b/g, "can not"],
  [/n't\b/g, " not"],
  [/'m\b/g, " am"],
  [/'re\b/g, " are"],
  [/'ve\b/g, " have"],
  [/'ll\b/g, " will"],
];

export function normalize(s: string): string {
  let t = s
    .replace(/[‘’ʼ`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*[.!?]+$/, "");
  for (const [re, full] of CONTRACTIONS) t = t.replace(re, full);
  return t.replace(/\s+/g, " ").trim();
}

const AMBIGUOUS: [RegExp, string[]][] = [[/(\w)'s\b/, [" is", " has"]], [/(\w)'d\b/, [" would", " had"]]];

/** Odpowiedź użytkownika dosłownie oraz z każdym 's/'d rozwiniętym na obie pełne formy. */
function readings(s: string): string[] {
  for (const [re, fulls] of AMBIGUOUS) {
    const m = re.exec(s);
    if (!m) continue;
    const rest = s.slice(m.index + m[0].length);
    const head = s.slice(0, m.index + 1);
    const tails = readings(rest);
    return [...fulls, "'" + m[0].slice(-1)].flatMap(f => tails.map(t => head + f + t));
  }
  return [s];
}

/**
 * Treść podaje odpowiedź w pełnej formie („He has lived”); skrót wpisany przez użytkownika („He's lived”)
 * przechodzi, bo jedno z jego rozwinięć się zgadza. Odwrotnie nie: „He is lived” nie pasuje do „He has lived”.
 */
export function matchesText(input: string, answer: string, accept: string[] = []): boolean {
  const given = normalize(input);
  if (given === "") return false;
  const ok = new Set([answer, ...accept].map(normalize));
  return readings(given).some(r => ok.has(r));
}

/** Para w zadaniu match: "lewa|prawa". */
export function splitPair(pair: string): [string, string] {
  const [left, right] = pair.split("|");
  return [left.trim(), right.trim()];
}

/** Słowa zdania bez interpunkcji na brzegach — do zadania error. */
export function tokenize(sentence: string): string[] {
  return sentence.split(/\s+/).filter(Boolean);
}
export const bareWord = (token: string) => token.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");

/** Zdanie z zadania error, w którym pierwsze błędne słowo zastąpiono poprawką (interpunkcja zostaje). */
export function correctedSentence(prompt: string, wrong: string, correction: string): string {
  const tokens = tokenize(prompt);
  const i = tokens.findIndex(t => normalize(bareWord(t)) === normalize(wrong));
  if (i >= 0) tokens[i] = tokens[i].replace(bareWord(tokens[i]), correction);
  return tokens.join(" ");
}

export type Given =
  | { type: "text"; value: string }                 // cloze, transform, translate, choice
  | { type: "tiles"; value: string[] }
  | { type: "match"; value: Record<string, string> } // lewa → prawa
  | { type: "error"; word: string; correction: string };

export function checkAnswer(ex: Exercise, given: Given): boolean {
  const answer = ex.answer;
  switch (given.type) {
    case "text":
      return typeof answer === "string" && matchesText(given.value, answer, ex.accept);
    case "tiles":
      return Array.isArray(answer) && matchesText(given.value.join(" "), answer.join(" "), ex.accept);
    case "match":
      return Array.isArray(answer) && answer.every(p => {
        const [l, r] = splitPair(p);
        return given.value[l] === r;
      }) && Object.keys(given.value).length === answer.length;
    case "error": {
      if (!Array.isArray(answer)) return false;
      const [wrong, correction] = answer;
      if (normalize(given.word) === normalize(wrong) && matchesText(given.correction, correction, ex.accept)) return true;
      // Całe poprawione zdanie zamiast samego słowa też jest dobrą odpowiedzią.
      const fixed = (c: string) => correctedSentence(ex.prompt, wrong, c);
      return matchesText(given.correction, fixed(correction), (ex.accept ?? []).map(fixed));
    }
  }
}

/** Poprawna odpowiedź do pokazania po błędzie. */
export function correctAnswerText(ex: Exercise): string {
  const a = ex.answer;
  if (ex.type === "match" && Array.isArray(a)) return a.map(p => splitPair(p).join(" – ")).join("; ");
  if (ex.type === "error" && Array.isArray(a)) return `zamiast „${a[0]}” powinno być „${a[1]}”`;
  if (ex.type === "cloze" && typeof a === "string") return ex.prompt.replace("___", a);
  return Array.isArray(a) ? a.join(" ") : a;
}
