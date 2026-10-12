"""Mesure les sprites peints du Costard sans retoucher les originaux.

Usage : python3 tools/sprites/describe_costard.py
"""

import json
from pathlib import Path
import shutil
from statistics import median

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets_src/costard_sprites"
OUTPUT = ROOT / "public/assets/sprites"
SKINS = {"humain": "costard.png", "clair": "costard_clair.png",
         "mate": "costard_mate.png", "fonce": "costard_fonce.png"}


def describe(path):
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    pixels = alpha.load()
    bands = []
    start = None
    for y in range(height):
        occupied = sum(pixels[x, y] > 0 for x in range(width)) >= 4
        if occupied and start is None:
            start = y
        if not occupied and start is not None:
            if bands and start - bands[-1][1] < 4 and (y - start < 10 or bands[-1][1] - bands[-1][0] < 10):
                bands[-1][1] = y
            else:
                bands.append([start, y])
            start = None
    if start is not None:
        bands.append([start, height])
    if len(bands) != 12:
        raise ValueError(f"{path.name} : {len(bands)} lignes détectées, douze attendues")
    frames = []
    for row_index, (top, bottom) in enumerate(bands):
        row = []
        for column in range(8):
            left, right = round(column * width / 8), round((column + 1) * width / 8)
            box = alpha.crop((left, top, right, bottom)).getbbox()
            if box is None:
                raise ValueError(f"{path.name} : case vide {row_index}/{column}")
            x0, y0, x1, y1 = box
            x, y = max(left, left + x0 - 1), max(0, top + y0 - 1)
            w, h = min(right, left + x1 + 1) - x, min(height, top + y1 + 1) - y
            if row_index < 10:
                head_bottom = top + y0 + max(1, round((y1 - y0) * .14))
                head = [x_pixel for y_pixel in range(top + y0, head_bottom)
                        for x_pixel in range(left + x0, left + x1)
                        if pixels[x_pixel, y_pixel] > 0]
                anchor = median(head) - x
            else:
                anchor = w * .5
            row.append({"x": x, "y": y, "width": w, "height": h,
                        "anchorX": round(anchor, 2), "feetFromBottom": y + h - (top + y1)})
        frames.append(row)
    density = median(frame["height"] - 2 for frame in frames[0]) / 1.8
    return {"width": width, "height": height, "pixelsPerMeter": round(density, 5), "frames": frames}


def main():
    layouts = {skin: describe(SOURCE / filename) for skin, filename in SKINS.items()}
    data = {"personnage": "costard", "source": "assets_src/costard_sprites/generation.json",
            "cellWidth": 128, "cellHeight": 128, "columns": 8, "rows": 12,
            "pixelsPerMeter": layouts["humain"]["pixelsPerMeter"], "feetFromBottom": 0,
            "atlases": SKINS, "layouts": layouts,
            "animations": {
                "idle": {"row": 0, "frames": 1},
                "alert": {"row": 1, "frames": 1},
                "chase": {"row": 2, "frames": 4, "sequence": [2, 3, 4, 3], "metersPerCycle": 2.8},
                "aim": {"row": 5, "frames": 1},
                "fire": {"row": 6, "frames": 1, "duration": .12},
                "stagger": {"row": 7, "frames": 1},
                "death": {"row": 8, "frames": 4}}}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for filename in SKINS.values():
        shutil.copy2(SOURCE / filename, OUTPUT / filename)
    (OUTPUT / "costard.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print("Costard : 96 cases par peau, quatre peaux ; PNG copiés sans retouche.")


if __name__ == "__main__":
    main()
