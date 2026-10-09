"""Géométrie 2D du plan N2 ; sans dépendance Blender.

see: docs/assets/plan-metro.md#contrôles-produits
"""
import math


def cross(a,b,c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])


def height(poly, xy):
    a = poly[0]
    b = next(p for p in poly[1:] if math.dist(a[:2],p[:2])>1e-5)
    c = next(p for p in poly[1:] if abs(cross(a,b,p))>1e-8)
    dx1, dy1, dx2, dy2 = b[0]-a[0], b[1]-a[1], c[0]-a[0], c[1]-a[1]
    det = dx1*dy2-dx2*dy1
    ux, uy = xy[0]-a[0], xy[1]-a[1]
    return a[2]+(ux*dy2-uy*dx2)/det*(b[2]-a[2])+(dx1*uy-dy1*ux)/det*(c[2]-a[2])


def area(poly):
    return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(poly,poly[1:]+poly[:1])))/2 if len(poly)>2 else 0


def clip(poly, a, b, keep_inside=True):
    out=[]
    for start,end in zip(poly,poly[1:]+poly[:1]):
        ds,de=cross(a,b,start),cross(a,b,end)
        inside=lambda d: d>=-1e-9 if keep_inside else d<=1e-9
        if inside(ds): out.append(start)
        if inside(ds)!=inside(de):
            t=ds/(ds-de)
            out.append(tuple(s+(e-s)*t for s,e in zip(start,end)))
    return out


def intersection(poly, other):
    result=list(poly)
    for a,b in zip(other,other[1:]+other[:1]):
        result=clip(result,a,b)
        if len(result)<3: return []
    return result


def subtract(poly, other):
    remaining=list(poly); pieces=[]
    for a,b in zip(other,other[1:]+other[:1]):
        exterior=clip(remaining,a,b,False)
        if area(exterior)>1e-7: pieces.append(tuple(exterior))
        remaining=clip(remaining,a,b)
        if area(remaining)<1e-7: break
    return pieces


def distance_segment(p,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]
    t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
    return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
