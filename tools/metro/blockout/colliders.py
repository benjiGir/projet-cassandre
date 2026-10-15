"""Inspection et réparation locale des proxies statiques du métro."""
import json
import hashlib
from array import array
from pathlib import Path
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector
from mathutils.geometry import tessellate_polygon

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'tools/blender'))
import cassandre as C
from tools.blender.validate_level import MIN_PROXY_THICKNESS, PROXY_THICKNESS_TOLERANCE

EPSILON = .0001
MIN_DIMENSION = MIN_PROXY_THICKNESS-PROXY_THICKNESS_TOLERANCE
PADDED_DIMENSION = MIN_PROXY_THICKNESS+.001


def points(obj):
    return [obj.matrix_world @ v.co for v in obj.data.vertices]


def area(poly):
    return sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(poly,poly[1:]+poly[:1]))/2


def simplify(poly):
    result = []
    for point in poly:
        if not result or (Vector(point)-Vector(result[-1])).length > EPSILON: result.append(point)
    if len(result)>1 and (Vector(result[0])-Vector(result[-1])).length<EPSILON: result.pop()
    changed = True
    while changed and len(result)>3:
        changed = False
        for i in range(len(result)):
            a,b,c = result[i-1],result[i],result[(i+1)%len(result)]
            cross = (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])
            if abs(cross) < 1e-6:
                result.pop(i); changed=True; break
    return result


def convex(poly):
    return all((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]) >= -1e-6
               for a,b,c in zip(poly,poly[1:]+poly[:1],poly[2:]+poly[:2]))


def merge_polygons(a,b):
    edges = [(p,q) for poly in (a,b) for p,q in zip(poly,poly[1:]+poly[:1])]
    shared = [(p,q) for p,q in edges if (q,p) in edges]
    if not shared: return None
    boundary = {p:q for p,q in edges if (p,q) not in shared}
    start = next(iter(boundary)); result=[start]; point=boundary[start]
    while point!=start:
        if point not in boundary or len(result)>len(boundary): return None
        result.append(point); point=boundary[point]
    return result if convex(result) else None


def span(poly):
    return min(max(p[i] for p in poly)-min(p[i] for p in poly) for i in (0,1))


def improve_triangles(polygons):
    def quality(pair):
        return (sum(span(p)<MIN_DIMENSION for p in pair),sum(1/max(span(p),1e-8) for p in pair))
    for _ in range(len(polygons)*3):
        changed=False
        for i,a in enumerate(polygons):
            if span(a)>=MIN_DIMENSION: continue
            for j,b in enumerate(polygons):
                if i==j: continue
                shared=set(a)&set(b)
                if len(shared)!=2: continue
                merged=merge_polygons(a,b)
                if merged is None or len(merged)!=4: continue
                p,q,r,s=merged
                pair=[[p,q,s],[q,r,s]] if shared=={p,r} else [[p,q,r],[p,r,s]]
                if quality(pair)>=quality([a,b]): continue
                polygons[i],polygons[j]=pair; changed=True; break
            if changed: break
        if not changed: break
    return polygons


def partition_once(poly):
    vectors = [Vector((x,z,0)) for x,z in poly]
    polygons = [[(float(vectors[i].x),float(vectors[i].y)) for i in triangle]
                for triangle in tessellate_polygon([vectors])]
    polygons = [p if area(p)>0 else list(reversed(p)) for p in polygons if abs(area(p))>1e-8]
    polygons = improve_triangles(polygons)
    changed = True
    while changed:
        changed=False
        for i in range(len(polygons)):
            for j in range(i+1,len(polygons)):
                merged=merge_polygons(polygons[i],polygons[j])
                if merged is None: continue
                polygons[i]=merged; polygons.pop(j); changed=True; break
            if changed: break
    return [simplify(p) for p in polygons]


