"""Generate five original low-poly vehicle studies in the active Blender session.

Run from Blender's Python Console with:
    exec(compile(open('/absolute/path/tools/blender/propositions_voitures.py').read(),
                 'propositions_voitures.py', 'exec'))

The script creates a temporary scene, writes an isolated .blend and one GLB per
vehicle, renders a comparison sheet, then removes its temporary datablocks. It
does not save or replace the active project file.
"""

from __future__ import annotations

import math
import os

import bpy
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUTPUT_DIR = os.path.join(ROOT, "assets_src", "blender", "propositions_voitures")
BLEND_PATH = os.path.join(ROOT, "assets_src", "blender", "propositions_voitures.blend")
SHEET_PATH = os.path.join(OUTPUT_DIR, "planche.png")
SILHOUETTE_PATH = os.path.join(OUTPUT_DIR, "silhouettes.png")
TRUCK_DETAIL_PATH = os.path.join(OUTPUT_DIR, "camion_hayon.png")
MUSCLE_DETAIL_PATH = os.path.join(OUTPUT_DIR, "muscle_72.png")
SCENE_NAME = "PROPOSITIONS_VOITURES"


def purge_previous_orphans():
    generated = (
        (bpy.data.meshes, ("proposition_citadine_mesh", "proposition_berline_mesh",
                           "proposition_suv_mesh", "proposition_camion_mesh",
                           "proposition_muscle_mesh",
                           "presentation_sol_et_marques_mesh",
                           "presentation_lignes_mesh")),
        (bpy.data.curves, ("titre_citadine", "titre_berline", "titre_suv", "titre_camion",
                           "titre_muscle_72",
                           "dimensions_citadine", "dimensions_berline", "dimensions_suv",
                           "dimensions_camion", "dimensions_muscle_72")),
        (bpy.data.cameras, ("CAMERA_PROPOSITIONS_VOITURES",)),
        (bpy.data.lights, ("PROTO_VOITURES_LUMIERE_", "LUMIERE_CLE",
                           "LUMIERE_REBOND", "LUMIERE_LATERALE")),
        (bpy.data.materials, ("MAT_VEHICULES_COL_V1", "MAT_VEHICULES_VERRE_V1",
                              "MAT_SOL_STUDIO_V1",
                              "MAT_LIGNES_STATIONNEMENT_V1", "MAT_LABEL_V1",
                              "MAT_PRESENTATION_PLANE_V1", "MAT_PRESENTATION_GUIDES_V1",
                              "MAT_SILHOUETTE_V1")),
        (bpy.data.worlds, ("MONDE_PROPOSITIONS_VOITURES",)),
    )
    for collection, prefixes in generated:
        for datablock in list(collection):
            if datablock.users == 0 and datablock.name.startswith(prefixes):
                collection.remove(datablock)


