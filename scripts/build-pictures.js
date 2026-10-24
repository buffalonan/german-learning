// Rebuilds pictures.js: one Fluent Emoji 3D picture (MIT) for every emoji used in index.html.
// Usage: node scripts/build-pictures.js
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PACKAGE = "@lobehub/fluent-emoji-3d@1.1.0"; // 256px webp files named by codepoint, e.g. 1f34e.webp
const root = path.join(__dirname, "..");

const src = fs.readFileSync(path.join(root, "index.html"), "utf8");
const match = src.match(/const TOPICS = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error("Couldn't find the TOPICS array in index.html");
const TOPICS = Function(`"use strict"; return ${match[1]};`)();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pictures-"));
const tarball = execFileSync("npm", ["pack", PACKAGE, "--silent"], { cwd: tmp, encoding: "utf8" }).trim();
execFileSync("tar", ["xzf", tarball], { cwd: tmp });
const assets = path.join(tmp, "package", "assets");
const files = new Set(fs.readdirSync(assets));

const pics = {};
const missing = [];
for (const t of TOPICS) {
  for (const e of [t.icon, ...t.items.map((i) => i[0])]) {
    if (e.startsWith("#") || e.startsWith("n:") || pics[e]) continue;
    const cps = [...e].map((c) => c.codePointAt(0).toString(16).padStart(4, "0"));
    const file = [cps.join("-"), cps.filter((c) => c !== "fe0f").join("-")].map((c) => `${c}.webp`).find((f) => files.has(f));
    if (!file) { missing.push(e); continue; }
    pics[e] = "data:image/webp;base64," + fs.readFileSync(path.join(assets, file)).toString("base64");
  }
}

fs.writeFileSync(path.join(root, "pictures.js"),
  "// 3D pictures from Microsoft Fluent Emoji (MIT licence), keyed by emoji.\nwindow.PICS = " + JSON.stringify(pics) + ";\n");
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`pictures.js: ${Object.keys(pics).length} pictures` + (missing.length ? `; no picture for ${missing.join(" ")}` : ""));
