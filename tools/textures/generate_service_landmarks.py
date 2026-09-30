"""Signalétique des deux repères du couloir coupe-feu, atlas 128 px.

    .venv-refs/bin/python3 tools/textures/generate_service_landmarks.py
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw
from generate_labels import BLACK, WHITE, YELLOW, draw_text, hexc, palette_image, text_width

OUT = Path(__file__).resolve().parents[2] / "assets_src/textures"


def main():
    image = Image.new("RGB", (128, 128), BLACK)
    draw = ImageDraw.Draw(image)
    regions = {}
    for name, text, y, color in (
        ("sav", "SAV", 0, hexc("#1f5fbf")),
        ("retours", "DEPOT RETOURS", 16, hexc("#1f5fbf")),
        ("froid", "CHAMBRE FROIDE", 32, hexc("#444a54")),
        ("maintenance", "MAINTENANCE", 48, YELLOW),
        ("technique", "FROID", 64, YELLOW),
    ):
        draw.rectangle((0, y, 127, y + 15), fill=color, outline=BLACK)
        ink = BLACK if color == YELLOW else WHITE
        draw_text(image, text, (128 - text_width(text, 2)) // 2, y + 3, ink, scale=2)
        regions[name] = [0, y, 128, 16]
    draw.rectangle((0, 80, 63, 111), fill=YELLOW, outline=BLACK)
    draw.polygon(((6, 104), (19, 84), (32, 104)), fill=BLACK)
    draw_text(image, "!", 18, 92, YELLOW)
    draw_text(image, "SOL", 38, 88, BLACK)
    draw_text(image, "MOUILLE", 34, 99, BLACK)
    regions["fuite"] = [0, 80, 64, 32]
    image.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB").save(OUT / "sig_service.png")
    (OUT / "sig_service.json").write_text(json.dumps({"atlas_px": 128, "regions": regions}, indent=2) + "\n")
    print("SERVICE_SIGNS=128x128")


if __name__ == "__main__":
    main()
