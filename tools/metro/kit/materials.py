"""Surfaces originales N3, sans image issue du board.

see: docs/assets/kit-metro.md#surfaces
"""
from pathlib import Path

import bpy
import numpy as np


PALETTE = {
    "ivoire": "d8d0b8", "petrole": "537d74", "beton": "586566",
    "acier": "434d55", "sol": "354247", "ambre": "deb44b",
    "rouge": "bc543c", "clair": "d8dce0", "verre": "243942", "peinture": "d8d0b8",
}


def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4


def color(hexcode):
    return tuple(linear(int(hexcode[i:i + 2], 16) / 255) for i in (0, 2, 4))


def build(out: Path):
    out.mkdir(parents=True, exist_ok=True)
    materials = {}
    yy, xx = np.mgrid[:128, :128]
    for name, hexcode in PALETTE.items():
        mat = bpy.data.materials.new("metro_" + name)
        mat.use_nodes = True
        rgb = color(hexcode)
        mat.diffuse_color = (*rgb, 1)
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*rgb, 1)
        bsdf.inputs["Roughness"].default_value = .85
        if name in ("ivoire", "beton", "acier", "sol"):
            encoded_rgb = tuple(int(hexcode[k:k + 2], 16) / 255 for k in (0, 2, 4))
            grain = ((xx * 37 + yy * 17 + xx * yy * 3) % 19 - 9) / 400
            if name == "ivoire":
                joints = (yy % 16 <= 1) | ((xx + (yy // 16 % 2) * 16) % 32 <= 1)
                grain = np.where(joints, -.16, grain)
            elif name == "acier":
                grain += np.where(xx % 32 == 0, -.07, 0)
            elif name == "sol":
                grain += np.where((xx % 64 == 0) | (yy % 64 == 0), -.065, 0)
            pixels = np.ones((128, 128, 4), dtype=np.float32)
            for k in range(3):
                pixels[:, :, k] = np.clip(encoded_rgb[k] + grain * .28, 0, 1)
            image = bpy.data.images.new("metro_" + name, 128, 128)
            image.pixels.foreach_set(pixels.ravel())
            image.filepath_raw = str(out / f"{name}.png")
            image.file_format = "PNG"
            image.save()
            image.pack()
            node = mat.node_tree.nodes.new("ShaderNodeTexImage")
            node.image, node.interpolation, node.extension = image, "Closest", "REPEAT"
            mat.node_tree.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
        if name == "verre":
            bsdf.inputs["Roughness"].default_value = .2
            bsdf.inputs["Alpha"].default_value = .38
            mat.diffuse_color = (*rgb, .38)
            mat.surface_render_method = "DITHERED"
        materials[name] = mat
    for name in ("lampe", "signal"):
        mat = bpy.data.materials.new("metro_" + name)
        mat.use_nodes = True
        rgb = color("efdfb6" if name == "lampe" else "dfb657")
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*rgb, 1)
        bsdf.inputs["Emission Color"].default_value = (*rgb, 1)
        bsdf.inputs["Emission Strength"].default_value = 2
        mat.diffuse_color = (*rgb, 1)
        materials[name] = mat
    return materials
