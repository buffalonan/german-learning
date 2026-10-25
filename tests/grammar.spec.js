const { test, expect } = require("@playwright/test");
const { mockSpeech, spoken, open } = require("./helpers");

test.beforeEach(async ({ page }) => { await mockSpeech(page); });

async function openGrammar(page) {
  const errors = await open(page);
  await page.click('#areas [data-v="grammar"]');
  await expect(page.locator("#grammar")).toBeVisible();
  return errors;
}
// The option button holding the right answer, and one holding a wrong one.
const rightOpt = (page) => page.evaluate(() => quiz.opts.indexOf(quiz.deck[quiz.i].a));
const wrongOpt = (page) => page.evaluate(() => quiz.opts.findIndex((o) => o !== quiz.deck[quiz.i].a));
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("every grammar sentence is complete", async ({ page }) => {
  await open(page);
  const problems = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const l of GRAMMAR) {
      if (!PICS[l.icon]) out.push(`${l.id}: no picture for ${l.icon}`);
      for (const [s, a, wrong, en, es, why] of l.items) {
        if (s.split("___").length !== 2) out.push(`${s}: needs exactly one gap`);
        if (!a || !en || !es || !why) out.push(`${s}: missing a field`);
        if (!Array.isArray(wrong) || wrong.length < 1 || wrong.length > 3) out.push(`${s}: needs 1 to 3 wrong options`);
        if (new Set([a, ...wrong]).size !== wrong.length + 1) out.push(`${s}: options repeat`);
        if (seen.has(s)) out.push(`${s}: duplicate`);
        seen.add(s);
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
});

test("the Grammatik tab shows both lessons and goes back to the cards", async ({ page }) => {
  const errors = await openGrammar(page);
  await expect(page.locator("#setup")).toBeHidden();
  await expect(page.locator("#lessons .lesson")).toHaveCount(2);
  await expect(page.locator("#lessons")).toContainText("Akkusativ & Dativ");
  await expect(page.locator("#lessons")).toContainText("Präpositionen");
  await page.click('#areas [data-v="setup"]');
  await expect(page.locator("#setup")).toBeVisible();
  expect(errors).toEqual([]);
});

test("theory shows one lesson, reads examples aloud and leads to practice", async ({ page }) => {
  await openGrammar(page);
  await page.click('#lessons [data-theory="preps"]');
  await expect(page.locator("#theory")).toBeVisible();
  await expect(page.locator('#theory [data-lesson="preps"]')).toBeVisible();
  await expect(page.locator('#theory [data-lesson="cases"]')).toBeHidden();
  await expect(page.locator("#areas")).toBeHidden();
  expect(await noSideScroll(page)).toBe(true);
  await page.locator('#theory [data-lesson="preps"] .ex', { hasText: "Ich warte auf dich." }).click();
  expect(await spoken(page)).toContain("Ich warte auf dich.");

  await page.click('#theory [data-lesson="preps"] [data-quiz="preps"]');
  await expect(page.locator("#quiz")).toBeVisible();
  await expect(page.locator("#qTopic")).toHaveText("Präpositionen");
});

test("the cases theory fits the screen too", async ({ page }) => {
  await openGrammar(page);
  await page.click('#lessons [data-theory="cases"]');
  await expect(page.locator('#theory [data-lesson="cases"]')).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
});

test("taking turns: a right answer scores, explains and reads the sentence", async ({ page }) => {
  await openGrammar(page);
  await page.click('#gmodeSeg [data-v="turns"]');
  await page.click('#lessons [data-quiz="cases"]');
  await expect(page.locator("#qprog")).toHaveText("Satz 1 / 10");
  await expect(page.locator("#qTurn")).toHaveText("Ferran, your turn");
  await expect(page.locator("#qFeedback")).toBeHidden();
  const q = await page.evaluate(() => quiz.deck[quiz.i]);

  await page.keyboard.press(String((await rightOpt(page)) + 1));
  await expect(page.locator("#qVerdict")).toHaveText("Richtig!");
  await expect(page.locator("#qWhy")).toHaveText(q.why);
  await expect(page.locator("#qSentence .blank")).toHaveText(q.a);
  await expect(page.locator("#qscores .score.p1 b")).toHaveText("1");
  await expect(page.locator("#qOpts .opt").first()).toBeDisabled();
  expect(await spoken(page)).toContain(q.s.replace("___", q.a));

  await page.keyboard.press("Enter");
  await expect(page.locator("#qprog")).toHaveText("Satz 2 / 10");
  await expect(page.locator("#qTurn")).toHaveText("Meri, your turn");
});

test("a wrong answer shows the right one and is listed at the end", async ({ page }) => {
  await openGrammar(page);
  await page.click('#gmodeSeg [data-v="together"]');
  await page.click('#gcountSeg [data-v="10"]');
  await page.click("#mixQuiz");
  await expect(page.locator("#qTurn")).toHaveText("");
  const q = await page.evaluate(() => quiz.deck[quiz.i]);

  await page.locator("#qOpts .opt").nth(await wrongOpt(page)).click();
  await expect(page.locator("#qVerdict")).toHaveText(`Leider falsch: „${q.a}“`);
  await expect(page.locator("#qOpts .opt.ok")).toHaveText(new RegExp(`^${q.a} `));
  await expect(page.locator("#qOpts .opt.bad")).toHaveCount(1);
  await page.click("#qNext");

  for (let i = 1; i < 10; i++) {
    await page.keyboard.press(String((await rightOpt(page)) + 1));
    await page.keyboard.press("Enter");
  }
  await expect(page.locator("#qdone")).toBeVisible();
  await expect(page.locator("#qdoneTitle")).toHaveText("Gut gemacht!");
  await expect(page.locator("#qfinal")).toContainText("9 / 10");
  await expect(page.locator("#qmissed li")).toHaveCount(1);
  await expect(page.locator("#qmissed li b")).toHaveText(q.s.replace("___", q.a));
  await expect(page.locator("#qtheory")).toBeHidden(); // a mixed round has no single lesson to go back to
  await page.click("#qagain");
  await expect(page.locator("#qprog")).toHaveText("Satz 1 / 10");
});

test("keys do nothing until an answer is chosen, and only once", async ({ page }) => {
  await openGrammar(page);
  await page.click('#lessons [data-quiz="preps"]');
  await page.keyboard.press("Enter");
  await expect(page.locator("#qprog")).toHaveText("Satz 1 / 10");
  await page.keyboard.press(String((await wrongOpt(page)) + 1));
  await page.keyboard.press(String((await rightOpt(page)) + 1));
  await expect(page.locator("#qVerdict")).toContainText("Leider falsch");
});

test("player names stay plain text in the turn line", async ({ page }) => {
  await open(page);
  await page.fill("#p1", "<b>Ana</b>");
  await page.click('#areas [data-v="grammar"]');
  await page.click('#gmodeSeg [data-v="turns"]');
  await page.click('#lessons [data-quiz="cases"]');
  await expect(page.locator("#qTurn")).toHaveText("<b>Ana</b>, your turn");
  await expect(page.locator("#qTurn b")).toHaveCount(0);
});

test("grammar settings are remembered and All plays every sentence", async ({ page }) => {
  await openGrammar(page);
  await page.click('#gmodeSeg [data-v="together"]');
  await page.click('#gcountSeg [data-v="0"]');
  await page.reload();
  await page.click('#areas [data-v="grammar"]');
  await expect(page.locator('#gmodeSeg [data-v="together"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#gcountSeg [data-v="0"]')).toHaveAttribute("aria-pressed", "true");
  await page.click('#lessons [data-quiz="cases"]');
  const total = await page.evaluate(() => GRAMMAR.find((l) => l.id === "cases").items.length);
  await expect(page.locator("#qprog")).toHaveText(`Satz 1 / ${total}`);
  expect(await noSideScroll(page)).toBe(true);
  await page.click("#quizQuit");
  await expect(page.locator("#grammar")).toBeVisible();
});
