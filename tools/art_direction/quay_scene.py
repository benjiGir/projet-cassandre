"""Scène étalon DA : même assemblage exporté avec deux traitements de surface.

Recette : C.art_direction_quay() dans une session Blender neuve.
see: docs/assets/etalon-direction-artistique.md#reproduire
"""
from pathlib import Path
import json
import math
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools/blender"))
sys.path.insert(0, str(ROOT / "tools/metro/kit"))

import cassandre as C
from tools.blender import geo_utils
from tools.metro.quartier.authoring import Author
from tools.metro.blockout.control_panels import create as control_panel
from tools.metro.blockout.station_dressing import seating, route_map
from tools.metro.kit.modules import profile
from tools.art_direction.surface_recipes import build_materials, RAMPS

REPORT = ROOT / "docs/assets/etalon-da"
TEXTURES = ROOT / "assets_src/library/art_direction/textures"
FLOOR = .75
VIEWS = {"ensemble": (2.75, 1.5, FLOOR, 0),
         "matiere": (2.5, 3.1, FLOOR, 60),
         "service": (-1.5, 6.75, FLOOR, 0)}


class QuayAuthor(Author):
    def __init__(self):
        super().__init__(ROOT)
        names = ("quai_5x4", "mur_quai_4m", "voute_station_4m", "voie_4x4",
                 "luminaire_2m", "voiture_ligne_15m")
        with bpy.data.libraries.load(str(ROOT / "assets_src/library/lib_metro_N3.blend"), link=False) as (available, loaded):
            loaded.collections = ["kit_metro_" + name for name in names]
            loaded.materials = [name for name in available.materials if name.startswith("metro_")]
        for collection in loaded.collections:
            bpy.data.collections["_LIB"].children.link(collection)
            self.assets[collection.name.removeprefix("kit_metro_")] = collection
        self.mats.update({material.name.removeprefix("metro_"): material
                          for material in bpy.data.materials if material.name.startswith("metro_")})
        bpy.context.view_layer.layer_collection.children["_LIB"].exclude = True

    def marker(self, name, at, **extras):
        obj = bpy.data.objects.new(name, None)
        self.logic.objects.link(obj)
        obj.location = at
        for key, value in extras.items():
            obj[key] = value
        return obj

    def pickup(self, name, at, **extras):
        obj = self.box(name, tuple(v - .1 for v in at), (.2, .2, .2), "ivoire", False)
        obj.data.transform(Matrix.Translation(-Vector(at)))
        obj.location, obj.name = at, name
        for key, value in extras.items():
            obj[key] = value


