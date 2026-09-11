"""
Assemblage du niveau combiné (hypermarche_complet) — PROJET_CASSANDRE.

    blender -b --factory-startup -P tools/blender/build_combined_level.py -- \\
        --kit assets_src/blender/kit_hypermarche.blend \\
        --out assets_src/blender/hypermarche_complet.blend

Fusionne les Zones A, B, C, D, E (déjà construites, bakées, validées et
exportées INDÉPENDAMMENT — `zone_{a_parking,b_caisses,c_rayons,d_reserve,
e_bureau}.glb`) en UN SEUL niveau connecté, sans coupure de chargement. Cette
tâche ne redesigne RIEN à l'intérieur d'une zone (aucun mur, aucune gondole,
aucun rack, aucune mezzanine déplacé à l'intérieur de sa propre zone) : elle
ajoute seulement une position dans un espace monde partagé, une brèche de
connexion dans un mur existant, et un renommage des spawns/objets interactifs
pour éviter les collisions de noms. `level_spec.ZONE_A`..`ZONE_E` ne sont
JAMAIS mutés : tout ce fichier construit des COPIES traduites (voir
`prepare_zone`) — `--zone a` à `--zone e` de `build_level.py` continuent de
produire des fichiers bit-à-bit identiques à avant cette tâche.

## Ordre et méthode (imposés par la tâche, pas une décision de layout)

A (ancre, non traduite) -> B -> C -> D -> E, dans cet ordre. Pour chaque paire
de zones consécutives, CE SCRIPT choisit :
  - un mur (de la zone amont) et un mur (de la zone aval) portant chacun une
    brèche de 4 m, vérifiée dégagée de toute géométrie intérieure par lecture
    directe des bounding box de `level_spec.py` (voir les commentaires de
    `CONNECTIONS` ci-dessous, zone par zone) ;
  - la translation (dx, dy) de la zone aval qui aligne exactement sa brèche
    d'entrée sur la brèche de sortie de la zone amont, à travers un couloir
    de connexion de 4 x 4 m (une seule dalle, deux murs de flanc) ;
  - documente CETTE décision ici, pas seulement dans le README (le README
    résume, ce fichier est la source).

Toutes les brèches et translations sont des ENTIERS de mètres : un entier est
automatiquement un multiple de la grille 0.25 m (`validate_level.py`), donc
aucune translation n'introduit de nouveau warning de grille — seuls les
warnings déjà connus et documentés (crowbar Z=0.15, palettes Z=0.15/0.30,
shotgun Z=0.15) peuvent réapparaître, inchangés dans leur nature.

## Pourquoi un couloir 4 x 4 m et pas une brèche "juste assez large"

`kit_floor_4x4` est une dalle FIXE 4 x 4 m (pas redimensionnable — voir
`kit_spec.py`) : `tile_floor` ne peut carreler proprement qu'une empreinte
dont chaque côté est un multiple de 4 m. Un couloir 4 x 4 m est donc le plus
petit connecteur qui tile sans reste ET qui reste un module de mur valide
(`kit_wall_4m`) pour ses deux flancs — même mécanique que les tuiles de sol
et les murs de chaque zone, aucune pièce sur-mesure inventée pour l'occasion.

## Le piège du monde/lampe partagé (nouveau, propre à la fusion)

`build_level.py::build_lighting` crée un nouveau monde à CHAQUE appel — sans
conséquence pour un fichier de zone isolée, mais appelé cinq fois ici ; voir
le nettoyage en fin de `main()` pour le détail (mondes orphelins, aussi
documenté dans docs/pipeline/niveau-blender.md#mondes-orphelins-dans-le-niveau-combiné).
Même chose, cosmétique, pour les noms `ceiling_light_N` (chaque zone
recompte depuis 0, Blender suffixe les doublons) — sans conséquence, les
lampes ne sont jamais exportées (`export_lights=False`).
"""

from __future__ import annotations

import os
import sys
from collections import Counter

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import kit_spec as spec        # noqa: E402
import level_spec               # noqa: E402
import geo_utils                # noqa: E402
import build_level as bl        # noqa: E402


# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------

def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg_value(args: list[str], flag: str, default):
    return args[args.index(flag) + 1] if flag in args else default


# ---------------------------------------------------------------------------
# Traduction pure d'un dict de zone — AUCUNE mutation de level_spec.ZONE_*
# ---------------------------------------------------------------------------

def _t_wall_run(run: dict, dx: float, dy: float) -> dict:
    (x0, y0), (x1, y1) = run["start"], run["end"]
    return level_spec.wall_run((x0 + dx, y0 + dy), (x1 + dx, y1 + dy),
                                run["outward"], run.get("thickness", level_spec.WALL_THICKNESS))


