const { test, expect, _android } = require("@playwright/test");

const PKG = "io.github.buffalonan.sagsdeutsch";

test("the app opens, plays a card and has the phone's voice plugin", async () => {
  const [device] = await _android.devices();
  expect(device, "no emulator found by adb").toBeTruthy();
  try {
    await device.shell(`am start -W -n ${PKG}/.MainActivity`);
    // Debug builds let Playwright drive the app's WebView like a browser tab.
    const page = await (await device.webView({ pkg: PKG }, { timeout: 60_000 })).page();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await expect(page.locator("#setup")).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => window.Capacitor.isNativePlatform())).toBe(true);
    // The native text-to-speech plugin is built in, so the page reads aloud through it.
    expect(await page.evaluate(() => window.Capacitor.isPluginAvailable("TextToSpeech"))).toBe(true);
    expect(await page.evaluate(() => typeof window.speechSynthesis)).toBe("undefined");

    await page.click("#start");
    await expect(page.locator("#play")).toBeVisible();
    await page.click("#card");
    await expect(page.locator("#card")).toHaveClass(/flipped/);
    await expect(page.locator("#bDe")).not.toBeEmpty();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  } finally {
    await device.close();
  }
});
