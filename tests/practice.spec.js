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

test("the end-of-round list shows each missed card's painting", async ({ page }) => {
  await open(page);
  await startRound(page, { mode: "practice", topics: ["verbs"], count: "0" });
  await page.evaluate(() => startGame(buildDeck().filter((c) => c.de === "aufstehen")));
  await page.keyboard.press(" ");
  await page.keyboard.press("1"); // again
  await page.keyboard.press(" ");
  await page.keyboard.press("2");
  const thumb = page.locator("#missed li img.thumb");
  await expect(thumb).toHaveAttribute("src", "art/verbs/aufstehen.webp");
  expect(await thumb.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test("a missed card without a painting keeps its emoji in the list", async ({ page }) => {
  await open(page);
  await startRound(page, { mode: "practice", topics: ["animals"] });
  await page.evaluate(() => startGame([{ ...buildDeck()[0], de: "Probetier" }]));
  await page.keyboard.press(" ");
  await page.keyboard.press("1");
  await page.keyboard.press(" ");
  await page.keyboard.press("2");
  await expect(page.locator("#missed li img.thumb")).toHaveCount(0);
  await expect(page.locator("#missed li .mi img")).toBeVisible();
});
