"""
Assemblage d'un niveau à partir du kit modulaire — PROJET_CASSANDRE.

    blender -b --factory-startup -P tools/blender/build_level.py -- \\
        --zone a --kit assets_src/blender/kit_hypermarche.blend \\
        --out assets_src/blender/zone_a_parking.blend

    blender -b --factory-startup -P tools/blender/build_level.py -- \\
        --zone b --kit assets_src/blender/kit_hypermarche.blend \\
        --out assets_src/blender/zone_b_caisses.blend

    blender -b --factory-startup -P tools/blender/build_level.py -- \\
        --zone c --kit assets_src/blender/kit_hypermarche.blend \\
        --out assets_src/blender/zone_c_rayons.blend

    blender -b --factory-startup -P tools/blender/build_level.py -- \\
        --zone d --kit assets_src/blender/kit_hypermarche.blend \\
        --out assets_src/blender/zone_d_reserve.blend

    blender -b --factory-startup -P tools/blender/build_level.py -- \\
        --zone e --kit assets_src/blender/kit_hypermarche.blend \\
        --out assets_src/blender/zone_e_bureau.blend

Options :
    --zone a|b|c|d|e     quelle entrée de `level_spec.ZONES` construire
    --kit PATH          .blend source du kit (défaut assets_src/blender/kit_hypermarche.blend)
    --out PATH          .blend produit (défaut assets_src/blender/<nom de la zone>.blend)
    --light-energy W    puissance des area lights de plafond (défaut 180 —
                        calibré pour éviter l'écrêtage sur une pièce de la
                        taille d'une zone ; le rig du kit utilise 900 W mais
                        sur un étalage bien plus dégagé, voir build_kit.py)

Code retour : 0 = niveau assemblé, 1 = échec (dont un run de mur qui ne tile
pas exactement — voir `plan_wall_run`, ce script NE BIDOUILLE PAS un reste).

Ce script exécute mécaniquement le plan donné par l'humain (`level_spec.py`) :
il ne décide d'aucun placement, il tile des runs de mur, pose des tuiles de
sol, construit la vitrine sur-mesure et les caisses, place les spawns/objets
interactifs, et pose un rig d'éclairage de secteur. Le bake lui-même est un
script séparé (`bake_vertex_lighting.py`), suivi par `validate_level.py` puis
`export_level.py` — voir `tools/blender/README.md` pour la chaîne complète.

## Le piège instancing-vs-bake (résolu ici, à ne pas réintroduire)

`modular-kit-design` recommande de partager un même mesh-datablock entre
toutes les instances d'une pièce ("Add -> Collection Instance", ou ici,
plusieurs `Object` référençant le même `Mesh`). C'est correct pour la
BIBLIOTHÈQUE du kit, où chaque pièce n'existe qu'UNE fois.

Mais les couleurs de sommet ("Col") vivent sur le MESH-DATABLOCK, pas sur
l'`Object`. Si 24 instances de `kit_wall_4m` dans un niveau partagent le même
mesh, un bake ne peut écrire qu'UN SEUL jeu de couleurs — soit l'opérateur
Cycles refuse (mesh multi-utilisateur), soit toutes les instances héritent du
même dégradé, qui n'a de sens que pour l'UNE d'entre elles. Un mur près de la
vitrine et un mur à l'autre bout de la pièce n'ont pas le même éclairage.

`place_kit_piece` fait donc un `mesh.copy()` (single-user) pour chaque
RENDU placé, afin que chaque instance porte son propre bake. Les PROXIES
`col_*`, eux, ne sont jamais bakés ni rendus : ils restent partagés (mesh
identique), ce qui est correct et moins coûteux en mémoire.
"""

from __future__ import annotations

import math
import os
import sys
from collections import Counter

import bpy

# `blender -P` n'ajoute pas le dossier du script au sys.path.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import kit_spec as spec       # noqa: E402
import level_spec             # noqa: E402
import geo_utils               # noqa: E402


# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------

def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg_value(args: list[str], flag: str, default):
    return args[args.index(flag) + 1] if flag in args else default


# ---------------------------------------------------------------------------
# Append depuis le kit
# ---------------------------------------------------------------------------

def append_kit_data(kit_path: str, mesh_names: list[str], material_names: list[str]):
    """Append (PAS link) : le niveau contient des copies locales, pas une
    dépendance de bibliothèque externe — cohérent avec `.blend` autonome et
    exportable. Matériaux demandés EXPLICITEMENT (et non laissés à la
    résolution implicite des dépendances de mesh) : un niveau peut avoir
    besoin d'un matériau (ex. `mat_kit_detail` pour `use_crowbar`) qu'aucune
    pièce de kit appendue n'utilise elle-même."""
    wanted_meshes = set(mesh_names)
    wanted_materials = set(material_names)
    with bpy.data.libraries.load(kit_path, link=False) as (data_from, data_to):
        missing_meshes = wanted_meshes - set(data_from.meshes)
        missing_materials = wanted_materials - set(data_from.materials)
        if missing_meshes or missing_materials:
            raise RuntimeError(
                f"[build_level] introuvable(s) dans {kit_path} — "
                f"meshes manquants: {sorted(missing_meshes)}  "
                f"matériaux manquants: {sorted(missing_materials)}"
            )
        data_to.meshes = [n for n in data_from.meshes if n in wanted_meshes]
        data_to.materials = [n for n in data_from.materials if n in wanted_materials]

    meshes = {n: bpy.data.meshes[n] for n in mesh_names}
    materials = {n: bpy.data.materials[n] for n in material_names}
    return meshes, materials


def gather_kit_mesh_names(piece_names: list[str]) -> tuple[list[str], dict[str, list[str]]]:
    """Noms de mesh à appender (rendu + proxies) pour une liste de pièces, et
    la table pièce -> noms de ses proxies (pour `place_kit_piece`)."""
    names: list[str] = []
    proxy_map: dict[str, list[str]] = {}
    for piece_name in piece_names:
        piece = spec.find_piece(piece_name)
        names.append(piece_name)
        proxies = spec.proxy_names_for(piece)
        proxy_map[piece_name] = proxies
        names.extend(proxies)
    return names, proxy_map


# ---------------------------------------------------------------------------
# Placement d'une pièce de kit
# ---------------------------------------------------------------------------

