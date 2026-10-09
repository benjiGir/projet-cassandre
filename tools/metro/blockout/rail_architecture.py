"""Voûtes, rails et arrière-tunnels, d'après le board N1.

see: docs/4-technique/blockout-metro.md#signaux-et-cadence
"""
import math
from pathlib import Path
import bpy
from mathutils import Matrix, Vector
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install
from tools.metro.blockout import layout as P
from tools.metro.blockout.geometry import prism, contains, wall
from tools.metro.blockout.traffic_layout import branch, hidden_routes, hidden_tracks
from tools.metro.blockout.station_head import build as station_head, panel as station_panel
from tools.metro.blockout.vault_profile import profile, SEGMENTS, station_height
from tools.metro.blockout.vault_junction import build as joined_vault


def vault(piece, edges, spring, crown, material):
    vertices=[]; uv_points=[]; travelled=0; previous=None
    shape=profile(spring,crown)
    for left,right in edges:
        left,right=Vector(left),Vector(right)
        center=(left+right)/2
        if previous is not None: travelled+=(center-previous).length
        previous=center
        section=[left.lerp(right,t)+Vector((0,0,z)) for t,z in shape]
        arc=0
        for i,point in enumerate(section):
            if i: arc+=(point-section[i-1]).length
            vertices.append(tuple(point)); uv_points.append((arc/2,travelled/2))
    n=len(vertices)
    for row,(left,right) in enumerate(edges):
        across=Vector(right)-Vector(left)
        radius=across.length/2; across.normalize()
        for i in range(SEGMENTS+1):
            angle=math.pi*i/SEGMENTS
            normal=across*(-math.cos(angle)/radius)+Vector((0,0,math.sin(angle)/(crown-spring)))
            vertices.append(tuple(Vector(vertices[row*(SEGMENTS+1)+i])+normal.normalized()*.12))
    stride=SEGMENTS+1
    faces=[]
    for row in range(len(edges)-1):
        for i in range(SEGMENTS):
            k=row*stride+i
            face=(k,k+stride,k+stride+1,k+1)
            faces.extend((face,tuple(v+n for v in reversed(face))))
        for i in (0,SEGMENTS):
            k=row*stride+i
            faces.append((k,k+n,k+stride+n,k+stride))
    for row in (0,len(edges)-1):
        for i in range(SEGMENTS):
            k=row*stride+i
            faces.append((k,k+1,k+1+n,k+n))
    obj=piece.mesh(vertices,faces,material)
    uv=obj.data.uv_layers.active
    for poly in obj.data.polygons:
        poly.use_smooth=all(v<n for v in poly.vertices) or all(v>=n for v in poly.vertices)
        for index in poly.loop_indices:
            uv.data[index].uv=uv_points[obj.data.loops[index].vertex_index%n]


def track(piece, points):
    for a,b in zip(points,points[1:]):
        a,b=Vector(a),Vector(b); direction=(b-a).normalized()
        side=Vector((-direction.y,direction.x,0)).normalized()
        length=(b-a).length
        for sign in (-1,1):
            offset=side*(sign*.72)+Vector((0,0,.13))
            piece.beam(a+offset,b+offset,.09,"acier")
        for i in range(max(1,math.ceil(length/.9))):
            center=a.lerp(b,(i+.5)/max(1,math.ceil(length/.9)))+Vector((0,0,.045))
            piece.beam(center-side*1.05,center+side*1.05,.1,"acier")


def cable_tray(piece,edges):
    vertices=[]
    for left,right in edges:
        left,right=Vector(left),Vector(right)
        inward=(right-left).normalized()
        for depth,high in ((.04,2.44),(.17,2.44),(.17,2.68),(.04,2.68)):
            vertices.append(tuple(left+inward*depth+Vector((0,0,high))))
    faces=[(3,2,1,0)]
    for i in range(len(edges)-1):
        for k in range(4):
            a=i*4+k; b=i*4+(k+1)%4
            faces.append((a,b,b+4,a+4))
    n=len(vertices)
    faces.append((n-4,n-3,n-2,n-1))
    piece.mesh(vertices,faces,"acier")
    travelled=0; next_support=2
    for (left0,right0),(left1,right1) in zip(edges,edges[1:]):
        left0,left1=Vector(left0),Vector(left1)
        length=(left1-left0).length
        while next_support<=travelled+length:
            t=(next_support-travelled)/length
            at=left0.lerp(left1,t)
            inward=(Vector(right0).lerp(Vector(right1),t)-at).normalized()
            if not any(contains(niche.points,(at.x,at.y)) for niche in P.NICHES):
                piece.beam(at+Vector((0,0,2.36)),at+Vector((0,0,2.73)),.045,"acier")
                piece.beam(at+Vector((0,0,2.42)),at+inward*.22+Vector((0,0,2.42)),.045,"acier")
            next_support+=6
        travelled+=length


