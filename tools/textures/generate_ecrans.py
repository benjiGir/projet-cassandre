"""Écrans et façades d'électroménager : un atlas de seize étiquettes 32 px.

    ./.venv-refs/bin/python3 tools/textures/generate_ecrans.py

Troisième atlas d'étiquettes, après `prd_etiquettes` (les rayons) et
`prd_kiosque` (la galerie) — chacun est plein à seize cases. Même format, même
espace de noms fusionné par `lib_helpers` : `uv="label:<nom>"` fonctionne
pareil, seule la texture passée à l'asset change.

Deux familles dans le même atlas, parce qu'elles décorent la même pièce et que
ce sont les mêmes objets pour le moteur — des faces avant plates :

- **les écrans**, allumés sur des contenus différents. Un mur de téléviseurs
  dont tous les écrans affichent la même chose se lit comme une texture
  répétée ; ce qui rend le mur d'écrans du plan reconnaissable, c'est qu'ils
  divergent. Le rendu d'une vraie image dans une texture reste hors scope
  (reliquat Phase 5) : ici ce sont des images fixes.
- **les façades d'appareils** (four, lave-linge, réfrigérateur, micro-ondes).
  Un hublot et deux boutons peints dans l'albedo font un lave-linge à 640×360,
  sans un seul triangle de plus.
"""

import json
import os

from PIL import Image, ImageDraw

from generate_labels import (BLACK, BLUE, CELL, GREEN, MAGENTA, ORANGE, RED,
                             WHITE, YELLOW, centered, draw_text, hexc,
                             palette_image)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets_src", "textures")

GRIS = hexc("#b4b6b4")
GRIS_FONCE = hexc("#6b6d6b")
ARDOISE = hexc("#2b2b2f")
CHAIR = hexc("#d8b48c")


def ecran(fond=ARDOISE):
    """Dalle d'écran dans son cadre : le cadre noir de 2 px suffit à dire
    « téléviseur » même quand le contenu est illisible."""
    img = Image.new("RGB", (CELL, CELL), BLACK)
    d = ImageDraw.Draw(img)
    d.rectangle((2, 2, CELL - 3, CELL - 3), fill=fond)
    return img, d


# --- Écrans ------------------------------------------------------------------

def mire():
    """Mire de barres : l'image la plus reconnaissable d'un téléviseur, et la
    seule qui dise « rien ne passe » sans être noire."""
    img, d = ecran()
    barres = (WHITE, YELLOW, hexc("#6cb4d6"), GREEN, MAGENTA, RED, BLUE)
    for i, c in enumerate(barres):
        x = 2 + i * 4
        d.rectangle((x, 2, x + 3, 22), fill=c)
    d.rectangle((2, 23, CELL - 3, CELL - 3), fill=GRIS_FONCE)
    return img


def barres_h():
    """Variante horizontale de la mire. Deux mires IDENTIQUES sur un mur
    d'écrans se remarquent plus qu'une seule ; deux variantes, non."""
    img, d = ecran()
    barres = (GRIS, YELLOW, hexc("#6cb4d6"), GREEN, MAGENTA, RED, BLUE)
    for i, c in enumerate(barres):
        y = 2 + i * 4
        d.rectangle((2, y, CELL - 3, y + 3), fill=c)
    return img


def neige():
    img, d = ecran(GRIS_FONCE)
    for i in range(90):
        x = 2 + (i * 7 + (i * i) % 11) % 28
        y = 2 + (i * 13 + (i * i) % 7) % 28
        d.point((x, y), fill=WHITE if i % 3 else BLACK)
    return img


def info():
    """Présentateur et bandeau : le journal télévisé en trois rectangles."""
    img, d = ecran(hexc("#1f3f6b"))
    d.ellipse((12, 6, 20, 15), fill=CHAIR, outline=BLACK)
    d.polygon([(9, 24), (23, 24), (21, 16), (11, 16)], fill=hexc("#3f5f8c"))
    d.rectangle((3, 24, CELL - 4, CELL - 4), fill=RED)
    draw_text(img, "DIRECT", 5, 26, WHITE)
    return img


