import { describe, expect, it } from "vitest";
import {
  activeReviews, addReviews, emptyProgress, isLinkDone, isSetPassed, isTopicDone, levelFor, loadProgress, markLink, mergeProgress,
  parseProgress, recordSet, removeReview, saveProgress, setLevel, todayTopic, type Progress,
} from "../src/lib/progress.ts";
import type { Topic } from "../src/types.ts";

const topic = (id: string, order: number): Topic => ({
  id, section: "grammar", level: "B1", order, title: id, explanation: "", sets: [`${id}-1`, `${id}-2`, `${id}-3`],
});
const topics = [topic("b1-b", 2), topic("b1-a", 1), topic("b1-c", 3)];
const t = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T10:00:00Z`);

describe("progress", () => {
  it("zestaw zaliczony od 80%, temat zrobiony gdy wszystkie zestawy zaliczone", () => {
    let p = recordSet(emptyProgress(), "b1-a-1", 79, t(1));
    expect(isSetPassed(p, "b1-a-1")).toBe(false);
    p = recordSet(p, "b1-a-1", 80, t(2));
    expect(isSetPassed(p, "b1-a-1")).toBe(true);
    p = recordSet(recordSet(p, "b1-a-2", 100, t(2)), "b1-a-3", 90, t(2));
    expect(isTopicDone(p, topics[1])).toBe(true);
  });

  it("zachowuje najlepszy wynik i jego datę", () => {
    let p = recordSet(emptyProgress(), "s", 90, t(1));
    p = recordSet(p, "s", 70, t(2));
    expect(p.sets.s).toEqual({ bestScore: 90, completedAt: t(1).toISOString() });
  });

  it("„dziś” to pierwszy niezrobiony temat według order", () => {
    let p = emptyProgress();
    expect(todayTopic(topics, p, "grammar", "B1")?.id).toBe("b1-a");
    for (const s of topics[1].sets) p = recordSet(p, s, 100, t(1));
    expect(todayTopic(topics, p, "grammar", "B1")?.id).toBe("b1-b");
    expect(todayTopic(topics, p, "grammar", "A1")).toBeUndefined();
  });

  it("kolejka powtórek: bez duplikatów, zrobione znikają, można dodać ponownie", () => {
    let p = addReviews(emptyProgress(), ["e1", "e2"], t(1));
    p = addReviews(p, ["e2", "e3"], t(2));
    expect(activeReviews(p)).toEqual(["e1", "e2", "e3"]);
    p = removeReview(p, "e2", t(3));
    expect(activeReviews(p)).toEqual(["e1", "e3"]);
    p = addReviews(p, ["e2"], t(4));
    expect(activeReviews(p)).toEqual(["e1", "e3", "e2"]);
  });

  it("poziom w dziale: domyślny A1 (Writing A2) i wybrany", () => {
    expect(levelFor(emptyProgress(), "grammar")).toBe("A1");
    expect(levelFor(emptyProgress(), "writing")).toBe("A2");
    expect(levelFor(setLevel(emptyProgress(), "grammar", "B2", t(1)), "grammar")).toBe("B2");
  });

  it("zapis i odczyt z localStorage, uszkodzone dane dają pusty postęp", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    } as Storage;
    const p = addReviews(recordSet(emptyProgress(), "s", 85, t(1)), ["e1"], t(1));
    saveProgress(storage, p);
    expect(loadProgress(storage)).toEqual(p);
    data.set("szlak.progress", "{zepsute");
    expect(loadProgress(storage)).toEqual(emptyProgress());
  });

  it("czyta starszy format z fazy 2", () => {
    const p = parseProgress({ sets: {}, reviews: ["e1"], levels: { grammar: "B1" } });
    expect(activeReviews(p)).toEqual(["e1"]);
    expect(levelFor(p, "grammar")).toBe("B1");
    expect(p.links).toEqual({});
  });
});

describe("[Synchronizacja] mergeProgress", () => {
  // Dwa komputery z rozbieżnym postępem.
  let work = emptyProgress();
  work = recordSet(work, "a-1", 90, t(1));
  work = recordSet(work, "a-2", 70, t(2));
  work = recordSet(work, "tie", 80, t(5));
  work = addReviews(work, ["e1", "e2"], t(1));
  work = removeReview(work, "e1", t(6));
  work = setLevel(work, "grammar", "B1", t(3));
  work = markLink(work, "https://x/a", true, t(1));
  work = markLink(work, "https://x/b", false, t(5));

  let home = emptyProgress();
  home = recordSet(home, "a-1", 60, t(4));
  home = recordSet(home, "a-2", 100, t(3));
  home = recordSet(home, "b-1", 85, t(3));
  home = recordSet(home, "tie", 80, t(2));
  home = addReviews(home, ["e1", "e3"], t(2));
  home = setLevel(home, "grammar", "B2", t(4));
  home = setLevel(home, "vocabulary", "A2", t(1));
  home = markLink(home, "https://x/a", false, t(2));
  home = markLink(home, "https://x/b", true, t(4));
  home = markLink(home, "https://x/c", true, t(3));

  const merged = mergeProgress(work, home);

  it("daje sumę z wyższymi wynikami, przy remisie późniejsze completedAt", () => {
    expect(merged.sets).toEqual({
      "a-1": { bestScore: 90, completedAt: t(1).toISOString() },
      "a-2": { bestScore: 100, completedAt: t(3).toISOString() },
      "b-1": { bestScore: 85, completedAt: t(3).toISOString() },
      tie: { bestScore: 80, completedAt: t(5).toISOString() },
    });
  });

  it("powtórki: zrobione na jednym komputerze nie wracają z drugiego", () => {
    expect(activeReviews(merged)).toEqual(["e2", "e3"]);
  });

  it("poziom: wygrywa później wybrany", () => {
    expect(levelFor(merged, "grammar")).toBe("B2");
    expect(levelFor(merged, "vocabulary")).toBe("A2");
  });

  it("linki: wygrywa późniejsze kliknięcie checkboxa", () => {
    expect(isLinkDone(merged, "https://x/a")).toBe(false);
    expect(isLinkDone(merged, "https://x/b")).toBe(false);
    expect(isLinkDone(merged, "https://x/c")).toBe(true);
  });

  it("linki: przy tym samym czasie wygrywa „zrobione”", () => {
    const a = markLink(emptyProgress(), "https://x/d", true, t(8));
    const b = markLink(emptyProgress(), "https://x/d", false, t(8));
    expect(mergeProgress(a, b)).toEqual(mergeProgress(b, a));
    expect(isLinkDone(mergeProgress(b, a), "https://x/d")).toBe(true);
  });

  it("nie zależy od kolejności argumentów, jest idempotentny i łączny", () => {
    const third: Progress = markLink(recordSet(addReviews(emptyProgress(), ["e9"], t(7)), "a-1", 95, t(7)), "https://x/a", true, t(7));
    expect(mergeProgress(home, work)).toEqual(merged);
    expect(mergeProgress(merged, merged)).toEqual(merged);
    expect(mergeProgress(mergeProgress(work, home), third)).toEqual(mergeProgress(work, mergeProgress(home, third)));
  });

  it("niczego nie gubi względem żadnej ze stron", () => {
    for (const side of [work, home]) {
      expect(mergeProgress(merged, side)).toEqual(merged);
    }
  });
});
