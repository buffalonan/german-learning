const { test, expect } = require("@playwright/test");
const { mockSpeech, open, startRound, isFlipped } = require("./helpers");

test.beforeEach(async ({ page }) => { await mockSpeech(page); });

test("Again brings the card back after three others", async ({ page }) => {
  await open(page);
  await startRound(page, { mode: "practice" });
  const first = await page.evaluate(() => game.deck[game.i].de);
  await page.keyboard.press(" ");
  await page.click('[data-act="again"]');
  expect(await isFlipped(page)).toBe(false);
  await expect(page.locator("#prog")).toHaveText("Karte 2 / 11");
  await expect(page.locator("#status")).toHaveText("That one comes back in a few cards.");
  await expect(page.locator("#scores .score").nth(1).locator("b")).toHaveText("1");
  expect(await page.evaluate(() => game.deck[game.i].de)).not.toBe(first);
  for (let k = 0; k < 3; k++) { await page.keyboard.press(" "); await page.keyboard.press("2"); }
  expect(await page.evaluate(() => game.deck[game.i].de)).toBe(first);
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
