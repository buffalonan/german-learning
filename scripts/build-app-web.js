// Copies the game into a folder ready to publish: www/ for the Android app (Capacitor packs it), or _site/ for the web.
// Usage: node scripts/build-app-web.js [out dir, default www] [--web]
//   --web leaves out capacitor.js, which only the app needs. npm run app:sync runs this and then cap sync.
// If audio/ exists (recorded voices from scripts/build-audio.py), it's copied too and the page is told which voices it has.
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const web = args.includes("--web");
const root = path.join(__dirname, "..");
const out = path.resolve(args.find((a) => !a.startsWith("--")) || path.join(root, "www"));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let page = fs.readFileSync(path.join(root, "index.html"), "utf8");

// capacitor.js gives the page window.Capacitor.registerPlugin, used for the native voice.
if (!web) {
  const tag = '<script src="pictures.js"></script>';
  if (!page.includes(tag)) throw new Error(`Couldn't find ${tag} in index.html`);
  page = page.replace(tag, `<script src="capacitor.js"></script>\n${tag}`);
  fs.copyFileSync(require.resolve("@capacitor/core/dist/capacitor.js"), path.join(out, "capacitor.js"));
}

const audio = path.join(root, "audio");
const voices = fs.existsSync(audio) ? fs.readdirSync(audio).filter((d) => fs.statSync(path.join(audio, d)).isDirectory()) : [];
if (voices.length) {
  fs.cpSync(audio, path.join(out, "audio"), { recursive: true });
  const meta = '<meta charset="utf-8">';
  if (!page.includes(meta)) throw new Error(`Couldn't find ${meta} in index.html`);
  page = page.replace(meta, `${meta}\n<meta name="recorded-voices" content="${voices.join(" ")}">`);
}

fs.writeFileSync(path.join(out, "index.html"), page);
fs.copyFileSync(path.join(root, "pictures.js"), path.join(out, "pictures.js"));

console.log(`Wrote ${fs.readdirSync(out).join(", ")} to ${path.relative(root, out) || "."}${voices.length ? ` with recorded voices: ${voices.join(", ")}` : ""}`);
