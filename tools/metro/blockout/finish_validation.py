"""Subdivision de finition du métro, sans changement des UV ni des colliders."""
from array import array
import hashlib
import json
from pathlib import Path
import sys

import bpy
import bmesh
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
sys.path.insert(0,str(ROOT/'tools/blender'))
import cassandre as C
from tools.blender.validate_level import LOGIC_MESH_PREFIXES,level_objects

VIEWS=((-15.24,98,-5,90),(80.75,260.92,-15.55,180),
       (-6.38,153,-13,90),(48.66,325.5,-18,270))


def collision_signature():
    digest=hashlib.sha256()
    for obj in sorted(bpy.data.collections['COL'].objects,key=lambda o:o.name):
        if obj.type!='MESH': continue
        digest.update(obj.name.encode())
        digest.update(str(tuple(tuple(row) for row in obj.matrix_world)).encode())
        values=array('f',[0])*(len(obj.data.vertices)*3)
        obj.data.vertices.foreach_get('co',values); digest.update(values.tobytes())
    return digest.hexdigest()


def candidates():
    result=[]
    for obj in level_objects():
        if obj.type!='MESH' or obj.name.startswith(LOGIC_MESH_PREFIXES): continue
        area=sum(p.area for p in obj.data.polygons)
        if area>4 and len(obj.data.vertices)<area: result.append((obj,area))
    return result


def densify(obj,area):
    if obj.data.users>1: obj.data=obj.data.copy()
    mesh=obj.data
    old_bounds=[tuple(v) for v in obj.bound_box]
    normals=[tuple(n.vector) for n in mesh.corner_normals]
    before=len(mesh.vertices)
    bm=bmesh.new(); bm.from_mesh(mesh)
    layer=bm.loops.layers.float_vector.new('_metro_normal')
    bm.faces.ensure_lookup_table()
    for face in bm.faces:
        for loop,index in zip(face.loops,mesh.polygons[face.index].loop_indices):
            loop[layer]=normals[index]
    threshold=1.5
    for _ in range(16):
        if len(bm.verts)>=area: break
        edges=[edge for edge in bm.edges if edge.calc_length()>threshold]
        if not edges:
            threshold*=.75
            edges=[edge for edge in bm.edges if edge.calc_length()>threshold]
        if not edges: raise ValueError('Aucune arête à subdiviser : '+obj.name)
        bmesh.ops.subdivide_edges(bm,edges=edges,cuts=1,use_grid_fill=True)
    if len(bm.verts)<area: raise ValueError('Subdivision insuffisante : '+obj.name)
    bm.to_mesh(mesh); bm.free()
    mesh.update()
    attr=mesh.attributes.get('_metro_normal')
    if attr is None: raise ValueError('Normales interpolées absentes : '+obj.name)
    mesh.normals_split_custom_set([tuple(d.vector) for d in attr.data])
    mesh.attributes.remove(attr)
    bpy.context.view_layer.update()
    if any((Vector(a)-Vector(b)).length>.0001 for a,b in zip(old_bounds,obj.bound_box)):
        raise ValueError('La subdivision a changé le contour : '+obj.name)
    if not mesh.uv_layers or not mesh.color_attributes:
        raise ValueError('UV ou couleurs perdus : '+obj.name)
    return {'objet':obj.name,'avant':before,'apres':len(mesh.vertices),'surface':round(area,2)}


def finish():
    before=collision_signature()
    positions={o.name:tuple(o.matrix_world.translation) for o in level_objects() if o.name.startswith('use_')}
    changed=[densify(obj,area) for obj,area in candidates()]
    if collision_signature()!=before: raise ValueError('Les colliders ont changé')
    if any(tuple(bpy.data.objects[name].matrix_world.translation)!=pose for name,pose in positions.items()):
        raise ValueError('Un point d’interaction a changé de place')
    return {'objets':len(changed),'sommets_ajoutes':sum(row['apres']-row['avant'] for row in changed),
            'collisions_identiques':True,'interactions_identiques':True,'details':changed}


def compare_previews():
    import numpy as np
    images=[]; arrays=[]
    try:
        for suffix in ('avant','apres'):
            path=ROOT/f'renders/_cassandre/metro_avertissements_{suffix}.png'
            if not path.exists(): return None
            img=bpy.data.images.load(str(path),check_existing=False); images.append(img)
            img.colorspace_settings.name='Non-Color'
            data=np.empty(len(img.pixels),dtype=np.float32)
            img.pixels.foreach_get(data)
            arrays.append(np.rint(data*255).astype(np.uint8).reshape(-1,4))
        if arrays[0].shape!=arrays[1].shape:
            return {'formats_differents':[tuple(img.size) for img in images]}
        return {'pixels_modifies':int(np.count_nonzero(np.any(arrays[0]!=arrays[1],axis=1))),
                'pixels':len(arrays[0]),'sha_avant':hashlib.sha256(arrays[0].tobytes()).hexdigest(),
                'sha_apres':hashlib.sha256(arrays[1].tobytes()).hexdigest()}
    finally:
        for img in images: bpy.data.images.remove(img)


def main():
    if '--inspect' in sys.argv:
        items=candidates()
        print('[metro-warnings] '+json.dumps({'objets':len(items),'surface':round(sum(a for _,a in items),2)}))
        print('[metro-warnings] '+json.dumps({'comparaison':compare_previews()}))
        return
    path=Path(bpy.data.filepath).resolve()
    if path!=ROOT/'assets_src/blender/metro_blockout.blend': raise ValueError('Ouvrir le métro livré')
    report=finish()
    checked=C.check(strict=True,audit=False,niveau='metro')
    if not checked.get('ok'): raise ValueError(checked)
    from tools.metro.blockout.secrets import ExistingAuthor,check_accesses
    from tools.metro.blockout.kiosks import check_placements
    author=ExistingAuthor(); check_accesses(author); check_placements(author)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    exported=C.export(out=ROOT/'public/assets/levels/metro_blockout.glb',niveau='metro')
    if not exported.get('ok'): raise ValueError(exported)
    out=ROOT/'renders/metro-warnings/details.json'; out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('[metro-warnings] '+json.dumps({k:v for k,v in report.items() if k!='details'}))
    print('[metro-warnings] '+json.dumps(checked))
    if '--sans-apercus' not in sys.argv:
        print('[metro-warnings] '+json.dumps(C.sheet(VIEWS,cols=2,taille=(640,360),mode='material',
                                                   nom='metro_avertissements_apres',voyage='depart')))
        print('[metro-warnings] '+json.dumps({'comparaison':compare_previews()}))


if __name__=='__main__':
    main()
