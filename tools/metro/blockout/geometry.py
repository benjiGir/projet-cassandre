"""Supports N2 et enveloppes fermées du blockout N5.

see: docs/4-technique/blockout-metro.md#géométrie
"""
import math

import bpy

from tools.metro.layout.geometry import cross, height
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install

HEIGHT = {"billets": 3.5, "descente": 3.5, "quais": 6.5, "tunnel_a": 4.5,
          "tunnel_b": 4.5, "galeries": 3, "depot": 8, "poste": 4,
          "machinerie": 5, "fret": 3.65, "privee": 6, "remontee": 4, "parvis": 5}


def clearance(surface):
    if surface.id.startswith('escalier_quais'): return 2.75
    if surface.id.startswith(('depot_atelier','depot_passage_poste')): return 4.7
    if surface.groupe=='depot': return 6.5
    return 3 if surface.id.startswith('entree_tunnel') else HEIGHT.get(surface.groupe,3.5)


def contains(poly, xy):
    return all(cross(a, b, xy) >= -1e-6 for a, b in zip(poly, poly[1:] + poly[:1]))


def prism(p, polygon, thickness=.25, material="ardoise", collision=True):
    n = len(polygon)
    vertices = [tuple(v) for v in polygon] + [(x, y, z-thickness) for x, y, z in polygon]
    faces = []
    for i in range(1, n-1):
        faces.extend(((0, i, i+1), (n, n+i+1, n+i)))
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    return p.mesh(vertices, faces, material, collision)


def cuts(a, b, surfaces):
    dx, dy = b[0]-a[0], b[1]-a[1]
    length2 = dx*dx+dy*dy
    ts = {0., 1.}
    for surface in surfaces:
        for c, d in zip(surface.points, surface.points[1:] + surface.points[:1]):
            ex, ey = d[0]-c[0], d[1]-c[1]
            det = dx*ey-dy*ex
            if abs(det) < 1e-8:
                if abs(cross(a,b,c)) < 1e-6:
                    for q in (c,d):
                        t = ((q[0]-a[0])*dx+(q[1]-a[1])*dy)/length2
                        if 0<t<1: ts.add(round(t,8))
            else:
                ux, uy = c[0]-a[0], c[1]-a[1]
                t, u = (ux*ey-uy*ex)/det, (ux*dy-uy*dx)/det
                if 0<t<1 and -1e-7<=u<=1+1e-7: ts.add(round(t,8))
    return sorted(ts)


def wall(p, a, b, za, zb, high_a, high_b, material="enduit", solid=True):
    dx, dy = b[0]-a[0], b[1]-a[1]
    length = math.hypot(dx,dy)
    nx, ny = dy/length*.2, -dx/length*.2
    vertices = [(a[0],a[1],za),(b[0],b[1],zb),(b[0],b[1],high_b),(a[0],a[1],high_a),
                (a[0]+nx,a[1]+ny,za),(b[0]+nx,b[1]+ny,zb),
                (b[0]+nx,b[1]+ny,high_b),(a[0]+nx,a[1]+ny,high_a)]
    p.mesh(vertices, [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)], material, solid)


def build_support(a, surface, surfaces):
    materials = a.mats.copy()
    if surface.groupe in ("tunnel_a", "tunnel_b"):
        materials["enduit"], materials["ardoise"] = a.mats["beton"], a.mats["sol"]
    elif surface.groupe == "quais":
        materials["enduit"], materials["ardoise"] = a.mats["ivoire"], a.mats["sol"]
    elif surface.groupe in ("galeries","depot","machinerie","secret_2"):
        materials["enduit"], materials["ardoise"] = a.mats["beton"], a.mats["sol"]
    elif surface.groupe in ("privee","remontee","parvis"):
        materials["enduit"], materials["ardoise"] = a.mats["prive_pierre"], a.mats["prive_sol"]
    elif surface.groupe == "fret":
        materials["ardoise"] = a.mats["sol"]
    p = Piece("n5_"+surface.id, materials, "support et limites du plan N2")
    floor = surface.points
    slab=prism(p, floor)
    stairs=surface.id.startswith('escalier_quais')
    if stairs:
        bpy.data.objects.remove(slab,do_unlink=True)
    headroom = clearance(surface)
    if not stairs and surface.groupe not in ("parvis", "secret_3", "quais", "fret") and not surface.id.startswith(("tunnel_a_", "tunnel_b_")):
        prism(p, [(x,y,z+headroom+.2) for x,y,z in floor], .2, "enduit", False)
    for start, end in zip(floor, floor[1:] + floor[:1]):
        if stairs or surface.groupe in ("fret","parvis") or '_masque_' in surface.id: break
        dx, dy = end[0]-start[0], end[1]-start[1]
        length = math.hypot(dx,dy)
        if length<1e-5: continue
        steps = cuts(start,end,surfaces)
        for low, high in zip(steps, steps[1:]):
            if (high-low)*length<.015: continue
            aa = tuple(start[k]+low*(end[k]-start[k]) for k in range(3))
            bb = tuple(start[k]+high*(end[k]-start[k]) for k in range(3))
            if surface.groupe=='quais' and abs(aa[1]-190)<.001 and abs(bb[1]-190)<.001:
                continue
            mid = ((aa[0]+bb[0])/2+dy/length*.015, (aa[1]+bb[1])/2-dx/length*.015)
            neighbours = [s for s in surfaces if s is not surface and contains(s.points,mid)
                          and height(s.points,mid)+clearance(s)>height(floor,mid)+.1
                          and height(s.points,mid)<height(floor,mid)+headroom-.1]
            if neighbours:
                neighbour = neighbours[0]
                za, zb = height(neighbour.points,aa), height(neighbour.points,bb)
                if min(aa[2]-za,bb[2]-zb)>.05:
                    wall(p,aa,bb,za-.25,zb-.25,aa[2],bb[2],"ardoise")
                other_clearance = clearance(neighbour)
                if headroom>other_clearance+.1 and surface.groupe not in ("parvis","secret_3"):
                    wall(p,aa,bb,za+other_clearance,zb+other_clearance,aa[2]+headroom,bb[2]+headroom,solid=False)
                continue
            # Raccords vers le quartier déjà construit et prolongements cachés des voies.
            if surface.groupe=="billets" and max(aa[1],bb[1])<=84.001 and (min(aa[0],bb[0])>=-2.25 and max(aa[0],bb[0])<=2.25 or min(aa[0],bb[0])>=25 and max(aa[0],bb[0])<=27):
                continue
            if surface.groupe=="quais" and (abs(aa[1]-118)<.001 and abs(bb[1]-118)<.001 or abs(aa[1]-190)<.001 and abs(bb[1]-190)<.001) and -4.01<=mid[0]<=4.01:
                continue
            if surface.groupe=="tunnel_b" and abs(aa[0]-7.5)<.001 and abs(bb[0]-7.5)<.001:
                continue
            # La fosse reste entourée et possède son propre fond fermé.
            pit = surface.groupe=="machinerie" and 97.49<=mid[0]<=109.51 and 333.99<=mid[1]<=350.01
            if pit: continue
            guard_height = 1.5 if surface.groupe=="secret_3" else headroom
            wall(p,aa,bb,aa[2]-.25,bb[2]-.25,aa[2]+guard_height,bb[2]+guard_height)
    before = set(a.props.objects)
    install(a,p,(0,0,0))
    return set(a.props.objects)-before
