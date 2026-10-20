import { expect } from "@playwright/test";
import { completeOpenSet, seedBeforeForSince, test, TOPIC } from "./helpers.ts";

test("[Ścieżka] widać temat „dziś”, a po zaliczeniu wszystkich zestawów znacznik przechodzi dalej", async ({ page }) => {
  test.slow(); // 3 zestawy = 30 zadań
  await seedBeforeForSince(page);
  await page.goto("/");
  const today = page.locator("[aria-current=step]");
  await expect(today).toHaveText(/Present Perfect: for i since/);

  for (const n of [1, 2, 3]) {
    await page.getByRole("button", { name: `Zacznij zestaw ${n}` }).click();
    await completeOpenSet(page);
  }

  await expect(today).toHaveText(/Present Perfect vs Past Simple/);
  await expect(page.locator(`[data-topic=${TOPIC}]`)).toHaveClass("done");
});

test("[Ścieżka] po otwarciu tematu niżej widać go, choć panel z wyjaśnieniem powyżej się zwinął", async ({ page }) => {
  await seedBeforeForSince(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Present Perfect: just, already, yet" }).click();
  await page.locator("[data-topic=b1-present-perfect-just-already-yet] summary").click();

  const target = page.getByRole("button", { name: "Used to", exact: true });
  await target.evaluate(el => el.scrollIntoView({ block: "center" }));
  await target.click();
  await expect(page.locator("[data-topic=b1-used-to] .topic-panel")).toBeVisible();
  await expect(target).toBeInViewport();
});

test("[Postęp] zaliczony zestaw zostaje zaliczony po przeładowaniu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "B1", exact: true }).click();
  await page.getByRole("button", { name: "Present Perfect: for i since" }).click();
  await page.locator(`[data-set=${TOPIC}-1]`).click();
  await completeOpenSet(page);

  await page.reload();
  await page.getByRole("button", { name: "Present Perfect: for i since" }).click();
  const set1 = page.locator(`[data-set=${TOPIC}-1]`);
  await expect(set1).toContainText("100%");
  await expect(set1).toContainText(", zaliczony");
});
