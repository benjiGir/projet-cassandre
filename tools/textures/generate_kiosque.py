"""Marchandise des kiosques de galerie : un atlas de seize étiquettes 32 px.

    ./.venv-refs/bin/python3 tools/textures/generate_kiosque.py

Second atlas d'étiquettes, après `prd_etiquettes.png` — un de plus parce que
celui-là est PLEIN (seize cases de 32 px dans 128 px). Le format est identique
(`{"labels": {nom: {"cell": [x, y]}}}`), `lib_helpers` fusionne les deux, et
`uv="label:<nom>"` fonctionne pareil : seule la texture passée à l'asset change.

Pourquoi un atlas dédié plutôt que de réutiliser celui des rayons : un kiosque
de presse garni de boîtes de céréales se lit comme une erreur. Ce qui fait
reconnaître une librairie, c'est la SILHOUETTE de sa marchandise — des
rectangles plats et bariolés debout côte à côte — et ça ne s'obtient qu'avec
des étiquettes faites pour.

Le ton suit celui des rayons : le héros du jeu est un streamer complotiste, et
sa galerie marchande vend ce qu'il lit.
"""

import json
import os

from PIL import Image, ImageDraw

from generate_labels import (BLACK, BLUE, CELL, GREEN, MAGENTA, ORANGE, RED,
                             WHITE, YELLOW, centered, draw_text, face, hexc,
                             palette_image)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets_src", "textures")

GRIS = hexc("#b4b6b4")
GRIS_FONCE = hexc("#6b6d6b")


# --- Presse ------------------------------------------------------------------

def mag_verite():
    """Couverture complotiste : l'œil qui regarde, le seul motif que le joueur
    reconnaîtra à deux mètres sans lire le titre."""
    img, d = face(RED, BLACK)
    d.ellipse((6, 6, 26, 18), fill=WHITE, outline=BLACK)
    d.ellipse((13, 8, 19, 16), fill=BLUE, outline=BLACK)
    d.ellipse((15, 10, 17, 14), fill=BLACK)
    centered(img, "VERITE", 23, YELLOW)
    return img


def mag_ovni():
    img, d = face(hexc("#2b2b4a"), BLUE)
    d.ellipse((4, 11, 28, 17), fill=GRIS, outline=BLACK)
    d.ellipse((11, 6, 21, 13), fill=GRIS_FONCE, outline=BLACK)
    for x in (8, 16, 24):
        d.point((x, 14), fill=YELLOW)
    centered(img, "OVNI", 23, WHITE)
    return img


def mag_stars():
    img, d = face(MAGENTA, BLACK)
    d.ellipse((10, 4, 22, 16), fill=hexc("#f2c230"), outline=BLACK)
    d.polygon([(16, 16), (9, 20), (23, 20)], fill=WHITE, outline=BLACK)
    centered(img, "STARS", 23, WHITE)
    return img


def mag_mots():
    """Grille de mots fléchés : un damier suffit, c'est la silhouette la plus
    reconnaissable du présentoir."""
    img, d = face(YELLOW, BLACK)
    for i in range(5):
        for j in range(4):
            x, y = 5 + i * 5, 3 + j * 5
            d.rectangle((x, y, x + 4, y + 4), outline=BLACK,
                        fill=BLACK if (i + j) % 3 == 0 else WHITE)
    centered(img, "MOTS", 23, YELLOW)
    return img


def journal_une():
    """Une de quotidien vue de DESSUS, sur une pile : bandeau de titre, une
    photo, des colonnes de gris."""
    img, d = face(WHITE)
    d.rectangle((0, 0, CELL - 1, 6), fill=BLACK)
    centered(img, "JOURNAL", 1, WHITE)
    d.rectangle((2, 9, 14, 19), fill=GRIS, outline=BLACK)
    for y in range(9, 30, 3):
        d.line((16, y, 29, y), fill=GRIS_FONCE)
    for y in range(22, 31, 3):
        d.line((2, y, 14, y), fill=GRIS_FONCE)
    return img


def journal_sport():
    img, d = face(WHITE)
    d.rectangle((0, 0, CELL - 1, 6), fill=ORANGE)
    centered(img, "SPORT", 1, BLACK)
    d.ellipse((11, 10, 21, 20), fill=WHITE, outline=BLACK)
    d.line((11, 15, 21, 15), fill=BLACK)
    d.line((16, 10, 16, 20), fill=BLACK)
    for y in range(23, 31, 3):
        d.line((3, y, 28, y), fill=GRIS_FONCE)
    return img


# --- Clefs minute ------------------------------------------------------------

def cle_brute():
    img, d = face(hexc("#d8d4c8"))
    d.rectangle((0, 0, CELL - 1, 5), fill=BLUE)
    d.ellipse((11, 8, 21, 18), fill=GRIS, outline=BLACK)
    d.ellipse((14, 11, 18, 15), fill=hexc("#d8d4c8"))
    d.rectangle((15, 18, 17, 28), fill=GRIS, outline=BLACK)
    d.rectangle((17, 23, 20, 25), fill=GRIS, outline=BLACK)
    return img


