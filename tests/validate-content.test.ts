import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent, validateContent } from "../scripts/validate-content.ts";

const topic = (id: string, order: number, extra: object = {}) => ({
  id, section: "grammar", level: "B1", order, title: "Temat", explanation: "",
  sets: [1, 2, 3].map(n => `${id}-${n}`), ...extra,
});

const exercises = (n: number, types = ["cloze", "choice", "translate"], setId = "b1-a-1") =>
  Array.from({ length: n }, (_, i) => {
    const type = types[i % types.length];
    return {
      id: `${setId}-${i}`, type, explanation: "Bo tak.",
      prompt: type === "cloze" ? "I have lived here ___ 2019." : "Mieszkam tu od 2019.",
      ...(type === "cloze" ? { meaning: "Mieszkam tu od 2019." } : {}),
      answer: "since",
      ...(type === "choice" ? { distractors: ["for", "from"] } : {}),
    };
  });

const file = (data: unknown, topicId = "b1-a", level = "B1") => ({ level, topicId, data });
const set = (ex: unknown[], id = "b1-a-1") => ({ id, topicId: "b1-a", exercises: ex });

describe("validateContent: curriculum.json z repo", () => {
  const { curriculum, files } = loadContent(join(import.meta.dirname, "../src/data"));
  const r = validateContent(curriculum, files);

  it("nie ma błędów", () => expect(r.errors).toEqual([]));
  it("zawiera wszystkie 230 tematów A1–C1 po 3 zestawy", () => {
    expect(r.topics).toBe(230);
    expect(r.sets).toBe(230 * 3);
  });
});

describe("validateContent: curriculum", () => {
  it("poprawny temat przechodzi i jest liczony jako brak treści", () => {
    const r = validateContent([topic("b1-a", 1)], []);
    expect(r.errors).toEqual([]);
    expect(r.missingSets).toHaveLength(3);
    expect(r.missingExplanations).toEqual(["b1-a"]);
  });

  it("wykrywa duplikat id tematu i zestawu", () => {
    const r = validateContent([topic("b1-a", 1), topic("b1-a", 2)], []);
    expect(r.errors).toContain("temat b1-a: duplikat id");
    expect(r.errors.some(e => e.includes("duplikat id zestawu"))).toBe(true);
  });

  it("wymaga kolejnych order 1…n w dziale i poziomie", () => {
    const r = validateContent([topic("b1-a", 1), topic("b1-b", 3)], []);
    expect(r.errors).toEqual(["grammar B1: order musi być kolejno 1…2, jest 1, 3"]);
  });

  it("wymaga min. 3 zestawów i id zgodnego z poziomem", () => {
    const r = validateContent([topic("a2-a", 1, { sets: ["a2-a-1"] })], []);
    expect(r.errors).toContain("temat a2-a: id nie zaczyna się od poziomu");
    expect(r.errors).toContain("temat a2-a: wymagane min. 3 zestawy");
  });

  it("odrzuca zbyt długie wyjaśnienie", () => {
    const r = validateContent([topic("b1-a", 1, { explanation: "słowo ".repeat(301) })], []);
    expect(r.errors).toEqual(["temat b1-a: explanation ma 301 słów (max ~250)"]);
  });
});

