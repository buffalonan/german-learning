# AGENTS.md

Context for AI agents and reviewers working on this repo. Read this first instead of re-deriving it from the code. Keep it up to date when you change how things work.

## What this is

Web games for two adult learners to practise everyday German. Both were once B1 level and are now rusty. The focus is vocabulary, useful daily phrases and listening. Translations are shown in English and Spanish.

They play together on one laptop, racing to answer first, or on their phones over home Wi-Fi. The app has three areas, switched by the tabs at the top: **Wortkarten** (Sag's auf Deutsch: picture cards where you say the German word, then flip to check), **Grammatik** (short theory pages for Akkusativ & Dativ, prepositions, the Perfekt (haben or sein, participles) and separable verbs, each with a gap-fill quiz) and **Hören** (a listening game modelled on the Goethe A2/B1 Hören part: the game reads an announcement, voicemail, conversation or radio item aloud and the players pick the right answer).

Roadmap: (1) picture card game, done; (2) bigger word bank and more everyday sentences; (3) session setup with listening and writing modes; (4) installable phone version, then an Android app.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The whole game: CSS, markup and one inline script. No framework, no build step. |
| `pictures.js` | Generated. `window.PICS = { "🍎": "data:image/webp;base64,…" }` with 3D pictures keyed by emoji. Don't edit by hand. |
| `art/<topic id>/<name>.webp`, `art.js` | Painted card illustrations (Ghibli-style, made by Ferran in Nano Banana from Claude's prompts), 640px WebP, about 20 KB each. `art.js` is generated: `window.ART` lists them. |
| `scripts/add-art.py`, `scripts/build-art.js` | `python3 scripts/add-art.py <topic id> <pictures…>` crops, shrinks and saves pictures named after the German word into `art/<topic>/`, then runs `build-art.js` to rewrite `art.js`. Needs Pillow. |
| `logo/`, `manifest.webmanifest`, `scripts/build-logo.py` | The hedgehog logo (painted by Ferran, original in the project's shared files at `illustrations/logo/`). `python3 scripts/build-logo.py <original>` makes `logo/hedgehog.webp` (with its "hallo!" bubble, beside the title on the Wortkarten screen, sized by a ResizeObserver to span from the flag bar to the subtitle), the favicon, touch and manifest icons (hedgehog only; the 32px favicon is just its face) and the Android launcher icons and splash screens, all on the picture's cream (`#f8f3e7`, also `ic_launcher_background`). Not in `art/`, which is only for cards. |
| `scripts/build-pictures.js` | Regenerates `pictures.js` from the emoji used in `index.html`, using Microsoft Fluent Emoji 3D (MIT) from the npm package `@lobehub/fluent-emoji-3d`. |
| `android/` | Capacitor's Android project. Edited by hand only in `app/build.gradle` (version and signing from env vars); the icons and splash come from `scripts/build-logo.py`. `app/src/main/assets/public` is generated and ignored. |
| `capacitor.config.json` | App id `io.github.buffalonan.sagsdeutsch`, name, and `webDir: www`. |
| `scripts/build-app-web.js` | Copies the game into `www/` for the app (adding `<script src="capacitor.js">`) or, with `--web`, into `_site/` for Pages, plus `audio/` if it exists. Both folders are generated and ignored. |
| `scripts/list-spoken.js`, `scripts/build-audio.py` | Make the recorded voices in `audio/` (run in CI, see below). |
| `android-tests/` | Emulator smoke test of the real app, run only in CI by `android.yml`. |
| `tests/*.spec.js` | Playwright tests, run at desktop and phone (Pixel 7) sizes. `tests/helpers.js` has the speech mock and round helpers. `tests/palette.json` holds every Farben colour and every colour token in light and dark; `tests/colours.spec.js` fails if one changes, and also checks each colour card's colour on screen. After an intended colour change, run `UPDATE_PALETTE=1 npx playwright test colours --project=desktop` and commit the new `palette.json`. |
| `REVIEW.md` | What a reviewer should flag as blocking or as a suggestion. |
| `.github/workflows/` | CI: `tests.yml`, `security.yml`, `codeql.yml`, and `claude-review.yml`: Claude reviews each PR once when it opens (start a PR comment with `@claude review` for another look after new pushes), skipping generated and binary files such as `pictures.js`. |

## How the game code works (index.html)

- **Word bank:** the `TOPICS` array. Each topic is `{ id, name (German), en, icon, items, cue? }`. Each card is `[front, german, article, english, spanish, feminine?]`.
  - `front` is an emoji, a `#rrggbb` colour swatch, or `n:12` for a numeral.
  - A card with a painted illustration in `art/<topic id>/<artName(german)>.webp` (listed in `art.js`) shows it instead, on a rounded tile with no pastel disc. Every card has one since October 2026 (numbers have brush-painted numerals), so the emoji picture, colour swatch and plain numeral are only fallbacks, and their tests use made-up cards. `artName` lowercases, turns ä/ö/ü/ß into ae/oe/ue/ss and other characters into `-` ("sich setzen" → `sich-setzen`), and must match `art_name` in `scripts/add-art.py`. Illustrations are keyed by topic and word, not emoji, because some emoji are shared (🪑 is both "sich setzen" and "Stuhl").
  - `article` is `der`, `die`, `das`, `pl` (shown as "die" with a Pl. mark) or `""` for none (verbs, colours, numbers, phrases).
  - `feminine` is the feminine job form, e.g. `"die Lehrerin"`.
  - `cue: true` (phrases) always shows a text cue on the front.
  - Articles are colour-coded everywhere: der blue, die red, das green, plural brown. The card back's border takes the article's colour too.
- **Grammar:** the `GRAMMAR` array, one lesson per entry `{ id, name, en, icon, items }`. Each item is `[sentence with ___, answer, [1–3 wrong options], english, spanish, why]`; `why` is the English explanation shown after answering. The theory text is plain markup in `#theory`, one `<article data-lesson="…">` per lesson (a test checks every lesson has one); a lesson's `icon` must already be in `pictures.js`, since `build-pictures.js` only collects emoji from `TOPICS`; `.ex` buttons there read their sentence aloud. Quiz state is the global `quiz`; `dealQuestion`, `choose`, `nextQuestion` and `finishQuiz` render it. Keys: 1–4 answer, Enter/Space next. "Take turns" alternates the players (names from the cards setup) with a point each; "Together" counts right answers.
- **Listening:** the `LISTENING` array, one kind of text per entry `{ id, name, en, icon, dialogue?, items }`. Each item is `[lines, question, answer, [1–3 wrong options], english, spanish]`; `english`/`spanish` translate the whole text and show after answering with the German transcript. Numbers in `lines` are written as words (a test checks there are no digits) so every voice reads them the same. With `dialogue: true` the lines alternate between two speakers: `sayLines` reads them one after another, the second speaker with the other recorded voice (Kerstin ↔ Thorsten) or the device voice at pitch 0.7. Any other `say()` or `hush()` bumps `talkRun`, which stops a running conversation. State is the global `listen`; `dealText`, `renderListen`, `lchoose`, `reveal`, `nextText`, `finishListening` render it. Practice (default): a wrong option is marked and you try again; "Gewusst" counts right-first-time. Race: options wait for a buzz (A/L or the name buttons), a right answer is a point, a wrong one passes the turn once to the other player, N shows the answer. Keys: R or Space replays, 1–3 answer, Enter next.
- **Screens:** `show(id)` switches between `setup`, `play`, `done`, `grammar`, `theory`, `quiz`, `qdone`, `listen`, `hear` and `ldone`; the area tabs show only on `setup`, `grammar` and `listen`.
- **Settings** are kept in `localStorage` under `sagsDeutsch.settings`, always inside try/catch: topics, mode (`practice` by default, or `race`), player names, cards per round (0 means all), front hint (`none`, `en`, `es`), read aloud, voice, `theme` (`""` follows the system, or `light`/`dark` from the round button next to the section tabs; a small script in `<head>` applies it before the page paints), for grammar `gmode` (`turns` or `together`) and `gcount` (0 means all), and for listening `lkinds`, `lmode` (`practice` by default, or `race`) and `lcount` (0 means all).
- **State** is the global `game` (`deck`, `i`, `flipped`, `buzzed`, `scores`, `missed`, `known`, `againCount`). Rendering goes through `dealCard`, `renderScores`, `renderControls` and `finish`.
- **Keys:** Space or Enter flips. Race: A and L buzz in before the flip and award a point after it, N means nobody, Enter awards the player who buzzed. Practice: 1 is Again (the same card turns back over), 2 is Got it.
- **Recorded voices:** CI records every text the game reads aloud with Piper (voices Kerstin and Thorsten) into `audio/<voice>/<audioName(text)>.mp3`. `spokenTexts()` in the page lists the texts; `scripts/list-spoken.js` asks the page for them and `scripts/build-audio.py` records them; the composite action `.github/actions/recorded-voices` runs both (cached between runs) for the APK and Pages builds. `scripts/build-app-web.js` copies `audio/` and adds `<meta name="recorded-voices" content="kerstin thorsten">`, which is how the page knows they exist; plain `index.html` has no tag and no recordings. They're recorded slowly (`LENGTH_SCALE` 1.4) with low noise and even loudness, because Ferran found the first take too fast and breathy. When recordings exist the menu lists one device voice first ("Google Deutsch" in desktop Chrome, otherwise the best installed German voice, e.g. "German Germany" on Android), then the recordings. That device voice is the default (Ferran asked for it); a recording plays only once picked, or when the device has no German voice. Other device voices are hidden but still read texts without a recording, and a saved hidden voice falls back to the offered one. When a recording is picked, `say()` plays it, or falls back to the device voice below if it's missing. `audio/` is not committed. Tests fake the recordings with `page.route` (`tests/recorded.spec.js`). Changing `audioName` invalidates every recording.
- **Device voice (fallback, or when the player picks one):** the browser's `speechSynthesis`. Among device voices, the default is "Google Deutsch" when it exists (Chrome only), because Chrome on macOS reads text sent to the Mac's own voices (Anna…) with the English system voice. Elsewhere (Safari, iPhone) voices installed on the device are preferred. A voice the player picks is remembered. The voice menu and Test button live on the setup screen, and a hint appears if nothing starts within 1.8 s. Without recordings the menu lists every German device voice, and with no German voice it offers "Browser default"/"Phone default" (value `device`), and picking it is remembered too.
  - In the Android app (`window.Capacitor.isNativePlatform()`), the WebView has no `speechSynthesis`, so `tts` (the `TextToSpeech` plugin from `@capacitor-community/text-to-speech`) is used instead: `loadNativeVoices` retries while the phone's engine starts, the plugin picks a voice by its index in the full voice list, and `sayNative` reports only the latest call's error. Tests mock it with `mockNativeSpeech`.

## Rules

- **Write markup only through the `html` tagged template.** It escapes every value unless that value was itself built with `html`. Never assign a plain string to `innerHTML` or `outerHTML`. ESLint's `no-unsanitized` rule fails CI if you do.
- Player names and voice names are the only user input. They must stay escaped, and a test covers this.
- Elements are shown and hidden with `el.hidden`. The page's `[hidden] { display: none !important; }` rule is what makes that work, so keep it.
- German must be correct: check the article, the plural and the spelling. Every card needs English and Spanish too.
- A card with a new emoji needs a picture: run `node scripts/build-pictures.js`. The word bank test fails otherwise.
- New illustrations go in with `scripts/add-art.py`, never by hand-editing `art.js`. Prompts and the approved originals are in the project's shared files (`illustrations/`). Each picture must belong to a card, and a test checks this.
- `scripts/build-pictures.js` evaluates the `TOPICS` literal from this repo's own `index.html` with `Function`. That's a deliberate exception for a local build script. The no-`eval` rule is about the game code.
- New or changed behaviour needs a Playwright test. Never skip or delete a test to get CI green.
- The page must work at phone width without scrolling sideways, and in light and dark mode (all colours are CSS variables on `:root`). Up to 640px wide the section tabs fill the width on one line that never wraps (tested at 320–412px with a fourth tab), each tab getting the same extra width so the gaps between labels are equal, and the light/dark button moves down, level with the first line of the title.
- **Look:** "claymorphism" chosen with the ui-ux-pro-max skill: soft 3D surfaces with 3-4px borders, double shadows (outer drop plus inner highlight), 18-28px radii, pastel tints for selected topics and lessons, and squishy buttons that scale down when pressed. Indigo `--primary` is the brand colour, `--good` green means progress and right answers. New screens reuse the tokens on `:root`: colours (`--table`, `--surface`, `--surface-2`, `--ink`, `--muted`, `--line`, `--primary`/`--primary-deep`/`--on-primary`, `--focus`, `--glow`, `--pastel-1`…`--pastel-5`, article and player colours), shadows `--clay`/`--clay-sm`/`--press`, radii `--r-s`/`--r-m`/`--r-l`, `--display` (Nunito, 800-900) for headings and German words and `--body` (DM Sans) for the rest. Controls use the `.i` line icons (`i-vol`, `i-back`, `i-book`, `i-redo`, `i-check`, `i-sun`, `i-moon`), never emoji. Tap targets are at least 44px. Section labels are sentence case, not all caps. Reuse `.sheet`, `.label`, `.seg`, `.ctl`, `.btn-main` before writing new components.

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
- `android.yml` runs Android Lint and an emulator smoke test (`android-tests/`, Playwright driving the debug app's WebView over adb; not part of `npm test`), builds the APK on every PR (downloadable as a workflow artifact) and, on `main`, publishes it as release `app-v1.<run number>` with `sags-auf-deutsch.apk`. A run skips the release when `main` has moved on by then, since the newer run publishes its own (and tagging an older commit fails with HTTP 403 when a later merge changed a workflow). The emulator is installed in its own step with retries, because its download sometimes arrives broken. It signs with the `ANDROID_KEYSTORE_BASE64`/`ANDROID_KEYSTORE_PASSWORD` secrets, or a one-off key if they're missing (see README).
- `.gitleaks.toml` allowlists `pictures.js`, whose base64 data looks like keys.

## Where it runs

- **Web:** <https://buffalonan.github.io/german-learning/>, deployed by `pages.yml` on each merge to `main` that changes `index.html`, `pictures.js`, the illustrations or the logo (Pages source must be "GitHub Actions" in the repo settings).
- **Android app:** sideloaded from the latest GitHub release (no Play Store). It updates when a new APK is installed over it.
- **Local copy for phones:** the owner serves a copy from their computer on their home Wi-Fi (`python3 -m http.server <port> --bind 0.0.0.0`). It doesn't update by itself: copy `index.html`, `pictures.js`, `art.js`, `art/`, `logo/` and `manifest.webmanifest` over after merging.
- **Claude artifact:** a hosted copy for Claude's app is the same page with the `<!doctype>`, `<html>`, `<head>` and `<body>` wrapper lines removed, plus `pictures.js`, `art.js`, the `art/` pictures and `logo/` as supporting files.