def place_kit_piece(piece_name: str, mesh_lookup: dict, proxy_map: dict,
                     location: tuple[float, float, float], rot_deg: float,
                     render_coll: bpy.types.Collection, col_coll: bpy.types.Collection) -> bpy.types.Object:
    # `.copy()` : voir la doc de tête de fichier (piège instancing-vs-bake).
    unique_mesh = mesh_lookup[piece_name].copy()
    render_obj = bpy.data.objects.new(piece_name, unique_mesh)
    render_obj.location = location
    render_obj.rotation_euler = (0.0, 0.0, math.radians(rot_deg))
    render_coll.objects.link(render_obj)

    for proxy_name in proxy_map.get(piece_name, []):
        # Proxy : jamais bake, jamais rendu — mesh partagé, pas de copy().
        proxy_obj = bpy.data.objects.new(proxy_name, mesh_lookup[proxy_name])
        proxy_obj.location = location
        proxy_obj.rotation_euler = (0.0, 0.0, math.radians(rot_deg))
        col_coll.objects.link(proxy_obj)

    return render_obj


# ---------------------------------------------------------------------------
# Tiling de mur — voir `level_spec.py` pour le format `wall_run`
# ---------------------------------------------------------------------------

def _normalize(v: tuple[float, float]) -> tuple[tuple[float, float], float]:
    length = math.hypot(v[0], v[1])
    if length < 1e-9:
        raise ValueError(f"vecteur nul : {v}")
    return (v[0] / length, v[1] / length), length


def _rotate90(v: tuple[float, float]) -> tuple[float, float]:
    """Rotation +90° (CCW) — pour une rotation propre (déterminant +1), la
    seule direction atteignable pour l'axe local +Y quand l'axe local +X est
    fixé sur `run_dir` est TOUJOURS cette rotation de +90° de `run_dir`. Si
    `outward` demandé est l'opposé, on inverse le sens de PARCOURS du run
    (voir `plan_wall_run`) plutôt que de mirror la géométrie."""
    return (-v[1], v[0])


def plan_wall_run(run: dict, modules=None) -> dict:
    """Calcule les segments (pièce, position monde, rotation Z) qui couvrent
    un `wall_run` de `level_spec.py`, en choisissant à chaque pas le plus
    grand module qui tient (4 m puis 2 m puis 1 m — `level_spec.WALL_MODULES`).

    Ne fait AUCUNE hypothèse sur quel mur du rectangle c'est : la géométrie
    (longueur, angle, sens de parcours) est dérivée par vecteurs à partir de
    `start`/`end`/`outward` uniquement. Un `outward` qui n'est pas exactement
    perpendiculaire au run est une erreur de donnée (`level_spec.py`), pas
    quelque chose que ce script doit deviner ou corriger.
    """
    modules = modules or level_spec.WALL_MODULES
    start, end, outward = run["start"], run["end"], run["outward"]
    thickness = run.get("thickness", level_spec.WALL_THICKNESS)

    run_dir, length = _normalize((end[0] - start[0], end[1] - start[1]))
    outward_n, _ = _normalize(outward)

    left_perp = _rotate90(run_dir)
    dot = left_perp[0] * outward_n[0] + left_perp[1] * outward_n[1]
    if dot < 0:
        # `outward` demandé est le PERPENDICULAIRE OPPOSÉ : on parcourt le run
        # en sens inverse plutôt que de mirror la géométrie (voir _rotate90).
        start, end = end, start
        run_dir = (-run_dir[0], -run_dir[1])
        left_perp = _rotate90(run_dir)
        dot = left_perp[0] * outward_n[0] + left_perp[1] * outward_n[1]

    if dot < 0.99:
        raise ValueError(
            f"[build_level] outward {outward} n'est pas perpendiculaire au run "
            f"{run['start']}->{run['end']} (dot={dot:.3f}) — corriger level_spec.py, "
            f"pas ce script"
        )

    theta_deg = math.degrees(math.atan2(run_dir[1], run_dir[0]))

    segments = []
    cursor, remaining = 0.0, length
    while remaining > 1e-6:
        chosen_len = chosen_piece = None
        for module_len, piece_name in modules:
            if module_len <= remaining + 1e-6:
                chosen_len, chosen_piece = module_len, piece_name
                break
        if chosen_len is None:
            break  # reste plus petit que le plus petit module — voir `remainder`
        seg_x = start[0] + run_dir[0] * cursor
        seg_y = start[1] + run_dir[1] * cursor
        segments.append({"piece": chosen_piece, "length": chosen_len,
                          "x": seg_x, "y": seg_y, "rot_deg": theta_deg})
        cursor += chosen_len
        remaining -= chosen_len

    return {"segments": segments, "remainder": max(0.0, remaining),
            "length": length, "thickness": thickness}


def build_walls(wall_specs: list[dict], mesh_lookup, proxy_map,
                 shell_coll, col_coll) -> tuple[Counter, float]:
    counts: Counter = Counter()
    total_remainder = 0.0
    for run in wall_specs:
        plan = plan_wall_run(run)
        if plan["remainder"] > 1e-6:
            print(f"[build_level] ATTENTION : reste non tilé de {plan['remainder']:.3f} m "
                  f"sur le run {run['start']} -> {run['end']} "
                  f"(longueur {plan['length']:.3f} m, aucun module assez petit) — "
                  f"le plan ne tile pas exactement, corriger level_spec.py")
            total_remainder += plan["remainder"]
        for seg in plan["segments"]:
            place_kit_piece(seg["piece"], mesh_lookup, proxy_map,
                             (seg["x"], seg["y"], 0.0), seg["rot_deg"], shell_coll, col_coll)
            counts[seg["piece"]] += 1
    return counts, total_remainder


# ---------------------------------------------------------------------------
# Sol
# ---------------------------------------------------------------------------

def tile_floor(floor_spec: dict, mesh_lookup, proxy_map, shell_coll, col_coll,
                z: float = 0.0) -> int:
    """`z` optionnel (défaut 0.0, le sol au sol) : la Zone D réutilise cette
    même fonction pour la dalle de mezzanine (`kit_floor_4x4` posé à z=2.0 —
    son origine est le coin de la SURFACE DE MARCHE, poser à z=2.0 fait donc
    marcher à z=2.0, voir kit_spec.py), sans dupliquer la logique de tiling."""
    x0, x1 = floor_spec["x"]
    y0, y1 = floor_spec["y"]
    tile = floor_spec["tile"]
    width, depth = x1 - x0, y1 - y0
    nx_f, ny_f = width / tile, depth / tile
    if abs(nx_f - round(nx_f)) > 1e-6 or abs(ny_f - round(ny_f)) > 1e-6:
        raise ValueError(
            f"[build_level] sol {width:.3f} x {depth:.3f} m ne se divise pas en "
            f"tuiles de {tile} m sans reste (nx={nx_f:.4f}, ny={ny_f:.4f}) — "
            f"corriger level_spec.py, ne pas tronquer silencieusement"
        )
    nx, ny = int(round(nx_f)), int(round(ny_f))
    for i in range(nx):
        for j in range(ny):
            loc = (x0 + i * tile, y0 + j * tile, z)
            place_kit_piece("kit_floor_4x4", mesh_lookup, proxy_map, loc, 0.0, shell_coll, col_coll)
    return nx * ny


