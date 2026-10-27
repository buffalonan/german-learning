const { test, expect } = require("@playwright/test");
const { mockSpeech, open } = require("./helpers");

test.beforeEach(async ({ page }) => { await mockSpeech(page); });

const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("the light/dark button switches the theme and remembers it", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page);
  const lightBg = await bg(page);
  await expect(page.locator("#theme")).toHaveAttribute("aria-label", "Switch to dark mode");
  await page.click("#theme");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#theme")).toHaveAttribute("aria-label", "Switch to light mode");
  expect(await bg(page)).not.toBe(lightBg);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.click("#theme");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await bg(page)).toBe(lightBg);
});

test("with no saved choice the page follows the system and the button offers the other mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  await expect(page.locator("#theme")).toHaveAttribute("aria-label", "Switch to light mode");
  await page.click("#theme");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("the light/dark button shows on the menus but not during a round", async ({ page }) => {
  await open(page);
  await expect(page.locator("#theme")).toBeVisible();
  await page.click("#start");
  await expect(page.locator("#theme")).toBeHidden();
});

// Ferran's phone is 360px wide; the tabs wrapped onto two lines there once Hören was added.
for (const width of [320, 360, 412]) {
  test(`the section tabs stay on one line at ${width}px, even with a fourth tab`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    const layout = () => page.evaluate(() => {
      const tabs = [...document.querySelectorAll("#areas button")];
      const rows = new Set(tabs.map((b) => Math.round(b.getBoundingClientRect().top)));
      const theme = document.getElementById("theme").getBoundingClientRect();
      const overlap = tabs.some((b) => { const r = b.getBoundingClientRect(); return r.right > theme.left && r.left < theme.right && r.bottom > theme.top && r.top < theme.bottom; });
      return { rows: rows.size, clipped: tabs.some((b) => b.scrollWidth > b.clientWidth), overlap, sideScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    const ok = { rows: 1, clipped: false, overlap: false, sideScroll: false };
    expect(await layout()).toEqual(ok);
    await page.evaluate(() => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = "Perfekt";
      document.getElementById("areas").append(b);
    });
    expect(await layout()).toEqual(ok);
    await expect(page.locator("#theme")).toBeInViewport();

    // Out of the tab row, the light/dark button sits beside each area's title and must not cover its text.
    for (const area of ["setup", "grammar", "listen"]) {
      await page.click(`#areas [data-v="${area}"]`);
      const covered = await page.evaluate((id) => {
        const t = document.getElementById("theme").getBoundingClientRect();
        const walk = document.createTreeWalker(document.querySelector(`#${id} .intro`), NodeFilter.SHOW_TEXT);
        const rects = [];
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(n);
          rects.push(...range.getClientRects());
        }
        return rects.some((r) => r.width && r.right > t.left && r.left < t.right && r.bottom > t.top && r.top < t.bottom);
      }, area);
      expect(covered, area).toBe(false);
    }
  });
}

for (const width of [320, 360, 412, 1280]) {
  test(`at ${width}px the tab labels are evenly spaced and the title block sits tidy`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    const m = await page.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const bar = r(document.getElementById("areas"));
      const text = [...document.querySelectorAll("#areas button")].map((b) => { const g = document.createRange(); g.selectNodeContents(b); return g.getBoundingClientRect(); });
      const between = text.slice(1).map((t, i) => t.left - text[i].right);
      const ends = [text[0].left - bar.left, bar.right - text.at(-1).right];
      const small = document.querySelector("#setup .plate small");
      const lineHeight = parseFloat(getComputedStyle(small).lineHeight) || 24;
      const h1 = document.querySelector("#setup h1"), firstLine = parseFloat(getComputedStyle(h1).lineHeight);
      const theme = r(document.getElementById("theme"));
      return { between, ends, subtitleLines: Math.round(r(small).height / lineHeight), themeMid: (theme.top + theme.bottom) / 2, lineMid: r(h1).top + firstLine / 2, themeInTopbar: theme.top < r(document.getElementById("topbar")).bottom };
    });
    expect(Math.max(...m.between) - Math.min(...m.between)).toBeLessThan(2);
    expect(Math.abs(m.ends[0] - m.ends[1])).toBeLessThan(2);
    expect(Math.min(...m.ends)).toBeGreaterThan(Math.max(...m.between) * 0.6);
    expect(m.subtitleLines).toBe(1);
    // On phones the light/dark button sits level with the title's first line.
    if (width <= 640) expect(Math.abs(m.themeMid - m.lineMid)).toBeLessThan(3);
    else expect(m.themeInTopbar).toBe(true);
  });
}
