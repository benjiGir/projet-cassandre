"""Trois façades originales de distributeurs, atlas rétro de 128 × 128."""
from pathlib import Path

from PIL import Image, ImageDraw
from generate_labels import draw_text, hexc, text_width

OUT = Path(__file__).resolve().parents[2] / "assets_src/textures"
WHITE, DARK, STEEL = "#f2efe6", "#111014", "#aeb9bd"
VARIANTS = {
    "soda_5g_cola": ("5G COLA", "#b02931", "#54bd6d", "1,50"),
    "chips_illumi": ("ILLUMI", "#553761", "#f2c230", "2,00"),
    "cafe_reveille": ("REVEILLE", "#bdae9a", "#e8741c", "0,80"),
}


def label(image, text, x, y, color=WHITE, scale=1):
    draw_text(image, text, x, y, hexc(color), scale)


def facade(kind):
    brand, body, accent, price = VARIANTS[kind]
    image = Image.new("RGB", (128, 256), body)
    d = ImageDraw.Draw(image)
    d.rectangle((3, 3, 124, 243), outline=STEEL, width=2)
    d.rectangle((8, 8, 119, 40), fill=DARK)
    label(image, brand, (128 - text_width(brand, 3)) // 2, 15, scale=3)
    d.rectangle((8, 45, 119, 49), fill=accent)
    d.rectangle((10, 54, 86, 186), fill="#19252b", outline=STEEL, width=3)
    if kind == "cafe_reveille":
        for row, text in enumerate(("CAFE", "EXPRESSO", "CHOCOLAT")):
            label(image, text, 17, 65 + row * 22, accent, 2)
        d.rectangle((18, 132, 78, 179), fill=DARK, outline="#444a54", width=2)
        d.rectangle((44, 133, 53, 145), fill=STEEL)
        d.polygon(((36, 151), (60, 151), (56, 169), (40, 169)), fill=WHITE)
        d.ellipse((56, 152, 68, 163), outline=WHITE, width=3)
        d.rectangle((28, 173, 69, 177), fill=STEEL)
    else:
        for row in range(4):
            for col in range(3):
                x, y = 18 + col * 22, 61 + row * 29
                color = ("#b02931", "#54bd6d", "#f2c230")[(row + col) % 3]
                if kind == "chips_illumi":
                    color = ("#f2c230", "#e8741c", "#54bd6d")[(row + col) % 3]
                    d.polygon(((x, y), (x + 13, y), (x + 14, y + 21), (x - 1, y + 21)), fill=color)
                    d.line((x, y + 2, x + 12, y + 2), fill=WHITE)
                    d.polygon(((x + 6, y + 5), (x + 11, y + 14), (x + 1, y + 14)), fill=DARK)
                    d.point((x + 6, y + 11), fill=WHITE)
                else:
                    d.rounded_rectangle((x, y, x + 12, y + 21), radius=2, fill=color)
                    d.rectangle((x + 1, y, x + 11, y + 2), fill=STEEL)
                    d.rectangle((x + 2, y + 9, x + 10, y + 12), fill=WHITE)
                    d.line((x + 2, y + 3, x + 2, y + 7), fill=WHITE)
            d.rectangle((14, y + 24, 82, y + 26), fill=STEEL)
        d.line((14, 60, 14, 161), fill="#70878e", width=2)
        d.line((77, 61, 77, 111), fill="#70878e", width=2)
    d.rectangle((94, 58, 116, 79), fill=DARK)
    label(image, price, 98, 65, "#54bd6d")
    for row in range(4):
        y = 91 + row * 17
        d.rectangle((95, y, 115, y + 11), fill=STEEL)
        d.rectangle((98, y + 2, 111, y + 4), fill=accent)
        label(image, str(row + 1), 99, y + 5, DARK)
    d.rectangle((97, 165, 114, 170), fill=DARK)
    d.rectangle((103, 175, 115, 185), fill=STEEL)
    d.rectangle((15, 201, 110, 237), fill=DARK, outline=STEEL, width=2)
    text = "GOBELETS" if kind == "cafe_reveille" else "RETRAIT"
    label(image, text, (128 - text_width(text, 2)) // 2, 211, scale=2)
    for i, color in enumerate((body, DARK, STEEL, WHITE, accent, "#70878e", "#444a54", "#54bd6d")):
        d.rectangle((i * 16, 244, i * 16 + 15, 255), fill=color)
    image.resize((128, 128), Image.Resampling.NEAREST).save(OUT / f"prd_distributeur_{kind}.png")
    emission = Image.new("RGB", image.size, "black")
    for region in ((8, 8, 120, 41), (10, 54, 87, 187), (94, 58, 117, 80)):
        emission.paste(image.crop(region), region[:2])
    emission.resize((128, 128), Image.Resampling.NEAREST).save(OUT / f"prd_distributeur_{kind}_emission.png")


if __name__ == "__main__":
    for variant in VARIANTS:
        facade(variant)
    print("Trois façades de distributeurs générées")
