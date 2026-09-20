"""Ciel de nuit du parking : une cubemap de six faces 256 px.

    ./.venv-refs/bin/python3 tools/textures/generate_ciel.py

Écrit `public/assets/sky/nuit/{px,nx,py,ny,pz,nz}.png`, lus tels quels par
`src/render/ciel.ts` (convention de face OpenGL, celle de `CubeTextureLoader`).

Chaque pixel est calculé depuis SA direction dans le monde, pas depuis sa place
dans la face : le dégradé, l'horizon et les silhouettes se raccordent donc d'une
face à l'autre sans couture, ce qu'aucun dessin face par face ne garantit.

Le parti pris est celui des ciels du Build engine : peu de couleurs, une trame
ordonnée au lieu d'un dégradé lisse, et une ligne d'horizon qui raconte où l'on
est. Ici, une ville de province la nuit : halo orangé des lampadaires au ras de
l'horizon, un château d'eau, une ligne haute tension, l'antenne relais avec son
feu rouge — et une lune fermée par une fermeture éclair, celle des piles « Lune
truquée » du rayon bazar. Une seule fois dans le ciel, jamais assez grosse pour
que la blague s'use.

Déterministe : aucune graine aléatoire, tout vient de fonctions de la direction.
"""

import math
import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "assets", "sky", "nuit")
N = 256


