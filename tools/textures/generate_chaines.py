"""Atlas des chaînes en boucle des `ecran_*` (chantier « Les coulisses »,
système 2) : seize cases de 32 px dans UNE texture 128×128 — le plafond de
`validate_level.py` pour toute texture de niveau.

    ./.venv-refs/bin/python3 tools/textures/generate_chaines.py

Six « chaînes », chacune une poignée de frames qui bouclent : le journal
(avec le gag reptilien, rare), une pub de marque inventée, la mire, le foot,
une fausse image de vidéosurveillance, et l'état CASSÉ (neige/noir). Le jeu
choisit la chaîne par l'extra Blender `chaine` d'un `ecran_*`
(`game/level/interactions/ecrans.ts`) et fait défiler ses frames sur une horloge dérivée
du pas fixe — jamais de l'horloge murale (invariant #1).

Réutilise les dessins déjà éprouvés de `generate_ecrans.py` (mire, barres_h,
foot, camera, info, reptilien, neige, eteint) plutôt que d'en redessiner :
c'est le même cadre d'écran, seul le découpage en frames est nouveau. Ce
fichier ne remplace PAS `prd_ecrans.png` (façades d'appareils, étiquettes
statiques) : deux atlas, deux usages.
"""

import json
import os

from generate_ecrans import (barres_h, ecran, eteint, foot, info,
                              mire, neige, reptilien)
from generate_labels import CELL, ORANGE, WHITE, YELLOW, centered, hexc, palette_image
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets_src", "textures")


def info_clin():
    """Deuxième frame du journal : présentateur qui cligne — un simple bandeau
    de moins suffit à lire un battement de paupière à cette résolution."""
    img, d = ecran(hexc("#1f3f6b"))
    d.ellipse((12, 6, 20, 15), fill=hexc("#d8b48c"), outline=hexc("#111014"))
    d.line((13, 10, 19, 10), fill=hexc("#111014"))
    d.polygon([(9, 24), (23, 24), (21, 16), (11, 16)], fill=hexc("#3f5f8c"))
    d.rectangle((3, 24, CELL - 4, CELL - 4), fill=hexc("#d8231f"))
    centered(img, "DIRECT", 26, WHITE)
    return img


def pub(nom, fond):
    img, d = ecran(fond)
    d.rectangle((3, 3, CELL - 4, CELL - 4), outline=WHITE)
    centered(img, nom, 14, WHITE)
    return img


def foot_2():
    """Le ballon a bougé : deuxième frame du même plan, rien de plus."""
    img, d = ecran(hexc("#2e9e44"))
    d.rectangle((4, 6, 27, 25), outline=WHITE)
    d.line((16, 6, 16, 25), fill=WHITE)
    d.ellipse((13, 13, 19, 19), outline=WHITE)
    d.ellipse((20, 17, 24, 21), fill=WHITE, outline=hexc("#111014"))
    return img


def camera_2():
    """Caméra 04 : caisse et entrée, assez claire pour se lire sur un CRT."""
    img, d = ecran(hexc("#303258"))
    d.rectangle((3, 3, 28, 28), outline=hexc("#b5d2e8"))
    d.rectangle((4, 4, 27, 9), fill=hexc("#237978"))
    d.polygon([(4, 12), (27, 12), (27, 27), (4, 27)], fill=hexc("#65814b"))
    d.polygon([(10, 14), (21, 14), (26, 27), (6, 27)], fill=hexc("#3b4528"))
    d.rectangle((5, 14, 9, 23), fill=hexc("#2e9e44"))
    d.rectangle((22, 14, 26, 23), fill=hexc("#2e9e44"))
    d.line((10, 18, 21, 18), fill=hexc("#f2c230"))
    d.ellipse((22, 5, 26, 9), fill=hexc("#d8231f"))
    centered(img, "04", 4, hexc("#f2efe6"))
    return img


def camera_1():
    """Caméra 03 : perspective d'une allée, voyant rouge d'enregistrement."""
    img, d = ecran(hexc("#303258"))
    d.rectangle((3, 3, 28, 28), outline=hexc("#b5d2e8"))
    d.polygon([(4, 10), (27, 10), (27, 27), (4, 27)], fill=hexc("#65814b"))
    d.polygon([(11, 12), (20, 12), (26, 27), (5, 27)], fill=hexc("#3b4528"))
    for y in (15, 19, 23):
        d.line((4, y, 10, y), fill=hexc("#f2c230"))
        d.line((21, y, 27, y), fill=hexc("#f2c230"))
    d.line((15, 13, 15, 27), fill=hexc("#237978"))
    d.ellipse((22, 4, 26, 8), fill=hexc("#d8231f"))
    centered(img, "03", 4, hexc("#f2efe6"))
    return img


# (nom_chaine, [frames dans l'ordre de bouclage])
CHAINES = [
    ("journal", [info, info_clin, info, reptilien]),
    ("pub", [lambda: pub("CROUSTAX", ORANGE), lambda: pub("BONIVORE", hexc("#2e9e44")),
             lambda: pub("PYRAMIDE", YELLOW), lambda: pub("LACTOR", hexc("#1f5fbf"))]),
    ("mire", [mire, barres_h]),
    ("foot", [foot, foot_2]),
    ("cctv", [camera_1, camera_2]),
    ("casse", [neige, eteint]),
]


def main() -> None:
    atlas = Image.new("RGB", (4 * CELL, 4 * CELL))
    chaines = {}
    i = 0
    for nom, frames in CHAINES:
        cells = []
        for fn in frames:
            x, y = (i % 4) * CELL, (i // 4) * CELL
            atlas.paste(fn(), (x, y))
            cells.append([x, y, CELL, CELL])
            i += 1
        chaines[nom] = {"frames": cells}
    assert i == 16, f"atlas non plein : {i}/16 cases (128x128 est le plafond de validate_level.py)"
    atlas = atlas.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")
    atlas.save(os.path.join(OUT, "prd_chaines.png"))
    with open(os.path.join(OUT, "prd_chaines.json"), "w") as f:
        json.dump({"cell_px": CELL, "atlas_px": 4 * CELL, "chaines": chaines}, f, indent=2)
    print(f"ok  prd_chaines.png ({len(CHAINES)} chaînes, {i} frames) + prd_chaines.json")


if __name__ == "__main__":
    main()