def meteo():
    img, d = ecran(hexc("#1f5fbf"))
    d.polygon([(6, 22), (12, 8), (18, 18), (24, 10), (27, 22)], fill=GREEN, outline=BLACK)
    d.ellipse((20, 5, 26, 11), fill=YELLOW, outline=BLACK)
    d.rectangle((3, 24, CELL - 4, CELL - 4), fill=BLACK)
    draw_text(img, "28", 12, 26, YELLOW)
    return img


def foot():
    img, d = ecran(GREEN)
    d.rectangle((4, 6, 27, 25), outline=WHITE)
    d.line((16, 6, 16, 25), fill=WHITE)
    d.ellipse((13, 13, 19, 19), outline=WHITE)
    d.rectangle((4, 12, 8, 20), outline=WHITE)
    d.rectangle((23, 12, 27, 20), outline=WHITE)
    return img


def reptilien():
    """Le gag du jeu, sur un écran : le présentateur a les yeux fendus. Un
    seul mur d'écrans en porte un — c'est ce qui fait qu'on le remarque."""
    img, d = ecran(hexc("#1f3f6b"))
    d.ellipse((10, 5, 22, 18), fill=hexc("#7aa84f"), outline=BLACK)
    for x in (13, 18):
        d.ellipse((x, 9, x + 3, 13), fill=YELLOW, outline=BLACK)
        d.line((x + 1, 9, x + 1, 13), fill=BLACK)
    d.polygon([(9, 25), (23, 25), (21, 18), (11, 18)], fill=hexc("#3f5f8c"))
    d.rectangle((3, 25, CELL - 4, CELL - 4), fill=RED)
    return img


def camera():
    """Écran de vidéosurveillance : le magasin se regarde lui-même."""
    img, d = ecran(hexc("#20241f"))
    for y in range(4, 28, 3):
        d.line((3, y, 28, y), fill=hexc("#2e3a2a"))
    d.polygon([(6, 26), (12, 12), (20, 12), (26, 26)], fill=hexc("#3a463a"))
    d.rectangle((14, 18, 18, 26), fill=hexc("#4a564a"))
    draw_text(img, "03", 22, 4, GREEN)
    return img


def eteint():
    img, d = ecran(hexc("#1a1a1e"))
    d.polygon([(4, 4), (14, 4), (4, 18)], fill=hexc("#26262c"))
    return img


# --- Façades d'appareils -----------------------------------------------------

def _caisson(fond=WHITE):
    img = Image.new("RGB", (CELL, CELL), fond)
    return img, ImageDraw.Draw(img)


def lave_linge():
    img, d = _caisson()
    d.rectangle((0, 0, CELL - 1, 7), fill=hexc("#e2e0d8"), outline=GRIS_FONCE)
    d.ellipse((25, 2, 29, 6), fill=GRIS, outline=BLACK)
    d.rectangle((3, 3, 20, 5), fill=GRIS)
    d.ellipse((7, 11, 25, 29), fill=GRIS, outline=BLACK)
    d.ellipse((10, 14, 22, 26), fill=ARDOISE, outline=BLACK)
    d.arc((11, 15, 21, 25), 200, 340, fill=GRIS_FONCE)
    return img


def four():
    img, d = _caisson(hexc("#d8d4c8"))
    d.rectangle((0, 0, CELL - 1, 8), fill=hexc("#c8c4b8"), outline=GRIS_FONCE)
    for x in (5, 12, 19, 26):
        d.ellipse((x - 2, 2, x + 2, 6), fill=ARDOISE, outline=BLACK)
    d.rectangle((3, 11, 28, 29), fill=ARDOISE, outline=BLACK)
    d.rectangle((6, 14, 25, 24), fill=hexc("#4a3a2a"), outline=GRIS_FONCE)
    d.rectangle((4, 26, 27, 28), fill=GRIS)
    return img