def _t_floor(floor: dict, dx: float, dy: float) -> dict:
    out = {"x": (floor["x"][0] + dx, floor["x"][1] + dx),
           "y": (floor["y"][0] + dy, floor["y"][1] + dy),
           "tile": floor["tile"]}
    if "z" in floor:
        out["z"] = floor["z"]
    return out


def _t_floor_patches(patches: list[dict] | None, dx: float, dy: float) -> list[dict]:
    """Traduit chaque dalle sur-mesure (`build_level.py::build_floor_patches`)
    — même mécanique que `_t_vitrine`/`_t_storage` : `x`/`y` sont des
    intervalles (bornes min/max), pas des points, les deux bornes reçoivent
    le même décalage."""
    return [dict(p, x=(p["x"][0] + dx, p["x"][1] + dx), y=(p["y"][0] + dy, p["y"][1] + dy))
            for p in (patches or [])]


def _t_vitrine(v: dict | None, dx: float, dy: float) -> dict | None:
    if v is None:
        return None
    return {"x": (v["x"][0] + dx, v["x"][1] + dx), "y": v["y"] + dy,
            "thickness": v["thickness"], "bands": v["bands"]}


def _t_checkouts(c: dict | None, dx: float, dy: float) -> dict | None:
    if c is None:
        return None
    return {"piece": c["piece"], "y": c["y"] + dy,
            "x_origins": [x + dx for x in c["x_origins"]]}


def _t_row_spec(r: dict | None, dx: float, dy: float) -> dict | None:
    """Partagé par `gondolas` et `racks` — même forme `{"piece", ["end_piece"],
    "rows": [{"x", "y": (a, b)}]}`."""
    if r is None:
        return None
    out = dict(r)
    out["rows"] = [{"x": row["x"] + dx, "y": (row["y"][0] + dy, row["y"][1] + dy)}
                   for row in r["rows"]]
    return out


def _t_mezzanine(m: dict | None, dx: float, dy: float) -> dict | None:
    if m is None:
        return None
    out: dict = {"floor": _t_floor(m["floor"], dx, dy)}
    stairs = m.get("stairs")
    if stairs:
        out["stairs"] = {"piece": stairs["piece"],
                          "positions": [(x + dx, y + dy, z) for x, y, z in stairs["positions"]]}
    railing = m.get("railing")
    if railing:
        out["railing"] = {"piece": railing["piece"], "y": railing["y"] + dy, "z": railing["z"],
                           "x_runs": [(a + dx, b + dx) for a, b in railing["x_runs"]]}
    return out


def _t_storage(s: dict | None, dx: float, dy: float) -> dict | None:
    if s is None:
        return None
    return {
        "pallet_stacks": [{"x": p["x"] + dx, "y": p["y"] + dy, "count": p["count"]}
                          for p in s.get("pallet_stacks", [])],
        "crates": [(x + dx, y + dy, z) for x, y, z in s.get("crates", [])],
    }


def _t_door_frame(d: dict | None, dx: float, dy: float) -> dict | None:
    """`rot_deg` (voir `build_level.py::build_door_frame`/`build_door_leaf`,
    généralisés pour la porte du secret 1, Zone B) est une ORIENTATION, pas
    une position — invariante par translation pure, propagée telle quelle."""
    if d is None:
        return None
    out = {"piece": d["piece"], "x": d["x"] + dx, "y": d["y"] + dy}
    if "rot_deg" in d:
        out["rot_deg"] = d["rot_deg"]
    if "leaf_name" in d:
        # Nom déjà zone-scopé (`door_e_exit`, `door_b_frozen`) par
        # `level_spec.py` — aucun renommage supplémentaire nécessaire ici,
        # contrairement à `spawn_suit_*`/`spawn_director_*` (voir
        # `rename_prefix`) : DEUX zones posent désormais un `door_frame`
        # (B et E), mais leurs `leaf_name` sont distincts par construction,
        # pas de collision possible.
        out["leaf_name"] = d["leaf_name"]
    return out


def _t_secrets(secrets: list[dict], dx: float, dy: float) -> list[dict]:
    """Même mécanique que `_t_checkouts`/`_t_storage` — traduit `center`,
    laisse `size`/`secret_id`/`name` inchangés (déjà zone-scopés par
    `level_spec.py`, ex. `secret_1b`/`secret_2c`, comme `door_e_exit`)."""
    return [dict(s, center=(s["center"][0] + dx, s["center"][1] + dy, s["center"][2]))
            for s in secrets]


