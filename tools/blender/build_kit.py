"""
Génération du kit modulaire hypermarché — PROJET_CASSANDRE.

    blender -b --factory-startup -P tools/blender/build_kit.py \
        -- --out assets_src/blender/kit_hypermarche.blend

Options :
    --out PATH        fichier .blend produit (défaut assets_src/blender/kit_hypermarche.blend)
    --checker         assigne le matériau damier de contrôle de densité à tout le kit
    --no-lights       ne crée pas le rig d'éclairage de bake
    --light-energy W  puissance des area lights du rig (défaut 900)

Code retour : 0 = kit généré et cohérent, 1 = échec.

Le script est ENTIÈREMENT déterministe et écrase sa sortie : le .blend est un
artefact reproductible, pas un fichier qu'on édite à la main. Toute
modification du kit passe par `kit_spec.py`, jamais par le .blend.

Ce qu'il produit
----------------
- La structure de collections de `blender-level-conventions` :
  GEO/{SHELL,PROPS,DETAIL}, COL, LOGIC, _KIT (exclue de l'export), _BAKE_LIGHTS
- Une sous-collection par pièce dans `_KIT`, contenant le mesh rendu et ses
  proxies `col_box_*` / `col_hull_*`, avec `instance_offset` réglé pour que
  « Add → Collection Instance » pose la pièce à l'origine de l'empty.
- Des meshes subdivisés au mètre, UV en projection boîte à 64 px/m, attribut
  de couleur "Col" prêt pour le bake, transforms déjà appliqués (rotation
  identité, scale 1 — la géométrie est construite en coordonnées locales, seule
  la `location` est utilisée pour l'étalage du kit).
- Un rig d'éclairage NEUTRE, uniquement destiné à valider le bake bout-en-bout.
  Les zones réelles seront éclairées selon leur propre ambiance, ce rig n'est
  pas un choix artistique.

Ce qu'il ne fait PAS : aucun assemblage, aucun placement de pièce dans un
niveau. Le kit est un instrument, pas un niveau.
"""

from __future__ import annotations

import math
import os
import sys

import bpy

# `blender -P` n'ajoute pas le dossier du script au sys.path.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import kit_spec as spec  # noqa: E402
import geo_utils  # noqa: E402


# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------

def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg_value(args: list[str], flag: str, default: str) -> str:
    return args[args.index(flag) + 1] if flag in args else default


# ---------------------------------------------------------------------------
# Nettoyage et réglages de scène
# ---------------------------------------------------------------------------

def setup_collections() -> dict:
    root = bpy.context.scene.collection
    geo = geo_utils.make_collection("GEO", root)
    tree = {
        "GEO": geo,
        "SHELL": geo_utils.make_collection("SHELL", geo),
        "PROPS": geo_utils.make_collection("PROPS", geo),
        "DETAIL": geo_utils.make_collection("DETAIL", geo),
        "COL": geo_utils.make_collection("COL", root),
        "LOGIC": geo_utils.make_collection("LOGIC", root),
        "_KIT": geo_utils.make_collection("_KIT", root),
        "_BAKE_LIGHTS": geo_utils.make_collection("_BAKE_LIGHTS", root),
    }
    # Marqueur explicite lu par export_level.py — le nom seul est fragile.
    tree["_KIT"]["gltf_export"] = False
    tree["_BAKE_LIGHTS"]["gltf_export"] = False
    return tree


# ---------------------------------------------------------------------------
# Matériaux
# ---------------------------------------------------------------------------