def porte_cles():
    img, d = face(hexc("#d8d4c8"))
    d.rectangle((0, 0, CELL - 1, 5), fill=RED)
    d.ellipse((8, 8, 18, 18), outline=BLACK, fill=None)
    d.rectangle((16, 14, 26, 24), fill=GREEN, outline=BLACK)
    centered(img, "CLE", 26, BLACK)
    return img


def plaque_grave():
    img, d = face(hexc("#d8d4c8"))
    d.rectangle((0, 0, CELL - 1, 5), fill=GREEN)
    d.rounded_rectangle((5, 10, 27, 24), radius=4, fill=YELLOW, outline=BLACK)
    draw_text(img, "MEDOR", 8, 15, BLACK)
    return img


# --- Desimlock ---------------------------------------------------------------

def coque_tel():
    img, d = face(hexc("#cfd8e2"))
    d.rectangle((0, 0, CELL - 1, 5), fill=BLUE)
    d.rounded_rectangle((10, 8, 22, 28), radius=3, fill=BLACK, outline=BLACK)
    d.rounded_rectangle((12, 10, 20, 24), radius=2, fill=hexc("#6cb4d6"))
    return img


def carte_sim():
    img, d = face(hexc("#cfd8e2"))
    d.rectangle((0, 0, CELL - 1, 5), fill=MAGENTA)
    d.rectangle((6, 10, 26, 26), fill=WHITE, outline=BLACK)
    d.rectangle((9, 13, 17, 21), fill=YELLOW, outline=BLACK)
    d.line((9, 17, 17, 17), fill=BLACK)
    d.line((13, 13, 13, 21), fill=BLACK)
    return img


def carte_tel():
    img, d = face(GREEN)
    d.rectangle((3, 6, 29, 24), fill=hexc("#2e9e44"), outline=BLACK)
    d.rectangle((6, 10, 14, 17), fill=YELLOW, outline=BLACK)
    draw_text(img, "50", 18, 11, WHITE)
    centered(img, "CARTE", 26, WHITE)
    return img


# --- Photo -------------------------------------------------------------------

def planche_photo():
    """Planche du photomaton : quatre portraits en bande, le seul objet du jeu
    qui dise « on a payé pour ça »."""
    img, d = face(WHITE)
    d.rectangle((9, 1, 23, 30), fill=BLACK)
    for i in range(4):
        y = 2 + i * 7
        d.rectangle((11, y, 21, y + 5), fill=hexc("#6cb4d6"))
        d.ellipse((14, y + 1, 18, y + 5), fill=hexc("#d8b48c"))
    return img


def pellicule():
    img, d = face(YELLOW, BLACK)
    d.rectangle((7, 5, 25, 19), fill=BLACK, outline=BLACK)
    d.ellipse((12, 9, 20, 16), fill=GRIS, outline=WHITE)
    centered(img, "FILM", 23, YELLOW)
    return img


def cadre_photo():
    img, d = face(hexc("#8c6b3f"))
    d.rectangle((4, 4, 27, 27), fill=hexc("#a87c46"), outline=BLACK)
    d.rectangle((8, 8, 23, 23), fill=hexc("#6cb4d6"), outline=BLACK)
    d.ellipse((13, 11, 19, 17), fill=hexc("#d8b48c"))
    return img


def album_photo():
    img, d = face(hexc("#3f5f8c"), BLACK)
    d.rectangle((5, 4, 26, 19), fill=hexc("#5f7fac"), outline=BLACK)
    d.line((8, 4, 8, 19), fill=BLACK)
    centered(img, "ALBUM", 23, WHITE)
    return img


LABELS = [
    ("mag_verite", mag_verite), ("mag_ovni", mag_ovni), ("mag_stars", mag_stars), ("mag_mots", mag_mots),
    ("journal_une", journal_une), ("journal_sport", journal_sport), ("cle_brute", cle_brute), ("porte_cles", porte_cles),
    ("plaque_grave", plaque_grave), ("coque_tel", coque_tel), ("carte_sim", carte_sim), ("carte_tel", carte_tel),
    ("planche_photo", planche_photo), ("pellicule", pellicule), ("cadre_photo", cadre_photo), ("album_photo", album_photo),
]


def main() -> None:
    atlas = Image.new("RGB", (4 * CELL, 4 * CELL))
    layout = {}
    for i, (name, fn) in enumerate(LABELS):
        x, y = (i % 4) * CELL, (i // 4) * CELL
        atlas.paste(fn(), (x, y))
        layout[name] = {"cell": [i % 4, i // 4], "px": [x, y, CELL, CELL]}
    atlas = atlas.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")
    atlas.save(os.path.join(OUT, "prd_kiosque.png"))
    with open(os.path.join(OUT, "prd_kiosque.json"), "w") as f:
        json.dump({"cell_px": CELL, "atlas_px": 4 * CELL, "labels": layout}, f, indent=2)
    print(f"ok  prd_kiosque.png ({len(LABELS)} étiquettes) + prd_kiosque.json")


if __name__ == "__main__":
    main()