def _t_dock_door(d: dict | None, dx: float, dy: float) -> dict | None:
    """Même mécanique que `_t_door_frame` : `rot_deg` est une orientation
    (invariante par translation), `leaf_name` déjà zone-scopé
    (`dock_door_d_seal`, seule zone à poser un `dock_door` à ce jour)."""
    if d is None:
        return None
    out = {"piece": d["piece"], "x": d["x"] + dx, "y": d["y"] + dy}
    if "rot_deg" in d:
        out["rot_deg"] = d["rot_deg"]
    if "leaf_name" in d:
        out["leaf_name"] = d["leaf_name"]
    return out


def _t_kit_details(details: list[dict] | None, dx: float, dy: float) -> list[dict]:
    """Traduit `x`/`y` de chaque entrée `kit_details` (voir
    `build_level.py::build_kit_details`) ; `z`/`rot_deg`/`piece` inchangés
    (une hauteur ou une orientation est invariante par translation pure)."""
    return [dict(d, x=d["x"] + dx, y=d["y"] + dy) for d in (details or [])]


def translate_zone(zone: dict, dx: float, dy: float) -> dict:
    """Traduction (dx, dy) de TOUT ce que contient un dict de zone. Ne lit
    JAMAIS ni n'écrit `level_spec.ZONE_*` — prend et retourne des dicts neufs,
    y compris pour les listes (`walls`, `spawn_suits`, `use_objects`)."""
    z = dict(zone)
    z["floor"] = _t_floor(zone["floor"], dx, dy)
    z["floor_patches"] = _t_floor_patches(zone.get("floor_patches"), dx, dy)
    z["walls"] = [_t_wall_run(r, dx, dy) for r in zone["walls"]]
    z["vitrine"] = _t_vitrine(zone.get("vitrine"), dx, dy)
    z["checkouts"] = _t_checkouts(zone.get("checkouts"), dx, dy)
    z["gondolas"] = _t_row_spec(zone.get("gondolas"), dx, dy)
    z["racks"] = _t_row_spec(zone.get("racks"), dx, dy)
    z["mezzanine"] = _t_mezzanine(zone.get("mezzanine"), dx, dy)
    z["storage_props"] = _t_storage(zone.get("storage_props"), dx, dy)
    z["door_frame"] = _t_door_frame(zone.get("door_frame"), dx, dy)
    z["dock_door"] = _t_dock_door(zone.get("dock_door"), dx, dy)
    z["kit_details"] = _t_kit_details(zone.get("kit_details"), dx, dy)
    z["secrets"] = _t_secrets(zone.get("secrets", []), dx, dy)
    sp = zone["spawn_player"]
    z["spawn_player"] = (sp[0] + dx, sp[1] + dy, sp[2])
    z["spawn_suits"] = [(name, (x + dx, y + dy, zz)) for name, (x, y, zz) in zone["spawn_suits"]]
    z["use_objects"] = [dict(u, center=(u["center"][0] + dx, u["center"][1] + dy, u["center"][2]))
                         for u in zone["use_objects"]]
    return z


def rename_prefix(zone: dict, old_prefix: str, letter: str, key: str) -> None:
    """Renomme en place (sur la COPIE traduite, jamais l'original) chaque nom
    de `zone[key]` commençant par `old_prefix` en insérant `letter` juste
    après — `spawn_suit_1` -> `spawn_suit_b1`, `spawn_director_1` ->
    `spawn_director_e1`. `loader.ts` ne fait qu'un `startsWith(...)` sur le
    préfixe complet (`spawn_suit_`/`spawn_director_`/`use_`) : un suffixe de
    lettre inséré avant le numéro ne casse aucun contrat runtime."""
    zone[key] = [
        (old_prefix + letter + name[len(old_prefix):], loc) if name.startswith(old_prefix) else (name, loc)
        for name, loc in zone[key]
    ]


# ---------------------------------------------------------------------------
# Découpe d'une brèche dans un wall_run — mécanique pure, pas de layout
# ---------------------------------------------------------------------------