def frigo():
    img, d = _caisson()
    d.line((0, 13, CELL - 1, 13), fill=GRIS_FONCE)
    d.rectangle((24, 4, 27, 11), fill=GRIS, outline=BLACK)
    d.rectangle((24, 16, 27, 27), fill=GRIS, outline=BLACK)
    d.rectangle((3, 3, 12, 9), fill=hexc("#e8e6de"), outline=GRIS)
    return img


def micro_ondes():
    img, d = _caisson(ARDOISE)
    d.rectangle((2, 4, 21, 27), fill=hexc("#3a3a40"), outline=GRIS_FONCE)
    d.rectangle((4, 6, 19, 25), fill=hexc("#16161a"))
    for x in range(5, 19, 3):
        d.line((x, 6, x, 25), fill=hexc("#2a2a30"))
    d.rectangle((23, 6, 29, 12), fill=GREEN, outline=BLACK)
    draw_text(img, "12", 23, 7, BLACK)
    for y in (16, 20, 24):
        d.rectangle((23, y, 29, y + 2), fill=GRIS)
    return img


def aspirateur():
    img, d = _caisson(hexc("#c2307a"))
    d.ellipse((4, 12, 26, 28), fill=hexc("#d8d4c8"), outline=BLACK)
    d.ellipse((10, 16, 20, 24), fill=ARDOISE, outline=BLACK)
    d.line((8, 12, 14, 3), fill=ARDOISE, width=2)
    d.ellipse((12, 1, 18, 6), fill=GRIS, outline=BLACK)
    return img


def grille_pain():
    img, d = _caisson(GRIS)
    d.rectangle((4, 10, 27, 27), fill=hexc("#d8d4c8"), outline=BLACK)
    for x in (10, 18):
        d.rectangle((x, 6, x + 5, 11), fill=hexc("#c8a468"), outline=BLACK)
    d.rectangle((5, 14, 8, 23), fill=ARDOISE)
    return img


def enceinte():
    img, d = _caisson(hexc("#3a2e26"))
    d.rectangle((3, 3, 28, 28), fill=hexc("#1a1a1e"), outline=BLACK)
    d.ellipse((8, 6, 24, 20), fill=hexc("#2a2a30"), outline=GRIS_FONCE)
    d.ellipse((13, 11, 19, 16), fill=GRIS_FONCE)
    d.ellipse((11, 22, 20, 26), fill=hexc("#2a2a30"), outline=GRIS_FONCE)
    return img


LABELS = [
    ("ecran_mire", mire), ("ecran_neige", neige), ("ecran_info", info), ("ecran_meteo", meteo),
    ("ecran_foot", foot), ("ecran_reptilien", reptilien), ("ecran_camera", camera), ("ecran_eteint", eteint),
    ("app_lave_linge", lave_linge), ("app_four", four), ("app_frigo", frigo), ("app_micro_ondes", micro_ondes),
    ("app_aspirateur", aspirateur), ("app_grille_pain", grille_pain), ("app_enceinte", enceinte),
    ("ecran_barres", barres_h),
]


def main() -> None:
    atlas = Image.new("RGB", (4 * CELL, 4 * CELL))
    layout = {}
    for i, (name, fn) in enumerate(LABELS):
        x, y = (i % 4) * CELL, (i // 4) * CELL
        atlas.paste(fn(), (x, y))
        layout[name] = {"cell": [i % 4, i // 4], "px": [x, y, CELL, CELL]}
    atlas = atlas.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")
    atlas.save(os.path.join(OUT, "prd_ecrans.png"))
    with open(os.path.join(OUT, "prd_ecrans.json"), "w") as f:
        json.dump({"cell_px": CELL, "atlas_px": 4 * CELL, "labels": layout}, f, indent=2)
    print(f"ok  prd_ecrans.png ({len(LABELS)} étiquettes) + prd_ecrans.json")


if __name__ == "__main__":
    main()
