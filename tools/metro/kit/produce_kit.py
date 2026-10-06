"""Recette N3, appelée par C.metro_kit(). Bibliothèque + vues de présentation.

see: docs/assets/kit-metro.md#reproduire
"""
from pathlib import Path
import json
import math
import sys

import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "tools/blender"))
import geo_utils
import materials
import modules


def instance(piece, origin=(0, 0, 0), rotation=0):
    obj = bpy.data.objects.new("presentation_" + piece.name, None)
    obj.instance_type, obj.instance_collection = "COLLECTION", piece.collection
    obj.location, obj.rotation_euler.z = origin, rotation
    bpy.context.scene.collection.objects.link(obj)
    return obj


def light(name, location, target, power, size, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.shape, data.size, data.color = power, "DISK", size, color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


def camera(location, target, lens=32, ortho=None):
    data = bpy.data.cameras.new("presentation")
    data.lens, data.clip_end = lens, 200
    if ortho:
        data.type, data.ortho_scale = "ORTHO", ortho
    obj = bpy.data.objects.new("presentation", data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = obj
    return obj


def render(name, out, location, target, ortho=None):
    scene = bpy.context.scene
    cam = camera(location, target, ortho=ortho)
    path = out / f"{name}.png"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    return path


def clear_stage():
    for obj in list(bpy.context.scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def studio(target=(0, 3, 1)):
    light("key", (-5, -4, 9), target, 1800, 7, (1, .9, .75))
    light("fill", (7, 1, 7), target, 1200, 6, (.65, .8, 1))
    light("rim", (0, 15, 6), target, 1600, 5)


def assemble_quay(pieces):
    for y in range(0, 24, 4):
        instance(pieces["quai_5x4"], (0, y, 0))
        instance(pieces["mur_quai_4m"], (-.25, y, .75))
        instance(pieces["quai_5x4"], (18, y + 4, 0), math.pi)
        instance(pieces["mur_quai_4m"], (18.25, y + 4, .75), math.pi)
        instance(pieces["voute_station_4m"], (0, y, 0))
        for x in (5, 9):
            instance(pieces["voie_4x4"], (x, y, 0))
    instance(pieces["banc_3m"], (.5, 4, .75), -math.pi / 2)
    instance(pieces["panneau_sortie"], (1, 10, 2.9))
    instance(pieces["luminaire_2m"], (1, 2, 3.4))
    for y in range(2, 24, 4):
        light("quai", (2.5, y, 3.5), (2.5, y, 0), 160, 2)
        light("quai_oppose", (15.5, y, 3.5), (15.5, y, 0), 100, 2)


def assemble_tunnel(pieces):
    for y in (0, 4, 8, 12):
        instance(pieces["tunnel_niche_4m" if y == 4 else "tunnel_4m"], (0, y, 0))
    instance(pieces["panneau_refuge"], (.08, 2, 1.5), math.pi / 2)
    for y in (2, 6, 10, 14):
        light("tunnel", (2.2, y, 3.5), (2.2, y, 0), 160, 1.5, (1, .65, .28))
    light("niche", (-.8, 6, 2.2), (-.8, 6, 0), 60, 1, (.65, .9, .85))


def compose(paths, out):
    sheet = np.ones((3 * 360 + 2 * 8, 2 * 640 + 8, 4), dtype=np.float32)
    sheet[:, :, :3] = .025
    for i, path in enumerate(paths):
        img = bpy.data.images.load(str(path), check_existing=False)
        pixels = np.empty(640 * 360 * 4, dtype=np.float32)
        img.pixels.foreach_get(pixels)
        row, col = divmod(i, 2)
        y = sheet.shape[0] - (row + 1) * 360 - row * 8
        sheet[y:y + 360, col * 648:col * 648 + 640] = pixels.reshape(360, 640, 4)
        bpy.data.images.remove(img)
    img = bpy.data.images.new("planche", sheet.shape[1], sheet.shape[0])
    img.pixels.foreach_set(sheet.ravel())
    img.filepath_raw, img.file_format = str(out), "PNG"
    img.save()
    bpy.data.images.remove(img)


def inventory(pieces):
    rows = []
    for name, piece in pieces.items():
        meshes = [o for o in piece.collection.objects if o.type == "MESH" and not o.name.startswith("col_")]
        proxies = [o for o in piece.collection.objects if o.name.startswith("col_")]
        points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
        low = [min(v[i] for v in points) for i in range(3)]
        high = [max(v[i] for v in points) for i in range(3)]
        rows.append({"id": name, "spec": piece.collection["spec"],
                     "bounds_m": [low, high], "meshes": len(meshes),
                     "triangles": sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons),
                     "colliders": {"cuboid": sum(o.name.startswith("col_box_") for o in proxies),
                                   "convex": sum(o.name.startswith("col_hull_") for o in proxies)},
                     "materials": sorted({m.name for o in meshes for m in o.data.materials}),
                     "ngons": sum(len(p.vertices) > 4 for o in meshes for p in o.data.polygons)})
    return {"etape": "N3_candidat", "pieces": rows, "count": len(rows),
            "triangles": sum(r["triangles"] for r in rows), "runtime_integrated": False,
            "limits": ["Présentation EEVEE, pas une capture du moteur.",
                       "Proxies à exercer avec Rapier au pilote N4.",
                       "Courbes nominales 7,5° ; raccord au tracé quart-de-mètre à ajuster en N5."]}


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = Path(args[args.index("--out") + 1]).resolve() if "--out" in args else ROOT / "docs/assets/kit-metro"
    out.mkdir(parents=True, exist_ok=True)
    geo_utils.wipe_scene()
    geo_utils.configure_scene()
    scene = bpy.context.scene
    scene["cassandre_niveau"], scene["cassandre_etape"] = "metro", "kit_N3"
    mats = materials.build(ROOT / "assets_src/library/metro/textures")
    pieces = modules.build(mats)
    source = ROOT / "assets_src/library/lib_metro_N3.blend"
    for piece in pieces.values():
        # Collections non liées à la scène : bibliothèque réutilisable, sans doublons d'exposition.
        piece.collection.use_fake_user = True
    bpy.context.view_layer.update()
    report = inventory(pieces)
    (out / "inventaire.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 640, 360, 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (.008, .013, .018, 1)
    scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .45
    paths = []
    assemble_quay(pieces)
    paths.append(render("01-quai", out, (4, 1, 2.35), (2, 8, 2.35)))
    clear_stage()
    assemble_tunnel(pieces)
    paths.append(render("02-tunnel", out, (3, .5, 1.6), (1.1, 10, 1.6)))
    clear_stage()
    instance(pieces["voiture_ligne_15m"])
    studio((1.4, 6, 1.5))
    paths.append(render("03-rame-ligne", out, (11, -10, 7), (1.4, 6, 1.5)))
    clear_stage()
    instance(pieces["voiture_fret_15m"])
    instance(pieces["soufflet_fret_05m"], (0, 15, 0))
    instance(pieces["voiture_fret_15m"], (0, 15.5, 0))
    for y in (3, 8, 13, 18, 23):
        light("interieur", (1.875, y, 3.65), (1.875, y, .75), 70, 2)
    paths.append(render("04-fret-interieur", out, (1.875, .5, 2.35), (1.875, 13, 2.35)))
    clear_stage()
    for i, name in enumerate(("escalier_2m", "galerie_4m", "portique_depot_8m")):
        instance(pieces[name], (i * 5, 0, 0))
    studio((8, 2, 2))
    paths.append(render("05-structure", out, (18, -17, 13), (8, 2, 3), ortho=24))
    clear_stage()
    for i, name in enumerate(("banc_3m", "armoire_service", "pupitre_aiguillage", "signal_voie", "arret_urgence")):
        instance(pieces[name], (i * 3.5, 0, 0))
    for i, name in enumerate(("panneau_sortie", "panneau_refuge", "panneau_maintenance")):
        instance(pieces[name], (i * 3.5, 1.2, 3))
    studio((7, 0, 1.5))
    paths.append(render("06-mobilier-signaux", out, (10, -14, 7), (7, 0, 1.5), ortho=18))
    compose(paths, out / "planche.png")
    # Contrôle de forme sans éclairage : rame, escalier et mobilier.
    clear_stage()
    for i, name in enumerate(("escalier_2m", "banc_3m", "signal_voie", "armoire_service")):
        instance(pieces[name], (i * 4, 0, 0))
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light, scene.display.shading.color_type = "FLAT", "SINGLE"
    scene.display.shading.single_color = (0, 0, 0)
    scene.display.shading.background_type, scene.display.shading.background_color = "WORLD", (1, 1, 1)
    scene.world.color = (1, 1, 1)
    render("07-silhouettes", out, (9, -15, 6), (6, 1, 1), ortho=17)
    clear_stage()
    scene.render.engine = "BLENDER_EEVEE"
    instance(pieces["courbe_R32_75deg"])
    instance(pieces["courbe_R24_75deg"], (10, 0, 0))
    studio((9, 2, 1))
    render("08-courbes", out, (9, -9, 10), (9, 2, 1), ortho=21)
    clear_stage()
    print("[metro-kit] " + json.dumps({"blend": str(source), "out": str(out), "pieces": report["count"], "triangles": report["triangles"]}))


if __name__ == "__main__":
    main()
