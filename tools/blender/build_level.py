"""
Assemblage d'un niveau à partir du kit modulaire — PROJET_CASSANDRE.

    blender -b --factory-startup -P tools/blender/build_level.py -- \\
        --zone a --kit assets_src/blender/kit_hypermarche.blend \\
        --out assets_src/blender/zone_a_parking.blend

    blender -b --factory-startup -P tools/blender/build_level.py -- \\
        --zone b --kit assets_src/blender/kit_hypermarche.blend \\
        --out assets_src/blender/zone_b_caisses.blend

Options :
    --zone a|b          quelle entrée de `level_spec.ZONES` construire
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

def tile_floor(floor_spec: dict, mesh_lookup, proxy_map, shell_coll, col_coll) -> int:
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
            loc = (x0 + i * tile, y0 + j * tile, 0.0)
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
# Spawns et objets interactifs
# ---------------------------------------------------------------------------

def _make_empty(name: str, location: tuple[float, float, float], logic_coll) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    obj.location = location
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.5
    logic_coll.objects.link(obj)
    return obj


def build_spawns(zone: dict, logic_coll) -> int:
    _make_empty("spawn_player", zone["spawn_player"], logic_coll)
    for name, loc in zone["spawn_suits"]:
        _make_empty(name, loc, logic_coll)
    return 1 + len(zone["spawn_suits"])


def build_use_objects(zone: dict, materials_lookup: dict, logic_coll) -> int:
    """`use_*` : un vrai `THREE.Mesh` (jamais une Empty — `buildUseObject`
    l'exige, voir `loader.ts`). Convention "comme avant" vérifiée sur le
    prototype remplacé : `center` est le CENTRE du prop (cohérent avec
    `mesh.getWorldPosition()`), pas un coin — contrairement aux pièces du kit."""
    count = 0
    for use in zone["use_objects"]:
        cx, cy, cz = use["center"]
        sx, sy, sz = use["size"]
        origin = (-sx / 2.0, -sy / 2.0, -sz / 2.0)
        parts = [{"o": origin, "s": (sx, sy, sz), "mat": spec.MAT_DETAIL}]
        obj = geo_utils.build_multi_box_mesh(use["name"], parts, spec.MAT_DETAIL, materials_lookup)
        obj.location = (cx, cy, cz)
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
    mesh_names, proxy_map = gather_kit_mesh_names(needed_pieces)

    mesh_lookup, materials_lookup = append_kit_data(kit_path, mesh_names, list(spec.MATERIALS.keys()))

    floor_count = tile_floor(zone["floor"], mesh_lookup, proxy_map, shell, col_coll)
    wall_counts, wall_remainder = build_walls(zone["walls"], mesh_lookup, proxy_map, shell, col_coll)
    vitrine_count = build_vitrine(zone.get("vitrine"), materials_lookup, shell, col_coll)
    checkout_count = build_checkouts(zone.get("checkouts"), mesh_lookup, proxy_map, props_coll, col_coll)
    spawn_count = build_spawns(zone, logic_coll)
    use_count = build_use_objects(zone, materials_lookup, logic_coll)
    light_count, spacing_x, spacing_y = build_lighting(zone, zone["floor"], lights_coll, energy=light_energy)

    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=out)

    print("\n" + "=" * 62)
    print(f"BUILD LEVEL — {zone['name']}")
    print("=" * 62)
    print(f"  Fichier            {out}")
    print(f"  Tuiles de sol      {floor_count}")
    print("  Murs               " + "  ".join(f"{k}:{v}" for k, v in sorted(wall_counts.items())))
    print(f"  Bandes de vitrine  {vitrine_count}")
    print(f"  Caisses            {checkout_count}")
    print(f"  Spawns             {spawn_count}")
    print(f"  Objets use_*       {use_count}")
    print(f"  Lampes             {light_count}  (espacement ~{spacing_x:.2f} x {spacing_y:.2f} m)")
    if wall_remainder > 1e-6:
        print(f"  ERREUR reste non tilé cumulé : {wall_remainder:.3f} m")
    print("=" * 62 + "\n")

    sys.exit(1 if wall_remainder > 1e-6 else 0)


if __name__ == "__main__":
    main()
