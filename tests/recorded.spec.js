const { test, expect } = require("@playwright/test");
const { mockSpeech, spoken, open, openPrefs, startRound } = require("./helpers");

// A tenth of a second of silence, served for every recording.
function silentWav() {
  const rate = 8000, samples = 800, data = Buffer.alloc(samples * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// Serves the page as the published copy does (with the recorded-voices tag) and records which audio files it asks for.
// `missing` recordings answer 404, like a text that hasn't been recorded yet.
async function withRecordings(page, { missing = () => false, voices = "thorsten" } = {}) {
  const requested = [];
  await page.route("**/index.html", async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta name="recorded-voices" content="${voices}">`);
    await route.fulfill({ response: res, body });
  });
  await page.route("**/audio/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^.*\/audio\//, "");
    requested.push(path);
    return missing(path) ? route.fulfill({ status: 404, body: "" }) : route.fulfill({ contentType: "audio/wav", body: silentWav() });
  });
  return requested;
}

const nameOf = (page, text) => page.evaluate((t) => audioName(t), text); // eslint-disable-line no-undef

test.describe("recorded voices", () => {
  test("the device voice is the default, and a recording plays once picked", async ({ page }) => {
    await mockSpeech(page);
    const requested = await withRecordings(page);
    await open(page);
    await expect(page.locator("#voice option")).toHaveText(["Anna", "Thorsten (aufgenommen)"]);
    await expect(page.locator("#voice")).toHaveValue("Anna");
    await openPrefs(page);
    await page.selectOption("#voice", "rec:thorsten");
    await page.click("#prefsBack");
    await startRound(page, { topics: ["food"] });
    const c = await page.evaluate(() => game.deck[game.i]);
    await page.keyboard.press(" ");
    const text = `${c.art === "pl" ? "die" : c.art} ${c.de}`;
    await expect.poll(() => requested).toEqual([`thorsten/${await nameOf(page, text)}.mp3`]);
    expect(await spoken(page)).toEqual([]);
  });

  test("with no German device voice, Thorsten is the default", async ({ page }) => {
    await mockSpeech(page, { voices: [] });
    await withRecordings(page);
    await open(page);
    await expect(page.locator("#voice option")).toHaveText(["Thorsten (aufgenommen)"]);
    await expect(page.locator("#voice")).toHaveValue("rec:thorsten");
  });

  test("Kerstin is gone: a saved Kerstin, or her recordings from an old build, give way to the device voice", async ({ page }) => {
    await mockSpeech(page);
    await page.addInitScript(() => localStorage.setItem("sagsDeutsch.settings", JSON.stringify({ voice: "rec:kerstin" })));
    const requested = await withRecordings(page, { voices: "kerstin thorsten" });
    await open(page);
    await expect(page.locator("#voice option")).toHaveText(["Anna", "Thorsten (aufgenommen)"]);
    await expect(page.locator("#voice")).toHaveValue("Anna");
    await openPrefs(page);
    await page.click("#testVoice");
    await expect.poll(() => spoken(page)).toEqual(["Guten Tag! Wie geht's?"]);
    expect(requested).toEqual([]);
  });

  test("the recording can be chosen and is remembered", async ({ page }) => {
    await mockSpeech(page);
    const requested = await withRecordings(page);
    await open(page);
    await openPrefs(page);
    await page.selectOption("#voice", "rec:thorsten");
    await page.reload();
    await openPrefs(page);
    await expect(page.locator("#voice")).toHaveValue("rec:thorsten");
    await page.click("#testVoice");
    await expect.poll(() => requested).toEqual([`thorsten/${await nameOf(page, "Guten Tag! Wie geht's?")}.mp3`]);
  });

  test("a text without a recording is read by the device voice", async ({ page }) => {
    await mockSpeech(page);
    const requested = await withRecordings(page, { missing: () => true });
    await open(page);
    await openPrefs(page);
    await page.selectOption("#voice", "rec:thorsten");
    await page.click("#testVoice");
    await expect.poll(() => spoken(page)).toEqual(["Guten Tag! Wie geht's?"]);
    expect(requested).toHaveLength(1);
  });

  test("in Chrome the device voice offered is Google Deutsch, and it reads aloud", async ({ page }) => {
    await mockSpeech(page, { voices: [
      { name: "Anna", lang: "de-DE", localService: true },
      { name: "Google Deutsch", lang: "de-DE", localService: false },
      { name: "Petra", lang: "de-DE", localService: true },
    ] });
    const requested = await withRecordings(page);
    await open(page);
    await expect(page.locator("#voice option")).toHaveText(["Google Deutsch (online)", "Thorsten (aufgenommen)"]);
    await expect(page.locator("#voice")).toHaveValue("Google Deutsch");
    await openPrefs(page);
    await page.click("#testVoice");
    await expect.poll(() => page.evaluate(() => window.__spoken.map((s) => s.voice))).toEqual(["Google Deutsch"]);
    expect(requested).toEqual([]);
  });

  test("on phones (German Germany) and Safari, the best installed voice is offered", async ({ page }) => {
    await mockSpeech(page, { voices: [
      { name: "Deutsch Deutschland", lang: "de-DE", localService: false },
      { name: "German Germany", lang: "de_DE", localService: true },
    ] });
    await withRecordings(page);
    await open(page);
    await expect(page.locator("#voice option")).toHaveText(["German Germany", "Thorsten (aufgenommen)"]);
    await expect(page.locator("#voice")).toHaveValue("German Germany");
  });

  test("a device voice saved before, no longer in the menu, gives way to the offered one", async ({ page }) => {
    await mockSpeech(page, { voices: [
      { name: "Anna", lang: "de-DE", localService: true },
      { name: "Google Deutsch", lang: "de-DE", localService: false },
    ] });
    await page.addInitScript(() => localStorage.setItem("sagsDeutsch.settings", JSON.stringify({ voice: "Anna" })));
    await withRecordings(page);
    await open(page);
    await expect(page.locator("#voice")).toHaveValue("Google Deutsch");
  });

  test("file names stay the same, so recordings from earlier builds still match", async ({ page }) => {
    await open(page);
    expect(await nameOf(page, "Guten Tag! Wie geht's?")).toBe("22-8847c897");
    expect(await nameOf(page, "die Äpfel")).toMatch(/^9-[0-9a-f]{8}$/);
  });

  test("the page lists every text it can read aloud, without duplicates", async ({ page }) => {
    await open(page);
    const texts = await page.evaluate(() => spokenTexts()); // eslint-disable-line no-undef
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts).toContain("Guten Tag! Wie geht's?");
    expect(texts).toContain("Ich sehe den Hund.");
    const nCards = await page.evaluate(() => TOPICS.reduce((a, t) => a + t.items.length, 0));
    expect(texts.length).toBeGreaterThan(nCards / 2);
  });
});

// Only Thorsten is recorded, so the second speaker is the device's German voice, or Thorsten played higher without one.
async function playConversation(page) {
  await openPrefs(page);
  await page.selectOption("#voice", "rec:thorsten");
  await page.click("#prefsBack");
  await page.click('#areas [data-v="listen"]');
  for (const id of ["announce", "voicemail", "radio", "tours"]) await page.click(`#kinds [data-id="${id}"]`);
  await page.click("#lstart");
  const lines = await page.evaluate(() => listen.deck[listen.i].lines);
  return { lines, names: await Promise.all(lines.map((l) => nameOf(page, l))) };
}

test("a recorded conversation alternates Thorsten and the device voice", async ({ page }) => {
  await mockSpeech(page);
  const requested = await withRecordings(page);
  await open(page);
  const { lines, names } = await playConversation(page);
  await expect.poll(() => spoken(page), { timeout: 15000 }).toEqual(lines.filter((l, i) => i % 2));
  expect(requested).toEqual(names.filter((n, i) => i % 2 === 0).map((n) => `thorsten/${n}.mp3`));
  expect(await page.evaluate(() => window.__spoken.map((s) => s.pitch))).toEqual(lines.filter((l, i) => i % 2).map(() => 1));
});

test("with no device voice, a recorded conversation is Thorsten twice, the second played higher", async ({ page }) => {
  await mockSpeech(page, { voices: [] });
  const requested = await withRecordings(page);
  await page.addInitScript(() => {
    window.__rates = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__rates.push(this.playbackRate); return play.call(this); };
  });
  await open(page);
  const { names } = await playConversation(page);
  await expect.poll(() => requested, { timeout: 15000 }).toEqual(names.map((n) => `thorsten/${n}.mp3`));
  expect(await page.evaluate(() => window.__rates)).toEqual(names.map((n, i) => (i % 2 ? 1.15 : 1)));
});
