// @ts-check
// Smoke test of the real Android app in an emulator. Run by .github/workflows/android.yml,
// with the debug APK installed and adb on the PATH. Not part of `npm test`.
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  workers: 1,
  timeout: 120_000,
  retries: 0,
  reporter: [["list"]],
});