def hexc(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


# Rampe du ciel, du zénith à l'horizon. Huit teintes : la trame fait le reste.
RAMPE = [hexc(c) for c in ("#07091a", "#0b1026", "#111834", "#1a2142",
                           "#2a2a48", "#4a3444", "#7a4a3c", "#a8663a")]
SILHOUETTE = hexc("#08080c")
SOL = hexc("#0c0c10")
ETOILE = (hexc("#9aa2c0"), hexc("#e8ecf8"))
LUNE, LUNE_OMBRE, ZIP = hexc("#e2dcc4"), hexc("#b8b098"), hexc("#5a5448")
FENETRE, FEU_ROUGE, LAMPADAIRE = hexc("#e8c060"), hexc("#ff2a1a"), hexc("#ffb050")

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def direction(face: str, x: int, y: int) -> tuple[float, float, float]:
    """Convention OpenGL des cubemaps, image lue de haut en bas."""
    u = 2 * (x + 0.5) / N - 1
    v = 2 * (y + 0.5) / N - 1
    d = {"px": (1, -v, -u), "nx": (-1, -v, u), "py": (u, 1, v),
         "ny": (u, -1, -v), "pz": (u, -v, 1), "nz": (-u, -v, -1)}[face]
    n = math.sqrt(sum(c * c for c in d))
    return tuple(c / n for c in d)


def hauteur_ligne(az: float) -> float:
    """Élévation (degrés) de la ligne d'horizon construite à cet azimut."""
    deg = math.degrees(az) % 360
    # Lisière d'arbres et toits bas : quelques harmoniques, pas de bruit.
    h = 1.2 + 0.7 * math.sin(az * 7) + 0.5 * math.sin(az * 13 + 1.3) + 0.35 * math.sin(az * 29 + 0.4)
    # Château d'eau : un pied, puis une cuve.
    if 40 <= deg <= 40.8:
        h = max(h, 6.0)
    if 38.6 <= deg <= 42.2:
        h = max(h, 8.4 - ((deg - 40.4) / 1.8) ** 2 * 1.2)
    # Deux pylônes et la ligne entre eux.
    for centre in (118.0, 146.0):
        e = abs(deg - centre)
        if e < 1.6:
            h = max(h, 7.0 - e * 3.2)
    if 118 <= deg <= 146:
        t = (deg - 118) / 28
        h_cable = 6.3 - 1.4 * math.sin(math.pi * t)
        h = max(h, h_cable) if abs(h_cable - h) < 0.12 else h
    # Antenne relais, fine et haute.
    if 251.6 <= deg <= 252.2:
        h = max(h, 11.0)
    # Barre d'immeubles au loin, pour les fenêtres allumées.
    if 300 <= deg <= 326:
        h = max(h, 4.6)
    return h


def est_cable(az: float, el: float) -> bool:
    deg = math.degrees(az) % 360
    if not 118 <= deg <= 146:
        return False
    t = (deg - 118) / 28
    return abs(el - (6.3 - 1.4 * math.sin(math.pi * t))) < 0.10


def pixel(face: str, x: int, y: int) -> tuple[int, int, int]:
    dx, dy, dz = direction(face, x, y)
    el = math.degrees(math.atan2(dy, math.hypot(dx, dz)))
    az = math.atan2(dx, -dz)
    deg = math.degrees(az) % 360

    if el < 0:
        # Sous l'horizon : la ville au loin, quelques lampadaires.
        if el > -2.5 and (int(deg * 7) % 23 == 0) and y % 3 == 0:
            return LAMPADAIRE
        return SOL

    ligne = hauteur_ligne(az)
    if el <= ligne or est_cable(az, el):
        if 251.6 <= deg <= 252.2 and 10.2 <= el <= 11.0:
            return FEU_ROUGE
        if 300 <= deg <= 326 and 1.0 < el < 4.2 and int(deg * 3) % 2 == 0 and int(el * 2.2) % 2 == 0 \
                and (int(deg * 3) * 7 + int(el * 2.2) * 3) % 5 < 2:
            return FENETRE
        return SILHOUETTE

    # Lune : un disque, deux cratères, et la fermeture éclair.
    lune_az, lune_el, rayon = math.radians(205), 31.0, 5.2
    dl = math.degrees(math.acos(max(-1.0, min(1.0,
        math.cos(math.radians(el)) * math.cos(math.radians(lune_el)) * math.cos(az - lune_az)
        + math.sin(math.radians(el)) * math.sin(math.radians(lune_el))))))
    if dl < rayon:
        # Repère local du disque : du = vers l'est, dv = vers le haut, en degrés.
        du = math.degrees(math.atan2(math.sin(az - lune_az), 1)) * math.cos(math.radians(el))
        dv = el - lune_el
        if abs(du) < 0.45 and abs(dv) < rayon * 0.85:
            dent = int((dv + 10) * 3.2) % 2
            if abs(du) < 0.15 or (dent and abs(du) < 0.45):
                return ZIP
        for cu, cv, cr in ((-2.2, 1.6, 1.3), (1.9, -1.8, 0.9), (2.4, 2.2, 0.6)):
            if (du - cu) ** 2 + (dv - cv) ** 2 < cr * cr:
                return LUNE_OMBRE
        return LUNE

    # Étoiles : une grille régulière sur la DIRECTION (pas en azimut/élévation,
    # dont les cellules se resserrent au zénith et y dessinaient des spirales),
    # une cellule sur cent soixante porte une étoile, jamais dans le halo.
    if el > 9:
        cx, cy, cz = (int(math.floor(c * 90)) for c in (dx, dy, dz))
        h = ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) & 0xFFFFF
        if h % 160 == 0:
            return ETOILE[1] if h % 5 == 0 else ETOILE[0]

    # Dégradé tramé : l'élévation choisit entre deux teintes voisines de la
    # rampe, la matrice de Bayer décide laquelle.
    t = 1.0 - min(1.0, el / 55.0) ** 0.55
    pos = t * (len(RAMPE) - 1)
    i = int(pos)
    frac = pos - i
    seuil = (BAYER[y % 4][x % 4] + 0.5) / 16
    return RAMPE[min(i + (1 if frac > seuil else 0), len(RAMPE) - 1)]


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for face in ("px", "nx", "py", "ny", "pz", "nz"):
        img = Image.new("RGB", (N, N))
        px = img.load()
        for y in range(N):
            for x in range(N):
                px[x, y] = pixel(face, x, y)
        img.save(os.path.join(OUT, f"{face}.png"), optimize=True)
    print(f"[ciel] six faces {N} px écrites dans {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