describe("validateContent: zestawy ćwiczeń", () => {
  const curriculum = [topic("b1-a", 1)];

  it("poprawny zestaw przechodzi i przestaje być brakiem", () => {
    const r = validateContent(curriculum, [file([set(exercises(8))])]);
    expect(r.errors).toEqual([]);
    expect(r.missingSets).toEqual(["b1-a-2", "b1-a-3"]);
  });

  it("wymaga 8–12 zadań i min. 3 typów", () => {
    const r = validateContent(curriculum, [file([set(exercises(7, ["cloze", "translate"]))])]);
    expect(r.errors).toContain("exercises/B1/b1-a.json › b1-a-1: 7 zadań (wymagane 8–12)");
    expect(r.errors).toContain("exercises/B1/b1-a.json › b1-a-1: 2 typy zadań (wymagane min. 3)");
  });

  it("sprawdza pola zadań: lukę w cloze, explanation, distractors w choice", () => {
    const ex = exercises(9);
    ex[0] = { ...ex[0], prompt: "Bez luki." };
    ex[1] = { ...ex[1], distractors: undefined };
    ex[2] = { ...ex[2], explanation: "" };
    const r = validateContent(curriculum, [file([set(ex)])]);
    expect(r.errors).toEqual([
      "exercises/B1/b1-a.json › b1-a-1 › [0] b1-a-1-0: cloze wymaga dokładnie jednej luki ___",
      "exercises/B1/b1-a.json › b1-a-1 › [1] b1-a-1-1: choice wymaga 2–3 distractors (razem 3–4 opcje)",
      "exercises/B1/b1-a.json › b1-a-1 › [2] b1-a-1-2: brak explanation",
    ]);
  });

  it("wykrywa duplikat id zadania i id spoza zestawu", () => {
    const ex = exercises(9);
    ex[8] = { ...ex[8], id: ex[0].id };
    const other = exercises(8, undefined, "b1-a-1");
    const r = validateContent(curriculum, [file([set(ex), set(other, "b1-a-2")])]);
    expect(r.errors.filter(e => e.includes("duplikat id zadania"))).toHaveLength(1);
    expect(r.errors.filter(e => e.includes("musi zaczynać się od b1-a-2-"))).toHaveLength(8);
  });

  it("sprawdza format match i error", () => {
    const ex = exercises(8);
    ex[0] = { ...ex[0], type: "match", answer: ["for|a week", "since Monday"] } as never;
    ex[1] = { ...ex[1], type: "error", prompt: "I know him since 2019.", answer: ["for", "have known"] } as never;
    const r = validateContent(curriculum, [file([set(ex)])]);
    expect(r.errors).toEqual([
      'exercises/B1/b1-a.json › b1-a-1 › [0] b1-a-1-0: match wymaga par w formacie "lewa|prawa"',
      "exercises/B1/b1-a.json › b1-a-1 › [1] b1-a-1-1: error wymaga answer [błędne słowo z prompt, poprawka]",
    ]);
  });

  it("wykrywa plik w złym katalogu poziomu i zestaw spoza curriculum", () => {
    const r = validateContent(curriculum, [file([set(exercises(8), "b1-a-9")], "b1-a", "A2")]);
    expect(r.errors).toContain("exercises/A2/b1-a.json: temat jest na poziomie B1");
    expect(r.errors).toContain("exercises/A2/b1-a.json › b1-a-9: zestaw nie należy do tematu b1-a w curriculum");
  });
});

describe("validateContent: reguły zależne od poziomu", () => {
  const tiles = (setId: string, distractors?: string[]) => ({
    id: `${setId}-9`, type: "tiles", prompt: "Ułóż.", answer: ["I", "am"], explanation: "Bo tak.",
    ...(distractors ? { distractors } : {}),
  });

  it("kafelki: bez zbędnych na A1–A2, 1–2 zbędne od B1", () => {
    const a1 = { ...topic("a1-x", 1), level: "A1" };
    const exA1 = [...exercises(7, undefined, "a1-x-1"), tiles("a1-x-1", ["is"])];
    const exB1 = [...exercises(7), tiles("b1-a-1")];
    const r = validateContent([a1, topic("b1-a", 1)], [
      file([{ id: "a1-x-1", topicId: "a1-x", exercises: exA1 }], "a1-x", "A1"),
      file([set(exB1)]),
    ]);
    expect(r.errors).toEqual([
      "exercises/A1/a1-x.json › a1-x-1 › [7] a1-x-1-9: tiles na A1 bez zbędnych kafelków",
      "exercises/B1/b1-a.json › b1-a-1 › [7] b1-a-1-9: tiles na B1 wymaga 1–2 zbędnych kafelków",
    ]);
  });

  it("match bez powtórzeń po obu stronach, choice bez powtórzonych opcji", () => {
    const ex = exercises(8);
    ex[0] = { ...ex[0], type: "match", answer: ["he|is", "she|is"] } as never;
    ex[1] = { ...ex[1], answer: "for", distractors: ["For", "from"] } as never;
    const r = validateContent([topic("b1-a", 1)], [file([set(ex)])]);
    expect(r.errors).toEqual([
      "exercises/B1/b1-a.json › b1-a-1 › [0] b1-a-1-0: match wymaga różnych elementów po obu stronach",
      "exercises/B1/b1-a.json › b1-a-1 › [1] b1-a-1-1: choice ma powtórzoną opcję",
    ]);
  });

  it("cloze bez wskazówki w nawiasie wymaga polskiego znaczenia zdania", () => {
    const ex = exercises(8);
    ex[0] = { ...ex[0], meaning: undefined };
    ex[3] = { ...ex[3], prompt: "I ___ here since 2019. (live)", meaning: undefined };
    const r = validateContent([topic("b1-a", 1)], [file([set(ex)])]);
    expect(r.errors).toEqual([
      "exercises/B1/b1-a.json › b1-a-1 › [0] b1-a-1-0: cloze bez wskazówki w nawiasie wymaga meaning (znaczenie zdania po polsku)",
    ]);
  });

  it("cloze z dwiema lukami jest błędem", () => {
    const ex = exercises(8);
    ex[0] = { ...ex[0], prompt: "I ___ here ___ 2019." };
    const r = validateContent([topic("b1-a", 1)], [file([set(ex)])]);
    expect(r.errors).toEqual(["exercises/B1/b1-a.json › b1-a-1 › [0] b1-a-1-0: cloze wymaga dokładnie jednej luki ___"]);
  });
});

