"""Atlas des affiches de marques : les illustrations générées par IA, réduites, quantifiées et titrées.

    ./.venv-refs/bin/python3 tools/textures/generate_affiches.py

Entrée : `assets_src/affiches/raw/<nom>.png`, produites avec les prompts de
`assets_src/affiches/PROMPTS.md` (illustration en haut, bande de couleur vide
en bas). Une affiche absente est simplement sautée : l'atlas se remplit au fil
des générations, sans jamais changer de place pour celles déjà posées.

Pourquoi le texte est posé ICI et non par l'IA : une affiche fait 100 × 160 px
dans l'atlas, et un texte lissé réduit à cette taille devient une bouillie. Le
nom et le slogan utilisent la police pixel des étiquettes, comme les paquets
en rayon — l'affiche se lit alors comme le paquet qu'elle vend.

Densité : 100 px pour une affiche de 1 m de large, soit la même exception
assumée que les étiquettes de produits (~100 px/m au lieu de 64), et pour la
même raison : sinon aucun slogan ne se lirait.
"""

import json
import os

from PIL import Image, ImageDraw

from generate_labels import BLACK, BLUE, FONT, ORANGE, RED, WHITE, YELLOW, draw_text, palette_image, text_width

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = os.path.join(ROOT, "assets_src", "affiches", "raw")
OUT = os.path.join(ROOT, "assets_src", "textures")

CELL_W, CELL_H = 100, 160          # 5:8, le format d'un flanc de tête de gondole
BAND_H = 48                        # 30 % : deux lignes de titre et deux de slogan
ATLAS = 512                        # 5 × 3 cases : les quinze affiches du MD
COLUMNS = 5

# L'ORDRE fixe la case de chaque affiche, qu'elle existe déjà ou non : ajouter
# une image plus tard ne déplace jamais les autres, donc ne casse aucune UV.
# (nom, lignes de titre, lignes de slogan, bande, titre, slogan). Pas d'accents
# (voir la police) ; chaque ligne de titre tient en 12 caractères, chaque ligne
# de slogan en 24.
AFFICHES = [
    ("cereales_pyramides", ["PYRAMIDES"], ["LE PETIT DEJ", "QUI VOUS OBSERVE"], RED, WHITE, YELLOW),
    ("lait_trainees_blanches", ["TRAINEES", "BLANCHES"], ["TOMBE DU CIEL"], BLUE, WHITE, WHITE),
    ("eau_terre_plate", ["TERRE PLATE"], ["AUCUNE COURBE.", "AUCUN DOUTE."], BLUE, WHITE, YELLOW),
    ("soda_5g_cola", ["5G COLA"], ["LE GOUT QUI", "CAPTE PARTOUT"], BLACK, YELLOW, WHITE),
    ("raviolis_bunker", ["RAVIOLIS", "DU BUNKER"], ["JUSQU'A LA FIN DU MONDE"], BLACK, YELLOW, WHITE),
    ("alu_protect", ["ALU-PROTECT"], ["PROTEGE VOS RESTES.", "ET VOS PENSEES."], BLUE, WHITE, YELLOW),
    ("sables_reptiliens", ["SABLES", "REPTILIENS"], ["LA RECETTE DE", "NOS ANCETRES."], BLACK, YELLOW, WHITE),
    ("cafe_reveille", ["CAFE", "REVEILLE"], ["REVEILLEZ-VOUS !"], ORANGE, BLACK, WHITE),
    ("chips_illumi", ["ILLUMI"], ["UN TRIANGLE.", "COINCIDENCE ?"], BLACK, YELLOW, WHITE),
    ("lessive_profonde", ["PROFONDE"], ["LAVE EN PROFONDEUR.", "NE LAISSE AUCUNE TRACE."], ORANGE, BLACK, WHITE),
    ("coquillettes_nouvel_ordre", ["COQUILLETTES", "NOUVEL ORDRE"], ["TOUTES PAREILLES."], BLUE, YELLOW, WHITE),
    ("dentifrice_sans_fluor", ["SANS-FLUOR"], ["VOS DENTS NE SERONT", "PAS CONTROLEES."], RED, WHITE, YELLOW),
    ("piles_lune_truquee", ["LUNE TRUQUEE"], ["ENERGIE ILLIMITEE.", "ALUNISSAGE NON GARANTI."], YELLOW, BLACK, BLACK),
    ("carte_fidelite", ["CARTE", "FIDELITE"], ["CHAQUE CARTE", "OUVRE UNE PORTE."], RED, WHITE, YELLOW),
    ("mag_verite", ["VERITE"], ["CE QU'ILS", "VOUS CACHENT."], BLACK, YELLOW, WHITE),
]


