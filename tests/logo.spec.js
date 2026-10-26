const { test, expect } = require("@playwright/test");
const { open } = require("./helpers");

test("the hedgehog logo shows beside the title and fits at phone width", async ({ page }) => {
  await open(page);
  const logo = page.locator("#setup .brand .logo");
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  const [l, t] = [await logo.boundingBox(), await page.locator("#setup .brand h1").boundingBox()];
  expect(l.x + l.width).toBeLessThanOrEqual(t.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});

test("the logo is square and spans from the top of the flag bar to the subtitle", async ({ page }) => {
  await open(page);
  const plate = page.locator("#setup .brand .plate");
  await expect(async () => {
    const [l, p] = [await page.locator("#logo").boundingBox(), await plate.boundingBox()];
    expect(Math.abs(l.width - l.height)).toBeLessThan(1);
    expect(Math.abs(l.y - p.y)).toBeLessThan(1);
    expect(Math.abs(l.y + l.height - (p.y + p.height))).toBeLessThan(2);
  }).toPass();
});

test("the favicon, touch icon and manifest icons exist at their stated sizes", async ({ page, request }) => {
  await open(page);
  const links = await page.evaluate(() => ({
    icon: document.querySelector('link[rel="icon"]').getAttribute("href"),
    touch: document.querySelector('link[rel="apple-touch-icon"]').getAttribute("href"),
    manifest: document.querySelector('link[rel="manifest"]').getAttribute("href"),
  }));
  const manifest = await (await request.get(links.manifest)).json();
  const icons = [{ src: links.icon, sizes: "32x32" }, { src: links.touch, sizes: "180x180" }, ...manifest.icons];
  for (const { src, sizes } of icons) {
    expect((await request.get(src)).ok(), src).toBe(true);
    const size = await page.evaluate(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      return `${img.naturalWidth}x${img.naturalHeight}`;
    }, src);
    expect(size, src).toBe(sizes);
  }
});

for (const width of [320, 360, 412]) {
  test(`the logo settles without resize errors at ${width}px`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => addEventListener("error", (e) => console.error(`window error: ${e.message}`)));
    page.on("console", (m) => m.type() === "error" && /ResizeObserver|window error/.test(m.text()) && errors.push(m.text()));
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    const size = () => page.locator("#logo").evaluate((img) => img.offsetHeight);
    await expect.poll(size).toBeGreaterThan(80);
    const settled = await size();
    await page.waitForTimeout(300);
    expect(await size()).toBe(settled);
    expect(settled).toBeLessThanOrEqual(Math.round(width * 0.32));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
  });
}
