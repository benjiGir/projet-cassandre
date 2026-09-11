"""Trim sheet du niveau v2 : bandes horizontales répétables (tranche d'étagère, plinthe, bandeau, néon…) dans une texture 128×128.

    ./.venv-refs/bin/python3 tools/textures/generate_trims.py
"""

import json
import os

from PIL import Image, ImageDraw

from generate_labels import BLACK, BLUE, RED, WHITE, YELLOW, draw_text, hexc, palette_image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets_src", "textures")
W = 128

GREY_D, GREY_M, GREY_L = hexc("#3b3a3c"), hexc("#7c7c7a"), hexc("#b4b6b4")


def tranche_etagere(d, y0):
    d.rectangle((0, y0, W - 1, y0 + 15), fill=GREY_M)
    d.line((0, y0, W - 1, y0), fill=GREY_L)
    d.line((0, y0 + 15, W - 1, y0 + 15), fill=GREY_D)
    for i, x in enumerate(range(3, W, 16)):
        promo = i % 4 == 2
        d.rectangle((x, y0 + 4, x + 10, y0 + 11), fill=YELLOW if promo else WHITE)
        d.rectangle((x, y0 + 4, x + 10, y0 + 5), fill=RED)


def plinthe(d, y0):
    d.rectangle((0, y0, W - 1, y0 + 15), fill=GREY_D)
    d.line((0, y0, W - 1, y0), fill=GREY_L)
    for x in range(0, W, 32):
        d.line((x, y0 + 1, x, y0 + 15), fill=BLACK)


def bandeau(img, d, y0):
    d.rectangle((0, y0, W - 1, y0 + 31), fill=YELLOW)
    d.rectangle((0, y0 + 3, W - 1, y0 + 6), fill=RED)
    d.rectangle((0, y0 + 25, W - 1, y0 + 28), fill=BLUE)
    for x in range(8, W, 64):
        draw_text(img, "HYPER", x, y0 + 11, RED, scale=2)


def bord_quai(d, y0):
    for y in range(y0, y0 + 16):
        for x in range(W):
            d.point((x, y), fill=YELLOW if ((x + y) // 8) % 2 == 0 else BLACK)


def grille_aeration(d, y0):
    d.rectangle((0, y0, W - 1, y0 + 15), fill=GREY_M)
    for y in range(y0 + 2, y0 + 15, 3):
        d.line((0, y, W - 1, y), fill=GREY_D)


def neon(d, y0):
    d.rectangle((0, y0, W - 1, y0 + 15), fill=GREY_L)
    d.rectangle((0, y0 + 4, W - 1, y0 + 11), fill=WHITE)
    d.line((0, y0 + 7, W - 1, y0 + 7), fill=hexc("#ffffff"))
    for x in range(0, W, 64):
        d.rectangle((x, y0 + 3, x + 2, y0 + 12), fill=GREY_M)


def corniere(d, y0):
    d.rectangle((0, y0, W - 1, y0 + 7), fill=GREY_M)
    d.line((0, y0, W - 1, y0), fill=GREY_L)
    d.line((0, y0 + 3, W - 1, y0 + 3), fill=GREY_D)


def joint_caoutchouc(d, y0):
    d.rectangle((0, y0, W - 1, y0 + 7), fill=BLACK)
    for x in range(0, W, 4):
        d.point((x, y0 + 3), fill=GREY_D)


BANDS = [
    ("tranche_etagere", 16, tranche_etagere), ("plinthe", 16, plinthe), ("bandeau_rayon", 32, bandeau),
    ("bord_quai", 16, bord_quai), ("grille_aeration", 16, grille_aeration), ("neon", 16, neon),
    ("corniere", 8, corniere), ("joint_caoutchouc", 8, joint_caoutchouc),
]


def main() -> None:
    img = Image.new("RGB", (W, W))
    d = ImageDraw.Draw(img)
    layout, y = {}, 0
    for name, h, fn in BANDS:
        if fn is bandeau:
            fn(img, d, y)
        else:
            fn(d, y)
        layout[name] = {"y": y, "height": h}
        y += h
    assert y == W, f"les bandes font {y} px, il en faut {W}"
    img = img.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")
    img.save(os.path.join(OUT, "trim_hypermarche.png"))
    with open(os.path.join(OUT, "trim_hypermarche.json"), "w") as f:
        json.dump({"width": W, "bands": layout}, f, indent=2)
    print(f"ok  trim_hypermarche.png ({len(BANDS)} bandes) + trim_hypermarche.json")


if __name__ == "__main__":
    main()
