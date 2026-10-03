"""Toilettes (sanitaires utilisables).

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

import math

import bpy
from mathutils import Matrix

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_bureaux as B           # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import _emprise, _neons, poser
from espaces.coque import COQUE, EPAISSEUR_PLAFOND

# --- Habillage : les toilettes de la cafétéria --------------------------------
#
# Demandées le 2026-09-24 (« il manque une vraie salle pour les toilettes ») :
# jusque-là, le +1 PV du plan tenait dans un cube `use_toilet` flottant au milieu
# de la cafétéria. Une salle carrelée derrière une porte « WC » : trois cabines
# au nord, deux lavabos au sud, deux urinoirs à l'est.
#
# Passe suivante, MÊME JOUR : les cuvettes et les urinoirs deviennent
# `sanitaire_*`, utilisables et cassables façon Duke Nukem 3D (contrat détaillé
# dans `tools/blender/README.md#sanitaires`) — la plaque de chasse d'eau
# (`wc_plaque_chasse`) redevient un simple décor, un `use_*` posé à côté d'un
# `sanitaire_*` lui aurait volé la portée d'usage.

WC_CABINES_X = 60.0                        # bord ouest de la première cabine
WC_CABINE_L, WC_CABINE_P = 1.25, 1.75      # largeur, profondeur depuis le mur nord
WC_PORTE_CABINE = 0.8
WC_CLOISON = 0.04
# Les cloisons de cabine s'arrêtent à 15 cm du sol : c'est à ça qu'on les
# reconnaît. Leurs COLLIDERS, eux, descendent jusqu'au sol — un proxy qui flotte
# est ce que `audit_niveau.py` appelle un objet flottant — et font 12 cm
# d'épaisseur : `validate_level.py` exige 10 cm contre le tunneling, et à 10 cm
# pile l'arrondi flottant le fait échouer.
WC_CLOISON_BAS, WC_CLOISON_HAUT = 0.15, 2.15
WC_COLLIDER_MIN = 0.12
WC_STRATIFIE = "#237978"                   # le vert d'eau des cabines de toilettes publiques
WC_URINOIRS_Y = (9.5, 11.0)
WC_NEONS_X, WC_NEONS_Y = (58.25, 61.25), (8.0,)
WC_NEONS_MORTS = frozenset({(61.25, 8.0)})  # un tube grillé au-dessus des urinoirs


def _vantail_entrouvert(nom: str, charniere, largeur: float, angle_deg: float,
                        z0: float, z1: float, props) -> None:
    """Porte de cabine ouverte vers l'intérieur. La rotation est FIGÉE dans le
    mesh et l'objet reste à l'origine, sur la grille — comme tout ce que pose
    `L.place`."""
    hx, hy = charniere
    obj = H.box(nom, (0.0, -0.015, z0, largeur, 0.015, z1), "palette", props, uv=f"aplat:{WC_STRATIFIE}")
    obj.data.transform(Matrix.Translation((hx, hy, 0.0)) @ Matrix.Rotation(math.radians(angle_deg), 4, "Z"))


def _collider_epaissi(nom: str, b, z_sol: float, col_coll) -> None:
    """Proxy d'une paroi mince : posé au sol, élargi à `WC_COLLIDER_MIN` sur son
    axe le plus mince, centré sur elle."""
    x0, y0, _, x1, y1, z1 = b
    if x1 - x0 < y1 - y0:
        c = (x0 + x1) / 2
        x0, x1 = min(x0, c - WC_COLLIDER_MIN / 2), max(x1, c + WC_COLLIDER_MIN / 2)
    else:
        c = (y0 + y1) / 2
        y0, y1 = min(y0, c - WC_COLLIDER_MIN / 2), max(y1, c + WC_COLLIDER_MIN / 2)
    H.col_box(nom, (x0, y0, z_sol, x1, y1, z1), col_coll)


# PV d'un `sanitaire_*` cassable (2026-09-24, contrat runtime partagé avec le
# loader/`SanitaireSystem`, écrit en parallèle). Choisi contre
# `src/game/player/weapons/weaponConfig.ts::damageForWeapon` : un coup de pied-de-biche
# (`meleeDamage` = 40) ne casse PAS la faïence d'un coup, il en faut deux
# (2 × 40 = 80) ; un coup de pompe à bout portant, où les neuf plombs du cône de
# 5° convergent tous sur une cible aussi proche (9 × `shotgunDamagePerPellet` =
# 9 × 6 = 54), casse en un seul tir. 50 tient entre les deux.
SANITAIRE_PV = 50


def _rendre_sanitaire(nom_pose: str, nom_final: str, sorte: str) -> None:
    """Renomme une copie posée par `poser`/`L.place` en `sanitaire_<sorte>` et
    lui donne ses extras (`sorte`, `pv`).

    Contrairement à un meuble ordinaire, un `sanitaire_*` ne garde AUCUN
    `col_box` jumeau : le loader en construit un lui-même, fixe, sur sa bbox
    monde (même logique que pour un `prop_*`, sauf que celui-ci ne bouge
    jamais). C'est pour ça que `MEUBLES["toilet"]` porte `collider=False` —
    sans quoi `L.place` aurait copié un `col_box_toilet_<suffixe>` que
    personne ne renomme ni ne retire ici.
    """
    obj = bpy.data.objects[nom_pose]
    obj.name = nom_final
    obj["sorte"] = sorte
    obj["pv"] = SANITAIRE_PV


def habiller_toilettes(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    t = bo.EPAISSEUR_MUR
    est, sud, nord = x1 - t, y0 + t, y1 - t
    yf = nord - WC_CABINE_P                     # la ligne des portes de cabine
    e = WC_CLOISON / 2
    xs = [WC_CABINES_X + i * WC_CABINE_L for i in range(3)]

    # Plafond de plâtre peint, monté comme un MUR (`bo.boite`) : il porte ainsi
    # l'attribut `Col` des murs et se fond au chargement dans le lot de plâtre que
    # la cellule a déjà — le mur est de la cafétéria. En dalles, ou sans `Col`, il
    # coûtait un lot de dessin à lui seul (mesuré : 4 lots pour la salle, ramenés
    # à 2 avec le sol carrelé).
    bo.boite("plafond_toilettes", (x0, y0, z + space.hauteur),
             (space.largeur, space.profondeur, EPAISSEUR_PLAFOND),
             "mur", {"mur": H.textured_material(COQUE[space.id][2])}, props, None, avec_collider=False)

    # Cabines : une cloison à l'ouest de chacune (la dernière s'appuie sur le mur
    # est), une façade percée de trois portes, une lisse d'acier par-dessus.
    cloisons = [(sx - e, yf + e, z + WC_CLOISON_BAS, sx + e, nord, z + WC_CLOISON_HAUT) for sx in xs]
    bords = [xs[0] - e] + [v for sx in xs for v in (sx + 0.225, sx + 0.225 + WC_PORTE_CABINE)] + [est]
    cloisons += [(a, yf - e, z + WC_CLOISON_BAS, b, yf + e, z + WC_CLOISON_HAUT)
                 for a, b in zip(bords[::2], bords[1::2])]
    H.boxes("wc_cloisons", [(c, f"aplat:{WC_STRATIFIE}") for c in cloisons], "palette", props)
    for i, c in enumerate(cloisons):
        _collider_epaissi(f"wc_cloison{i}", c, z, col_coll)
    H.box("wc_lisse", (xs[0] - e, yf - 0.03, z + WC_CLOISON_HAUT, est, yf + 0.03, z + WC_CLOISON_HAUT + 0.04),
          "metal_bac_acier", props)

    # La première cabine est ouverte — la chasse d'eau y est —, la deuxième
    # fermée, avec des chaussures qui dépassent dessous, la troisième ouverte.
    for i, sx in enumerate(xs):
        a = sx + 0.225
        if i == 1:
            porte = (a + 0.005, yf - 0.015, z + WC_CLOISON_BAS, a + WC_PORTE_CABINE - 0.005, yf + 0.015, z + 2.0)
            H.box("wc_porte_fermee", porte, "palette", props, uv=f"aplat:{WC_STRATIFIE}")
            _collider_epaissi("wc_porte_fermee", porte, z, col_coll)
        else:
            _vantail_entrouvert(f"wc_porte{i}", (a + 0.005, yf), WC_PORTE_CABINE - 0.01, 70.0,
                                z + WC_CLOISON_BAS, z + 2.0, props)
    # Cuir marron et non noir : des chaussures noires disparaissent dans les
    # cases noires du damier (constaté en rendu).
    cx = xs[1] + WC_CABINE_L / 2
    H.boxes("wc_chaussures", [((cx - 0.17, yf - 0.10, z, cx - 0.06, yf + 0.18, z + 0.09), "aplat:#654933"),
                              ((cx + 0.06, yf - 0.10, z, cx + 0.17, yf + 0.18, z + 0.09), "aplat:#654933")],
            "palette", props)

    lx, ly, _ = _emprise(B.meuble("toilet"))
    for i, sx in enumerate(xs):
        poser(B.meuble("toilet"), sx + (WC_CABINE_L - lx) / 2, nord - ly, z, "-y", props, col_coll,
              f"wc_cuvette{i}")
        _rendre_sanitaire(f"mob_k_toilet_wc_cuvette{i}", f"sanitaire_cuvette{i}", "cuvette")
    # La plaque de chasse d'eau, au-dessus du réservoir de la première cabine.
    # DÉCOR pur depuis le 2026-09-24 (`wc_plaque_chasse`, plus un `use_*`) : un
    # `use_*` passe AVANT un `sanitaire_*` au test de portée du joueur et
    # volerait l'appui sur E à la cuvette juste à côté — le soin façon Duke
    # (« +10 PV en se soulageant ») vient maintenant de `sanitaire_cuvette0`
    # elle-même, lue par le système qui gère `sanitaire_*` (hors scope ici).
    # Centrée SUR la face du mur, comme les lecteurs de carte : son origine reste
    # sur la grille.
    rx, ry = next((r[1], r[2]) for r in space.reperes if "toilettes" in r[0])
    H.box("wc_plaque_chasse", (rx - 0.125, ry - 0.04, z + 1.15, rx + 0.125, ry + 0.04, z + 1.35),
          "metal_bac_acier", props)

    # Lavabos et miroirs contre le mur sud, poubelle, sèche-mains.
    mx, _, _ = _emprise(B.meuble("bathroomMirror"))
    for i, lav_x in enumerate((57.0, 58.5)):
        bx0, _, bx1, _ = poser(B.meuble("bathroomSink"), lav_x, sud, z, "+y", props, col_coll, f"wc_lavabo{i}")
        poser(B.meuble("bathroomMirror"), (bx0 + bx1) / 2 - mx / 2, sud, z + 1.15, "+y", props, col_coll,
              f"wc_miroir{i}")
    poser(B.meuble("trashcan"), 59.75, sud, z, "+y", props, col_coll, "wc_poubelle")
    H.box("wc_seche_mains", (60.25, sud, z + 1.2, 60.55, sud + 0.2, z + 1.5), "metal_bac_acier", props)

    # Urinoirs contre le mur est : la cuvette, sa lèvre 2 cm devant (jamais à
    # fleur). Chacun est son propre `sanitaire_urinoir<i>` (UN mesh, UN
    # matériau — cuvette + lèvre, sans la descente d'eau ni la séparation :
    # le jet d'eau du jeu part du bas-centre de la bbox de l'appareil, qui
    # doit donc être celle de la cuvette seule). La descente d'eau et la
    # séparation entre les deux appareils restent du DÉCOR (`wc_tuyaux`,
    # `wc_urinoir_separation`), jamais cassables.
    tuyaux = []
    for i, uy in enumerate(WC_URINOIRS_Y):
        cuvette = (est - 0.33, uy - 0.2, z + 0.55, est, uy + 0.2, z + 1.15)
        levre = (est - 0.35, uy - 0.15, z + 0.60, est - 0.30, uy + 0.15, z + 0.72)
        obj = H.boxes(f"sanitaire_urinoir{i}",
                      [(cuvette, "aplat:#f2efe6"), (levre, "aplat:#a2a3a1")], "palette", props)
        obj["sorte"] = "urinoir"
        obj["pv"] = SANITAIRE_PV
        tuyaux.append(((est - 0.06, uy - 0.015, z + 1.15, est - 0.03, uy + 0.015, z + 1.45), "world"))
    ym = sum(WC_URINOIRS_Y) / 2
    H.box("wc_urinoir_separation", (est - 0.45, ym - e, z + 0.5, est, ym + e, z + 1.4), "palette", props,
          uv=f"aplat:{WC_STRATIFIE}")
    H.boxes("wc_tuyaux", tuyaux, "metal_bac_acier", props)

    rampes, lampes = _neons(space, props, logic, WC_NEONS_X, WC_NEONS_Y, WC_NEONS_MORTS, "wc")
    return {"cabines": len(xs), "lavabos": 2, "urinoirs": len(WC_URINOIRS_Y),
            "rampes": rampes, "lampes": lampes}
