"""Atlas d'étiquettes des marques inventées : 16 faces de produit de 32×32 dans une texture 128×128, quantifiée sur la palette.

    ./.venv-refs/bin/python3 tools/textures/generate_labels.py
"""

import json
import os

from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets_src", "textures")
CELL = 32

# Police pixel 3×5 : à 32 px par face, une police lissée deviendrait illisible une fois quantifiée.
FONT = {
    "A": "010101111101101", "B": "110101110101110", "C": "011100100100011", "D": "110101101101110",
    "E": "111100110100111", "F": "111100110100100", "G": "011100101101011", "H": "101101111101101",
    "I": "111010010010111", "J": "001001001101010", "K": "101101110101101", "L": "100100100100111",
    "M": "101111111101101", "N": "110101101101101", "O": "010101101101010", "P": "110101110100100",
    "Q": "010101101110011", "R": "110101110101101", "S": "011100010001110", "T": "111010010010010",
    "U": "101101101101111", "V": "101101101101010", "W": "101101111111101", "X": "101101010101101",
    "Y": "101101010010010", "Z": "111001010100111", "0": "111101101101111", "1": "010110010010111",
    "2": "110001010100111", "3": "110001010001110", "4": "101101111001001", "5": "111100110001110",
    "6": "011100110101010", "7": "111001010010010", "8": "010101010101010", "9": "010101011001110",
    "%": "101001010100101", "-": "000000111000000", ".": "000000000000010", "!": "010010010000010",
    # Ponctuation des slogans d'affiches (`generate_affiches.py`). Pas d'accents :
    # une capitale de 5 px de haut n'a pas la place d'en porter un.
    "'": "010010000000000", ",": "000000000010100", "?": "110001010000010", ":": "000010000010000",
    " ": "000000000000000",
}


def text_width(s: str, scale: int = 1) -> int:
    return (len(s) * 4 - 1) * scale


def draw_text(img: Image.Image, s: str, x: int, y: int, color, scale: int = 1) -> None:
    px = img.load()
    for i, ch in enumerate(s):
        bits = FONT[ch]
        for r in range(5):
            for c in range(3):
                if bits[r * 3 + c] == "1":
                    for dy in range(scale):
                        for dx in range(scale):
                            X, Y = x + (i * 4 + c) * scale + dx, y + r * scale + dy
                            if 0 <= X < img.width and 0 <= Y < img.height:
                                px[X, Y] = color


