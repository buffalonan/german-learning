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

## Roadmap

1. Picture card game (done)
2. Bigger shared word bank, including more everyday sentences
3. Session setup with listening and writing modes
4. Installable phone version, then an Android app