def build_geometry(a):
    for y in range(0, 16, 4):
        a.place("quai_5x4", (0, y, 0))
        a.place("quai_5x4", (18, y + 4, 0), math.pi)
        if y != 4:
            a.place("mur_quai_4m", (-.3, y, FLOOR))
        a.place("mur_quai_4m", (18.3, y + 4, FLOOR), math.pi)
        a.place("voute_station_4m", (0, y, 0))
        for x in (5, 9):
            a.place("voie_4x4", (x, y, 0))
    a.place("voiture_ligne_15m", (9.6, .5, 0), collision=False)
    a.box("etalon_fond", (0, 16, 0), (18, .25, 6.5), "ivoire")
    a.box("etalon_arriere", (0, -.25, 0), (18, .25, 6.5), "ivoire")

    for y, length in ((4, 2), (7.5, .5)):
        a.box("etalon_jambage_" + str(y), (-.3, y, FLOOR), (.25, length, 3), "ivoire")
        for high in (0, 1.25):
            a.box(f"etalon_frise_{y}_{high}", (-.05, y, FLOOR + high), (.05, length, .25), "petrole", False)
    a.box("etalon_linteau", (-.3, 6, FLOOR + 2.5), (.25, 1.5, .5), "ivoire")
    for y in (5.94, 7.5):
        a.box("etalon_cadre_" + str(y), (-.06, y, FLOOR), (.08, .06, 2.55), "acier", False)
    a.box("etalon_cadre_haut", (-.06, 5.94, FLOOR + 2.5), (.08, 1.62, .06), "acier", False)
    door = a.box("etalon_rideau", (-.18, 6, FLOOR), (.13, 1.5, 2.5), "acier", False)
    door.name = "door_etalon_service"
    for key, value in {"mouvement": "monte", "course": 2.55, "duree": .7,
                       "referme": False, "manuelle": True}.items():
        door[key] = value
    control_panel(a, "use_etalon_service", (.01, 5.3, FLOOR + 1.3), math.pi / 2,
                  "SERVICE", door.name, "start", "wall")
    a.box("etalon_service_sol", (-3, 5.75, FLOOR - .25), (3, 4, .25), "sol")
    a.box("etalon_service_fond", (-3, 9.75, FLOOR), (3, .25, 3), "beton")
    a.box("etalon_service_sud", (-3, 5.5, FLOOR), (3, .25, 3), "beton")
    a.box("etalon_service_cote", (-3.25, 5.5, FLOOR), (.25, 4.5, 3), "beton")
    a.box("etalon_service_plafond", (-3.25, 5.5, FLOOR + 3), (3.25, 4.5, .25), "beton", False)
    a.box("etalon_armoire", (-2.8, 9.2, FLOOR), (1.15, .4, 1.95), "acier")
    a.box("etalon_armoire_fente", (-2.74, 9.17, FLOOR + 1.2), (1.03, .025, .03), "nuit", False)
    seating(a, "etalon", (.3, 2.5, FLOOR), math.pi / 2)
    route_map(a, "etalon", (.015, 9, FLOOR), math.pi / 2, compact=True)
    a.box("etalon_collecteur", (.05, 12.5, FLOOR), (.5, .5, .8), "petrole")
    a.box("etalon_collecteur_fente", (.055, 12.55, FLOOR + .61), (.505, .4, .09), "nuit", False)
    for x in (4.3, 13.7):
        for y in (0, 4, 8, 12, 16):
            a.box(f"etalon_garde_{x}_{y}", (x - .035, y - .035, FLOOR), (.07, .07, 1.1), "acier", False)
        for high in (.2, 1.1):
            a.box(f"etalon_lisse_{x}_{high}", (x - .035, 0, FLOOR + high), (.07, 16, .07), "acier", False)
    arch = profile(18, 6.5, 3.75)
    def ceiling(x):
        for start, end in zip(arch, arch[1:]):
            if end[0] > start[0] and start[0] <= x <= end[0]:
                return start[1] + (end[1] - start[1]) * (x - start[0]) / (end[0] - start[0])
        raise ValueError(f"Suspente hors voûte : {x}")
    for x in (1.25, 14.5):
        for y in (2, 8, 14):
            a.place("luminaire_2m", (x, y, 3.7))
            for offset in (.3, 1.7):
                sx = x + offset
                a.box(f"etalon_suspente_{sx}_{y}", (sx - .035, y + .09, 3.85),
                      (.07, .07, ceiling(sx) - 3.85), "acier", False)
            a.point(f"etalon_quai_{x}_{y}", (x + 1, y + .125, 3.65), "#dce5d4", 5, 12)
    a.box("etalon_service_lampe", (-2.75, 6.25, FLOOR + 2.7), (1.5, .15, .1), "lampe", False)
    a.point("etalon_service", (-1.5, 6.75, FLOOR + 2.7), "#dce5d4", 1.5, 6)
    a.marker("spawn_player", (2.75, 1.5, FLOOR + .1))
    for kind, x, y in (("suit", 2.75, 11.75), ("vigile", 3.75, 13), ("rampant", 1.5, 13.75)):
        obj = a.marker(f"spawn_{kind}_etalon", (x, y, FLOOR))
        obj.rotation_euler.z = math.pi
    for name, x, y, extras in (("use_etalon_soin", 1.2, 4.15, {"soin": 25}),
                               ("use_etalon_munitions", 1.8, 5.2, {"munitions": 20}),
                               ("use_etalon_cartouches", 2.55, 5.6, {"cartouches": 8}),
                               ("use_etalon_argent", 1.2, 8.5, {"card": "argent"}),
                               ("use_shotgun", 3.25, 7, {})):
        a.pickup(name, (x, y, FLOOR + .16), **extras)


def export_variant(stem):
    blend = ROOT / f"assets_src/blender/{stem}.blend"
    glb = ROOT / f"public/assets/levels/{stem}.glb"
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    result = C.export(out=glb, niveau="metro")
    if result.get("code") not in (None, 0):
        raise RuntimeError(result)
    return {"blend": str(blend.relative_to(ROOT)), "glb": str(glb.relative_to(ROOT))}


def main():
    geo_utils.wipe_scene()
    geo_utils.configure_scene()
    scene = bpy.context.scene
    scene["cassandre_niveau"] = "metro"
    scene["cassandre_etape"] = "etalon_da_candidat"
    author = QuayAuthor()
    build_geometry(author)
    for obj in author.lights.objects:
        if obj.type == "LIGHT":
            obj.data.use_shadow = False
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.03, .04, .05, 1)
    background.inputs["Strength"].default_value = .18
    scene.view_settings.view_transform = "Standard"
    REPORT.mkdir(parents=True, exist_ok=True)
    variants = {"actuel": export_variant("etalon_da_avant")}
    proposed = build_materials(author.mats, TEXTURES)
    mapping = {author.mats[name]: material for name, material in proposed.items()}
    for obj in bpy.context.view_layer.objects:
        if obj.type == "MESH" and not obj.name.startswith("col_"):
            for slot in obj.material_slots:
                if slot.material in mapping:
                    slot.material = mapping[slot.material]
    variants["proposition"] = export_variant("etalon_da")
    (REPORT / "scene.json").write_text(json.dumps({"variantes": variants,
        "vues": [{"nom": name, "pose": list(pose)} for name, pose in VIEWS.items()],
        "palette": RAMPS, "texture_px": 128, "texture_m": 2,
        "comparaison": "Géométrie, lampes, spawns et ramassages identiques."},
        ensure_ascii=False, indent=2) + "\n")
    result = C.sheet(list(VIEWS.values()), cols=2, taille=(640, 360), mode="material", nom="etalon_da_blender")
    print("[art-direction] " + json.dumps({"variantes": variants, "apercu": result}))


if __name__ == "__main__":
    main()