def backdrop(a,name,start,end,width=4.5,exits=False,closed=True):
    start,end=Vector(start),Vector(end)
    direction=(end-start).normalized(); side=Vector((-direction.y,direction.x,0))*width/2
    p=Piece("n5_arriere_"+name,a.mats,"arrière-tunnel fermé ; apparition masquée")
    vault(p,[(start+side,start-side),(end+side,end-side)],2.75,6.5 if width>7.9 else 4.5,"beton")
    for sign in (-1,1):
        offset=side*sign
        # Parois rectangulaires, colliders fixes séparés.
        length=(end-start).length
        segments=((0,2),(6,length)) if exits else ((0,length),)
        transform=Matrix.Translation(start+offset) @ Matrix.Rotation(-math.atan2(direction.x,direction.y),4,"Z")
        for low,high in segments:
            wall=p.box((-.1,low,0),(.2,high-low,2.75),"beton",True)
            for obj in (wall,p.collection.objects.get("col_box_"+wall.name)):
                if obj: obj.data.transform(transform)
    if closed:
        cap=p.box((-width/2,-.12,0),(width,.24,6.5 if width>7.9 else 4.5),"nuit",True)
        transform=Matrix.Translation(end) @ Matrix.Rotation(-math.atan2(direction.x,direction.y),4,"Z")
        for obj in (cap,p.collection.objects.get("col_box_"+cap.name)):
            if obj: obj.data.transform(transform)
    if name not in ("origine_a", "garage_b"):
        prism(p,[tuple(start-side),tuple(end-side),tuple(end+side),tuple(start+side)],material="sol")
    track(p,[start,end])
    install(a,p,(0,0,0))


def prepare_materials(a):
    with bpy.data.libraries.load(str(Path(__file__).resolve().parents[3]/"assets_src/library/lib_metro_N3.blend"),link=False) as (available,loaded):
        loaded.materials=[name for name in available.materials if name in ('metro_beton','metro_ivoire','metro_acier','metro_sol')]
    for mat in loaded.materials:
        a.mats[mat.name.split('.')[0].removeprefix('metro_')]=mat


def hidden_enclosure(piece, route, edges):
    for side in (0,1):
        for row0,row1 in zip(edges,edges[1:]):
            start,end=tuple(row0[side]),tuple(row1[side])
            cuts={0.,1.}
            limits=((1,324),(1,328),(0,37.5),(0,41.5)) if route.id=='a_origine' else ((0,9.5),(0,13.5))
            for axis,limit in limits:
                delta=end[axis]-start[axis]
                if abs(delta)>1e-8:
                    t=(limit-start[axis])/delta
                    if 0<t<1: cuts.add(t)
            ordered=sorted(cuts)
            for lo,hi in zip(ordered,ordered[1:]):
                a=tuple(start[k]+(end[k]-start[k])*lo for k in range(3))
                b=tuple(start[k]+(end[k]-start[k])*hi for k in range(3))
                x,y=(a[0]+b[0])/2,(a[1]+b[1])/2
                pedestrian=route.id=='a_origine' and 324<y<328
                spur=route.id=='a_origine' and side==1 and 37.5<x<41.5 and 328<y<345
                pedestrian |= route.id=='vb_sortie' and side==1 and 9.5<x<13.5 and y<354
                if not pedestrian and not spur:
                    wall(piece,a,b,a[2]-.25,b[2]-.25,a[2]+2.75,b[2]+2.75,'beton')
                elif pedestrian:
                    wall(piece,a,b,a[2]+2.75,b[2]+2.75,a[2]+3.1,b[2]+3.1,'beton',False)
    left,right=edges[-1]
    crown=6.5 if route.id=='quais_sud' else 4.5
    wall(piece,tuple(left),tuple(right),left[2]-.25,right[2]-.25,left[2]+crown,right[2]+crown,'nuit')