def carve_breach(run: dict, lo: float, hi: float) -> list[dict]:
    """Retire le segment [lo, hi] d'un `wall_run` AXÉ SUR X OU Y (tous les
    murs de `level_spec.py` le sont), retourne 0, 1 ou 2 `wall_run` de
    remplacement. `lo`/`hi` sont dans le même repère que `start`/`end` — donc
    à appeler AVANT translation (repère local de la zone), la translation
    s'applique ensuite uniformément à `walls` comme à tout le reste
    (`translate_zone`)."""
    (x0, y0), (x1, y1) = run["start"], run["end"]
    outward, thickness = run["outward"], run.get("thickness", level_spec.WALL_THICKNESS)
    out = []
    if abs(y1 - y0) < 1e-9 and abs(x1 - x0) > 1e-9:      # horizontal, varie en X
        lo_x, hi_x = min(lo, hi), max(lo, hi)
        for a, b in ((min(x0, x1), lo_x), (hi_x, max(x0, x1))):
            if b - a > 1e-6:
                out.append(level_spec.wall_run((a, y0), (b, y0), outward, thickness))
    elif abs(x1 - x0) < 1e-9 and abs(y1 - y0) > 1e-9:    # vertical, varie en Y
        lo_y, hi_y = min(lo, hi), max(lo, hi)
        for a, b in ((min(y0, y1), lo_y), (hi_y, max(y0, y1))):
            if b - a > 1e-6:
                out.append(level_spec.wall_run((x0, a), (x0, b), outward, thickness))
    else:
        raise ValueError(f"carve_breach: run ni horizontal ni vertical {run}")
    return out


def carve_wall(walls: list[dict], match_start: tuple, match_end: tuple,
               lo: float, hi: float) -> list[dict]:
    """Remplace, dans une liste de `wall_run`, celui dont (start, end)
    correspond exactement à `match_start`/`match_end` par sa version carvée.
    Une correspondance manquante est une ERREUR (le plan a changé sous nos
    pieds), pas un no-op silencieux."""
    out, found = [], False
    for run in walls:
        if not found and run["start"] == match_start and run["end"] == match_end:
            out.extend(carve_breach(run, lo, hi))
            found = True
        else:
            out.append(run)
    if not found:
        raise ValueError(f"carve_wall: run {match_start}->{match_end} introuvable")
    return out


# ---------------------------------------------------------------------------
# Préparation des 5 zones — brèche puis translation puis renommage
# ---------------------------------------------------------------------------
#
# Repère de lecture pour chaque zone : brèches et translations en coordonnées
# LOCALES (celles de `level_spec.py`, AVANT translation) sauf mention
# contraire. Les distances "au mur" citées ci-dessous viennent directement
# des bounding box déclarées dans `level_spec.ZONE_*` (relues, pas devinées).

def prepare_zone_a() -> dict:
    """ANCRE, non traduite (dx=dy=0). Seule modification : une brèche de 4 m
    dans le mur EST (x=10, y de -2 à 22 — un mur plein sur toute sa longueur,
    aucune géométrie intérieure de la Zone A n'en approche : la vitrine/
    l'alcôve occupent x∈[-6,6] au NORD, sans aucun rapport avec le mur est).
    Le mur OUEST serait un choix tout aussi valide et symétrique ; l'EST est
    pris arbitrairement (aucune des deux options n'a de conséquence de
    layout, la Zone B se contente d'être posée du côté choisi).
    Brèche à y∈[2,6] : loin à la fois du spawn/crowbar (2,2) et de l'alcôve
    (y>=18), aucune raison de layout, juste « au milieu du mur, dégagé »."""
    zone = dict(level_spec.ZONE_A)
    zone["walls"] = carve_wall(zone["walls"], (10.0, -2.0), (10.0, 22.0), 2.0, 6.0)
    zone["use_objects"] = list(zone["use_objects"])
    zone["spawn_suits"] = list(zone["spawn_suits"])
    return zone


