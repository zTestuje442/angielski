import { expect, type Page } from "@playwright/test";
import { answerCorrectly, currentExercise, seedBeforeForSince, test } from "./helpers.ts";

/** Przechodzi Tabem (do przodu) aż fokus trafi na kafelek o danym tekście w danym obszarze. */
async function tabTo(page: Page, text: string, scope: string) {
  for (let i = 0; i < 40; i++) {
    const hit = await page.evaluate(([t, s]) => {
      const el = document.activeElement;
      return el?.textContent === t && el.closest(s) !== null;
    }, [text, scope]);
    if (hit) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Nie dotarłem Tabem do „${text}” w ${scope}`);
}

test("[Kafelki] zdanie da się ułożyć samą klawiaturą", async ({ page }) => {
  await seedBeforeForSince(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Zacznij zestaw 1" }).click();
  while ((await currentExercise(page)).type !== "tiles") await answerCorrectly(page);

  const words = (await currentExercise(page)).answer as string[]; // I have known him for years
  // Celowo zła kolejność dwóch pierwszych słów, potem naprawa przesunięciem z klawiatury.
  const order = [words[1], words[0], ...words.slice(2)];
  for (const w of order) {
    await tabTo(page, w, ".pool");
    await page.keyboard.press("Enter");
  }
  const line = page.getByLabel("Twoje zdanie");
  await expect(line).toHaveText(order.join(""));

  // Odłożenie ostatniego kafelka Backspace i ponowne dołożenie.
  await page.locator(".answer-line .tile").last().focus();
  await page.keyboard.press("Backspace");
  await expect(line).toHaveText(order.slice(0, -1).join(""));
  await tabTo(page, words[words.length - 1], ".pool");
  await page.keyboard.press("Enter");

  // Przesunięcie „I” na początek: Spacja podnosi, strzałka w lewo, Spacja upuszcza.
  await page.keyboard.press("Shift+Tab");
  for (let i = 0; i < 20; i++) {
    if (await page.evaluate(t => document.activeElement?.textContent === t && !!document.activeElement.closest(".answer-line"), words[0])) break;
    await page.keyboard.press("Shift+Tab");
  }
  await page.keyboard.press("Space");
  const dragged = page.locator(".tile.dragging");
  await expect(dragged).toHaveText(words[0]);
  // dnd-kit podpina strzałki chwilę po Spacji; ponawiaj, aż kafelek ruszy (dalej w lewo i tak nie ma miejsca).
  // Upuszczamy dopiero, gdy sąsiad odsunie się w prawo – wtedy dnd-kit ma już nowy cel upuszczenia.
  const neighbour = page.locator(".answer-line .tile").filter({ hasText: new RegExp(`^${words[1]}$`) });
  await expect(async () => {
    await page.keyboard.press("ArrowLeft");
    await expect(dragged).toHaveAttribute("style", /translate3d\(-/, { timeout: 300 });
    await expect(neighbour).toHaveAttribute("style", /translate3d\([1-9]/, { timeout: 300 });
  }).toPass();
  await page.keyboard.press("Space");
  await expect(line).toHaveText(words.join(""));

  await tabTo(page, "Sprawdź", ".action-bar");
  await page.keyboard.press("Enter");
  await expect(page.locator(".verdict")).toHaveText("Dobrze");
});
