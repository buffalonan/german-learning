const { test, expect } = require("@playwright/test");
const { mockSpeech, open, startRound, isFlipped } = require("./helpers");

test.beforeEach(async ({ page }) => { await mockSpeech(page); });

test("Again turns the same card back over", async ({ page }) => {
  await open(page);
  await startRound(page, { mode: "practice" });
  const first = await page.evaluate(() => game.deck[game.i].de);
  await page.keyboard.press(" ");
  await page.click('[data-act="again"]');
  expect(await isFlipped(page)).toBe(false);
  expect(await page.evaluate(() => game.deck[game.i].de)).toBe(first);
  await expect(page.locator("#prog")).toHaveText("Karte 1 / 10");
  await expect(page.locator("#status")).toHaveText("Same card again. Say it, then flip.");
  await expect(page.locator("#scores .score").nth(1).locator("b")).toHaveText("1");
});

test("Got it moves on and counts the card", async ({ page }) => {
  await open(page);
  await startRound(page, { mode: "practice" });
  await page.keyboard.press(" ");
  await page.keyboard.press("2");
  await expect(page.locator("#prog")).toHaveText("Karte 2 / 10");
  await expect(page.locator("#scores .score").first().locator("b")).toHaveText("1");
});

test("cards needing another go are listed at the end", async ({ page }) => {
  await open(page);
  await startRound(page, { mode: "practice" });
  await page.keyboard.press(" ");
  await page.keyboard.press("1"); // again
  for (let i = 0; i < 10; i++) { await page.keyboard.press(" "); await page.keyboard.press("2"); }
  await expect(page.locator("#doneTitle")).toHaveText("Gut gemacht!");
  await expect(page.locator("#missed li")).toHaveCount(1);
});