def prepare_zone_b(dx: float, dy: float) -> dict:
    """Deux brèches : OUEST (entrée depuis A) et NORD (sortie vers C).

    OUEST, y∈[2,6] (mur ouest x=-12) : les caisses sont à y=9.5
    (bande y∈[9.5,10.5], x∈[-9,9]) — 3.5 m au nord de la brèche la plus
    proche, aucun contact. Les 3 spawn_suit_* sont à y=18, encore plus loin.
    Le mur ouest N'EST PLUS un `wall_run` unique depuis la tâche « secrets »
    (`level_spec.ZONE_B`) : il est déjà scindé en deux segments pour loger la
    porte du secret 1 (brèche y∈[10,12]) — (-12,-2)->(-12,10) puis
    (-12,12)->(-12,22). La brèche A-B (y∈[2,6]) tombe entièrement dans le
    PREMIER segment (2,6 ⊂ [-2,10]), c'est donc lui qu'on carve ici, pas
    l'ancien run 24 m d'un seul tenant.

    NORD, x∈[-2,2] (mur plein y=22, x=-12..12) : aucune caisse/rack n'atteint
    y=22 (les caisses sont à y=9.5-10.5), donc n'importe quel x conviendrait ;
    x∈[-2,2] est choisi pour retomber exactement sous la colonne x∈[24,28] du
    monde une fois translaté par dx=26 (voir couloir B-C), gardant les
    connecteurs alignés en une colonne verticale unique à travers B et C.
    """
    zone = dict(level_spec.ZONE_B)
    walls = carve_wall(zone["walls"], (-12.0, -2.0), (-12.0, 10.0), 2.0, 6.0)
    walls = carve_wall(walls, (-12.0, 22.0), (12.0, 22.0), -2.0, 2.0)
    zone = dict(zone, walls=walls)
    zone = translate_zone(zone, dx, dy)
    rename_prefix(zone, "spawn_suit_", "b", "spawn_suits")
    # Pompe (shotgun) — AJOUT propre à cette copie combinée, absent de
    # `zone_b_caisses.glb`. Ajouté ICI, APRÈS `translate_zone` : (15.5, 4.0)
    # est donc déjà une coordonnée MONDE, pas besoin d'y rajouter dx/dy.
    # 1.5 m de la brèche ouest translatée (x=14) et 5.5 m du mur sud (y=-2) :
    # dans la première case de sol franchie en entrant depuis A, largement
    # avant la première caisse (y=9.5) — non manqué, dégagé de toute
    # géométrie.
    zone["use_objects"] = list(zone["use_objects"]) + [
        {"name": "use_shotgun", "center": (15.5, 4.0, 0.15), "size": (0.1, 0.8, 0.1)}
    ]
    return zone


def prepare_zone_c(dx: float, dy: float) -> dict:
    """Deux brèches : SUD (entrée depuis B) et NORD (sortie vers D).

    SUD, x∈[-2,2] (mur plein y=-2, x=-12..12) : les gondoles commencent à
    y=6.75 (rangées y∈[8,16] + capuchons ±1.25) — 8.75 m au nord de ce mur,
    n'importe quel x est dégagé ; x∈[-2,2] gardé pour l'alignement en colonne
    avec la brèche nord de B (voir `prepare_zone_b`).

    NORD, x∈[-2,2] (mur plein y=26, x=-12..12) : les gondoles finissent à
    y=17.25 au plus au nord — 8.75 m de marge également. Même colonne x
    reprise pour aligner le connecteur C-D sous D (voir `prepare_zone_d`).
    """
    zone = dict(level_spec.ZONE_C)
    walls = carve_wall(zone["walls"], (-12.0, -2.0), (12.0, -2.0), -2.0, 2.0)
    walls = carve_wall(walls, (-12.0, 26.0), (12.0, 26.0), -2.0, 2.0)
    zone = dict(zone, walls=walls)
    zone = translate_zone(zone, dx, dy)
    rename_prefix(zone, "spawn_suit_", "c", "spawn_suits")
    return zone


def prepare_zone_d(dx: float, dy: float) -> dict:
    """Deux brèches : SUD (entrée depuis C) et EST (sortie vers E — PAS le
    nord, contrainte explicite : le mur nord de la Zone D est le bord de la
    mezzanine, Z=2 m, y=30, pleine largeur X∈[-14,14] — une brèche au sol y
    déboucherait 2 m sous le niveau de marche réel).

    SUD, x∈[-2,2] (mur plein y=-2, x=-14..14) : les racks commencent à y=4 —
    6 m de marge, n'importe quel x dégagé ; x∈[-2,2] pour l'alignement en
    colonne avec la brèche nord de C.

    EST, y∈[10,14] (mur plein x=14, y=-2..30) : la rangée est de racks
    s'arrête à x=4.0 (empreinte réelle X∈[2.8,4.0], voir `level_spec.ZONE_D`)
    — 10 m de marge jusqu'au mur est, DONC n'importe quel y du flanc est est
    dégagé (contrairement à ce qu'une lecture rapide de « bande Y∈[4,20] »
    pourrait suggérer, ce n'est pas la coordonnée Y qui compte ici mais
    l'écart en X entre le rack et le mur). y∈[10,14] pris au centre de la
    bande [4,20] par symétrie, sans autre contrainte.
    """
    zone = dict(level_spec.ZONE_D)
    walls = carve_wall(zone["walls"], (-14.0, -2.0), (14.0, -2.0), -2.0, 2.0)
    walls = carve_wall(walls, (14.0, -2.0), (14.0, 30.0), 10.0, 14.0)
    zone = dict(zone, walls=walls)
    zone = translate_zone(zone, dx, dy)
    rename_prefix(zone, "spawn_suit_", "d", "spawn_suits")
    return zone


