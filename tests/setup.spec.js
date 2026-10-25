const { test, expect } = require("@playwright/test");
const { mockSpeech, open, chooseTopics } = require("./helpers");

test.beforeEach(async ({ page }) => { await mockSpeech(page); });

test("shows every topic with the default selection", async ({ page }) => {
  const errors = await open(page);
  const chips = page.locator("#topics .topic-chip");
  await expect(chips).toHaveCount(13);
  const pressed = await page.locator('#topics [aria-pressed="true"]').evaluateAll((els) => els.map((e) => e.dataset.id));
  expect(pressed.sort()).toEqual(["colors", "food", "numbers", "verbs"]);
  await expect(page.locator("#avail")).toContainText("cards in the chosen topics");
  expect(errors).toEqual([]);
});

test("start is disabled with no topics and enabled again with Select all", async ({ page }) => {
  await open(page);
  await page.click("#noTopics");
  await expect(page.locator("#start")).toBeDisabled();
  await expect(page.locator("#avail")).toHaveText("Pick at least one topic to start");
  await page.click("#allTopics");
  await expect(page.locator("#start")).toBeEnabled();
  const total = await page.evaluate(() => TOPICS.reduce((a, t) => a + t.items.length, 0));
  await expect(page.locator("#avail")).toHaveText(`${total} cards in the chosen topics`);
});

test("practice is the default mode, and player names only show in race mode", async ({ page }) => {
  await open(page);
  await expect(page.locator('#modeSeg [data-v="practice"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#players")).toBeHidden();
  await page.click('#modeSeg [data-v="race"]');
  await expect(page.locator("#players")).toBeVisible();
  await page.click('#modeSeg [data-v="practice"]');
  await expect(page.locator("#players")).toBeHidden();
});

test("settings are remembered after a reload", async ({ page }) => {
  await open(page);
  await chooseTopics(page, ["animals"]);
  await page.click('#modeSeg [data-v="race"]');
  await page.fill("#p1", "Ana");
  await page.click('#countSeg [data-v="40"]');
  await page.click('#hintSeg [data-v="es"]');
  await page.uncheck("#speak");
  await page.reload();
  await expect(page.locator('#topics [data-id="animals"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#topics [data-id="food"]')).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('#modeSeg [data-v="race"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#countSeg [data-v="40"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#hintSeg [data-v="es"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#p1")).toHaveValue("Ana");
  await expect(page.locator("#speak")).not.toBeChecked();
});

test("the page never scrolls sideways", async ({ page }) => {
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("player names are shown as text, never run as code", async ({ page }) => {
  await open(page);
  const evil = "<svg/onload=f()>"; // fits the 16-character name limit
  await page.evaluate(() => { window.f = () => { window.__xss = 1; }; });
  await page.click('#modeSeg [data-v="race"]');
  await page.fill("#p1", evil);
  await chooseTopics(page, ["food"]);
  await page.click("#start");
  await expect(page.locator("#scores .score.p1 span")).toHaveText(evil);
  await page.keyboard.press("a");
  await expect(page.locator("#status")).toContainText(evil);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator("#play svg").count()).toBe(0);
});

test("voice names are shown as text, never run as code", async ({ page }) => {
  const evil = "<img src=x onerror=f()>";
  await mockSpeech(page, { voices: [{ name: evil, lang: "de-DE", localService: true }] });
  await page.addInitScript(() => { window.f = () => { window.__xss = 1; }; });
  await open(page);
  await expect(page.locator("#voice option")).toHaveText(evil);
  await expect(page.locator("#voice")).toHaveValue(evil);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator("#setup img[src='x']").count()).toBe(0);
});