# ---------------------------------------------------------------------------
# Vitrine sur-mesure (Zone A)
# ---------------------------------------------------------------------------

def build_vitrine(vitrine_spec: dict | None, materials_lookup: dict,
                   shell_coll, col_coll) -> int:
    """Deux boîtes pleines, même rigueur que le kit (subdivision au mètre,
    UV 64 px/m, attribut "Col", proxy cuboid) mais construites directement en
    coordonnées MONDE (pas d'origine locale à un coin de pièce réutilisable —
    la vitrine n'est posée qu'une fois, ce n'est pas un module du kit)."""
    if vitrine_spec is None:
        return 0
    x0, x1 = vitrine_spec["x"]
    y = vitrine_spec["y"]
    thickness = vitrine_spec["thickness"]
    width = x1 - x0

    count = 0
    for band in vitrine_spec["bands"]:
        z0, z1 = band["z"]
        height = z1 - z0
        name = band["name"]
        origin = (x0, y, z0)
        size = (width, thickness, height)

        parts = [{"o": origin, "s": size, "mat": spec.MAT_SHELL}]
        render_obj = geo_utils.build_multi_box_mesh(name, parts, spec.MAT_SHELL, materials_lookup)
        # Coordonnées MONDE déjà baked dans le mesh -> objet à l'origine,
        # transforms triviellement "appliqués" (scale 1, rotation 0).
        render_obj.location = (0.0, 0.0, 0.0)
        shell_coll.objects.link(render_obj)

        proxy_obj = geo_utils.build_proxy_object(f"col_box_{name}", "box", origin, size)
        col_coll.objects.link(proxy_obj)

        count += 1
    return count


def build_floor_patches(patches: list[dict] | None, materials_lookup: dict,
                         shell_coll, col_coll) -> int:
    """Dalle(s) de sol SUR-MESURE, même rigueur que `build_vitrine` juste
    au-dessus (subdivision au mètre, UV 64 px/m, proxy cuboid, transforms
    appliqués en coordonnées MONDE), pour une empreinte qui NE TILE PAS
    proprement en 4 m avec `kit_floor_4x4` (ex. l'alcôve 3×2 m du secret 1,
    Zone B — voir `level_spec.py`). Même convention d'origine que
    `kit_floor_4x4` (surface de marche, la dalle descend sous `z`,
    épaisseur `kit_spec.SLAB_T`).

    PIÈGE DÉCOUVERT (nouveau, propre à cette tâche) : étendre le rectangle
    englobant du `"floor"` d'une zone pour couvrir une alcôve qui déborde
    HORS de son empreinte existante (contrairement à la vitrine/l'alcôve de
    sortie de la Zone A/E, qui restent DANS l'empreinte) semble anodin sur
    la zone seule, mais une fois cette zone TRANSLATÉE dans le niveau
    combiné (`build_combined_level.py`), l'extension peut retomber
    exactement sur la géométrie d'une autre zone ou d'un connecteur — mesuré
    en assemblant `hypermarche_complet` : la Zone B étendue à l'ouest
    (X0=-16) chevauchait EXACTEMENT le connecteur A-B une fois translatée
    par dx=26, dupliquant une tuile de sol au même endroit (auto-occultation
    au bake, 2 meshes noirs). Une dalle sur-mesure, limitée à l'empreinte
    réelle du besoin, ne peut par construction chevaucher rien d'autre."""
    if not patches:
        return 0
    slab_t = spec.SLAB_T
    count = 0
    for patch in patches:
        x0, x1 = patch["x"]
        y0, y1 = patch["y"]
        z = patch.get("z", 0.0)
        name = patch["name"]
        width, depth = x1 - x0, y1 - y0
        origin = (x0, y0, z - slab_t)
        size = (width, depth, slab_t)

        parts = [{"o": origin, "s": size, "mat": spec.MAT_SHELL}]
        render_obj = geo_utils.build_multi_box_mesh(name, parts, spec.MAT_SHELL, materials_lookup)
        render_obj.location = (0.0, 0.0, 0.0)
        shell_coll.objects.link(render_obj)

        proxy_obj = geo_utils.build_proxy_object(f"col_box_{name}", "box", origin, size)
        col_coll.objects.link(proxy_obj)

        count += 1
    return count


# ---------------------------------------------------------------------------
# Caisses (Zone B)
# ---------------------------------------------------------------------------

def build_checkouts(checkout_spec: dict | None, mesh_lookup, proxy_map,
                     props_coll, col_coll) -> int:
    if checkout_spec is None:
        return 0
    piece = checkout_spec["piece"]
    y = checkout_spec["y"]
    count = 0
    for x in checkout_spec["x_origins"]:
        place_kit_piece(piece, mesh_lookup, proxy_map, (x, y, 0.0), 0.0, props_coll, col_coll)
        count += 1
    return count


# ---------------------------------------------------------------------------
# Porte de sortie (Zone E) — encadrement, PAS une porte animée
# ---------------------------------------------------------------------------

