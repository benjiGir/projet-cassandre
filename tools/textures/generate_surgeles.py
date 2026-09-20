"""Atlas du rayon surgelés : douze faces de produit de 32×32 et deux bandes de 16 px, dans une texture 128×128 quantifiée sur la palette.

    ./.venv-refs/bin/python3 tools/textures/generate_surgeles.py

Un atlas à part parce que les trois atlas d'étiquettes sont PLEINS (seize
faces chacun). Il porte à la fois des faces (`uv="label:<nom>"`, trois rangées
de quatre) et des bandes (`uv="trim:<nom>"`/`"enseigne:<nom>"`, la dernière
rangée coupée en deux) : `lib_helpers` lit les deux clés du JSON. Tout le rayon
tient ainsi dans un matériau de plus, pas trois.

Mêmes marques que le reste du magasin — la 5G, la Terre plate, les reptiliens,
la lune truquée — déclinées au congélateur.
"""

import json
import math
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_labels import (BLACK, BLUE, CELL, GREEN, MAGENTA, ORANGE, OUT, RED, WHITE,  # noqa: E402
                             YELLOW, centered, draw_text, face, hexc, palette_image, text_width)

VERT_CLAIR, BLEU_CIEL, BLEU_NUIT = hexc("#54bd6d"), hexc("#6eb4d6"), hexc("#161b52")
GLACE, GIVRE, BRUN = hexc("#b5d2e8"), hexc("#d5d7d8"), hexc("#89432e")


def pizza_5g():
    img, d = face(RED, BLACK)
    d.ellipse((5, 5, 26, 19), fill=ORANGE, outline=BLACK)
    d.ellipse((8, 7, 23, 17), fill=YELLOW)
    for x, y in ((11, 9), (18, 10), (13, 14), (20, 14)):
        d.rectangle((x, y, x + 1, y + 1), fill=RED)
    # L'antenne relais plantée dans la pâte.
    d.line((24, 1, 24, 8), fill=BLACK)
    d.line((22, 3, 26, 3), fill=BLACK)
    centered(img, "PIZZA 5G", 23, WHITE)
    return img


def glace_zone51():
    img, d = face(BLEU_NUIT, GREEN)
    for x, y in ((3, 3), (27, 5), (6, 16), (25, 14)):
        d.point((x, y), fill=WHITE)
    d.ellipse((10, 3, 22, 18), fill=VERT_CLAIR, outline=BLACK)
    d.ellipse((11, 8, 15, 12), fill=BLACK)
    d.ellipse((17, 8, 21, 12), fill=BLACK)
    centered(img, "ZONE 51", 23, WHITE)
    return img


def frites_plates():
    img, d = face(YELLOW, BLUE)
    for i, x in enumerate(range(9, 23, 3)):
        d.rectangle((x, 4 + (i % 2) * 2, x + 1, 13), fill=hexc("#f7cd57"), outline=ORANGE)
    d.polygon([(7, 11), (25, 11), (22, 19), (10, 19)], fill=RED, outline=BLACK)
    # Le disque de la Terre plate, en logo de marque.
    d.ellipse((24, 2, 30, 5), fill=GREEN, outline=BLACK)
    centered(img, "FRITES", 23, WHITE)
    return img


def pois_puces():
    img, d = face(GREEN, BLACK)
    for x, y in ((6, 5), (13, 4), (20, 6), (8, 12), (16, 11)):
        d.ellipse((x, y, x + 6, y + 6), fill=VERT_CLAIR, outline=BLACK)
    # Un petit pois porte sa puce.
    d.rectangle((23, 12, 28, 17), fill=hexc("#919292"), outline=BLACK)
    for y in (13, 15):
        d.line((21, y, 22, y), fill=BLACK)
        d.line((29, y, 30, y), fill=BLACK)
    centered(img, "POIS", 23, VERT_CLAIR)
    return img


