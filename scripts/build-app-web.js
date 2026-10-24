// Copies the game into www/, the folder Capacitor packs into the Android app.
// Usage: node scripts/build-app-web.js [out dir, default www] (npm run app:sync also runs cap sync)
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.resolve(process.argv[2] || path.join(root, "www"));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// capacitor.js gives the page window.Capacitor.registerPlugin, used for the native voice.
// It only goes into the app copy: on the web it isn't needed and isn't served.
const page = fs.readFileSync(path.join(root, "index.html"), "utf8");
const tag = '<script src="pictures.js"></script>';
if (!page.includes(tag)) throw new Error(`Couldn't find ${tag} in index.html`);
fs.writeFileSync(path.join(out, "index.html"), page.replace(tag, `<script src="capacitor.js"></script>\n${tag}`));

fs.copyFileSync(path.join(root, "pictures.js"), path.join(out, "pictures.js"));
fs.copyFileSync(require.resolve("@capacitor/core/dist/capacitor.js"), path.join(out, "capacitor.js"));

console.log(`Wrote ${fs.readdirSync(out).join(", ")} to ${path.relative(root, out) || "."}`);
