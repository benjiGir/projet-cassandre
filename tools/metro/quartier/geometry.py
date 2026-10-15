"""Géométrie N3b et primitives communes avec le kit métro."""
import math

import bpy

from tools.metro.kit.geometry import Piece as MetroPiece


CATALOG_ID = "ecb8be4d-7a39-4810-9ec0-43cc8de7d133"


class Piece(MetroPiece):
    def __init__(self, name, materials, spec):
        super().__init__(name, materials, spec)
        self.collection.name = "kit_quartier_" + name
        self.collection.asset_data.catalog_id = CATALOG_ID
        self.collection["etape"] = "N3b_candidat"
        self.collection["origine"] = "coin au sol ; façade vers -Y ; parcours vers +Y"

    def cylinder(self, center, radius, depth, material="acier", axis="Z", sides=12):
        vertices = []
        for offset in (-depth / 2, depth / 2):
            for i in range(sides):
                angle = 2 * math.pi * i / sides
                a, b = radius * math.cos(angle), radius * math.sin(angle)
                delta = {"Z": (a, b, offset), "Y": (a, offset, b), "X": (offset, a, b)}[axis]
                vertices.append(tuple(center[k] + delta[k] for k in range(3)))
        faces = [(i, (i + 1) % sides, (i + 1) % sides + sides, i + sides) for i in range(sides)]
        for start, reverse in ((0, True), (sides, False)):
            for i in range(1, sides - 1):
                face = (start, start + i, start + i + 1)
                faces.append(tuple(reversed(face)) if reverse else face)
        return self.mesh(vertices, faces, material)

    def proxy(self, origin, size):
        from tools.blender import geo_utils
        self.count += 1
        return self.link(geo_utils.build_proxy_object(
            f"col_box_kit_{self.name}_{self.count:03d}", "box", origin, size), True)


def consolidate(piece):
    """Un mesh par matériau ; les proxies et leurs noms restent séparés."""
    from mathutils import Matrix
    import bmesh

    groups = {}
    for obj in piece.collection.objects:
        if obj.type == "MESH" and not obj.name.startswith("col_"):
            groups.setdefault(obj.data.materials[0], []).append(obj)
    for material, objects in groups.items():
        if len(objects) < 2:
            continue
        bm = bmesh.new()
        for obj in objects:
            mesh = obj.data.copy()
            mesh.transform(obj.matrix_world)
            bm.from_mesh(mesh)
            bpy.data.meshes.remove(mesh)
        mesh = bpy.data.meshes.new(f"kit_{piece.name}_{material.name}")
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(material)
        mesh.update()
        for poly in mesh.polygons:
            poly.material_index = 0
        obj = piece.link(bpy.data.objects.new(mesh.name, mesh))
        obj.matrix_world = Matrix.Identity(4)
        for old in objects:
            old_mesh = old.data
            bpy.data.objects.remove(old, do_unlink=True)
            if old_mesh.users == 0:
                bpy.data.meshes.remove(old_mesh)
