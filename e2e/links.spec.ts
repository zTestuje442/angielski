import { expect } from "@playwright/test";
import { seedBeforeForSince, test } from "./helpers.ts";

test("[Linki] „Dodatkowo” otwiera się w nowej karcie, a „zrobione” zostaje po przeładowaniu", async ({ page }) => {
  await seedBeforeForSince(page);
  await page.goto("/");
  const extra = page.getByRole("region", { name: "Dodatkowo" });
  const link = extra.getByRole("link").first();
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);

  const box = extra.getByRole("checkbox").first();
  await expect(box).not.toBeChecked();
  await box.check();
  await page.reload();
  await expect(page.getByRole("region", { name: "Dodatkowo" }).getByRole("checkbox").first()).toBeChecked();
});
