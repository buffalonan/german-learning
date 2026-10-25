# AGENTS.md

Context for AI agents and reviewers working on this repo. Read this first instead of re-deriving it from the code. Keep it up to date when you change how things work.

## What this is

Web games for two adult learners to practise everyday German. Both were once B1 level and are now rusty. The focus is vocabulary, useful daily phrases and listening. Translations are shown in English and Spanish.

They play together on one laptop, racing to answer first, or on their phones over home Wi-Fi. The app has two areas, switched by the tabs at the top: **Wortkarten** (Sag's auf Deutsch: picture cards where you say the German word, then flip to check) and **Grammatik** (short theory pages for Akkusativ & Dativ and for prepositions, each with a gap-fill quiz).

Roadmap: (1) picture card game, done; (2) bigger word bank and more everyday sentences; (3) session setup with listening and writing modes; (4) installable phone version, then an Android app.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The whole game: CSS, markup and one inline script. No framework, no build step. |
| `pictures.js` | Generated. `window.PICS = { "🍎": "data:image/webp;base64,…" }` with 3D pictures keyed by emoji. Don't edit by hand. |
| `scripts/build-pictures.js` | Regenerates `pictures.js` from the emoji used in `index.html`, using Microsoft Fluent Emoji 3D (MIT) from the npm package `@lobehub/fluent-emoji-3d`. |
| `android/` | Capacitor's Android project. Edited by hand only in `app/build.gradle` (version and signing from env vars) and the icons/splash. `app/src/main/assets/public` is generated and ignored. |
| `capacitor.config.json` | App id `io.github.buffalonan.sagsdeutsch`, name, and `webDir: www`. |
| `scripts/build-app-web.js` | Copies the game into `www/` for the app, adding `<script src="capacitor.js">`. `www/` is generated and ignored. |
| `android-tests/` | Emulator smoke test of the real app, run only in CI by `android.yml`. |
| `tests/*.spec.js` | Playwright tests, run at desktop and phone (Pixel 7) sizes. `tests/helpers.js` has the speech mock and round helpers. |
| `REVIEW.md` | What a reviewer should flag as blocking or as a suggestion. |
| `.github/workflows/` | CI: `tests.yml`, `security.yml`, `codeql.yml`, and the Claude reviewer once that PR is merged. |

## How the game code works (index.html)

- **Word bank:** the `TOPICS` array. Each topic is `{ id, name (German), en, icon, items, cue? }`. Each card is `[front, german, article, english, spanish, feminine?]`.
  - `front` is an emoji, a `#rrggbb` colour swatch, or `n:12` for a numeral.
  - `article` is `der`, `die`, `das`, `pl` (shown as "die" with a Pl. mark) or `""` for none (verbs, colours, numbers, phrases).
  - `feminine` is the feminine job form, e.g. `"die Lehrerin"`.
  - `cue: true` (phrases) always shows a text cue on the front.
  - Articles are colour-coded everywhere: der blue, die red, das green, plural brown. The card back's border takes the article's colour too.
- **Grammar:** the `GRAMMAR` array, one lesson per entry `{ id, name, en, icon, items }`. Each item is `[sentence with ___, answer, [1–3 wrong options], english, spanish, why]`; `why` is the English explanation shown after answering. The theory text is plain markup in `#theory`, one `<article data-lesson="…">` per lesson; `.ex` buttons there read their sentence aloud. Quiz state is the global `quiz`; `dealQuestion`, `choose`, `nextQuestion` and `finishQuiz` render it. Keys: 1–4 answer, Enter/Space next. "Take turns" alternates the players (names from the cards setup) with a point each; "Together" counts right answers.
- **Screens:** `show(id)` switches between `setup`, `play`, `done`, `grammar`, `theory`, `quiz` and `qdone`; the area tabs show only on `setup` and `grammar`.
- **Settings** are kept in `localStorage` under `sagsDeutsch.settings`, always inside try/catch: topics, mode (`race` or `practice`), player names, cards per round (0 means all), front hint (`none`, `en`, `es`), read aloud, voice, and for grammar `gmode` (`turns` or `together`) and `gcount` (0 means all).
- **State** is the global `game` (`deck`, `i`, `flipped`, `buzzed`, `scores`, `missed`, `known`, `againCount`). Rendering goes through `dealCard`, `renderScores`, `renderControls` and `finish`.
- **Keys:** Space or Enter flips. Race: A and L buzz in before the flip and award a point after it, N means nobody, Enter awards the player who buzzed. Practice: 1 is Again (the same card turns back over), 2 is Got it.
- **Voice:** the browser's `speechSynthesis`. Voices installed on the computer are preferred, because online ones such as "Google Deutsch" can fail silently inside an embedded page. The voice menu and Test button live on the setup screen, and a hint appears if nothing starts within 1.8 s. There is no pre-recorded audio.
  - In the Android app (`window.Capacitor.isNativePlatform()`), the WebView has no `speechSynthesis`, so `tts` (the `TextToSpeech` plugin from `@capacitor-community/text-to-speech`) is used instead: `loadNativeVoices` retries while the phone's engine starts, the plugin picks a voice by its index in the full voice list, and `sayNative` reports only the latest call's error. Tests mock it with `mockNativeSpeech`.

## Rules

- **Write markup only through the `html` tagged template.** It escapes every value unless that value was itself built with `html`. Never assign a plain string to `innerHTML` or `outerHTML`. ESLint's `no-unsanitized` rule fails CI if you do.
- Player names and voice names are the only user input. They must stay escaped, and a test covers this.
- Elements are shown and hidden with `el.hidden`. The page's `[hidden] { display: none !important; }` rule is what makes that work, so keep it.
- German must be correct: check the article, the plural and the spelling. Every card needs English and Spanish too.
- A card with a new emoji needs a picture: run `node scripts/build-pictures.js`. The word bank test fails otherwise.
- New or changed behaviour needs a Playwright test. Never skip or delete a test to get CI green.
- The page must work at phone width without scrolling sideways, and in light and dark mode (all colours are CSS variables on `:root`).
- **Look:** "claymorphism" chosen with the ui-ux-pro-max skill: soft 3D surfaces with 3-4px borders, double shadows (outer drop plus inner highlight), 18-28px radii, pastel tints for selected topics and lessons, and squishy buttons that scale down when pressed. Indigo `--primary` is the brand colour, `--good` green means progress and right answers. New screens reuse the tokens on `:root`: colours (`--table`, `--surface`, `--surface-2`, `--ink`, `--muted`, `--line`, `--primary`/`--primary-deep`/`--on-primary`, `--focus`, `--glow`, `--pastel-1`…`--pastel-5`, article and player colours), shadows `--clay`/`--clay-sm`/`--press`, radii `--r-s`/`--r-m`/`--r-l`, `--display` (Nunito, 800-900) for headings and German words and `--body` (DM Sans) for the rest. Controls use the `.i` line icons (`i-vol`, `i-back`, `i-book`, `i-redo`, `i-check`), never emoji. Tap targets are at least 44px. Section labels are sentence case, not all caps. Reuse `.sheet`, `.label`, `.seg`, `.ctl`, `.btn-main` before writing new components.

## Commands

```sh
npm ci
npx playwright install chromium        # first time only
npm test                               # Playwright, desktop and phone
npx eslint . --max-warnings 0          # lint, as CI runs it
node scripts/build-pictures.js         # after adding emoji cards
python3 -m http.server 8081 --bind 0.0.0.0   # play from a phone on the same Wi-Fi
npm run app:sync                       # copy the game into the Android project (then npx cap open android)
```

## CI and workflow

- Work on a branch and open a pull request into `main`. Don't push to `main` directly.
- Every PR runs ESLint, Playwright, `npm audit --audit-level=moderate`, `npm audit signatures` and gitleaks. CodeQL and dependency review also run, since the repo is public. Security checks also run weekly. Dependabot opens weekly updates.
- `android.yml` runs Android Lint and an emulator smoke test (`android-tests/`, Playwright driving the debug app's WebView over adb; not part of `npm test`), builds the APK on every PR (downloadable as a workflow artifact) and, on `main`, publishes it as release `app-v1.<run number>` with `sags-auf-deutsch.apk`. It signs with the `ANDROID_KEYSTORE_BASE64`/`ANDROID_KEYSTORE_PASSWORD` secrets, or a one-off key if they're missing (see README).
- `.gitleaks.toml` allowlists `pictures.js`, whose base64 data looks like keys.

## Where it runs

- **Android app:** sideloaded from the latest GitHub release (no Play Store). It updates when a new APK is installed over it.
- **Local copy for phones:** the owner serves a copy from their computer on their home Wi-Fi (`python3 -m http.server <port> --bind 0.0.0.0`). It doesn't update by itself: copy `index.html` and `pictures.js` over after merging.
- **Claude artifact:** a hosted copy for Claude's app is the same page with the `<!doctype>`, `<html>`, `<head>` and `<body>` wrapper lines removed, plus `pictures.js` as a supporting file.
