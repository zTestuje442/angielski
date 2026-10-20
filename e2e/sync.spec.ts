import { expect, test, type BrowserContext, type Route } from "@playwright/test";
import { completeOpenSet, seedBeforeForSince, TOPIC } from "./helpers.ts";

test("[Synchronizacja] postęp z dwóch komputerów łączy się po wpisaniu kodu", async ({ browser }) => {
  test.slow();
  // Udawany Supabase: get_progress / save_progress na wspólnej mapie.
  const db = new Map<string, unknown>();
  const urls: string[] = [];
  const supabase = async (route: Route) => {
    const req = route.request();
    urls.push(req.url());
    const body = req.postDataJSON() as { k: string; d?: unknown };
    if (req.url().endsWith("/get_progress")) return route.fulfill({ json: db.get(body.k) ?? null });
    db.set(body.k, body.d);
    return route.fulfill({ status: 204 });
  };
  const computer = async () => {
    const ctx: BrowserContext = await browser.newContext();
    await ctx.route("https://sync.test/rest/v1/rpc/*", supabase);
    return ctx;
  };

  // Praca: zaliczony zestaw 1 tematu for/since.
  const work = await (await computer()).newPage();
  await work.goto("/");
  await work.getByRole("button", { name: "B1", exact: true }).click();
  await work.getByRole("button", { name: "Present Perfect: for i since" }).click();
  await work.locator(`[data-set=${TOPIC}-1]`).click();
  await completeOpenSet(work);
  await expect.poll(() => JSON.stringify([...db.values()])).toContain(`${TOPIC}-1`);

  await work.getByRole("button", { name: /^Synchronizacja/ }).click();
  await work.getByRole("button", { name: "Pokaż kod synchronizacji" }).click();
  const code = (await work.locator(".sync-key code").textContent())!;
  await work.getByRole("button", { name: "Zamknij" }).click();

  // Dom: inny postęp (zaliczony temat just/already/yet), potem wpisanie kodu z pracy.
  const home = await (await computer()).newPage();
  await seedBeforeForSince(home);
  await home.goto("/");
  await home.getByRole("button", { name: /^Synchronizacja/ }).click();
  await home.getByLabel("Kod synchronizacji").fill(code);
  await home.getByRole("button", { name: "Połącz" }).click();
  await expect(home.locator(".sync-status")).toContainText("Zsynchronizowano");
  await home.getByRole("button", { name: "Zamknij" }).click();

  // Na domowym: zestaw z pracy jest zaliczony, a własny postęp został.
  await expect(home.locator(`[data-set=${TOPIC}-1]`)).toContainText(", zaliczony");
  await expect(home.locator("[aria-current=step]")).toHaveText(/for i since/);

  // W pracy po przeładowaniu: temat z domu też zrobiony, więc „dziś” to for/since.
  await work.reload();
  await expect(work.locator("[aria-current=step]")).toHaveText(/for i since/);
  await expect(work.locator(`[data-set=${TOPIC}-1]`)).toContainText(", zaliczony");

  // Kod nigdy nie trafia do URL-a.
  expect(urls.length).toBeGreaterThan(0);
  expect(urls.some(u => u.includes(code))).toBe(false);
  expect(work.url()).not.toContain(code);
});

test("[Synchronizacja] brak połączenia pokazuje błąd, a zły kod daje komunikat", async ({ page }) => {
  await page.route("https://sync.test/rest/v1/rpc/*", route => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: /^Synchronizacja/ }).click();
  await expect(page.locator(".sync-status")).toContainText("Nie udało się zsynchronizować");
  await page.getByLabel("Kod synchronizacji").fill("abc");
  await page.getByRole("button", { name: "Połącz" }).click();
  await expect(page.getByText("To nie jest poprawny kod")).toBeVisible();
});
