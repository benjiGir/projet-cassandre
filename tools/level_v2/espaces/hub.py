"""Espace « hub » (allée centrale).

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_electro as E           # noqa: E402
import lib_rayons as L            # noqa: E402
import lib_wayfinding as W        # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import SEED, _neons, semer
from espaces.coque import SUBDIV_BAKE

# --- Habillage : l'allée centrale (le carrefour) ------------------------------
#
# 12 × 48 m, le seul espace qu'on traverse dans les deux sens à chaque
# aller-retour. Son travail est de dire OÙ ON VA : sans signalétique, un
# carrefour n'est qu'un couloir de plus.

HB_NEON_X = (-4.5, 3.5)
HB_NEON_Y = (46.0, 54.0, 62.0, 72.0, 80.0, 88.0)
HB_NEONS_MORTS = frozenset({(-4.5, 80.0), (3.5, 54.0)})
# Panneaux suspendus aux trois embranchements, lus dans les deux sens.
# `rayon_bazar` est le nom réel du rayon électroménager en grande surface.
HB_DIRECTIONS = ((62.0, "rayon_epicerie", -4.2), (62.0, "rayon_bazar", 2.2),
                 (50.0, "rayon_promos", -1.0), (84.0, "rayon_frais", -1.0))


def _sol_hub(space, coll, col_coll) -> None:
    """Bande centrale plus fine, bordures larges : le sol dessine l'axe de
    circulation avant qu'on ait lu le moindre panneau."""
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    bandes = ((x0, x0 + 3.0, "sol_terrazzo"), (x0 + 3.0, x1 - 3.0, "sol_terrazzo_fin"),
              (x1 - 3.0, x1, "sol_terrazzo"))
    for i, (xa, xb, texture) in enumerate(bandes):
        H.box(f"sol_hub_{i}", (xa, y0, z - bo.EPAISSEUR_SOL, xb, y1, z),
              texture, coll, subdiv=SUBDIV_BAKE)
    H.col_box("sol_hub", (x0, y0, z - bo.EPAISSEUR_SOL, x1, y1, z), col_coll)


def habiller_hub(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    _sol_hub(space, props, col_coll)

    # Estrade du micro d'annonces, aux cotes exactes du blockout : 4 × 4 × 0,50,
    # donc franchissable d'un saut. C'est un point haut, pas un obstacle.
    L.place(E.estrade_micro(), (-2.0, 66.0, z), 0, props, col_coll, "hb_estrade")

    panneaux = 0
    for i, (py, bande, px) in enumerate(HB_DIRECTIONS):
        L.place(E.panneau_direction(bande), (px, py, z + 3.60), 0,
                props, props, f"hb_dir{i}")
        panneaux += 1

    for i, (px, py) in enumerate(((x0 + 0.9, 50.0), (x1 - 1.4, 58.0),
                                  (x0 + 0.9, 76.0), (x1 - 1.4, 84.0))):
        L.place(L.pilier(), (px, py, z), 0, props, col_coll, f"hb_p{i}")

    for i, (px, py) in enumerate(((-4.0, 47.5), (2.5, 88.0))):
        L.place(L.bac_garni(SEED + 800 + i), (px, py, z), 0, props, col_coll, f"hb_bac{i}")
    for i, (px, py, rot) in enumerate(((x0 + 0.8, 70.5, 0), (x1 - 2.0, 62.0, 15))):
        L.place(L.palette_cartons(), (px, py, z), rot, props, col_coll, f"hb_pal{i}")
    for i, (px, py, rot) in enumerate(((-3.0, 56.0, 70), (3.0, 78.0, 250))):
        L.place(L.caddie(), (px, py, z), rot, props, col_coll, f"hb_cd{i}")
    L.place(L.poubelle(), (x1 - 1.2, 45.5, z), 0, props, col_coll, "hb_pou")

    meubles = semer(props, col_coll, "hb_k", (
        ("pottedPlant", -5.0, 52.0, z, 0), ("pottedPlant", 4.0, 60.0, z, 0),
        ("pottedPlant", -5.0, 74.0, z, 0), ("pottedPlant", 4.0, 86.0, z, 0),
        ("loungeSofa", -4.6, 64.0, z, 90), ("trashcan", 4.2, 50.0, z, 0),
    ))
    rampes, lampes = _neons(space, props, logic, HB_NEON_X, HB_NEON_Y,
                            HB_NEONS_MORTS, "hb", doubles=HB_NEON_X)
    W.installer("hub", props)
    return {"panneaux": panneaux, "meubles": meubles, "rampes": rampes, "lampes": lampes}
