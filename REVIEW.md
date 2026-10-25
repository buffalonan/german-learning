# Review guide

What reviewers (human or Claude) should check on pull requests in this repo.

## Blocking

- **Wrong German.** Wrong article (der/die/das), wrong plural, misspelling, or a translation that doesn't match the English or Spanish. Every card must be correct; learners copy what they see.
- **Unsafe HTML.** Markup must be built with the `html` tagged template, which escapes values. Flag any `innerHTML`, `outerHTML` or `insertAdjacentHTML` fed by a plain string, and any use of `eval` or `new Function` in the game code. `scripts/build-pictures.js` is a local build script and may evaluate the word list.
- **Broken game logic.** Scoring, card order, the Again and Got it buttons, keyboard shortcuts (Space, A, L, N, 1, 2), or settings that stop being remembered.
- **New or changed behaviour without a test** in `tests/`.
- **Secrets or personal data** committed to the repo.
- **Phone layout broken:** content wider than the screen, or controls too small to tap.

## Worth a suggestion

- Cards whose picture doesn't clearly show the word.
- New emoji without a picture in `pictures.js` (the word bank test catches this, but say which ones).
- Copy that's unclear or inconsistent with the rest of the game.

## Not worth commenting on

- Formatting or style the linter doesn't flag.
- Restating what the diff does.
