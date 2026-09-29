"""Create four original vehicle studies and recolors of the existing cars.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
       -P tools/blender/propositions_extension_vehicules.py

Writes a separate source .blend, individual GLBs, and visual review renders.
The level and the existing vehicle sources are never modified.
"""

from __future__ import annotations

import importlib.util
import math
import os

import bpy
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets_src", "blender", "propositions_extension")
BLEND = os.path.join(ROOT, "assets_src", "blender", "propositions_extension.blend")


def load_builder(name):
    path = os.path.join(ROOT, "tools", "blender", f"propositions_{name}.py")
    spec = importlib.util.spec_from_file_location(f"propositions_{name}", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cars = load_builder("voitures")
bikes = load_builder("motos")


def pickup(b):
    spec = {
        "kind": "pickup", "length": 5.22, "body_width": 1.82, "height": 1.72,
        "wheelbase": 3.04, "wheel_z": 0.43, "wheel_radius": 0.36,
        "tire_width": 0.23, "arch_radius": 0.45, "cladding": "#292d2d",
        "body_color": "#7b5d44",
    }
    body = spec["body_color"]
    b.prism_yz(cars.lower_body_profile(5.22, 3.04, 0.45, 0.43, 0.75, 0.73),
               1.82, body, chamfer_top_edges=(1, 2, 3, 4),
               chamfer_width=0.08, chamfer_height=0.04)
    b.prism_yz([(2.61, 0.70), (2.56, 0.99), (0.84, 1.05),
                (0.45, 0.75)], 1.80, body)
    cabin = [(0.82, 1.02), (0.38, 1.67), (-0.84, 1.67), (-1.02, 0.78)]
    cars.add_cabin_structure(b, cabin, 1.58, body, 0.64, (-0.05,))
    for side in (-1, 1):
        x = side * 0.80
        cars.add_glass_side(b, x, [(0.73, 1.11), (0.39, 1.60),
                                    (-0.10, 1.60), (-0.12, 1.11)])
        cars.add_glass_side(b, x, [(-0.21, 1.11), (-0.16, 1.60),
                                    (-0.78, 1.60), (-0.88, 1.09)])
        b.beam_yz(x, (-0.16, 1.09), (-0.14, 1.65), 0.075, 0.09, body)
        b.box((side * 0.93, 0.62, 1.12), (0.11, 0.17, 0.10), "#2c3030")
        b.box((side * 0.915, -1.75, 0.88), (0.09, 1.70, 0.37), body)
        b.box((side * 0.97, -1.71, 1.07), (0.08, 1.76, 0.055), "#c1b9a6")
        b.box((side * 0.87, -1.73, 0.70), (0.035, 1.72, 0.04), "#343737")
        b.box((side * 0.83, -0.75, 0.77), (0.024, 0.02, 0.40), "#383734")
        b.box((side * 0.94, -0.05, 1.02), (0.025, 0.12, 0.034), "#d2c6ad")
    b.quad([(-0.68, 0.76, 1.09), (0.68, 0.76, 1.09),
            (0.65, 0.40, 1.61), (-0.65, 0.40, 1.61)], "#ffffff", 1)
    b.quad([(-0.65, -1.00, 1.08), (0.65, -1.00, 1.08),
            (0.62, -0.84, 1.60), (-0.62, -0.84, 1.60)], "#ffffff", 1)
    b.box((0, -1.70, 0.69), (1.66, 1.71, 0.035), "#595a53")
    for y in (-1.13, -1.50, -1.87, -2.25):
        b.box((0, y, 0.715), (1.56, 0.018, 0.009), "#797970")
    b.box((0, -2.565, 0.90), (1.82, 0.09, 0.38), body)
    b.box((0, -2.62, 0.73), (1.78, 0.027, 0.018), "#c1b9a6")
    b.box((0, 2.625, 0.76), (1.71, 0.09, 0.19), "#2c3030")
    for side in (-1, 1):
        b.box((side * 0.62, 2.665, 0.92), (0.33, 0.026, 0.13), "#e8ddb9")
        b.box((side * 0.71, -2.63, 0.91), (0.24, 0.027, 0.24), "#b45643")
    b.box((0, 2.677, 0.79), (0.55, 0.018, 0.22), "#343b3a")
    b.box((0, 2.70, 0.46), (1.90, 0.11, 0.11), "#a7aaa2")
    b.box((0, -2.68, 0.43), (1.88, 0.11, 0.11), "#a7aaa2")
    cars.add_wheels(b, spec)
    return spec


def sportive(b):
    spec = {
        "kind": "sportive", "length": 4.23, "body_width": 1.84,
        "height": 1.29, "wheelbase": 2.52, "wheel_z": 0.34,
        "wheel_radius": 0.31, "tire_width": 0.24,
        "rear_tire_width": 0.27, "arch_radius": 0.39,
        "cladding": "#202528", "body_color": "#2f6570",
    }
    body = spec["body_color"]
    top = [(2.115, 0.43), (2.10, 0.56), (1.48, 0.83),
           (0.64, 0.96), (-0.83, 0.93), (-1.72, 0.78),
           (-2.10, 0.60), (-2.115, 0.31)]
    bottom = [(-2.02, 0.19)]
    for center in (-1.26, 1.26):
        bottom.extend([(center - 0.48, 0.19), (center - 0.39, 0.34)])
        for i in range(1, 8):
            angle = math.pi - math.pi * i / 8
            bottom.append((center + 0.39 * math.cos(angle),
                           0.34 + 0.39 * math.sin(angle)))
        bottom.extend([(center + 0.39, 0.34), (center + 0.48, 0.19)])
    bottom.append((2.04, 0.19))
    b.prism_yz(top + bottom, 1.84, body,
               chamfer_top_edges=(2, 3, 4, 5),
               chamfer_width=0.11, chamfer_height=0.045)
    cabin = [(0.55, 0.93), (0.10, 1.28), (-0.84, 1.28), (-1.71, 0.80)]
    cars.add_cabin_structure(b, cabin, 1.58, body, 0.32, (-0.24,),
                             roof_color="#263b42")
    for side in (-1, 1):
        x = side * 0.80
        cars.add_glass_side(b, x, [(0.48, 0.99), (0.10, 1.23),
                                    (-0.45, 1.23), (-0.55, 0.98)])
        cars.add_glass_side(b, x, [(-0.66, 0.98), (-0.67, 1.23),
                                    (-0.84, 1.23), (-1.49, 0.83)])
        b.beam_yz(x, (-0.59, 0.96), (-0.59, 1.27), 0.052, 0.075, body)
        b.side_polygon([(0.00, 0.65), (-0.29, 0.65),
                        (-0.60, 0.42), (-0.34, 0.42)],
                       side * 0.94, "#1a3035")
        b.box((side * 0.94, -0.22, 0.39), (0.035, 1.55, 0.09), "#1d2c31")
        b.box((side * 0.93, 0.49, 0.99), (0.12, 0.14, 0.06), "#1e3034")
    b.quad([(-0.64, 0.50, 0.97), (0.64, 0.50, 0.97),
            (0.65, 0.12, 1.23), (-0.65, 0.12, 1.23)], "#ffffff", 1)
    b.quad([(-0.65, -1.56, 0.83), (0.65, -1.56, 0.83),
            (0.63, -0.87, 1.23), (-0.63, -0.87, 1.23)], "#ffffff", 1)
    for side in (-1, 1):
        b.box((side * 0.58, 2.124, 0.53), (0.42, 0.022, 0.075), "#f2e5bd")
        b.box((side * 0.63, -2.122, 0.59), (0.47, 0.025, 0.11), "#b44b42")
    b.box((0, 2.14, 0.31), (1.78, 0.11, 0.09), "#23292b")
    b.box((0, -2.14, 0.32), (1.80, 0.09, 0.12), "#23292b")
    b.box((0, -1.98, 0.91), (1.65, 0.24, 0.045), "#263b42")
    b.box((0, -1.96, 0.87), (1.75, 0.06, 0.06), body)
    cars.add_wheels(b, spec)
    return spec


def tout_terrain(b):
    body_length = 3.82
    spec = {
        "kind": "tout_terrain", "length": 4.25, "body_width": 1.72,
        "height": 1.90, "wheelbase": 2.30, "wheel_z": 0.40,
        "wheel_radius": 0.40, "tire_width": 0.24,
        "arch_radius": 0.49, "cladding": "#292e2c",
        "body_color": "#b29b72",
    }
    body = spec["body_color"]
    b.prism_yz(cars.lower_body_profile(body_length, spec["wheelbase"],
                                        spec["arch_radius"], spec["wheel_z"],
                                        1.20, 1.17), spec["body_width"], body,
               chamfer_top_edges=(1, 2, 3, 4),
               chamfer_width=0.10, chamfer_height=0.06)
    cabin = [(0.80, 1.18), (0.51, 1.78),
             (-1.57, 1.78), (-1.83, 1.16)]
    cars.add_cabin_structure(b, cabin, 1.48, body, 0.66, (0.16,),
                             roof_color="#3a403b")
    for side in (-1, 1):
        x = side * 0.752
        cars.add_glass_side(b, x, [(0.73, 1.28), (0.51, 1.70),
                                    (-0.18, 1.70), (-0.20, 1.28)])
        cars.add_glass_side(b, x, [(-0.32, 1.28), (-0.25, 1.70),
                                    (-1.43, 1.70), (-1.51, 1.25)])
        b.beam_yz(x, (-0.25, 1.25), (-0.20, 1.76),
                  0.075, 0.095, body)
        b.box((side * 0.87, 0.60, 1.30), (0.13, 0.17, 0.10),
              "#303434")
        b.box((side * 0.87, -0.07, 0.45), (0.11, 1.54, 0.13),
              "#303434")
        b.box((side * 0.871, 0.02, 0.76), (0.025, 0.025, 0.50),
              "#3c3f3b")
        b.box((side * 0.883, 0.25, 1.13), (0.025, 0.14, 0.035),
              "#e5d5af")
        b.box((side * 0.87, -1.66, 1.33), (0.03, 0.26, 0.12),
              "#363a36")
    b.quad([(-0.61, 0.76, 1.25), (0.61, 0.76, 1.25),
            (0.59, 0.53, 1.70), (-0.59, 0.53, 1.70)], "#ffffff", 1)
    b.quad([(-0.61, -1.78, 1.25), (0.61, -1.78, 1.25),
            (0.60, -1.58, 1.70), (-0.60, -1.58, 1.70)], "#ffffff", 1)
    b.box((0, 1.94, 0.48), (1.81, 0.13, 0.16), "#2d3431")
    b.box((0, -1.94, 0.48), (1.81, 0.13, 0.16), "#2d3431")
    b.box((0, 1.934, 0.91), (0.59, 0.025, 0.29), "#2d3532")
    for x in (-0.18, 0, 0.18):
        b.box((x, 1.958, 0.91), (0.045, 0.016, 0.22),
              "#aab2a6")
    for side in (-1, 1):
        b.cylinder_y((side * 0.58, 1.94, 1.00),
                     0.145, 0.075, "#d8d0ab", segments=10)
        b.cylinder_y((side * 0.58, 1.990, 1.00),
                     0.097, 0.018, "#f0e8c6", segments=10)
        b.box((side * 0.71, -1.937, 1.19),
              (0.19, 0.028, 0.39), "#b15643")
        b.box((side * 0.76, 1.85, 0.75),
              (0.12, 0.15, 0.08), "#c69249")
    b.box((0, 2.01, 0.60), (1.43, 0.07, 0.08), "#9ca69c")
    for side in (-1, 1):
        b.box((side * 0.62, 1.92, 0.73),
              (0.06, 0.15, 0.38), "#343b38")
    # The intake and exposed spare make the short utilitarian 4x4 read at game scale.
    b.box((0.82, 0.47, 1.47), (0.07, 0.08, 0.76), "#2e3432")
    b.box((0.82, 0.51, 1.86), (0.13, 0.15, 0.08), "#2e3432")
    b.box((0.82, 0.53, 1.885), (0.12, 0.14, 0.026), "#9a9e91")
    b.box((0, -1.99, 1.08), (0.39, 0.08, 0.13), "#5d625a")
    b.cylinder_y((0, -2.085, 1.08), 0.36, 0.15,
                 "#202526", segments=12)
    b.cylinder_y((0, -2.176, 1.08), 0.23, 0.024,
                 "#a5a99d", segments=10)
    b.cylinder_y((0, -2.193, 1.08), 0.085, 0.025,
                 "#5c625e", segments=8)
    cars.add_wheels(b, spec)
    return spec


def roadster(b):
    front, rear = 0.725, -0.725
    b.wheel(front, 0.31, 0.31, 0.11, "#aeb7b4")
    b.wheel(rear, 0.32, 0.32, 0.15, "#aeb7b4")
    for side in (-1, 1):
        x = side * 0.115
        b.tube((x, front, 0.31), (x, 0.42, 1.00), 0.031, "#aeb2ae")
        b.tube((x, 0.42, 0.92), (x, -0.13, 0.70), 0.029, "#3d4547")
        b.tube((x, -0.13, 0.70), (x, rear, 0.32), 0.031, "#42484a")
        b.tube((x, rear, 0.32), (x, -0.23, 0.42), 0.029, "#3d4547")
        b.tube((x, -0.23, 0.42), (x, 0.42, 0.92), 0.027, "#3d4547")
    b.prism([(0.29, 0.72), (0.22, 0.96), (-0.05, 0.97),
             (-0.30, 0.83), (-0.18, 0.72)], 0.43, "#466c78")
    b.prism([(-0.21, 0.88), (-0.66, 0.87), (-0.79, 0.79),
             (-0.36, 0.79)], 0.33, "#2a2c2c")
    b.prism([(-0.56, 0.70), (-0.95, 0.64), (-1.05, 0.51),
             (-0.61, 0.57)], 0.29, "#466c78")
    b.prism([(0.35, 0.72), (0.42, 0.64), (0.10, 0.55),
             (-0.17, 0.57)], 0.34, "#303637")
    for side in (-1, 1):
        x = side * 0.23
        b.box((x, -0.05, 0.57), (0.10, 0.27, 0.22), "#9ba5a1")
        for y in (-0.14, -0.07, 0.00, 0.07):
            b.box((x + side * 0.014, y, 0.58), (0.12, 0.022, 0.24), "#c2c5bb")
        b.tube((x, -0.07, 0.47), (x + side * 0.045, -0.78, 0.43),
               0.030, "#a7aaa4")
        b.tube((x + side * 0.045, -0.78, 0.43),
               (x + side * 0.045, -1.02, 0.43), 0.041, "#9a9c98")
        b.tube((side * 0.13, 0.38, 1.01),
               (side * 0.42, 0.40, 1.04), 0.019, "#b3b9b4")
        b.tube((side * 0.37, 0.40, 1.04),
               (side * 0.46, 0.40, 1.04), 0.028, "#272d2f")
    b.cylinder_y((0, 0.62, 0.92), 0.14, 0.09, "#bfc5ba")
    b.cylinder_y((0, 0.67, 0.92), 0.105, 0.016, "#eee6cb")
    b.box((0, -1.02, 0.57), (0.13, 0.04, 0.075), "#b24b42")
    return {"kind": "roadster", "dimensions_m": [2.12, 0.92, 1.08],
            "wheelbase_m": 1.45, "style": "roadster droit, moteur apparent"}


def scooter(b):
    front, rear = 0.67, -0.67
    b.wheel(front, 0.24, 0.24, 0.10, "#b8b9ad")
    b.wheel(rear, 0.24, 0.24, 0.12, "#b8b9ad")
    b.prism([(-0.90, 0.28), (-0.78, 0.56), (-0.51, 0.70),
             (-0.25, 0.65), (-0.35, 0.31)], 0.45, "#96b7af")
    b.prism([(-0.22, 0.34), (0.35, 0.34), (0.31, 0.43),
             (-0.26, 0.43)], 0.41, "#2f3637")
    b.prism([(0.29, 0.35), (0.39, 0.61), (0.45, 0.97),
             (0.60, 1.04), (0.74, 0.89), (0.58, 0.39)],
            0.42, "#96b7af")
    for side in (-1, 1):
        b.prism([(0.35, 0.41), (0.42, 0.68), (0.53, 0.83),
                 (0.62, 0.78), (0.55, 0.40)], 0.025,
                "#e0ded0", x=side * 0.23)
        b.tube((side * 0.15, -0.60, 0.31),
               (side * 0.16, -0.34, 0.53), 0.023, "#606768")
        b.tube((side * 0.14, 0.57, 0.72),
               (side * 0.14, 0.58, 1.11), 0.025, "#adb7b3")
        b.tube((side * 0.14, 0.58, 1.11),
               (side * 0.35, 0.54, 1.14), 0.019, "#adb7b3")
        b.tube((side * 0.35, 0.54, 1.14),
               (side * 0.43, 0.51, 1.16), 0.032, "#303334")
        b.tube((side * 0.32, 0.48, 1.10),
               (side * 0.40, 0.45, 1.26), 0.012, "#aab0ab")
        b.box((side * 0.40, 0.44, 1.27), (0.12, 0.04, 0.09), "#3b4545")
    b.prism([(-0.78, 0.77), (-0.28, 0.77), (-0.17, 0.70),
             (-0.67, 0.68)], 0.34, "#333435")
    b.prism([(-0.92, 0.43), (-1.04, 0.40), (-1.04, 0.31),
             (-0.87, 0.32)], 0.32, "#96b7af")
    b.cylinder_y((0, 0.70, 0.90), 0.13, 0.11, "#d8dbcf")
    b.cylinder_y((0, 0.77, 0.90), 0.095, 0.015, "#f3e9c7")
    b.box((0, -1.05, 0.46), (0.18, 0.025, 0.10), "#b95549")
    return {"kind": "scooter", "dimensions_m": [1.87, 0.74, 1.28],
            "wheelbase_m": 1.34, "style": "scooter urbain à plancher ouvert"}


PALETTES = {
    "citadine": (cars.make_citadine, "#bd8d3c", ("miel", "#bd8d3c"),
                 ("bleu_orage", "#537384"), ("rouge_brique", "#a94f42")),
    "berline": (cars.make_berline, "#71899a", ("bleu_acier", "#71899a"),
                ("ivoire", "#b8afa0"), ("vert_sauge", "#687e69")),
    "suv": (cars.make_suv, "#6f7c57", ("olive", "#6f7c57"),
            ("sable", "#b09265"), ("bleu_petrole", "#456c76")),
    "muscle": (cars.make_muscle, "#684266", ("prune", "#684266"),
               ("cuivre", "#a65c3f"), ("noir_bleute", "#374650")),
    "pickup": (pickup, "#7b5d44", ("terre", "#7b5d44"),
               ("creme", "#bdad8d"), ("vert_pin", "#4a6960")),
    "sportive": (sportive, "#2f6570", ("turquoise", "#2f6570"),
                  ("rouge_corail", "#a7433b"), ("argent", "#9aabb0")),
    "tout_terrain": (tout_terrain, "#b29b72", ("sable", "#b29b72"),
                     ("vert_foret", "#536953"),
                     ("bleu_ardoise", "#536c78")),
}


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def export_one(scene, obj, path):
    previous = obj.location.copy()
    obj.location = (0, 0, 0)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_apply=True, export_extras=True, export_vertex_color="ACTIVE",
        export_normals=True, export_tangents=False, export_yup=True,
        export_materials="EXPORT", export_animations=False,
        export_skins=False, export_draco_mesh_compression_enable=False)
    obj.location = previous