def build_door_frame(door_spec: dict | None, mesh_lookup, proxy_map,
                      shell_coll, col_coll) -> int:
    """`kit_door_2m` : un encadrement de mur avec découpe de porte intégrée
    (compound de 3 cuboids, voir `kit_spec.py::_wall_opening_parts`), PAS
    forcément un `kit_door_leaf`/`door_*` animé (voir `door_spec["leaf_name"]`,
    `build_door_leaf` ci-dessous — absent = encadrement traversable, comme
    la Zone E avant sa porte à badge). Posée dans une brèche de `wall_run`.

    `door_spec["rot_deg"]` (optionnel, défaut 0.0) : même origine (coin,
    x∈[0,W], y∈[0,WALL_T]) et même orientation par défaut que `kit_wall_2m`,
    donc `rot_deg=0.0` convient telle quelle pour une brèche dans un mur
    HORIZONTAL (run le long de +X, theta_deg=0° — cas de la Zone E, aucune
    rotation nécessaire, vérifié contre `plan_wall_run`). Une brèche dans un
    mur VERTICAL (ex. la porte du secret 1, Zone B, mur ouest) a besoin de
    `rot_deg=90.0`, EXACTEMENT comme n'importe quel `kit_wall_2m` posé par
    `plan_wall_run` sur ce même run — `door_spec["x"]`/`["y"]` doivent alors
    être le coin (avant rotation) qu'aurait ce run à cet endroit, pas une
    coordonnée devinée (voir le commentaire de `level_spec.ZONE_B["door_frame"]`
    pour le calcul)."""
    if door_spec is None:
        return 0
    place_kit_piece(door_spec["piece"], mesh_lookup, proxy_map,
                     (door_spec["x"], door_spec["y"], 0.0),
                     door_spec.get("rot_deg", 0.0), shell_coll, col_coll)
    return 1


# Géométrie de l'ouverture de `kit_door_2m`, dupliquée depuis l'appel
# `_wall_opening_parts(2.0, 0.25, 1.5, 2.5)` dans `kit_spec.py` (jamb=0.25,
# ouverture 1.5 x 2.5) — même politique de duplication déjà en place pour
# `level_spec.WALL_THICKNESS`/`WALL_HEIGHT` (un commentaire qui pointe vers
# la source plutôt qu'un import d'un nombre magique non nommé).
DOOR_JAMB = 0.25
DOOR_OPEN_W = 1.5
DOOR_OPEN_H = 2.5


def build_door_leaf(door_spec: dict | None, mesh_lookup, proxy_map,
                     shell_coll, col_coll) -> int:
    """Pose `kit_door_leaf` (renommé `door_*` en niveau) centré dans
    l'ouverture du `kit_door_2m` posé juste avant par `build_door_frame`.
    `door_spec` doit porter une clé optionnelle `"leaf_name"` (ex.
    `"door_e_exit"`) ; sans elle, aucun vantail n'est posé — un `door_frame`
    reste alors un simple encadrement traversable, comportement inchangé.

    PIÈGE DÉCOUVERT, propre à `door_*` (nouveau, absent de tout `col_*`
    jusqu'ici) : `loader.ts::buildDoor` pose le corps Rapier dynamique à la
    position DÉCOMPOSÉE DIRECTEMENT de `mesh.matrixWorld` (donc l'origine
    locale de l'OBJET), et calcule les demi-étendues depuis la bounding box
    LOCALE du mesh — CONTRAIREMENT à `buildCuboidCollider` (tout
    `col_box_*`), qui recentre explicitement (`localCenter` calculé puis
    reprojeté en repère monde, voir `loader.ts`). Si le vantail gardait la
    convention du reste du kit (origine à un COIN, x∈[0,1.5] etc. — c'est le
    cas du mesh-datablock `kit_door_leaf` dans `kit_hypermarche.blend`), le
    corps physique se retrouverait centré sur ce COIN : la moitié du
    collider tomberait hors du battant rendu. `loader.ts` est hors scope de
    cette tâche (contrat déjà câblé, non modifié) : c'est donc la géométrie
    qui doit s'y conformer. `kit_door_leaf` est le SEUL objet posé par ce
    script dont l'origine locale est recentrée sur le centre de sa boîte
    englobante plutôt que laissée au coin — uniquement sur l'INSTANCE de
    NIVEAU (mesh copié, voir `.copy()` ci-dessous) ; le mesh-datablock du kit
    lui-même reste inchangé (convention coin, cohérent avec le reste du kit
    et `inspect_kit.py`).

    Centre monde choisi : Z au centre exact de l'ouverture (moitié de la
    hauteur d'ouverture, vantail posé au sol). Dans le repère LOCAL du cadre
    (avant rotation), X est au centre exact de l'ouverture (jambage + moitié
    de la largeur d'ouverture) et Y est CALÉ SUR LA FACE INTÉRIEURE du cadre
    (`door_spec["y"]`, la même face de référence que tout `wall_run` du
    projet) plutôt que centré dans l'épaisseur du mur (0.25 m) : un centrage
    dans l'épaisseur donnerait un Y à `door_spec["y"] + (WALL_T - leaf_d)/2`,
    qui n'est PAS un multiple de la grille 0.25 m pour les dimensions de ce
    kit (0.25 et 0.15 ne produisent pas un tel multiple) —
    `validate_level.py` avertirait sans qu'il s'agisse d'une contrainte
    figée d'un kit déjà construit (contrairement à `use_crowbar`). Caler sur
    la face retombe exactement sur la grille, sans aucune exception.

    `door_spec["rot_deg"]` (optionnel, défaut 0.0, voir `build_door_frame`) :
    ce centre LOCAL (calculé comme si le cadre n'était pas tourné) est
    tourné de `rot_deg` autour de Z avant d'être ajouté à `(frame_x, frame_y)`
    — exactement la même géométrie que `place_kit_piece`/`plan_wall_run`
    appliquerait à n'importe quelle pièce posée à ce coin avec cette
    rotation. Pour `rot_deg=0.0` (Zone E), cette rotation est un no-op et le
    résultat est identique à l'ancien calcul non généralisé (X décalé,
    Y = frame_y). Pour `rot_deg=90.0` (Zone B, mur ouest vertical), l'offset
    local (le long de l'axe X du cadre) se retrouve le long de l'axe Y
    MONDE, et `frame_x` devient la face intérieure — cohérent avec la façon
    dont `plan_wall_run` fait pivoter tout module de mur sur ce même run."""
    if door_spec is None or not door_spec.get("leaf_name"):
        return 0

    piece_name = "kit_door_leaf"
    leaf_w, leaf_d, leaf_h = spec.find_piece(piece_name)["dims"]
    if abs(leaf_w - DOOR_OPEN_W) > 1e-6 or abs(leaf_h - DOOR_OPEN_H) > 1e-6:
        raise ValueError(
            "[build_level] kit_door_leaf ne correspond plus à l'ouverture de "
            "kit_door_2m — mettre à jour DOOR_OPEN_W/DOOR_OPEN_H"
        )

    frame_x, frame_y = door_spec["x"], door_spec["y"]
    rot_deg = door_spec.get("rot_deg", 0.0)
    theta = math.radians(rot_deg)
    local_offset = DOOR_JAMB + DOOR_OPEN_W / 2.0
    center = (
        frame_x + local_offset * math.cos(theta),
        frame_y + local_offset * math.sin(theta),
        DOOR_OPEN_H / 2.0,
    )

    # `.copy()` : même règle que `place_kit_piece` (piège instancing-vs-bake,
    # voir tête de fichier) — cette instance doit porter son propre bake.
    unique_mesh = mesh_lookup[piece_name].copy()
    for v in unique_mesh.vertices:
        v.co.x -= leaf_w / 2.0
        v.co.y -= leaf_d / 2.0
        v.co.z -= leaf_h / 2.0

    leaf_obj = bpy.data.objects.new(door_spec["leaf_name"], unique_mesh)
    leaf_obj.location = center
    leaf_obj.rotation_euler = (0.0, 0.0, theta)
    shell_coll.objects.link(leaf_obj)
    # Pas de proxy : `kit_door_leaf.proxies == []` (kit_spec.py) — le
    # collider dynamique vient de `loader.ts::buildDoor`, jamais d'un `col_*`
    # compagnon (qui resterait STATIQUE et bloquerait même une fois la porte
    # "ouverte"/déplacée par le jeu — voir la note du kit).
    return 1


