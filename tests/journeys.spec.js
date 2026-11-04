const { test, expect } = require("@playwright/test");
const { mockSpeech, open, openSetup, startRound } = require("./helpers");

// How a returning player moves through the app: Back, resuming a round, the mistakes pile, answer screens.
test.beforeEach(async ({ page }) => { await mockSpeech(page); });

test.describe("the Back button", () => {
  test("goes from a round back to its section, then out of the app", async ({ page }) => {
    await open(page);
    await page.click('#areas [data-v="grammar"]');
    await page.click('#lessons [data-quiz="cases"]');
    await expect(page.locator("#quiz")).toBeVisible();
    await page.goBack();
    await expect(page.locator("#grammar")).toBeVisible();
    await page.click('[data-theory="perfekt"]');
    await expect(page.locator("#theory")).toBeVisible();
    await page.goBack();
    await expect(page.locator("#grammar")).toBeVisible();
  });

  test("the screen's own back button leaves no extra history behind", async ({ page }) => {
    await open(page);
    const before = await page.evaluate(() => history.length);
    await startRound(page);
    await page.click("#quit");
    await expect(page.locator("#setup")).toBeVisible();
    await page.click('#areas [data-v="exam"]');
    await page.click('[data-task="schreiben"]');
    await page.goBack();
    await expect(page.locator("#exam")).toBeVisible();
    expect(await page.evaluate(() => history.state)).toBeNull();
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(before + 1);
  });
});

test.describe("rounds you can come back to", () => {
  test("a card round carries on where it stopped, even after a reload", async ({ page }) => {
    await open(page);
    await startRound(page, { mode: "race" });
    await page.keyboard.press("a"); await page.keyboard.press(" "); await page.keyboard.press("a"); // Ferran 1
    await page.keyboard.press(" "); await page.keyboard.press("n");
    const third = await page.evaluate(() => game.deck[game.i].de);
    await page.click("#quit");
    await expect(page.locator("#resume")).toHaveText("Runde fortsetzen · Karte 3 / 10");
    await page.reload();
    await page.click("#resume");
    await expect(page.locator("#prog")).toHaveText("Karte 3 / 10");
    expect(await page.evaluate(() => game.deck[game.i].de)).toBe(third);
    await expect(page.locator("#scores .score.p1 b")).toHaveText("1");
    for (let k = 0; k < 8; k++) { await page.keyboard.press(" "); await page.keyboard.press("n"); }
    await expect(page.locator("#done")).toBeVisible();
    await expect(page.locator("#missed li")).toHaveCount(9);
    await page.click("#toSetup");
    await expect(page.locator("#resume")).toBeHidden();
  });

  test("grammar and listening rounds can be resumed too", async ({ page }) => {
    await open(page);
    await page.click('#areas [data-v="grammar"]');
    await page.click('#lessons [data-quiz="perfekt"]');
    await page.keyboard.press("1");
    await page.click("#quizQuit");
    await expect(page.locator("#gresume")).toHaveText("Runde fortsetzen · Satz 2 / 10");
    await expect(page.locator("#gLast")).toHaveText("Weiter: Perfekt");
    await page.click("#gresume");
    await expect(page.locator("#qprog")).toHaveText("Satz 2 / 10");

    await page.click("#quizQuit");
    await page.click('#areas [data-v="listen"]');
    await page.click("#lstart");
    await page.click("#hearQuit");
    await expect(page.locator("#lresume")).toHaveText("Runde fortsetzen · Text 1 / 10");
    await expect(page.locator("#lsetupSheet")).toBeHidden();
  });

  test("an email you started is still there after opening another task", async ({ page }) => {
    await open(page);
    await page.click('#areas [data-v="exam"]');
    await page.click('[data-task="schreiben"]');
    await page.fill("#wText", "Liebe Anna, danke für die Einladung.");
    await page.click("#wNew");
    await expect(page.locator("#wText")).toHaveValue("");
    const idx = await page.evaluate(() => writeIdx);
    await page.evaluate((i) => openWriting((i + WRITING.length - 1) % WRITING.length), idx);
    await expect(page.locator("#wText")).toHaveValue("Liebe Anna, danke für die Einladung.");
    await expect(page.locator("#wCount")).toContainText("6 words");
  });
});

