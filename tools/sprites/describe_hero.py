"""Décrit les cases du héros peint, sans modifier les images originales.

Les limites suivent les marges transparentes des planches générées.
Usage : python3 tools/sprites/describe_hero.py
"""
import json
from pathlib import Path
import shutil

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets_src/hero_sprites"
OUTPUT = ROOT / "public/assets/characters"


def describe(name, rows=4):
    path = SOURCE / f"{name}.png"
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    alpha = image.getchannel("A")
    pixels = alpha.load()
    counts = [sum(pixels[x, y] >= 128 for x in range(width)) for y in range(height)]
    content_height = alpha.point(lambda a: 255 if a >= 128 else 0).getbbox()[3]
    cuts = [0] + [min(range(round(i * content_height / rows - .035 * height),
                            round(i * content_height / rows + .035 * height)), key=lambda y: counts[y])
                  for i in range(1, rows)] + [content_height]
    frames = []
    for top, bottom in zip(cuts, cuts[1:]):
        row = []
        for column in range(8):
            left, right = round(column * width / 8), round((column + 1) * width / 8)
            bounds = alpha.crop((left, top, right, bottom)).point(lambda a: 255 if a >= 128 else 0).getbbox()
            if bounds is None:
                raise ValueError(f"{name} : case vide, colonne {column}")
            x0, y0, x1, y1 = bounds
            # Ancrer sur la tête évite qu'une arme étendue décale tout le corps.
            head_bottom = min(y1, y0 + round((y1 - y0) * .13))
            head = [(x + left) for y in range(top + y0, top + head_bottom)
                    for x in range(x0, x1) if pixels[x + left, y] >= 128]
            center = sum(head) / len(head)
            x = max(left, left + x0 - 1)
            y = max(top, top + y0 - 1)
            w = min(right, left + x1 + 1) - x
            h = min(bottom, top + y1 + 1) - y
            row.append({"x": x, "y": y, "width": w, "height": h, "anchorX": round(center - x, 2)})
        frames.append(row)
    target = f"hero-{name}.png"
    shutil.copy2(path, OUTPUT / target)
    return {"file": target, "width": width, "height": height, "frames": frames}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    data = {name: describe(name) for name in ("locomotion", "equipment", "actions")}
    data["armedWalk"] = describe("armed-walk", rows=7)
    (OUTPUT / "hero.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print("Héros : 152 cases décrites ; originaux copiés sans retouche.")


if __name__ == "__main__":
    main()
