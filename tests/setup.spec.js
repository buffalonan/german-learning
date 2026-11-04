const { test, expect } = require("@playwright/test");
const { mockSpeech, open, openPrefs, chooseTopics } = require("./helpers");

test.beforeEach(async ({ page }) => { await mockSpeech(page); });

test("shows every topic with the default selection", async ({ page }) => {
  const errors = await open(page);
  const chips = page.locator("#topics .topic-chip");
  await expect(chips).toHaveCount(23);
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

test("practice is the default mode, and the quick start says what the round will be", async ({ page }) => {
  await open(page);
  await expect(page.locator('#modeSeg [data-v="practice"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#quickSum")).toHaveText("Farben, Zahlen, Essen & Trinken +1 · 20 Karten · Üben");
  await page.click('#modeSeg [data-v="race"]');
  await page.click('#hintSeg [data-v="en"]');
  await expect(page.locator("#quickSum")).toHaveText("Farben, Zahlen, Essen & Trinken +1 · 20 Karten · Wettkampf: Ferran gegen Meri · English hint");
  await page.click('#countSeg [data-v="0"]');
  await expect(page.locator("#quickSum")).toContainText("Alle 138 Karten");
});

test("the start button sits above the settings, which fold away once a round has been played", async ({ page }) => {
  await open(page);
  // First visit: the settings are open, and Start is above them.
  await expect(page.locator("#setupSheet")).toBeVisible();
  const startY = (await page.locator("#start").boundingBox()).y;
  expect(startY).toBeLessThan((await page.locator("#topics").boundingBox()).y);
  await expect(page.locator("#start")).toBeInViewport();
  await page.click("#start");
  await page.click("#quit");
  await expect(page.locator("#setupSheet")).toBeHidden();
  await expect(page.locator("#editSetup")).toHaveText("Ändern");
  await page.reload();
  await expect(page.locator("#setupSheet")).toBeHidden();
  await page.click("#editSetup");
  await expect(page.locator("#setupSheet")).toBeVisible();
  await expect(page.locator("#editSetup")).toHaveAttribute("aria-expanded", "true");
  await page.click("#editSetup");
  await expect(page.locator("#setupSheet")).toBeHidden();
});

test("the app opens on the section used last", async ({ page }) => {
  await open(page);
  await page.click('#areas [data-v="listen"]');
  await page.reload();
  await expect(page.locator("#listen")).toBeVisible();
  await expect(page.locator('#areas [data-v="listen"]')).toHaveAttribute("aria-pressed", "true");
});

test("names, voice and reading aloud live on one page reached from every section", async ({ page }) => {
  await open(page);
  for (const area of ["setup", "grammar", "listen", "exam"]) {
    await page.click(`#areas [data-v="${area}"]`);
    await openPrefs(page);
    await expect(page.locator("#p1")).toBeVisible();
    await expect(page.locator("#voice")).toBeVisible();
    await page.click("#prefsBack");
    await expect(page.locator(`#${area}`)).toBeVisible();
  }
});

test("settings are remembered after a reload", async ({ page }) => {
  await open(page);
  await chooseTopics(page, ["animals"]);
  await page.click('#modeSeg [data-v="race"]');
  await page.click('#countSeg [data-v="40"]');
  await page.click('#hintSeg [data-v="es"]');
  await openPrefs(page);
  await page.fill("#p1", "Ana");
  await page.uncheck("#speak");
  await page.reload();
  await expect(page.locator('#topics [data-id="animals"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#topics [data-id="food"]')).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('#modeSeg [data-v="race"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#countSeg [data-v="40"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#hintSeg [data-v="es"]')).toHaveAttribute("aria-pressed", "true");
  await openPrefs(page);
  await expect(page.locator("#p1")).toHaveValue("Ana");
  await expect(page.locator("#speak")).not.toBeChecked();
});

test("the page never scrolls sideways", async ({ page }) => {
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("long topic names stay inside their tiles at every width", async ({ page }) => {
  await open(page);
  for (const width of [320, 360, 412, 600, 800, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const outside = await page.locator("#topics .topic-chip").evaluateAll((chips) => chips.flatMap((chip) => {
      const inner = chip.getBoundingClientRect().right - parseFloat(getComputedStyle(chip).borderRightWidth);
      return [...chip.querySelectorAll("b, .sub")].filter((el) => el.getBoundingClientRect().right > inner + 0.5).map((el) => el.textContent);
    }));
    expect(outside, `at ${width}px`).toEqual([]);
  }
});

test("player names are shown as text, never run as code", async ({ page }) => {
  await open(page);
  const evil = "<svg/onload=f()>"; // fits the 16-character name limit
  await page.evaluate(() => { window.f = () => { window.__xss = 1; }; });
  await page.click('#modeSeg [data-v="race"]');
  await openPrefs(page);
  await page.fill("#p1", evil);
  await page.click("#prefsBack");
  await chooseTopics(page, ["food"]);
  await expect(page.locator("#quickSum")).toContainText(evil);
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
  await openPrefs(page);
  await expect(page.locator("#voice option")).toHaveText(evil);
  await expect(page.locator("#voice")).toHaveValue(evil);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator("#prefs img[src='x']").count()).toBe(0);
});

test.describe("tile pictures", () => {
  test("tile ids are unique, so each tile painting belongs to one tile", async ({ page }) => {
    await open(page);
    const ids = await page.evaluate(() => [...TOPICS, ...GRAMMAR, ...LISTENING].map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("topic, lesson and listening tiles show their painting, or the emoji without one", async ({ page }) => {
    // Pretend only these three tiles have a painting, whatever art.js lists.
    await page.route("**/art.js", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.ART = ["tiles/food", "tiles/perfekt", "tiles/radio"];' }));
    await open(page);
    await expect(page.locator('#topics img.tile[src="art/tiles/food.webp"]')).toHaveCount(1);
    await expect(page.locator("#topics img.tile")).toHaveCount(1);
    // The other topics keep their 3D emoji.
    await expect(page.locator("#topics .ico img:not(.tile)").first()).toBeVisible();
    await page.click('#areas [data-v="grammar"]');
    await expect(page.locator('img.tile[src="art/tiles/perfekt.webp"]')).toBeVisible();
    await page.click('#areas [data-v="listen"]');
    await expect(page.locator('img.tile[src="art/tiles/radio.webp"]')).toBeVisible();
  });
});
