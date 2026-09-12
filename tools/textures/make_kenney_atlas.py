"""Ramène l'atlas de couleurs du Kenney Food Kit à notre palette et à 128 px.

    ./.venv-refs/bin/python3 tools/textures/make_kenney_atlas.py

Les modèles du pack partagent tous un unique matériau `colormap` pointant sur
un atlas 512×512 de pastilles unies : un produit posé en rayon ne coûte donc
qu'un seul matériau, et tous se fondent en un seul lot au chargement (ADR
0023). Deux contraintes du projet s'appliquent quand même à cet atlas :
128 px au maximum (`validate_level.py`) et la palette commune du niveau v2
(`docs/pipeline/harmonisation-assets.md`).

Réduction en NEAREST, jamais en BOX : les UV du pack visent le CENTRE d'une
pastille, mais un filtre moyennant mélangerait les pastilles voisines aux
bords et changerait la couleur d'un produit. Le script vérifie ensuite, pour
chaque pastille, que son centre a survécu à la réduction.
"""

import json
import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "assets_src", "cc0_raw", "kenney_food-kit",
                   "Models", "OBJ format", "Textures", "colormap.png")
OUT_DIR = os.path.join(ROOT, "assets_src", "textures")
SIZE = 128
FACTOR = 4  # 512 → 128


def palette_image() -> Image.Image:
    colors = json.load(open(os.path.join(OUT_DIR, "palette.json")))["colors"]
    flat = []
    for h in colors:
        flat += [int(h[i:i + 2], 16) for i in (1, 3, 5)]
    flat += flat[:3] * (256 - len(colors))
    pal = Image.new("P", (1, 1))
    pal.putpalette(flat)
    return pal


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    small = src.resize((SIZE, SIZE), Image.NEAREST)
    quant = small.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB")
    quant.save(os.path.join(OUT_DIR, "prd_kenney.png"))

    # Contrôle : écart de couleur au centre de chaque pastille, avant/après.
    src_px, out_px = src.load(), quant.load()
    worst, total = 0, 0
    step = src.width // SIZE * FACTOR
    for y in range(step // 2, src.height, step):
        for x in range(step // 2, src.width, step):
            a = src_px[x, y]
            b = out_px[min(x // FACTOR, SIZE - 1), min(y // FACTOR, SIZE - 1)]
            d = max(abs(a[i] - b[i]) for i in range(3))
            worst = max(worst, d)
            total += d
    n = (src.width // step) ** 2
    print(f"ok  prd_kenney.png  {src.size} -> {quant.size}")
    print(f"    écart par pastille : moyen {total / n:.1f}, pire {worst} (sur 255)")


if __name__ == "__main__":
    main()
