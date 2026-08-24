"""
Spécification des niveaux Zone A / Zone B / Zone C / Zone D / Zone E — PROJET_CASSANDRE.

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


# -----------------------------------------------------------------------------
# ZONE D — Réserve
# -----------------------------------------------------------------------------

ZONE_D = {
    "name": "zone_d_reserve",

    "floor": {"x": (-14.0, 14.0), "y": (-2.0, 30.0), "tile": 4.0},

    "walls": [
        wall_run((-14.0, -2.0), (14.0, -2.0), (0.0, -1.0)),   # sud
        wall_run((-14.0, 30.0), (14.0, 30.0), (0.0, 1.0)),    # nord
        wall_run((-14.0, -2.0), (-14.0, 30.0), (-1.0, 0.0)),  # ouest
        wall_run((14.0, -2.0), (14.0, 30.0), (1.0, 0.0)),     # est
    ],

    "vitrine": None,
    "checkouts": None,
    "gondolas": None,

    # Deux rangées de kit_rack_4m (4x1.2x6m, PLUS haut que les murs 5m —
    # voulu, aucune dalle de plafond n'existe dans ce pipeline, donc pas de
    # conflit de collision, juste un rack qui dépasse visuellement la
    # hauteur des murs, cohérent avec un vrai rayonnage d'entrepôt). PAS de
    # capuchon de bout (aucune pièce d'about pour kit_rack_4m dans le kit,
    # contrairement aux gondoles — les rangées finissent à nu, c'est
    # réaliste pour du rayonnage industriel). Même convention "row.x = coin,
    # pas centre" que build_gondolas pour rester sur la grille 0.25m.
    "racks": {
        "piece": "kit_rack_4m",
        "rows": [
            {"x": -6.0, "y": (4.0, 20.0)},   # rangée ouest, 4 modules de 4m = 16m exact
            {"x": 4.0,  "y": (4.0, 20.0)},   # rangée est, symétrique
        ],
    },
    # Travée centrale ~8.8m entre les deux rangées, couloirs latéraux ouverts
    # entre chaque rangée et le mur le plus proche. NOTE MÉCANIQUE (voir
    # `build_level.py::build_racks`/`_build_row_run`) : comme pour les
    # gondoles de la Zone C, `row["x"]` est un COIN de la pièce, et la
    # rotation +90° (qui aligne la longueur locale du rack sur l'axe Y)
    # décale l'empreinte de la profondeur (1.2m) vers -X, pas vers +X —
    # l'empreinte réelle des rangées est donc X∈[-7.2,-6.0] (ouest) et
    # X∈[2.8,4.0] (est), pas centrée symétriquement autour de X=0 malgré
    # des coordonnées d'origine symétriques (-6.0/4.0). Largeur de travée
    # réelle : 2.8 - (-6.0) = 8.8m, conforme. Conséquence mécanique
    # acceptée, identique en nature à l'asymétrie de couloirs de la Zone C.

    # Mezzanine : dalle à Z=2.0 (kit_floor_4x4, origine = surface de marche,
    # poser à z=2.0 fait marcher à z=2.0), pleine largeur de la salle
    # (flush avec les murs est/ouest/nord comme le sol au sol), occupant le
    # quart nord de la salle (Y de 22 à 30 = 8m = 2 modules de 4m). Un
    # escalier DOUBLE (deux kit_stairs_2m côte à côte, X∈[-2,2], Y∈[20,22] —
    # chaque pièce fait 2m de large, la paire comble exactement le vide
    # entre la fin des rangées (Y=20) et le bord sud de la mezzanine
    # (Y=22)) monte du sol (Z=0) au niveau de la mezzanine (Z=2.0), pente
    # 45° (8 marches de 0.25m, sous l'autostep 0.35m, proxy = rampe convexe
    # — voir kit_spec.py::kit_stairs_2m). Rambarde (kit_railing_2m, 2m
    # chacune) SEULEMENT sur le bord sud exposé (Y=22, Z=2.0) — les bords
    # est/ouest/nord de la mezzanine sont flush contre les murs déjà
    # existants (comme le sol), pas besoin de rambarde là. Ouverture de 4m
    # (X∈[-2,2]) laissée sans rambarde pile là où monte l'escalier double ;
    # le reste (12m de chaque côté = 6 segments de 2m, aucun reste) est
    # rambardé. Total : 12 segments de rambarde.
    "mezzanine": {
        "floor": {"x": (-14.0, 14.0), "y": (22.0, 30.0), "tile": 4.0, "z": 2.0},
        "stairs": {
            "piece": "kit_stairs_2m",
            # Coordonnées TELLES QUE fournies par le plan (coin bas Blender
            # de la pièce, AVANT rotation). NOTE MÉCANIQUE (voir
            # `build_level.py::build_mezzanine_stairs`) : `kit_stairs_2m` ne
            # monte vers +Y que sous rotation +90° (vérifié empiriquement —
            # sans rotation la pente est le long de X), et cette même
            # rotation décale l'empreinte de la largeur locale (2m) vers -X
            # à partir de l'origine, exactement comme pour les gondoles/
            # racks. Un placement naïf de ces coordonnées ferait donc
            # atterrir les deux marches sur X∈[-4,0] au lieu de X∈[-2,2] —
            # précisément SOUS le segment de rambarde solide voisin
            # (`x_runs` s'arrête à X=-2), ce qui bloquerait le haut de
            # l'escalier contre une rambarde pleine. `build_mezzanine_stairs`
            # compense donc l'origine de +largeur (2m) pour que l'empreinte
            # RÉELLE tombe exactement sur X∈[-2,2] comme le veut le plan
            # (voir son docstring pour le calcul complet) — mécanique, pas
            # une décision de layout : la position/taille de la brèche ne
            # change pas, seule la valeur intermédiaire passée à Blender
            # est ajustée pour l'obtenir.
            "positions": [(-2.0, 20.0, 0.0), (0.0, 20.0, 0.0)],  # côte à côte, montent vers +Y
        },
        "railing": {
            "piece": "kit_railing_2m",
            "y": 22.0,
            "z": 2.0,
            "x_runs": [(-14.0, -2.0), (2.0, 14.0)],  # 6+6 = 12 segments de 2m, la brèche [-2,2] = l'escalier
        },
    },

    # "Palettes empilées" + caisses : flaveur "réserve", obstacles de
    # déplacement (aucune ne dépasse eyeHeight=1.6m, comme kit_checkout en
    # Zone B — couverture visuelle seulement, connu et accepté, pas un bug
    # nouveau). Piles de 3 kit_pallet (0.15m chacune, empilées en Z) posées
    # dans les couloirs latéraux ; 3 kit_crate isolées dans la partie sud de
    # la travée centrale, à l'écart des trajectoires évidentes.
    "storage_props": {
        "pallet_stacks": [
            {"x": -10.0, "y": 16.0, "count": 3},   # couloir latéral ouest
            {"x": 10.0,  "y": 16.0, "count": 3},   # couloir latéral est
        ],
        "crates": [
            (-2.0, 8.0, 0.0),
            (2.0, 6.0, 0.0),
            (3.0, 12.0, 0.0),
        ],
    },

    "spawn_player": (0.0, 0.0, 0.0),
    # CONTRAINTE D'IA (voir suit.ts::computeAvoidedDirection, aucun vrai
    # pathfinding — un Costard sur la mezzanine ne pourrait pas rejoindre un
    # joueur au sol via l'escalier hors de son axe direct) : AUCUN
    # spawn_suit_* sur la mezzanine, tous au sol.
    #
    # BUG CONSTATÉ EN JEU (premier jet, corrigé ici) : `spawn_suit_1`/
    # `spawn_suit_2` étaient posés à Y=10 dans les couloirs latéraux, en
    # théorie occultés par la rangée adjacente (occlusion confirmée par
    # calcul géométrique côté ouest, X∈[-7.2,-6.0] croisé à Y∈[6.0,7.2],
    # et géométrie/colliders re-vérifiés indépendamment en rechargeant le
    # `.glb` dans Blender — bbox exactes, col_box_rack_4m bien co-localisé
    # avec le rendu). Pourtant `window.cassandre.suits` montre les DEUX en
    # état `chase` puis `attack` dès le spawn, distance ~13.8m sous
    # `attackRange`=16m — la rangée ne bloque PAS le rayon de vue de
    # `hasClearWorldPath` en pratique, malgré une géométrie et des groupes
    # de collision (`COLLISION_GROUPS.WORLD`, identiques pour tout `col_*`
    # y compris les rangées) qui semblent corrects par lecture du code.
    # Cause racine NON identifiée (pas de repro headless tenté) — possible
    # gap général sur l'occlusion des `PROP` du kit pour les rayons de vue
    # des Costards, pas spécifique à cette zone. Contournement appliqué ici,
    # PAS une solution : `spawn_suit_1`/`spawn_suit_2` déplacés à Y=16
    # (toujours dans le couloir latéral, même flaveur visuelle) mais à une
    # distance qui les met hors d'`attackRange` QUELLE QUE SOIT l'occlusion
    # réelle — même stratégie de secours que les fix Zone B/C.
    # spawn_suit_3/4/5 dans la travée centrale ou près de l'escalier, à
    # découvert mais au-delà d'attackRange=16m, même marge.
    "spawn_suits": [
        ("spawn_suit_1", (-10.0, 16.0, 0.0)),  # couloir latéral ouest, ~18.9m
        ("spawn_suit_2", (10.0, 16.0, 0.0)),   # couloir latéral est, ~18.9m
        ("spawn_suit_3", (0.0, 18.0, 0.0)),    # travée centrale, ouvert, 18m
        ("spawn_suit_4", (-4.0, 21.0, 0.0)),   # near pied d'escalier, ouvert, ~21.4m
        ("spawn_suit_5", (4.0, 21.0, 0.0)),    # near pied d'escalier, ouvert, ~21.4m (symétrique)
    ],

    "use_objects": [],

    # Intérieur, pas de vitrine — pas de sun (même choix que Zone B/C).
    "lighting": {"sun": False},
}




# -----------------------------------------------------------------------------
# ZONE E — Bureau
# -----------------------------------------------------------------------------
#
# HISTORIQUE DE SCOPE (voir CLAUDE.md) : la première passe sur cette zone ne
# construisait QUE la géométrie + un ennemi placeholder standard. Le
# Directeur (vrai boss, entité dédiée `director.ts`/`directorManager.ts`) et
# le badge qu'il droppe à sa mort ont été câblés depuis, dans des tâches
# séparées — `spawn_suit_1` a été remplacé par `spawn_director_1` ci-dessous.
# Cette tâche-ci ferme le DERNIER écart documenté : la porte de sortie
# verrouillée par ce badge. Le câblage runtime (`loader.ts::buildDoor`,
# `interactive.ts`, `main.ts`) est déjà fait ET testé côté build — cette
# tâche ne fournit QUE la géométrie manquante côté Blender : `door_frame`
# ci-dessous pose toujours `kit_door_2m` (l'encadrement), mais y ajoute
# maintenant un vrai vantail (`kit_door_leaf` renommé `door_e_exit`, voir
# `build_level.py::build_door_leaf`) et un déclencheur `use_exit_door` (voir
# `use_objects` ci-dessous) — la brèche n'est plus un simple passage ouvert.

ZONE_E = {
    "name": "zone_e_bureau",

    # Salle principale (bureau) + alcôve de sortie (couloir sans issue,
    # symbolise "la sortie" en attendant la vraie séquence de fin de niveau
    # — hors scope ici). Un seul rectangle englobant pour tile_floor, comme
    # la Zone A (le sol déborde sous les zones hors des murs, ce qui est
    # sans conséquence — les murs bloquent déjà l'accès, voir CLAUDE.md).
    "floor": {"x": (-8.0, 8.0), "y": (-2.0, 18.0), "tile": 4.0},

    "walls": [
        # Salle principale (16x16m)
        wall_run((-8.0, -2.0), (8.0, -2.0), (0.0, -1.0)),    # sud
        wall_run((-8.0, -2.0), (-8.0, 14.0), (-1.0, 0.0)),   # ouest
        wall_run((8.0, -2.0), (8.0, 14.0), (1.0, 0.0)),      # est
        # Nord, par morceaux — la brèche X∈[-1,1] est la porte (kit_door_2m,
        # posée à part ci-dessous, PAS un wall_run, même convention que la
        # vitrine de la Zone A).
        wall_run((-8.0, 14.0), (-1.0, 14.0), (0.0, 1.0)),
        wall_run((1.0, 14.0), (8.0, 14.0), (0.0, 1.0)),
        # Alcôve de sortie : couloir de 2m de large (aligné pile sur la
        # largeur de la porte, aucun mur de flanc nécessaire — contrairement
        # à l'alcôve de la Zone A qui était plus large que sa vitrine),
        # 4m de profondeur, sans issue.
        wall_run((-1.0, 18.0), (1.0, 18.0), (0.0, 1.0)),     # fond du couloir
        wall_run((-1.0, 14.0), (-1.0, 18.0), (-1.0, 0.0)),   # flanc ouest
        wall_run((1.0, 14.0), (1.0, 18.0), (1.0, 0.0)),      # flanc est
    ],

    "vitrine": None,
    "checkouts": None,
    "gondolas": None,
    "racks": None,
    "mezzanine": None,
    "storage_props": None,

    # Porte de sortie : `kit_door_2m` (encadrement avec découpe de porte
    # intégrée — PAS un `kit_door_leaf`/`door_*` animé, voir le scope
    # ci-dessus) posée exactement dans la brèche des wall_run nord,
    # X∈[-1,1], Y=14 (même ligne que les segments de mur adjacents), même
    # convention d'origine que les autres pièces de mur.
    "door_frame": {
        "piece": "kit_door_2m",
        "x": -1.0,
        "y": 14.0,
        # Vantail réel (badge du Directeur câblé côté TS, voir CLAUDE.md) :
        # `build_door_leaf` (build_level.py) pose `kit_door_leaf` centré dans
        # cette ouverture et le nomme `door_e_exit` — convention `door_*` du
        # projet (`loader.ts::buildDoor` lui crée un corps Rapier dynamique,
        # verrouillé tant qu'aucune logique de jeu ne le débloque).
        "leaf_name": "door_e_exit",
    },

    "spawn_player": (0.0, 0.0, 0.0),
    # Le vrai Directeur (plus un Costard placeholder, voir CLAUDE.md pour
    # l'historique) au centre de la salle, face au joueur à l'entrée —
    # confrontation courte et immédiate plutôt qu'une approche longue (c'est
    # la dernière salle du jeu, la "révélation" doit être immédiate, pas une
    # embuscade cachée). 9m du spawn : sous attackRange=16m par choix assumé
    # ici (contrairement aux embuscades des zones précédentes, ce n'est pas
    # un couloir/une allée traversée par surprise, c'est une salle unique où
    # le joueur entre en sachant qu'il y a un ennemi en face — le state
    # machine garde de toute façon un temps `alertDuration` (0.45s, voir
    # directorConfig.ts) avant tout tir possible, quelle que soit la
    # distance).
    #
    # Le nom de clé Python `"spawn_suits"` reste tel quel : `build_spawns`
    # (build_level.py) ne fait qu'itérer des paires (nom, position) et créer
    # une Empty par nom donné, sans connaître la sémantique du nom — c'est le
    # PRÉFIXE de la CHAÎNE ci-dessous (`spawn_director_`, pas `spawn_suit_`)
    # qui détermine le contrat runtime lu par `loader.ts`, pas la clé du
    # dict Python. Renommer la clé aurait exigé de toucher `build_level.py`
    # pour un bénéfice purement cosmétique.
    "spawn_suits": [
        ("spawn_director_1", (0.0, 9.0, 0.0)),
    ],

    # `use_exit_door` : déclencheur de la porte verrouillée par badge (voir
    # CLAUDE.md — câblage TS déjà en place : `loader.ts::buildUseObject` lit
    # `extras.target`, `interactive.ts` dispatch "use_exit_door" vers
    # `handlers.onExitDoorUse(targetName)`, `main.ts` décide seul si le badge
    # est en poche). `target` pointe sur `door_e_exit` (voir `door_frame`
    # ci-dessus). Position choisie CÔTÉ SALLE (y=12.75 < 14, jamais dans
    # l'alcôve sans issue à y>14), à 1.25 m au sud du centre du vantail
    # (0.0, 14.0, 1.25) : distance sqrt(1.25² + 0.25²) ≈ 1.28 m, largement
    # sous les 2 m d'`USE_RANGE_METERS` (loader.ts). Coordonnées choisies
    # pile sur la grille 0.25 m (0.0 / 12.75 / 1.0) : aucune exception
    # nécessaire, comme le reste de cette zone (contrairement à
    # `use_crowbar`/`use_shotgun`, dont le Z=0.15 est une contrainte du prop
    # reprise du prototype, documentée ailleurs).
    "use_objects": [
        {"name": "use_exit_door", "center": (0.0, 12.75, 1.0), "size": (0.3, 0.1, 0.3),
         "target": "door_e_exit"},
    ],

    "lighting": {"sun": False},
}


ZONES = {"a": ZONE_A, "b": ZONE_B, "c": ZONE_C, "d": ZONE_D, "e": ZONE_E}