# ---------------------------------------------------------------------------
# Gondoles (Zone C)
# ---------------------------------------------------------------------------

def _build_row_run(piece_name: str, end_name: str | None, x: float,
                    y_range: tuple[float, float], mesh_lookup, proxy_map,
                    props_coll, col_coll, rot_deg: float = 90.0) -> int:
    """Tile `piece_name` le long de Y (de `y_range[0]` à `y_range[1]`) à
    l'abscisse monde `x`, en tournant chaque instance de `rot_deg` pour
    aligner sa longueur locale (axe X du kit) sur l'axe monde Y — même
    mécanique que `plan_wall_run`/`_rotate90` pour les murs.

    Logique PARTAGÉE entre `build_gondolas` (Zone C, `end_name` fourni : un
    `kit_gondola_end` accolé à chaque extrémité, bloque la vue latérale) et
    `build_racks` (Zone D, `end_name=None` : `kit_rack_4m` n'a pas de pièce
    d'about dans le kit, la rangée finit à nu — réaliste pour du rayonnage
    industriel).

    Grille 0.25 m — décision MÉCANIQUE, pas de layout : `x` est utilisé TEL
    QUEL comme coordonnée d'un COIN de la pièce (convention « origine =
    coin » du kit, `kit_spec.py` en-tête), jamais comme centre de sa
    profondeur. Centrer une pièce profonde de 1.25 m (gondole) ou 1.2 m
    (rack) pile sur `x` demanderait un décalage qui n'est pas forcément un
    multiple de 0.25 m et ferait échouer `validate_level.py` (warning
    « hors grille », bloquant sous `--strict`). Utiliser `x` comme bord
    (pas comme centre) garde chaque coin sur la grille tout en préservant
    EXACTEMENT l'espacement centre-à-centre donné par `level_spec.py`.
    Conséquence mécanique acceptée (documentée à l'appel, pas ici) : la
    rotation +90° décale l'empreinte de la profondeur locale vers -X, donc
    deux rangées à des abscisses symétriques (ex. -6.0 / 4.0) ne produisent
    PAS des empreintes miroir l'une de l'autre — sous-produit du choix
    « grille exacte, pas de reste silencieux », pas une décision de layout.
    """
    piece_len = spec.find_piece(piece_name)["dims"][0]
    y0, y1 = y_range
    run_len = y1 - y0
    n_f = run_len / piece_len
    if abs(n_f - round(n_f)) > 1e-6:
        raise ValueError(
            f"[build_level] rangée x={x} : longueur {run_len:.3f} m "
            f"ne se divise pas en modules de {piece_len} m sans reste "
            f"(n={n_f:.4f}) — corriger level_spec.py, pas de reste silencieux"
        )
    n = int(round(n_f))

    count = 0
    cursor = y0
    for _ in range(n):
        place_kit_piece(piece_name, mesh_lookup, proxy_map,
                         (x, cursor, 0.0), rot_deg, props_coll, col_coll)
        cursor += piece_len
        count += 1

    if end_name:
        end_len = spec.find_piece(end_name)["dims"][0]
        # Capuchons : accolés à chaque extrémité (bloquent la vue latérale
        # depuis l'allée voisine), même bord X que le corps de la rangée —
        # aucun jour entre le dernier module et son capuchon.
        place_kit_piece(end_name, mesh_lookup, proxy_map,
                         (x, y0 - end_len, 0.0), rot_deg, props_coll, col_coll)
        place_kit_piece(end_name, mesh_lookup, proxy_map,
                         (x, y1, 0.0), rot_deg, props_coll, col_coll)
        count += 2

    return count


def build_gondolas(gondola_spec: dict | None, mesh_lookup, proxy_map,
                    props_coll, col_coll) -> int:
    """Rangées de `kit_gondola_4m` (+ capuchons `kit_gondola_end`), orientées
    le long de Y — perpendiculaire à leur orientation par défaut dans le kit.
    Voir `_build_row_run` pour la mécanique (rotation, convention de coin,
    asymétrie acceptée). Deux allées centrales à EXACTEMENT 3.0 m entre les
    trois rangées de la Zone C (vérifié par calcul), couloirs latéraux
    6.5 m / 7.75 m (pas rigoureusement symétriques, conséquence acceptée)."""
    if gondola_spec is None:
        return 0
    piece_name = gondola_spec["piece"]
    end_name = gondola_spec["end_piece"]
    count = 0
    for row in gondola_spec["rows"]:
        count += _build_row_run(piece_name, end_name, row["x"], row["y"],
                                 mesh_lookup, proxy_map, props_coll, col_coll)
    return count


def build_racks(racks_spec: dict | None, mesh_lookup, proxy_map,
                 props_coll, col_coll) -> int:
    """Rangées de `kit_rack_4m`, SANS capuchon de bout (aucune pièce d'about
    pour ce module dans le kit — les rangées finissent à nu, réaliste pour
    du rayonnage industriel). Même mécanique que `build_gondolas`, voir
    `_build_row_run`."""
    if racks_spec is None:
        return 0
    piece_name = racks_spec["piece"]
    count = 0
    for row in racks_spec["rows"]:
        count += _build_row_run(piece_name, None, row["x"], row["y"],
                                 mesh_lookup, proxy_map, props_coll, col_coll)
    return count


# ---------------------------------------------------------------------------
# Mezzanine (Zone D) — escalier double + rambarde
# ---------------------------------------------------------------------------

