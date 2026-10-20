import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../scripts/validate-content.ts";
import { checkAnswer, splitPair } from "../src/lib/check.ts";
import type { Exercise, ExerciseSet } from "../src/types.ts";

const { files, readings } = loadContent(join(import.meta.dirname, "../src/data"));
const all = [
  ...files.flatMap(f => (f.data as ExerciseSet[]).flatMap(s => s.exercises)),
  ...readings.flatMap(r => (r.data as ExerciseSet).exercises),
];

describe("treść: poprawne odpowiedzi przechodzą przez check.ts", () => {
  it.each(all.map(e => [e.id, e] as [string, Exercise]))("%s", (_, e) => {
    const variants = [e.answer, ...(e.accept ?? [])];
    switch (e.type) {
      case "cloze": case "translate": case "transform": case "choice":
        for (const v of variants) expect(checkAnswer(e, { type: "text", value: v as string })).toBe(true);
        break;
      case "tiles":
        expect(checkAnswer(e, { type: "tiles", value: e.answer as string[] })).toBe(true);
        break;
      case "match":
        expect(checkAnswer(e, { type: "match", value: Object.fromEntries((e.answer as string[]).map(splitPair)) })).toBe(true);
        break;
      case "error": {
        const [word, correction] = e.answer as string[];
        for (const c of [correction, ...(e.accept ?? [])]) expect(checkAnswer(e, { type: "error", word, correction: c })).toBe(true);
        break;
      }
    }
  });
});
