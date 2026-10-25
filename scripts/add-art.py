"""Adds card illustrations: shrinks each picture to a 640px square WebP in art/<topic>/ and rebuilds art.js.

Usage: python3 scripts/add-art.py <topic id> <picture>... (needs Pillow: pip install pillow)
Each picture is named after the card's German word, e.g. sich-setzen.jpg or Glühbirne.png;
the file name is turned into the card's art name the same way the page's artName() does.
"""
import os
import re
import subprocess
import sys
import unicodedata

from PIL import Image

SIZE = 640


def art_name(word):
    # macOS file names often spell ü as u + a combining mark, so compose them first.
    word = unicodedata.normalize("NFC", word).lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        word = word.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", word).strip("-")


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    topic, pictures = sys.argv[1], sys.argv[2:]
    root = os.path.join(os.path.dirname(__file__), "..")
    out = os.path.join(root, "art", topic)
    os.makedirs(out, exist_ok=True)
    for src in pictures:
        im = Image.open(src).convert("RGB")
        side = min(im.size)
        left, top = (im.width - side) // 2, (im.height - side) // 2
        im = im.crop((left, top, left + side, top + side)).resize((SIZE, SIZE), Image.LANCZOS)
        dest = os.path.join(out, art_name(os.path.splitext(os.path.basename(src))[0]) + ".webp")
        im.save(dest, "WEBP", quality=78, method=6)
        print(f"{os.path.relpath(dest, root)}: {os.path.getsize(dest) // 1024} KB")
    subprocess.run(["node", os.path.join(root, "scripts", "build-art.js")], check=True)


if __name__ == "__main__":
    main()