def run():
    os.makedirs(OUT, exist_ok=True)
    variants_dir = os.path.join(OUT, "variantes")
    os.makedirs(variants_dir, exist_ok=True)
    scene = bpy.context.scene
    scene.name = "PROPOSITIONS_EXTENSION_VEHICULES"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = cars.srgb("#b5bbb9")
    background.inputs["Strength"].default_value = 0.6
    car_mat = cars.vertex_material("MAT_EXTENSION_VOITURES_COL")
    glass_mat = cars.glass_material("MAT_EXTENSION_VOITURES_VERRE")
    bike_mat = bikes.material("MAT_EXTENSION_MOTOS_COL")
    floor_mat = cars.flat_material("MAT_EXTENSION_SOL", "#363c40")
    line_mat = cars.flat_material("MAT_EXTENSION_LIGNES", "#bdbaac")
    silhouette_mat = bpy.data.materials.new("MAT_EXTENSION_SILHOUETTE")
    silhouette_mat.use_nodes = True
    silhouette_mat.node_tree.nodes.clear()
    emission = silhouette_mat.node_tree.nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = cars.srgb("#111315")
    output = silhouette_mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
    silhouette_mat.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    vehicles = bpy.data.collections.new("EXTENSION_MODELES")
    studio = bpy.data.collections.new("EXTENSION_STUDIO")
    scene.collection.children.link(vehicles)
    scene.collection.children.link(studio)
    for obj in list(scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    variants = []
    model_positions = {
        "pickup": (-6.7, 3.1, 0), "tout_terrain": (0, 3.1, 0),
        "sportive": (6.7, 3.1, 0),
        "roadster": (-3.45, -3.3, 0), "scooter": (3.45, -3.3, 0),
    }
    for col, (kind, palette) in enumerate(PALETTES.items()):
        factory, source_color, *swatches = palette
        for row, (variant_name, target_color) in enumerate(swatches):
            builder = cars.MeshBuilder()
            info = factory(builder)
            if target_color != source_color:
                source = cars.srgb(source_color)
                target = cars.srgb(target_color)
                builder.colors = [target if value == source else value
                                  for value in builder.colors]
            name = f"proposition_{kind}_{variant_name}"
            obj = builder.build(name, vehicles, car_mat,
                                ((col - 3) * 6.2, 7.0 - row * 7.2, 0),
                                glass_mat)
            obj["type_vehicule"] = kind
            obj["variante_couleur"] = variant_name
            obj["couleur_carrosserie"] = target_color
            obj["dimensions_m"] = [info["length"], info["body_width"], info["height"]]
            obj["triangles_estimees"] = sum(len(p.vertices) - 2 for p in obj.data.polygons)
            obj["orientation"] = "avant vers +Y Blender"
            variants.append(obj)
    new_car_objects = [next(obj for obj in variants if obj["type_vehicule"] == kind)
                       for kind in ("pickup", "sportive", "tout_terrain")]
    new_bikes = []
    for kind, factory in (("roadster", roadster), ("scooter", scooter)):
        builder = bikes.Builder()
        info = factory(builder)
        obj = builder.build(f"proposition_{kind}", vehicles, bike_mat,
                            model_positions[kind])
        obj["type_vehicule"] = kind
        obj["dimensions_m"] = info["dimensions_m"]
        obj["empattement_m"] = info["wheelbase_m"]
        obj["style"] = info["style"]
        obj["triangles_estimees"] = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        obj["orientation"] = "avant vers +Y Blender"
        new_bikes.append(obj)
    new_models = new_car_objects + new_bikes
    floor = bpy.data.objects.new("sol_presentation", bpy.data.meshes.new("sol_presentation_mesh"))
    studio.objects.link(floor)
    floor.data.from_pydata([(-21, -17, -0.03), (21, -17, -0.03),
                            (21, 18, -0.03), (-21, 18, -0.03)], [], [(0, 1, 2, 3)])
    floor.data.materials.append(floor_mat)
    lines = []
    for x in (-18.6, -12.4, -6.2, 0, 6.2, 12.4, 18.6):
        mesh = bpy.data.meshes.new("studio_ligne_mesh")
        mesh.from_pydata([(x-0.02, -15, 0), (x+0.02, -15, 0),
                          (x+0.02, 16, 0), (x-0.02, 16, 0)], [], [(0, 1, 2, 3)])
        mesh.materials.append(line_mat)
        line = bpy.data.objects.new("studio_ligne", mesh)
        studio.objects.link(line)
        lines.append(line)
    camera_data = bpy.data.cameras.new("CAMERA_EXTENSION")
    camera = bpy.data.objects.new("CAMERA_EXTENSION", camera_data)
    studio.objects.link(camera)
    scene.camera = camera
    camera_data.type = "ORTHO"
    for name, loc, energy, size, swatch in (
        ("CLE", (1, 6, 10), 2200, 8, (1.0, 0.94, 0.84)),
        ("RETOUR", (-7, -2, 6), 1700, 7, (0.79, 0.87, 1.0)),
        ("ARRIERE", (7, -8, 6), 1300, 7, (1.0, 0.85, 0.72)),
    ):
        data = bpy.data.lights.new(f"EXTENSION_{name}", "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = swatch
        lamp = bpy.data.objects.new(f"EXTENSION_{name}", data)
        studio.objects.link(lamp)
        lamp.location = loc
        point_at(lamp, (0, 0, 0.3))

    def render(path, visible, location, target, scale, width, height,
               include_floor=True):
        wanted = set(visible)
        for obj in vehicles.objects:
            obj.hide_render = obj not in wanted
        for obj in studio.objects:
            if obj.type == "MESH":
                obj.hide_render = not include_floor
        camera.location = location
        point_at(camera, target)
        camera_data.ortho_scale = scale
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.filepath = path
        bpy.context.view_layer.update()
        bpy.ops.render.render(write_still=True)

    # Save each original model in a neutral position; colors are separate GLBs.
    for obj in new_car_objects:
        export_one(scene, obj, os.path.join(OUT, f"{obj['type_vehicule']}.glb"))
    for obj in new_bikes:
        export_one(scene, obj, os.path.join(OUT, f"{obj['type_vehicule']}.glb"))
    for obj in variants:
        export_one(scene, obj, os.path.join(
            variants_dir, f"{obj['type_vehicule']}_{obj['variante_couleur']}.glb"))

    # Group the new cars and bikes for the five-model comparison.
    original_positions = {obj: obj.location.copy() for obj in new_car_objects}
    for obj in new_car_objects:
        obj.location = model_positions[obj["type_vehicule"]]
    render(os.path.join(OUT, "nouveaux_modeles.png"), new_models,
           (12, 18, 14), (0, 0, 0.7), 23, 2600, 1600)
    for obj in new_models:
        original = obj.location.copy()
        obj.location = (0, 0, 0)
        render(os.path.join(OUT, f"{obj['type_vehicule']}.png"), [obj],
               (5.2, 7.2, 3.9) if obj in new_car_objects
               else (3.8, 5.0, 2.7),
               (0, 0, 0.74), 7.0 if obj in new_car_objects else 3.0,
               1400, 1000)
        obj.location = original
    terrain_obj = next(obj for obj in new_car_objects
                       if obj["type_vehicule"] == "tout_terrain")
    terrain_location = terrain_obj.location.copy()
    terrain_obj.location = (0, 0, 0)
    render(os.path.join(OUT, "tout_terrain_arriere.png"), [terrain_obj],
           (5.2, -7.2, 3.9), (0, 0, 0.9), 5.7, 1400, 1000)
    terrain_obj.location = terrain_location
    # Flat side views reveal whether each category is legible without color.
    silhouette_positions = {obj: obj.location.copy() for obj in new_models}
    for obj, x in zip(new_models, (-8.7, 1.5, -3.4, 6.3, 9.2)):
        obj.location = (x, 0, 0)
        obj.rotation_euler.z = -math.pi / 2
        for index in range(len(obj.data.materials)):
            obj.data.materials[index] = silhouette_mat
    background.inputs["Color"].default_value = cars.srgb("#fafaf6")
    background.inputs["Strength"].default_value = 1.0
    render(os.path.join(OUT, "silhouettes.png"), new_models,
           (0, 14, 2.4), (0, 0, 0.75), 24, 2600, 760, include_floor=False)
    for obj in new_models:
        obj.location = silhouette_positions[obj]
        obj.rotation_euler.z = 0
        obj.data.materials[0] = car_mat if obj in new_car_objects else bike_mat
        if obj in new_car_objects:
            obj.data.materials[1] = glass_mat
    background.inputs["Color"].default_value = cars.srgb("#b5bbb9")
    background.inputs["Strength"].default_value = 0.6
    for obj, loc in original_positions.items():
        obj.location = loc
    render(os.path.join(OUT, "variantes_couleurs.png"), variants,
           (23, 28, 27), (0, 0, 0.7), 50, 3200, 1750)
    for obj in vehicles.objects:
        obj.hide_render = False
    for obj in studio.objects:
        obj.hide_render = False
    scene.render.filepath = os.path.join(OUT, "nouveaux_modeles.png")
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print(f"EXTENSION_OK blend={BLEND} variants={len(variants)} "
          f"new_models={len(new_models)}")


if __name__ == "__main__":
    run()
