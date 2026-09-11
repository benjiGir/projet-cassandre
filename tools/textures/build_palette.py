"""Palette commune du niveau v2 : k-means sur toutes les sources (board, matériaux, atlas), plus des accents de signalétique.

    ./.venv-refs/bin/python3 tools/textures/build_palette.py
"""

import glob
import json
import os

import numpy as np
from PIL import Image
from sklearn.cluster import KMeans

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "assets_src", "textures")
RAW = os.path.join(ROOT, "assets_src", "cc0_raw")

KMEANS_COLORS = 56
PIXELS_PER_GROUP = 60000
SAMPLE_SIDE = 128

# Couleurs de signalétique criarde (style Build) que le k-means écraserait : peu de pixels
# dans les sources, mais indispensables aux panneaux, promos et étiquettes.
ACCENTS = [
    "#d8231f",  # rouge promo / SORTIE
    "#f2c230",  # jaune bandes de parking, étiquettes prix
    "#1f5fbf",  # bleu enseigne
    "#2e9e44",  # vert issue de secours
    "#e8741c",  # orange
    "#c2307a",  # magenta PLV années 90
    "#111014",  # quasi-noir
    "#f2efe6",  # quasi-blanc
]

SOURCE_GROUPS = {
    "board": [p for p in glob.glob(os.path.join(ROOT, "refs", "*", "*"))
              if p.lower().endswith((".jpg", ".jpeg", ".png")) and "palette" not in os.path.basename(p)],
    "materiaux": glob.glob(os.path.join(RAW, "ambientcg", "*_Color.jpg")),
    "atlas": [
        os.path.join(RAW, "kenney_food-kit", "Models", "GLB format", "Textures", "colormap.png"),
        os.path.join(RAW, "kaykit_restaurant", "KayKit_Restaurant_Bits_1.0_FREE", "Assets", "textures", "restaurantbits_texture.png"),
        os.path.join(RAW, "kaykit_furniture", "KayKit_Furniture_Bits_1.0_FREE", "Assets", "texture", "furniturebits_texture.png"),
        os.path.join(RAW, "token_gesture_arcade", "token_gesture", "atlas.png"),
    ],
}


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    c = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], axis=1)


def lab_to_srgb(lab: np.ndarray) -> np.ndarray:
    fy = (lab[:, 0] + 16) / 116
    fx = fy + lab[:, 1] / 500
    fz = fy - lab[:, 2] / 200
    f = np.stack([fx, fy, fz], axis=1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * np.array([0.95047, 1.0, 1.08883])
    m_inv = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
    c = np.clip(xyz @ m_inv.T, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)


def load_group(paths: list[str], rng: np.random.Generator) -> np.ndarray:
    chunks = []
    for p in paths:
        img = Image.open(p).convert("RGB")
        img.thumbnail((SAMPLE_SIDE, SAMPLE_SIDE))
        chunks.append(np.asarray(img).reshape(-1, 3) / 255.0)
    px = np.concatenate(chunks)
    idx = rng.choice(len(px), size=min(PIXELS_PER_GROUP, len(px)), replace=len(px) < PIXELS_PER_GROUP)
    return px[idx]


def hex_to_rgb(h: str) -> list[float]:
    return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]


def main() -> None:
    rng = np.random.default_rng(42)
    groups = {name: load_group(paths, rng) for name, paths in SOURCE_GROUPS.items()}
    samples = np.concatenate(list(groups.values()))

    km = KMeans(n_clusters=KMEANS_COLORS, n_init=4, random_state=42).fit(srgb_to_lab(samples))
    palette = np.concatenate([lab_to_srgb(km.cluster_centers_), np.array([hex_to_rgb(h) for h in ACCENTS])])

    lab = srgb_to_lab(palette)
    hue = np.degrees(np.arctan2(lab[:, 2], lab[:, 1])) % 360
    chroma = np.hypot(lab[:, 1], lab[:, 2])
    grey = chroma < 12
    order = np.lexsort((lab[:, 0], np.where(grey, -1, np.round(hue / 45))))
    palette = palette[order]

    os.makedirs(OUT_DIR, exist_ok=True)
    swatch = 16
    img = Image.new("RGB", (8 * swatch, 8 * swatch))
    for i, c in enumerate(palette):
        img.paste(Image.new("RGB", (swatch, swatch), tuple(int(v * 255) for v in c)), ((i % 8) * swatch, (i // 8) * swatch))
    img.save(os.path.join(OUT_DIR, "palette.png"))

    pal_lab = srgb_to_lab(palette)
    errors = {}
    for name, px in groups.items():
        d = np.linalg.norm(srgb_to_lab(px)[:, None, :] - pal_lab[None, :, :], axis=2).min(axis=1)
        errors[name] = round(float(d.mean()), 2)

    hexes = ["#{:02x}{:02x}{:02x}".format(*(int(v * 255) for v in c)) for c in palette]
    with open(os.path.join(OUT_DIR, "palette.json"), "w") as f:
        json.dump({"colors": hexes, "kmeans": KMEANS_COLORS, "accents": ACCENTS,
                   "sources": {k: len(v) for k, v in SOURCE_GROUPS.items()},
                   "mean_delta_e": errors}, f, indent=2)

    print(f"palette : {len(hexes)} couleurs -> assets_src/textures/palette.png")
    print("écart moyen (ΔE Lab) par groupe de sources :", errors)


if __name__ == "__main__":
    main()