def prepare_zone_e(dx: float, dy: float) -> dict:
    """Une seule brèche : OUEST (entrée depuis D — la Zone E est un cul-de-
    sac, il n'y a pas de connexion en sortie).

    OUEST, y∈[6,10] (mur plein x=-8, y=-2..14) : aucune géométrie intérieure
    de la Zone E n'approche ce mur — le seul élément posé (`door_frame`,
    `kit_door_2m`) est au NORD (x∈[-1,1], y=14), à 9 m au moins du mur ouest
    sur toute sa longueur. y∈[6,10] pris au centre du mur [-2,14] par
    symétrie, sans autre contrainte."""
    zone = dict(level_spec.ZONE_E)
    walls = carve_wall(zone["walls"], (-8.0, -2.0), (-8.0, 14.0), 6.0, 10.0)
    zone = dict(zone, walls=walls)
    zone = translate_zone(zone, dx, dy)
    rename_prefix(zone, "spawn_director_", "e", "spawn_suits")
    return zone


# ---------------------------------------------------------------------------
# Couloirs de connexion — dalle 4x4 + 2 murs de flanc, réutilise tile_floor
# et build_walls TELS QUELS (aucune pièce sur mesure)
# ---------------------------------------------------------------------------

def build_connector(axis: str, x0: float, x1: float, y0: float, y1: float,
                     mesh_lookup, proxy_map, shell_coll, col_coll) -> tuple[int, int]:
    """`axis="x"` : on avance le long de X, les deux murs de flanc courent le
    long de X (à y=y0 et y=y1), les extrémités est/ouest restent ouvertes —
    c'est là que les brèches déjà taillées dans les zones voisines se
    raccordent. `axis="y"` : symétrique, on avance le long de Y."""
    floor_count = bl.tile_floor({"x": (x0, x1), "y": (y0, y1), "tile": 4.0},
                                 mesh_lookup, proxy_map, shell_coll, col_coll)
    if axis == "x":
        wall_specs = [
            level_spec.wall_run((x0, y0), (x1, y0), (0.0, -1.0)),
            level_spec.wall_run((x0, y1), (x1, y1), (0.0, 1.0)),
        ]
    elif axis == "y":
        wall_specs = [
            level_spec.wall_run((x0, y0), (x0, y1), (-1.0, 0.0)),
            level_spec.wall_run((x1, y0), (x1, y1), (1.0, 0.0)),
        ]
    else:
        raise ValueError(f"axis invalide : {axis!r}")
    wall_counts, remainder = bl.build_walls(wall_specs, mesh_lookup, proxy_map, shell_coll, col_coll)
    if remainder > 1e-6:
        raise RuntimeError(f"[build_combined_level] connecteur {axis} {(x0, x1, y0, y1)} : reste non tilé")
    return floor_count, sum(wall_counts.values())


# ---------------------------------------------------------------------------
# Translations et brèches retenues — LA décision de cette tâche
# ---------------------------------------------------------------------------
#
#   Zone | dx  | dy | brèche amont (locale, AVANT dx/dy)      | brèche aval (locale)
#   -----|-----|----|------------------------------------------|----------------------------
#   A    |   0 |  0 | (ancre)                                  | est  x=10,  y∈[2,6]
#   B    |  26 |  0 | ouest x=-12, y∈[2,6]                      | nord y=22,  x∈[-2,2]
#   C    |  26 | 28 | sud   y=-2,  x∈[-2,2]                     | nord y=26,  x∈[-2,2]
#   D    |  26 | 60 | sud   y=-2,  x∈[-2,2]                     | est  x=14,  y∈[10,14]
#   E    |  52 | 64 | ouest x=-8,  y∈[6,10]                     | (cul-de-sac)
#
# Chaque `dx`/`dy` est choisi pour que la brèche aval, une fois translatée,
# tombe exactement à 4 m (un couloir 4x4) de la brèche amont correspondante
# — voir le calcul dans le docstring de chaque `prepare_zone_*`. Les quatre
# couloirs qui en résultent (calculés, pas devinés) :

CONNECTORS = [
    ("A-B", "x", 10.0, 14.0, 2.0, 6.0),
    ("B-C", "y", 24.0, 28.0, 22.0, 26.0),
    ("C-D", "y", 24.0, 28.0, 54.0, 58.0),
    ("D-E", "x", 40.0, 44.0, 70.0, 74.0),
]

