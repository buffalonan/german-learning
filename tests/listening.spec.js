const { test, expect } = require("@playwright/test");
const { mockSpeech, spoken, open } = require("./helpers");

test.beforeEach(async ({ page }) => { await mockSpeech(page); });

async function openListening(page) {
  const errors = await open(page);
  await page.click('#areas [data-v="listen"]');
  await expect(page.locator("#listen")).toBeVisible();
  return errors;
}
async function startListening(page, { mode = "practice", kinds, count = "10" } = {}) {
  await openListening(page);
  if (kinds) {
    for (const b of await page.locator("#kinds .topic-chip").all()) {
      if ((await b.getAttribute("aria-pressed") === "true") !== kinds.includes(await b.getAttribute("data-id"))) await b.click();
    }
  }
  await page.click(`#lmodeSeg [data-v="${mode}"]`);
  await page.click(`#lcountSeg [data-v="${count}"]`);
  await page.click("#lstart");
  await expect(page.locator("#hear")).toBeVisible();
}
const current = (page) => page.evaluate(() => listen.deck[listen.i]);
const rightOpt = (page) => page.evaluate(() => listen.opts.indexOf(listen.deck[listen.i].a));
const wrongOpt = (page) => page.evaluate(() => listen.opts.findIndex((o) => o !== listen.deck[listen.i].a));
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("every listening text is complete", async ({ page }) => {
  await open(page);
  const problems = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const k of LISTENING) {
      if (!PICS[k.icon]) out.push(`${k.id}: no picture for ${k.icon}`);
      for (const [lines, q, a, wrong, en, es] of k.items) {
        const label = `${k.id}: ${q}`;
        if (!Array.isArray(lines) || !lines.length || lines.some((l) => !l)) out.push(`${label}: no text to read`);
        if (k.dialogue && lines.length < 2) out.push(`${label}: a conversation needs two speakers`);
        // Numbers are written as words, so every voice reads them the same way.
        if (lines.some((l) => /\d/.test(l))) out.push(`${label}: digits in the spoken text`);
        if (!q || !a || !en || !es) out.push(`${label}: missing a field`);
        if (!Array.isArray(wrong) || wrong.length < 1 || wrong.length > 3) out.push(`${label}: needs 1 to 3 wrong options`);
        if (new Set([a, ...wrong]).size !== wrong.length + 1) out.push(`${label}: options repeat`);
        if (seen.has(lines[0])) out.push(`${label}: duplicate`);
        seen.add(lines[0]);
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
});

test("the Hören tab lists the kinds of text, with practice as the default", async ({ page }) => {
  const errors = await openListening(page);
  await expect(page.locator("#kinds .topic-chip")).toHaveCount(4);
  await expect(page.locator('#kinds [aria-pressed="true"]')).toHaveCount(4);
  await expect(page.locator('#lmodeSeg [data-v="practice"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#lcountSeg [data-v="10"]')).toHaveAttribute("aria-pressed", "true");
  expect(await noSideScroll(page)).toBe(true);
  await page.click('#kinds [data-id="talks"]');
  await expect(page.locator("#lavail")).not.toContainText("Pick");
  await page.click('#areas [data-v="setup"]');
  await expect(page.locator("#setup")).toBeVisible();
  await page.click('#areas [data-v="listen"]');
  await expect(page.locator('#kinds [data-id="talks"]')).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});

test("practice: the text plays straight away, a wrong answer can be tried again", async ({ page }) => {
  await startListening(page, { kinds: ["announce"] });
  const t = await current(page);
  await expect(page.locator("#lprog")).toHaveText("Text 1 / 8");
  await expect(page.locator("#lQuestion")).toHaveText(t.q);
  await expect(page.locator("#lBuzz")).toBeHidden();
  await expect.poll(() => spoken(page)).toEqual(t.lines);
  await expect(page.locator("#lFeedback")).toBeHidden();
  expect(await noSideScroll(page)).toBe(true);

  await page.keyboard.press(String((await wrongOpt(page)) + 1));
  await expect(page.locator("#lOpts .opt.bad")).toHaveCount(1);
  await expect(page.locator("#lOpts .opt.bad")).toBeDisabled();
  await expect(page.locator("#lTurn")).toContainText("Nicht ganz");
  await expect(page.locator("#lFeedback")).toBeHidden();
  await expect(page.locator("#lscores")).toContainText("Noch mal1");

  await page.keyboard.press("r");
  await expect.poll(() => spoken(page)).toEqual([...t.lines, ...t.lines]);

  await page.locator("#lOpts .opt").nth(await rightOpt(page)).click();
  await expect(page.locator("#lVerdict")).toHaveText("Jetzt stimmt's!");
  await expect(page.locator("#lOpts .opt.ok")).toContainText(t.a);
  await expect(page.locator("#lScript")).toHaveText(t.lines.join(""));
  await expect(page.locator("#lEn")).toHaveText(t.en);
  await expect(page.locator("#lEs")).toHaveText(t.es);
  await expect(page.locator("#lscores")).toContainText("Gewusst0");
  expect(await noSideScroll(page)).toBe(true);

  await page.keyboard.press("Enter");
  await expect(page.locator("#lprog")).toHaveText("Text 2 / 8");
  await expect(page.locator("#lFeedback")).toBeHidden();
});

test("in a conversation the second speaker has a lower voice", async ({ page }) => {
  await startListening(page, { kinds: ["talks"] });
  const t = await current(page);
  await expect.poll(async () => (await page.evaluate(() => window.__spoken)).length).toBe(t.lines.length);
  const pitches = await page.evaluate(() => window.__spoken.map((s) => s.pitch));
  expect(pitches).toEqual(t.lines.map((_, n) => (n % 2 ? 0.7 : 1)));
  await page.keyboard.press(String((await rightOpt(page)) + 1));
  await expect(page.locator("#lScript .who")).toHaveText(t.lines.map((_, n) => (n % 2 ? "B" : "A")));
});

test("leaving mid-text stops the voice", async ({ page }) => {
  await startListening(page, { kinds: ["talks"] });
  await page.click("#hearQuit");
  await expect(page.locator("#listen")).toBeVisible();
  await page.waitForTimeout(1500);
  expect((await spoken(page)).length).toBe(1); // the rest of the conversation never starts
});

test("race: answers wait for a buzz, and a wrong answer passes the turn", async ({ page }) => {
  await startListening(page, { mode: "race", kinds: ["voicemail"], count: "5" });
  await expect(page.locator("#lscores .score")).toHaveCount(2);
  await expect(page.locator("#lOpts .opt").first()).toBeDisabled();
  await page.keyboard.press("1");
  await expect(page.locator("#lOpts .opt.bad")).toHaveCount(0);

  await page.keyboard.press("l");
  await expect(page.locator("#lTurn")).toHaveText("Meri, pick an answer.");
  await expect(page.locator("#lscores .score.p2")).toHaveClass(/buzzed/);
  await page.keyboard.press("a"); // too late
  await expect(page.locator("#lTurn")).toHaveText("Meri, pick an answer.");

  await page.keyboard.press(String((await wrongOpt(page)) + 1));
  await expect(page.locator("#lTurn")).toHaveText("Nicht ganz. Ferran, pick an answer.");
  await page.keyboard.press(String((await rightOpt(page)) + 1));
  await expect(page.locator("#lVerdict")).toHaveText("Richtig! Ein Punkt für Ferran.");
  await expect(page.locator("#lscores .score.p1 b")).toHaveText("1");
  await expect(page.locator("#lscores .score.p2 b")).toHaveText("0");
  await page.keyboard.press("Enter");

  // Nobody knows: N shows the answer without a point.
  const t = await current(page);
  await page.click('#lBuzz [data-act="buzz0"]');
  await page.keyboard.press("n");
  await expect(page.locator("#lVerdict")).toHaveText(`Die Antwort: „${t.a}“`);
  await page.keyboard.press("Enter");

  // Both wrong: the answer is shown and nobody scores.
  await page.keyboard.press("a");
  const wrong = await page.evaluate(() => listen.opts.map((o, n) => (o === listen.deck[listen.i].a ? -1 : n)).filter((n) => n >= 0));
  await page.keyboard.press(String(wrong[0] + 1));
  await page.keyboard.press(String(wrong[1] + 1));
  await expect(page.locator("#lVerdict")).toContainText("Die Antwort");
  await expect(page.locator("#lscores .score.p1 b")).toHaveText("1");
  await expect(page.locator("#lscores .score.p2 b")).toHaveText("0");

  for (let i = 3; i < 5; i++) {
    await page.keyboard.press("Enter");
    await page.keyboard.press("l");
    await page.keyboard.press(String((await rightOpt(page)) + 1));
  }
  await page.keyboard.press("Enter");
  await expect(page.locator("#ldone")).toBeVisible();
  await expect(page.locator("#ldoneTitle")).toHaveText("Meri gewinnt!");
  await expect(page.locator("#lmissed li")).toHaveCount(3);
  await page.click("#lreplayMissed");
  await expect(page.locator("#lprog")).toHaveText("Text 1 / 3");
});

test("a perfect practice round, then play again", async ({ page }) => {
  await startListening(page, { count: "5" });
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press(String((await rightOpt(page)) + 1));
    await expect(page.locator("#lVerdict")).toHaveText("Richtig!");
    await page.keyboard.press("Enter");
  }
  await expect(page.locator("#ldone")).toBeVisible();
  await expect(page.locator("#ldoneTitle")).toHaveText("Perfekt!");
  await expect(page.locator("#lfinal")).toContainText("5 / 5");
  await expect(page.locator("#lmissedWrap")).toBeHidden();
  await expect(page.locator("#lreplayMissed")).toBeHidden();
  await page.click("#lagain");
  await expect(page.locator("#lprog")).toHaveText("Text 1 / 5");
});

