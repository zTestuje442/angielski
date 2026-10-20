import { describe, expect, it } from "vitest";
import { checkAnswer, correctAnswerText, matchesText, normalize } from "../src/lib/check.ts";
import type { Exercise } from "../src/types.ts";

const ex = (e: Partial<Exercise>): Exercise => ({ id: "x", type: "translate", prompt: "p", answer: "", explanation: "e", ...e });

describe("normalize", () => {
  it("trim, wielkość liter, spacje, apostrofy, końcowa interpunkcja", () => {
    expect(normalize("  I  HAVE   known her ’   ")).toBe("i have known her '");
    expect(normalize("I’ve known her.")).toBe("i have known her");
    expect(normalize("Have you been here?")).toBe("have you been here");
  });

  it("rozwija jednoznaczne skróty", () => {
    expect(normalize("I don't know")).toBe(normalize("I do not know"));
    expect(normalize("She won't come")).toBe("she will not come");
    expect(normalize("I can't")).toBe(normalize("I cannot"));
    expect(normalize("I'm, you're, we've, they'll")).toBe("i am, you are, we have, they will");
  });

  it("nie rusza dwuznacznych 's i 'd", () => {
    expect(normalize("He's lived here")).toBe("he's lived here");
    expect(normalize("I'd gone")).toBe("i'd gone");
  });
});

describe("matchesText", () => {
  it("skrót 's/'d wpisany przez użytkownika pasuje do pełnej formy z treści, ale nie odwrotnie", () => {
    expect(matchesText("He's lived here", "He has lived here")).toBe(true);
    expect(matchesText("She's tall", "She is tall")).toBe(true);
    expect(matchesText("What's your name?", "What is your name?")).toBe(true);
    expect(matchesText("I'd like tea", "I would like tea")).toBe(true);
    expect(matchesText("He is lived here", "He has lived here")).toBe(false);
    expect(matchesText("It's Tom's car", "It is Tom's car")).toBe(true);
    expect(matchesText("Tom's car", "Tom's car")).toBe(true);
  });

  it("akceptuje answer i warianty z accept, nic więcej", () => {
    expect(matchesText("since", "since")).toBe(true);
    expect(matchesText("for", "since")).toBe(false);
    expect(matchesText("He has lived here.", "He's lived here", ["He has lived here"])).toBe(true);
    expect(matchesText("He is lived here", "He's lived here", ["He has lived here"])).toBe(false);
    expect(matchesText("", "")).toBe(false);
  });
});

describe("checkAnswer", () => {
  it("tiles: kolejność kafelków", () => {
    const e = ex({ type: "tiles", answer: ["I", "have", "known", "her"] });
    expect(checkAnswer(e, { type: "tiles", value: ["I", "have", "known", "her"] })).toBe(true);
    expect(checkAnswer(e, { type: "tiles", value: ["have", "I", "known", "her"] })).toBe(false);
  });

  it("match: wszystkie pary muszą się zgadzać", () => {
    const e = ex({ type: "match", answer: ["for|two weeks", "since|Monday"] });
    expect(checkAnswer(e, { type: "match", value: { for: "two weeks", since: "Monday" } })).toBe(true);
    expect(checkAnswer(e, { type: "match", value: { for: "Monday", since: "two weeks" } })).toBe(false);
  });

  it("error: trzeba wskazać błędne słowo i wpisać poprawkę", () => {
    const e = ex({ type: "error", prompt: "I have known him since ages.", answer: ["since", "for"] });
    expect(checkAnswer(e, { type: "error", word: "since", correction: "for" })).toBe(true);
    expect(checkAnswer(e, { type: "error", word: "known", correction: "for" })).toBe(false);
    expect(checkAnswer(e, { type: "error", word: "since", correction: "from" })).toBe(false);
  });

  it("pokazuje poprawną odpowiedź czytelnie", () => {
    expect(correctAnswerText(ex({ type: "cloze", prompt: "Here ___ 2019.", answer: "since" }))).toBe("Here since 2019.");
    expect(correctAnswerText(ex({ type: "match", answer: ["a|b", "c|d"] }))).toBe("a – b; c – d");
  });
});

describe("reviewPrompt", () => {
  it("zawiera polecenie, poziom, listę kontrolną i tekst ucznia", async () => {
    const { reviewPrompt, countWords } = await import("../src/lib/claudePrompt.ts");
    const task = { topicId: "a2-x", task: "Napisz **krótką** wiadomość.", words: [20, 40] as [number, number], model: "m", checklist: ["Jest powitanie.", "Jest podpis."] };
    const p = reviewPrompt(task, "A2", "  Hi Tom, see you at five.  ");
    expect(countWords("Hi Tom, see you at five.")).toBe(6);
    expect(p).toContain("poziomie A2");
    expect(p).toContain("Napisz krótką wiadomość.");
    expect(p).toContain("mój tekst ma 6");
    expect(p).toContain("   - Jest podpis.");
    expect(p.endsWith('"""\nHi Tom, see you at five.\n"""')).toBe(true);
  });
});
