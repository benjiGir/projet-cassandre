"""Signalétique des caisses : atlas 128×128, numéros, prix et deux bandeaux.

    .venv-refs/bin/python3 tools/textures/generate_checkout_signs.py
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw
from generate_labels import draw_text, text_width, WHITE, BLACK, GREEN, RED

OUT = Path(__file__).resolve().parents[2] / "assets_src/textures"


def main():
    atlas = Image.new("RGB", (128, 128), BLACK)
    labels = {}
    for i in range(6):
        tile = Image.new("RGB", (32, 32), RED if i in (0, 5) else GREEN)
        draw = ImageDraw.Draw(tile)
        draw.rectangle((1, 1, 30, 30), outline=WHITE)
        draw_text(tile, str(i + 1), 10, 4, WHITE, scale=4)
        label = "FERMEE" if i in (0, 5) else "EXPRESS" if i == 3 else "CAISSE"
        draw_text(tile, label, (32 - text_width(label)) // 2, 25, WHITE)
        x, y = i % 4, i // 4
        atlas.paste(tile, (x * 32, y * 32))
        labels[f"ck_num_{i + 1}"] = {"cell": [x, y]}
    for x, name, text, bg, color in [(2, "ck_prix", "19,90", BLACK, GREEN),
                                     (3, "ck_cb", "CB", BLACK, WHITE)]:
        tile = Image.new("RGB", (32, 32), bg)
        draw_text(tile, text, (32 - text_width(text)) // 2, 13, color)
        if name == "ck_cb":
            ImageDraw.Draw(tile).rectangle((8, 22, 23, 24), fill=GREEN)
        atlas.paste(tile, (x * 32, 32))
        labels[name] = {"cell": [x, 1]}
    for y, text in [(64, "CAISSES"), (96, "SORTIE")]:
        tile = Image.new("RGB", (128, 32), GREEN)
        draw = ImageDraw.Draw(tile)
        draw.rectangle((1, 1, 126, 30), outline=WHITE)
        draw_text(tile, text, (128 - text_width(text, 3)) // 2, 8, WHITE, scale=3)
        atlas.paste(tile, (0, y))
    atlas.save(OUT / "sig_caisses.png")
    (OUT / "sig_caisses.json").write_text(json.dumps({"labels": labels, "regions": {
        "caisses": [0, 64, 128, 32], "sortie": [0, 96, 128, 32],
    }}, indent=2) + "\n")
    print("Signalétique des caisses générée")


if __name__ == "__main__":
    main()