def srgb(hex_color: str):
    """Convert an sRGB hex swatch to Blender's linear color space."""
    raw = hex_color.lstrip("#")
    values = [int(raw[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
              for v in values]
    return (*linear, 1.0)


class MeshBuilder:
    """Append disconnected, flat-shaded surfaces with one vertex-color swatch per face."""

    def __init__(self):
        self.vertices = []
        self.faces = []
        self.colors = []
        self.material_indices = []

    def face(self, points, color, material_index=0):
        start = len(self.vertices)
        self.vertices.extend(tuple(p) for p in points)
        self.faces.append(tuple(range(start, start + len(points))))
        self.colors.append(srgb(color))
        self.material_indices.append(material_index)

    def box(self, center, size, color):
        cx, cy, cz = center
        sx, sy, sz = (v * 0.5 for v in size)
        v = [
            (cx - sx, cy - sy, cz - sz), (cx + sx, cy - sy, cz - sz),
            (cx + sx, cy + sy, cz - sz), (cx - sx, cy + sy, cz - sz),
            (cx - sx, cy - sy, cz + sz), (cx + sx, cy - sy, cz + sz),
            (cx + sx, cy + sy, cz + sz), (cx - sx, cy + sy, cz + sz),
        ]
        for face in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                     (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            self.face([v[i] for i in face], color)

    def prism_yz(self, profile, width, color, x_center=0,
                 chamfer_top_edges=(), chamfer_width=0.0, chamfer_height=0.0):
        half = width * 0.5
        side_plus = [(x_center + half, y, z) for y, z in profile]
        side_minus = [(x_center - half, y, z) for y, z in reversed(profile)]
        self.face(side_plus, color)
        self.face(side_minus, color)
        for i, (y0, z0) in enumerate(profile):
            y1, z1 = profile[(i + 1) % len(profile)]
            if i in chamfer_top_edges:
                xs = (x_center - half, x_center - half + chamfer_width,
                      x_center + half - chamfer_width, x_center + half)
                zs = (0, chamfer_height, chamfer_height, 0)
                for j in range(3):
                    self.face([(xs[j], y0, z0 + zs[j]),
                               (xs[j], y1, z1 + zs[j]),
                               (xs[j + 1], y1, z1 + zs[j + 1]),
                               (xs[j + 1], y0, z0 + zs[j + 1])], color)
            else:
                self.face([(x_center - half, y0, z0), (x_center - half, y1, z1),
                           (x_center + half, y1, z1), (x_center + half, y0, z0)], color)

    def side_polygon(self, profile, x, color, material_index=0):
        self.face([(x, y, z) for y, z in profile], color, material_index)

    def quad(self, points, color, material_index=0):
        self.face(points, color, material_index)

    def beam_yz(self, x, start, end, thickness, depth, color):
        dy, dz = end[0] - start[0], end[1] - start[1]
        length = math.hypot(dy, dz)
        oy = -dz / length * thickness * 0.5
        oz = dy / length * thickness * 0.5
        profile = [(start[0] + oy, start[1] + oz),
                   (end[0] + oy, end[1] + oz),
                   (end[0] - oy, end[1] - oz),
                   (start[0] - oy, start[1] - oz)]
        self.prism_yz(profile, depth, color, x_center=x)

    def cylinder_x(self, center, radius, depth, color, segments=10):
        cx, cy, cz = center
        left = []
        right = []
        for i in range(segments):
            angle = math.tau * i / segments
            y = cy + radius * math.cos(angle)
            z = cz + radius * math.sin(angle)
            left.append((-depth * 0.5 + cx, y, z))
            right.append((depth * 0.5 + cx, y, z))
        self.face(list(reversed(left)), color)
        self.face(right, color)
        for i in range(segments):
            j = (i + 1) % segments
            self.face([left[i], left[j], right[j], right[i]], color)

    def cylinder_y(self, center, radius, depth, color, segments=10):
        cx, cy, cz = center
        front = []
        back = []
        for i in range(segments):
            angle = math.tau * i / segments
            x = cx + radius * math.cos(angle)
            z = cz + radius * math.sin(angle)
            front.append((x, cy + depth * 0.5, z))
            back.append((x, cy - depth * 0.5, z))
        self.face(front, color)
        self.face(list(reversed(back)), color)
        for i in range(segments):
            j = (i + 1) % segments
            self.face([front[i], back[i], back[j], front[j]], color)

    def arc_band(self, center_y, center_z, x, outer, inner, color, segments=8):
        for i in range(segments):
            a0 = math.pi * i / segments
            a1 = math.pi * (i + 1) / segments
            points = [
                (x, center_y + outer * math.cos(a0), center_z + outer * math.sin(a0)),
                (x, center_y + outer * math.cos(a1), center_z + outer * math.sin(a1)),
                (x, center_y + inner * math.cos(a1), center_z + inner * math.sin(a1)),
                (x, center_y + inner * math.cos(a0), center_z + inner * math.sin(a0)),
            ]
            self.face(points, color)

    def build(self, name, collection, material, location=(0, 0, 0), glass_material=None):
        mesh = bpy.data.meshes.new(f"{name}_mesh")
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.materials.append(material)
        if glass_material is not None:
            mesh.materials.append(glass_material)
        mesh.update()
        colors = mesh.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
        mesh.color_attributes.active_color = colors
        for polygon in mesh.polygons:
            polygon.material_index = self.material_indices[polygon.index]
            rgba = self.colors[polygon.index]
            for loop_index in polygon.loop_indices:
                colors.data[loop_index].color = rgba
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        obj.location = location
        obj.select_set(False)
        return obj


def vertex_material(name):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.use_backface_culling = False
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = 0.72
    shader.inputs["Metallic"].default_value = 0.06
    vertex = nodes.new("ShaderNodeVertexColor")
    vertex.layer_name = "Col"
    links.new(vertex.outputs["Color"], shader.inputs["Base Color"])
    return material


def glass_material(name):
    material = flat_material(name, "#8fb5c0", roughness=0.15)
    shader = material.node_tree.nodes["Principled BSDF"]
    shader.inputs["Alpha"].default_value = 0.36
    shader.inputs["IOR"].default_value = 1.45
    if hasattr(material, "surface_render_method"):
        material.surface_render_method = "BLENDED"
    elif hasattr(material, "blend_method"):
        material.blend_method = "BLEND"
    material.use_backface_culling = False
    return material


def flat_material(name, hex_color, roughness=0.8):
    material = bpy.data.materials.new(name)
    material.diffuse_color = srgb(hex_color)
    material.use_nodes = True
    material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb(hex_color)
    material.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = roughness
    return material


def lower_body_profile(length, wheelbase, arch_radius, wheel_z, top_front, top_rear):
    front = length * 0.5
    rear = -front
    top = [
        (front, 0.46),
        (front - 0.06, top_front - 0.05),
        (wheelbase * 0.5 + 0.20, top_front),
        (0.58, top_front - 0.015),
        (-wheelbase * 0.5 - 0.14, top_rear),
        (rear + 0.04, top_rear - 0.08),
        (rear, 0.47),
    ]
    bottom = [(rear + 0.08, 0.20)]
    for center in (-wheelbase * 0.5, wheelbase * 0.5):
        bottom.extend([(center - arch_radius - 0.08, 0.20),
                       (center - arch_radius, wheel_z)])
        for i in range(1, 8):
            angle = math.pi - math.pi * i / 8
            bottom.append((center + arch_radius * math.cos(angle),
                           wheel_z + arch_radius * math.sin(angle)))
        bottom.extend([(center + arch_radius, wheel_z),
                       (center + arch_radius + 0.08, 0.20)])
    bottom.append((front - 0.09, 0.20))
    return top + bottom


def add_glass_side(builder, x, profile):
    builder.side_polygon(profile, x, "#ffffff", material_index=1)


def add_cabin_structure(builder, cabin, width, color, dashboard_y, seat_rows,
                        roof_color=None):
    front_base, front_roof, rear_roof, rear_base = cabin
    roof_z = front_roof[1]
    roof_front = front_roof[0]
    roof_rear = rear_roof[0]
    builder.prism_yz([(roof_front + 0.045, roof_z - 0.075),
                      (roof_front, roof_z), (roof_rear, roof_z),
                      (roof_rear - 0.045, roof_z - 0.075)],
                     width - 0.045, roof_color or color)
    for side in (-1, 1):
        x = side * (width * 0.5 - 0.025)
        builder.beam_yz(x, front_base, front_roof, 0.075, 0.105, color)
        builder.beam_yz(x, rear_roof, rear_base, 0.075, 0.105, color)
        builder.beam_yz(x, (roof_front, roof_z - 0.035),
                        (roof_rear, roof_z - 0.035), 0.085, 0.095, color)
        builder.beam_yz(x, (front_base[0], front_base[1] + 0.035),
                        (rear_base[0], rear_base[1] + 0.035),
                        0.085, 0.09, color)
    cabin_mid = (front_base[0] + rear_base[0]) * 0.5
    cabin_len = front_base[0] - rear_base[0] - 0.16
    builder.box((0, cabin_mid, front_base[1] + 0.018),
                (width - 0.12, cabin_len, 0.025), "#242a2b")
    builder.box((0, dashboard_y, front_base[1] + 0.075),
                (width - 0.19, 0.24, 0.09), "#303a3d")
    for seat_y in seat_rows:
        for side in (-1, 1):
            x = side * width * 0.24
            floor_z = front_base[1]
            builder.box((x, seat_y, floor_z + 0.095),
                        (width * 0.36, 0.37, 0.14), "#494b48")
            back_bottom = floor_z + 0.13
            back_top = roof_z - 0.16
            builder.box((x, seat_y - 0.13, (back_bottom + back_top) * 0.5),
                        (width * 0.34, 0.095, back_top - back_bottom), "#424745")
            headrest_top = roof_z - 0.105
            builder.box((x, seat_y - 0.13, (back_top + headrest_top) * 0.5),
                        (width * 0.18, 0.08, headrest_top - back_top), "#424745")


def add_wheels(builder, spec):
    for center_y in (-spec["wheelbase"] * 0.5, spec["wheelbase"] * 0.5):
        for side in (-1, 1):
            x = side * (spec["body_width"] * 0.5 - 0.15)
            tire_width = (spec.get("rear_tire_width", spec["tire_width"])
                          if center_y < 0 else spec["tire_width"])
            builder.cylinder_x((x, center_y, spec["wheel_z"]), spec["wheel_radius"],
                               tire_width, "#202122", segments=10)
            hub_x = x + side * (tire_width * 0.48)
            builder.cylinder_x((hub_x, center_y, spec["wheel_z"]),
                               spec["wheel_radius"] * 0.52, 0.045, "#9ba09b", segments=8)
            builder.cylinder_x((hub_x + side * 0.025, center_y, spec["wheel_z"]),
                               spec["wheel_radius"] * 0.16, 0.05, "#555b5c", segments=8)
            builder.arc_band(center_y, spec["wheel_z"],
                             side * (spec["body_width"] * 0.5 + 0.008),
                             spec["arch_radius"], spec["arch_radius"] - 0.055,
                             spec["cladding"], segments=8)


def nose_surface_y(spec, z, offset=0.0):
    """Y position of the sloped front body face, plus a small surface offset."""
    front = spec["length"] * 0.5
    top = spec["top_front"] - 0.05
    amount = max(0.0, min(1.0, (z - 0.46) / (top - 0.46)))
    return front - 0.06 * amount + offset


def nose_patch(builder, spec, center_x, width, z_bottom, z_top, color, offset=0.012):
    """Lay a flat detail directly on the tapered front fascia."""
    half = width * 0.5
    builder.quad([
        (center_x - half, nose_surface_y(spec, z_bottom, offset), z_bottom),
        (center_x + half, nose_surface_y(spec, z_bottom, offset), z_bottom),
        (center_x + half, nose_surface_y(spec, z_top, offset), z_top),
        (center_x - half, nose_surface_y(spec, z_top, offset), z_top),
    ], color)


def add_bumpers_and_lamps(builder, spec):
    length = spec["length"]
    width = spec["body_width"]
    front_y = length * 0.5 - 0.05
    rear_y = -length * 0.5 + 0.05
    builder.box((0, front_y, 0.45), (width + 0.10, 0.13, 0.19), spec["cladding"])
    builder.box((0, rear_y, 0.45), (width + 0.10, 0.13, 0.19), spec["cladding"])
    if spec["kind"] in {"citadine", "berline"}:
        nose_patch(builder, spec, 0, 0.43, 0.72, 0.86, "#25292b", 0.014)
        for z in (0.755, 0.795, 0.835):
            nose_patch(builder, spec, 0, 0.34, z, z + 0.012, "#798080", 0.022)
        lamp_width = 0.25 if spec["kind"] == "citadine" else 0.34
        for side in (-1, 1):
            center_x = side * 0.50
            nose_patch(builder, spec, center_x, lamp_width + 0.06,
                       0.715, 0.925, "#292d2e", 0.016)
            nose_patch(builder, spec, center_x, lamp_width,
                       0.74, 0.90, "#e1d7b4", 0.024)
        nose_patch(builder, spec, 0, 0.46, 0.565, 0.635, "#d6d1bd", 0.014)
    elif spec["round_lamps"]:
        for side in (-1, 1):
            builder.cylinder_y((side * 0.49, length * 0.5 - 0.095, 0.83),
                               0.14, 0.04, "#d7d0a8", segments=8)
            builder.cylinder_y((side * 0.49, length * 0.5 - 0.125, 0.83),
                               0.08, 0.05, "#eee5be", segments=8)
        builder.box((0, length * 0.5 - 0.11, 0.77), (0.57, 0.025, 0.20), "#25292b")
        builder.box((0, length * 0.5 - 0.13, 0.81), (0.36, 0.03, 0.10), "#25292b")
        for i in range(3):
            z = 0.775 + i * 0.035
            builder.box((0, length * 0.5 - 0.153, z), (0.27, 0.018, 0.012), "#798080")
    else:
        lamp_width = 0.34
        for side in (-1, 1):
            builder.box((side * 0.50, length * 0.5 - 0.09, 0.82),
                        (lamp_width, 0.035, 0.19), "#e1d7b4")
        builder.box((0, length * 0.5 - 0.11, 0.77), (0.57, 0.025, 0.20), "#25292b")
        builder.box((0, length * 0.5 - 0.13, 0.81), (0.36, 0.03, 0.10), "#25292b")
        for i in range(3):
            z = 0.775 + i * 0.035
            builder.box((0, length * 0.5 - 0.153, z), (0.27, 0.018, 0.012), "#798080")
    for side in (-1, 1):
        builder.box((side * (width * 0.34), -length * 0.5 + 0.10, 0.76),
                    (0.20, 0.035, 0.35), "#a3463c")
        builder.box((side * (width * 0.34), -length * 0.5 + 0.077, 0.64),
                    (0.20, 0.035, 0.08), "#d18e35")
    if spec["kind"] not in {"citadine", "berline"}:
        builder.box((0, length * 0.5 - 0.035, 0.55), (0.46, 0.018, 0.12), "#d6d1bd")
    builder.box((0, -length * 0.5 + 0.035, 0.55), (0.46, 0.018, 0.12), "#d6d1bd")


def add_side_trim_and_doors(builder, spec):
    side_x = spec["body_width"] * 0.5 + 0.012
    for side in (-1, 1):
        x = side * side_x
        builder.box((x, 0, spec["molding_z"]), (0.025, spec["length"] * 0.48, 0.075),
                    spec["cladding"])
        for seam_y in spec["door_seams"]:
            builder.box((x + side * 0.004, seam_y, 0.71), (0.012, 0.018, 0.48), "#373a38")
            builder.box((x + side * 0.014, seam_y + 0.16, 0.97), (0.018, 0.13, 0.035), "#d0c9b0")
        mirror_y = spec["mirror_y"]
        builder.box((side * (spec["body_width"] * 0.5 + 0.055), mirror_y, spec["mirror_z"]),
                    (0.12, 0.16, 0.09), spec["cladding"])
        builder.box((side * (spec["body_width"] * 0.5 + 0.06), mirror_y, spec["mirror_z"] + 0.01),
                    (0.07, 0.10, 0.045), spec["body_color"])


def make_citadine(builder):
    cabin_raise = 0.07
    spec = {
        "kind": "citadine", "length": 3.65, "body_width": 1.59, "height": 1.46,
        "wheelbase": 2.42, "wheel_z": 0.37, "wheel_radius": 0.315,
        "tire_width": 0.18, "arch_radius": 0.395,
        "top_front": 0.97, "top_rear": 0.94, "cladding": "#292b2b",
        "body_color": "#bd8d3c", "molding_z": 0.59,
        "door_seams": (0.20, -0.56), "mirror_y": 0.52, "mirror_z": 1.02,
        "round_lamps": False,
    }
    builder.prism_yz(lower_body_profile(spec["length"], spec["wheelbase"],
                                        spec["arch_radius"], spec["wheel_z"],
                                        spec["top_front"], spec["top_rear"]),
                     spec["body_width"], spec["body_color"],
                     chamfer_top_edges=(1, 2, 3, 4),
                     chamfer_width=0.09, chamfer_height=0.055)
    cabin = [(0.77, 0.95), (0.34, 1.39 + cabin_raise),
             (-0.64, 1.39 + cabin_raise), (-1.28, 0.93)]
    add_cabin_structure(builder, cabin, 1.39, spec["body_color"], 0.54, (0.12, -0.70))
    for side in (-1, 1):
        x = side * (1.39 * 0.5 + 0.008)
        add_glass_side(builder, x, [(0.65, 1.02), (0.36, 1.33 + cabin_raise),
                                    (-0.04, 1.33 + cabin_raise), (-0.04, 1.02)])
        add_glass_side(builder, x, [(-0.15, 1.02), (-0.13, 1.33 + cabin_raise),
                                    (-0.53, 1.33 + cabin_raise), (-0.60, 1.02)])
        add_glass_side(builder, x, [(-0.67, 1.02), (-0.63, 1.32 + cabin_raise),
                                    (-0.77, 1.32 + cabin_raise), (-1.14, 0.99)])
        builder.beam_yz(side * 0.67, (-0.095, 1.00), (-0.085, 1.37 + cabin_raise),
                        0.075, 0.095, spec["body_color"])
        builder.beam_yz(side * 0.67, (-0.635, 1.00), (-0.59, 1.37 + cabin_raise),
                        0.065, 0.095, spec["body_color"])
    builder.quad([(-0.56, 0.70, 1.00), (0.56, 0.70, 1.00),
                  (0.54, 0.38, 1.34 + cabin_raise),
                  (-0.54, 0.38, 1.34 + cabin_raise)], "#ffffff", 1)
    builder.quad([(-0.52, -1.10, 0.98), (0.52, -1.10, 0.98),
                  (0.52, -0.67, 1.34 + cabin_raise),
                  (-0.52, -0.67, 1.34 + cabin_raise)], "#ffffff", 1)
    builder.box((0, 0.83, 0.995), (0.88, 0.035, 0.018), "#343839")
    builder.box((0, -1.08, 0.96), (1.10, 0.035, 0.022), "#343839")
    add_wheels(builder, spec)
    add_bumpers_and_lamps(builder, spec)
    add_side_trim_and_doors(builder, spec)
    builder.box((0, 1.10, 0.965), (1.28, 0.018, 0.016), "#a99358")
    builder.box((0, -1.50, 0.925), (1.12, 0.018, 0.016), "#a99358")
    return spec


def make_berline(builder):
    cabin_raise = 0.07
    spec = {
        "kind": "berline", "length": 4.58, "body_width": 1.73, "height": 1.52,
        "wheelbase": 2.72, "wheel_z": 0.37, "wheel_radius": 0.33,
        "tire_width": 0.20, "arch_radius": 0.41,
        "top_front": 0.99, "top_rear": 0.99, "cladding": "#242729",
        "body_color": "#71899a", "molding_z": 0.62,
        "door_seams": (0.56, 0.02, -0.62), "mirror_y": 0.73, "mirror_z": 1.00,
        "round_lamps": False,
    }
    builder.prism_yz(lower_body_profile(spec["length"], spec["wheelbase"],
                                        spec["arch_radius"], spec["wheel_z"],
                                        spec["top_front"], spec["top_rear"]),
                     spec["body_width"], spec["body_color"],
                     chamfer_top_edges=(1, 2, 3, 4),
                     chamfer_width=0.10, chamfer_height=0.06)
    cabin = [(0.92, 0.98), (0.52, 1.45 + cabin_raise),
             (-0.66, 1.45 + cabin_raise), (-1.22, 0.98)]
    add_cabin_structure(builder, cabin, 1.48, spec["body_color"], 0.72, (0.21, -0.58))
    for side in (-1, 1):
        x = side * (1.48 * 0.5 + 0.008)
        add_glass_side(builder, x, [(0.77, 1.04), (0.55, 1.39 + cabin_raise),
                                    (0.08, 1.39 + cabin_raise), (0.08, 1.04)])
        add_glass_side(builder, x, [(-0.06, 1.04), (-0.07, 1.39 + cabin_raise),
                                    (-0.61, 1.39 + cabin_raise), (-0.67, 1.04)])
        add_glass_side(builder, x, [(-0.75, 1.04), (-0.69, 1.37 + cabin_raise),
                                    (-0.83, 1.37 + cabin_raise), (-1.13, 1.00)])
        builder.beam_yz(side * 0.71, (0.01, 1.02), (0.005, 1.43 + cabin_raise),
                        0.085, 0.10, spec["body_color"])
        builder.beam_yz(side * 0.71, (-0.71, 1.02), (-0.66, 1.43 + cabin_raise),
                        0.07, 0.10, spec["body_color"])
    builder.quad([(-0.61, 0.88, 1.02), (0.61, 0.88, 1.02),
                  (0.58, 0.55, 1.40 + cabin_raise),
                  (-0.58, 0.55, 1.40 + cabin_raise)], "#ffffff", 1)
    builder.quad([(-0.58, -1.08, 1.02), (0.58, -1.08, 1.02),
                  (0.56, -0.68, 1.40 + cabin_raise),
                  (-0.56, -0.68, 1.40 + cabin_raise)], "#ffffff", 1)
    builder.box((0, 1.24, 0.99), (1.40, 0.025, 0.018), "#59646a")
    builder.box((0, -1.55, 0.99), (1.25, 0.025, 0.018), "#59646a")
    add_wheels(builder, spec)
    add_bumpers_and_lamps(builder, spec)
    add_side_trim_and_doors(builder, spec)
    builder.box((0, 1.47, 0.99), (1.45, 0.025, 0.018), "#b7b4a4")
    builder.box((0, -1.76, 0.98), (1.25, 0.025, 0.018), "#b7b4a4")
    for side in (-1, 1):
        builder.box((side * 0.72, 0.35, 0.60), (0.025, 0.95, 0.045), "#b7b4a4")
    return spec


def make_suv(builder):
    spec = {
        "kind": "suv", "length": 4.45, "body_width": 1.82, "height": 1.84,
        "wheelbase": 2.54, "wheel_z": 0.50, "wheel_radius": 0.39,
        "tire_width": 0.23, "arch_radius": 0.49,
        "top_front": 1.22, "top_rear": 1.20, "cladding": "#282c29",
        "body_color": "#6f7c57", "molding_z": 0.69,
        "door_seams": (0.55, -0.11, -0.82), "mirror_y": 0.79, "mirror_z": 1.28,
        "round_lamps": True,
    }
    builder.prism_yz(lower_body_profile(spec["length"], spec["wheelbase"],
                                        spec["arch_radius"], spec["wheel_z"],
                                        spec["top_front"], spec["top_rear"]),
                     spec["body_width"], spec["body_color"],
                     chamfer_top_edges=(1, 2, 3, 4),
                     chamfer_width=0.10, chamfer_height=0.07)
    cabin = [(1.02, 1.20), (0.65, 1.78), (-1.58, 1.78), (-1.91, 1.20)]
    add_cabin_structure(builder, cabin, 1.56, spec["body_color"], 0.81, (0.32, -0.72, -1.31))
    for side in (-1, 1):
        x = side * (1.56 * 0.5 + 0.008)
        add_glass_side(builder, x, [(0.83, 1.28), (0.67, 1.70), (0.20, 1.70), (0.15, 1.28)])
        add_glass_side(builder, x, [(0.05, 1.28), (0.11, 1.70), (-0.55, 1.70), (-0.58, 1.28)])
        add_glass_side(builder, x, [(-0.70, 1.28), (-0.63, 1.70), (-1.41, 1.70), (-1.47, 1.25)])
        builder.beam_yz(side * 0.75, (0.10, 1.25), (0.16, 1.76),
                        0.085, 0.11, spec["body_color"])
        builder.beam_yz(side * 0.75, (-0.64, 1.25), (-0.59, 1.76),
                        0.085, 0.11, spec["body_color"])
    builder.quad([(-0.65, 0.96, 1.24), (0.65, 0.96, 1.24),
                  (0.62, 0.68, 1.72), (-0.62, 0.68, 1.72)], "#ffffff", 1)
    builder.quad([(-0.62, -1.76, 1.26), (0.62, -1.76, 1.26),
                  (0.62, -1.60, 1.71), (-0.62, -1.60, 1.71)], "#ffffff", 1)
    builder.box((0, 1.19, 1.22), (1.30, 0.025, 0.02), "#343a35")
    builder.box((0, -1.69, 1.22), (1.28, 0.025, 0.02), "#343a35")
    add_wheels(builder, spec)
    add_bumpers_and_lamps(builder, spec)
    add_side_trim_and_doors(builder, spec)
    for side in (-1, 1):
        builder.box((side * (spec["body_width"] * 0.5 + 0.012), 0, 0.44),
                    (0.025, 0.86, 0.18), spec["cladding"])
    for side in (-1, 1):
        x = side * 0.64
        builder.box((x, -0.05, 1.805), (0.055, 2.10, 0.045), "#262a28")
    for y in (0.66, -0.86):
        builder.box((0, y, 1.825), (1.38, 0.07, 0.03), "#3a3d3a")
    for side in (-1, 1):
        builder.box((side * 0.60, 2.21, 0.78), (0.12, 0.16, 0.10), "#d4c7a5")
        builder.box((side * 0.62, 2.21, 0.61), (0.11, 0.16, 0.08), "#d18e35")
        builder.box((side * 0.73, -2.18, 1.03), (0.17, 0.035, 0.40), "#a3463c")
    return spec


def make_muscle(builder):
    spec = {
        "kind": "muscle", "length": 4.86, "body_width": 1.94, "height": 1.30,
        "wheelbase": 2.79, "wheel_z": 0.36, "wheel_radius": 0.34,
        "tire_width": 0.23, "rear_tire_width": 0.30, "arch_radius": 0.42,
        "top_front": 0.98, "top_rear": 0.94, "cladding": "#2d292d",
        "body_color": "#684266",
    }
    builder.prism_yz(lower_body_profile(spec["length"], spec["wheelbase"],
                                        spec["arch_radius"], spec["wheel_z"],
                                        spec["top_front"], spec["top_rear"]),
                     spec["body_width"], spec["body_color"],
                     chamfer_top_edges=(1, 2, 3, 4),
                     chamfer_width=0.11, chamfer_height=0.055)
    cabin = [(0.45, 0.88), (-0.03, 1.30), (-0.94, 1.30), (-1.68, 0.88)]
    add_cabin_structure(builder, cabin, 1.70, spec["body_color"], 0.24,
                        (-0.32, -1.05), roof_color="#29272c")
    for side in (-1, 1):
        x = side * 0.858
        add_glass_side(builder, x, [(0.34, 0.99), (-0.04, 1.23),
                                    (-0.70, 1.23), (-0.75, 0.99)])
        add_glass_side(builder, x, [(-0.83, 0.99), (-0.83, 1.23),
                                    (-0.94, 1.23), (-1.52, 0.97)])
        builder.beam_yz(side * 0.83, (-0.78, 0.96), (-0.76, 1.28),
                        0.045, 0.065, "#bcb7ad")
    builder.quad([(-0.69, 0.39, 0.98), (0.69, 0.39, 0.98),
                  (0.68, -0.02, 1.24), (-0.68, -0.02, 1.24)], "#ffffff", 1)
    builder.quad([(-0.66, -1.57, 0.96), (0.66, -1.57, 0.96),
                  (0.67, -0.96, 1.24), (-0.67, -0.96, 1.24)], "#ffffff", 1)
    for side in (-1, 1):
        x = side * 0.24
        builder.quad([(x - 0.075, 2.10, 1.049), (x + 0.075, 2.10, 1.049),
                      (x + 0.075, 0.62, 1.075), (x - 0.075, 0.62, 1.075)],
                     "#29262b")
        builder.box((x, 1.36, 1.095), (0.20, 0.46, 0.07), "#302a30")
        builder.box((x, 1.59, 1.127), (0.16, 0.026, 0.039), "#161719")
    builder.box((0, 2.433, 0.76), (1.81, 0.038, 0.28), "#29272b")
    for x in (-0.75, -0.49, 0.49, 0.75):
        builder.cylinder_y((x, 2.465, 0.78), 0.105, 0.055,
                           "#e0d6ae", segments=10)
        builder.cylinder_y((x, 2.49, 0.78), 0.074, 0.017,
                           "#f4e8c7", segments=10)
    builder.box((0, 2.50, 0.44), (2.01, 0.10, 0.11), "#b2ada5")
    builder.box((0, -2.45, 0.75), (1.78, 0.04, 0.25), "#252529")
    for side in (-1, 1):
        builder.box((side * 0.55, -2.48, 0.75),
                    (0.47, 0.028, 0.16), "#b34a45")
        builder.box((side * 0.90, 2.40, 0.55),
                    (0.095, 0.034, 0.17), "#d39a52")
        builder.box((side * 0.979, -0.22, 0.68),
                    (0.02, 2.28, 0.055), "#2c272d")
        builder.box((side * 0.981, -0.70, 0.68),
                    (0.024, 0.018, 0.43), "#332b32")
        builder.box((side * 0.992, -0.55, 0.94),
                    (0.018, 0.16, 0.029), "#c5beb0")
        builder.box((side * 0.83, -1.66, 0.92),
                    (0.07, 0.35, 0.045), "#b3aba1")
        builder.cylinder_y((side * 0.56, -2.47, 0.29),
                           0.07, 0.17, "#9c9c96", segments=8)
    builder.box((0, -2.49, 0.43), (2.04, 0.10, 0.11), "#b2ada5")
    builder.box((0, -2.20, 0.985), (1.63, 0.17, 0.055), "#29272c")
    add_wheels(builder, spec)
    return spec


def make_camion(builder):
    spec = {
        "kind": "camion", "length": 6.40, "body_width": 2.04,
        "overall_width": 2.12, "height": 2.90,
        "wheelbase": 3.75, "wheel_z": 0.48, "wheel_radius": 0.38,
        "tire_width": 0.24, "arch_radius": 0.47,
        "cladding": "#303330", "body_color": "#a95438",
    }
    front = 3.20
    arch_y = spec["wheelbase"] * 0.5
    arch = [(arch_y - spec["arch_radius"], 0.30)]
    for i in range(1, 10):
        angle = math.pi - math.pi * i / 10
        arch.append((arch_y + spec["arch_radius"] * math.cos(angle),
                     spec["wheel_z"] + spec["arch_radius"] * math.sin(angle)))
    arch.append((arch_y + spec["arch_radius"], 0.30))
    cab_lower = [(front, 0.47), (front - 0.035, 1.06), (2.72, 1.34),
                 (0.74, 1.34), (0.74, 0.34),
                 (arch_y - spec["arch_radius"] - 0.10, 0.30)] + arch + [
                     (front - 0.06, 0.30)]
    builder.prism_yz(cab_lower, 1.94, spec["body_color"],
                     chamfer_top_edges=(1, 2), chamfer_width=0.11,
                     chamfer_height=0.06)

    cabin = [(2.75, 1.30), (2.20, 2.20), (0.98, 2.20), (0.76, 1.30)]
    add_cabin_structure(builder, cabin, 1.82, spec["body_color"], 2.48, (1.58,))
    for side in (-1, 1):
        glass_x = side * 0.918
        add_glass_side(builder, glass_x,
                       [(2.62, 1.42), (2.19, 2.12), (1.55, 2.12), (1.55, 1.42)])
        add_glass_side(builder, glass_x,
                       [(1.44, 1.42), (1.43, 2.12), (1.03, 2.12), (0.84, 1.42)])
        builder.beam_yz(side * 0.89, (1.50, 1.38), (1.49, 2.17),
                        0.085, 0.11, spec["body_color"])
        builder.box((side * 0.99, 2.63, 1.52),
                    (0.17, 0.21, 0.12), "#303330")
        builder.box((side * 0.991, 1.54, 1.36),
                    (0.015, 0.22, 0.035), "#d3bf9c")
    builder.quad([(-0.73, 2.68, 1.42), (0.73, 2.68, 1.42),
                  (0.72, 2.22, 2.12), (-0.72, 2.22, 2.12)], "#ffffff", 1)
    builder.box((0, 3.205, 0.52), (2.10, 0.14, 0.24), "#303330")
    builder.box((0, 3.218, 0.88), (0.62, 0.025, 0.34), "#3d4441")
    for side in (-1, 1):
        builder.box((side * 0.70, 3.205, 0.96),
                    (0.32, 0.045, 0.22), "#e3d8b0")
        builder.box((side * 0.72, 3.208, 0.70),
                    (0.30, 0.035, 0.09), "#dfa05e")
    builder.box((0, 3.29, 0.56), (0.49, 0.02, 0.12), "#d9d2bd")

    builder.box((0, -0.78, 0.64), (1.66, 4.78, 0.19), "#303330")
    builder.box((0, -1.10, 2.01), (2.12, 4.10, 1.72), "#d5d0bd")
    builder.box((0, -1.10, 2.887), (1.96, 4.10, 0.025), "#e4dfcf")
    for side in (-1, 1):
        x = side * 1.065
        builder.box((x, -1.06, 1.59), (0.018, 3.90, 0.11), "#b96d42")
        builder.box((x, -1.02, 2.80), (0.018, 3.96, 0.055), "#e9e4d5")
        builder.box((x, -2.70, 1.17), (0.045, 0.42, 0.08), "#424742")
        builder.side_polygon([(-0.48, 2.12), (-0.07, 2.52),
                              (0.08, 2.52), (-0.33, 2.12)],
                             side * 1.079, "#b96d42")
        builder.side_polygon([(-0.06, 2.12), (0.35, 2.52),
                              (0.50, 2.52), (0.09, 2.12)],
                             side * 1.079, "#37474a")
    for y in (0.92, -3.12):
        builder.box((0, y, 2.84), (2.15, 0.055, 0.075), "#bcb8a9")
    builder.box((0, -3.162, 2.05), (1.94, 0.025, 1.48), "#bcb9aa")
    for z in (1.55, 1.78, 2.01, 2.24, 2.47, 2.70):
        builder.box((0, -3.182, z), (1.82, 0.02, 0.022), "#918f86")
    for side in (-1, 1):
        x = side * 0.97
        builder.box((x, -3.22, 1.62), (0.085, 0.10, 2.22), "#474b47")
        builder.box((side * 0.85, -3.26, 0.87),
                    (0.10, 0.14, 0.56), "#373d3b")
        builder.box((side * 0.81, -3.295, 0.87),
                    (0.09, 0.035, 0.25), "#747a76")
        builder.box((side * 0.91, -3.265, 1.33),
                    (0.12, 0.07, 0.22), "#a94735")
    builder.box((0, -3.27, 0.96), (1.74, 0.075, 0.88), "#414945")
    builder.box((0, -3.325, 1.38), (1.66, 0.018, 0.065), "#e8e3d6")
    for side in (-1, 1):
        x = side * 0.67
        for z in (0.66, 0.92, 1.18):
            builder.box((x, -3.323, z), (0.20, 0.018, 0.08),
                        "#d7ded6" if z == 0.92 else "#c9483d")
    builder.box((0, -3.19, 0.41), (2.05, 0.12, 0.13), "#303330")
    add_wheels(builder, spec)
    for side in (-1, 1):
        builder.box((side * 0.92, -3.20, 0.56),
                    (0.20, 0.08, 0.17), "#b34735")
    return spec


def make_mesh_object(name, spec, builder, collection, material, glass, x_pos):
    obj = builder.build(name, collection, material, (x_pos, 0, 0), glass)
    triangle_count = sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)
    obj["type_vehicule"] = spec["kind"]
    obj["dimensions_m"] = [spec["length"], spec.get("overall_width", spec["body_width"]),
                            spec["height"]]
    obj["triangles_estimees"] = triangle_count
    obj["orientation"] = "avant vers +Y Blender"
    obj["inspiration"] = {
        "citadine": "supermini 5 portes européenne, années 1980",
        "berline": "berline familiale européenne trois volumes, années 1980",
        "suv": "4x4 familial carré européen, années 1980",
        "camion": "porteur léger à caisse de livraison et hayon replié",
        "muscle": "coupé américain deux portes à long capot, début des années 1970",
    }[spec["kind"]]
    return obj


def aim_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def make_text(name, body, location, size, material, collection):
    curve = bpy.data.curves.new(name, type="FONT")
    curve.body = body
    curve.size = size
    curve.extrude = 0
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.location = location
    obj.data.materials.append(material)
    return obj


def run():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    purge_previous_orphans()
    window = bpy.context.window
    original_scene = window.scene if window else bpy.context.scene
    original_active = bpy.context.view_layer.objects.active if bpy.context.view_layer else None
    original_selected = [obj for obj in bpy.context.selected_objects]

    scene = None
    created_objects = []
    created_collections = []
    created_materials = []
    created_worlds = []
    exported = []
    result = ""
    try:
        scene = bpy.data.scenes.new(SCENE_NAME)
        scene.unit_settings.system = "METRIC"
        scene.unit_settings.scale_length = 1.0
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = 3000
        scene.render.resolution_y = 1300
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGBA"
        scene.render.film_transparent = False
        scene.render.filepath = SHEET_PATH
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "Medium High Contrast"
        scene.render.image_settings.color_depth = "8"
        scene.render.resolution_percentage = 100
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.film_transparent = False
        scene.world = bpy.data.worlds.new("MONDE_PROPOSITIONS_VOITURES")
        created_worlds.append(scene.world)
        scene.world.use_nodes = True
        bg = scene.world.node_tree.nodes.get("Background")
        bg.inputs["Color"].default_value = srgb("#9da3a5")
        bg.inputs["Strength"].default_value = 0.45

        vehicles = bpy.data.collections.new("VEHICULES_MODELES_ORIGINAUX")
        presentation = bpy.data.collections.new("PRESENTATION_STUDIO")
        created_collections.extend((vehicles, presentation))
        scene.collection.children.link(vehicles)
        scene.collection.children.link(presentation)

        material = vertex_material("MAT_VEHICULES_COL_V1")
        created_materials.append(material)
        glass = glass_material("MAT_VEHICULES_VERRE_V1")
        created_materials.append(glass)
        ground_mat = flat_material("MAT_SOL_STUDIO_V1", "#44494b")
        line_mat = flat_material("MAT_LIGNES_STATIONNEMENT_V1", "#9c9e96")
        label_mat = flat_material("MAT_LABEL_V1", "#ece8d9")
        created_materials.extend((ground_mat, line_mat, label_mat))

        car_specs = [
            ("proposition_citadine", make_citadine, 12.0),
            ("proposition_berline", make_berline, 6.0),
            ("proposition_suv", make_suv, 0.0),
            ("proposition_camion", make_camion, -6.0),
            ("proposition_muscle", make_muscle, -12.0),
        ]
        car_objects = []
        for name, factory, x_pos in car_specs:
            builder = MeshBuilder()
            spec = factory(builder)
            obj = make_mesh_object(name, spec, builder, vehicles, material, glass, x_pos)
            created_objects.append(obj)
            car_objects.append((obj, spec, x_pos))

        floor_builder = MeshBuilder()
        floor_builder.box((0, 0, -0.17), (31.8, 16.0, 0.30), "#44494b")
        floor_obj = floor_builder.build("presentation_sol_et_marques", presentation,
                                        vertex_material("MAT_PRESENTATION_PLANE_V1"), (0, 0, 0))
        created_objects.append(floor_obj)
        created_materials.append(floor_obj.data.materials[0])
        # A separate direct-color floor material keeps the studio objects independent of vehicle swatches.
        floor_obj.data.materials.clear()
        floor_obj.data.materials.append(ground_mat)
        floor_obj.data.color_attributes.remove(floor_obj.data.color_attributes["Col"])
        for poly in floor_obj.data.polygons:
            poly.material_index = 0
        # The visible parking guides are thin, high-contrast blocks on the floor.
        guide_builder = MeshBuilder()
        for x_pos in (-15.0, -9.0, -3.0, 3.0, 9.0, 15.0):
            guide_builder.box((x_pos, 0, -0.009), (0.055, 8.0, 0.018), "#b1b1a7")
        guide_obj = guide_builder.build("presentation_lignes", presentation,
                                        vertex_material("MAT_PRESENTATION_GUIDES_V1"), (0, 0, 0))
        created_objects.append(guide_obj)
        created_materials.append(guide_obj.data.materials[0])
        guide_obj.data.materials.clear()
        guide_obj.data.materials.append(line_mat)
        guide_obj.data.color_attributes.remove(guide_obj.data.color_attributes["Col"])
        for poly in guide_obj.data.polygons:
            poly.material_index = 0

        labels = [
            ("CITADINE", "3,65 × 1,59 × 1,46 m"),
            ("BERLINE", "4,58 × 1,73 × 1,52 m"),
            ("SUV", "4,45 × 1,82 × 1,84 m"),
            ("CAMION", "6,40 × 2,12 × 2,90 m"),
            ("MUSCLE 72", "4,86 × 1,94 × 1,30 m"),
        ]
        camera_position = Vector((11.0, 19.0, 12.0))
        camera_target = Vector((0.0, 0.2, 1.00))
        camera_quaternion = (camera_target - camera_position).to_track_quat("-Z", "Y")
        camera_right = camera_quaternion @ Vector((1.0, 0.0, 0.0))
        label_angle = math.atan2(camera_right.y, camera_right.x)
        for (obj, _spec, x_pos), (title, dimensions) in zip(car_objects, labels):
            def centered_label_position(body, size, front_offset):
                anchor = Vector((-0.85, front_offset, 0.006))
                anchor -= camera_right * anchor.dot(camera_right)
                anchor -= camera_right * (len(body) * size * 0.58 * 0.5)
                return Vector((x_pos, 0, 0)) + anchor

            label_y = 4.35 if title == "CAMION" else 3.55
            title_obj = make_text(f"titre_{title.lower()}", title,
                                  centered_label_position(title, 0.33, label_y), 0.33,
                                  label_mat, presentation)
            size_obj = make_text(f"dimensions_{title.lower()}", dimensions,
                                 centered_label_position(dimensions, 0.16, label_y - 0.37), 0.16,
                                 label_mat, presentation)
            title_obj.rotation_euler.z = label_angle
            size_obj.rotation_euler.z = label_angle
            created_objects.extend((title_obj, size_obj))

        camera_data = bpy.data.cameras.new("CAMERA_PROPOSITIONS_VOITURES")
        camera = bpy.data.objects.new("CAMERA_PROPOSITIONS_VOITURES", camera_data)
        presentation.objects.link(camera)
        camera.location = camera_position
        aim_at(camera, camera_target)
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = 30.0
        scene.camera = camera
        created_objects.append(camera)

        def area_light(name, location, energy, size, color):
            data = bpy.data.lights.new(f"PROTO_VOITURES_{name}", "AREA")
            data.energy = energy
            data.shape = "DISK"
            data.size = size
            data.color = tuple(int(color[i:i + 2], 16) / 255.0 for i in (1, 3, 5))
            obj = bpy.data.objects.new(f"PROTO_VOITURES_{name}", data)
            presentation.objects.link(obj)
            obj.location = location
            aim_at(obj, (0, 0, 0.3))
            created_objects.append(obj)
            return obj

        area_light("LUMIERE_CLE", (1, 7, 10), 2300, 9.0, "#fff0d8")
        area_light("LUMIERE_REBOND", (-8, 3, 5), 1400, 7.0, "#c5d8e0")
        area_light("LUMIERE_LATERALE", (2, -7, 6), 1800, 6.0, "#e4cba0")

        if window:
            window.scene = scene
        bpy.context.view_layer.update()
        bpy.ops.render.render(write_still=True)

        truck_obj = next(obj for obj, spec, _x in car_objects if spec["kind"] == "camion")
        detail_camera = (camera.location.copy(), camera.rotation_euler.copy(), camera.data.ortho_scale)
        detail_render = (scene.render.resolution_x, scene.render.resolution_y, scene.render.filepath)
        detail_visibility = {obj: obj.hide_render for obj in scene.objects}
        detail_truck_location = truck_obj.location.copy()
        for obj, _spec, _x in car_objects:
            if obj != truck_obj:
                obj.hide_render = True
        for obj in presentation.objects:
            if obj.type == "FONT" or obj == guide_obj:
                obj.hide_render = True
        truck_obj.location = (0, 0, 0)
        camera.location = (-5.5, -8.6, 5.7)
        aim_at(camera, (0, -0.6, 1.47))
        camera.data.ortho_scale = 8.8
        scene.render.resolution_x = 1500
        scene.render.resolution_y = 1050
        scene.render.filepath = TRUCK_DETAIL_PATH
        bpy.context.view_layer.update()
        bpy.ops.render.render(write_still=True)
        for obj, hidden in detail_visibility.items():
            obj.hide_render = hidden
        truck_obj.location = detail_truck_location
        camera.location, camera.rotation_euler, camera.data.ortho_scale = detail_camera
        scene.render.resolution_x, scene.render.resolution_y, scene.render.filepath = detail_render

        muscle_obj = next(obj for obj, spec, _x in car_objects if spec["kind"] == "muscle")
        detail_visibility = {obj: obj.hide_render for obj in scene.objects}
        detail_location = muscle_obj.location.copy()
        for obj, _spec, _x in car_objects:
            if obj != muscle_obj:
                obj.hide_render = True
        for obj in presentation.objects:
            if obj.type == "FONT" or obj == guide_obj:
                obj.hide_render = True
        muscle_obj.location = (0, 0, 0)
        camera.location = (5.5, 8.0, 4.5)
        aim_at(camera, (0, 0, 0.66))
        camera.data.ortho_scale = 6.8
        scene.render.resolution_x = 1500
        scene.render.resolution_y = 1050
        scene.render.filepath = MUSCLE_DETAIL_PATH
        bpy.context.view_layer.update()
        bpy.ops.render.render(write_still=True)
        for obj, hidden in detail_visibility.items():
            obj.hide_render = hidden
        muscle_obj.location = detail_location
        camera.location, camera.rotation_euler, camera.data.ortho_scale = detail_camera
        scene.render.resolution_x, scene.render.resolution_y, scene.render.filepath = detail_render

        # Side-on black silhouettes check that category reads come from shape.
        silhouette_mat = flat_material("MAT_SILHOUETTE_V1", "#101112", roughness=1.0)
        created_materials.append(silhouette_mat)
        previous_render = (scene.render.resolution_x, scene.render.resolution_y,
                           scene.render.resolution_percentage, scene.render.filepath)
        previous_world = (tuple(bg.inputs["Color"].default_value), bg.inputs["Strength"].default_value)
        previous_camera = (camera.location.copy(), camera.rotation_euler.copy(), camera.data.ortho_scale)
        previous_collection_visibility = {obj: obj.hide_render for obj in presentation.objects}
        previous_vehicle_states = []
        for obj, _spec, x_pos in car_objects:
            previous_vehicle_states.append((obj, obj.location.copy(), obj.rotation_euler.copy()))
            obj.location = (x_pos, 0, 0)
            obj.rotation_euler.z = -math.pi * 0.5
            obj.data.materials[0] = silhouette_mat
            obj.data.materials[1] = silhouette_mat
        for obj in presentation.objects:
            if obj != camera:
                obj.hide_render = True
        bg.inputs["Color"].default_value = srgb("#fafaf6")
        bg.inputs["Strength"].default_value = 1.0
        camera.location = (0, 15, 3.5)
        aim_at(camera, (0, 0, 0.78))
        camera.data.ortho_scale = 30.0
        scene.render.resolution_x = 3000
        scene.render.resolution_y = 620
        scene.render.resolution_percentage = 100
        scene.render.filepath = SILHOUETTE_PATH
        bpy.context.view_layer.update()
        bpy.ops.render.render(write_still=True)

        for obj, location, rotation in previous_vehicle_states:
            obj.location = location
            obj.rotation_euler = rotation
            obj.data.materials[0] = material
            obj.data.materials[1] = glass
        for obj, was_hidden in previous_collection_visibility.items():
            obj.hide_render = was_hidden
        bg.inputs["Color"].default_value = previous_world[0]
        bg.inputs["Strength"].default_value = previous_world[1]
        camera.location = previous_camera[0]
        camera.rotation_euler = previous_camera[1]
        camera.data.ortho_scale = previous_camera[2]
        scene.render.resolution_x = previous_render[0]
        scene.render.resolution_y = previous_render[1]
        scene.render.resolution_percentage = previous_render[2]
        scene.render.filepath = previous_render[3]

        bpy.data.libraries.write(BLEND_PATH, {scene}, compress=True)

        for obj, _spec, _x_pos in car_objects:
            previous_location = obj.location.copy()
            obj.location = (0, 0, 0)
            for item in scene.objects:
                item.select_set(item == obj)
            bpy.context.view_layer.objects.active = obj
            glb_path = os.path.join(OUTPUT_DIR, f"{obj['type_vehicule']}.glb")
            bpy.ops.export_scene.gltf(
                filepath=glb_path,
                export_format="GLB",
                use_selection=True,
                export_apply=True,
                export_extras=True,
                export_vertex_color="ACTIVE",
                export_normals=True,
                export_tangents=False,
                export_yup=True,
                export_materials="EXPORT",
                export_animations=False,
                export_skins=False,
                export_draco_mesh_compression_enable=False,
            )
            exported.append(glb_path)
            obj.location = previous_location

        counts = ", ".join(f"{obj['type_vehicule']}={obj['triangles_estimees']} triangles"
                            for obj, _spec, _x_pos in car_objects)
        result = (f"VOITURES_OK\nTRIANGLES={counts}\nBLEND={BLEND_PATH}\nPLANCHE={SHEET_PATH}\n"
                  f"SILHOUETTES={SILHOUETTE_PATH}\nCAMION_HAYON={TRUCK_DETAIL_PATH}\n"
                  f"MUSCLE_72={MUSCLE_DETAIL_PATH}\n"
                  + "\n".join(f"GLB={path}" for path in exported))
    finally:
        if window and original_scene:
            window.scene = original_scene
        if scene:
            for obj in list(scene.objects):
                data = obj.data
                data_collection = {
                    "MESH": bpy.data.meshes,
                    "FONT": bpy.data.curves,
                    "CAMERA": bpy.data.cameras,
                    "LIGHT": bpy.data.lights,
                }.get(obj.type)
                bpy.data.objects.remove(obj, do_unlink=True)
                if data and data_collection is not None and data.users == 0:
                    data_collection.remove(data)
            bpy.data.scenes.remove(scene, do_unlink=True)
        for coll in created_collections:
            if coll.name in bpy.data.collections and coll.users == 0:
                bpy.data.collections.remove(coll)
        for material in created_materials:
            if material.name in bpy.data.materials and material.users == 0:
                bpy.data.materials.remove(material)
        for world in created_worlds:
            if world.name in bpy.data.worlds and world.users == 0:
                bpy.data.worlds.remove(world)
        if original_scene and window:
            window.scene = original_scene
        if original_active and original_active.name in bpy.context.view_layer.objects:
            bpy.context.view_layer.objects.active = original_active
        for obj in original_selected:
            if obj.name in bpy.context.view_layer.objects:
                obj.select_set(True)
        print(result)


run()
