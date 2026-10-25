// Writes every text the game reads aloud, with its audio file name, to the file given (JSON: [{ name, text }]).
// It opens index.html in Chromium and asks the page itself (spokenTexts, audioName), so nothing is duplicated here.
// Usage: node scripts/list-spoken.js audio-texts.json
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

(async () => {
  const out = process.argv[2];
  if (!out) throw new Error("Usage: node scripts/list-spoken.js <out.json>");
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }); // CHROMIUM_PATH: optional, for a local browser
  const page = await browser.newPage();
  await page.goto("file://" + path.join(__dirname, "..", "index.html"));
  const texts = await page.evaluate(() => spokenTexts().map((text) => ({ name: audioName(text), text }))); // eslint-disable-line no-undef
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(texts, null, 1));
  console.log(`${texts.length} texts to record`);
})().catch((e) => { console.error(e); process.exit(1); });
