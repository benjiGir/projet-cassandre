"""Réseaux muraux, éclairage et commande des galeries de service.

see: docs/4-technique/blockout-metro.md#galeries-de-service
"""
import math

from mathutils import Vector

from tools.metro.blockout import layout as P
from tools.metro.blockout.agents_room import build as agents_room
from tools.metro.blockout.gallery_distribution import build as gallery_distribution
from tools.metro.blockout.gallery_service_bay import build as gallery_service_bay
from tools.metro.blockout.gallery_return import build as gallery_return
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


AXIS = ((.8,215.25),(25.5,215.25),(25.5,219.25),(63.75,219.25),
        (63.75,243.25),(69.75,243.25),(69.75,269.75),
        (63.75,269.75),(63.75,303.25),(41.8,303.25))


def side_path(offset):
    points=[Vector(p) for p in AXIS]
    normals=[]
    for a,b in zip(points,points[1:]):
        d=(b-a).normalized()
        normals.append(Vector((-d.y,d.x)))
    result=[points[0]+normals[0]*offset]
    for i,point in enumerate(points[1:-1],1):
        m=normals[i-1]+normals[i]
        result.append(point+m*(offset/m.dot(normals[i])))
    return result+[points[-1]+normals[-1]*offset]


def rounded(points,radius=.3):
    result=[points[0]]
    for a,b,c in zip(points,points[1:],points[2:]):
        u=(a-b).normalized(); v=(c-b).normalized()
        center=b+(u+v)*radius
        start=b+u*radius
        end=b+v*radius
        va=start-center; vb=end-center
        angle=math.atan2(va.x*vb.y-va.y*vb.x,va.dot(vb))
        for i in range(7):
            theta=angle*i/6
            result.append(center+Vector((va.x*math.cos(theta)-va.y*math.sin(theta),
                                         va.x*math.sin(theta)+va.y*math.cos(theta))))
    return result+[points[-1]]


def elevated(points,high):
    result=[]
    for a,b in zip(points,points[1:]):
        ts=[0.]
        if abs(b.y-a.y)>1e-8:
            ts += [(y-a.y)/(b.y-a.y) for y in P.GALLERY_BREAKS if min(a.y,b.y)<y<max(a.y,b.y)]
        for t in sorted(ts):
            at=a.lerp(b,t)
            result.append(Vector((at.x,at.y,P.galerie_z(at.x,at.y)+high)))
    at=points[-1]
    return result+[Vector((at.x,at.y,P.galerie_z(at.x,at.y)+high))]


def pipe(piece,points,radius,material):
    vertices=[]
    sides=10
    for i,at in enumerate(points):
        tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
        across=tangent.cross(Vector((0,0,1))).normalized()
        up=across.cross(tangent).normalized()
        for j in range(sides):
            theta=math.tau*j/sides
            vertices.append(tuple(at+radius*(across*math.cos(theta)+up*math.sin(theta))))
    faces=[]
    for i in range(len(points)-1):
        for j in range(sides):
            k=i*sides+j; q=i*sides+(j+1)%sides
            faces.append((k,q,q+sides,k+sides))
    faces += [tuple(reversed(range(sides))),tuple(range(len(vertices)-sides,len(vertices)))]
    obj=piece.mesh(vertices,faces,material)
    for poly in obj.data.polygons:
        poly.use_smooth=len(poly.vertices)==4


def cabinet(a,at,angle):
    p=Piece('n5_galerie_coffret_'+str(at[0]),a.mats,'coffret fixé au mur, profondeur 18 cm')
    p.box((-.45,-.18,.8),(.9,.18,.95),'acier',True)
    p.box((-.38,-.195,.87),(.76,.025,.8),'petrole')
    for i in range(5):
        p.box((-.29,-.225,.95+i*.075),(.44,.035,.025),'acier')
    p.box((.23,-.225,1.26),(.035,.035,.16),'ivoire')
    for x in (-.34,.28):
        p.box((x,-.12,.73),(.06,.12,1.08),'acier')
    install(a,p,at,angle)


def build(a,gate):
    p=Piece('n5_galeries_service',a.mats,'conduites continues sur consoles, appliques et commande murale')
    path=side_path(1.1)
    curve=rounded(path)
    for high,radius,material in ((2.32,.075,'acier'),(2.57,.055,'petrole')):
        pipe(p,elevated(curve,high),radius,material)
    tray=elevated(path,2.81)
    for lo,hi in zip(tray,tray[1:]):
        p.beam(lo,hi,.12,'acier')
    for at in (path[0],path[-1]):
        z=P.galerie_z(at.x,at.y)
        p.box((at.x-.12,at.y-.1,z+2.22),(.24,.2,.68),'acier')
    for i,(lo,hi) in enumerate(zip(path,path[1:])):
        direction=(hi-lo).normalized()
        inward=Vector((direction.y,-direction.x,0))
        distance=(hi-lo).length
        count=max(1,math.ceil(distance/4))
        for j in range(count):
            at=lo.lerp(hi,(j+.5)/count)
            z=P.galerie_z(at.x,at.y)
            wall=Vector((at.x,at.y,z))+inward*(-.145)
            p.beam(wall+Vector((0,0,2.16)),wall+Vector((0,0,2.95)),.045,'acier')
            for height in (2.24,2.76):
                p.beam(wall+Vector((0,0,height)),wall+inward*.29+Vector((0,0,height)),.045,'acier')
            for height,radius in ((2.32,.085),(2.57,.065)):
                center=Vector((at.x,at.y,z+height))
                pipe(p,[center-Vector((direction.x,direction.y,0))*.04,
                        center+Vector((direction.x,direction.y,0))*.04],radius,'acier')
    lamps=side_path(-1.14)
    for i,(lo,hi) in enumerate(zip(lamps,lamps[1:])):
        direction=(hi-lo).normalized()
        inward=Vector((-direction.y,direction.x,0))
        count=max(1,math.ceil((hi-lo).length/8))
        for j in range(count):
            at=lo.lerp(hi,(j+.5)/count)
            if abs(at.x-70.89)<.01 and 259.5<at.y<263:
                at.y=258.8
            center=Vector((at.x,at.y,P.galerie_z(at.x,at.y)+2.18))
            across=Vector((direction.x,direction.y,0))
            p.beam(center-across*.45,center+across*.45,.18,'acier')
            p.beam(center+inward*.11-across*.36,center+inward*.11+across*.36,.075,'lampe')
            p.beam(center-inward*.1,center+inward*.02,.12,'acier')
            light=center+inward*.23
            a.point(f'n5_galerie_applique_{i}_{j}',tuple(light),'#d4c6a7',5,10)
    z=P.galerie_z(44,304.4)
    for h in (.98,1.56):
        p.box((43.75,304.405,z+h),(.5,.095,.055),'acier')
    p.beam((44.18,304.35,z+1.6),(44.18,304.35,z+2.91),.035,'acier')
    p.beam((44.18,304.35,z+2.91),(44.18,302.15,z+2.91),.035,'acier')
    p.beam((44.18,302.15,z+2.91),(44.18,302.15,z+2.81),.035,'acier')
    install(a,p,(0,0,0))
    cabinet(a,(17,214.04,P.galerie_z(17,214.04)),math.pi)
    agents_room(a)
    gallery_service_bay(a)
    gallery_distribution(a)
    gallery_return(a)
    control=a.command('use_n5_raccourci',(44,304.25,z+1.3),gate.name,'OUVRIR LE RACCOURCI')
    return control
