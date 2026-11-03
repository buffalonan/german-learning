const { test, expect } = require("@playwright/test");
const { mockSpeech, spoken } = require("./helpers");

// Zwei Handys: two pages in one browser stand in for two phones. PeerJS is replaced by a fake that passes messages
// between the pages with a BroadcastChannel, the way PeerJS passes them between phones, so the whole game runs.
function fakePeer(page) {
  return page.addInitScript(() => {
    const bus = new BroadcastChannel("fake-peerjs");
    const peers = new Map();
    class Emitter {
      constructor() { this.handlers = {}; }
      on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
      emit(ev, ...args) { for (const fn of this.handlers[ev] || []) fn(...args); }
    }
    class Conn extends Emitter {
      constructor(cid, self, peer) { super(); Object.assign(this, { cid, self, peer, open: false }); }
      send(data) { bus.postMessage({ type: "data", cid: this.cid, to: this.peer, data: JSON.parse(JSON.stringify(data)) }); }
      close() { if (!this.open) return; this.open = false; bus.postMessage({ type: "close", cid: this.cid, to: this.peer }); this.emit("close"); }
    }
    const conns = new Map();
    class Peer extends Emitter {
      constructor(id) {
        super();
        this.id = id || `guest-${Math.random().toString(36).slice(2)}`;
        peers.set(this.id, this);
        bus.postMessage({ type: "claim", id: this.id });
        setTimeout(() => this.emit("open", this.id), 20);
      }
      connect(target) {
        const cid = Math.random().toString(36).slice(2);
        const conn = new Conn(cid, this.id, target);
        conns.set(cid, conn);
        bus.postMessage({ type: "connect", cid, from: this.id, to: target });
        conn.timer = setTimeout(() => this.emit("error", { type: "peer-unavailable" }), 400);
        return conn;
      }
      destroy() { peers.delete(this.id); for (const c of conns.values()) if (c.self === this.id) c.close(); }
    }
    bus.onmessage = ({ data: m }) => {
      if (m.type === "connect" && peers.has(m.to)) {
        const conn = new Conn(m.cid, m.to, m.from);
        conns.set(m.cid, conn);
        peers.get(m.to).emit("connection", conn);
        bus.postMessage({ type: "accept", cid: m.cid, to: m.from });
        setTimeout(() => { conn.open = true; conn.emit("open"); }, 10);
      } else if (m.type === "accept" && conns.has(m.cid) && peers.has(m.to)) {
        const conn = conns.get(m.cid);
        clearTimeout(conn.timer);
        setTimeout(() => { conn.open = true; conn.emit("open"); }, 10);
      } else if (m.type === "data" && conns.has(m.cid) && peers.has(m.to)) {
        conns.get(m.cid).emit("data", m.data);
      } else if (m.type === "close" && conns.has(m.cid) && peers.has(m.to)) {
        const conn = conns.get(m.cid);
        if (conn.open) { conn.open = false; conn.emit("close"); }
      }
    };
    window.Peer = Peer;
  });
}

async function phone(context, name) {
  const page = await context.newPage();
  await mockSpeech(page);
  await fakePeer(page);
  await page.goto("/index.html");
  await page.locator("section:not([hidden]) [data-duo]").first().click();
  await expect(page.locator("#duo")).toBeVisible();
  await page.fill("#duoName", name);
  return page;
}

// Ferran makes the room, Meri joins with its code.
async function pair(context) {
  const host = await phone(context, "Ferran");
  const guest = await phone(context, "Meri");
  await host.click("#duoHost");
  const code = (await host.locator("#duoCodeShow").textContent()).trim();
  expect(code).toMatch(/^[0-9]{4}$/);
  await guest.fill("#duoCode", code);
  await guest.click("#duoJoinForm button");
  for (const p of [host, guest]) await expect(p.locator("#duoVs")).toHaveText("Ferran gegen Meri");
  await expect(host.locator("#duoPick")).toBeVisible();
  await expect(guest.locator("#duoPick")).toBeHidden();
  await expect(guest.locator("#duoGuestWait")).toHaveText("Ferran picks the game…");
  return { host, guest };
}

