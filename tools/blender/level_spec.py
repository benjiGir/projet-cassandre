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

    # Aucun secret dans cette zone — voir Zone B (secret 1) / Zone C (secret 2).
    "secrets": [],

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

    # Dalle de sol SUR-MESURE (`build_level.py::build_floor_patches`) pour
    # l'alcôve du secret 1, X∈[-15,-12] Y∈[10,12] (3×2 m) : ne tile pas en
    # 4 m avec kit_floor_4x4. see: docs/pipeline/niveau-blender.md#dalles-sur-mesure-et-chevauchement-dans-le-niveau-combiné
    "floor_patches": [
        {"name": "floor_secret_1b", "x": (-15.0, -12.0), "y": (10.0, 12.0)},
    ],

    "walls": [
        wall_run((-12.0, -2.0), (12.0, -2.0), (0.0, -1.0)),   # sud
        wall_run((-12.0, 22.0), (12.0, 22.0), (0.0, 1.0)),    # nord
        # Ouest, par morceaux — la brèche Y∈[10,12] est la porte du secret 1
        # (mur cassable / rayon surgelés, voir "door_frame"/"secrets"
        # ci-dessous), posée à part, PAS un wall_run, même convention que la
        # vitrine de la Zone A / la brèche nord de la Zone E. Les caisses
        # (X∈[-9,-6], voir "checkouts") sont à 3 m au moins de X=-12 : cette
        # portion du mur ouest est dégagée quel que soit Y choisi ici.
        wall_run((-12.0, -2.0), (-12.0, 10.0), (-1.0, 0.0)),
        wall_run((-12.0, 12.0), (-12.0, 22.0), (-1.0, 0.0)),
        wall_run((12.0, -2.0), (12.0, 22.0), (1.0, 0.0)),     # est
        # Alcôve du secret 1 (surgelés), derrière la brèche ouest — 3 m (X,
        # profondeur) × 2 m (Y, alignée pile sur la largeur de la brèche),
        # murs sur les 3 côtés extérieurs, pas de mur côté brèche (c'est
        # l'ouverture par laquelle on entre) — même pattern que l'alcôve de
        # la Zone A (fond + 2 flancs tournés vers l'extérieur).
        wall_run((-15.0, 10.0), (-15.0, 12.0), (-1.0, 0.0)),  # fond (ouest)
        wall_run((-15.0, 10.0), (-12.0, 10.0), (0.0, -1.0)),  # flanc sud
        wall_run((-15.0, 12.0), (-12.0, 12.0), (0.0, 1.0)),   # flanc nord
    ],

    "vitrine": None,

    "checkouts": {
        "piece": "kit_checkout",
        "y": 9.5,
        "x_origins": [-9.0, -4.0, 1.0, 6.0],
    },

    # Porte du secret 1 (surgelés), SANS verrou (contrairement à
    # `door_e_exit` — voir CLAUDE.md). Brèche OUEST = mur VERTICAL, donc
    # rot_deg=90° (voir build_level.py::build_door_frame/build_door_leaf) ;
    # x/y = coin AVANT rotation, celui que `plan_wall_run` donnerait pour un
    # segment de 2 m inséré à la place de la brèche (run ouest, start y=-2,
    # cursor=12 -> y=10).
    "door_frame": {
        "piece": "kit_door_2m",
        "x": -12.0,
        "y": 10.0,
        "rot_deg": 90.0,
        "leaf_name": "door_b_frozen",
    },

    "spawn_player": (0.0, 0.0, 0.0),
    "spawn_suits": [
        ("spawn_suit_1", (-6.0, 18.0, 0.0)),
        ("spawn_suit_2", (0.0, 18.0, 0.0)),
        ("spawn_suit_3", (6.0, 18.0, 0.0)),
    ],

    # `use_frozen_storage` : déclencheur de la porte du secret 1, SANS
    # verrou (mêmes mécanismes `loader.ts`/`interactive.ts` que
    # `use_exit_door`, mais `main.ts` ne doit lui poser aucune condition —
    # câblage TS hors scope ici, voir la tâche). Posé CÔTÉ SALLE PRINCIPALE
    # (x=-10.75 > -12, jamais dans l'alcôve), à 1.25 m du centre du vantail
    # (-12.0, 11.0, 1.25) — distance réelle 1.25 m, sous les 2 m
    # d'`USE_RANGE_METERS`, même marge que `use_exit_door` en Zone E.
    # Coordonnées pile sur la grille 0.25 m : aucune exception, contrairement
    # à `use_crowbar`/`use_shotgun`.
    "use_objects": [
        {"name": "use_frozen_storage", "center": (-10.75, 11.0, 1.0), "size": (0.3, 0.1, 0.3),
         "target": "door_b_frozen"},
    ],

    # Secret 1 (mur cassable, surgelés — voir PLAN_PROTO_BOOMER_SHOOTER.md).
    # Zone de détection par présence dans l'alcôve, aucune interactivité
    # (contrairement à `use_frozen_storage` qui ouvre la porte qui y mène).
    # Centrée dans l'alcôve (X∈[-15,-12], Y∈[10,12]) avec une marge de
    # 0.25-0.5 m de chaque côté (n'effleure aucun mur) : X∈[-14.5,-12.5],
    # Y∈[10.25,11.75], Z∈[0,1.5] (du sol jusqu'à un peu au-dessus de la tête,
    # couvre tout le volume qu'occupe un joueur qui entre). `secret_id`
    # obligatoire (voir `validate_level.py::check_naming`) : "1", reprend la
    # numérotation du plan.
    "secrets": [
        {"name": "secret_1b", "center": (-13.5, 11.0, 0.75), "size": (2.0, 1.5, 1.5),
         "secret_id": "1"},
    ],

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

    # Marche d'accès au secret 2 (toit de la rangée ouest, voir "secrets"
    # ci-dessous) : une seule `kit_crate` (1 m de haut, sous `jumpHeight`
    # 1.1 m) posée STATIQUE via `build_storage_props` (ses extras
    # dynamic/mass ne sont lus par aucun loader — ignorés comme tout autre
    # prop, voir kit_spec.py). Empreinte réelle de la rangée ouest (row
    # x=-4.25, rotation +90°, voir "gondolas" ci-dessous) : X∈[-5.5,-4.25].
    # Caisse posée à l'OUEST de cette empreinte (couloir latéral), décalée de
    # 0.25 m de la face ouest — assez pour sauter dessus puis, de son sommet
    # (Z=1.0), sur le toit de la gondole (Z=2.0, gain 1.0 m). Origine coin :
    # X∈[-6.75,-5.75], Y∈[7.5,8.5], près du capuchon sud (Y=6.75).
    "storage_props": {
        "crates": [(-6.75, 7.5, 0.0)],
    },

    # Trois rangées de gondoles parallèles à l'axe Y, créant des allées
    # nord-sud. Chaque rangée : 8 m de kit_gondola_4m (tiling exact, aucun
    # reste), capuchon kit_gondola_end à CHAQUE extrémité — bloque la vue à
    # TRAVERS une rangée (occulte spawn_suit_3/4 depuis le spawn, vérifié en
    # jeu) mais PAS la vue LE LONG d'une allée (ligne droite dégagée par
    # construction, voir ADR 0022 et la correction de `spawn_suits`
    # ci-dessous). Espacement centre-à-centre 4.25 m = 1.25 m de profondeur
    # de gondole + 3.0 m d'allée (kit_spec.py::kit_gondola_4m). Rangées à
    # X = -4.25 / 0.0 / 4.25 → deux allées centrales de 3 m + deux couloirs
    # latéraux ouverts (~7 m chacun). Convention coin/rotation des rangées :
    # voir docs/pipeline/niveau-blender.md#convention-de-placement-des-rangées-gondoles-racks-escalier
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
    # spawn_suit_1/2 posés à la sortie nord des allées (Y=18, ~18.1 m),
    # au-delà d'`attackRange`=16 m — pas au milieu (Y=12) comme le premier
    # jet : une allée est une ligne droite dégagée d'un bout à l'autre, un
    # spawn en son centre est donc en `attack` immédiat, sans fenêtre
    # d'approche (vérifié en jeu). Voir
    # docs/decisions/0022-occlusion-rangees-non-bloquante.md
    "spawn_suits": [
        ("spawn_suit_1", (-2.125, 18.0, 0.0)),  # sortie de l'allée centrale ouest
        ("spawn_suit_2", (2.125, 18.0, 0.0)),   # sortie de l'allée centrale est
        # Zone dégagée au nord du bloc de gondoles, combat ouvert avant la
        # sortie — à ~21.8 m du spawn, au-delà d'attackRange=16m (voir
        # suitConfig.ts:178), pour laisser une fenêtre d'approche.
        ("spawn_suit_3", (-6.0, 21.0, 0.0)),
        ("spawn_suit_4", (6.0, 21.0, 0.0)),
    ],

    # Micro d'annonces (objet interactif "signature Duke" du plan, PAS un
    # secret) : déclenche une réplique du héros dans les haut-parleurs
    # (texte HUD placeholder côté jeu, aucune VO réelle pour l'instant —
    # invariant #9). Posé contre le mur nord, X=0 (centré), à l'écart des
    # spawns `spawn_suit_3`/`spawn_suit_4` (Y=21, X=±6.0) et de tout mobilier
    # — zone dégagée entre le bloc de gondoles (fin Y=16) et le mur nord
    # (Y=26). Aucune cible (`target`) : effet autoportant, même contrat que
    # `use_crowbar`/`use_shotgun`, pas celui de `use_frozen_storage`.
    "use_objects": [
        {"name": "use_pa_mic", "center": (0.0, 24.0, 0.5), "size": (0.15, 0.15, 1.0)},
    ],

    # Secret 2 (toit, via palettes/caisse — voir PLAN_PROTO_BOOMER_SHOOTER.md).
    # Zone de détection sur le DESSUS de la rangée ouest (toit du collider
    # `col_box_gondola_4m`, Z=2.0, déjà marchable tel quel — aucune géométrie
    # neuve nécessaire pour le "toit" lui-même). Placée à l'extrémité NORD
    # de la rangée (proche Y=16), à l'opposé de la caisse d'accès (Y≈8) :
    # le joueur grimpe au sud puis marche vers le nord pour le trouver.
    # Centre choisi sur la grille 0.25 m, strictement À L'INTÉRIEUR de
    # l'empreinte réelle de la rangée (X∈[-5.5,-4.25], voir "storage_props"
    # ci-dessus) : X=-4.75 (marge 0.375 m côté est, 0.5 m côté ouest),
    # Y=15.5 (marge de ~0.5 m avec la fin du corps de rangée à Y=16, avant
    # le capuchon nord). Z centré à 2.5 (taille 1.0 m) : le volume commence
    # pile au niveau du sol du toit (Z=2.0) et couvre l'espace qu'occupe un
    # joueur debout dessus.
    "secrets": [
        {"name": "secret_2c", "center": (-4.75, 15.5, 2.5), "size": (0.75, 0.75, 1.0),
         "secret_id": "2"},
    ],

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
    # entre chaque rangée et le mur le plus proche. Empreinte réelle (coin +
    # rotation +90°, voir build_level.py::build_racks/_build_row_run et
    # docs/pipeline/niveau-blender.md#convention-de-placement-des-rangées-gondoles-racks-escalier) :
    # X∈[-7.2,-6.0] (ouest) / X∈[2.8,4.0] (est), pas centrée sur X=0 malgré
    # des origines symétriques (-6.0/4.0). Travée réelle 2.8-(-6.0)=8.8m,
    # conforme au plan.

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
            # Coordonnées telles que fournies par le plan (coin bas Blender,
            # AVANT rotation) — `build_level.py::build_mezzanine_stairs`
            # compense la rotation +90° pour que l'empreinte réelle tombe
            # sur X∈[-2,2] plutôt que sous la rambarde voisine. Voir
            # docs/pipeline/niveau-blender.md#convention-de-placement-des-rangées-gondoles-racks-escalier
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
    # spawn_suit_1/2 (couloirs latéraux, Y=16, ~18.9m) : déplacés depuis
    # Y=10 (~13.8m) où l'occlusion par la rangée adjacente, pourtant
    # confirmée par calcul géométrique et par les colliders réimportés,
    # ne bloquait pas la ligne de vue en jeu — voir
    # docs/decisions/0022-occlusion-rangees-non-bloquante.md (cause racine
    # non identifiée, contournement par distance). spawn_suit_3/4/5 : travée
    # centrale ou près de l'escalier, à découvert mais au-delà
    # d'attackRange=16m, même marge.
    "spawn_suits": [
        ("spawn_suit_1", (-10.0, 16.0, 0.0)),  # couloir latéral ouest, ~18.9m
        ("spawn_suit_2", (10.0, 16.0, 0.0)),   # couloir latéral est, ~18.9m
        ("spawn_suit_3", (0.0, 18.0, 0.0)),    # travée centrale, ouvert, 18m
        ("spawn_suit_4", (-4.0, 21.0, 0.0)),   # near pied d'escalier, ouvert, ~21.4m
        ("spawn_suit_5", (4.0, 21.0, 0.0)),    # near pied d'escalier, ouvert, ~21.4m (symétrique)
    ],

    # Toilettes utilisables (+1 PV, objet interactif "signature Duke" du
    # plan, PAS un secret) : coin sud-est, X=12.0/Y=2.0 — au sud des rangées
    # (Y∈[4,20]), à l'écart des piles de palettes (X=±10.0, Y=16.0) et des
    # caisses isolées (X∈[-2,3], Y∈[6,12]), zone entièrement dégagée. Aucune
    # cible : effet autoportant (soin), même contrat que `use_crowbar`.
    "use_objects": [
        {"name": "use_toilet", "center": (12.0, 2.0, 0.25), "size": (0.5, 0.5, 0.5)},
    ],

    # Aucun secret dans cette zone — voir Zone B (secret 1) / Zone C (secret 2).
    "secrets": [],

    # Intérieur, pas de vitrine — pas de sun (même choix que Zone B/C).
    "lighting": {"sun": False},
}




# -----------------------------------------------------------------------------
# ZONE E — Bureau
# -----------------------------------------------------------------------------
#
# Historique de scope (géométrie seule -> Directeur réel -> badge -> porte
# verrouillée) : voir docs/game/niveau-hypermarche.md. `door_frame`
# ci-dessous pose `kit_door_2m` (l'encadrement) ET son vantail
# (`kit_door_leaf` renommé `door_e_exit`, build_level.py::build_door_leaf)
# avec son déclencheur `use_exit_door` — la brèche n'est plus un simple
# passage ouvert.

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

    # Aucun secret dans cette zone — voir Zone B (secret 1) / Zone C (secret 2).
    "secrets": [],

    "lighting": {"sun": False},
}


ZONES = {"a": ZONE_A, "b": ZONE_B, "c": ZONE_C, "d": ZONE_D, "e": ZONE_E}
