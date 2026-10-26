#!/usr/bin/env python3
"""Make the hedgehog logo in every size the web page and the Android app need.

Usage: python3 scripts/build-logo.py <original picture>

The original (1646px square, hedgehog on the right, "hallo!" bubble on the left) is in the
project's shared files at illustrations/logo/. Writes:
  logo/hedgehog.webp           the whole picture, bubble included, for the setup screen
  logo/icon-32.png, icon-180.png, icon-192.png, icon-512.png
                               the hedgehog alone, for the favicon (just its face), Apple touch icon and web manifest
  android/.../mipmap-*/ic_launcher*.png and drawable*/splash.png
Needs Pillow.
"""
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
CREAM = (248, 243, 231)  # the picture's paper colour; also ic_launcher_background
HOG = (570, 230, 1590, 1570)  # the hedgehog without the speech bubble, in the original's pixels
FACE = (585, 420, 1265, 1100)  # head and scarf, for the 32px favicon
BUBBLE = [(0, 0, 700, 450), (0, 0, 570, 620)]  # painted over so its edge doesn't peek into the crops
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def on_cream(pic, size, fill):
    """pic centred on a size×size cream square, scaled to take `fill` of its height."""
    out = Image.new("RGB", (size, size), CREAM)
    scale = size * fill / pic.height
    p = pic.resize((max(1, round(pic.width * scale)), max(1, round(pic.height * scale))), Image.LANCZOS)
    out.paste(p, ((size - p.width) // 2, (size - p.height) // 2))
    return out


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def circle(img):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, img.width - 1, img.height - 1), fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Image.open(sys.argv[1]).convert("RGB")
    plain = src.copy()
    for box in BUBBLE:
        ImageDraw.Draw(plain).rectangle(box, fill=CREAM)
    hog = plain.crop(HOG)
    os.makedirs(os.path.join(ROOT, "logo"), exist_ok=True)

    src.resize((320, 320), Image.LANCZOS).save(os.path.join(ROOT, "logo", "hedgehog.webp"), quality=82, method=6)
    plain.crop(FACE).resize((32, 32), Image.LANCZOS).save(os.path.join(ROOT, "logo", "icon-32.png"), optimize=True)
    for size in (180, 192, 512):
        on_cream(hog, size, 0.92).save(os.path.join(ROOT, "logo", f"icon-{size}.png"), optimize=True)

    for name, k in DENSITIES.items():
        folder = os.path.join(RES, f"mipmap-{name}")
        legacy = on_cream(hog, round(48 * k), 0.84)
        rounded(legacy, round(48 * k * 0.18)).save(os.path.join(folder, "ic_launcher.png"), optimize=True)
        circle(on_cream(hog, round(48 * k), 0.78)).save(os.path.join(folder, "ic_launcher_round.png"), optimize=True)
        # Adaptive icon: 108dp layer, of which the launcher shows the middle 72dp or less (66dp safe circle).
        on_cream(hog, round(108 * k), 0.56).save(os.path.join(folder, "ic_launcher_foreground.png"), optimize=True)

    for folder in sorted(os.listdir(RES)):
        path = os.path.join(RES, folder, "splash.png")
        if not os.path.exists(path):
            continue
        w, h = Image.open(path).size
        side = round(min(w, h) * 0.62)
        splash = Image.new("RGB", (w, h), CREAM)
        splash.paste(src.resize((side, side), Image.LANCZOS), ((w - side) // 2, (h - side) // 2))
        splash.save(path, optimize=True)


if __name__ == "__main__":
    main()