TRANSLATIONS = {"a": (0.0, 0.0), "b": (26.0, 0.0), "c": (26.0, 28.0),
                 "d": (26.0, 60.0), "e": (52.0, 64.0)}


def build_all_zones() -> dict[str, dict]:
    return {
        "a": prepare_zone_a(),
        "b": prepare_zone_b(*TRANSLATIONS["b"]),
        "c": prepare_zone_c(*TRANSLATIONS["c"]),
        "d": prepare_zone_d(*TRANSLATIONS["d"]),
        "e": prepare_zone_e(*TRANSLATIONS["e"]),
    }


# ---------------------------------------------------------------------------
# Assemblage
# ---------------------------------------------------------------------------

def gather_needed_pieces(zones: dict[str, dict]) -> list[str]:
    needed = {"kit_wall_4m", "kit_wall_2m", "kit_wall_1m", "kit_floor_4x4", "kit_corner_out"}
    for zone in zones.values():
        if zone.get("checkouts"):
            needed.add(zone["checkouts"]["piece"])
        if zone.get("gondolas"):
            needed.add(zone["gondolas"]["piece"])
            needed.add(zone["gondolas"]["end_piece"])
        if zone.get("racks"):
            needed.add(zone["racks"]["piece"])
        mezz = zone.get("mezzanine")
        if mezz:
            if mezz.get("stairs"):
                needed.add(mezz["stairs"]["piece"])
            if mezz.get("railing"):
                needed.add(mezz["railing"]["piece"])
        if zone.get("storage_props"):
            needed.update(["kit_pallet", "kit_crate"])
        if zone.get("door_frame"):
            needed.add(zone["door_frame"]["piece"])
            if zone["door_frame"].get("leaf_name"):
                needed.add("kit_door_leaf")
        if zone.get("ceiling"):
            needed.add("kit_ceiling_4x4")
        if zone.get("dock_door"):
            needed.add(zone["dock_door"]["piece"])
        for detail in zone.get("kit_details", []):
            needed.add(detail["piece"])
    return sorted(needed)


