"""Atlas 128 px des compositions publiques.

    .venv-refs/bin/python3 tools/textures/generate_public_compositions.py
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw
from generate_labels import BLACK, WHITE, YELLOW, RED, draw_text, hexc, palette_image, text_width


def main():
    out = Path(__file__).resolve().parents[2] / "assets_src/textures"
    image = Image.new("RGB", (128, 128), BLACK)
    draw = ImageDraw.Draw(image)
    regions = {}
    for name, text, y, background, ink in (
        ("presse", "PRESSE DU JOUR", 0, RED, WHITE),
        ("reparation", "REPARATIONS", 16, hexc("#1f5fbf"), WHITE),
        ("cola", "SPECIAL 5G", 32, YELLOW, RED),
        ("reassort", "REASSORT", 48, hexc("#e8741c"), BLACK),
    ):
        draw.rectangle((0, y, 127, y+15), fill=background, outline=BLACK)
        draw_text(image, text, (128-text_width(text, 2))//2, y+3, ink, scale=2)
        regions[name] = [0, y, 128, 16]
    image.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB").save(out / "sig_compositions.png")
    (out / "sig_compositions.json").write_text(json.dumps({"atlas_px":128, "regions":regions}, indent=2)+"\n")
    print("PUBLIC_COMPOSITION_ATLAS=128x128")


if __name__ == "__main__":
    main()
