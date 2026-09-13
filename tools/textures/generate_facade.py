"""Enseignes de l'avant-magasin et de la galerie : un atlas de huit bandes répétables.

    ./.venv-refs/bin/python3 tools/textures/generate_facade.py

Troisième atlas de bandes, après `trim_hypermarche` (profils de menuiserie) et
`sig_bandeaux` (catégories de rayon). Un de plus parce que les deux autres sont
PLEINS : leurs huit bandes de 16 px occupent exactement leurs 128 px, et il n'y
a pas de place pour une enseigne de plus.

Le format et la densité sont identiques (`{"bands": {nom: {y, height}}}`,
16 px pour 25 cm, soit les 64 px/m du projet) : `lib_helpers` fusionne les
trois fichiers, et `uv="trim:<bande>"` fonctionne pareil — seule la texture
passée à l'asset change.

Ce que ces bandes servent, et pourquoi elles ne pouvaient pas être des bandeaux
de rayon : un rayon dit CE QU'ON Y TROUVE, une enseigne de galerie dit CHEZ QUI
ON EST. Les quatre noms de kiosque sont inventés dans le ton du jeu — un
magasin des années 90 resté dans son jus, vu par un streamer complotiste.
"""

import json
import os

from PIL import Image, ImageDraw

from generate_labels import (BLACK, BLUE, GREEN, MAGENTA, ORANGE, RED, WHITE,
                             YELLOW, draw_text, palette_image, text_width)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets_src", "textures")
W = 128
BAND_H = 16

# (nom de bande, texte, fond, encre).
ENSEIGNES = [
    # Avant-magasin. « CAISSE » en blanc sur vert plutôt que l'inverse : ces
    # panneaux sont les seuls repères au-dessus de la ligne de caisses, et un
    # fond clair les ferait disparaître contre un plafond clair.
    ("caisse", "CAISSE", GREEN, WHITE),
    # Vert et blanc aussi, mais c'est la CONVENTION d'une sortie de secours —
    # les deux ne se confondent pas en situation : l'une est au-dessus d'une
    # caisse, l'autre au-dessus d'une porte.
    ("sortie", "SORTIE", WHITE, GREEN),
    ("soldes", "SOLDES", RED, YELLOW),
    # Galerie : quatre kiosques, quatre enseignes distinctes à l'œil avant
    # d'être lisibles au texte — c'est ce qui fait qu'on se repère dans une
    # galerie de 60 m.
    ("presse_libre", "PRESSE LIBRE", YELLOW, RED),
    ("clefs_minute", "CLEFS MINUTE", ORANGE, BLACK),
    ("desimlock", "DESIMLOCK", BLUE, WHITE),
    ("photomaton", "PHOTOMATON", MAGENTA, WHITE),
    ("bienvenue", "BIENVENUE", BLACK, YELLOW),
]


def band(img: Image.Image, d: ImageDraw.ImageDraw, y0: int, texte: str, fond, encre) -> int:
    d.rectangle((0, y0, W - 1, y0 + BAND_H - 1), fill=fond)
    d.rectangle((0, y0, W - 1, y0), fill=BLACK)
    d.rectangle((0, y0 + BAND_H - 1, W - 1, y0 + BAND_H - 1), fill=BLACK)
    # Même règle que `generate_banners` : le pas de répétition se cale sur la
    # largeur du mot, pour qu'aucun raccord ne coupe une enseigne en deux.
    largeur = text_width(texte, 2)
    pas = largeur + 12
    while W % pas:
        pas += 1
    for x in range(0, W, pas):
        draw_text(img, texte, x + (pas - largeur) // 2, y0 + 3, encre, scale=2)
    return pas


def main() -> None:
    img = Image.new("RGB", (W, W))
    d = ImageDraw.Draw(img)
    layout, y = {}, 0
    for nom, texte, fond, encre in ENSEIGNES:
        pas = band(img, d, y, texte, fond, encre)
        # `pas` est publié : sans lui, un panneau taillé à une largeur
        # quelconque coupe le mot en deux, et une enseigne coupée se lit comme
        # un défaut de texture. `lib_helpers` s'en sert pour ajuster les UV.
        layout[nom] = {"y": y, "height": BAND_H, "pas": pas}
        y += BAND_H
    assert y == W, f"les bandes font {y} px, il en faut {W}"
    img = img.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")
    img.save(os.path.join(OUT, "sig_facade.png"))
    with open(os.path.join(OUT, "sig_facade.json"), "w") as f:
        json.dump({"width": W, "bands": layout}, f, indent=2)
    print(f"ok  sig_facade.png ({len(ENSEIGNES)} bandes) + sig_facade.json")


if __name__ == "__main__":
    main()
