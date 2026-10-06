"""Atelier technique N0, appelé par C.build(niveau='metro').

    blender -b --factory-startup -P tools/blender/cassandre_cli.py -- build niveau=metro

see: docs/4-technique/outillage-multi-niveaux.md#atelier-du-métro
"""
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "blender"))
import geo_utils
from level_profiles import PROFILES, SCENE_LEVEL_KEY, load_plan, output_path


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    profile = PROFILES["metro"]
    out = output_path(profile, args[args.index("--out") + 1] if "--out" in args else None, "blend")
    geo_utils.wipe_scene()
    geo_utils.configure_scene()
    root = bpy.context.scene.collection
    geo = geo_utils.make_collection("GEO", root)
    shell = geo_utils.make_collection("SHELL", geo)
    geo_utils.make_collection("PROPS", geo)
    geo_utils.make_collection("DETAIL", geo)
    collisions = geo_utils.make_collection("COL", root)
    logic = geo_utils.make_collection("LOGIC", root)
    material = bpy.data.materials.new("mat_atelier_metro")
    material.diffuse_color = (.45, .5, .52, 1)
    material.use_nodes = True
    material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = material.diffuse_color
    material.node_tree.nodes.get("Principled BSDF").inputs["Roughness"].default_value = 1

    def box(name, origin, size):
        obj = geo_utils.build_multi_box_mesh(name, [{"o": origin, "s": size, "mat": None}], "atelier", {"atelier": material})
        shell.objects.link(obj)
        collisions.objects.link(geo_utils.build_proxy_object(f"col_box_{name}", "box", origin, size))

    s = load_plan(profile).ALL[0]
    box("sol_atelier", (s.x[0] - 1, s.y[0] - 1, s.z - .25), (s.largeur + 2, s.profondeur + 2, .25))
    box("plafond_atelier", (s.x[0], s.y[0], s.z + s.hauteur), (s.largeur, s.profondeur, .25))
    for x in (s.x[0] - .25, s.x[1]):
        box(f"mur_atelier_x_{x:g}", (x, s.y[0] - .25, s.z), (.25, s.profondeur + .5, s.hauteur))
    for y in (s.y[0] - .25, s.y[1]):
        box(f"mur_atelier_y_{y:g}", (s.x[0], y, s.z), (s.largeur, .25, s.hauteur))
    spawn = bpy.data.objects.new("spawn_player", None)
    logic.objects.link(spawn)
    spawn.location = (0, -5, s.z + .25)
    bpy.context.scene[SCENE_LEVEL_KEY] = profile.id
    bpy.context.scene["cassandre_etape"] = "atelier_N0"
    bpy.ops.wm.save_as_mainfile(filepath=str(out))
    print(f"[niveau] atelier métro N0 — {out}")


if __name__ == "__main__":
    main()
