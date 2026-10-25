const { test, expect } = require("@playwright/test");
const { mockSpeech, spoken, open, startRound } = require("./helpers");

test.describe("card faces", () => {
  test.beforeEach(async ({ page }) => { await mockSpeech(page); });

  test("emoji cards show a 3D picture", async ({ page }) => {
    await open(page);
    await startRound(page, { topics: ["animals"] });
    await expect(page.locator("#fPic img.pic3d")).toBeVisible();
    const loaded = await page.locator("#fPic img").evaluate((img) => img.complete && img.naturalWidth > 0);
    expect(loaded).toBe(true);
  });

  test("colour cards show a swatch and number cards show the numeral", async ({ page }) => {
    await open(page);
    await startRound(page, { topics: ["colors"] });
    const swatch = page.locator("#fPic .swatch");
    await expect(swatch).toBeVisible();
    // The colour fills most of the card, so cards don't all look alike.
    const box = await swatch.boundingBox();
    expect(box.width).toBeGreaterThan(180);
    const front = await page.evaluate(() => game.deck[game.i].front);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(front.slice(i, i + 2), 16));
    await expect(swatch).toHaveCSS("background-color", `rgb(${r}, ${g}, ${b})`);
    await page.click("#quit");
    await startRound(page, { topics: ["numbers"] });
    const n = await page.evaluate(() => game.deck[game.i].front.slice(2));
    await expect(page.locator("#fPic .num")).toHaveText(n);
  });

  test("the back's border takes the colour of the article", async ({ page }) => {
    await open(page);
    await startRound(page, { topics: ["food"] });
    const art = await page.evaluate(() => game.deck[game.i].art);
    await page.keyboard.press(" ");
    const [frame, want] = await page.evaluate((a) => [
      getComputedStyle(document.querySelector(".back")).borderTopColor,
      getComputedStyle(document.querySelector(`#bDe .a-${a}`)).color,
    ], art);
    expect(frame).toBe(want);
  });

  test("the hint option puts English on the front", async ({ page }) => {
    await open(page);
    await startRound(page, { hint: "en" });
    const en = await page.evaluate(() => game.deck[game.i].en);
    await expect(page.locator("#fCue")).toHaveText(en);
  });

  test("phrase cards always show a cue", async ({ page }) => {
    await open(page);
    await startRound(page, { topics: ["phrases"] });
    const es = await page.evaluate(() => game.deck[game.i].es);
    await expect(page.locator("#fCue")).toHaveText(es);
  });

  test("job cards show the feminine form too", async ({ page }) => {
    await open(page);
    await startRound(page, { topics: ["work"], count: "0" });
    await page.evaluate(() => { const i = game.deck.findIndex((c) => c.fem); [game.deck[0], game.deck[i]] = [game.deck[i], game.deck[0]]; dealCard(); });
    await page.keyboard.press(" ");
    const fem = await page.evaluate(() => game.deck[game.i].fem);
    await expect(page.locator("#bFem")).toBeVisible();
    await expect(page.locator("#bFem")).toContainText(fem.replace(/^die /, ""));
  });
});

test.describe("voice", () => {
  test("flipping reads the German with its article", async ({ page }) => {
    await mockSpeech(page);
    await open(page);
    await startRound(page, { topics: ["food"] });
    const c = await page.evaluate(() => game.deck[game.i]);
    await page.keyboard.press(" ");
    const art = c.art === "pl" ? "die" : c.art;
    expect(await spoken(page)).toEqual([`${art} ${c.de}`]);
  });

  test("Anhören repeats it without flipping back", async ({ page }) => {
    await mockSpeech(page);
    await open(page);
    await startRound(page);
    await page.keyboard.press(" ");
    await page.click("#say");
    expect((await spoken(page)).length).toBe(2);
  });

  test("turning reading off keeps it quiet", async ({ page }) => {
    await mockSpeech(page);
    await open(page);
    await page.uncheck("#speak");
    await startRound(page);
    await page.keyboard.press(" ");
    expect(await spoken(page)).toEqual([]);
  });

  test("Chrome's Google Deutsch is the default when it's there", async ({ page }) => {
    await mockSpeech(page, { voices: [
      { name: "Anna", lang: "de-DE", localService: true },
      { name: "Google Deutsch", lang: "de-DE", localService: false },
      { name: "Samantha", lang: "en-US", localService: true },
    ] });
    await open(page);
    await expect(page.locator("#voice option")).toHaveCount(2);
    await expect(page.locator("#voice")).toHaveValue("Google Deutsch");
    await page.click("#testVoice");
    const s = await page.evaluate(() => window.__spoken[0]);
    expect(s).toMatchObject({ text: "Guten Tag! Wie geht's?", voice: "Google Deutsch" });
  });

  test("otherwise an installed German voice is preferred over an online one", async ({ page }) => {
    await mockSpeech(page, { voices: [
      { name: "Microsoft Katja Online", lang: "de-DE", localService: false },
      { name: "Anna", lang: "de-DE", localService: true },
    ] });
    await open(page);
    await expect(page.locator("#voice")).toHaveValue("Anna");
  });

  test("a chosen voice is used and remembered", async ({ page }) => {
    await mockSpeech(page, { voices: [
      { name: "Anna", lang: "de-DE", localService: true },
      { name: "Markus", lang: "de-DE", localService: true },
    ] });
    await open(page);
    await page.selectOption("#voice", "Markus");
    await page.reload();
    await expect(page.locator("#voice")).toHaveValue("Markus");
    await page.click("#testVoice");
    expect(await page.evaluate(() => window.__spoken[0].voice)).toBe("Markus");
  });

  test("a hint appears when no German voice plays", async ({ page }) => {
    await mockSpeech(page, { voices: [], plays: false });
    await open(page);
    await page.click("#testVoice");
    await expect(page.locator("#soundNote")).toBeVisible({ timeout: 4000 });
    await expect(page.locator("#soundNote")).toContainText("No German voice found");
  });
});