def partition(poly):
    def score(polygons):
        thin=sum(min(max(p[i] for p in polygon)-min(p[i] for p in polygon) for i in (0,1))<MIN_DIMENSION
                 for polygon in polygons)
        return (thin,len(polygons))
    candidates=[partition_once(poly[i:]+poly[:i]) for i in range(0,len(poly),max(1,len(poly)//12))]
    return min(candidates,key=score)


def hull2d(points):
    points=sorted(set(points))
    def cross(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    def half(sequence):
        out=[]
        for p in sequence:
            while len(out)>1 and cross(out[-2],out[-1],p)<=0: out.pop()
            out.append(p)
        return out
    return half(points)[:-1]+half(list(reversed(points)))[:-1]


def clipped(poly,clip):
    result=poly
    for a,b in zip(clip,clip[1:]+clip[:1]):
        def side(p): return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
        output=[]
        for p,q in zip(result,result[1:]+result[:1]):
            sp,sq=side(p),side(q)
            if sp>=0: output.append(p)
            if (sp>=0)!=(sq>=0):
                t=sp/(sp-sq); output.append((p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t))
        result=output
        if not result: break
    return result


def stabilize(poly,panels):
    if span(poly)>=MIN_DIMENSION: return poly
    xs=[p[0] for p in poly]; zs=[p[1] for p in poly]
    candidates=[]
    for x in ((min(xs)+max(xs))/2-.125,(min(xs)+max(xs))/2+.125):
        for z in (max(zs)+.125,max(zs)+.25,max(zs)+.5,max(zs)+1,max(zs)+2):
            candidate=hull2d(poly+[(x,z)])
            surface=area(candidate)
            covered=sum(abs(area(clipped(candidate,panel))) for panel in panels)
            if surface-covered<.000001 and span(candidate)>=MIN_DIMENSION:
                candidates.append(candidate)
    if not candidates: raise ValueError('Volume mince sans renfort intérieur possible : '+str(poly))
    return min(candidates,key=area)


def profile_panels(collection,kit,y):
    objects = []
    for obj in collection.objects:
        if obj.type!='MESH' or obj.get('kit')!=kit or not obj.name.startswith('col_hull_') or obj.get('metro_front_proxy'): continue
        pts=points(obj)
        if max(abs(p.y-y) for p in pts)>.151: continue
        objects.append(obj)
    if not objects: return None
    segments=[]
    for obj in objects:
        pts=points(obj); x0=min(p.x for p in pts); x1=max(p.x for p in pts)
        left=[p.z for p in pts if abs(p.x-x0)<EPSILON]
        right=[p.z for p in pts if abs(p.x-x1)<EPSILON]
        segments.append((x0,x1,min(left),min(right),max(left),max(right)))
    segments.sort()
    bottom,top=[],[]
    for x0,x1,b0,b1,t0,t1 in segments:
        if bottom and abs(bottom[-1][0]-x0)>EPSILON: raise ValueError('Rupture du front maçonné : '+kit)
        bottom.extend(((x0,b0),(x1,b1))); top.extend(((x0,t0),(x1,t1)))
    outline=simplify(bottom+list(reversed(top)))
    polygons=partition(outline)
    old_area=abs(area(outline)); new_area=sum(abs(area(poly)) for poly in polygons)
    if abs(old_area-new_area)>.001: raise ValueError('Partition qui change le contour : '+kit)
    panels=[[(x0,b0),(x1,b1),(x1,t1),(x0,t0)] for x0,x1,b0,b1,t0,t1 in segments]
    polygons=[stabilize(poly,panels) for poly in polygons]
    y0=min(p.y for obj in objects for p in points(obj)); y1=max(p.y for obj in objects for p in points(obj))
    for index,poly in enumerate(polygons):
        n=len(poly)
        vertices=[(x,yy,z) for yy in (y0,y1) for x,z in poly]
        faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
        faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
        name=f'col_hull_metro_front_{kit}_{index:02d}'
        mesh=bpy.data.meshes.new(name); mesh.from_pydata(vertices,[],faces)
        bm=bmesh.new(); bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(mesh); bm.free()
        obj=bpy.data.objects.new(name,mesh); collection.objects.link(obj)
        obj['kit']=kit; obj['metro_front_proxy']=True
        obj.hide_render=True; obj.display_type='WIRE'
    for obj in objects: bpy.data.objects.remove(obj,do_unlink=True)
    return {'front':kit,'avant':len(objects),'apres':len(polygons),'surface':round(new_area,4)}


def volume(obj):
    bm=bmesh.new(); bm.from_mesh(obj.data)
    center=sum(points(obj),Vector())/len(obj.data.vertices)
    for v in bm.verts: v.co=obj.matrix_world @ v.co-center
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    value=abs(bm.calc_volume()); bm.free()
    return value


def merged_hull(a,b):
    vertices=points(a)+points(b)
    center=sum(vertices,Vector())/len(vertices)
    bm=bmesh.new()
    for point in vertices: bm.verts.new(point-center)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.convex_hull(bm,input=list(bm.verts),use_existing_faces=False)
    value=abs(bm.calc_volume())
    expected=volume(a)+volume(b)
    if abs(value-expected)>max(.000001,expected*.00001): bm.free(); return None
    for v in bm.verts: v.co+=center
    mesh=bpy.data.meshes.new(a.name+'_continu'); bm.to_mesh(mesh); bm.free()
    return mesh


def merge_fragments(collection):
    merged=[]
    while True:
        objects=[o for o in collection.objects if o.type=='MESH' and o.name.startswith('col_hull_')]
        index={}
        for obj in objects:
            for p in points(obj): index.setdefault(tuple(round(v,4) for v in p),set()).add(obj)
        changed=False
        for small in sorted(objects,key=lambda o:o.name):
            if min(small.dimensions)>=MIN_DIMENSION: continue
            neighbors={}
            for p in points(small):
                for obj in index[tuple(round(v,4) for v in p)]:
                    if obj!=small: neighbors[obj]=neighbors.get(obj,0)+1
            for other in sorted(neighbors,key=lambda o:o.name):
                if neighbors[other]<4: continue
                mesh=merged_hull(small,other)
                if mesh is None: continue
                merged.append((small.name,other.name))
                other.data=mesh; other.matrix_world=Matrix.Identity(4)
                bpy.data.objects.remove(small,do_unlink=True)
                bpy.context.view_layer.update(); changed=True; break
            if changed: break
        if not changed: return merged


def repair():
    collection=bpy.data.collections['COL']
    profiles=[profile_panels(collection,'n5_architecture_rails',118),
              profile_panels(collection,'n5_tete_station',190)]
    bpy.context.view_layer.update()
    merged=merge_fragments(collection)
    padded=[]
    for obj in collection.objects:
        if obj.type!='MESH' or min(obj.dimensions)>=MIN_DIMENSION: continue
        pts=points(obj)
        lo=Vector(tuple(min(p[i] for p in pts) for i in range(3)))
        hi=Vector(tuple(max(p[i] for p in pts) for i in range(3)))
        before=tuple(hi-lo)
        floor_normal=None
        if hi.z-lo.z<.3 and obj.name.startswith('col_hull_'):
            face=max(obj.data.polygons,key=lambda face:face.normal.z)
            if face.normal.z>.9: floor_normal=obj.matrix_world.to_3x3() @ face.normal
        inverse=obj.matrix_world.inverted()
        for vertex in obj.data.vertices:
            old=obj.matrix_world @ vertex.co; point=old.copy()
            for i in range(3):
                if before[i]>=MIN_DIMENSION: continue
                if before[i]<.000001: raise ValueError('Proxy dégénéré : '+obj.name)
                if i==2:
                    point[i]=hi[i]-(hi[i]-point[i])*PADDED_DIMENSION/before[i]
                else:
                    center=(lo[i]+hi[i])/2
                    point[i]=center+(point[i]-center)*PADDED_DIMENSION/before[i]
            if floor_normal is not None:
                point.z=old.z-(floor_normal.x*(point.x-old.x)+floor_normal.y*(point.y-old.y))/floor_normal.z
            vertex.co=inverse @ point
        obj.data.update()
        padded.append({'proxy':obj.name,'avant':[round(v,6) for v in before]})
    doors=[]
    for obj in bpy.context.scene.objects:
        if obj.name.startswith('door_') and obj.get('manuelle') is False:
            del obj['manuelle']; doors.append(obj.name)
    bpy.context.view_layer.update()
    if any(min(o.dimensions)<MIN_DIMENSION for o in collection.objects if o.type=='MESH'):
        raise ValueError('Proxy encore trop mince après réparation')
    return {'profiles':profiles,'fusions':merged,'epaississements':padded,'portes':doors}


def inspect():
    items = []
    for obj in bpy.data.collections['COL'].objects:
        if obj.type != 'MESH' or not obj.name.startswith('col_'): continue
        if min(obj.dimensions) >= MIN_DIMENSION: continue
        points = [obj.matrix_world @ v.co for v in obj.data.vertices]
        lo = [min(v[i] for v in points) for i in range(3)]
        hi = [max(v[i] for v in points) for i in range(3)]
        items.append({'name':obj.name,'kit':obj.get('kit'),
                      'bounds':[[round(v,5) for v in p] for p in (lo,hi)],
                      'dimensions':[round(v,7) for v in obj.dimensions],
                      'vertices':[[round(v,5) for v in p] for p in points]})
    out = ROOT/'renders/metro-colliders/inspection.json'
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n')
    print('[metro-colliders] '+json.dumps({'inspection':str(out),'count':len(items)}))


def visual_signature():
    digest=hashlib.sha256()
    for obj in sorted(bpy.context.scene.objects,key=lambda o:o.name):
        if obj.type!='MESH' or obj.name.startswith('col_'): continue
        digest.update(obj.name.encode())
        digest.update(str(tuple(tuple(row) for row in obj.matrix_world)).encode())
        buffer=array('f',[0])*(len(obj.data.vertices)*3)
        obj.data.vertices.foreach_get('co',buffer)
        digest.update(buffer.tobytes())
    return digest.hexdigest()


def main():
    if '--inspect' in sys.argv:
        inspect(); return
    path=Path(bpy.data.filepath).resolve()
    if path!=ROOT/'assets_src/blender/metro_blockout.blend': raise ValueError('Ouvrir le métro livré')
    before=visual_signature()
    report=repair()
    if visual_signature()!=before: raise ValueError('La réparation a changé une géométrie visible')
    checked=C.check(strict=False,audit=False,niveau='metro')
    if not checked.get('ok'): raise ValueError(checked)
    from tools.metro.blockout.secrets import ExistingAuthor,check_accesses
    from tools.metro.blockout.kiosks import check_placements
    author=ExistingAuthor()
    accesses=check_accesses(author)
    kiosks=check_placements(author)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    exported=C.export(out=ROOT/'public/assets/levels/metro_blockout.glb',niveau='metro')
    if not exported.get('ok'): raise ValueError(exported)
    report.update({'validation':checked['validate']['verdict'],'visuels_identiques':True,
                   'acces_secrets':len(accesses),'bornes':len(kiosks),'export':True})
    print('[metro-colliders] '+json.dumps(report))


if __name__ == '__main__':
    main()
