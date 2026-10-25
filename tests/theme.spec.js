const { test, expect } = require("@playwright/test");
const { mockSpeech, open } = require("./helpers");

test.beforeEach(async ({ page }) => { await mockSpeech(page); });

const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("the light/dark button switches the theme and remembers it", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page);
  const lightBg = await bg(page);
  await expect(page.locator("#theme")).toHaveAttribute("aria-label", "Switch to dark mode");
  await page.click("#theme");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#theme")).toHaveAttribute("aria-label", "Switch to light mode");
  expect(await bg(page)).not.toBe(lightBg);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.click("#theme");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await bg(page)).toBe(lightBg);
});

test("with no saved choice the page follows the system and the button offers the other mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  await expect(page.locator("#theme")).toHaveAttribute("aria-label", "Switch to light mode");
  await page.click("#theme");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("the light/dark button shows on the menus but not during a round", async ({ page }) => {
  await open(page);
  await expect(page.locator("#theme")).toBeVisible();
  await page.click("#start");
  await expect(page.locator("#theme")).toBeHidden();
});