def build_mezzanine_stairs(stairs_spec: dict | None, mesh_lookup, proxy_map,
                            props_coll, col_coll) -> int:
    """Escalier double : deux `kit_stairs_2m` posés côte à côte.

    PIÈGE DÉCOUVERT (vérifié empiriquement en instanciant la pièce et en
    lisant sa bounding box monde après rotation, pas seulement par calcul) :
    `kit_stairs_2m` ne monte vers +Y QUE sous rotation +90° en Z (sans
    rotation, la pente est le long de X — inutile ici, la mezzanine est au
    nord). Or cette même rotation +90°, comme pour les gondoles/racks
    (`_build_row_run`), décale l'empreinte de la LARGEUR locale de la pièce
    (`dims[1]`, 2 m) vers -X à partir de l'origine Blender, PAS vers +X.

    Un placement naïf des positions telles que données par `level_spec.py`
    (coin bas Blender AVANT rotation, ex. x=-2.0 et x=0.0) ferait donc
    atterrir les deux marches sur X∈[-4,0] au lieu de X∈[-2,2] — précisément
    SOUS le segment de rambarde solide voisin (`x_runs` s'arrête à X=-2,
    voir `build_mezzanine_railing`), bloquant le haut de l'escalier contre
    une rambarde pleine. Ce n'est pas une asymétrie cosmétique acceptable
    (comme les couloirs de gondoles/racks) : c'est une collision entre deux
    pièces que le plan lui-même place bord à bord ailleurs (la brèche de
    rambarde EST calculée pour loger l'escalier).

    Correction MÉCANIQUE (pas une décision de layout — la position de la
    brèche ne change pas, seule la valeur intermédiaire passée à Blender est
    ajustée pour l'atteindre) : on ajoute `dims[1]` (largeur locale) à
    chaque abscisse donnée avant l'appel à `place_kit_piece`, ce qui fait
    tomber l'empreinte réelle exactement sur X∈[x, x+largeur] au lieu de
    X∈[x-largeur, x] — soit X∈[-2,0] et X∈[0,2], combiné X∈[-2,2], comme le
    veut le plan.
    """
    if stairs_spec is None:
        return 0
    piece_name = stairs_spec["piece"]
    width = spec.find_piece(piece_name)["dims"][1]
    ROT_DEG = 90.0
    count = 0
    for (x, y, z) in stairs_spec["positions"]:
        place_kit_piece(piece_name, mesh_lookup, proxy_map,
                         (x + width, y, z), ROT_DEG, props_coll, col_coll)
        count += 1
    return count


def build_mezzanine_railing(railing_spec: dict | None, mesh_lookup, proxy_map,
                             props_coll, col_coll) -> int:
    """Tile `kit_railing_2m` (2 m, aucun module plus petit) le long de chaque
    `x_runs`. La longueur locale de la pièce (axe X) est DÉJÀ alignée sur
    l'axe monde X des runs (rambarde le long d'un mur nord-sud constant en
    Y) : aucune rotation nécessaire, contrairement aux murs/gondoles/racks/
    escalier. Chaque run DOIT tomber juste (multiple de 2 m) — échec bruyant
    sinon, même contrat que les autres tilings de ce fichier."""
    if railing_spec is None:
        return 0
    piece_name = railing_spec["piece"]
    piece_len = spec.find_piece(piece_name)["dims"][0]
    y = railing_spec["y"]
    z = railing_spec["z"]
    count = 0
    for x0, x1 in railing_spec["x_runs"]:
        run_len = x1 - x0
        n_f = run_len / piece_len
        if abs(n_f - round(n_f)) > 1e-6:
            raise ValueError(
                f"[build_level] rambarde x={x0}->{x1} : longueur {run_len:.3f} m "
                f"ne se divise pas en modules de {piece_len} m sans reste "
                f"(n={n_f:.4f}) — corriger level_spec.py, pas de reste silencieux"
            )
        n = int(round(n_f))
        cursor = x0
        for _ in range(n):
            place_kit_piece(piece_name, mesh_lookup, proxy_map,
                             (cursor, y, z), 0.0, props_coll, col_coll)
            cursor += piece_len
            count += 1
    return count


# ---------------------------------------------------------------------------
# Palettes et caisses (Zone D)
# ---------------------------------------------------------------------------

def build_storage_props(storage_spec: dict | None, mesh_lookup, proxy_map,
                         props_coll, col_coll) -> tuple[int, int]:
    """Piles de `kit_pallet` (empilées en Z, `z = i * hauteur_palette`) et
    `kit_crate` isolées (une instance chacune, pas de pile) — flaveur
    « réserve », obstacles de déplacement, pas de couverture réelle (aucune
    ne dépasse eyeHeight=1.6 m, connu et accepté, voir kit_checkout Zone B)."""
    if storage_spec is None:
        return 0, 0
    pallet_h = spec.find_piece("kit_pallet")["dims"][2]
    pallet_count = 0
    for stack in storage_spec.get("pallet_stacks", []):
        x, y, n = stack["x"], stack["y"], stack["count"]
        for i in range(n):
            place_kit_piece("kit_pallet", mesh_lookup, proxy_map,
                             (x, y, i * pallet_h), 0.0, props_coll, col_coll)
            pallet_count += 1
    crate_count = 0
    for (x, y, z) in storage_spec.get("crates", []):
        place_kit_piece("kit_crate", mesh_lookup, proxy_map,
                         (x, y, z), 0.0, props_coll, col_coll)
        crate_count += 1
    return pallet_count, crate_count


# ---------------------------------------------------------------------------
# Spawns et objets interactifs
# ---------------------------------------------------------------------------

def _make_empty(name: str, location: tuple[float, float, float], logic_coll) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    obj.location = location
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.5
    logic_coll.objects.link(obj)
    return obj


def build_spawns(zone: dict, logic_coll, include_player: bool = True) -> int:
    """`include_player=False` : utilisé par `build_combined_level.py` — un
    niveau combiné n'a qu'UN SEUL `spawn_player` pour tout le fichier (celui
    de la Zone A), les autres zones ne doivent pas en émettre un second sous
    peine de dupliquer le nom (Blender suffixerait silencieusement en
    `spawn_player.001`, que `validate_level.py::check_naming` compte quand
    même via `base_name` — `len(spawns) > 1` ferait échouer la validation).
    Défaut `True` : comportement inchangé pour tout appel `--zone a|b|c|d|e`
    existant, un spawn_player par fichier de zone individuelle."""
    count = 0
    if include_player:
        _make_empty("spawn_player", zone["spawn_player"], logic_coll)
        count += 1
    for name, loc in zone["spawn_suits"]:
        _make_empty(name, loc, logic_coll)
        count += 1
    return count


