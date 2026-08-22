"""
Spécification des niveaux Zone A / Zone B / Zone C — PROJET_CASSANDRE.

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


# -----------------------------------------------------------------------------
# ZONE C — Rayons
# -----------------------------------------------------------------------------

ZONE_C = {
    "name": "zone_c_rayons",

    "floor": {"x": (-12.0, 12.0), "y": (-2.0, 26.0), "tile": 4.0},

    "walls": [
        wall_run((-12.0, -2.0), (12.0, -2.0), (0.0, -1.0)),   # sud
        wall_run((-12.0, 26.0), (12.0, 26.0), (0.0, 1.0)),    # nord
        wall_run((-12.0, -2.0), (-12.0, 26.0), (-1.0, 0.0)),  # ouest
        wall_run((12.0, -2.0), (12.0, 26.0), (1.0, 0.0)),     # est
    ],

    "vitrine": None,
    "checkouts": None,

    # Trois rangées de gondoles parallèles à l'axe Y (axe de déplacement
    # principal du joueur, du spawn sud vers le fond nord), créant des allées
    # nord-sud. Chaque rangée : 8 m de kit_gondola_4m (2 pièces, tiling exact,
    # AUCUN reste — si ça ne tombe pas juste, c'est une erreur à signaler
    # comme le fait déjà `wall_remainder` dans build_level.py), avec un
    # kit_gondola_end accolé à CHAQUE extrémité — bloque la vue à TRAVERS une
    # rangée (une allée voisine, un couloir latéral) et occulte réellement
    # `spawn_suit_3`/`spawn_suit_4` depuis le spawn (vérifié en jeu). Ça ne
    # bloque PAS la vue LE LONG d'une allée elle-même : une allée est par
    # construction une ligne droite dégagée d'un bout à l'autre, donc un
    # Costard posé en son centre reste visible dès le spawn qui la regarde
    # en face — voir la correction de `spawn_suits` ci-dessous, qui documente
    # le bug réel que ça a produit.
    #
    # Espacement centre-à-centre 4.25 m entre rangées adjacentes = 1.25 m de
    # profondeur de gondole + 3.0 m d'allée (valeur documentée dans
    # `kit_spec.py::kit_gondola_4m` : "allée de 3 m entre deux gondoles").
    # Rangées à X = -4.25 / 0.0 / 4.25 → deux allées centrales de 3 m entre
    # rangées (combat resserré, "couloir") + deux couloirs latéraux ouverts
    # entre rangée extérieure et mur (~7 m chacun, pour circuler/reculer).
    "gondolas": {
        "piece": "kit_gondola_4m",
        "end_piece": "kit_gondola_end",
        "rows": [
            {"x": -4.25, "y": (8.0, 16.0)},
            {"x": 0.0,   "y": (8.0, 16.0)},
            {"x": 4.25,  "y": (8.0, 16.0)},
        ],
    },

    "spawn_player": (0.0, 0.0, 0.0),
    # PREMIER JET CORRIGÉ (vérifié en jeu, `window.cassandre.suits`) :
    # `spawn_suit_1`/`spawn_suit_2` étaient posés à mi-rangée (Y=12), dans
    # l'axe même de l'allée qu'ils sont censés garder — or une allée est par
    # construction une ligne DROITE et DÉGAGÉE d'un bout à l'autre : depuis
    # `spawn_player`, `hasClearWorldPath` n'est jamais coupé par une rangée
    # de gondoles qui longe l'allée sans jamais la traverser. Résultat mesuré
    # au premier chargement : `spawn_suit_2` était déjà en état `attack` dès
    # le spawn (12.2 m, sous `attackRange`=16 m) — aucune fenêtre d'approche,
    # exactement le défaut déjà corrigé une fois en Zone B
    # (`spawn_suit_2` 15 m → 18 m). Un placement centré dans une allée
    # rectiligne ne peut PAS être cette embuscade masquée par occlusion (la
    # ligne de vue existe par définition dès qu'on regarde dans l'allée) —
    # seule la distance protège la fenêtre d'approche ici, comme en Zone B.
    # Déplacés au-delà des rangées (Y=18, zone ouverte au nord du bloc de
    # gondoles) : 18.1 m, au-delà d'`attackRange` avec la même marge que le
    # fix de Zone B, `chase` et non `attack` au spawn (revérifié en jeu).
    "spawn_suits": [
        ("spawn_suit_1", (-2.125, 18.0, 0.0)),  # sortie de l'allée centrale ouest
        ("spawn_suit_2", (2.125, 18.0, 0.0)),   # sortie de l'allée centrale est
        # Zone dégagée au nord du bloc de gondoles, combat ouvert avant la
        # sortie — à ~21.8 m du spawn, au-delà d'attackRange=16m (voir
        # suitConfig.ts:178), pour laisser une fenêtre d'approche.
        ("spawn_suit_3", (-6.0, 21.0, 0.0)),
        ("spawn_suit_4", (6.0, 21.0, 0.0)),
    ],

    "use_objects": [],

    # Intérieur, pas de vitrine — pas de sun (même choix que Zone B).
    "lighting": {"sun": False},
}


ZONES = {"a": ZONE_A, "b": ZONE_B, "c": ZONE_C}
