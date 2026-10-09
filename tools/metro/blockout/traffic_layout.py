"""Entrée VB séparée de l'escalier du poste.

see: docs/4-technique/blockout-metro.md#signaux-et-cadence
"""
import math
from tools.metro.blockout import layout as P
from tools.metro.layout.geometry import subtract, area, intersection, height


EXTENSION_LENGTH = 160
HIDDEN_LENGTH = 72


def _quarter(start, direction, straight, radius, turn):
    """Chemin sortant : droite, quart de cercle, droite jusqu'au chaînage 160."""
    x,y,z=start
    dx,dy=direction
    points=[start,(x+dx*straight,y+dy*straight,z)] if straight else [start]
    sx,sy,_=points[-1]
    nx,ny=-dy*turn,dx*turn
    cx,cy=sx+nx*radius,sy+ny*radius
    for i in range(1,13):
        angle=turn*math.pi/2*i/12
        ox,oy=sx-cx,sy-cy
        points.append((cx+ox*math.cos(angle)-oy*math.sin(angle),
                       cy+ox*math.sin(angle)+oy*math.cos(angle),z))
    used=sum(math.dist(a,b) for a,b in zip(points,points[1:]))
    ex,ey,ez=points[-1]
    points.append((ex+nx*(EXTENSION_LENGTH-used),ey+ny*(EXTENSION_LENGTH-used),ez))
    return tuple(points)


def _outward(lane, end, point):
    if lane=='A' and end==0:
        first=_quarter(point,(0,1),6,12,1)[:-1]
        return _continue_quarter(first,(-1,0),8,12,1)
    if (lane=='A' and end==1) or (lane=='B' and end==0):
        return _quarter(point,(0,-1),24,12 if lane=='A' else 16,-1)
    if lane=='B':
        return _quarter(point,(0,1),0,20,-1)
    if end==0:
        return _quarter(point,(0,1),16,12,-1)
    first=_quarter(point,(1,0),3,12,1)[:-1]
    return _continue_quarter(first,(0,1),8,12,1)


def _continue_quarter(first, direction, straight, radius, turn):
    second=_quarter(first[-1],direction,straight,radius,turn)
    points=first+second[1:]
    excess=sum(math.dist(a,b) for a,b in zip(first,first[1:]))
    a,b=points[-2:]
    length=math.dist(a,b)
    return points[:-1]+(tuple(b[k]-(b[k]-a[k])*excess/length for k in range(3)),)


def extended_route(lane, points):
    """Markers alignés sur les tunnels ; le parcours principal reste à 160 m."""
    before=_outward(lane,0,points[0])
    after=_outward(lane,1,points[-1])
    return tuple(reversed(before))[:-1]+tuple(points)+after[1:]


def _trim(points, distance=HIDDEN_LENGTH):
    result=[points[0]]
    for a,b in zip(points,points[1:]):
        length=math.dist(a,b)
        if length>=distance:
            result.append(tuple(a[k]+(b[k]-a[k])*distance/length for k in range(3)))
            break
        result.append(b)
        distance-=length
    return tuple(result)


def hidden_routes():
    """Les voies sud partagent une seule coque, avec deux rails concentriques."""
    _,_,vb_points=branch()
    specs=[('a_origine','tunnel_a',_outward('A',0,P.A_POINTS[-1]),8.5),
           ('b_nord','tunnel_a',_outward('B',1,P.ROUTES[1].points[-1]),7),
           ('vb_origine','tunnel_b',_outward('VB',0,vb_points[0]),8.5),
           ('vb_sortie','tunnel_b',_outward('VB',1,vb_points[-1]),8.5),
           ('quais_sud','tunnel_a',_quarter((0,118,P.RAIL_Z),(0,-1),24,14,-1),12)]
    routes=[]
    for name,group,points,width in specs:
        if name=='quais_sud': points=(points[0],(0,105,P.RAIL_Z))+points[1:]
        points=_trim(points)
        widths=[width]*(len(points)-1)
        if name=='a_origine': widths[0]=4.5
        if name in ('vb_origine','vb_sortie'): widths[0]=7
        if name=='quais_sud': widths[:2]=[7.5,7.5]
        route=P.Route(name,points,tuple(widths),'Arrière-tunnel coudé ; naissance hors vue')
        surfaces=[]; edges={}
        P.source.tube(route,name,surfaces,edges)
        routes.append((route,group,tuple(P.Surface(group+'_masque_'+s.id,group,s.points) for s in surfaces),edges[name]))
    return tuple(routes)


def hidden_surfaces():
    return [surface for _,_,surfaces,_ in hidden_routes() for surface in surfaces]


def hidden_tracks():
    _,_,vb_points=branch()
    routes=(('A',tuple(reversed(P.ROUTES[0].points))),
            ('B',P.ROUTES[1].points),('VB',vb_points))
    return tuple((lane,end,_trim(_outward(lane,end,points[end and -1])))
                 for lane,points in routes for end in (0,1))


def branch():
    bx,by,_=P.B_POINTS[-1]
    points=[(bx,by+32,-18),(bx,by+12,-18)]
    for i in range(1,7):
        angle=math.pi+math.pi/2*i/6
        points.append((bx+12+12*math.cos(angle),by+12+12*math.sin(angle),-18))
    route=P.Route('sas_b',tuple(points),(7,)*(len(points)-1),'Origine masquée du trafic VB')
    count=len(P.SURFACES)
    P.tube(route,'sas_b')
    surfaces=[P.Surface('tunnel_b_arrivee_'+s.id,'tunnel_b',s.points) for s in P.SURFACES[count:]]
    del P.SURFACES[count:]
    for y in (by+22,):
        surfaces.append(P.Surface('niche_sas_b_'+str(y),'tunnel_b',((bx-5.25,y-1.5,-18),(bx-3.5,y-1.5,-18),(bx-3.5,y+1.5,-18),(bx-5.25,y+1.5,-18))))
    return route,surfaces,tuple(points)+tuple(reversed(P.B_POINTS))[2:]


def attach(floors, additions):
    original=list(floors)
    for surface in additions:
        pieces=[surface.points]
        for other in original:
            remaining=[]
            for piece in pieces:
                overlap=intersection(piece,other.points)
                shared=area(overlap)>1e-7 and all(abs(height(piece,point)-height(other.points,point))<.05 for point in overlap)
                remaining.extend(p for p in (subtract(piece,other.points) if shared else [piece]) if area(p)>1e-7)
            pieces=remaining
        floors.extend(P.Surface(surface.id+'_part_'+str(i),surface.groupe,p) for i,p in enumerate(pieces))
        original=list(floors)
    return floors
