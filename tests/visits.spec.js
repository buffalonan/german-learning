const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { mockSpeech, open, openPrefs } = require("./helpers");

const COUNTER = "https://abacus.jasoncameron.dev/**";

// Serves the page as the published web copy does (with the visitor-counter tag) and answers the counter
// with `reply(kind)`, recording whether each request was a "hit" or a "get".
async function withCounter(page, reply = () => ({ json: { value: 1234 } })) {
  const asked = [];
  await page.route("**/index.html", async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="visitor-counter" content="buffalonan-german-learning/besucher">');
    await route.fulfill({ response: res, body });
  });
  await page.route(COUNTER, (route) => {
    const url = new URL(route.request().url());
    const kind = url.pathname.split("/")[1];
    asked.push(`${kind} ${url.pathname.slice(kind.length + 2)}`);
    const r = reply(kind);
    return r === "abort" ? route.abort() : route.fulfill({ status: r.status || 200, contentType: "application/json", json: r.json });
  });
  return asked;
}

test.describe("visitor counter", () => {
  test("a first visit adds one and shows the count, later visits only read it", async ({ page }) => {
    await mockSpeech(page);
    const asked = await withCounter(page);
    await open(page);
    await expect(page.locator("#visits")).toHaveText("1.234 Besucher");
    await page.reload();
    await expect(page.locator("#visits")).toBeVisible();
    expect(asked).toEqual(["hit buffalonan-german-learning/besucher", "get buffalonan-german-learning/besucher"]);
  });

  test("it shows only on the sections, not on other screens", async ({ page }) => {
    await mockSpeech(page);
    await withCounter(page);
    await open(page);
    await expect(page.locator("#visits")).toBeVisible();
    await page.click("#areas [data-v=listen]");
    await expect(page.locator("#visits")).toBeVisible();
    await openPrefs(page);
    await expect(page.locator("#visits")).toBeHidden();
    await page.click("#prefsBack");
    await expect(page.locator("#visits")).toBeVisible();
  });

  test("offline or on an error it stays hidden and the page still works", async ({ page }) => {
    await mockSpeech(page);
    let reply = "abort";
    await withCounter(page, () => reply);
    const errors = await open(page);
    await page.waitForTimeout(300);
    await expect(page.locator("#visits")).toBeHidden();
    expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);

    // A failed first visit isn't remembered, so the next one still counts.
    reply = { status: 500, json: { error: "down" } };
    const asked = [];
    page.on("request", (r) => { if (r.url().includes("abacus")) asked.push(new URL(r.url()).pathname.split("/")[1]); });
    await page.reload();
    await page.waitForTimeout(300);
    await expect(page.locator("#visits")).toBeHidden();
    expect(asked).toEqual(["hit"]);
  });

  test("a strange answer shows nothing", async ({ page }) => {
    await mockSpeech(page);
    await withCounter(page, () => ({ json: { value: "<b>lots</b>" } }));
    await open(page);
    await page.waitForTimeout(300);
    await expect(page.locator("#visits")).toBeHidden();
  });

  test("the plain page (app, local copy) never asks the counter", async ({ page }) => {
    await mockSpeech(page);
    const asked = [];
    await page.route(COUNTER, (route) => { asked.push(route.request().url()); return route.abort(); });
    await open(page);
    await page.waitForTimeout(300);
    await expect(page.locator("#visits")).toBeHidden();
    expect(asked).toEqual([]);
  });

  test("only the web build gets the counter tag", async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    test.skip(testInfo.project.name !== "desktop", "a build check, once is enough");
    const root = path.join(__dirname, "..");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "visits-"));
    try {
      execFileSync("node", ["scripts/build-app-web.js", path.join(tmp, "web"), "--web"], { cwd: root });
      execFileSync("node", ["scripts/build-app-web.js", path.join(tmp, "app")], { cwd: root });
      expect(fs.readFileSync(path.join(tmp, "web", "index.html"), "utf8")).toContain('<meta name="visitor-counter" content="buffalonan-german-learning/besucher">'); // eslint-disable-line security/detect-non-literal-fs-filename
      expect(fs.readFileSync(path.join(tmp, "app", "index.html"), "utf8")).not.toContain("buffalonan-german-learning/besucher"); // eslint-disable-line security/detect-non-literal-fs-filename
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