test.describe("Meine Fehler", () => {
  test("missed cards wait on a pile until they've been right twice", async ({ page }) => {
    await open(page);
    await expect(page.locator("#mistakes")).toBeHidden();
    await startRound(page, { mode: "practice" });
    const first = await page.evaluate(() => game.deck[game.i].de);
    await page.keyboard.press(" "); await page.keyboard.press("1");
    await page.click("#quit");
    await expect(page.locator("#mistakes")).toHaveText("Meine Fehler · 1");
    for (let round = 0; round < 2; round++) {
      await page.click("#mistakes");
      expect(await page.evaluate(() => game.deck.map((c) => c.de))).toEqual([first]);
      await page.keyboard.press(" "); await page.keyboard.press("2");
      await expect(page.locator("#done")).toBeVisible();
      await page.click("#toSetup");
    }
    await expect(page.locator("#mistakes")).toBeHidden();
  });

  test("wrong grammar answers and missed texts go on their own piles", async ({ page }) => {
    await open(page);
    await page.click('#areas [data-v="grammar"]');
    await page.click('#lessons [data-quiz="cases"]');
    const q = await page.evaluate(() => quiz.deck[0]);
    const wrong = await page.evaluate(() => quiz.opts.findIndex((o) => o !== quiz.deck[0].a));
    await page.keyboard.press(String(wrong + 1));
    await page.click("#quizQuit");
    await expect(page.locator("#gmistakes")).toHaveText("Meine Fehler · 1");
    await page.click("#gmistakes");
    expect(await page.evaluate(() => quiz.deck.map((x) => x.s))).toEqual([q.s]);

    await page.click("#quizQuit");
    await page.click('#areas [data-v="listen"]');
    await page.click('#lmodeSeg [data-v="race"]');
    await page.click("#lstart");
    await page.keyboard.press("n");
    await page.click("#hearQuit");
    await expect(page.locator("#lmistakes")).toHaveText("Meine Fehler · 1");
  });
});

test.describe("answer screens", () => {
  test("after a listening answer, Weiter comes first and the transcript and translation are folded", async ({ page }) => {
    await open(page);
    await page.click('#areas [data-v="listen"]');
    await page.click('#lmodeSeg [data-v="race"]');
    await page.click("#lstart");
    const a = await page.evaluate(() => listen.opts.indexOf(listen.deck[0].a));
    await page.keyboard.press("a");
    await page.keyboard.press(String(a + 1));
    await expect(page.locator("#lNext")).toBeVisible();
    await expect(page.locator("#lScript")).toBeHidden();
    await expect(page.locator("#lEn")).toBeHidden();
    const next = (await page.locator("#lNext").boundingBox()).y;
    expect(next).toBeLessThan((await page.locator("#lScriptBox").boundingBox()).y);
    await page.click("#lTrBox summary");
    await expect(page.locator("#lEn")).toBeVisible();
    // After a miss the transcript opens by itself.
    await page.keyboard.press("Enter");
    await page.keyboard.press("n");
    await expect(page.locator("#lScript")).toBeVisible();
  });

  test("richtig/falsch questions always offer Richtig first", async ({ page }) => {
    await open(page);
    await page.click('#areas [data-v="listen"]');
    await page.evaluate(() => startListening(allTexts(["interviews"]).slice(0, 5)));
    for (let k = 0; k < 5; k++) {
      await expect(page.locator("#lOpts .opt").first()).toContainText("Richtig");
      const a = await page.evaluate(() => listen.opts.indexOf(listen.deck[listen.i].a));
      await page.keyboard.press(String(a + 1));
      await page.keyboard.press("Enter");
    }
  });

  test("the grammar translation waits for a tap or the answer", async ({ page }) => {
    await open(page);
    await page.click('#areas [data-v="grammar"]');
    await page.click('#lessons [data-quiz="cases"]');
    await expect(page.locator("#qTr")).toBeHidden();
    await page.click("#qTrShow");
    await expect(page.locator("#qTr")).toBeVisible();
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
    await expect(page.locator("#qTr")).toBeHidden();
    await page.keyboard.press("2");
    await expect(page.locator("#qTr")).toBeVisible();
  });

  test("the Termin task asks who you are first and has the partner's number at the top", async ({ page }) => {
    await open(page);
    await page.click('#areas [data-v="exam"]');
    await page.click('[data-task="termin"]');
    const y = async (sel) => (await page.locator(sel).boundingBox()).y;
    expect(await y("#whoSeg")).toBeLessThan(await y("#tTask"));
    expect(await y("#tCode")).toBeLessThan(await y("#tTask"));
  });
});

test.describe("two players on one laptop", () => {
  test("once one player buzzes, the other's button is off", async ({ page }) => {
    await open(page);
    await startRound(page, { mode: "race" });
    await page.keyboard.press("a");
    await expect(page.locator('[data-act="buzz1"]')).toBeDisabled();
    await expect(page.locator('[data-act="buzz0"]')).toBeEnabled();
  });
});

test("modes use the same words in every section", async ({ page }) => {
  await open(page);
  await openSetup(page);
  await expect(page.locator("#modeSeg button")).toHaveText(["Üben", "Wettkampf"]);
  await page.click('#areas [data-v="grammar"]');
  await expect(page.locator("#gmodeSeg button")).toHaveText(["Üben", "Wettkampf"]);
  await page.click('#areas [data-v="listen"]');
  await expect(page.locator("#lmodeSeg button")).toHaveText(["Üben", "Wettkampf"]);
});

test("on a small phone the flip button shows without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await open(page);
  await startRound(page, { mode: "race" });
  await expect(page.locator('[data-act="flip"]')).toBeInViewport();
});

test("phones show tap wording, not keyboard keys", async ({ page, isMobile }) => {
  await open(page);
  await startRound(page);
  if (isMobile) {
    await expect(page.locator(".tap .touch-only")).toBeVisible();
    await expect(page.locator('[data-act="flip"] .k')).toBeHidden();
  } else {
    await expect(page.locator(".tap .kbd-only")).toBeVisible();
    await expect(page.locator('[data-act="flip"] .k')).toBeVisible();
  }
});
