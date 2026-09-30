"""Generate the 128×128 route signage atlas.

    .venv-refs/bin/python3 tools/textures/generate_wayfinding.py
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw
from generate_labels import (BLACK, BLUE, GREEN, ORANGE, WHITE, draw_text,
                             palette_image, text_width)

OUT = Path(__file__).resolve().parents[2] / "assets_src/textures"
BANDS = (
    ("reserve_avancer", "RESERVE", "up", ORANGE, BLACK),
    ("bureaux_avancer", "BUREAUX", "up", BLUE, WHITE),
    ("bureaux_gauche", "BUREAUX", "left", BLUE, WHITE),
    ("bureaux_droite", "BUREAUX", "right", BLUE, WHITE),
    ("magasin_avancer", "RETOUR MAGASIN", "up", GREEN, WHITE),
    ("magasin_gauche", "RETOUR MAGASIN", "left", GREEN, WHITE),
    ("magasin_droite", "RETOUR MAGASIN", "right", GREEN, WHITE),
    ("parking_avancer", "PARKING", "up", BLUE, WHITE),
)


def main():
    image = Image.new("RGB", (128, 128), BLACK)
    draw = ImageDraw.Draw(image)
    metadata = {}
    for i, (name, text, direction, background, ink) in enumerate(BANDS):
        y = i * 16
        draw.rectangle((0, y + 1, 127, y + 14), fill=background)
        # A solid pixel arrow remains readable before the text does.
        arrow = [(7, 2), (2, 7), (5, 7), (5, 12), (9, 12), (9, 7), (12, 7)]
        if direction == "left":
            arrow = [(cy, 14 - cx) for cx, cy in arrow]
        elif direction == "right":
            arrow = [(14 - cy, cx) for cx, cy in arrow]
        draw.polygon([(x, y + yy) for x, yy in arrow], fill=ink)
        start = 16 + (110 - text_width(text, 2)) // 2
        draw_text(image, text, start, y + 3, ink, scale=2)
        metadata[name] = {"y": y, "height": 16, "text": text,
                          "arrow": direction, "pas": 128}
    image = image.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")
    image.save(OUT / "sig_parcours.png")
    (OUT / "sig_parcours.json").write_text(
        json.dumps({"width": 128, "bands": metadata}, indent=2) + "\n")
    print("WAYFINDING_ATLAS=128x128 bands=8")


if __name__ == "__main__":
    main()
