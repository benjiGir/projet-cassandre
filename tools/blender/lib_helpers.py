"""Outils communs aux sessions Blender MCP du niveau v2 : matériaux texturés, boîtes à UV 64 px/m, tranches de trim sheet, faces d'étiquettes, proxies de collision.

Dans une session MCP : __file__ = "<chemin absolu de ce fichier>"; exec(open(__file__).read())
"""

import json
import os

import bmesh
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TEX_DIR = os.path.join(ROOT, "assets_src", "textures")
TRIM = json.load(open(os.path.join(TEX_DIR, "trim_hypermarche.json")))["bands"]
LABELS = json.load(open(os.path.join(TEX_DIR, "prd_etiquettes.json")))["labels"]


def textured_material(texture: str) -> bpy.types.Material:
    name = f"mat_{texture}"
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    # Nœuds cherchés par type : une interface Blender en français traduit aussi leurs noms.
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 1.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(TEX_DIR, texture + ".png"), check_existing=True)
    tex.interpolation = "Closest"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.nodes.active = tex
    return mat


def collection(name: str, parent: bpy.types.Collection | None = None) -> bpy.types.Collection:
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(coll)
    return coll


def _box_bmesh(x0, y0, z0, x1, y1, z1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y = y0 if v.co.y < 0 else y1
        v.co.z = z0 if v.co.z < 0 else z1
    bm.normal_update()
    return bm


def _uv_world(face, uv):
    n = face.normal
    axis = max(range(3), key=lambda i: abs(n[i]))
    for loop in face.loops:
        c = loop.vert.co
        u, v = [(c.y, c.z), (c.x, c.z), (c.x, c.y)][axis]
        loop[uv].uv = (u / 2.0, v / 2.0)


def _uv_trim(band: str, bounds):
    y, h = TRIM[band]["y"], TRIM[band]["height"]
    v_top, v_bot = 1 - y / 128, 1 - (y + h) / 128
    x0, y0, z0, x1, y1, z1 = bounds

    def fn(face, uv):
        n = face.normal
        along_x = abs(n.y) >= abs(n.x)
        for loop in face.loops:
            c = loop.vert.co
            u = (c.x if along_x else c.y) / 2.0
            t = (c.z - z0) / max(z1 - z0, 1e-6)
            loop[uv].uv = (u, v_bot + t * (v_top - v_bot))
    return fn


def _uv_label(label: str, bounds, front_axis: str = "-y"):
    cx, cy = LABELS[label]["cell"]
    u0, u1 = cx / 4, (cx + 1) / 4
    v_top, v_bot = 1 - cy / 4, 1 - (cy + 1) / 4
    x0, y0, z0, x1, y1, z1 = bounds

    def fn(face, uv):
        n = face.normal
        is_front = {"-y": n.y < -0.5, "+y": n.y > 0.5, "-x": n.x < -0.5, "+x": n.x > 0.5}[front_axis]
        for loop in face.loops:
            c = loop.vert.co
            if is_front:
                s = (c.x - x0) / (x1 - x0) if front_axis in ("-y", "+y") else (c.y - y0) / (y1 - y0)
                if front_axis in ("+y", "-x"):
                    s = 1 - s
                t = (c.z - z0) / (z1 - z0)
                loop[uv].uv = (u0 + s * (u1 - u0), v_bot + t * (v_top - v_bot))
            else:
                # Les autres faces prennent la couleur de fond, lue près du coin haut-gauche de la case.
                loop[uv].uv = (u0 + 0.01, v_top - 0.01)
    return fn


def box(name: str, bounds, texture: str, coll: bpy.types.Collection, uv: str = "world", **kw) -> bpy.types.Object:
    """bounds = (x0, y0, z0, x1, y1, z1) en mètres, monde. uv : "world", "trim:<bande>" ou "label:<étiquette>"."""
    bm = _box_bmesh(*bounds)
    layer = bm.loops.layers.uv.new("UVMap")
    if uv == "world":
        mapper = _uv_world
    elif uv.startswith("trim:"):
        mapper = _uv_trim(uv[5:], bounds)
    elif uv.startswith("label:"):
        mapper = _uv_label(uv[6:], bounds, kw.get("front", "-y"))
    else:
        raise ValueError(uv)
    for face in bm.faces:
        mapper(face, layer)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.data.materials.append(textured_material(texture))
    coll.objects.link(obj)
    return obj


def col_box(name: str, bounds, coll: bpy.types.Collection) -> bpy.types.Object:
    """Proxy de collision cuboid invisible `col_box_<name>` (voir `collision-proxy-authoring`)."""
    bm = _box_bmesh(*bounds)
    me = bpy.data.meshes.new(f"col_box_{name}")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(f"col_box_{name}", me)
    obj.display_type = "WIRE"
    obj.hide_render = True
    coll.objects.link(obj)
    return obj


def area_light(name: str, location, size: float, energy: float, coll: bpy.types.Collection) -> bpy.types.Object:
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    coll.objects.link(obj)
    return obj
