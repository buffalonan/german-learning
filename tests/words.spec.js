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
