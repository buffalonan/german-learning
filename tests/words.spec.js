const { test, expect } = require("@playwright/test");
const { open } = require("./helpers");

test("every card is complete and every picture exists", async ({ page }) => {
  await open(page);
  const problems = await page.evaluate(() => {
    const out = [];
    for (const t of TOPICS) {
      if (!PICS[t.icon]) out.push(`${t.id}: no picture for topic icon ${t.icon}`);
      const seen = new Set();
      for (const it of t.items) {
        const [front, de, art, en, es] = it;
        const label = `${t.id}/${de}`;
        if (!front || !de || !en || !es) out.push(`${label}: missing a field`);
        if (!["", "der", "die", "das", "pl"].includes(art)) out.push(`${label}: bad article "${art}"`);
        if (seen.has(de)) out.push(`${label}: duplicate`);
        seen.add(de);
        const isEmoji = !front.startsWith("#") && !front.startsWith("n:");
        if (isEmoji && !PICS[front]) out.push(`${label}: no picture for ${front}`);
        if (front.startsWith("#") && !/^#[0-9a-f]{6}$/i.test(front)) out.push(`${label}: bad colour ${front}`);
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
});

test("every illustration belongs to a card and its file exists", async ({ page, request }) => {
  await open(page);
  const { names, cards } = await page.evaluate(() => ({
    names: window.ART,
    cards: TOPICS.flatMap((t) => t.items.map((it) => `${t.id}/${artName(it[1])}`)),
  }));
  expect(names.length).toBeGreaterThan(0);
  expect(names.filter((n) => !cards.includes(n))).toEqual([]);
  for (const n of names) expect((await request.get(`/art/${n}.webp`)).ok(), n).toBe(true);
});

test("art names match the ones scripts/add-art.py makes", async ({ page }) => {
  await open(page);
  const got = await page.evaluate(() => ["aufstehen", "sich setzen", "Glühbirne", "Fuß", "E-Mail", "Öl"].map(artName));
  expect(got).toEqual(["aufstehen", "sich-setzen", "gluehbirne", "fuss", "e-mail", "oel"]);
});
