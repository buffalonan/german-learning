const { test, expect } = require("@playwright/test");
const { execFileSync } = require("child_process");
const path = require("path");
const { mockSpeech, mockNativeSpeech, spoken, open, startRound } = require("./helpers");

const phoneVoices = [
  { name: "en-us-x-sfg-local", lang: "en-US", localService: true },
  { name: "de-de-x-deb-network", lang: "de-DE", localService: false },
  { name: "de-de-x-nfh-local", lang: "de-DE", localService: true },
];

test.describe("in the Android app", () => {
  test("the phone's German voices fill the menu once its engine is ready", async ({ page }) => {
    await mockNativeSpeech(page, { voices: phoneVoices, notReadyFor: 2 });
    const errors = await open(page);
    await expect(page.locator("#voice option")).toHaveCount(2);
    await expect(page.locator("#voice")).toHaveValue("de-de-x-nfh-local");
    expect(errors).toEqual([]);
  });

  test("flipping reads the German through the phone's engine", async ({ page }) => {
    await mockNativeSpeech(page, { voices: phoneVoices });
    await open(page);
    await expect(page.locator("#voice option")).toHaveCount(2);
    await startRound(page, { topics: ["food"] });
    const c = await page.evaluate(() => game.deck[game.i]);
    await page.keyboard.press(" ");
    const art = c.art === "pl" ? "die" : c.art;
    // The plugin picks a voice by its place in the phone's full voice list.
    expect(await page.evaluate(() => window.__spoken)).toEqual([{ text: `${art} ${c.de}`, voice: 2, lang: "de-DE" }]);
    await page.click("#quit");
    expect(await page.evaluate(() => window.__stopped)).toBe(1);
  });

  test("a chosen phone voice is used", async ({ page }) => {
    await mockNativeSpeech(page, { voices: phoneVoices });
    await open(page);
    await page.selectOption("#voice", "de-de-x-deb-network");
    await page.click("#testVoice");
    expect(await page.evaluate(() => window.__spoken[0].voice)).toBe(1);
  });

  test("explains how to add a German voice when the phone has none", async ({ page }) => {
    await mockNativeSpeech(page, { voices: phoneVoices.slice(0, 1), speakError: "This language is not supported." });
    await open(page);
    await page.click("#testVoice");
    await expect(page.locator("#soundNote")).toContainText("Install voice data → Deutsch");
    expect(await page.evaluate(() => window.__spoken[0].lang)).toBe("de-DE");
  });
});

test("the app copy of the page loads Capacitor and still plays in a browser", async ({ page }, testInfo) => {
  const out = testInfo.outputPath("www");
  execFileSync(process.execPath, [path.join(__dirname, "..", "scripts", "build-app-web.js"), out]);
  await mockSpeech(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/" + path.relative(path.join(__dirname, ".."), out).split(path.sep).join("/") + "/index.html");
  expect(await page.evaluate(() => typeof window.Capacitor.registerPlugin)).toBe("function");
  await startRound(page);
  await page.keyboard.press(" ");
  expect((await spoken(page)).length).toBe(1);
  expect(errors).toEqual([]);
});
