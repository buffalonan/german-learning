const { test, expect } = require("@playwright/test");
const { mockSpeech, open, startRound, isFlipped } = require("./helpers");

test.beforeEach(async ({ page }) => { await mockSpeech(page); });

test("a round deals the chosen number of cards", async ({ page }) => {
  await open(page);
  await startRound(page, { count: "10" });
  await expect(page.locator("#prog")).toHaveText("Karte 1 / 10");
  await expect(page.locator("#scores .score")).toHaveCount(2);
  await expect(page.locator("#scores")).toContainText("Ferran");
  await expect(page.locator("#scores")).toContainText("Meri");
});

test("All deals every card in the chosen topics", async ({ page }) => {
  await open(page);
  await startRound(page, { topics: ["colors", "body"], count: "0" });
  const total = await page.evaluate(() => TOPICS.filter((t) => ["colors", "body"].includes(t.id)).reduce((a, t) => a + t.items.length, 0));
  await expect(page.locator("#prog")).toHaveText(`Karte 1 / ${total}`);
});

test("buzzing in marks who was first, and only the first buzz counts", async ({ page }) => {
  await open(page);
  await startRound(page);
  await page.keyboard.press("l");
  await expect(page.locator("#status")).toContainText("Meri was first");
  await expect(page.locator("#scores .score.p2")).toHaveClass(/buzzed/);
  await page.keyboard.press("a");
  await expect(page.locator("#scores .score.p1")).not.toHaveClass(/buzzed/);
  await page.keyboard.press(" ");
  expect(await isFlipped(page)).toBe(true);
  await expect(page.locator("#status")).toContainText("Did Meri get it right?");
});

test("tapping the card flips it and shows German, English and Spanish", async ({ page }) => {
  await open(page);
  await startRound(page);
  await page.click("#card");
  expect(await isFlipped(page)).toBe(true);
  const card = await page.evaluate(() => game.deck[game.i]);
  await expect(page.locator("#bDe")).toContainText(card.de);
  await expect(page.locator("#bDe .art")).toHaveClass(new RegExp(`a-${card.art}`));
  await expect(page.locator("#bEn")).toHaveText(card.en);
  await expect(page.locator("#bEs")).toHaveText(card.es);
});

test("points go to the right player and the next card is dealt face down", async ({ page }) => {
  await open(page);
  await startRound(page);
  await page.keyboard.press(" ");
  await page.click('[data-act="win0"]');
  await expect(page.locator("#scores .score.p1 b")).toHaveText("1");
  await expect(page.locator("#prog")).toHaveText("Karte 2 / 10");
  expect(await isFlipped(page)).toBe(false);
  await page.keyboard.press(" ");
  await page.keyboard.press("l");
  await expect(page.locator("#scores .score.p2 b")).toHaveText("1");
  await page.keyboard.press("a"); // buzz on card 3
  await page.keyboard.press(" ");
  await page.keyboard.press("Enter"); // award the buzzer
  await expect(page.locator("#scores .score.p1 b")).toHaveText("2");
});

test("finishing a round shows the winner and the cards nobody knew", async ({ page }) => {
  await open(page);
  await startRound(page);
  const keys = ["a", "a", "a", "l", "n", "n", "a", "l", "a", "n"];
  for (const k of keys) { await page.keyboard.press(" "); await page.keyboard.press(k); }
  await expect(page.locator("#done")).toBeVisible();
  await expect(page.locator("#doneTitle")).toHaveText("Ferran gewinnt!");
  await expect(page.locator("#missed li")).toHaveCount(3);
  await page.click("#replayMissed");
  await expect(page.locator("#prog")).toHaveText("Karte 1 / 3");
});

test("an equal score is a draw", async ({ page }) => {
  await open(page);
  await startRound(page);
  for (let i = 0; i < 10; i++) { await page.keyboard.press(" "); await page.keyboard.press(i < 5 ? "a" : "l"); }
  await expect(page.locator("#doneTitle")).toHaveText("Unentschieden!");
  await expect(page.locator("#missedWrap")).toBeHidden();
  await expect(page.locator("#replayMissed")).toBeHidden();
});

test("Menu returns to the setup screen", async ({ page }) => {
  await open(page);
  await startRound(page);
  await page.click("#quit");
  await expect(page.locator("#setup")).toBeVisible();
  await expect(page.locator("#play")).toBeHidden();
});
