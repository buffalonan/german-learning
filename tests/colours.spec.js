const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { mockSpeech, open, startRound } = require("./helpers");

// The expected colours live in palette.json, so any change to a colour fails here
// until the file is updated on purpose: UPDATE_PALETTE=1 npx playwright test colours --project=desktop
const PALETTE = path.join(__dirname, "palette.json");

const hex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
const distance = (a, b) => Math.hypot(...[1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)));

// The colour actually drawn on screen at the middle of an element, read from a screenshot.
async function pixel(page, locator) {
  const box = await locator.boundingBox();
  const png = await page.screenshot({ clip: { x: box.x + box.width / 2 - 1, y: box.y + box.height / 2 - 1, width: 3, height: 3 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(1, 1, 1, 1).data.slice(0, 3));
  }, png.toString("base64")).then(hex);
}

// Every :root token whose value is a single colour, as the page computes it right now.
const colourTokens = (page) => page.evaluate(() => {
  const names = new Set();
  // Only the page's own <style>; the Google Fonts sheet is on another origin and can't be read.
  for (const sheet of [...document.styleSheets].filter((s) => !s.href)) {
    const walk = (rules) => {
      for (const r of rules) {
        if (r.cssRules) walk(r.cssRules);
        if (r.selectorText && r.selectorText.startsWith(":root")) for (const p of r.style) if (p.startsWith("--")) names.add(p);
      }
    };
    walk(sheet.cssRules);
  }
  const cs = getComputedStyle(document.documentElement);
  const out = {};
  for (const n of [...names].sort()) {
    const v = cs.getPropertyValue(n).trim();
    if (/^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i.test(v)) out[n] = v;
  }
  return out;
});

async function currentPalette(page) {
  const farben = await page.evaluate(() => Object.fromEntries(TOPICS.find((t) => t.id === "colors").items.map((c) => [c[1], c[0]])));
  const themes = {};
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    themes[theme] = await colourTokens(page);
  }
  return { farben, ...themes };
}

test.describe("colours", () => {
  test.beforeEach(async ({ page }) => { await mockSpeech(page); });

  test("the colours match palette.json", async ({ page }) => {
    await open(page);
    const now = await currentPalette(page);
    if (process.env.UPDATE_PALETTE) fs.writeFileSync(PALETTE, JSON.stringify(now, null, 2) + "\n");
    const saved = JSON.parse(fs.readFileSync(PALETTE, "utf8"));
    expect(now, "A colour changed. If that's intended, update tests/palette.json (see the top of colours.spec.js).").toEqual(saved);
  });

  test("the Farben colours are all clearly different", async ({ page }) => {
    await open(page);
    const fronts = await page.evaluate(() => TOPICS.find((t) => t.id === "colors").items.map((c) => c[0]).filter((f) => f.startsWith("#")));
    for (let a = 0; a < fronts.length; a++) {
      for (let b = a + 1; b < fronts.length; b++) expect(distance(fronts[a], fronts[b]), `${fronts[a]} vs ${fronts[b]}`).toBeGreaterThan(60);
    }
  });

  for (const theme of ["light", "dark"]) {
    test(`every colour card shows its own colour on screen (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await open(page);
      await startRound(page, { mode: "practice", topics: ["colors"], count: "0" });
      const seen = new Set();
      const deck = await page.evaluate(() => game.deck.length);
      for (let k = 0; k < deck; k++) {
        const card = await page.evaluate(() => ({ ...game.deck[game.i], illo: illustration(game.deck[game.i]) }));
        // A colour with a painted picture shows that instead of its "#hex" swatch.
        if (card.illo) {
          await expect(page.locator("#fPic .illo"), card.de).toHaveAttribute("src", card.illo);
        } else if (card.front.startsWith("#")) {
          const swatch = page.locator("#fPic .swatch");
          await expect(swatch).toBeVisible();
          const box = await swatch.boundingBox();
          expect(box.width, card.de).toBeGreaterThan(180);
          expect(await pixel(page, swatch), card.de).toBe(card.front);
        }
        seen.add(card.front);
        await page.keyboard.press(" ");
        await expect(page.locator("#card")).toHaveClass(/flipped/);
        // "Again" on the first card, so the summary has a colour dot to check.
        await page.keyboard.press(k === 0 ? "1" : "2");
        if (k === 0) { await page.keyboard.press(" "); await page.keyboard.press("2"); }
      }
      expect(seen.size).toBe(deck);
      await expect(page.locator("#done")).toBeVisible();
      const missed = await page.evaluate(() => game.missed[0].front);
      if (missed.startsWith("#")) {
        const dot = page.locator("#missed .dot").first();
        await expect(dot).toBeVisible();
        expect(await pixel(page, dot)).toBe(missed);
      }
    });
  }
});
