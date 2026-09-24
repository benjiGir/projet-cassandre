"""Vantaux de porte : des atlas 128×128 de deux vantaux chacun (64×128), quantifiés sur la palette.

    ./.venv-refs/bin/python3 tools/textures/generate_portes.py

- `portes_verre.png` (RGBA) : la porte automatique de l'entrée et la porte
  va-et-vient de la réserve. Leur verre est dans l'ALPHA de la texture, pas
  dans un second matériau : un `door_*` doit rester un seul mesh à un seul
  matériau (deux matériaux = deux primitives glTF = un groupe que le loader ne
  reconnaît plus comme une porte), et ça ne coûte qu'un lot de dessin.
- `portes.png` (RGB) : la porte de bureau et la porte capitonnée du Directeur.
- `portes_2.png` (RGB) : la porte des toilettes de la cafétéria, et une case
  libre pour la prochaine. Un atlas de plus plutôt qu'un atlas plus large :
  `validate_level.py` plafonne les textures à 128×128, carrées.

Un vantail couvre toute sa case, quelle que soit sa taille réelle : la densité
n'est donc pas les 64 px/m du reste du niveau, mais une porte se lit à sa
silhouette et à trois détails (hublot, plaque, poignée).

Chaque case déclare aussi deux échantillons, lus par `lib_helpers` : `metal`,
un pavé uni où poser les UV de la quincaillerie (poignée, barre anti-panique)
sans second matériau, et `chant`, la couleur des tranches du vantail.
"""

import json
import math
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_labels import OUT, draw_text, hexc, palette_image, text_width  # noqa: E402

L, H = 64, 128

ALU, ALU_SOMBRE, ALU_CLAIR = hexc("#919292"), hexc("#767676"), hexc("#babcbc")
VERRE = hexc("#b5d2e8")
BLANC, NOIR, ROUGE = hexc("#f1f1f1"), hexc("#111014"), hexc("#d8231f")


def _y(m: float, hauteur: float) -> int:
    """Ligne de pixel d'une hauteur en mètres au-dessus du sol du vantail."""
    return int(round(H - m / hauteur * H))


