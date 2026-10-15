"""Palette de rue N1 et textures originales déterministes de 128 px."""
import struct
import zlib

import bpy
import numpy as np

from tools.metro.kit.materials import color


PALETTE = {
    "enduit": "cbc3ae", "brique": "8f6953", "ardoise": "596064",
    "sol": "303c45", "pave": "797d79", "acier": "39494c",
    "ivoire": "ded8c5", "petrole": "537d74", "verre": "486473",
    "bois": "9d744a", "ambre": "cf934b", "rouge": "b4664b",
    "nuit": "17232e", "vitre_chaude": "cfa76b", "lampe": "efdbad",
}


def png(path, pixels):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    raw = b"".join(b"\x00" + row.tobytes() for row in pixels)
    header = struct.pack(">IIBBBBB", pixels.shape[1], pixels.shape[0], 8, 2, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
                     + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def build(out):
    out.mkdir(parents=True, exist_ok=True)
    result = {}
    yy, xx = np.mgrid[:128, :128]
    grain = ((xx * 37 + yy * 17 + xx * yy * 3) % 11 - 5)
    for name, hexcode in PALETTE.items():
        mat = bpy.data.materials.new("quartier_" + name)
        mat.use_nodes = True
        rgb = color(hexcode)
        mat.diffuse_color = (*rgb, 1)
        shader = mat.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = (*rgb, 1)
        shader.inputs["Roughness"].default_value = .88
        if name in ("enduit", "brique", "ardoise", "sol", "pave"):
            variation = grain.copy()
            if name == "brique":
                joints = (yy % 16 < 2) | ((xx + (yy // 16 % 2) * 16) % 32 < 2)
                variation = np.where(joints, -22, variation)
            elif name == "pave":
                joints = (yy % 32 < 2) | ((xx + (yy // 32 % 2) * 16) % 32 < 2)
                variation = np.where(joints, -18, variation)
            elif name == "sol":
                variation += np.where(((xx * 7 + yy * 13) % 67) == 0, 7, 0)
            encoded = np.array([int(hexcode[k:k + 2], 16) for k in (0, 2, 4)])
            pixels = np.clip(encoded + variation[:, :, None], 0, 255).astype(np.uint8)
            path = out / f"{name}.png"
            png(path, pixels)
            image = bpy.data.images.load(str(path), check_existing=False)
            image.colorspace_settings.name = "sRGB"
            image.pack()
            node = mat.node_tree.nodes.new("ShaderNodeTexImage")
            node.image, node.interpolation, node.extension = image, "Closest", "REPEAT"
            mat.node_tree.links.new(node.outputs["Color"], shader.inputs["Base Color"])
        if name == "verre":
            shader.inputs["Alpha"].default_value = .22
            shader.inputs["Roughness"].default_value = .28
            mat.diffuse_color = (*rgb, .22)
            mat.surface_render_method = "DITHERED"
        if name in ("lampe", "vitre_chaude"):
            shader.inputs["Emission Color"].default_value = (*rgb, 1)
            shader.inputs["Emission Strength"].default_value = 1.4 if name == "lampe" else .12
        result[name] = mat
    return result
