# German learning games

Small web games for practising everyday German together.

## Sag's auf Deutsch (picture cards)

`index.html` plus `pictures.js` (the card pictures) make up the game: open `index.html` in any browser, no build step.

- Pick topics (colours, numbers, food, verbs, home, work, animals, body, clothes, weather, science, town, everyday phrases).
- **Race mode:** two players on one laptop. Player 1 claims a card with `A`, player 2 with `L`, `Space` flips, then award the point (`A`, `L`, or `N` for nobody).
- **Practice mode:** flip, then `1` for "again" (the same card turns back over to try once more) or `2` for "got it".
- The back shows the German with the article colour-coded (der blue, die red, das green, plural brown), plus English and Spanish, and reads it aloud with a German voice installed on the computer (pick or test it on the start screen).

The word bank is the `TOPICS` array near the top of the script. Each card is `[front, german, article, english, spanish, feminine form]`, where `front` is an emoji, a `#hex` colour swatch, or `n:12` for a numeral.

## Pictures

Card pictures are [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) 3D images (MIT licence), embedded in `pictures.js` and keyed by emoji. When you add a card with a new emoji, regenerate `pictures.js` so it has a picture; otherwise the card falls back to the plain emoji.

## Development

```sh
npm ci
npx playwright install chromium   # first time only
npm test                           # Playwright tests, desktop and phone sizes
npx eslint .                       # lint, including unsafe-HTML checks
npm run serve                      # play locally at http://localhost:4173
```

To play from a phone on the same Wi-Fi, serve the folder on all interfaces (`python3 -m http.server 8081 --bind 0.0.0.0`) and open `http://<computer's IP>:8081/` on the phone.

Every pull request runs:

- **Tests:** ESLint (with `no-unsanitized` and `security` rules) and the Playwright suite.
- **Security:** `npm audit` for known vulnerabilities, `npm audit signatures`, and gitleaks secret detection over the full history. It also runs weekly on `main`.
- **Dependabot** opens weekly update PRs for npm packages and GitHub Actions.
- **CodeQL** code scanning and **dependency review** of new packages. Both run only when the repo is public, since GitHub charges for them on private repos.

The game writes markup only through the `html` tagged template, which escapes every value. The linter enforces this.

## Roadmap

1. Picture card game (done)
2. Bigger shared word bank, including more everyday sentences
3. Session setup with listening and writing modes
4. Installable phone version, then an Android app