describe("validateContent: Reading", () => {
  const reading = { ...topic("b1-reading-email", 1), section: "reading" };
  const text = "word ".repeat(300);
  const data = (extra: object = {}) => ({
    id: "b1-reading-email-1", topicId: "b1-reading-email", title: "Tytuł", text,
    exercises: exercises(8, undefined, "b1-reading-email-1"), ...extra,
  });
  const readingFile = (d: unknown, setId = "b1-reading-email-1", level = "B1") => ({ level, setId, data: d });

  it("poprawny tekst przechodzi i liczy się jako treść zestawu", () => {
    const r = validateContent([reading], [], [readingFile(data())]);
    expect(r.errors).toEqual([]);
    expect(r.missingSets).toEqual(["b1-reading-email-2", "b1-reading-email-3"]);
  });

  it("pilnuje długości tekstu i tytułu", () => {
    const r = validateContent([reading], [], [readingFile(data({ text: "za krótki tekst", title: "" }))]);
    expect(r.errors).toEqual([
      "readings/B1/b1-reading-email-1.json: brak title",
      "readings/B1/b1-reading-email-1.json: tekst ma 3 słów (na B1 ok. 300)",
    ]);
  });

  it("teksty Reading nie mogą leżeć w exercises/", () => {
    const r = validateContent([reading], [file([data()], "b1-reading-email")]);
    expect(r.errors).toContain("exercises/B1/b1-reading-email.json: teksty Reading należą do data/readings/<poziom>/<setId>.json");
  });
});

describe("validateContent: zadanie otwarte Writing", () => {
  const writing = { ...topic("b1-writing-email", 1), section: "writing" };
  const task = (extra: object = {}) => ({
    level: "B1", topicId: "b1-writing-email",
    data: { topicId: "b1-writing-email", task: "Napisz e-mail.", words: [3, 10], model: "Hi Tom, see you soon!",
      checklist: ["a", "b", "c"], ...extra },
  });

  it("poprawne zadanie przechodzi, brak zadania jest liczony jako brak treści", () => {
    expect(validateContent([writing], [], [], [task()]).errors).toEqual([]);
    expect(validateContent([writing], []).missingWriting).toEqual(["b1-writing-email"]);
  });

  it("tekst wzorcowy musi mieścić się w zakresie słów, a lista mieć min. 3 punkty", () => {
    const r = validateContent([writing], [], [], [task({ words: [50, 80], checklist: ["a"] })]);
    expect(r.errors).toEqual([
      "writing/B1/b1-writing-email.json: checklist wymaga min. 3 punktów",
      "writing/B1/b1-writing-email.json: tekst wzorcowy ma 5 słów, a zadanie wymaga 50–80",
    ]);
  });
});
