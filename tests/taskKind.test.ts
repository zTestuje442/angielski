import { describe, expect, it } from "vitest";
import { taskKind } from "../src/lib/taskKind.ts";
import type { Exercise } from "../src/types.ts";

const tr = (prompt: string): Exercise => ({ id: "x-1-01", type: "transform", prompt, answer: "a", explanation: "e" });

describe("taskKind", () => {
  it("rozpoznaje polecenie przekształcenia z pierwszej linii", () => {
    expect(taskKind(tr("Zamień na pytanie.\nShe works here."))).toBe("question");
    expect(taskKind(tr("Zadaj pytanie z „How long”.\nShe has lived here."))).toBe("question");
    expect(taskKind(tr("Dodaj question tag.\nYou are tired."))).toBe("question");
    expect(taskKind(tr("Napisz przeczenie.\nI like tea."))).toBe("negative");
    expect(taskKind(tr("Połącz zdania słowem „but”.\nA. B."))).toBe("combine");
    expect(taskKind(tr("Zamień na stronę bierną.\nThey built it."))).toBe("rewrite");
  });

  it("tłumaczenie, luka, prawda/fałsz i zwykły wybór", () => {
    const base = { id: "x-1-01", prompt: "p", explanation: "e" };
    expect(taskKind({ ...base, type: "translate", answer: "a" })).toBe("translate");
    expect(taskKind({ ...base, type: "cloze", answer: "a" })).toBe("gap");
    expect(taskKind({ ...base, type: "choice", answer: "True", distractors: ["False", "Not given"] })).toBe("truefalse");
    expect(taskKind({ ...base, type: "choice", answer: "has", distractors: ["have", "is"] })).toBe("choose");
  });
});
