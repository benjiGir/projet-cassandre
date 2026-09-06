"""
Extraction de contraintes chromatiques depuis un board de références.

    python3 tools/refs/extract_palette.py refs/hypermarche/ --colors 24

Produit :
  - palette.png          bande de couleurs, à charger dans Blender
  - palette.json         contraintes exploitables par l'agent
  - value_profile.txt    rapport lisible

Ne dépend pas de Blender. Testé.

L'objectif n'est pas de copier une image mais d'en extraire des CONTRAINTES
mesurables, que l'agent applique ensuite et vérifie. Une contrainte chiffrée
se transfère ; une "ambiance" ne se transfère pas.
"""

import argparse
import colorsys
import json
import os
import sys

import numpy as np
from PIL import Image
from sklearn.cluster import KMeans

EXTS = (".png", ".jpg", ".jpeg", ".webp", ".bmp")
SAMPLE_MAX = 200  # côté max avant échantillonnage — suffit pour la statistique


def load_pixels(folder: str) -> tuple[np.ndarray, list[str]]:
    files = sorted(
        os.path.join(folder, f)
        for f in os.listdir(folder)
        if f.lower().endswith(EXTS)
    )
    if not files:
        print(f"Aucune image dans {folder}")
        sys.exit(1)

    chunks = []
    for path in files:
        img = Image.open(path).convert("RGB")
        img.thumbnail((SAMPLE_MAX, SAMPLE_MAX))
        chunks.append(np.asarray(img).reshape(-1, 3))
    return np.concatenate(chunks).astype(np.float32) / 255.0, files


def dominant_colors(px: np.ndarray, k: int) -> list[dict]:
    km = KMeans(n_clusters=k, n_init=4, random_state=42).fit(px)
    counts = np.bincount(km.labels_, minlength=k)
    order = np.argsort(-counts)

    out = []
    for i in order:
        r, g, b = (float(v) for v in km.cluster_centers_[i])
        h, l, s = colorsys.rgb_to_hls(r, g, b)
        out.append({
            "hex": "#{:02x}{:02x}{:02x}".format(
                int(r * 255), int(g * 255), int(b * 255)
            ),
            "rgb": [round(float(c), 4) for c in (r, g, b)],
            "hue_deg": round(h * 360, 1),
            "sat": round(float(s), 3),
            "lum": round(float(l), 3),
            "share": round(float(counts[i] / counts.sum()), 4),
        })
    return out


def value_profile(px: np.ndarray) -> dict:
    """La structure de valeurs compte plus que la teinte pour la lisibilité."""
    lum = 0.2126 * px[:, 0] + 0.7152 * px[:, 1] + 0.0722 * px[:, 2]
    hist, _ = np.histogram(lum, bins=10, range=(0, 1))
    hist = hist / hist.sum()

    sub = px[::37].astype(np.float64)
    sat = np.array([colorsys.rgb_to_hls(*map(float, p))[2] for p in sub])

    mean = float(lum.mean())
    return {
        "mean_luminance": round(mean, 3),
        "std_luminance": round(float(lum.std()), 3),
        "key": "low-key" if mean < 0.38 else ("high-key" if mean > 0.62 else "mid-key"),
        "contrast": "fort" if lum.std() > 0.24 else ("faible" if lum.std() < 0.14 else "moyen"),
        "mean_saturation": round(float(sat.mean()), 3),
        "saturation_class": (
            "désaturé" if sat.mean() < 0.20
            else "saturé" if sat.mean() > 0.45
            else "modéré"
        ),
        "histogram_10": [round(float(v), 4) for v in hist],
        "dark_share": round(float((lum < 0.25).mean()), 3),
        "light_share": round(float((lum > 0.75).mean()), 3),
    }


def temperature(colors: list[dict]) -> str:
    warm = sum(c["share"] for c in colors if c["hue_deg"] < 90 or c["hue_deg"] > 300)
    cool = sum(c["share"] for c in colors if 150 <= c["hue_deg"] <= 270)
    if warm > cool * 1.5:
        return "chaude"
    if cool > warm * 1.5:
        return "froide"
    return "neutre"


def contrast_ratio(a: list[float], b: list[float]) -> float:
    def lin(c):
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    def lum(rgb):
        r, g, bb = (lin(x) for x in rgb)
        return 0.2126 * r + 0.7152 * g + 0.0722 * bb
    l1, l2 = sorted((lum(a), lum(b)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def enemy_contrast(colors: list[dict]) -> dict:
    """Un ennemi doit se détacher des surfaces dominantes du niveau."""
    dominants = colors[:6]
    best, worst = None, None
    for c in colors:
        ratios = [contrast_ratio(c["rgb"], d["rgb"]) for d in dominants]
        score = min(ratios)
        if best is None or score > best[1]:
            best = (c["hex"], score)
        if worst is None or score < worst[1]:
            worst = (c["hex"], score)
    return {
        "meilleure_couleur_ennemi": best[0],
        "contraste_min_garanti": round(best[1], 2),
        "pire_choix": worst[0],
        "note": (
            "viser >= 3.0 de contraste minimum contre les 6 surfaces dominantes"
        ),
    }


def write_palette_png(colors: list[dict], path: str, swatch: int = 64) -> None:
    n = len(colors)
    img = Image.new("RGB", (swatch * n, swatch))
    for i, c in enumerate(colors):
        rgb = tuple(int(v * 255) for v in c["rgb"])
        img.paste(Image.new("RGB", (swatch, swatch), rgb), (i * swatch, 0))
    img.save(path)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--colors", type=int, default=24)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    out_dir = args.out or args.folder
    px, files = load_pixels(args.folder)
    colors = dominant_colors(px, args.colors)
    vp = value_profile(px)
    temp = temperature(colors)
    ec = enemy_contrast(colors)

    spec = {
        "sources": [os.path.basename(f) for f in files],
        "palette": colors,
        "value_profile": vp,
        "temperature": temp,
        "enemy_contrast": ec,
    }

    write_palette_png(colors, os.path.join(out_dir, "palette.png"))
    with open(os.path.join(out_dir, "palette.json"), "w") as f:
        json.dump(spec, f, indent=2)

    report = [
        "=" * 62,
        "CONTRAINTES EXTRAITES DU BOARD",
        "=" * 62,
        f"  Images            {len(files)}",
        f"  Clé              {vp['key']}  (luminance moyenne {vp['mean_luminance']})",
        f"  Contraste         {vp['contrast']}  (ecart-type {vp['std_luminance']})",
        f"  Saturation        {vp['saturation_class']}  ({vp['mean_saturation']})",
        f"  Température       {temp}",
        f"  Part sombre       {vp['dark_share']:.0%}   part claire {vp['light_share']:.0%}",
        "-" * 62,
        "  6 couleurs dominantes",
    ]
    for c in colors[:6]:
        report.append(f"    {c['hex']}   {c['share']:.1%}   lum {c['lum']:.2f}  sat {c['sat']:.2f}")
    report += [
        "-" * 62,
        f"  Couleur ennemi recommandée : {ec['meilleure_couleur_ennemi']}",
        f"  Contraste minimum garanti  : {ec['contraste_min_garanti']}  (viser >= 3.0)",
        f"  A éviter pour un ennemi    : {ec['pire_choix']}",
        "=" * 62,
    ]
    text = "\n".join(report)
    print("\n" + text + "\n")
    with open(os.path.join(out_dir, "value_profile.txt"), "w") as f:
        f.write(text + "\n")


if __name__ == "__main__":
    main()
