"""Textures originales des commandes de porte et du distributeur secret.

    .venv-refs/bin/python3 tools/textures/generate_door_controls.py
"""
from pathlib import Path

from PIL import Image, ImageDraw
from generate_labels import draw_text, text_width

OUT = Path(__file__).resolve().parents[2] / "assets_src/textures"
COLORS = ("#2f3541", "#444a54", "#d5d7d8", "#f2efe6", "#111014", "#54bd6d", "#f2c230", "#b02931")


def title(tile, label, y, color, scale=1):
    color = tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))
    draw_text(tile, label, (tile.width - text_width(label, scale)) // 2, y, color, scale)


def controls():
    atlas = Image.new("RGB", (128, 128), COLORS[0])
    for i, (label, accent) in enumerate((("ARGENT", "#d5d7d8"), ("OR", "#f2c230"),
                                         ("PLATINE", "#b5d2e8"), ("OUVRIR", "#54bd6d"))):
        tile = Image.new("RGB", (64, 96), COLORS[0])
        d = ImageDraw.Draw(tile)
        d.rounded_rectangle((2, 2, 61, 93), radius=5, outline=COLORS[2], width=2)
        d.rectangle((6, 6, 57, 23), fill=accent)
        title(tile, label, 10, COLORS[4], 2)
        for x, y in ((7, 29), (55, 29), (7, 87), (55, 87)):
            d.rectangle((x - 1, y - 1, x + 1, y + 1), fill=COLORS[2])
        if i < 3:
            d.rounded_rectangle((16, 34, 47, 54), radius=2, fill=accent)
            d.rectangle((18, 39, 45, 42), fill=COLORS[4])
            d.rectangle((21, 46, 27, 50), fill=COLORS[6])
            d.rectangle((12, 60, 51, 68), fill=COLORS[4])
            d.rectangle((15, 61, 48, 62), fill=COLORS[2])
            title(tile, "BADGE", 77, COLORS[3])
        else:
            d.ellipse((12, 33, 51, 72), fill=COLORS[4], outline=COLORS[2], width=3)
            d.ellipse((18, 39, 45, 66), fill=COLORS[5])
            d.rectangle((29, 46, 34, 58), fill=COLORS[3])
            d.polygon(((25, 53), (32, 60), (39, 53)), fill=COLORS[3])
            title(tile, "APPUYER", 79, COLORS[3])
        atlas.paste(tile.resize((64, 48), Image.Resampling.NEAREST), ((i % 2) * 64, (i // 2) * 48))
    for i, color in enumerate(COLORS):
        ImageDraw.Draw(atlas).rectangle((i * 16, 96, i * 16 + 15, 127), fill=color)
    atlas.save(OUT / "prd_commandes.png")


def vending():
    image = Image.new("RGB", (128, 256), "#b02931")
    d = ImageDraw.Draw(image)
    d.rectangle((4, 4, 123, 251), outline="#f2efe6", width=2)
    d.rectangle((10, 12, 117, 42), fill="#111014")
    title(image, "5G COLA", 21, "#f2efe6", 3)
    d.rectangle((11, 53, 85, 187), fill="#111014", outline="#d5d7d8", width=3)
    for row in range(4):
        for col in range(3):
            x, y = 19 + col * 21, 62 + row * 29
            color = ("#b02931", "#54bd6d", "#f2c230")[(col + row) % 3]
            d.rectangle((x, y, x + 11, y + 19), fill=color)
            d.rectangle((x, y, x + 11, y + 2), fill="#d5d7d8")
            d.rectangle((x + 2, y + 8, x + 9, y + 11), fill="#f2efe6")
        d.rectangle((14, 86 + row * 29, 81, 88 + row * 29), fill="#767676")
    d.rectangle((94, 60, 112, 78), fill="#111014")
    draw_text(image, "1,50", 96, 66, (84, 189, 109))
    for row in range(4):
        d.rectangle((95, 90 + row * 17, 112, 101 + row * 17), fill="#d5d7d8")
        d.rectangle((97, 92 + row * 17, 109, 94 + row * 17), fill="#54bd6d")
    d.rectangle((95, 166, 112, 171), fill="#111014")
    d.rectangle((15, 203, 110, 237), fill="#111014", outline="#444a54", width=3)
    title(image, "RETRAIT", 215, "#d5d7d8", 2)
    # Les aplats de la dernière bande habillent le caisson et les pieds.
    d.rectangle((0, 244, 31, 255), fill="#b02931")
    d.rectangle((32, 244, 63, 255), fill="#111014")
    d.rectangle((64, 244, 95, 255), fill="#d5d7d8")
    d.rectangle((96, 244, 127, 255), fill="#54bd6d")
    image.resize((128, 128), Image.Resampling.NEAREST).save(OUT / "prd_distributeur_secret.png")


if __name__ == "__main__":
    controls()
    vending()
    print("Textures des commandes et du distributeur générées")