def build(a):
    p=Piece("n5_architecture_rails",a.mats,"rails continus, voûtes et chemin de câbles")
    for group in ("tunnel_a","tunnel_b"):
        if group=='tunnel_a': vault(p,P.TUBE_EDGES[group],2.75,4.5,"beton")
        cable_tray(p,P.TUBE_EDGES[group])
    vault(p,[((-9,118,P.QUAI_Z),(9,118,P.QUAI_Z)),((-9,190,P.QUAI_Z),(9,190,P.QUAI_Z))],2.8,6.5,"ivoire")
    _,_,vb_points=branch()
    joined_vault(p,P.TUBE_EDGES['tunnel_b'],P.TUBE_EDGES['sas_b'])
    cable_tray(p,P.TUBE_EDGES["sas_b"])
    for route in P.ROUTES[:3]: track(p,vb_points if route.id=="VB" else route.points)
    for x in (-9,8.9):
        p.box((x,118,P.QUAI_Z+.2),(.1,72,.28),"petrole")
        p.box((x,118,P.QUAI_Z+2.6),(.1,72,.15),"petrole")
    for x in (-4.65,4.1):
        p.box((x,118,P.QUAI_Z+.01),(.55,72,.018),"ivoire")
    for y in (118,):
        for left,right,opening in ((-9,-4.25,False),(-4.25,.25,True),(.25,3.75,True),(3.75,9,False)):
            shape=profile(2.75,4.5) if opening else [(i/SEGMENTS,0) for i in range(SEGMENTS+1)]
            for (t0,h0),(t1,h1) in zip(shape,shape[1:]):
                x0,x1=left+(right-left)*t0,left+(right-left)*t1
                z0,z1=[P.RAIL_Z+h if opening else P.QUAI_Z+2.75 for h in (h0,h1)]
                station_panel(p,x0,x1,z0,z1,y=y)
    for left,right in ((-4.25,.25),(.25,3.75)):
        for (t0,h0),(t1,h1) in zip(profile(2.75,4.5),profile(2.75,4.5)[1:]):
            x0,x1=left+(right-left)*t0,left+(right-left)*t1
            common=lambda x: 2.75+3.75*math.sqrt(max(0,1-(x/3.75)**2))-.05 if abs(x)<=3.75 else 0
            low0,low1=min(h0,common(x0)),min(h1,common(x1))
            if h0-low0<.001 and h1-low1<.001: continue
            vertices=[(x,y,P.RAIL_Z+h) for y in (117.72,117.88)
                      for x,h in ((x0,low0),(x1,low1),(x1,h1),(x0,h0))]
            p.mesh(vertices,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'ivoire')
    for obj in list(a.logic.objects):
        if not obj.name.startswith("light_quartier_n5_quais_"): continue
        x,y,z=obj.location
        ceiling=station_height(x)
        fixture_roof=min(station_height(x-.6),station_height(x+.6))
        z=min(z,fixture_roof-.55)
        obj.location.z=z
        preview=bpy.data.objects.get('apercu_'+obj.name.removeprefix('light_quartier_'))
        if preview:
            preview.location.z=z
            preview.data.use_shadow=False
        p.box((x-.6,y-.06,z+.05),(1.2,.12,.12),"lampe")
        p.box((x-.025,y-.025,z+.17),(.05,.05,max(.05,ceiling-z-.17)),"acier")
    for route,group,_,edges in hidden_routes():
        hidden=Piece('n5_arriere_'+route.id,a.mats,'voûte coudée ; trains masqués derrière les parois')
        vault(hidden,edges,2.75,6.5 if route.id=='quais_sud' else 4.5,'beton')
        hidden_enclosure(hidden,route,edges)
        install(a,hidden,(0,0,0))
    for lane,end,points in hidden_tracks():
        track(p,points)
    # L'axe du fret est une voie garée, séparée du coude du trafic A.
    track(p,((39.25,328,-18),(39.25,346,-18)))
    install(a,p,(0,0,0))
    station_head(a)