def build_use_objects(zone: dict, materials_lookup: dict, logic_coll) -> int:
    """`use_*` : un vrai `THREE.Mesh` (jamais une Empty — `buildUseObject`
    l'exige, voir `loader.ts`). Convention "comme avant" vérifiée sur le
    prototype remplacé : `center` est le CENTRE du prop (cohérent avec
    `mesh.getWorldPosition()`), pas un coin — contrairement aux pièces du kit.

    Clé optionnelle `"target"` (nouveau, Zone E) : propagée telle quelle
    comme custom property Blender `obj["target"] = ...`, exportée dans
    `extras.target` (export_extras=True, voir export_level.py) et lue par
    `loader.ts::buildUseObject`. Absente pour un pickup autoportant
    (`use_crowbar`/`use_shotgun`), présente pour un déclencheur qui vise un
    `door_*` (`use_exit_door` -> `door_e_exit`)."""
    count = 0
    for use in zone["use_objects"]:
        cx, cy, cz = use["center"]
        sx, sy, sz = use["size"]
        origin = (-sx / 2.0, -sy / 2.0, -sz / 2.0)
        parts = [{"o": origin, "s": (sx, sy, sz), "mat": spec.MAT_DETAIL}]
        obj = geo_utils.build_multi_box_mesh(use["name"], parts, spec.MAT_DETAIL, materials_lookup)
        obj.location = (cx, cy, cz)
        if "target" in use:
            obj["target"] = use["target"]
        logic_coll.objects.link(obj)
        count += 1
    return count


def build_secret_zones(zone: dict, materials_lookup: dict, logic_coll) -> int:
    """`secret_*` : zone comptée dans le compteur de secrets côté runtime
    (`loader.ts::buildSecretZone`/`LevelStats.secretCount`). Même mécanique
    géométrique que `build_use_objects` juste au-dessus (un vrai `THREE.Mesh`
    au `center`/`size` donné — `buildSecretZone` calcule sa bounding box
    MONDE et n'exige AUCUNE forme particulière, mais on réutilise
    `build_multi_box_mesh` par cohérence avec le reste du kit : subdivision,
    UV, attribut couleur "Col" déjà prêts pour le bake, comme n'importe quel
    autre mesh de niveau — sans ça, `validate_level.py::check_vertex_colors`
    avertirait sur un mesh sans préfixe `col_*`/`trig_*` dépourvu de vertex
    colors).

    Contrairement à `"target"` sur un `use_*` (optionnel), `"secret_id"` est
    attendu pour CHAQUE entrée de `zone["secrets"]` — `validate_level.py::
    check_naming` avertit sur son absence, et c'est la seule donnée stable
    qui permette à la détection côté TS de distinguer un secret d'un autre
    sans parser le nom Blender."""
    count = 0
    for secret in zone.get("secrets", []):
        cx, cy, cz = secret["center"]
        sx, sy, sz = secret["size"]
        origin = (-sx / 2.0, -sy / 2.0, -sz / 2.0)
        parts = [{"o": origin, "s": (sx, sy, sz), "mat": spec.MAT_DETAIL}]
        obj = geo_utils.build_multi_box_mesh(secret["name"], parts, spec.MAT_DETAIL, materials_lookup)
        obj.location = (cx, cy, cz)
        obj["secret_id"] = secret["secret_id"]
        logic_coll.objects.link(obj)
        count += 1
    return count


# ---------------------------------------------------------------------------
# Éclairage de secteur — `vertex-color-sector-lighting`
# ---------------------------------------------------------------------------

def _pick_grid_count(dimension: float, low=6.0, high=8.0) -> int:
    """Nombre de cellules pour un espacement dans [low, high] m, le plus
    proche du milieu de la fourchette. Une seule cellule (`n=1`) si la pièce
    est trop petite pour respecter `low` avec `n>=2`."""
    target = (low + high) / 2.0
    best_n, best_dev = 1, abs(dimension - target)
    n = 2
    while True:
        spacing = dimension / n
        if spacing < low - 1e-6:
            break
        if spacing <= high + 1e-6:
            dev = abs(spacing - target)
            if dev < best_dev:
                best_n, best_dev = n, dev
        n += 1
    return best_n


def build_lighting(zone: dict, floor_spec: dict, lights_coll,
                    energy=180.0) -> tuple[int, float, float]:
    x0, x1 = floor_spec["x"]
    y0, y1 = floor_spec["y"]
    width, depth = x1 - x0, y1 - y0

    nx = _pick_grid_count(width)
    ny = _pick_grid_count(depth)
    spacing_x, spacing_y = width / nx, depth / ny

    count = 0
    for i in range(nx):
        for j in range(ny):
            cx = x0 + spacing_x * (i + 0.5)
            cy = y0 + spacing_y * (j + 0.5)
            data = bpy.data.lights.new(f"ceiling_light_{count}", type="AREA")
            data.shape = "SQUARE"
            data.size = max(0.5, min(spacing_x, spacing_y) * 0.6)
            data.energy = energy
            data.color = (1.0, 0.94, 0.85)
            obj = bpy.data.objects.new(f"ceiling_light_{count}", data)
            obj.location = (cx, cy, level_spec.WALL_HEIGHT - 0.3)
            lights_coll.objects.link(obj)
            count += 1

    world = bpy.data.worlds.new(f"{zone['name']}_world")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.30, 0.32, 0.36, 1.0)
    bg.inputs["Strength"].default_value = 0.35

    if zone["lighting"].get("sun"):
        data = bpy.data.lights.new("bake_sun", type="SUN")
        data.energy = 1.0
        data.angle = math.radians(15.0)
        data.color = (0.85, 0.90, 1.0)
        sun = bpy.data.objects.new("bake_sun", data)
        # Incliné pour faire porter un peu de lumière par la fente de la
        # vitrine (Y=18, Z 1.2-2.0 en Zone A) — ambiance, pas une exigence de
        # gameplay.
        sun.rotation_euler = (math.radians(60.0), 0.0, math.radians(20.0))
        sun.location = (x0 + width / 2.0, y0 + depth * 0.4, 12.0)
        lights_coll.objects.link(sun)
        count += 1

    return count, spacing_x, spacing_y


# ---------------------------------------------------------------------------
# Assemblage
# ---------------------------------------------------------------------------

