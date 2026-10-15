"""Pièces N3 : géométrie locale, UV métriques et proxies séparés."""
import math
from pathlib import Path
import sys

import bpy
import bmesh
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "blender"))
import geo_utils


CATALOG_ID = "8d1c806b-e247-4473-bb19-c270b4469f20"


class Piece:
    def __init__(self, name, materials, spec):
        self.name, self.materials = name, materials
        self.collection = bpy.data.collections.new("kit_metro_" + name)
        self.collection.asset_mark()
        self.collection.asset_data.catalog_id = CATALOG_ID
        self.collection.asset_data.description = spec
        self.collection["spec"] = spec
        self.collection["origine"] = "coin au sol ; axe +Y longitudinal"
        self.collection["etape"] = "N3_candidat"
        self.count = 0

    def link(self, obj, collision=False):
        self.collection.objects.link(obj)
        obj["kit"] = self.name
        if collision:
            obj.hide_render = True
            obj.display_type = "WIRE"
        return obj

    def box(self, origin, size, material="acier", collision=False, seg=1):
        self.count += 1
        name = f"kit_{self.name}_{self.count:03d}"
        obj = geo_utils.build_multi_box_mesh(name, [{"o": origin, "s": size, "mat": None}], material, self.materials, seg=seg)
        self.link(obj)
        if collision:
            self.link(geo_utils.build_proxy_object("col_box_" + name, "box", origin, size), True)
        return obj

    def mesh(self, vertices, faces, material="acier", collision=False):
        self.count += 1
        name = f"kit_{self.name}_{self.count:03d}"
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(self.materials[material])
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        uv = mesh.uv_layers.new(name="UVMap")
        for poly in mesh.polygons:
            axes = sorted(range(3), key=lambda i: abs(poly.normal[i]))[:2]
            for index in poly.loop_indices:
                v = mesh.vertices[mesh.loops[index].vertex_index].co
                uv.data[index].uv = (v[axes[0]] / 2, v[axes[1]] / 2)
        colors = mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
        colors.data.foreach_set("color", [1.] * len(colors.data) * 4)
        obj = self.link(bpy.data.objects.new(name, mesh))
        if collision:
            proxy = bpy.data.objects.new("col_hull_" + name, mesh.copy())
            proxy.data.materials.clear()
            self.link(proxy, True)
        return obj

    def beam(self, a, b, width=.1, material="acier", collision=False):
        a, b = Vector(a), Vector(b)
        obj = self.box((-width / 2, -width / 2, 0), (width, width, (b - a).length), material, collision)
        rotation = (b - a).to_track_quat("Z", "Y").to_matrix()
        related = [obj, self.collection.objects.get("col_box_" + obj.name)]
        for item in related:
            if item is not None:
                for vertex in item.data.vertices:
                    vertex.co = rotation @ vertex.co + a
        return obj

    def text(self, body, origin, size=.3, material="ivoire"):
        self.count += 1
        font = bpy.data.curves.new("lettres", "FONT")
        font.body, font.size, font.align_x = body, size, "CENTER"
        font.extrude, font.resolution_u = 0, 2
        obj = self.link(bpy.data.objects.new(f"kit_{self.name}_{self.count:03d}", font))
        obj.location, obj.rotation_euler = origin, (math.pi / 2, 0, 0)
        font.materials.append(self.materials[material])
        bpy.context.scene.collection.objects.link(obj)
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target="MESH")
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)
        colors = obj.data.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
        colors.data.foreach_set("color", [1.] * len(colors.data) * 4)
        bpy.context.scene.collection.objects.unlink(obj)
        return obj


FACES = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]


def slab(piece, a, b, length, material="beton", thickness=.25, mapper=None):
    dx, dz = b[0] - a[0], b[1] - a[1]
    normal = Vector((-dz, dx)).normalized() * thickness
    cross = [a, b, (b[0] + normal.x, b[1] + normal.y), (a[0] + normal.x, a[1] + normal.y)]
    for y in range(math.ceil(length)):
        y0, y1 = y, min(y + 1, length)
        vertices = [(x, yy, z) for yy in (y0, y1) for x, z in cross]
        if mapper:
            vertices = [mapper(*v) for v in vertices]
        piece.mesh(vertices, FACES, material, True)
