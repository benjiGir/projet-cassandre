"""Réemploie les citadine et berline déjà validées, sans modifier leurs sources."""
import bpy
import bmesh
from mathutils import Matrix, Vector

from tools.metro.quartier.geometry import Piece


def build(root, mats):
    source = root / "assets_src/blender/propositions_voitures.blend"
    names = ["proposition_citadine", "proposition_berline"]
    with bpy.data.libraries.load(str(source), link=False) as (available, loaded):
        missing = set(names) - set(available.objects)
        if missing:
            raise ValueError(f"Modèles validés absents de {source}: {sorted(missing)}")
        loaded.objects = names
    result = {}
    for original in loaded.objects:
        name = original.name.removeprefix("proposition_")
        p = Piece("vehicule_" + name, mats, "véhicule déjà validé ; origine normalisée au coin du sol ; avant +Y")
        points = [original.matrix_world @ v.co for v in original.data.vertices]
        low = Vector(tuple(min(v[k] for v in points) for k in range(3)))
        high = Vector(tuple(max(v[k] for v in points) for k in range(3)))
        for index, material in enumerate(original.data.materials):
            bm = bmesh.new()
            bm.from_mesh(original.data)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != index], context="FACES")
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
            mesh = bpy.data.meshes.new(f"kit_{p.name}_{index}")
            bm.to_mesh(mesh)
            bm.free()
            mesh.transform(Matrix.Translation(-low) @ original.matrix_world)
            mesh.materials.append(material)
            for polygon in mesh.polygons:
                polygon.material_index = 0
            p.link(bpy.data.objects.new(mesh.name, mesh))
        p.proxy((0, 0, 0), tuple(high - low))
        p.collection["source"] = "assets_src/blender/propositions_voitures.blend"
        p.collection["reemploi"] = True
        result[p.name] = p
        bpy.data.objects.remove(original, do_unlink=True)
    return result
