# German learning games

Small web games for practising everyday German together.

## Sag's auf Deutsch (picture cards)

`index.html` is a self-contained page: open it in any browser, no build step.

- Pick topics (colours, numbers, food, verbs, home, work, animals, body, clothes, weather, science, town, everyday phrases).
- **Race mode:** two players on one laptop. Player 1 claims a card with `A`, player 2 with `L`, `Space` flips, then award the point (`A`, `L`, or `N` for nobody).
- **Practice mode:** flip, then `1` for "again" (the card comes back later) or `2` for "got it".
- The back shows the German with the article colour-coded (der blue, die red, das green, plural brown), plus English and Spanish, and reads it aloud with the browser's German voice.

The word bank is the `TOPICS` array near the top of the script. Each card is `[front, german, article, english, spanish, feminine form]`, where `front` is an emoji, a `#hex` colour swatch, or `n:12` for a numeral.

## Roadmap

1. Picture card game (done)
2. Bigger shared word bank, including more everyday sentences
3. Session setup with listening and writing modes
4. Installable phone version, then an Android app
