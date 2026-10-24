# AGENTS.md

Context for AI agents and reviewers working on this repo. Read this first instead of re-deriving it from the code. Keep it up to date when you change how things work.

## What this is

Web games for two adult learners to practise everyday German. Both were once B1 level and are now rusty. The focus is vocabulary, useful daily phrases and listening. Translations are shown in English and Spanish.

They play together on one laptop, racing to answer first, or on their phones over home Wi-Fi. The current game is **Sag's auf Deutsch**: picture cards where you say the German word, then flip to check.

Roadmap: (1) picture card game, done; (2) bigger word bank and more everyday sentences; (3) session setup with listening and writing modes; (4) installable phone version, then an Android app.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The whole game: CSS, markup and one inline script. No framework, no build step. |
| `pictures.js` | Generated. `window.PICS = { "🍎": "data:image/webp;base64,…" }` with 3D pictures keyed by emoji. Don't edit by hand. |
| `scripts/build-pictures.js` | Regenerates `pictures.js` from the emoji used in `index.html`, using Microsoft Fluent Emoji 3D (MIT) from the npm package `@lobehub/fluent-emoji-3d`. |
| `tests/*.spec.js` | Playwright tests, run at desktop and phone (Pixel 7) sizes. `tests/helpers.js` has the speech mock and round helpers. |
| `REVIEW.md` | What a reviewer should flag as blocking or as a suggestion. |
| `.github/workflows/` | CI: `tests.yml`, `security.yml`, `codeql.yml`, and the Claude reviewer once that PR is merged. |

## How the game code works (index.html)

- **Word bank:** the `TOPICS` array. Each topic is `{ id, name (German), en, icon, items, cue? }`. Each card is `[front, german, article, english, spanish, feminine?]`.
  - `front` is an emoji, a `#rrggbb` colour swatch, or `n:12` for a numeral.
  - `article` is `der`, `die`, `das`, `pl` (shown as "die" with a Pl. mark) or `""` for none (verbs, colours, numbers, phrases).
  - `feminine` is the feminine job form, e.g. `"die Lehrerin"`.
  - `cue: true` (phrases) always shows a text cue on the front.
  - Articles are colour-coded everywhere: der blue, die red, das green, plural brown.
- **Settings** are kept in `localStorage` under `sagsDeutsch.settings`, always inside try/catch: topics, mode (`race` or `practice`), player names, cards per round (0 means all), front hint (`none`, `en`, `es`), read aloud, voice.
- **State** is the global `game` (`deck`, `i`, `flipped`, `buzzed`, `scores`, `missed`, `known`, `againCount`). Rendering goes through `dealCard`, `renderScores`, `renderControls` and `finish`.
- **Keys:** Space or Enter flips. Race: A and L buzz in before the flip and award a point after it, N means nobody, Enter awards the player who buzzed. Practice: 1 is Again (the same card turns back over), 2 is Got it.
- **Voice:** the browser's `speechSynthesis`. Voices installed on the computer are preferred, because online ones such as "Google Deutsch" can fail silently inside an embedded page. The voice menu and Test button live on the setup screen, and a hint appears if nothing starts within 1.8 s. There is no pre-recorded audio.

## Rules

- **Write markup only through the `html` tagged template.** It escapes every value unless that value was itself built with `html`. Never assign a plain string to `innerHTML` or `outerHTML`. ESLint's `no-unsanitized` rule fails CI if you do.
- Player names and voice names are the only user input. They must stay escaped, and a test covers this.
- Elements are shown and hidden with `el.hidden`. The page's `[hidden] { display: none !important; }` rule is what makes that work, so keep it.
- German must be correct: check the article, the plural and the spelling. Every card needs English and Spanish too.
- A card with a new emoji needs a picture: run `node scripts/build-pictures.js`. The word bank test fails otherwise.
- `scripts/build-pictures.js` evaluates the `TOPICS` literal from this repo's own `index.html` with `Function`. That's a deliberate exception for a local build script. The no-`eval` rule is about the game code.
- New or changed behaviour needs a Playwright test. Never skip or delete a test to get CI green.
- The page must work at phone width without scrolling sideways, and in light and dark mode (all colours are CSS variables on `:root`).

## Commands

```sh
npm ci
npx playwright install chromium        # first time only
npm test                               # Playwright, desktop and phone
npx eslint . --max-warnings 0          # lint, as CI runs it
node scripts/build-pictures.js         # after adding emoji cards
python3 -m http.server 8081 --bind 0.0.0.0   # play from a phone on the same Wi-Fi
```

## CI and workflow

- Work on a branch and open a pull request into `main`. Don't push to `main` directly.
- Every PR runs ESLint, Playwright, `npm audit --audit-level=moderate`, `npm audit signatures` and gitleaks. CodeQL and dependency review also run, since the repo is public. Security checks also run weekly. Dependabot opens weekly updates.
- `.gitleaks.toml` allowlists `pictures.js`, whose base64 data looks like keys.

## Where it runs

- **Local copy for phones:** the owner serves a copy from their computer on their home Wi-Fi (`python3 -m http.server <port> --bind 0.0.0.0`). It doesn't update by itself: copy `index.html` and `pictures.js` over after merging.
- **Claude artifact:** a hosted copy for Claude's app is the same page with the `<!doctype>`, `<html>`, `<head>` and `<body>` wrapper lines removed, plus `pictures.js` as a supporting file.