def porte_auto() -> tuple[Image.Image, dict]:
    """Vantail coulissant de l'entrée : cadre alu, grand verre, bande de
    vitrophanie à hauteur d'yeux (sans elle, on marche dedans), le mot ENTREE."""
    img = Image.new("RGBA", (L, H), VERRE + (70,))
    d = ImageDraw.Draw(img)
    haut = 2.5
    d.rectangle((0, 0, L - 1, 3), fill=ALU + (255,))
    d.rectangle((0, 0, 3, H - 1), fill=ALU + (255,))
    d.rectangle((L - 4, 0, L - 1, H - 1), fill=ALU + (255,))
    d.rectangle((0, H - 8, L - 1, H - 1), fill=ALU_SOMBRE + (255,))
    d.line((4, 4, 4, H - 9), fill=ALU_CLAIR + (255,))
    # Reflets : deux traits en biais, ce qui dit « verre » à 640×360.
    for x0 in (10, 18):
        d.line((x0, 40, x0 + 22, 10), fill=BLANC + (110,))
    # Vitrophanie : un pointillé à 1,5 m, le mot ENTREE dans un bandeau.
    y = _y(1.5, haut)
    for x in range(6, L - 6, 4):
        d.rectangle((x, y, x + 1, y + 1), fill=BLANC + (255,))
    y = _y(1.1, haut)
    d.rectangle((4, y - 2, L - 5, y + 6), fill=hexc("#1f5fbf") + (230,))
    draw_text(img, "ENTREE", (L - text_width("ENTREE")) // 2, y, BLANC + (255,))
    return img, {"metal": [60, 60, 3, 8], "chant": [1, 64]}


def porte_vav() -> tuple[Image.Image, dict]:
    """Porte va-et-vient de la réserve : PVC gris-bleu, hublot, plaque de
    poussée, tôle de coup de pied rayée par des années de transpalettes."""
    img = Image.new("RGBA", (L, H), hexc("#647087") + (255,))
    d = ImageDraw.Draw(img)
    haut, larg = 2.1, 1.2
    d.rectangle((0, 0, L - 1, H - 1), outline=hexc("#444a54") + (255,), width=2)
    # Hublot : rond DANS LE MONDE. La case étire le vantail différemment en
    # largeur (64 px pour 1,2 m) et en hauteur (128 px pour 2,1 m), d'où deux
    # rayons en pixels pour un seul rayon de 0,2 m.
    cx, cy = L // 2, _y(1.45, haut)
    rx, ry = 0.2 * L / larg, 0.2 * H / haut
    d.ellipse((cx - rx - 2, cy - ry - 2, cx + rx + 2, cy + ry + 2), fill=NOIR + (255,))
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=VERRE + (80,))
    d.line((cx - 5, cy + 2, cx + 3, cy - 7), fill=BLANC + (120,))
    # Écriteau sous le hublot.
    y = _y(1.12, haut)
    d.rectangle((18, y - 2, 45, y + 6), fill=BLANC + (255,))
    draw_text(img, "PRIVE", (L - text_width("PRIVE")) // 2, y, ROUGE + (255,))
    # Plaque de poussée, et le pavé de quincaillerie qu'elle fournit.
    d.rectangle((50, _y(1.25, haut), 57, _y(0.95, haut)), fill=ALU_CLAIR + (255,))
    # Tôle de coup de pied, rayée.
    y0 = _y(0.35, haut)
    d.rectangle((2, y0, L - 3, H - 3), fill=ALU + (255,))
    d.line((2, y0, L - 3, y0), fill=ALU_SOMBRE + (255,))
    for i in range(6):
        x = 6 + i * 9
        d.line((x, y0 + 4 + i % 3, x + 5, y0 + 2 + i % 3), fill=ALU_CLAIR + (255,))
    return img, {"metal": [51, _y(1.2, haut), 5, 10], "chant": [1, 64]}


def porte_bureau() -> tuple[Image.Image, dict]:
    """Porte de bureau en placage bois, la plaque nominative à hauteur d'yeux."""
    img = Image.new("RGB", (L, H), hexc("#a6654a"))
    d = ImageDraw.Draw(img)
    # Fil du bois : des veines verticales ondulées, jamais droites.
    for i, x in enumerate(range(3, L - 3, 5)):
        for y in range(0, H, 1):
            dx = int(1.4 * math.sin(y / (7 + i % 3) + i))
            if (y + i * 11) % 29 < 22:
                img.putpixel((min(L - 1, max(0, x + dx)), y), hexc("#89432e") if i % 2 else hexc("#b8612e"))
    d.rectangle((0, 0, L - 1, H - 1), outline=hexc("#654933"), width=2)
    # Plaque nominative (deux lignes de texte illisibles, c'est ce qu'on lit à
    # trois mètres) et la rosace de la poignée.
    y = _y(1.6, 2.1)
    d.rectangle((20, y, 43, y + 7), fill=ALU_CLAIR, outline=ALU_SOMBRE)
    d.line((23, y + 2, 40, y + 2), fill=NOIR)
    d.line((23, y + 5, 36, y + 5), fill=ALU_SOMBRE)
    y = _y(1.05, 2.1)
    d.rectangle((52, y - 6, 56, y + 6), fill=ALU_CLAIR, outline=ALU_SOMBRE)
    return img, {"metal": [53, y - 4, 3, 8], "chant": [0, 64]}


def porte_capitonnee() -> tuple[Image.Image, dict]:
    """La porte du Directeur : cuir bordeaux capitonné, clous dorés, plaque
    DIRECTION. Rien ne dit mieux « bureau d'un homme important » dans un
    hypermarché de province."""
    img = Image.new("RGB", (L, H), hexc("#69252a"))
    d = ImageDraw.Draw(img)
    pas = 10
    # Losanges du capiton : des diagonales claires, un bouton doré à chaque nœud.
    for k in range(-H, L + H, pas):
        d.line((k, 0, k + H, H), fill=hexc("#b02931"))
        d.line((k, 0, k - H, H), fill=hexc("#b02931"))
    for yy in range(4, H, pas):
        for xx in range(4 + (yy // pas % 2) * (pas // 2), L, pas):
            d.rectangle((xx, yy, xx + 1, yy + 1), fill=hexc("#f2c230"))
    # Clous de bordure.
    d.rectangle((0, 0, L - 1, H - 1), outline=hexc("#39281e"), width=2)
    for x in range(3, L - 2, 4):
        d.point((x, 3), fill=hexc("#d98330"))
        d.point((x, H - 4), fill=hexc("#d98330"))
    for y in range(3, H - 2, 4):
        d.point((3, y), fill=hexc("#d98330"))
        d.point((L - 4, y), fill=hexc("#d98330"))
    y = _y(1.62, 2.2)
    d.rectangle((13, y - 2, 50, y + 6), fill=hexc("#d98330"), outline=hexc("#39281e"))
    mot = "DIRECTION"
    draw_text(img, mot, (L - text_width(mot)) // 2 + 1, y, hexc("#39281e"))
    # Poignée en laiton : le pavé de quincaillerie de ce vantail.
    y = _y(1.05, 2.2)
    d.rectangle((52, y - 6, 56, y + 6), fill=hexc("#f2c230"), outline=hexc("#39281e"))
    return img, {"metal": [53, y - 4, 3, 8], "chant": [0, 64]}


def porte_wc() -> tuple[Image.Image, dict]:
    """Porte des toilettes de la cafétéria : stratifié gris clair, plaque bleue
    « WC » et ses deux pictogrammes, plaque de poussée inox, tôle de coup de
    pied. Elle se reconnaît de l'autre bout de la salle à sa plaque bleue, bien
    avant qu'on y lise quoi que ce soit."""
    haut = 2.0
    img = Image.new("RGB", (L, H), hexc("#c9c3b6"))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, L - 1, H - 1), outline=hexc("#8a8478"), width=2)
    # Traces grises là où l'on pousse depuis vingt ans : autour de la plaque.
    for i in range(12):
        x, y = 40 + (i * 7) % 18, _y(1.35, haut) + (i * 5) % 22
        d.point((x, y), fill=hexc("#a39d90"))
    # La plaque : WC en double taille, l'homme et la femme dessous.
    y = _y(1.7, haut)
    d.rectangle((15, y, 48, y + 25), fill=hexc("#1f5fbf"), outline=hexc("#0f2f60"))
    draw_text(img, "WC", (L - text_width("WC", 2)) // 2, y + 3, BLANC, scale=2)
    haut_picto = y + 15
    for cx, femme in ((25, False), (38, True)):
        d.rectangle((cx - 1, haut_picto, cx, haut_picto + 1), fill=BLANC)
        if femme:
            d.polygon(((cx - 1, haut_picto + 3), (cx, haut_picto + 3),
                       (cx + 2, haut_picto + 7), (cx - 3, haut_picto + 7)), fill=BLANC)
        else:
            d.rectangle((cx - 2, haut_picto + 3, cx + 1, haut_picto + 6), fill=BLANC)
        d.rectangle((cx - 2, haut_picto + 7, cx - 1, haut_picto + 9), fill=BLANC)
        d.rectangle((cx, haut_picto + 7, cx + 1, haut_picto + 9), fill=BLANC)
    d.line((31, haut_picto, 31, haut_picto + 9), fill=BLANC)
    # Plaque de poussée, et le pavé de quincaillerie qu'elle fournit.
    d.rectangle((50, _y(1.3, haut), 57, _y(1.0, haut)), fill=ALU_CLAIR, outline=ALU_SOMBRE)
    # Tôle de coup de pied.
    y0 = _y(0.3, haut)
    d.rectangle((2, y0, L - 3, H - 3), fill=ALU)
    d.line((2, y0, L - 3, y0), fill=ALU_SOMBRE)
    for i in range(5):
        x = 7 + i * 11
        d.line((x, y0 + 5 + i % 2, x + 6, y0 + 3 + i % 2), fill=ALU_CLAIR)
    return img, {"metal": [52, _y(1.25, haut), 4, 8], "chant": [0, 64]}


ATLAS = {
    "portes_verre": (("porte_auto", porte_auto), ("porte_vav", porte_vav)),
    "portes": (("porte_bureau", porte_bureau), ("porte_capitonnee", porte_capitonnee)),
    "portes_2": (("porte_wc", porte_wc),),
}


def quantifier(img: Image.Image) -> Image.Image:
    """Quantifie la couleur sur la palette et garde l'alpha tel quel : la
    palette n'a pas de canal alpha, le verre non plus n'a pas de couleur à lui."""
    rgb = img.convert("RGB").quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")
    if img.mode != "RGBA":
        return rgb
    rgba = rgb.convert("RGBA")
    rgba.putalpha(img.getchannel("A"))
    return rgba


def main() -> None:
    for nom, vantaux in ATLAS.items():
        mode = "RGBA" if nom == "portes_verre" else "RGB"
        atlas = Image.new(mode, (2 * L, H))
        meta = {}
        for i, (porte, fn) in enumerate(vantaux):
            img, infos = fn()
            atlas.paste(img, (i * L, 0))
            mx, my, mw, mh = infos["metal"]
            cx, cy = infos["chant"]
            meta[porte] = {"px": [i * L, 0, L, H], "metal": [i * L + mx, my, mw, mh],
                           "chant": [i * L + cx, cy]}
        quantifier(atlas).save(os.path.join(OUT, nom + ".png"))
        with open(os.path.join(OUT, nom + ".json"), "w") as f:
            json.dump({"atlas_px": 2 * L, "portes": meta}, f, indent=2)
        print(f"ok  {nom}.png ({len(vantaux)} vantaux) + {nom}.json")


if __name__ == "__main__":
    main()
