"""Bandeaux de catégorie du niveau v2 : un atlas de huit bandes horizontales répétables, une par rayon.

    ./.venv-refs/bin/python3 tools/textures/generate_banners.py

Pourquoi un atlas séparé de `trim_hypermarche.png` : celui-ci est plein (ses
huit bandes occupent exactement ses 128 px). Et un bandeau de catégorie n'est
pas un profil de menuiserie parmi d'autres — c'est la signalétique qui rend un
rayon lisible d'un bout à l'autre de l'allée.

Le format du JSON est CELUI DU TRIM SHEET (`{"bands": {nom: {y, height}}}`) :
`lib_helpers` fusionne les deux fichiers et `uv="trim:<bande>"` fonctionne
pareil, seule la texture passée à l'asset change.

Densité : 16 px de haut pour un bandeau de 25 cm, soit les 64 px/m du projet.
Chaque bande porte sa propre couleur de fond — à 640×360 et à vingt mètres, la
couleur du bandeau se lit avant son texte.
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

# (nom de bande, texte, fond, texte). Sans accents : la police pixel n'en a pas,
# et la signalétique tout en capitales s'en passe couramment.
BANNERS = [
    ("rayon_epicerie", "EPICERIE", YELLOW, RED),
    ("rayon_boissons", "BOISSONS", BLUE, WHITE),
    ("rayon_petit_dej", "PETIT DEJ", ORANGE, BLACK),
    ("rayon_entretien", "ENTRETIEN", GREEN, WHITE),
    ("rayon_conserves", "CONSERVES", RED, YELLOW),
    # Fond blanc et non cyan : quantifié sur la palette, un cyan tombait sur le
    # bleu de BOISSONS et les deux rayons devenaient indiscernables de loin.
    ("rayon_frais", "FRAIS", WHITE, BLUE),
    ("rayon_promos", "PROMOS", MAGENTA, WHITE),
    ("rayon_bazar", "BAZAR", BLACK, YELLOW),
]


def band(img: Image.Image, d: ImageDraw.ImageDraw, y0: int, texte: str, fond, encre) -> int:
    d.rectangle((0, y0, W - 1, y0 + BAND_H - 1), fill=fond)
    d.rectangle((0, y0, W - 1, y0), fill=BLACK)
    d.rectangle((0, y0 + BAND_H - 1, W - 1, y0 + BAND_H - 1), fill=BLACK)
    # Le pas de répétition se cale sur la largeur du mot : un mot coupé au
    # raccord se lirait comme un défaut de texture, pas comme une enseigne.
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
    for nom, texte, fond, encre in BANNERS:
        pas = band(img, d, y, texte, fond, encre)
        # `pas` publié, comme dans `generate_facade` : un panneau taillé à une
        # largeur quelconque couperait le mot en deux (voir `_uv_enseigne`).
        layout[nom] = {"y": y, "height": BAND_H, "pas": pas}
        y += BAND_H
    assert y == W, f"les bandes font {y} px, il en faut {W}"
    img = img.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")
    img.save(os.path.join(OUT, "sig_bandeaux.png"))
    with open(os.path.join(OUT, "sig_bandeaux.json"), "w") as f:
        json.dump({"width": W, "bands": layout}, f, indent=2)
    print(f"ok  sig_bandeaux.png ({len(BANNERS)} bandes) + sig_bandeaux.json")


if __name__ == "__main__":
    main()
