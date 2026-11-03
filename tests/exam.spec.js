const { test, expect } = require("@playwright/test");
const { mockSpeech, spoken, open } = require("./helpers");

test.beforeEach(async ({ page }) => { await mockSpeech(page); });

async function openExam(page) {
  const errors = await open(page);
  await page.click('#areas [data-v="exam"]');
  await expect(page.locator("#exam")).toBeVisible();
  return errors;
}
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("every exam task, text and model answer is complete", async ({ page }) => {
  await open(page);
  const problems = await page.evaluate(() => {
    const out = [];
    for (const t of EXAM_TASKS) if (!PICS[t.icon]) out.push(`${t.id}: no picture for ${t.icon}`);
    for (const m of MEETINGS) if (m.length !== 3 || m.some((x) => !x)) out.push(`meeting ${m[0]}: missing a field`);
    for (const p of PLANS) if (p.length !== 4 || p.slice(0, 3).some((x) => !x) || p[3].length !== 4) out.push(`plan ${p[0]}: needs a task, translations and four points`);
    if (new Set(ERRANDS).size !== ERRANDS.length || ERRANDS.length < DIARY_HOURS.length) out.push("errands repeat or are too few");
    for (const [k, list] of Object.entries(SPEAK_PHRASES)) if (!list.length) out.push(`${k}: no phrases`);
    const seen = new Set();
    for (const k of READING) {
      for (const [text, q, a, wrong, en, es] of k.items) {
        if (!text || !q || !a || !en || !es) out.push(`${k.id}: ${q}: missing a field`);
        if (!Array.isArray(wrong) || wrong.length < 1 || wrong.length > 2) out.push(`${k.id}: ${q}: needs 1 or 2 wrong options`);
        if (new Set([a, ...wrong]).size !== wrong.length + 1) out.push(`${k.id}: ${q}: options repeat`);
        if (seen.has(text)) out.push(`${k.id}: ${q}: duplicate`);
        seen.add(text);
      }
    }
    for (const w of WRITING) {
      if (!["A2", "B1"].includes(w.level) || !w.words || !w.de || !w.en || !w.es || !w.model || !w.modelEn) out.push(`${w.de}: missing a field`);
      if (w.points.length !== 3) out.push(`${w.de}: needs three points`);
    }
    return out;
  });
  expect(problems).toEqual([]);
});

