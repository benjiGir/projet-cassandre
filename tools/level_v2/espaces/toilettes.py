"""Toilettes publiques : cabines accessibles et équipements détaillés.

see: docs/4-technique/equipements-sanitaires.md
"""
from espaces import chemins  # noqa: F401

import lib_helpers as H
import lib_restrooms as R
import build_blockout as bo

from espaces.commun import _neons
from espaces.coque import EPAISSEUR_PLAFOND

WC_NEONS_X, WC_NEONS_Y = (58.25, 61.25), (8.0,)
WC_NEONS_MORTS = frozenset({(61.25, 8.0)})


def habiller_toilettes(space, gris, props, col_coll, logic) -> dict:
    bo.boite("plafond_toilettes", (space.x[0], space.y[0], space.z + space.hauteur),
             (space.largeur, space.profondeur, EPAISSEUR_PLAFOND),
             "mur", {"mur": H.textured_material("mur_platre")}, props, None, avec_collider=False)
    report = R.build(props, col_coll)
    rampes, lampes = _neons(space, props, logic, WC_NEONS_X, WC_NEONS_Y, WC_NEONS_MORTS, "wc")
    return {**report,"rampes":rampes,"lampes":lampes}