def band_top(img: Image.Image) -> int:
    """Première ligne de la bande unie du bas, en remontant tant que la ligne
    ressemble à la couleur relevée tout en bas. Les IA ne respectent la
    consigne des 30 % qu'à peu près (19 à 27 % constatés)."""
    small = img.resize((64, img.height // 4))
    px = small.load()
    ref = [sum(px[x, small.height - 2][c] for x in range(64)) / 64 for c in range(3)]
    y = small.height - 1
    while y > small.height // 2:
        proches = sum(1 for x in range(64)
                      if sum(abs(px[x, y][c] - ref[c]) for c in range(3)) < 60)
        if proches < 60:
            break
        y -= 1
    # Deux lignes de marge : la frontière relevée à 4 px près laisse sinon un
    # liseré de la bande d'origine au-dessus de la nôtre.
    return (y - 1) * 4


def illustration(img: Image.Image) -> Image.Image:
    """La partie au-dessus de la bande, recadrée au ratio de la zone d'image de
    la case puis réduite. La coupe prend 60 % en haut (du ciel, en général) et
    40 % en bas, où le sujet touche souvent la bande."""
    top = band_top(img)
    zone_h = CELL_H - BAND_H
    want_h = round(img.width * zone_h / CELL_W)
    if want_h <= top:
        excess = top - want_h
        box = (0, round(excess * 0.6), img.width, top - round(excess * 0.4))
    else:
        want_w = round(top * CELL_W / zone_h)
        margin = (img.width - want_w) // 2
        box = (margin, 0, margin + want_w, top)
    return img.crop(box).resize((CELL_W, zone_h), Image.LANCZOS)


def cell(name, titre, slogan, band, c_titre, c_slogan) -> Image.Image:
    src = Image.open(os.path.join(RAW, name + ".png")).convert("RGB")
    img = Image.new("RGB", (CELL_W, CELL_H), band)
    img.paste(illustration(src), (0, 0))
    d = ImageDraw.Draw(img)
    y0 = CELL_H - BAND_H
    d.line((0, y0, CELL_W - 1, y0), fill=BLACK)

    # Bloc de texte centré verticalement dans la bande.
    hauteur = len(titre) * 12 - 2 + 4 + len(slogan) * 7 - 2
    y = y0 + 1 + (BAND_H - 1 - hauteur) // 2
    for ligne in titre:
        draw_text(img, ligne, (CELL_W - text_width(ligne, 2)) // 2, y, c_titre, scale=2)
        y += 12
    y += 2
    for ligne in slogan:
        draw_text(img, ligne, (CELL_W - text_width(ligne)) // 2, y, c_slogan)
        y += 7
    return img


def check_textes() -> None:
    """Vérifie TOUTES les affiches, générées ou non : un slogan trop long doit
    se voir le jour où on l'écrit, pas le jour où l'image arrive."""
    for name, titre, slogan, *_ in AFFICHES:
        assert len(titre) + len(slogan) <= 4, f"{name} : plus de quatre lignes"
        for ligne in titre:
            assert text_width(ligne, 2) <= CELL_W - 4, f"{name} : titre trop long, {ligne!r}"
        for ligne in slogan:
            assert text_width(ligne) <= CELL_W - 2, f"{name} : slogan trop long, {ligne!r}"
        assert all(ch in FONT for ligne in titre + slogan for ch in ligne), f"{name} : caractère hors police"


def main() -> None:
    check_textes()
    atlas = Image.new("RGB", (ATLAS, ATLAS), BLACK)
    layout, absentes = {}, []
    for i, (name, *spec) in enumerate(AFFICHES):
        if not os.path.exists(os.path.join(RAW, name + ".png")):
            absentes.append(name)
            continue
        x, y = (i % COLUMNS) * CELL_W, (i // COLUMNS) * CELL_H
        atlas.paste(cell(name, *spec), (x, y))
        layout[name] = {"px": [x, y, CELL_W, CELL_H]}
    atlas = atlas.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")
    atlas.save(os.path.join(OUT, "aff_affiches.png"))
    with open(os.path.join(OUT, "aff_affiches.json"), "w") as f:
        json.dump({"atlas_px": ATLAS, "cell_px": [CELL_W, CELL_H], "affiches": layout}, f, indent=2)
    print(f"ok  aff_affiches.png ({len(layout)} affiches) + aff_affiches.json")
    if absentes:
        print(f"    pas encore générées : {', '.join(absentes)}")


if __name__ == "__main__":
    main()