test("two phones play a card round: the first tap wins the buzz on both screens, the other judges", async ({ page }) => {
  const { host, guest } = await pair(page.context());
  await host.evaluate(() => { settings.count = 10; });
  await host.click('[data-duogame="cards"]');
  for (const p of [host, guest]) await expect(p.locator("#dprog")).toHaveText("Karte 1 / 10");
  // Both phones show the same card.
  const card = await host.evaluate(() => duo.deck[0].de);
  expect(await guest.evaluate(() => duo.deck[0].de)).toBe(card);

  await guest.click('[data-dact="buzz"]');
  await expect(host.locator(".dturn")).toHaveText("Meri war schneller!");
  await expect(guest.locator(".dturn")).toHaveText("You were first! Say it out loud, then flip.");
  await expect(host.locator('[data-dact="buzz"]')).toBeDisabled();

  await guest.click('[data-dact="flip"]');
  await expect(host.locator("#dBody .de")).toContainText(card);
  await expect(host.locator(".dturn")).toHaveText("Did Meri get it right?");
  await expect(guest.locator('[data-dact="judge"]')).toHaveCount(0);
  await host.click('[data-dact="judge"][data-ok="1"]');
  for (const p of [host, guest]) {
    await expect(p.locator("#dprog")).toHaveText("Karte 2 / 10");
    await expect(p.locator("#dscores .score.p2 b")).toHaveText("1");
  }
  // Only the referee's phone reads the word aloud, so the phones don't echo.
  expect((await spoken(host)).length).toBe(1);
  expect(await spoken(guest)).toEqual([]);

  // Nobody knows the next one; then play the rest out.
  await host.click('[data-dact="flip"]');
  await expect(guest.locator(".dturn")).toHaveText("Nobody knew it.");
  await guest.click('[data-dact="next"]');
  for (let k = 2; k < 10; k++) {
    await expect(host.locator("#dprog")).toHaveText(`Karte ${k + 1} / 10`);
    await host.click('[data-dact="buzz"]');
    await expect(guest.locator(".dturn")).toHaveText("Ferran war schneller!");
    await host.click('[data-dact="flip"]');
    await guest.click('[data-dact="judge"][data-ok="1"]');
  }
  for (const p of [host, guest]) await expect(p.locator("#dBody h2")).toHaveText("Ferran gewinnt!");
  await expect(guest.locator('[data-dact="again"]')).toHaveCount(0);
  await host.click('[data-dact="again"]');
  for (const p of [host, guest]) await expect(p.locator("#dprog")).toHaveText("Karte 1 / 10");
});

test("in a listening or grammar round the first right answer scores and a wrong one hands the turn over", async ({ page }) => {
  const { host, guest } = await pair(page.context());
  // Akkusativ & Dativ always has three options, so a wrong answer leaves two for the other player.
  await host.evaluate(() => { settings.glast = "cases"; });
  await host.click('[data-duogame="quiz"]');
  for (const p of [host, guest]) await expect(p.locator("#dprog")).toHaveText("Satz 1 / 10");
  const q = await host.evaluate(() => duo.deck[0]);
  const right = q.opts.indexOf(q.a), wrong = q.opts.findIndex((o) => o !== q.a);
  await host.click(`[data-dact="choose"][data-n="${wrong}"]`);
  await expect(host.locator(".dturn")).toHaveText("Nicht ganz. Now it's Meri's turn.");
  await expect(guest.locator(".dturn")).toHaveText("Ferran was wrong. Your turn!");
  await expect(host.locator(`[data-dact="choose"][data-n="${right}"]`)).toBeDisabled();
  await guest.click(`[data-dact="choose"][data-n="${right}"]`);
  await expect(guest.locator(".dturn")).toHaveText("Richtig! A point for you.");
  await expect(host.locator(".dturn")).toHaveText("Meri hatte recht!");
  await expect(host.locator(".sentence .blank")).toHaveText(q.a);
  await host.click('[data-dact="next"]');
  for (const p of [host, guest]) await expect(p.locator("#dprog")).toHaveText("Satz 2 / 10");

  // Leaving ends the game on the other phone too.
  await host.click("#duoQuit");
  await expect(guest.locator("#duoError")).toHaveText("The other phone left the game.");
});

test("a listening round reads the text on the referee's phone only", async ({ page }) => {
  const { host, guest } = await pair(page.context());
  await host.click('[data-duogame="listen"]');
  for (const p of [host, guest]) await expect(p.locator("#dprog")).toHaveText("Text 1 / 10");
  const t = await host.evaluate(() => duo.deck[0]);
  await expect.poll(() => spoken(host)).toEqual(t.lines);
  expect(await spoken(guest)).toEqual([]);
  await guest.click('[data-dact="play"]');
  await expect.poll(() => spoken(guest)).toEqual(t.lines);
  await guest.click('[data-dact="show"]');
  for (const p of [host, guest]) await expect(p.locator(".dturn")).toHaveText(`Die Antwort: „${t.a}“`);
  await expect(guest.locator("#dBody .script")).toBeVisible();
});

test("a wrong room code says so", async ({ page }) => {
  const guest = await phone(page.context(), "Meri");
  await guest.fill("#duoCode", "0000");
  await guest.click("#duoJoinForm button");
  await expect(guest.locator("#duoError")).toHaveText("No game with the code 0000. Check the number on the other phone.");
  await expect(guest.locator("#duoStart")).toBeVisible();
});

test("names from the other phone stay plain text", async ({ page }) => {
  const host = await phone(page.context(), "Ferran");
  const guest = await phone(page.context(), "<b>Meri</b>");
  await host.click("#duoHost");
  await guest.fill("#duoCode", (await host.locator("#duoCodeShow").textContent()).trim());
  await guest.click("#duoJoinForm button");
  await expect(host.locator("#duoVs")).toHaveText("Ferran gegen <b>Meri</b>");
  await expect(host.locator("#duoVs b")).toHaveCount(0);
});

test("the app copy ships PeerJS for Zwei Handys", async () => {
  const fs = require("fs"), path = require("path");
  const script = fs.readFileSync(path.join(__dirname, "..", "scripts", "build-app-web.js"), "utf8");
  expect(script).toContain("peerjs/dist/peerjs.min.js");
  expect(fs.existsSync(require.resolve("peerjs/dist/peerjs.min.js"))).toBe(true);
});