test("listening settings are remembered and All plays every text", async ({ page }) => {
  await startListening(page, { mode: "race", kinds: ["radio", "talks"], count: "0" });
  const total = await page.evaluate(() => LISTENING.filter((k) => ["radio", "talks"].includes(k.id)).reduce((a, k) => a + k.items.length, 0));
  await expect(page.locator("#lprog")).toHaveText(`Text 1 / ${total}`);
  await page.reload();
  await page.click('#areas [data-v="listen"]');
  await expect(page.locator('#lmodeSeg [data-v="race"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#lcountSeg [data-v="0"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#kinds [aria-pressed="true"]')).toHaveCount(2);
});

test("player names stay plain text in the listening turn line", async ({ page }) => {
  await open(page);
  await page.click('#modeSeg [data-v="race"]');
  await page.fill("#p2", "<i>Meri</i>");
  await page.click('#areas [data-v="listen"]');
  await page.click('#lmodeSeg [data-v="race"]');
  await expect(page.locator("#lmodeHelp")).toContainText("<i>Meri</i> with L");
  await page.click("#lstart");
  await page.keyboard.press("l");
  await expect(page.locator("#lTurn")).toHaveText("<i>Meri</i>, pick an answer.");
  await expect(page.locator("#lTurn i")).toHaveCount(0);
});
