"""Recette N3b, appelée par C.quartier_kit() ; bibliothèque et planche.

see: docs/assets/kit-quartier.md#reproduire
"""
from pathlib import Path
import json
import math
import sys

import bpy

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from tools.blender import geo_utils
from tools.metro.quartier import materials, modules, vehicles
from tools.metro.kit.produce_kit import instance, light, render, clear_stage, studio, compose, inventory


def pavement(pieces, x0=-4, x1=20, y0=-12, y1=4):
    for x in range(x0, x1, 4):
        for y in range(y0, y1, 4):
            instance(pieces["chaussee_4x4"], (x, y, 0))
        instance(pieces["trottoir_4x25"], (x + 4, 4, 0), math.pi)


def front(pieces, x, variant, shop):
    instance(pieces["vitrine_" + shop + "_4m"], (x, 4, 0))
    for z in (3.5, 7, 10.5):
        instance(pieces["facade_" + variant + "_4m"], (x, 4, z))
    instance(pieces["corniche_4m"], (x, 4, 14))


def streetscape(pieces, night=False):
    pavement(pieces)
    for x, variant, shop in ((0, "balcon", "epicerie"), (4, "brique", "laverie"), (8, "volets", "epicerie")):
        front(pieces, x, variant, shop)
    instance(pieces["vehicule_citadine"], (11, -6, -.25), math.pi / 2)
    instance(pieces["lampadaire_5m"], (-1, 2, 0))
    instance(pieces["lampadaire_5m"], (13, 2, 0), math.pi)
    instance(pieces["banc_2m"], (4, 2.6, 0))
    for x in (-2, 2, 7, 12, 16):
        instance(pieces["borne_075m"], (x, 1.3, 0))
    if night:
        light("ciel", (5, -2, 20), (5, 4, 3), 2200, 15, (.38, .56, .85))
        for x in (2, 6, 10):
            light("vitrine", (x, 4.6, 2.4), (x, 1.5, .2), 170, 2, (1, .63, .29))
        for x in (0, 12):
            light("rue", (x, 2, 4.7), (x, -1, 0), 300, 2, (1, .77, .44))
    else:
        studio((6, 3, 5))


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = Path(args[args.index("--out") + 1]).resolve() if "--out" in args else ROOT / "docs/assets/kit-quartier"
    out.mkdir(parents=True, exist_ok=True)
    geo_utils.wipe_scene()
    geo_utils.configure_scene()
    scene = bpy.context.scene
    scene["cassandre_niveau"], scene["cassandre_etape"] = "metro", "kit_N3b"
    mats = materials.build(ROOT / "assets_src/library/quartier/textures")
    pieces = modules.build(mats)
    pieces.update(vehicles.build(ROOT, mats))
    for piece in pieces.values():
        piece.collection.use_fake_user = True
    bpy.context.view_layer.update()
    report = inventory(pieces)
    report.update({"etape": "N3b_candidat", "runtime_integrated": False,
                   "original_count": len(pieces) - 2, "reused_vehicles": 2,
                   "limits": ["Rendus EEVEE de présentation, pas des captures du jeu.",
                              "Collision à exercer avec Rapier au pilote N4b.",
                              "Bouche, grille et trappe non branchées aux interactions.",
                              "Tour distante statique ; vapeur et ciel au pilote N4b.",
                              "Fourgon statique ; la cabine utilise des proxies simplifiés."]})
    (out / "inventaire.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    source = ROOT / "assets_src/library/lib_quartier_N3b.blend"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 32
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 640, 360, 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (*materials.color("17232e"), 1)
    background.inputs["Strength"].default_value = .5
    paths = []
    streetscape(pieces, night=True)
    paths.append(render("01-rue-nuit", out, (1, -9, 1.35), (6, 4, 3.5)))
    clear_stage()
    streetscape(pieces)
    paths.append(render("02-facades", out, (19, -22, 15), (6, 4, 7), ortho=29))
    clear_stage()
    instance(pieces["bouche_6x12"])
    instance(pieces["grille_5m"], (.5, .07, 0))
    instance(pieces["lampadaire_5m"], (-1.5, 0, 0))
    studio((3, 4, -.5))
    paths.append(render("03-bouche", out, (11, -13, 9), (3, 4, -.3), ortho=20))
    clear_stage()
    instance(pieces["bouche_6x12"])
    light("jour", (3, 4, 7), (3, 7, -3), 1300, 6)
    light("palier", (3, 10, -2.5), (3, 6, -2), 150, 2, (1, .77, .44))
    paths.append(render("04-descente", out, (3, -.5, 1.6), (3, 8, -2.7)))
    clear_stage()
    for x, y, name in ((0, 2, "kiosque_3x2"), (4, 2, "abribus_4m"), (0, -1, "banc_2m"),
                        (3, -1, "corbeille"), (5, -1, "borne_075m"), (8, 2, "lampadaire_5m"),
                        (7, -1, "trappe_service_2m")):
        instance(pieces[name], (x, y, 0))
    studio((4, 2, 1.5))
    paths.append(render("05-mobilier", out, (13, -14, 8), (4, 1, 1.5), ortho=14))
    clear_stage()
    instance(pieces["vehicule_citadine"], (2, 5, 0), math.pi)
    instance(pieces["vehicule_berline"], (6, 5, 0), math.pi)
    instance(pieces["fourgon_5m"], (10.5, 5, 0), math.pi)
    studio((5, 2, .7))
    paths.append(render("06-vehicules", out, (14, -10, 6), (5, 2, 1), ortho=15))
    compose(paths, out / "planche.png")
    clear_stage()
    instance(pieces["repere_tour_56m"])
    light("ciel_tour", (10, -30, 65), (10, 8, 25), 30000, 40, (.65, .78, 1))
    light("flanc_tour", (40, 10, 40), (10, 8, 25), 25000, 30, (1, .72, .4))
    render("07-tour", out, (66, -86, 37), (12, 8, 27), ortho=112)
    clear_stage()
    for x, name in ((0, "banc_2m"), (3, "kiosque_3x2"), (7, "abribus_4m"), (12, "lampadaire_5m")):
        instance(pieces[name], (x, 0, 0))
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light, scene.display.shading.color_type = "FLAT", "SINGLE"
    scene.display.shading.single_color = (0, 0, 0)
    scene.display.shading.background_type, scene.display.shading.background_color = "WORLD", (1, 1, 1)
    scene.world.color = (1, 1, 1)
    render("08-silhouettes", out, (8, -18, 5), (7, 0, 2), ortho=17)
    clear_stage()
    print("[quartier-kit] " + json.dumps({"blend": str(source), "out": str(out),
                                         "pieces": report["count"], "triangles": report["triangles"]}))


if __name__ == "__main__":
    main()