def main() -> None:
    args = get_args()
    kit_path = os.path.abspath(bpy.path.abspath(
        arg_value(args, "--kit", "assets_src/blender/kit_hypermarche.blend")))
    out = os.path.abspath(bpy.path.abspath(
        arg_value(args, "--out", "assets_src/blender/hypermarche_complet.blend")))
    light_energy = float(arg_value(args, "--light-energy", "180.0"))

    if not os.path.isfile(kit_path):
        print(f"[build_combined_level] kit introuvable : {kit_path}")
        sys.exit(1)

    geo_utils.wipe_scene()
    geo_utils.configure_scene()

    root = bpy.context.scene.collection
    geo = geo_utils.make_collection("GEO", root)
    shell = geo_utils.make_collection("SHELL", geo)
    props_coll = geo_utils.make_collection("PROPS", geo)
    geo_utils.make_collection("DETAIL", geo)
    col_coll = geo_utils.make_collection("COL", root)
    logic_coll = geo_utils.make_collection("LOGIC", root)
    lights_coll = geo_utils.make_collection("_LIGHTS", root)
    lights_coll["gltf_export"] = False

    zones = build_all_zones()

    needed_pieces = gather_needed_pieces(zones)
    mesh_names, proxy_map = bl.gather_kit_mesh_names(needed_pieces)
    mesh_lookup, materials_lookup = bl.append_kit_data(kit_path, mesh_names, list(spec.MATERIALS.keys()))

    totals: Counter = Counter()
    per_zone_report = []

    for letter in "abcde":
        zone = zones[letter]
        z_totals: Counter = Counter()

        z_totals["floor"] = bl.tile_floor(zone["floor"], mesh_lookup, proxy_map, shell, col_coll)
        z_totals["floor_patches"] = bl.build_floor_patches(zone.get("floor_patches"), materials_lookup, shell, col_coll)
        wall_counts, wall_remainder = bl.build_walls(zone["walls"], mesh_lookup, proxy_map, shell, col_coll)
        if wall_remainder > 1e-6:
            print(f"[build_combined_level] ERREUR zone {letter} : reste de mur non tilé {wall_remainder:.3f} m")
            sys.exit(1)
        z_totals["walls"] = sum(wall_counts.values())
        z_totals["vitrine"] = bl.build_vitrine(zone.get("vitrine"), materials_lookup, shell, col_coll)
        z_totals["checkouts"] = bl.build_checkouts(zone.get("checkouts"), mesh_lookup, proxy_map, props_coll, col_coll)
        z_totals["gondolas"] = bl.build_gondolas(zone.get("gondolas"), mesh_lookup, proxy_map, props_coll, col_coll)
        z_totals["racks"] = bl.build_racks(zone.get("racks"), mesh_lookup, proxy_map, props_coll, col_coll)

        mezz = zone.get("mezzanine")
        if mezz:
            z_totals["mezz_floor"] = bl.tile_floor(mezz["floor"], mesh_lookup, proxy_map, shell, col_coll,
                                                    z=mezz["floor"]["z"])
            z_totals["stairs"] = bl.build_mezzanine_stairs(mezz.get("stairs"), mesh_lookup, proxy_map,
                                                            props_coll, col_coll)
            z_totals["railing"] = bl.build_mezzanine_railing(mezz.get("railing"), mesh_lookup, proxy_map,
                                                              props_coll, col_coll)

        pallet_count, crate_count = bl.build_storage_props(zone.get("storage_props"), mesh_lookup, proxy_map,
                                                             props_coll, col_coll)
        z_totals["pallets"] = pallet_count
        z_totals["crates"] = crate_count
        z_totals["door"] = bl.build_door_frame(zone.get("door_frame"), mesh_lookup, proxy_map, shell, col_coll)
        z_totals["leaf"] = bl.build_door_leaf(zone.get("door_frame"), mesh_lookup, proxy_map, shell, col_coll)
        z_totals["dock"] = bl.build_dock_door(zone.get("dock_door"), mesh_lookup, proxy_map, materials_lookup, shell, col_coll)
        z_totals["ceiling"] = bl.build_ceiling(zone, zone["floor"], mesh_lookup, proxy_map, shell, col_coll)
        z_totals["corners"] = bl.build_wall_corners(zone["walls"], mesh_lookup, proxy_map, shell, col_coll)
        detail_counts = bl.build_kit_details(zone.get("kit_details"), mesh_lookup, proxy_map, props_coll, col_coll)
        z_totals["details"] = sum(detail_counts.values())

        include_player = (letter == "a")
        z_totals["spawns"] = bl.build_spawns(zone, logic_coll, include_player=include_player)
        z_totals["use"] = bl.build_use_objects(zone, materials_lookup, logic_coll)
        z_totals["secrets"] = bl.build_secret_zones(zone, materials_lookup, logic_coll)
        light_count, spacing_x, spacing_y = bl.build_lighting(zone, zone["floor"], lights_coll, energy=light_energy)
        z_totals["lights"] = light_count

        totals.update(z_totals)
        per_zone_report.append((letter, zone["name"], z_totals))

    # --- Couloirs de connexion --------------------------------------------
    connector_report = []
    for name, axis, x0, x1, y0, y1 in CONNECTORS:
        floor_count, wall_count = build_connector(axis, x0, x1, y0, y1, mesh_lookup, proxy_map, shell, col_coll)
        totals["floor"] += floor_count
        totals["walls"] += wall_count
        connector_report.append((name, floor_count, wall_count))

    # --- Nettoyage des mondes orphelins -------------------------------------
    # 6 mondes existent à ce stade, pas 5 (wipe_scene() ne touche jamais
    # bpy.data.worlds) : voir
    # docs/pipeline/niveau-blender.md#mondes-orphelins-dans-le-niveau-combiné
    # pour le détail. Seul le DERNIER assigné (celui de la Zone E) doit
    # rester ; comparaison par NOM plutôt que par identité Python d'objet —
    # pas de raison de faire confiance à `is` pour des wrappers RNA capturés
    # à des moments différents.
    active_world_name = bpy.context.scene.world.name if bpy.context.scene.world else None
    removed_worlds = 0
    for w in list(bpy.data.worlds):
        if w.name != active_world_name:
            bpy.data.worlds.remove(w)
            removed_worlds += 1

    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=out)

    print("\n" + "=" * 70)
    print("BUILD COMBINED LEVEL — hypermarche_complet")
    print("=" * 70)
    for letter, name, z_totals in per_zone_report:
        print(f"  Zone {letter.upper()} ({name}) : " + "  ".join(f"{k}:{v}" for k, v in sorted(z_totals.items())))
    print("-" * 70)
    for name, fc, wc in connector_report:
        print(f"  Connecteur {name} : sol {fc}  murs {wc}")
    print("-" * 70)
    print("  TOTAUX : " + "  ".join(f"{k}:{v}" for k, v in sorted(totals.items())))
    print(f"  Mondes orphelins supprimés : {removed_worlds}")
    print(f"  Fichier : {out}")
    print("=" * 70 + "\n")

    sys.exit(0)


if __name__ == "__main__":
    main()
