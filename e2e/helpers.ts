import { expect, test as base, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Exercise, ExerciseSet } from "../src/types.ts";

export const TOPIC = "b1-present-perfect-for-since";
const sets = JSON.parse(
  readFileSync(join(import.meta.dirname, `../src/data/exercises/B1/${TOPIC}.json`), "utf8"),
) as ExerciseSet[];
const byId = new Map(sets.flatMap(s => s.exercises).map(e => [e.id, e]));

/** Test bez synchronizacji: zapytania do udawanego Supabase od razu kończą się błędem (praca offline). */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route("https://sync.test/**", route => route.abort());
    await provide(page);
  },
});

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Postęp z zaliczonym tematem przed „for i since” — wtedy „dziś” to for i since. */
export async function seedBeforeForSince(page: Page) {
  const done = { bestScore: 100, completedAt: "2026-10-18T10:00:00.000Z" };
  const progress = {
    sets: Object.fromEntries([1, 2, 3].map(n => [`b1-present-perfect-just-already-yet-${n}`, done])),
    reviews: {},
    levels: { grammar: { level: "B1", at: "2026-10-18T10:00:00.000Z" } },
  };
  await page.addInitScript(p => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("szlak.progress", p);
      sessionStorage.setItem("seeded", "1");
    }
  }, JSON.stringify(progress));
}

export async function currentExercise(page: Page): Promise<Exercise> {
  const id = await page.locator("[data-exercise]").getAttribute("data-exercise");
  const ex = byId.get(id ?? "");
  if (!ex) throw new Error(`Nieznane zadanie ${id}`);
  return ex;
}

/** Odpowiada poprawnie na bieżące zadanie (myszą/wpisywaniem) i przechodzi dalej: kliknięciem „Dalej” albo Enterem. */
export async function answerCorrectly(page: Page, next: "click" | "enter" = "click") {
  const ex = await currentExercise(page);
  const a = ex.answer;
  switch (ex.type) {
    case "cloze":
      await page.getByLabel("Luka").fill(a as string);
      await page.keyboard.press("Enter");
      break;
    case "transform": case "translate":
      await page.getByLabel("Twoja odpowiedź").fill(a as string);
      await page.keyboard.press("Enter");
      break;
    case "choice":
      await page.locator(".option").filter({ hasText: new RegExp(`^\\d${esc(a as string)}$`) }).click();
      break;
    case "tiles":
      for (const w of a as string[]) await page.locator(".pool").getByRole("button", { name: w, exact: true }).first().click();
      await page.getByRole("button", { name: "Sprawdź" }).click();
      break;
    case "match":
      for (const pair of a as string[]) {
        const [l, r] = pair.split("|");
        await page.getByRole("button", { name: l, exact: true }).click();
        await page.getByRole("button", { name: r, exact: true }).click();
      }
      await page.getByRole("button", { name: "Sprawdź" }).click();
      break;
    case "error": {
      const [wrong, correction] = a as string[];
      await page.locator(".token").filter({ hasText: new RegExp(`^\\W*${esc(wrong)}\\W*$`) }).first().click();
      await page.locator(".correction input").fill(correction);
      await page.keyboard.press("Enter");
      break;
    }
  }
  await expect(page.locator(".verdict")).toHaveText("Dobrze");
  if (next === "click") await page.getByRole("button", { name: "Dalej" }).click();
  else {
    await expect(page.getByRole("button", { name: "Dalej" })).toBeFocused();
    await page.keyboard.press("Enter");
  }
}

/** Przechodzi cały otwarty zestaw bezbłędnie i wraca na ścieżkę. */
export async function completeOpenSet(page: Page) {
  await expect(page.locator("[data-exercise]")).toBeVisible();
  while (await page.locator("[data-exercise]").count()) await answerCorrectly(page);
  await expect(page.getByRole("status")).toContainText("Zestaw zaliczony");
  await page.getByRole("button", { name: "Wróć do ścieżki" }).last().click();
}