def make_material(name: str, base_color, emission: float) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    r, g, b = base_color
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0        # mat, cohérent Lambert
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    elif "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = 0.0
    if emission > 0.0:
        bsdf.inputs["Emission Color"].default_value = (r, g, b, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission
    mat.diffuse_color = (r, g, b, 1.0)                  # couleur viewport solid
    return mat


def make_checker_material() -> bpy.types.Material:
    """Damier 128 × 128 réel, pour contrôler la densité de texels à l'œil.

    `retro-texture-density` : 64 px/m, une texture 128 couvre 2 × 2 m. Comme
    les UV du kit sont une projection boîte à 1 tuile / 2 m, un carreau du
    damier doit mesurer exactement la même chose sur TOUTES les pièces.
    Un carreau plus gros quelque part = densité fausse à cet endroit.
    """
    size = 128
    cell = 16          # 16 px = 0.25 m à 64 px/m — le carreau vaut la grille fine
    img = bpy.data.images.new("tex_checker_128", width=size, height=size, alpha=False)
    px = [0.0] * (size * size * 4)
    for y in range(size):
        for x in range(size):
            on = ((x // cell) + (y // cell)) % 2 == 0
            v = 0.78 if on else 0.30
            i = (y * size + x) * 4
            px[i], px[i + 1], px[i + 2], px[i + 3] = v, v, v * 0.95, 1.0
    img.pixels.foreach_set(px)
    img.pack()

    mat = bpy.data.materials.new("mat_kit_checker")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 1.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Closest"          # invariant #4 : NearestFilter
    tex.extension = "REPEAT"
    tex.location = (-320, 220)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    # Sans fake user, un matériau à zéro utilisateur est purgé à la sauvegarde
    # et le damier disparaîtrait du .blend livré.
    mat.use_fake_user = True
    return mat


# ---------------------------------------------------------------------------
# Géométrie
# ---------------------------------------------------------------------------
#
# La construction de boîtes/proxies vit dans `geo_utils.py`, partagée avec
# `build_level.py` (la vitrine sur-mesure de la Zone A en a besoin à
# l'identique — même subdivision, même winding, même attribut de couleur).


def build_render_mesh(piece: dict, materials: dict) -> bpy.types.Object:
    obj = geo_utils.build_multi_box_mesh(piece["name"], piece["parts"], piece["mat"], materials)
    for key, value in (piece.get("props") or {}).items():
        obj[key] = value
    return obj


def build_proxy(piece: dict, kind: str, suffix: str, origin, size) -> bpy.types.Object:
    """Proxy de collision. `box` → 8 sommets soudés, `hull_ramp` → prisme à 6."""
    name = spec.proxy_mesh_name(piece["name"], kind, suffix)
    return geo_utils.build_proxy_object(name, kind, origin, size)


# ---------------------------------------------------------------------------
# Rig d'éclairage de bake
# ---------------------------------------------------------------------------

def build_light_rig(coll, extent_x: float, extent_y: float, energy: float) -> int:
    """Rig NEUTRE : ambiante basse + 4 area lights en quinconce au-dessus.

    Ce n'est pas une direction artistique, c'est un banc de test : il faut de
    la variation spatiale pour que le bake produise un dégradé lisible sur une
    face subdivisée. Un éclairage parfaitement uniforme baker plat et ne
    prouverait rien.
    """
    world = bpy.data.worlds.new("kit_world")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.30, 0.32, 0.36, 1.0)
    bg.inputs["Strength"].default_value = 0.35

    count = 0
    for fx, fy in ((0.25, 0.3), (0.75, 0.3), (0.25, 0.75), (0.75, 0.75)):
        data = bpy.data.lights.new(f"bake_area_{count}", type="AREA")
        data.shape = "SQUARE"
        data.size = 10.0
        data.energy = energy
        data.color = (1.0, 0.94, 0.85)
        obj = bpy.data.objects.new(f"bake_area_{count}", data)
        obj.location = (extent_x * fx, extent_y * fy, 9.0)
        coll.objects.link(obj)
        count += 1

    data = bpy.data.lights.new("bake_sun", type="SUN")
    data.energy = 1.2
    data.angle = math.radians(20.0)
    data.color = (0.85, 0.90, 1.0)
    sun = bpy.data.objects.new("bake_sun", data)
    sun.rotation_euler = (math.radians(50.0), 0.0, math.radians(35.0))
    sun.location = (extent_x * 0.5, extent_y * 0.5, 16.0)
    coll.objects.link(sun)
    return count + 1


# ---------------------------------------------------------------------------
# Assemblage
# ---------------------------------------------------------------------------

PITCH_X = 8.0
PITCH_Y = 10.0
PER_ROW = 5


def main() -> None:
    args = get_args()
    out = arg_value(args, "--out", "assets_src/blender/kit_hypermarche.blend")
    out = os.path.abspath(bpy.path.abspath(out))
    use_checker = "--checker" in args
    energy = float(arg_value(args, "--light-energy", "900"))

    errors, warnings = spec.check_spec()
    for w in warnings:
        print(f"[build_kit] WARN  {w}")
    if errors:
        for e in errors:
            print(f"[build_kit] ERROR {e}")
        sys.exit(1)

    geo_utils.wipe_scene()
    geo_utils.configure_scene()
    tree = setup_collections()

    materials = {name: make_material(name, color, emit)
                 for name, (color, emit) in spec.MATERIALS.items()}
    checker = make_checker_material()

    total_verts = total_tris = 0
    proxy_count = {"box": 0, "hull_ramp": 0}

    for index, piece in enumerate(spec.KIT):
        col_i, row_i = index % PER_ROW, index // PER_ROW
        location = (col_i * PITCH_X, row_i * PITCH_Y, 0.0)

        piece_coll = geo_utils.make_collection(piece["name"], tree["_KIT"])
        # Sans instance_offset, une « Collection Instance » posée à l'origine
        # ferait apparaître la pièce à sa place d'étalage dans le kit.
        piece_coll.instance_offset = location
        piece_coll["kit_class"] = piece["cls"]
        piece_coll["kit_group"] = piece["group"]

        obj = build_render_mesh(piece, materials)
        if use_checker:
            obj.data.materials.clear()
            obj.data.materials.append(checker)
            for poly in obj.data.polygons:
                poly.material_index = 0
        obj.location = location
        piece_coll.objects.link(obj)

        total_verts += len(obj.data.vertices)
        obj.data.calc_loop_triangles()
        total_tris += len(obj.data.loop_triangles)

        for kind, suffix, origin, size in piece.get("proxies", []):
            proxy = build_proxy(piece, kind, suffix, origin, size)
            # `build_proxy` construit déjà le mesh en coordonnées LOCALES à la
            # pièce (mêmes `origin`/`size` que les `parts` du rendu). Le proxy
            # est enfant du mesh rendu, qui porte seul l'offset d'étalage : sa
            # `location` locale doit donc rester nulle.
            #
            # Ne PAS écrire `proxy.location = location` + `matrix_parent_inverse
            # = obj.matrix_world.inverted()` : le `matrix_world` du parent n'est
            # pas réévalué tant que le depsgraph n'a pas tourné, l'inverse vaut
            # donc l'identité et l'offset est appliqué DEUX FOIS. Le proxy part
            # alors à `2 × location`, se pose sur une autre pièce du kit et la
            # scelle — le bake de cette pièce sort noir (mesuré : kit_wall_1m,
            # kit_vent, kit_camera).
            proxy.parent = obj
            piece_coll.objects.link(proxy)
            proxy_count[kind] += 1

    lights = 0
    if "--no-lights" not in args:
        lights = build_light_rig(
            tree["_BAKE_LIGHTS"],
            PER_ROW * PITCH_X,
            ((len(spec.KIT) - 1) // PER_ROW + 1) * PITCH_Y,
            energy,
        )

    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=out)

    print("\n" + "=" * 62)
    print("BUILD KIT — PROJET_CASSANDRE")
    print("=" * 62)
    print(f"  Fichier           {out}")
    print(f"  Pièces            {len(spec.KIT)}")
    print(f"  Sommets rendus    {total_verts}")
    print(f"  Triangles rendus  {total_tris}")
    print(f"  Proxies           cuboid {proxy_count['box']}  "
          f"convexHull {proxy_count['hull_ramp']}  trimesh 0")
    print(f"  Matériaux         {len(bpy.data.materials)}"
          f"{'  (damier assigné)' if use_checker else ''}")
    print(f"  Lampes de bake    {lights}")
    print("=" * 62 + "\n")


if __name__ == "__main__":
    main()
