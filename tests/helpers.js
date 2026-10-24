const { expect } = require("@playwright/test");

// Replaces the browser's speech engine so tests can see what would be spoken.
function mockSpeech(page, { voices = [{ name: "Anna", lang: "de-DE", localService: true }], plays = true } = {}) {
  return page.addInitScript(({ voices, plays }) => {
    window.__spoken = [];
    const synth = {
      speaking: false, pending: false,
      getVoices: () => voices,
      cancel() {}, resume() {}, addEventListener() {},
      speak(u) {
        window.__spoken.push({ text: u.text, voice: u.voice ? u.voice.name : null, lang: u.lang });
        if (plays) setTimeout(() => u.onstart && u.onstart(), 0);
      },
    };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  }, { voices, plays });
}

const spoken = (page) => page.evaluate(() => window.__spoken.map((s) => s.text));

async function open(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/index.html");
  await expect(page.locator("#setup")).toBeVisible();
  return errors;
}

async function chooseTopics(page, ids) {
  await page.click("#noTopics");
  for (const id of ids) await page.click(`#topics [data-id="${id}"]`);
}

async function startRound(page, { mode = "race", topics = ["food"], count = "10", hint } = {}) {
  await chooseTopics(page, topics);
  await page.click(`#modeSeg [data-v="${mode}"]`);
  await page.click(`#countSeg [data-v="${count}"]`);
  if (hint) await page.click(`#hintSeg [data-v="${hint}"]`);
  await page.click("#start");
  await expect(page.locator("#play")).toBeVisible();
}

const isFlipped = (page) => page.locator("#card").evaluate((el) => el.classList.contains("flipped"));

module.exports = { mockSpeech, spoken, open, chooseTopics, startRound, isFlipped };
