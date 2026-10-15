"""Panneaux d'histoire : les illustrations générées par IA, recadrées, réduites et quantifiées.

    ./.venv-refs/bin/python3 tools/textures/generate_panneaux.py
    ./.venv-refs/bin/python3 tools/textures/generate_panneaux.py --check

Entrée : `assets_src/panneaux/raw/<id>.png` (ou .jpg, .webp), produites avec
les prompts de `assets_src/panneaux/PROMPTS.md` et `PROMPTS_METRO.md`. Un panneau absent est
simplement sauté : le jeu affiche alors un aplat numéroté à sa place.

Sortie : `public/assets/story/<id>.png` en 640×360, et la liste des panneaux
livrés dans `src/game/session/presentation/storyImages.json`, que lit
`storyPanels.ts`. Aucun fichier du jeu n'est à modifier à la main.

Pourquoi réduire et quantifier : le jeu rend en 640×360, en gros pixels
(invariant #4). Une illustration lisse de 1536 px affichée telle quelle
jurerait avec l'image qui la précède et la suit.

Pourquoi une palette propre à chaque panneau, et non celle des textures
(`assets_src/textures/palette.json`) : cette palette a été tirée du décor du
magasin. Appliquée à une illustration, elle déplace les teintes (un brun
devient gris) ou les couvre de bruit de tramage. Une palette de 64 couleurs
calculée sur l'image garde ses teintes et ses accents (voyant rouge, halo
vert) ; la méthode « octree » les préserve mieux que la coupe médiane.
"""

import argparse
import json
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = os.path.join(ROOT, "assets_src", "panneaux", "raw")
OUT = os.path.join(ROOT, "public", "assets", "story")
LIVRES = os.path.join(ROOT, "src", "game", "session", "presentation", "storyImages.json")

# Mêmes identifiants que `storyPanels.ts` : un test du jeu vérifie l'accord.
PANNEAUX = [
    "intro_1", "intro_2", "intro_3", "intro_4", "outro_1", "outro_2", "outro_3", "outro_4",
    "metro_intro_1", "metro_intro_2", "metro_intro_3", "metro_intro_4",
    "metro_outro_1", "metro_outro_2", "metro_outro_3", "metro_outro_4",
]
TAILLE = (640, 360)
EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")
# En dessous, l'agrandissement se verrait : on refuse plutôt que de livrer flou.
LARGEUR_MIN = 1280
COULEURS = 64


def source(ident: str, raw: str) -> str | None:
    for ext in EXTENSIONS:
        chemin = os.path.join(raw, ident + ext)
        if os.path.exists(chemin):
            return chemin
    return None


def recadrer(image: Image.Image) -> Image.Image:
    """Recadrage centré en 16:9, sans déformer."""
    largeur, hauteur = image.size
    cible = TAILLE[0] / TAILLE[1]
    if largeur / hauteur > cible:
        nouvelle = round(hauteur * cible)
        gauche = (largeur - nouvelle) // 2
        return image.crop((gauche, 0, gauche + nouvelle, hauteur))
    nouvelle = round(largeur / cible)
    haut = (hauteur - nouvelle) // 2
    return image.crop((0, haut, largeur, haut + nouvelle))


def panneau(chemin: str, couleurs: int) -> Image.Image:
    image = Image.open(chemin).convert("RGB")
    if image.width < LARGEUR_MIN:
        raise SystemExit(f"{os.path.basename(chemin)} : {image.width} px de large, il en faut au moins {LARGEUR_MIN}")
    reduite = recadrer(image).resize(TAILLE, Image.Resampling.LANCZOS)
    return reduite.quantize(colors=couleurs, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert("RGB")


def livres_attendus(raw: str) -> list[str]:
    return [ident for ident in PANNEAUX if source(ident, raw)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("--raw", default=RAW, help="dossier des images brutes")
    parser.add_argument("--out", default=OUT, help="dossier de sortie des panneaux")
    parser.add_argument("--couleurs", type=int, default=COULEURS, help=f"taille de la palette de chaque panneau (défaut {COULEURS})")
    parser.add_argument("--check", action="store_true", help="échoue si la liste livrée ne correspond pas aux images brutes")
    args = parser.parse_args()

    attendus = livres_attendus(args.raw)
    if args.check:
        livres = json.load(open(LIVRES)) if os.path.exists(LIVRES) else []
        if livres != attendus:
            print(f"périmé : {os.path.relpath(LIVRES, ROOT)} liste {livres}, les images brutes donnent {attendus}")
            return 1
        print(f"à jour : {len(livres)} panneau(x) livré(s)")
        return 0

    inconnus = sorted(
        f for f in (os.listdir(args.raw) if os.path.isdir(args.raw) else [])
        if f.lower().endswith(EXTENSIONS) and os.path.splitext(f)[0] not in PANNEAUX
    )
    if inconnus:
        print(f"ignoré (identifiant inconnu) : {', '.join(inconnus)}", file=sys.stderr)

    os.makedirs(args.out, exist_ok=True)
    for ident in attendus:
        panneau(source(ident, args.raw), args.couleurs).save(os.path.join(args.out, ident + ".png"), optimize=True)
        print(f"ok  {ident}.png")
    if args.out == OUT:
        for ident in PANNEAUX:
            perime = os.path.join(OUT, ident + ".png")
            if ident not in attendus and os.path.exists(perime):
                os.remove(perime)
                print(f"retiré  {ident}.png (plus d'image brute)")
        with open(LIVRES, "w") as f:
            json.dump(attendus, f, indent=2)
            f.write("\n")
    print(f"{len(attendus)} / {len(PANNEAUX)} panneaux livrés")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