def poisson_atlante():
    img, d = face(BLEU_CIEL, BLUE)
    # Les colonnes de la cité engloutie, et le poisson pané qui passe devant.
    for x in (4, 26):
        d.rectangle((x, 4, x + 2, 19), fill=WHITE, outline=hexc("#919292"))
    d.polygon([(8, 11), (20, 6), (24, 11), (20, 16)], fill=ORANGE, outline=BLACK)
    d.polygon([(24, 11), (28, 7), (28, 15)], fill=ORANGE, outline=BLACK)
    d.point((11, 10), fill=BLACK)
    centered(img, "ATLANTE", 23, WHITE)
    return img


def nuggets_reptiliens():
    img, d = face(ORANGE, GREEN)
    for x, y in ((4, 11), (11, 13), (18, 12)):
        d.ellipse((x, y, x + 7, y + 6), fill=hexc("#d98330"), outline=BRUN)
    # L'œil fendu de la marque « Reptiliens ».
    d.ellipse((10, 2, 22, 10), fill=YELLOW, outline=BLACK)
    d.rectangle((15, 3, 16, 9), fill=BLACK)
    centered(img, "NUGGETS", 23, YELLOW)
    return img


def glacons_mur():
    img, d = face(WHITE, BLUE)
    for x, y in ((6, 9), (13, 5), (19, 10), (10, 14)):
        d.rectangle((x, y, x + 5, y + 5), fill=GLACE, outline=BLEU_CIEL)
        d.point((x + 1, y + 1), fill=WHITE)
    # Le mur de glace qui borde le disque, vu de la tranche.
    d.rectangle((2, 3, 3, 19), fill=BLEU_CIEL)
    d.rectangle((28, 3, 29, 19), fill=BLEU_CIEL)
    centered(img, "GLACONS", 23, WHITE)
    return img


def poelee_trainees():
    img, d = face(GLACE, GREEN)
    for y in (4, 7):
        d.line((2, y, 17, y), fill=WHITE)
    d.polygon([(17, 3), (26, 5), (17, 8)], fill=BLACK)
    for x, y, c in ((5, 13, ORANGE), (11, 15, GREEN), (17, 13, RED), (22, 15, YELLOW), (8, 17, GREEN)):
        d.ellipse((x, y, x + 3, y + 3), fill=c, outline=BLACK)
    centered(img, "POELEE", 23, WHITE)
    return img


def buche_cryo():
    img, d = face(BLEU_NUIT, WHITE)
    d.rectangle((5, 8, 24, 17), fill=BRUN, outline=BLACK)
    d.ellipse((22, 8, 28, 17), fill=hexc("#dbd0c4"), outline=BLACK)
    d.ellipse((24, 11, 26, 14), fill=BRUN)
    for x in range(6, 24, 4):
        d.point((x, 8), fill=WHITE)
        d.point((x + 2, 7), fill=GIVRE)
    centered(img, "CRYO", 23, BLUE)
    return img


def steak_clone():
    img, d = face(hexc("#b02931"), BLACK)
    # Deux steaks rigoureusement identiques.
    for x in (3, 17):
        d.ellipse((x, 6, x + 11, 16), fill=hexc("#69252a"), outline=BLACK)
        d.line((x + 3, 9, x + 7, 13), fill=hexc("#e36260"))
    d.line((14, 10, 16, 10), fill=WHITE)
    d.line((14, 12, 16, 12), fill=WHITE)
    centered(img, "CLONE", 23, WHITE)
    return img


def crepes_illumi():
    img, d = face(YELLOW, MAGENTA)
    d.ellipse((3, 11, 15, 19), fill=hexc("#f1b151"), outline=BRUN)
    d.polygon([(21, 3), (29, 17), (13, 17)], fill=ORANGE, outline=BLACK)
    d.ellipse((18, 9, 24, 13), fill=WHITE, outline=BLACK)
    d.point((21, 11), fill=BLACK)
    centered(img, "CREPES", 23, WHITE)
    return img


def sorbet_lune():
    img, d = face(hexc("#303258"), YELLOW)
    d.ellipse((8, 3, 23, 18), fill=hexc("#e8d794"), outline=BLACK)
    # La fermeture éclair de la lune truquée, comme sur les piles du rayon bazar.
    d.line((15, 4, 15, 17), fill=hexc("#605c58"))
    for y in range(5, 17, 2):
        d.point((14, y), fill=hexc("#605c58"))
        d.point((16, y + 1), fill=hexc("#605c58"))
    centered(img, "SORBET", 23, BLACK)
    return img