def centered(img, s, y, color, scale=1):
    draw_text(img, s, (CELL - text_width(s, scale)) // 2, y, color, scale)


def hexc(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


BLACK, WHITE, RED, YELLOW = hexc("#111014"), hexc("#f2efe6"), hexc("#d8231f"), hexc("#f2c230")
BLUE, GREEN, ORANGE, MAGENTA = hexc("#1f5fbf"), hexc("#2e9e44"), hexc("#e8741c"), hexc("#c2307a")


def face(bg, band=None):
    img = Image.new("RGB", (CELL, CELL), bg)
    d = ImageDraw.Draw(img)
    if band:
        d.rectangle((0, 21, CELL - 1, 29), fill=band)
    return img, d


def pyramides():
    img, d = face(YELLOW, RED)
    d.polygon([(16, 4), (26, 18), (6, 18)], fill=ORANGE, outline=BLACK)
    d.ellipse((13, 10, 19, 15), fill=WHITE, outline=BLACK)
    d.point((16, 12), fill=BLACK)
    centered(img, "PYRAMIDE", 23, WHITE)
    return img


def trainees():
    img, d = face(WHITE, BLUE)
    d.rectangle((0, 0, CELL - 1, 3), fill=BLUE)
    for y in (9, 12, 15):
        d.line((3, y, 18, y), fill=hexc("#b4b6b4"))
    d.polygon([(18, 10), (28, 12), (18, 14)], fill=BLACK)
    d.line((22, 8, 22, 16), fill=BLACK)
    centered(img, "LAIT", 23, WHITE)
    return img


def terre_plate():
    img, d = face(hexc("#6cb4d6"), BLUE)
    d.ellipse((5, 9, 27, 15), fill=GREEN, outline=BLACK)
    d.line((5, 12, 27, 12), fill=hexc("#1f5fbf"))
    d.line((6, 15, 6, 19), fill=WHITE)
    d.line((26, 15, 26, 19), fill=WHITE)
    centered(img, "PLATE", 23, WHITE)
    return img


def cola_5g():
    img, d = face(RED, BLACK)
    centered(img, "5G", 4, WHITE, scale=3)
    centered(img, "COLA", 23, YELLOW)
    return img


def bunker():
    img, d = face(hexc("#5f6b3f"), BLACK)
    d.ellipse((9, 4, 23, 18), fill=YELLOW, outline=BLACK)
    d.pieslice((9, 4, 23, 18), 240, 300, fill=BLACK)
    d.pieslice((9, 4, 23, 18), 0, 60, fill=BLACK)
    d.pieslice((9, 4, 23, 18), 120, 180, fill=BLACK)
    d.ellipse((14, 9, 18, 13), fill=YELLOW, outline=BLACK)
    centered(img, "BUNKER", 23, YELLOW)
    return img


def alu_protect():
    img, d = face(hexc("#b4b6b4"), BLUE)
    d.polygon([(16, 3), (25, 17), (7, 17)], fill=WHITE, outline=BLACK)
    for x in (11, 16, 21):
        d.line((x, 8, x - 1, 16), fill=hexc("#8e8e8c"))
    centered(img, "ALU", 23, WHITE)
    return img


def reptiliens():
    img, d = face(GREEN, BLACK)
    d.ellipse((6, 5, 26, 18), fill=YELLOW, outline=BLACK)
    d.rectangle((15, 6, 17, 17), fill=BLACK)
    centered(img, "SABLES", 23, YELLOW)
    return img


def reveille():
    img, d = face(hexc("#5a3a22"), ORANGE)
    d.ellipse((5, 7, 27, 17), fill=WHITE, outline=BLACK)
    d.ellipse((12, 8, 20, 16), fill=BLUE)
    d.ellipse((14, 10, 18, 14), fill=BLACK)
    centered(img, "CAFE", 23, BLACK)
    return img


def illumi():
    img, d = face(MAGENTA, BLACK)
    d.polygon([(16, 3), (27, 19), (5, 19)], outline=YELLOW)
    d.polygon([(16, 7), (23, 17), (9, 17)], fill=YELLOW)
    centered(img, "ILLUMI", 23, YELLOW)
    return img


def profonde():
    img, d = face(BLUE, ORANGE)
    d.rectangle((13, 3, 19, 6), fill=RED)
    d.polygon([(13, 6), (19, 6), (21, 18), (16, 20), (11, 18)], fill=RED, outline=BLACK)
    centered(img, "PROFONDE", 23, WHITE)
    return img


def nouvel_ordre():
    img, d = face(YELLOW, BLUE)
    d.ellipse((8, 3, 24, 19), fill=BLUE, outline=BLACK)
    d.line((8, 11, 24, 11), fill=WHITE)
    d.ellipse((12, 3, 20, 19), outline=WHITE)
    centered(img, "N.O.M.", 23, YELLOW)
    return img


def sans_fluor():
    img, d = face(WHITE, RED)
    d.polygon([(10, 5), (22, 5), (22, 12), (19, 18), (16, 13), (13, 18), (10, 12)], fill=WHITE, outline=BLUE)
    d.line((4, 4, 28, 18), fill=RED)
    centered(img, "FLUOR", 23, WHITE)
    return img


def lune_truquee():
    img, d = face(BLACK, YELLOW)
    d.ellipse((8, 3, 22, 17), fill=YELLOW)
    d.ellipse((12, 2, 26, 16), fill=BLACK)
    d.rectangle((22, 12, 29, 18), fill=WHITE, outline=WHITE)
    d.line((22, 12, 29, 10), fill=WHITE)
    centered(img, "LUNE", 23, BLACK)
    return img


def promo():
    img, d = face(YELLOW)
    d.regular_polygon((16, 16, 14), 12, fill=RED)
    centered(img, "PROMO", 9, WHITE)
    centered(img, "-50%", 17, YELLOW)
    return img


def prix_choc():
    img, d = face(RED)
    d.rectangle((2, 2, 29, 29), outline=YELLOW)
    centered(img, "PRIX", 7, YELLOW, scale=1)
    centered(img, "CHOC", 14, WHITE, scale=1)
    centered(img, "!!!", 21, YELLOW)
    return img


def etiquette_prix():
    img, d = face(WHITE)
    d.rectangle((0, 0, CELL - 1, 5), fill=RED)
    centered(img, "9.99", 12, BLACK, scale=1)
    d.line((4, 24, 27, 24), fill=BLACK)
    d.line((4, 26, 20, 26), fill=BLACK)
    return img


LABELS = [
    ("cereales_pyramides", pyramides), ("lait_trainees_blanches", trainees), ("eau_terre_plate", terre_plate),
    ("soda_5g_cola", cola_5g), ("raviolis_bunker", bunker), ("alu_protect", alu_protect),
    ("sables_reptiliens", reptiliens), ("cafe_reveille", reveille), ("chips_illumi", illumi),
    ("lessive_profonde", profonde), ("coquillettes_nouvel_ordre", nouvel_ordre), ("dentifrice_sans_fluor", sans_fluor),
    ("piles_lune_truquee", lune_truquee), ("promo_moins_50", promo), ("prix_choc", prix_choc), ("etiquette_prix", etiquette_prix),
]


def palette_image() -> Image.Image:
    colors = json.load(open(os.path.join(OUT, "palette.json")))["colors"]
    flat = [int(h[i:i + 2], 16) for h in colors for i in (1, 3, 5)]
    flat += flat[:3] * (256 - len(colors))
    pal = Image.new("P", (1, 1))
    pal.putpalette(flat)
    return pal


def main() -> None:
    atlas = Image.new("RGB", (4 * CELL, 4 * CELL))
    layout = {}
    for i, (name, fn) in enumerate(LABELS):
        x, y = (i % 4) * CELL, (i // 4) * CELL
        atlas.paste(fn(), (x, y))
        layout[name] = {"cell": [i % 4, i // 4], "px": [x, y, CELL, CELL]}
    atlas = atlas.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")
    atlas.save(os.path.join(OUT, "prd_etiquettes.png"))
    with open(os.path.join(OUT, "prd_etiquettes.json"), "w") as f:
        json.dump({"cell_px": CELL, "atlas_px": 4 * CELL, "labels": layout}, f, indent=2)
    print(f"ok  prd_etiquettes.png ({len(LABELS)} étiquettes) + prd_etiquettes.json")


if __name__ == "__main__":
    main()
