"""Textures de base du niveau v2 : sources CC0 réduites à 128×128 (64 px/m), accentuées, quantifiées sur la palette commune sans tramage.

    ./.venv-refs/bin/python3 tools/textures/make_textures.py [nom ...]
"""

import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "assets_src", "textures")
ACG = os.path.join(ROOT, "assets_src", "cc0_raw", "ambientcg")
SIZE = 128

# repeat : nombre de répétitions de la source dans la texture — la source couvre 2 m / repeat.
# Les motifs fins (tôle, terrazzo) sont volontairement grossis : à 640×360, la lisibilité prime sur l'échelle réelle.
TEXTURES = {
    "sol_carrelage_blanc": dict(src="Tiles141", repeat=1, contrast=1.25),
    "sol_damier": dict(src="Tiles074", repeat=1, contrast=1.1),
    # Contraste ramené de 1.2 à 0.85 : à 640×360 les éclats du terrazzo se lisaient
    # comme des détritus au sol plutôt que comme un revêtement (constaté en rendu N4).
    "sol_terrazzo": dict(src="Terrazzo018", repeat=1, contrast=0.85, color=0.8, brightness=1.05),
    "sol_terrazzo_fin": dict(src="Terrazzo013", repeat=1, contrast=1.3, color=1.2),
    "sol_beton": dict(src="Concrete034", repeat=1, contrast=1.4),
    "sol_beton_brut": dict(src="Concrete042A", repeat=1, contrast=1.3),
    "sol_asphalte": dict(src="Asphalt031", repeat=1, contrast=1.4),
    "sol_moquette": dict(src="Carpet012", repeat=2, contrast=1.3, color=1.3),
    "mur_platre": dict(src="PaintedPlaster017", repeat=1, contrast=2.2, brightness=1.12),
    "mur_platre_use": dict(src="PaintedPlaster015", repeat=1, contrast=1.3),
    "plafond_dalles": dict(src="OfficeCeiling001", repeat=1, contrast=1.3),
    # Nervures et trous sont dans la carte de relief chez ambientCG, pas dans la couleur : en Lambert
    # il n'y a pas de relief, donc on les peint dans l'albedo, comme Build.
    "metal_bac_acier": dict(src="CorrugatedSteel005", repeat=1, contrast=1.15, ribs=(8, 0.22)),
    # Trous de 6 cm et non 12 (période 4 px, qui divise 128 : sinon la texture ne
    # se répète plus sans joint) et fond assombri : le dos d'une gondole doit
    # reculer derrière la marchandise, pas lui disputer le regard.
    "metal_tole_perforee": dict(src="SheetMetal002", repeat=2, contrast=1.1,
                                brightness=0.78, holes=(4, 0.9)),
    "metal_peint_rouge": dict(src="PaintedMetal004", repeat=1, contrast=1.2, color=1.2),
    "carton": dict(src="Cardboard004", repeat=1, contrast=1.15, color=0.7, brightness=0.95),
    "metal_bandes_danger": dict(src="Concrete034", repeat=1, contrast=1.0, stripes=(16, "#f2c230", "#111014")),
    # Pas de source bois dans le lot ambientCG retenu : le carton en tient lieu, assombri
    # et rayé de joints nets (32 px = planche de 50 cm à 64 px/m).
    "bois_palette": dict(src="Cardboard004", repeat=1, contrast=1.25, color=0.9,
                         brightness=0.82, planks=(32, 2)),
}


def palette_image() -> Image.Image:
    colors = json.load(open(os.path.join(OUT_DIR, "palette.json")))["colors"]
    flat = []
    for h in colors:
        flat += [int(h[i:i + 2], 16) for i in (1, 3, 5)]
    flat += flat[:3] * (256 - len(colors))
    pal = Image.new("P", (1, 1))
    pal.putpalette(flat)
    return pal


