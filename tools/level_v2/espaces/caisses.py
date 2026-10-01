"""Espace « caisses ».

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_facade as F            # noqa: E402
import lib_rayons as L            # noqa: E402
import lib_checkouts as K         # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import SEED, _neons, semer
from espaces.coque import SUBDIV_BAKE

# --- Habillage : la ligne de caisses -----------------------------------------
#
# Premier combat : six travées longitudinales, un passage central et des
# files latérales. Le modèle et ses proxies viennent de `lib_checkouts`.

CS_CAISSES_Y = 32.0
CS_CAISSES_X = K.LANES
# Néons : au-dessus des dégagements, jamais au-dessus de la ligne de caisses.
CS_NEON_X = (-22.0, -11.0, 0.0, 11.0, 22.0)
CS_NEON_Y = (22.0, 28.0, 36.0, 41.0)
CS_NEONS_MORTS = frozenset({(-22.0, 41.0), (22.0, 22.0), (0.0, 41.0)})


def _sol_caisses(space, coll, col_coll) -> None:
    """Deux dalles : terrazzo au sud, dans la continuité de la galerie d'où
    l'on arrive, carrelage blanc au nord une fois la ligne franchie. Le
    changement de sol dit « tu es entré dans le magasin » sans un panneau."""
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    coupe = CS_CAISSES_Y
    for i, (ya, yb, texture) in enumerate(((y0, coupe, "sol_terrazzo"),
                                           (coupe, y1, "sol_carrelage_blanc"))):
        H.box(f"sol_caisses_{i}", (x0, ya, z - bo.EPAISSEUR_SOL, x1, yb, z),
              texture, coll, subdiv=SUBDIV_BAKE)
    H.col_box("sol_caisses", (x0, y0, z - bo.EPAISSEUR_SOL, x1, y1, z), col_coll)


def habiller_caisses(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    _sol_caisses(space, props, col_coll)

    K.install(props, col_coll, z)

    # La paire antivol et le panneau central font partie du nouveau module.
    portiques = 1

    # File de caddies contre le mur ouest, près de l'entrée.
    L.place(F.rail_caddies(), (x0 + 1.5, y0 + 1.5, z), 90, props, col_coll, "cs_rail")
    caddies = 0
    for i, dy in enumerate((0.2, 1.15, 2.10, 3.05)):
        L.place(L.caddie(), (x0 + .5, y0 + 1.8 + dy, z), 0, props, col_coll, f"cs_cd{i}")
        caddies += 1

    # Têtes de gondole promo aux deux bouts de la ligne : elles ferment la
    # perspective et donnent une couleur à un espace autrement très blanc.
    for i, (px, py, rot) in enumerate(((x0 + 0.5, CS_CAISSES_Y + 6.5, 0), (x1 - 1.75, CS_CAISSES_Y + 6.5, 0))):
        L.place(L.tete_garnie(SEED + 700 + i), (px, py, z), rot, props, col_coll, f"cs_tete{i}")

    # Bacs promo dans le dégagement sud, là où l'on ralentit en entrant.
    for i, (px, py) in enumerate(((-16.0, 24.0), (12.0, 24.0))):
        L.place(L.bac_garni(SEED + 720 + i), (px, py, z), 0, props, col_coll, f"cs_bac{i}")
    for i, (px, py) in enumerate(((-13.0, 22.5), (13.5, 22.5))):
        L.place(L.presentoir_garni(SEED + 740 + i), (px, py, z), 0, props, col_coll, f"cs_pres{i}")

    for i, (px, py) in enumerate(((x0 + 0.8, y1 - 1.5), (x1 - 1.3, y0 + 0.8))):
        L.place(L.poubelle(), (px, py, z), 0, props, col_coll, f"cs_pou{i}")

    # Les présentoirs bas des travées portent désormais les achats d'impulsion.
    ilots = 0
    for i, (px, py, rot) in enumerate(((x0 + 3.0, y0 + 6.0, 0), (x1 - 4.0, y0 + 5.0, 20))):
        L.place(L.palette_cartons(), (px, py, z), rot, props, col_coll, f"cs_pal{i}")

    # Caddies abandonnés dans le dégagement sud et entre deux caisses.
    for i, (px, py, rot) in enumerate(K.CARTS):
        L.place(L.caddie(), (px, py, z), rot, props, col_coll, f"cs_cdl{i}")
        caddies += 1

    # Enseignes : « SOLDES » au-dessus de la ligne, visible de toute la salle,
    # et « SORTIE » au-dessus de la trouée sud par laquelle on est entré.
    L.place(F.enseigne_murale("soldes"), (-1.5, y1 - 0.3, z + 3.2), 180, props, props, "cs_soldes")
    L.place(F.enseigne_murale("sortie"), (-1.5, y0 + 0.35, z + 2.6), 0, props, props, "cs_sortie")

    semer(props, col_coll, "cs_k", (
        ("pottedPlant", -25.0, 22.0, z, 0), ("pottedPlant", 24.5, 22.0, z, 0),
        ("pottedPlant", -25.0, 40.0, z, 0), ("pottedPlant", 24.5, 42.5, z, 0),
    ))

    rampes, lampes = _neons(space, props, logic, CS_NEON_X, CS_NEON_Y, CS_NEONS_MORTS,
                            "cs", doubles=CS_NEON_X)
    return {"caisses": len(CS_CAISSES_X), "portiques": portiques, "caddies": caddies,
            "ilots": ilots, "rampes": rampes, "lampes": lampes}
