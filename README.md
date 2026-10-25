# German learning games

Small web games for practising everyday German together.

AI agents and reviewers: start with [AGENTS.md](AGENTS.md).

## Sag's auf Deutsch (picture cards)

`index.html` plus `pictures.js` (the card pictures) make up the game: open `index.html` in any browser, no build step.

**Play online:** <https://buffalonan.github.io/german-learning/>, published by `.github/workflows/pages.yml` on every merge to `main`.

- Pick topics (colours, numbers, food, verbs, home, work, animals, body, clothes, weather, science, town, everyday phrases).
- **Race mode:** two players on one laptop. Player 1 claims a card with `A`, player 2 with `L`, `Space` flips, then award the point (`A`, `L`, or `N` for nobody).
- **Practice mode:** flip, then `1` for "again" (the same card turns back over to try once more) or `2` for "got it".
- The back shows the German with the article colour-coded (der blue, die red, das green, plural brown), plus English and Spanish, and reads it aloud with a German voice installed on the computer (pick or test it on the start screen).

The word bank is the `TOPICS` array near the top of the script. Each card is `[front, german, article, english, spanish, feminine form]`, where `front` is an emoji, a `#hex` colour swatch, or `n:12` for a numeral.

## Android app

The same page, wrapped with [Capacitor](https://capacitorjs.com/) in `android/`. In the app the browser's voice isn't available, so the game reads aloud with the phone's own text-to-speech engine ([capacitor-community/text-to-speech](https://github.com/capacitor-community/text-to-speech)).

**Install on a phone:** open <https://github.com/buffalonan/german-learning/releases/latest> in Chrome on the phone, tap `sags-auf-deutsch.apk`, then Open, and allow Chrome to install unknown apps if Android asks. Each merge to `main` publishes a new release, which installs over the old one. If there's no sound, add German in Android Settings → Accessibility → Text-to-speech output → Install voice data.

**How it's built:** `.github/workflows/android.yml` runs `npm run app:sync` (copies `index.html`, `pictures.js` and Capacitor's `capacitor.js` into `www/`, then into the Android project) and `./gradlew assembleRelease`. Pull requests get the APK as a workflow artifact; `main` also publishes it as a release.

**Signing key:** releases are signed with the key in the repo secrets `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` (key alias `sagsdeutsch`). Without them the workflow signs with a one-off key, and the phone has to uninstall the app before each update. To make a key on a Mac:

```sh
openssl req -x509 -newkey rsa:2048 -nodes -days 10000 -subj "/CN=Sags auf Deutsch" -keyout key.pem -out cert.pem
openssl pkcs12 -export -inkey key.pem -in cert.pem -name sagsdeutsch -out sagsdeutsch.p12   # asks for a password
base64 -i sagsdeutsch.p12 | pbcopy                                                         # copies it for the secret
rm key.pem cert.pem
```

Paste the copied text as `ANDROID_KEYSTORE_BASE64` and the password as `ANDROID_KEYSTORE_PASSWORD` in Settings → Secrets and variables → Actions. Keep `sagsdeutsch.p12` and its password somewhere safe: a lost key means uninstalling and reinstalling the app.

To build locally you need Android Studio or the Android SDK: `npm run app:sync`, then `npx cap open android`.

## Pictures

Card pictures are [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) 3D images (MIT licence), embedded in `pictures.js` and keyed by emoji. When you add a card with a new emoji, run `node scripts/build-pictures.js` to regenerate `pictures.js`; otherwise the card falls back to the plain emoji.

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

- **Tests:** ESLint and the Playwright suite. The game's script in `index.html` is checked by `no-unsanitized` (unsafe HTML writes); the `.js` files are also checked by `eslint-plugin-security`.
- **Security:** `npm audit` for known vulnerabilities, `npm audit signatures`, and gitleaks secret detection over the full history. It also runs weekly on `main`.
- **Android:** Android Lint, a smoke test that opens the real app in an Android emulator and plays a card (`android-tests/`), and the APK build (see above).
- **Dependabot** opens weekly update PRs for npm packages, GitHub Actions and the Android project's Gradle libraries.
- **CodeQL** code scanning and **dependency review** of new packages. Both run only when the repo is public, since GitHub charges for them on private repos.

The game writes markup only through the `html` tagged template, which escapes every value. The linter enforces this.

## Roadmap

1. Picture card game (done)
2. Bigger shared word bank, including more everyday sentences
3. Session setup with listening and writing modes
4. Installable phone version, then an Android app (APK done)