def main() -> None:
    args = get_args()
    zone_key = arg_value(args, "--zone", None)
    if zone_key not in level_spec.ZONES:
        print(f"[build_level] --zone doit valoir un de {sorted(level_spec.ZONES)}, reçu {zone_key!r}")
        sys.exit(1)
    zone = level_spec.ZONES[zone_key]

    kit_path = os.path.abspath(bpy.path.abspath(
        arg_value(args, "--kit", "assets_src/blender/kit_hypermarche.blend")))
    out = os.path.abspath(bpy.path.abspath(
        arg_value(args, "--out", f"assets_src/blender/{zone['name']}.blend")))
    light_energy = float(arg_value(args, "--light-energy", "180.0"))

    if not os.path.isfile(kit_path):
        print(f"[build_level] kit introuvable : {kit_path}")
        sys.exit(1)

    geo_utils.wipe_scene()
    geo_utils.configure_scene()

    root = bpy.context.scene.collection
    geo = geo_utils.make_collection("GEO", root)
    shell = geo_utils.make_collection("SHELL", geo)
    props_coll = geo_utils.make_collection("PROPS", geo)
    geo_utils.make_collection("DETAIL", geo)   # structure conventionnelle, vide ici
    col_coll = geo_utils.make_collection("COL", root)
    logic_coll = geo_utils.make_collection("LOGIC", root)
    lights_coll = geo_utils.make_collection("_LIGHTS", root)
    lights_coll["gltf_export"] = False  # cosmétique : export_lights=False les exclut déjà

    needed_pieces = ["kit_wall_4m", "kit_wall_2m", "kit_wall_1m", "kit_floor_4x4"]
    if zone.get("checkouts"):
        needed_pieces.append(zone["checkouts"]["piece"])
    if zone.get("gondolas"):
        needed_pieces.append(zone["gondolas"]["piece"])
        needed_pieces.append(zone["gondolas"]["end_piece"])
    if zone.get("racks"):
        needed_pieces.append(zone["racks"]["piece"])
    mezzanine = zone.get("mezzanine")
    if mezzanine:
        if mezzanine.get("stairs"):
            needed_pieces.append(mezzanine["stairs"]["piece"])
        if mezzanine.get("railing"):
            needed_pieces.append(mezzanine["railing"]["piece"])
    if zone.get("storage_props"):
        needed_pieces.append("kit_pallet")
        needed_pieces.append("kit_crate")
    if zone.get("door_frame"):
        needed_pieces.append(zone["door_frame"]["piece"])
        if zone["door_frame"].get("leaf_name"):
            needed_pieces.append("kit_door_leaf")
    mesh_names, proxy_map = gather_kit_mesh_names(needed_pieces)

    mesh_lookup, materials_lookup = append_kit_data(kit_path, mesh_names, list(spec.MATERIALS.keys()))

    floor_count = tile_floor(zone["floor"], mesh_lookup, proxy_map, shell, col_coll)
    floor_patch_count = build_floor_patches(zone.get("floor_patches"), materials_lookup, shell, col_coll)
    wall_counts, wall_remainder = build_walls(zone["walls"], mesh_lookup, proxy_map, shell, col_coll)
    vitrine_count = build_vitrine(zone.get("vitrine"), materials_lookup, shell, col_coll)
    checkout_count = build_checkouts(zone.get("checkouts"), mesh_lookup, proxy_map, props_coll, col_coll)
    gondola_count = build_gondolas(zone.get("gondolas"), mesh_lookup, proxy_map, props_coll, col_coll)
    rack_count = build_racks(zone.get("racks"), mesh_lookup, proxy_map, props_coll, col_coll)

    mezz_floor_count = stairs_count = railing_count = 0
    if mezzanine:
        mezz_floor_count = tile_floor(mezzanine["floor"], mesh_lookup, proxy_map, shell, col_coll,
                                       z=mezzanine["floor"]["z"])
        stairs_count = build_mezzanine_stairs(mezzanine.get("stairs"), mesh_lookup, proxy_map,
                                               props_coll, col_coll)
        railing_count = build_mezzanine_railing(mezzanine.get("railing"), mesh_lookup, proxy_map,
                                                  props_coll, col_coll)

    pallet_count, crate_count = build_storage_props(zone.get("storage_props"), mesh_lookup, proxy_map,
                                                      props_coll, col_coll)
    door_count = build_door_frame(zone.get("door_frame"), mesh_lookup, proxy_map, shell, col_coll)
    leaf_count = build_door_leaf(zone.get("door_frame"), mesh_lookup, proxy_map, shell, col_coll)

    spawn_count = build_spawns(zone, logic_coll)
    use_count = build_use_objects(zone, materials_lookup, logic_coll)
    secret_count = build_secret_zones(zone, materials_lookup, logic_coll)
    light_count, spacing_x, spacing_y = build_lighting(zone, zone["floor"], lights_coll, energy=light_energy)

    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=out)

    print("\n" + "=" * 62)
    print(f"BUILD LEVEL — {zone['name']}")
    print("=" * 62)
    print(f"  Fichier            {out}")
    print(f"  Tuiles de sol      {floor_count}")
    print(f"  Dalles sur-mesure  {floor_patch_count}")
    print("  Murs               " + "  ".join(f"{k}:{v}" for k, v in sorted(wall_counts.items())))
    print(f"  Bandes de vitrine  {vitrine_count}")
    print(f"  Caisses            {checkout_count}")
    print(f"  Gondoles+capuchons {gondola_count}")
    print(f"  Rayonnages (racks) {rack_count}")
    print(f"  Dalle mezzanine    {mezz_floor_count}")
    print(f"  Escalier mezzanine {stairs_count}")
    print(f"  Rambarde mezzanine {railing_count}")
    print(f"  Palettes           {pallet_count}")
    print(f"  Caisses (crates)   {crate_count}")
    print(f"  Porte              {door_count}")
    print(f"  Vantail de porte   {leaf_count}")
    print(f"  Spawns             {spawn_count}")
    print(f"  Objets use_*       {use_count}")
    print(f"  Secrets            {secret_count}")
    print(f"  Lampes             {light_count}  (espacement ~{spacing_x:.2f} x {spacing_y:.2f} m)")
    if wall_remainder > 1e-6:
        print(f"  ERREUR reste non tilé cumulé : {wall_remainder:.3f} m")
    print("=" * 62 + "\n")

    sys.exit(1 if wall_remainder > 1e-6 else 0)


if __name__ == "__main__":
    main()
