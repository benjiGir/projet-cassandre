"""Pièces en relief réunies en un mesh et un matériau d'atlas."""
import bmesh
import bpy
from mathutils import Vector

import lib_helpers as H


def mesh(name, pieces, texture, coll):
    merged = bmesh.new()
    for bounds, rect, front in pieces:
        part = H._box_bmesh(*bounds)
        layer = part.loops.layers.uv.new("UVMap")
        mapper = H._uv_case(*rect, bounds, front)
        for face in part.faces:
            mapper(face, layer)
        temporary = bpy.data.meshes.new("_atlas_piece")
        part.to_mesh(temporary)
        part.free()
        merged.from_mesh(temporary)
        bpy.data.meshes.remove(temporary)
    data = bpy.data.meshes.new(name)
    merged.to_mesh(data)
    merged.free()
    obj = bpy.data.objects.new(name, data)
    data.materials.append(H.textured_material(texture))
    coll.objects.link(obj)
    return obj


def center(obj, origin=None):
    origin = Vector(origin) if origin is not None else sum((Vector(c) for c in obj.bound_box), Vector()) / 8
    for vertex in obj.data.vertices:
        vertex.co -= origin
    obj.location = origin