LABELS = [
    ("pizza_5g", pizza_5g), ("glace_zone51", glace_zone51), ("frites_plates", frites_plates),
    ("pois_puces", pois_puces), ("poisson_atlante", poisson_atlante), ("nuggets_reptiliens", nuggets_reptiliens),
    ("glacons_mur", glacons_mur), ("poelee_trainees", poelee_trainees), ("buche_cryo", buche_cryo),
    ("steak_clone", steak_clone), ("crepes_illumi", crepes_illumi), ("sorbet_lune", sorbet_lune),
]

# Dernière rangée : deux bandes de 16 px sur toute la largeur.
BANDE_Y = {"surgeles": 96, "givre": 112}


def flocon(d: ImageDraw.ImageDraw, cx: int, cy: int, c) -> None:
    for dx, dy in ((0, -4), (0, 4), (-4, 0), (4, 0), (-3, -3), (3, 3), (-3, 3), (3, -3)):
        d.line((cx, cy, cx + dx, cy + dy), fill=c)


def bande_surgeles() -> Image.Image:
    """Le bandeau du rayon : « SURGELÉS » en blanc sur bleu, entre deux
    flocons. La police n'a pas d'accents (cinq pixels de haut) : à l'échelle 2,
    il y a la place de poser celui du É à la main."""
    img = Image.new("RGB", (128, 16), BLUE)
    d = ImageDraw.Draw(img)
    d.line((0, 0, 127, 0), fill=GLACE)
    d.line((0, 15, 127, 15), fill=BLEU_NUIT)
    mot = "SURGELES"
    x = (128 - text_width(mot, 2)) // 2
    draw_text(img, mot, x, 4, WHITE, scale=2)
    xe = x + 6 * 8                      # le second E, celui qui porte l'accent
    d.line((xe + 2, 2, xe + 4, 1), fill=WHITE)
    flocon(d, 12, 8, GLACE)
    flocon(d, 115, 8, GLACE)
    return img


def bande_givre() -> Image.Image:
    """Du givre qui monte du bas : bord supérieur déchiqueté, cristaux clairs.
    Raccordable horizontalement — le motif ne dépend que de x modulo 128."""
    img = Image.new("RGB", (128, 16), GLACE)
    px = img.load()
    for x in range(128):
        # Hauteur du front de givre, faite de trois harmoniques entières : elle
        # boucle exactement sur 128 px.
        h = 9 + int(2.2 * math.sin(x * 2 * math.pi / 32) + 1.4 * math.sin(x * 2 * math.pi * 7 / 128 + 1.0))
        for y in range(16):
            if 15 - y > h:
                px[x, y] = hexc("#8999b1")
            elif (x * 7 + y * 13) % 11 == 0:
                px[x, y] = WHITE
            elif (x * 5 + y * 3) % 7 == 0:
                px[x, y] = GIVRE
    return img


def main() -> None:
    atlas = Image.new("RGB", (4 * CELL, 4 * CELL))
    layout = {}
    for i, (name, fn) in enumerate(LABELS):
        x, y = (i % 4) * CELL, (i // 4) * CELL
        atlas.paste(fn(), (x, y))
        layout[name] = {"cell": [i % 4, i // 4], "px": [x, y, CELL, CELL]}
    atlas.paste(bande_surgeles(), (0, BANDE_Y["surgeles"]))
    atlas.paste(bande_givre(), (0, BANDE_Y["givre"]))
    atlas = atlas.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")
    atlas.save(os.path.join(OUT, "prd_surgeles.png"))
    bands = {nom: {"y": y, "height": 16, "pas": 128} for nom, y in BANDE_Y.items()}
    with open(os.path.join(OUT, "prd_surgeles.json"), "w") as f:
        json.dump({"cell_px": CELL, "atlas_px": 4 * CELL, "labels": layout,
                   "width": 128, "bands": bands}, f, indent=2)
    print(f"ok  prd_surgeles.png ({len(LABELS)} étiquettes, {len(bands)} bandes) + prd_surgeles.json")


if __name__ == "__main__":
    main()