def tile(img: Image.Image, n: int) -> Image.Image:
    out = Image.new("RGB", (img.width * n, img.height * n))
    for y in range(n):
        for x in range(n):
            out.paste(img, (x * img.width, y * img.height))
    return out


def hex_rgb(h: str) -> tuple[int, int, int]:
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


# Les motifs peints ont une période qui divise SIZE, sinon la texture ne se répète plus sans joint.
def paint_ribs(img: Image.Image, period: int, strength: float) -> Image.Image:
    px = img.load()
    for x in range(img.width):
        k = 1 - strength * 0.5 * (1 + math.sin(2 * math.pi * x / period))
        for y in range(img.height):
            r, g, b = px[x, y]
            px[x, y] = (int(r * k), int(g * k), int(b * k))
    return img


def paint_holes(img: Image.Image, period: int, radius: float) -> Image.Image:
    draw = ImageDraw.Draw(img)
    for cy in range(period // 2, img.height, period):
        for cx in range(period // 2, img.width, period):
            draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(24, 22, 26))
    return img


def paint_planks(img: Image.Image, period: int, seam: int) -> Image.Image:
    """Joints de planches horizontaux, nets. Contrairement à `paint_ribs` (sinus,
    relief doux d'une tôle), une planche se lit à son bord franc."""
    px = img.load()
    for y in range(img.height):
        if y % period >= seam:
            continue
        for x in range(img.width):
            r, g, b = px[x, y]
            px[x, y] = (int(r * 0.55), int(g * 0.55), int(b * 0.55))
    return img


def paint_stripes(img: Image.Image, width: int, color_a: str, color_b: str) -> Image.Image:
    grime = img.convert("L")
    px, g = img.load(), grime.load()
    a, b = hex_rgb(color_a), hex_rgb(color_b)
    for y in range(img.height):
        for x in range(img.width):
            base = a if ((x + y) // width) % 2 == 0 else b
            k = 0.75 + 0.25 * g[x, y] / 255
            px[x, y] = tuple(int(c * k) for c in base)
    return img


def make(name: str, spec: dict, pal: Image.Image) -> Image.Image:
    src = Image.open(os.path.join(ACG, f"{spec['src']}_1K-JPG_Color.jpg")).convert("RGB")
    side = SIZE // spec.get("repeat", 1)
    # BOX sur un facteur entier garde la texture tileable ; LANCZOS créerait un joint aux bords.
    small = tile(src.resize((side, side), Image.BOX), spec.get("repeat", 1))
    if "ribs" in spec:
        small = paint_ribs(small, *spec["ribs"])
    if "holes" in spec:
        small = paint_holes(small, *spec["holes"])
    if "planks" in spec:
        small = paint_planks(small, *spec["planks"])
    if "stripes" in spec:
        small = paint_stripes(small, *spec["stripes"])
    # Accentuation sur une copie 3×3 puis recadrage au centre, pour que les filtres voient les voisins réels aux bords.
    big = tile(small, 3)
    big = ImageEnhance.Contrast(big).enhance(spec.get("contrast", 1.2))
    big = ImageEnhance.Color(big).enhance(spec.get("color", 1.0))
    big = ImageEnhance.Brightness(big).enhance(spec.get("brightness", 1.0))
    big = big.filter(ImageFilter.UnsharpMask(radius=1, percent=spec.get("sharpen", 80), threshold=2))
    out = big.crop((SIZE, SIZE, 2 * SIZE, 2 * SIZE))
    return out.quantize(palette=pal, dither=Image.Dither.NONE).convert("RGB")


def main() -> None:
    names = sys.argv[1:] or list(TEXTURES)
    pal = palette_image()
    os.makedirs(OUT_DIR, exist_ok=True)
    for name in names:
        make(name, TEXTURES[name], pal).save(os.path.join(OUT_DIR, f"{name}.png"))
        print(f"ok  {name}.png  <- {TEXTURES[name]['src']}")


if __name__ == "__main__":
    main()
