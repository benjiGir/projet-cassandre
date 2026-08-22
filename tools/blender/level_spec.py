"""
Spécification des niveaux Zone A / Zone B — PROJET_CASSANDRE.

Données pures (aucune dépendance à `bpy`, comme `kit_spec.py`), consommées
par `build_level.py`. Ce fichier ne prend AUCUNE décision de level design :
chaque coordonnée transcrit littéralement le plan fourni par l'humain
(placement des murs, des spawns, des caisses...). Ce que ce fichier ajoute
n'est que de la MÉCANIQUE : quel module de mur choisir pour un run donné,
sous quelle forme un `wall_run` est décrit pour que `build_level.py` puisse
le tiler automatiquement plutôt que coordonnée par coordonnée.

## Le format `wall_run`

Un mur est un segment de droite le long duquel des `kit_wall_*` s'alignent
bout à bout, plus une direction "vers l'extérieur" qui dit de quel côté de
ce segment l'épaisseur du mur doit s'étendre. C'est la même convention pour
les quatre murs d'un rectangle ET pour une cloison intérieure (ex. le mur
Y=18 de la Zone A, qui sépare la zone principale de l'alcôve — son
"extérieur" est simplement l'alcôve).

    start, end   : coin par coin, en mètres, sur la ligne de la face
                   INTÉRIEURE du mur (celle qui touche le sol jouable) — PAS
                   le centre du mur.
    outward      : vecteur 2D (X, Y) perpendiculaire au run, pointant vers
                   là où l'épaisseur doit s'étendre (donc à l'opposé de
                   l'intérieur).

`build_level.py::plan_wall_run` calcule tout seul l'orientation et le sens de
parcours : aucune pièce individuelle n'est positionnée à la main ici.
"""

from __future__ import annotations

WALL_THICKNESS = 0.25   # kit_spec.WALL_T
WALL_HEIGHT = 5.0        # kit_spec.WALL_H — hauteur surface de vente

# Modules disponibles, du plus grand au plus petit — voir kit_spec.KIT.
WALL_MODULES = [
    (4.0, "kit_wall_4m"),
    (2.0, "kit_wall_2m"),
    (1.0, "kit_wall_1m"),
]


def wall_run(start: tuple[float, float], end: tuple[float, float],
             outward: tuple[float, float], thickness: float = WALL_THICKNESS) -> dict:
    return {"start": start, "end": end, "outward": outward, "thickness": thickness}


# -----------------------------------------------------------------------------
# ZONE A — Parking
# -----------------------------------------------------------------------------

ZONE_A = {
    "name": "zone_a_parking",

    "floor": {"x": (-10.0, 10.0), "y": (-2.0, 22.0), "tile": 4.0},

    "walls": [
        # Sud : X de -10 à 10 (20 m)
        wall_run((-10.0, -2.0), (10.0, -2.0), (0.0, -1.0)),
        # Ouest : Y de -2 à 22 (24 m)
        wall_run((-10.0, -2.0), (-10.0, 22.0), (-1.0, 0.0)),
        # Est : Y de -2 à 22 (24 m)
        wall_run((10.0, -2.0), (10.0, 22.0), (1.0, 0.0)),
        # Nord (Y=18), par morceaux — la brèche X∈[-6,6] est la vitrine,
        # construite à part (voir "vitrine" ci-dessous), PAS un wall_run.
        wall_run((-10.0, 18.0), (-6.0, 18.0), (0.0, 1.0)),
        wall_run((6.0, 18.0), (10.0, 18.0), (0.0, 1.0)),
        # Alcôve derrière la vitrine (Y∈[18,22], X∈[-6,6])
        wall_run((-6.0, 22.0), (6.0, 22.0), (0.0, 1.0)),     # fond
        wall_run((-6.0, 18.0), (-6.0, 22.0), (-1.0, 0.0)),   # flanc ouest, tourné
        wall_run((6.0, 18.0), (6.0, 22.0), (1.0, 0.0)),      # flanc est, tourné
    ],

    # Vitrine sur-mesure : deux bandes pleines, la fente Z∈[1.2,2.0] entre les
    # deux est la ligne de vue dégagée vers l'alcôve (aucun chemin au sol).
    "vitrine": {
        "x": (-6.0, 6.0),
        "y": 18.0,               # face intérieure, même ligne que les wall_run nord
        "thickness": WALL_THICKNESS,
        "bands": [
            {"name": "vitrine_low", "z": (0.0, 1.2)},
            {"name": "vitrine_high", "z": (2.0, 5.0)},
        ],
    },

    "spawn_player": (0.0, 0.0, 0.0),
    "spawn_suits": [
        ("spawn_suit_1", (0.0, 20.0, 0.0)),
    ],

    # Convention "comme avant" (vérifiée sur le prototype remplacé,
    # public/assets/levels/zone_a_parking.glb) : la position est le CENTRE du
    # petit prop, pas un coin — cohérent avec `mesh.getWorldPosition()` lu par
    # `loader.ts::buildUseObject`.
    "use_objects": [
        {"name": "use_crowbar", "center": (2.0, 2.0, 0.15), "size": (0.06, 0.5, 0.06)},
    ],

    "checkouts": None,

    # "Parking" : sun optionnel pertinent, lumière du jour qui filtre par la
    # fente de la vitrine — pas une décision de layout, un choix d'éclairage.
    "lighting": {"sun": True},
}


# -----------------------------------------------------------------------------
# ZONE B — Caisses
# -----------------------------------------------------------------------------

ZONE_B = {
    "name": "zone_b_caisses",

    "floor": {"x": (-12.0, 12.0), "y": (-2.0, 22.0), "tile": 4.0},

    "walls": [
        wall_run((-12.0, -2.0), (12.0, -2.0), (0.0, -1.0)),   # sud
        wall_run((-12.0, 22.0), (12.0, 22.0), (0.0, 1.0)),    # nord
        wall_run((-12.0, -2.0), (-12.0, 22.0), (-1.0, 0.0)),  # ouest
        wall_run((12.0, -2.0), (12.0, 22.0), (1.0, 0.0)),     # est
    ],

    "vitrine": None,

    "checkouts": {
        "piece": "kit_checkout",
        "y": 9.5,
        "x_origins": [-9.0, -4.0, 1.0, 6.0],
    },

    "spawn_player": (0.0, 0.0, 0.0),
    "spawn_suits": [
        ("spawn_suit_1", (-6.0, 18.0, 0.0)),
        ("spawn_suit_2", (0.0, 18.0, 0.0)),
        ("spawn_suit_3", (6.0, 18.0, 0.0)),
    ],

    "use_objects": [],

    # Intérieur, pas de vitrine — pas de sun.
    "lighting": {"sun": False},
}


ZONES = {"a": ZONE_A, "b": ZONE_B}
