"""Mobilier physique (`prop_*`).

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402


# --- Mobilier physique (`prop_*`) --------------------------------------------
#
# Le seul décor du niveau qui BOUGE. Posé ici, pour TOUS les espaces d'un coup,
# et pas au fil des habillages : le premier jet en avait mis six, tous dans
# deux espaces à l'écart, et le retour de playtest a été « je n'ai pas trouvé
# de physique ». C'était exact — on pouvait traverser le niveau d'un bout à
# l'autre sans en croiser un seul, le hub (48 m qu'on est OBLIGÉ de parcourir)
# n'en portait aucun.
#
# La règle qui en sort : **un prop doit se trouver sur le chemin, pas dans une
# pièce qu'on peut sauter.** Le parking (le plan lui donne le rôle de
# « tutoriel implicite ») et le hub en portent donc le plus.
#
# BUDGET : un prop visible = un lot de dessin, mesuré. Ce qui compte n'est pas
# le total mais le nombre VU D'UN MÊME POINT — d'où l'étalement sur les dix
# espaces plutôt qu'un tas. Vérifier au panneau de debug après chaque ajout.
# see: docs/decisions/0030-props-dynamiques.md

# taille (dx, dy, dz) · texture · masse (kg) · pv (None = indestructible) · matière
MODELES_PROPS = {
    "carton":       ((0.60, 0.60, 0.50), "carton",           8,   18, "carton"),
    "carton_grand": ((0.90, 0.90, 0.70), "carton",          14,   26, "carton"),
    "caisse":       ((0.80, 0.80, 0.80), "bois_palette",    30,   45, "bois"),
    # Indestructible : il se pousse, il ne se casse pas. Un niveau où TOUT
    # explose n'apprend rien au joueur sur ce qui explose.
    "casier":       ((0.70, 0.50, 0.90), "metal_bac_acier", 55, None, "metal"),
}

# (x, y, modèle) ou (x, y, modèle, étages). Une PILE est ce qui se lit le mieux
# de loin : trois cartons empilés qui s'écroulent quand on les bouscule disent
# « physique » bien plus fort qu'une boîte isolée au sol.
PROPS_PHYSIQUES: dict[str, tuple] = {
    # La pile reste visible près de la voiture au pied-de-biche ; le second
    # ensemble longe l'abri à caddies. L'approche centrale des portes est libre.
    "parking_ext": ((-7.5, -31.5, "carton", 3), (-6.5, -31.5, "carton"),
                    (20.75, -21.5, "caisse"), (20.75, -20.25, "carton_grand")),
    "galerie": ((-12.0, 6.0, "carton", 2), (13.5, 5.0, "caisse"),
                (7.0, 12.5, "carton_grand")),
    "cafeteria": ((36.5, 16.5, "carton", 2), (52.0, 4.0, "casier")),
    # Réassort près des palettes sud, hors des files de caisse.
    "caisses": ((-22.4, 27.35, "carton"), (-21.1, 26.75, "carton_grand", 2),
                (20.5, 27.0, "caisse"), (21.75, 27.25, "carton")),
    # 48 m de couloir : le plus gros lot du niveau, réparti sur toute la
    # longueur et TOUJOURS à x = ±3,5 — le milieu du hub reste franc.
    # Les y sont choisis dans les TROUS de la décoration déjà posée par
    # `habiller_hub` (piliers, bacs, palettes, caddies, plantes) : c'est
    # `audit_niveau.py` qui a tranché, pas l'œil.
    "hub": ((3.5, 53.0, "caisse"), (-3.6, 59.0, "carton", 2),
            (3.6, 67.0, "carton_grand"), (3.4, 73.5, "casier"),
            (-3.4, 81.0, "carton", 3), (-3.6, 90.0, "caisse")),
    # Au centre des allées (cf. RY_NEON_ALLEES), à des y distincts pour qu'on
    # n'en voie jamais deux dans la même enfilade.
    "rayons": ((-43.75, 55.0, "carton"), (-36.25, 67.0, "carton", 2),
               (-21.25, 78.0, "carton"), (-28.75, 61.0, "carton_grand")),
    # Une pile en bout d'îlot et deux cartons près de la palette au sud.
    "electro": ((28.9, 57.95, "carton_grand", 2), (28.9, 56.8, "caisse"),
                (27.5, 49.5, "carton"), (25.9, 50.5, "carton_grand")),
    "reserve": ((-5.0, 102.0, "caisse"), (-5.0, 112.0, "caisse", 2),
                (-19.0, 110.0, "caisse"), (12.0, 104.0, "carton_grand"),
                (14.0, 118.0, "carton", 2)),
    "souterrain": ((32.5, 102.0, "casier"), (48.0, 110.0, "caisse"),
                   (60.0, 96.5, "carton")),
    "bureaux": ((-17.0, 152.0, "carton", 2), (6.5, 157.0, "carton_grand"),
                (-6.0, 163.0, "caisse")),
    # Des cartons d'archives sur le chemin de la porte Or : le couloir est
    # obligatoire, c'est ce qui les rend visibles.
    "c_bu": ((25.0, 134.0, "carton", 3), (34.0, 138.3, "carton_grand")),
}

# Emplacements que le mobilier posé AU HASARD doit éviter (les caddies des
# rayons). Dérivé de la table : une seule source, jamais deux listes à tenir
# d'accord.
RY_CARTONS = tuple((entry[0], entry[1]) for entry in PROPS_PHYSIQUES["rayons"])


def poser_props_physiques(space, coll) -> int:
    """Pose les `prop_*` d'un espace. Rendu SEUL, sans `col_box` jumeau : un
    prop construit son propre collider dynamique au chargement."""
    poses = 0
    for i, entry in enumerate(PROPS_PHYSIQUES.get(space.id, ())):
        x, y, modele = entry[0], entry[1], entry[2]
        etages = entry[3] if len(entry) > 3 else 1
        (dx, dy, dz), texture, masse, pv, matiere = MODELES_PROPS[modele]
        for etage in range(etages):
            z0 = space.z + etage * dz
            H.prop(f"{space.id}{i}_{etage}",
                   (x - dx / 2, y - dy / 2, z0, x + dx / 2, y + dy / 2, z0 + dz),
                   texture, coll, masse=masse, pv=pv, matiere=matiere)
            poses += 1
    return poses
