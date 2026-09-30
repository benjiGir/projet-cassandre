"""Generate cardboard bale textures and recycling room signs (128 px).

    .venv-refs/bin/python3 tools/textures/generate_compacteur.py
"""
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw
from generate_labels import (BLACK, WHITE, RED, YELLOW, draw_text, hexc,
                             palette_image, text_width)

OUT = Path(__file__).resolve().parents[2] / "assets_src/textures"


def quantize(image):
    return image.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")


def cardboard(loose):
    rng = random.Random(20260930)
    image = Image.new("RGB", (128, 128), hexc("#a58a60"))
    draw = ImageDraw.Draw(image)
    colors = [hexc(c) for c in ("#654933", "#806e5a", "#a58a60", "#ba8c4b", "#deb789")]
    y = 0
    while y < 128:
        height = rng.randrange(2, 6)
        draw.rectangle((0, y, 127, y + height), fill=rng.choice(colors[1:]))
        draw.line((0, y, 127, y), fill=colors[0])
        for _ in range(4):
            x = rng.randrange(128)
            draw.line((x, y + 1, min(127, x + rng.randrange(3, 15)), y + 1), fill=rng.choice(colors))
        y += height
    for _ in range(130):
        x, y = rng.randrange(128), rng.randrange(128)
        draw.point((x, y), fill=rng.choice(colors))
    for x in (19, 57, 95):
        if loose and x != 19:
            continue
        if loose:
            draw.rectangle((x, 0, x + 2, 26), fill=BLACK)
            draw.line((x + 1, 26, x + 10, 39, x + 8, 50), fill=BLACK, width=3)
            draw.rectangle((x, 80, x + 2, 127), fill=BLACK)
        else:
            draw.rectangle((x, 0, x + 2, 127), fill=BLACK)
            draw.line((x + 1, 0, x + 1, 127), fill=hexc("#605c58"))
    return quantize(image)


def signs():
    image = Image.new("RGB", (128, 128), BLACK)
    draw = ImageDraw.Draw(image)
    regions = {}

    def banner(name, text, y, background, ink):
        draw.rectangle((0, y, 127, y + 15), fill=background, outline=BLACK)
        draw_text(image, text, (128 - text_width(text, 2)) // 2, y + 3, ink, scale=2)
        regions[name] = [0, y, 128, 16]

    banner("presse", "PRESSE A CARTON", 0, hexc("#65814b"), WHITE)
    banner("maintenance", "HORS SERVICE", 16, YELLOW, BLACK)
    banner("quai", "QUAI", 32, hexc("#1f5fbf"), WHITE)
    draw.rectangle((0, 48, 63, 79), fill=WHITE, outline=BLACK)
    draw.polygon(((13, 52), (23, 70), (3, 70)), fill=YELLOW, outline=BLACK)
    draw_text(image, "!", 11, 60, BLACK)
    draw_text(image, "STOP", 29, 58, RED, scale=2)
    regions["danger"] = [0, 48, 64, 32]
    draw.rectangle((64, 48, 127, 79), fill=hexc("#deb789"), outline=BLACK)
    draw_text(image, "RONDES", 73, 52, BLACK, scale=2)
    for row in range(2):
        for col in range(5):
            x, y = 70 + 11 * col, 65 + 6 * row
            draw.rectangle((x, y, x + 7, y + 4), outline=hexc("#806e5a"))
            if (row + col) % 3 != 0:
                draw.line((x + 1, y + 2, x + 3, y + 3, x + 6, y + 1), fill=RED)
    regions["rondes"] = [64, 48, 64, 32]
    draw.rectangle((0, 80, 63, 111), fill=hexc("#444a54"), outline=BLACK)
    draw_text(image, "SECURITE", 1, 84, WHITE, scale=2)
    draw_text(image, "PAUSE", 13, 99, YELLOW, scale=2)
    regions["pause"] = [0, 80, 64, 32]
    return quantize(image), regions


def main():
    for name, loose in (("carton_compresse", False), ("carton_mal_cercle", True)):
        cardboard(loose).save(OUT / f"{name}.png")
    image, regions = signs()
    image.save(OUT / "sig_compacteur.png")
    (OUT / "sig_compacteur.json").write_text(json.dumps({"atlas_px": 128, "regions": regions}, indent=2) + "\n")
    print("COMPACTEUR_TEXTURES=3 size=128x128")


if __name__ == "__main__":
    main()
