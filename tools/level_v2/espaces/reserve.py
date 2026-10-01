"""Espace « réserve » et son quai.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_backstage_route as BR
import lib_helpers as H           # noqa: E402
import lib_reserve as R           # noqa: E402
import lib_rayons as L            # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import _cle, lampe
from espaces.coque import SUBDIV_BAKE

# --- Habillage : la réserve ---------------------------------------------------
#
# 44 × 36 m sous 8 m de plafond, la pièce la plus haute du niveau. Ses racks de
# 6 m sont le SEUL vrai couvert du jeu (ADR 0025) et le plan y pose sept
# Costards : c'est le gros combat. Cotes des volumes gris du blockout, à
# l'unité près — y compris la plateforme et sa rampe, qui ne sont pas du décor
# avec une circulation au sol vers le personnel.

# (x du bord ouest, y du départ, longueur). Le rack occupe 1,5 m de large.
# Longueurs bornées par le quai : un rack qui commence à y=118 ne peut pas
# faire 10 m sans entrer dans la plateforme (y ≥ 123).
RS_RACKS = ((-16.0, 100.0, 14.0), (-22.0, 118.0, 4.0),
            (4.0, 100.0, 14.0), (4.0, 118.0, 4.0))
RS_PLATEFORME_Y = 123.0            # quai surélevé, z = +3,0
RS_RAMPE_X = (-16.0, -4.0)
RS_PLATEFORME_X = (-24.0, -4.0)
RS_RAMPE_Y = (115.0, 123.0)
# Suspensions industrielles : au-dessus des ALLÉES, jamais au-dessus d'un rack
# de 6 m — même règle que les néons de la surface de vente, pour la même
# raison (la lumière doit arriver de biais sur les faces de rack).
RS_SUSPENSIONS = tuple((x, y) for x in (-20.0, -5.0, 12.0)
                       for y in (100.0, 108.0, 116.0, 127.0))
RS_SUSPENSIONS_MORTES = frozenset({(-20.0, 116.0), (12.0, 100.0)})


def habiller_reserve(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    materiaux = gris

    for i, (rx, ry, longueur) in enumerate(RS_RACKS):
        # `rot 90` fait courir la longueur du rack le long de +y ; l'origine
        # passe donc au bord EST de son emprise.
        L.place(R.rack_palettes(longueur, 6.0, 1 + i % 3), (rx + 1.5, ry, z), 90,
                props, col_coll, f"rs_rk{i}")

    # Plateforme de quai, PLEINE (pas une mezzanine sur pilotis) : deux sols
    # praticables dans la même colonne casseraient le pathfinding 2.5D. Reprise
    # à l'identique du blockout, texture de béton en plus.
    px0, px1 = RS_PLATEFORME_X
    py0 = RS_PLATEFORME_Y
    H.box("plateforme_rs", (px0, py0, z, px1, y1 - 0.25, z + 3.0),
          "sol_beton", props, subdiv=SUBDIV_BAKE)
    H.col_box("plateforme_rs", (px0, py0, z, px1, y1 - 0.25, z + 3.0), col_coll)
    H.box("plateforme_rs_chant", (px0, py0 - 0.06, z + 2.55, px1, py0, z + 3.0),
          "trim_hypermarche", props, uv="trim:bord_quai")
    garde = [((px1 - .16, y, z + 3, px1 - .08, y + .08, z + 3.95), "world")
             for y in (123.2, 127.2, 131.5)]
    garde += [((px1 - .16, 123.2, z + h, px1 - .08, 131.58, z + h + .06), "world")
              for h in (3.45, 3.89)]
    H.boxes("rs_garde_quai", garde, "metal_bac_acier", props)
    H.col_box("rs_garde_quai", (px1 - .16, 123.2, z + 3, px1 - .08, 131.58, z + 3.95), col_coll)

    # La rampe dessert le quai ouest, hors de la circulation du personnel.
    bo.pente("rampe_plateforme_rs", RS_RAMPE_X, RS_RAMPE_Y, z, z + 3.0, "+y",
             materiaux, props, col_coll)

    # Un camion de livraison à quai. C'est ce qui explique le quai : sans
    # véhicule, une plateforme surélevée n'est qu'une estrade. Posé sur la
    # plateforme, reculé contre une porte.
    placer_camion_reserve(space, props, col_coll)

    # Portes de quai sur le mur nord, au-dessus de la plateforme.
    portes = 0
    for i, dx in enumerate((-19.0, -11.0)):
        L.place(R.porte_quai(3.0), (dx, y1 - 0.55, z + 3.0), 0, props, props, f"rs_pq{i}")
        portes += 1

    # Réassort au sol : palettes filmées, fûts, transpalettes. Les deux
    # dernières sont SUR le quai (y ≥ 123) : posées à z, elles étaient prises
    # dans les 3 m de la plateforme.
    for i, (ax, ay, rot) in enumerate(((-21.5, 102.0, 0), (-21.5, 104.0, 12),
                                       (17.0, 112.0, 0), (-2.0, 100.5, 25),
                                       (-6.5, 128.0, 0), (-22.0, 126.0, 8))):
        az = z + 3.0 if ay >= RS_PLATEFORME_Y else z
        L.place(L.palette_cartons(), (ax, ay, az), rot, props, col_coll, f"rs_pal{i}")
    futs = 0
    for i, (fx, fy) in enumerate(((-22.0, 116.0), (-21.2, 116.7), (-22.1, 117.4),
                                  (18.5, 120.0), (17.7, 120.7))):
        L.place(R.fut(i % 2), (fx, fy, z), 0, props, col_coll, f"rs_fut{i}")
        futs += 1
    for i, (tx, ty, rot) in enumerate(((-6.0, 106.0, 20), (15.0, 124.0, 200))):
        L.place(R.transpalette(), (tx, ty, z), rot, props, col_coll, f"rs_tp{i}")
    L.place(R.extincteur(), (x0 + 0.3, 110.0, z + 1.1), 270, props, props, "rs_ext")

    # Suspensions industrielles. Un plafond de néons encastrés n'existe pas
    # sous 8 m ; ce qui éclaire une réserve, ce sont des luminaires isolés qui
    # laissent des trous d'ombre entre eux — et ces trous sont du gameplay.
    ht = z + space.hauteur
    lampes = 0
    for sx, sy in RS_SUSPENSIONS:
        L.place(R.suspension(0), (sx, sy, ht - 2.40), 0, props, props,
                _cle("rs_su", sx, sy))
        if (sx, sy) in RS_SUSPENSIONS_MORTES:
            continue
        lampe(logic, "light_" + _cle("rs", sx, sy), (sx + 0.30, sy + 0.30, ht - 2.20),
              color="#e8f0ff", intensity=13.0, distance=17.0)
        lampes += 1

    BR.installer("reserve", props)
    return {"racks": len(RS_RACKS), "portes_quai": portes, "futs": futs,
            "suspensions": len(RS_SUSPENSIONS), "lampes": lampes}


def placer_camion_reserve(space, props, col_coll):
    asset, _bounds = R.voiture_proposition("camion")
    # Le hayon arrière (-Y du modèle) fait face au quai nord.
    return L.place(asset, (-11.0, space.y[1] - 0.9, space.z + 3.0),
                   180, props, col_coll, "rs_camion")
