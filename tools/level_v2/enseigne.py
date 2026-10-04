"""Enseigne Hyper Varan, façade sud du magasin ; géométrie commune au build et à la retouche locale."""

import math

import bpy
import lib_helpers as H

PREFIX = "enseigne_hyper_varan_"
NEON_PREFIX = "fx_enseigne_hyper_varan_"
LIGHT = "light_enseigne_hyper_varan"

GLYPHS = {
    "H": ("10001", "10001", "10001", "11111", "10001", "10001", "10001"),
    "Y": ("10001", "10001", "01010", "00100", "00100", "00100", "00100"),
    "P": ("11110", "10001", "10001", "11110", "10000", "10000", "10000"),
    "E": ("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
    "R": ("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
    "V": ("10001", "10001", "10001", "10001", "10001", "01010", "00100"),
    "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
    "N": ("10001", "11001", "11001", "10101", "10011", "10011", "10001"),
}


def _material():
    mat = bpy.data.materials.get("mat_enseigne_neon")
    if mat:
        return mat
    mat = bpy.data.materials.new("mat_enseigne_neon")
    mat.use_nodes = True
    mat.diffuse_color = (0.8, 0.025, 0.01, 1)
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (0.12, 0.008, 0.004, 1)
    bsdf.inputs["Emission Color"].default_value = (1.0, 0.04, 0.012, 1)
    bsdf.inputs["Emission Strength"].default_value = 1.35
    bsdf.inputs["Roughness"].default_value = 0.8
    return mat


def _white_vertices(obj):
    colors = obj.data.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    colors.data.foreach_set("color", [1.0] * (len(colors.data) * 4))
    obj.data.color_attributes.active_color = colors


def _pixels(name, rows, x, z, cell, props):
    parts = []
    for row, pixels in enumerate(rows):
        column = 0
        while column < len(pixels):
            if pixels[column] != "1":
                column += 1
                continue
            first = column
            while column < len(pixels) and pixels[column] == "1":
                column += 1
            bottom = z + (len(rows) - row - 1) * cell
            parts.append(((x + first * cell, -4.76, bottom,
                           x + column * cell, -4.65, bottom + cell), "aplat:#d8231f"))
    obj = H.boxes(name, parts, "palette", props, subdiv=1e9)
    obj.data.materials.clear()
    obj.data.materials.append(_material())
    _white_vertices(obj)
    return obj


def _logo():
    rows = []
    for row in range(19):
        pixels = []
        for col in range(19):
            radius = math.hypot(col - 9, row - 9)
            ring = 7.6 <= radius <= 9.3
            head = 9 <= col <= 15 and 4 <= row <= 6
            neck = 8 <= col <= 11 and 6 <= row <= 10
            body = 6 <= col <= 9 and 9 <= row <= 13
            tail = 4 <= col <= 7 and 12 <= row <= 15
            feet = (row in (8, 9) and col in (6, 7, 12, 13)) or (row in (12, 13) and col in (4, 5, 10, 11))
            eye = row == 5 and col == 13
            pixels.append("1" if (ring or head or neck or body or tail or feet) and not eye else "0")
        rows.append("".join(pixels))
    return rows


def poser(props, logic):
    for obj in list(bpy.data.objects):
        if obj.name.startswith((PREFIX, NEON_PREFIX)) or obj.name == LIGHT:
            mesh = obj.data if obj.type == "MESH" else None
            bpy.data.objects.remove(obj, do_unlink=True)
            if mesh and mesh.users == 0:
                bpy.data.meshes.remove(mesh)

    body = H.boxes(PREFIX + "caisson", [
        ((-5.9, -4.59, 4.3, 5.3, -4.31, 5.8), "aplat:#2f3541"),
        ((-5.83, -4.63, 4.37, 5.23, -4.59, 5.73), "aplat:#111014"),
        ((-5.9, -4.65, 5.73, 5.3, -4.59, 5.8), "aplat:#d8231f"),
        ((-5.9, -4.65, 4.3, 5.3, -4.59, 4.37), "aplat:#d8231f"),
    ], "palette", props, subdiv=0.75)
    _white_vertices(body)
    supports = H.boxes(PREFIX + "fixations", [
        ((x, -4.36, 4.5, x + 0.12, -3.95, 5.6), "aplat:#2f3541")
        for x in (-5.7, -3.7, 3.4, 5.0)
    ], "palette", props, subdiv=0.75)
    _white_vertices(supports)

    _pixels(NEON_PREFIX + "logo", _logo(), -5.60, 4.4, 0.068, props)
    x, index = -3.70, 0
    for character in "HYPER VARAN":
        if character == " ":
            x += 0.38
            continue
        _pixels(f"{NEON_PREFIX}{index:02d}_{character}", GLYPHS[character], x, 4.56, 0.14, props)
        x += 0.84
        index += 1

    lamp = bpy.data.objects.new(LIGHT, None)
    lamp.location = (0, -5.1, 5.0)
    for key, value in {"color": "#ff3820", "intensity": 14.0, "distance": 12.0, "decay": 2.0}.items():
        lamp[key] = value
    logic.objects.link(lamp)
    return {"lettres": index, "largeur": 11.2, "bas": 4.3, "haut": 5.8}