test("each task number gives two diaries with exactly one hour both are free", async ({ page }) => {
  await open(page);
  const bad = await page.evaluate(() => {
    const out = [];
    for (let code = 1000; code < 1400; code++) {
      const d = diaries(code);
      const both = DIARY_HOURS.filter((h) => !d.days[0][h] && !d.days[1][h]);
      if (both.length !== 1 || both[0] !== d.free) out.push(`${code}: free ${both.join(",")}`);
      if (d.free === DIARY_HOURS[0] || d.free === DIARY_HOURS.at(-1)) out.push(`${code}: free at the edge of the day`);
      if (JSON.stringify(diaries(code)) !== JSON.stringify(d)) out.push(`${code}: not the same twice`);
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test("the Prüfung tab lists speaking, reading and writing", async ({ page }) => {
  const errors = await openExam(page);
  await expect(page.locator("#tasks .lesson")).toHaveCount(4);
  for (const name of ["Termin finden", "Gemeinsam planen", "Lesen", "Schreiben"]) await expect(page.locator("#tasks")).toContainText(name);
  expect(await noSideScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});

test("find a time: each player sees their own diary, and a task number opens the same task", async ({ page }) => {
  await openExam(page);
  await page.click('[data-task="termin"]');
  await expect(page.locator("#talk")).toBeVisible();
  await expect(page.locator("#areas")).toBeHidden();
  const code = Number(await page.locator("#taskNo").textContent());
  const d = await page.evaluate((c) => diaries(c), code);
  await expect(page.locator("#tTask")).toHaveText(`${d.meeting[0]} Wann habt ihr beide Zeit?`);
  await expect(page.locator("#tDiary li")).toHaveCount(0);
  await expect(page.locator("#tSolve")).toBeVisible();

  await page.click('#whoSeg [data-v="1"]');
  await expect(page.locator("#tDiary li")).toHaveCount(11);
  await expect(page.locator("#tDiary li.busy")).toHaveCount(Object.keys(d.days[1]).length);
  await expect(page.locator("#tDiary li", { hasText: `${d.free}:00` })).not.toHaveClass(/busy/);
  expect(await noSideScroll(page)).toBe(true);

  await page.locator("#tPhrases .ex").first().click();
  expect(await spoken(page)).toEqual(["Hast du am Vormittag Zeit?"]);

  await page.click("#tSolve");
  await expect(page.locator("#tSolution")).toHaveText(`Ihr habt beide um ${d.free} Uhr Zeit.`);

  await page.click("#tNew");
  await expect(page.locator("#tSolution")).toBeHidden();
  await expect(page.locator("#taskNo")).not.toHaveText(String(code));
  await page.fill("#tCode", String(code));
  await page.click('#tCodeForm [type="submit"]');
  await expect(page.locator("#taskNo")).toHaveText(String(code));
  await page.click('#whoSeg [data-v="0"]');
  await expect(page.locator("#tDiary li.busy")).toHaveCount(Object.keys(d.days[0]).length);

  await page.click("#talkBack");
  await expect(page.locator("#exam")).toBeVisible();
});

test("player names stay plain text on the diary buttons", async ({ page }) => {
  await open(page);
  await page.click('#modeSeg [data-v="race"]');
  await page.fill("#p2", "<i>Meri</i>");
  await page.click('#areas [data-v="exam"]');
  await page.click('[data-task="termin"]');
  await expect(page.locator('#whoSeg [data-v="1"]')).toHaveText("<i>Meri</i>");
  await expect(page.locator("#whoSeg i")).toHaveCount(0);
});

test("plan together shows the four points to talk through and no diary", async ({ page }) => {
  await openExam(page);
  await page.click('[data-task="planen"]');
  const code = Number(await page.locator("#taskNo").textContent());
  const plan = await page.evaluate((c) => planFor(c), code);
  await expect(page.locator("#tTask")).toHaveText(plan[0]);
  await expect(page.locator("#tPoints li")).toHaveText(plan[3]);
  await expect(page.locator("#tDiaryWrap")).toBeHidden();
  await expect(page.locator("#tSolve")).toBeHidden();
  await expect(page.locator("#tPhrases .ex")).toHaveCount(6);
});

test("reading: a wrong answer can be tried again, and a round has eight texts", async ({ page }) => {
  await openExam(page);
  await page.click('[data-task="lesen"]');
  await expect(page.locator("#rprog")).toHaveText("Text 1 / 8");
  const t = await page.evaluate(() => reading.deck[0]);
  await expect(page.locator("#rText")).toHaveText(t.text);
  await expect(page.locator("#rQuestion")).toHaveText(t.q);
  const wrong = await page.evaluate(() => reading.opts.findIndex((o) => o !== reading.deck[0].a));
  await page.keyboard.press(String(wrong + 1));
  await expect(page.locator("#rOpts .opt.bad")).toHaveCount(1);
  await expect(page.locator("#rFeedback")).toBeHidden();
  const right = await page.evaluate(() => reading.opts.indexOf(reading.deck[0].a));
  await page.locator("#rOpts .opt").nth(right).click();
  await expect(page.locator("#rVerdict")).toHaveText("Jetzt stimmt's!");
  await expect(page.locator("#rEn")).toHaveText(t.en);
  await expect(page.locator("#rscores")).toContainText("Gewusst0");
  expect(await noSideScroll(page)).toBe(true);

  for (let i = 1; i < 8; i++) {
    await page.keyboard.press("Enter");
    await expect(page.locator("#rprog")).toHaveText(`Text ${i + 1} / 8`);
    await page.keyboard.press(String((await page.evaluate(() => reading.opts.indexOf(reading.deck[reading.i].a))) + 1));
    await expect(page.locator("#rVerdict")).toHaveText("Richtig!");
  }
  await page.keyboard.press("Enter");
  await expect(page.locator("#rFinal")).toHaveText("Fertig! 7 / 8 right first time.");
  await page.click("#rAgain");
  await expect(page.locator("#rprog")).toHaveText("Text 1 / 8");
});

test("writing: count the words, then compare with the model answer", async ({ page }) => {
  await openExam(page);
  await page.click('[data-task="schreiben"]');
  const first = await page.locator("#wTask").textContent();
  const w = await page.evaluate(() => WRITING[writeIdx]);
  await expect(page.locator("#wPoints li")).toHaveText(w.points);
  await expect(page.locator("#wCount")).toHaveText(`0 words · aim for about ${w.words}`);
  await page.fill("#wText", "Lieber Paul, vielen Dank!");
  await expect(page.locator("#wCount")).toHaveText(`4 words · aim for about ${w.words}`);
  await expect(page.locator("#wModelBox")).toBeHidden();
  await page.click("#wModel");
  await expect(page.locator("#wModelBox")).toBeVisible();
  await expect(page.locator("#wModelEn")).toHaveText(w.modelEn);
  expect(await noSideScroll(page)).toBe(true);
  await page.click("#wNew");
  await expect(page.locator("#wTask")).not.toHaveText(first);
  await expect(page.locator("#wText")).toHaveValue("");
  await expect(page.locator("#wModelBox")).toBeHidden();
});
