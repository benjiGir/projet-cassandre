"""Altitudes et refuges révisés pour le parcours jouable N5.

see: docs/4-technique/blockout-metro.md#profondeur-et-circulation
"""
from tools.metro.layout import plan_n2 as source

Surface = source.Surface
Route = source.Route
BLOCKS = source.BLOCKS
LAMP_BUDGET = source.LAMP_BUDGET
hauteur_y = source.hauteur_y
QUAI_Z = -13
RAIL_Z = QUAI_Z - .75
SIGNAL_SPACING = 30


def lower_a(z):
    return -18 + (z + 18) * (-18 - RAIL_Z) / (-18 + 9.75)


A_POINTS = tuple((x,y,lower_a(z)) for x,y,z in source.A_POINTS)
B_POINTS = source.B_POINTS


def galerie_z(x,y):
    entry=hauteur_y(A_POINTS,215.25)
    exit=hauteur_y(A_POINTS,303.25)
    if y<=222: return entry
    if y<240: return entry+(-15.55-entry)*(y-222)/18
    if y<=273: return -15.55
    if y<299: return -15.55+(exit+15.55)*(y-273)/26
    return exit


def revised(surface):
    if surface.id=='poste_lobby':
        bx,by,_=B_POINTS[-1]
        return Surface(surface.id,surface.groupe,((bx-2,by-2,-18),(bx,by-2,-18),(bx,by+2,-18),(bx-2,by+2,-18)))
    if surface.id=='entree_tunnel':
        end=197.5
        return Surface(surface.id,surface.groupe,tuple((x,y,QUAI_Z+(hauteur_y(A_POINTS,end)-QUAI_Z)*(y-190)/(end-190))
                       for x,y in ((-7.75,190),(-4.25,190),(-4.25,end),(-7.75,end))))
    def altitude(x,y,z):
        if surface.groupe=='quais': return z+QUAI_Z+9
        if surface.id=='escalier_quais': return -5+(z+5)*2
        if surface.groupe=='tunnel_a': return lower_a(z)
        if surface.groupe=='galeries': return galerie_z(x,y)
        if surface.id=='acces_sang_froid':
            return galerie_z(x,y)
        return z
    return Surface(surface.id,surface.groupe,tuple((x,y,altitude(x,y,z)) for x,y,z in surface.points))


GALLERY_BREAKS = (222,240,273,299)
ASCENT = (
    ('volee_1',430,438.1,-17.25,-12.75,18),
    ('palier_1',438.1,439.9,-12.75,-12.75,0),
    ('volee_2',439.9,447.55,-12.75,-8.5,17),
    ('palier_2',447.55,449.35,-8.5,-8.5,0),
    ('volee_3',449.35,457,-8.5,-4.25,17),
    ('palier_3',457,458.85,-4.25,-4.25,0),
    ('volee_4',458.85,466.5,-4.25,0,17),
)


DESCENT = (
    ('haute',106.5,111.5,-5,-9,16),
    ('palier',111.5,113,-9,-9,0),
    ('basse',113,118,-9,-13,16),
)


def ascent_z(y):
    for _,lo,hi,z0,z1,_ in ASCENT:
        if y<=hi: return z0+(z1-z0)*max(0,(y-lo)/(hi-lo))
    return 0


def gallery_segments(surface):
    if surface.id=='billets':
        return [Surface('billets_'+name,'billets',((x0,84,-5),(x1,84,-5),(x1,y1,-5),(x0,y1,-5)))
                for name,x0,x1,y1 in (('ouest',-18,-9,108),('seuil',-9,-4,106.5),('est',-4,18,108))]
    if surface.id=='escalier_quais':
        return [Surface('escalier_quais_'+name,'descente',((-9,lo,z0),(-4,lo,z0),(-4,hi,z1),(-9,hi,z1)))
                for name,lo,hi,z0,z1,_ in DESCENT]
    if surface.id=='remontee':
        return [Surface('remontee_'+name,'remontee',((48,lo,z0),(52,lo,z0),(52,hi,z1),(48,hi,z1)))
                for name,lo,hi,z0,z1,_ in ASCENT]
    if surface.groupe!='galeries': return [surface]
    xs,ys,_=zip(*surface.points)
    levels=[min(ys)]+[y for y in GALLERY_BREAKS if min(ys)<y<max(ys)]+[max(ys)]
    if len(levels)==2: return [surface]
    return [Surface(surface.id+f'_grade_{i}',surface.groupe,
                    tuple((x,y,galerie_z(x,y)) for x,y in
                          ((min(xs),lo),(max(xs),lo),(max(xs),hi),(min(xs),hi))))
            for i,(lo,hi) in enumerate(zip(levels,levels[1:]))]


SURFACES = [part for s in source.SURFACES if s.groupe!='depot' and s.id!='sang_froid'
            for part in gallery_segments(revised(s))]
SURFACES += [Surface('local_agents','secret_2',((76,258.25,-15.55),(84,258.25,-15.55),
                                              (84,264.25,-15.55),(76,264.25,-15.55))),
             Surface('depot_hall','depot',((27.5,322,-18),(51.5,322,-18),(51.5,366,-18),(27.5,366,-18))),
             Surface('depot_atelier','depot',((51.5,322,-18),(71.5,322,-18),(71.5,366,-18),(51.5,366,-18))),
             Surface('depot_passage_poste','depot',((7.5,346,-18),(27.5,346,-18),(27.5,366,-18),(7.5,366,-18)))]
NICHES = [revised(s) for i,s in enumerate(source.NICHES) if i%2==0]
TUBE_EDGES = {group:[tuple((x,y,lower_a(z) if group=='tunnel_a' else z) for x,y,z in edge)
                     for edge in edges] for group,edges in source.TUBE_EDGES.items()}
ROUTES = tuple(Route(r.id,tuple((x,y,lower_a(z) if i==0 else z+QUAI_Z+9 if i==1 else z)
                               for x,y,z in r.points),r.widths,r.role)
               for i,r in enumerate(source.ROUTES))


def tube(route,group):
    source.tube(route,group,SURFACES,TUBE_EDGES)
