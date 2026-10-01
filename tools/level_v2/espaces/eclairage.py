"""Éclairage par défaut et néons de couloir.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_rayons as L            # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import _cle, lampe

# Pas de la grille de lampes d'un espace non habillé. Large exprès : ces lampes
# ne cherchent pas une ambiance, seulement à rendre l'espace lisible en
# attendant son tour.
PAS_LAMPES = 10.0


def eclairage_par_defaut(space, logic) -> int:
    x0, x1 = space.x
    y0, y1 = space.y
    z = (space.z if not space.rampe else max(space.rampe[1], space.rampe[2])) + space.hauteur - 0.8
    nx = max(1, int((x1 - x0) // PAS_LAMPES))
    ny = max(1, int((y1 - y0) // PAS_LAMPES))
    pas_x = (x1 - x0) / (nx + 1)
    pas_y = (y1 - y0) / (ny + 1)
    n = 0
    for i in range(nx):
        for j in range(ny):
            lampe(logic, f"light_{space.id}_{i}_{j}",
                  (x0 + pas_x * (i + 1), y0 + pas_y * (j + 1), z),
                  intensity=7.0, distance=14.0)
            n += 1
    return n


# Pas des rampes de néons d'un couloir, le long de son grand axe.
PAS_NEONS_COULOIR = 8.0


def eclairage_couloir(space, props, logic) -> int:
    """Une rangée de rampes de néons sur l'axe du couloir, chacune avec SA lampe.

    Les couloirs recevaient jusqu'ici `eclairage_par_defaut` : des lampes sans
    luminaire, une lumière qui ne vient de nulle part. Ça ne se remarque pas
    dans une salle garnie, ça saute aux yeux dans 44 m de couloir nu.

    Sur une rampe, les tubes courent EN TRAVERS de la pente : un tube dans le
    sens de la montée crèverait le plafond incliné à un bout et pendrait dans le
    vide à l'autre. Posé en travers, il reste horizontal sur sa longueur, et son
    carter de 34 cm n'est décalé que de quelques centimètres par la pente.
    """
    x0, x1 = space.x
    y0, y1 = space.y
    long_x = space.largeur >= space.profondeur
    longueur = space.largeur if long_x else space.profondeur
    n = max(1, round(longueur / PAS_NEONS_COULOIR))
    tube = 4.0 if min(space.largeur, space.profondeur) >= 6.0 else 2.0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2

    def plafond_en(px: float, py: float) -> float:
        return bo._z_du_sol(space, px, py) + space.hauteur

    poses = 0
    for i in range(n):
        s = (i + 0.5) / n
        px, py = (x0 + s * space.largeur, cy) if long_x else (cx, y0 + s * space.profondeur)
        if space.rampe:
            # En travers de la pente. Cote prise au bord BAS du carter, qui
            # affleure ainsi le plafond au lieu de le traverser.
            en_x = space.rampe[0] == "+x"
            bord = [(px - 0.34, py), (px, py)] if en_x else [(px, py), (px, py + 0.34)]
            ht = min(plafond_en(*p) for p in bord)
            if en_x:
                origine, rot = (px, py - tube / 2, ht - 0.18), 90
            else:
                origine, rot = (px - tube / 2, py, ht - 0.18), 0
        else:
            ht = plafond_en(px, py)
            if long_x:
                origine, rot = (px - tube / 2, py - 0.17, ht - 0.18), 0
            else:
                origine, rot = (px + 0.17, py - tube / 2, ht - 0.18), 90
        L.place(L.neon(tube), origine, rot, props, props, _cle(f"{space.id}_n", px, py))
        lampe(logic, "light_" + _cle(space.id, px, py), (px, py, ht - 0.65),
              intensity=7.0, distance=14.0)
        poses += 1
    return poses
