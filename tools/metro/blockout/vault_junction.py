"""Coque commune du tunnel B et de sa branche nord."""
import bmesh
import bpy
from mathutils import Vector

from tools.metro.blockout.vault_profile import profile


def volume(piece, edges):
    shape=profile(2.75,4.5)
    stride=len(shape)+2
    vertices=[]
    coordinates=[]
    travelled=0
    previous=None
    for left,right in edges:
        left,right=Vector(left),Vector(right)
        center=(left+right)/2
        if previous is not None: travelled+=(center-previous).length
        previous=center
        section=[left.lerp(right,t)+Vector((0,0,z)) for t,z in shape]
        arc=0
        for i,point in enumerate(section):
            if i: arc+=(point-section[i-1]).length
            vertices.append(tuple(point))
            coordinates.append((arc/2,travelled/2))
        vertices.extend((tuple(right),tuple(left)))
        coordinates.extend(((arc/2,travelled/2),(0,travelled/2)))
    faces=[]
    for row in range(len(edges)-1):
        for i in range(stride):
            j=(i+1)%stride
            faces.append((row*stride+i,row*stride+j,(row+1)*stride+j,(row+1)*stride+i))
    faces.extend((tuple(range(stride-1,-1,-1)),tuple(range((len(edges)-1)*stride,len(edges)*stride))))
    obj=piece.mesh(vertices,faces,'beton')
    uv=obj.data.uv_layers.active
    for index,loop in enumerate(obj.data.loops): uv.data[index].uv=coordinates[loop.vertex_index]
    return obj


def build(piece, main_edges, branch_edges):
    roof=volume(piece,main_edges)
    branch=volume(piece,branch_edges)
    scene=bpy.context.scene
    scene.collection.objects.link(roof)
    scene.collection.objects.link(branch)
    try:
        bpy.ops.object.select_all(action='DESELECT')
        roof.select_set(True)
        bpy.context.view_layer.objects.active=roof
        union=roof.modifiers.new('Jonction commune','BOOLEAN')
        union.operation='UNION'
        union.solver='EXACT'
        union.object=branch
        bpy.ops.object.modifier_apply(modifier=union.name)
        bm=bmesh.new()
        try:
            bm.from_mesh(roof.data)
            bm.normal_update()
            bmesh.ops.delete(bm,geom=[face for face in bm.faces if face.normal.z<=1e-5],context='FACES')
            bmesh.ops.delete(bm,geom=[vertex for vertex in bm.verts if not vertex.link_faces],context='VERTS')
            if not bm.faces:
                raise ValueError('Jonction B sans toiture après union')
            for face in bm.faces: face.smooth=True
            bm.to_mesh(roof.data)
        finally:
            bm.free()
        skin=roof.modifiers.new('Épaisseur de la voûte','SOLIDIFY')
        skin.thickness=.12
        skin.offset=1
        bpy.ops.object.modifier_apply(modifier=skin.name)
        roof.data.update()
    finally:
        scene.collection.objects.unlink(roof)
        data=branch.data
        bpy.data.objects.remove(branch,do_unlink=True)
        if not data.users: bpy.data.meshes.remove(data)
    return roof
