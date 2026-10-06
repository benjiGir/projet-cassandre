"""Candidat N2 : données métriques hors Blender, avant le blockout N5.

see: docs/assets/plan-metro.md
"""
from dataclasses import dataclass
import math


def snap(value):
    return round(value * 4) / 4


@dataclass(frozen=True)
class Surface:
    id: str
    groupe: str
    points: tuple[tuple[float, float, float], ...]


@dataclass(frozen=True)
class Route:
    id: str
    points: tuple[tuple[float, float, float], ...]
    widths: tuple[float, ...]
    role: str


def parcours(origin, heading, commands, start_z, end_z):
    x, y = origin
    points = [(snap(x), snap(y))]
    widths = []
    for kind, length, width in commands:
        if kind == 'droit':
            steps = [4, length-8, 4] if length > 16 else [length]
            for step in steps:
                x += step * math.sin(heading)
                y += step * math.cos(heading)
                points.append((snap(x), snap(y)))
                widths.append(width)
        else:
            radius, degrees = length
            count = max(1, math.ceil(abs(degrees) / 7.5))
            delta = math.radians(degrees / count)
            sign = 1 if delta > 0 else -1
            for _ in range(count):
                next_heading = heading + delta
                x += radius * (math.cos(heading) - math.cos(next_heading)) * sign
                y += radius * (math.sin(next_heading) - math.sin(heading)) * sign
                heading = next_heading
                points.append((snap(x), snap(y)))
                widths.append(width)
    lengths = [math.dist(a, b) for a, b in zip(points, points[1:])]
    total = sum(lengths)
    distance = 0
    elevated = [(points[0][0], points[0][1], start_z)]
    for p, length in zip(points[1:], lengths):
        distance += length
        elevated.append((*p, snap(start_z + (end_z - start_z) * distance / total)))
    return tuple(elevated), tuple(widths)


A_POINTS, A_WIDTHS = parcours((-2, 190), 0,
    [('droit', 32, 4.5), ('courbe', (32, 45), 7), ('droit', 32, 4.5),
     ('courbe', (32, -45), 7), ('droit', 32, 4.5)], -9.75, -18)
B_POINTS, B_WIDTHS = parcours((7.5, 354), -math.pi / 2,
    [('droit', 16, 4.5), ('courbe', (24, 45), 7), ('droit', 14, 4.5),
     ('courbe', (24, -45), 7), ('droit', 12, 4.5)], -18, -18)
ROUTES = (
    Route('V2', ((-2, 118, -9.75),) + A_POINTS, (4,) + A_WIDTHS, 'Face au joueur dans A'),
    Route('V1', ((2, 118, -9.75), (2, 190, -9.75)), (4,), 'Sens opposé sur les quais'),
    Route('VB', B_POINTS, B_WIDTHS, 'Aller calme ; retour, trafic dans le dos'),
    Route('M', ((15.5, 338, -18), (63.5, 338, -18)), (4,), 'Manœuvre, passage limité au dépôt'),
    Route('M_deviee', ((15.5, 338, -18), (31.5, 338, -18), (55.5, 350, -18)), (4, 7), 'Branche de manœuvre à construire au lot T2'),
    Route('F', ((39.5, 366, -18), (39.5, 427.5, -18)), (3.75,), 'Rame fixe, défilement du décor'),
)

SURFACES = []
TUBE_EDGES = {}
BLOCKS = [(-40,-8,12,60),(8,40,12,44),(-8,18,52,68),(8,22,44,52),(30,40,44,68)]


def quad(name, group, xy, z):
    height = z if callable(z) else lambda x, y: z
    surface = Surface(name, group, tuple((x, y, height(x, y)) for x, y in xy))
    SURFACES.append(surface)
    return surface


def rect(name, group, x0, x1, y0, y1, z):
    return quad(name, group, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z)


def ramp(name, group, x0, x1, y0, y1, axis, low, high):
    return rect(name, group, x0, x1, y0, y1,
        lambda x, y: low + (high - low) * ((x-x0)/(x1-x0) if axis == 'x' else (y-y0)/(y1-y0)))


def tube(route, group):
    points = route.points
    normals = []
    for a, b in zip(points, points[1:]):
        length = math.dist(a[:2], b[:2])
        normals.append((-(b[1]-a[1])/length, (b[0]-a[0])/length))
    edges = []
    for i, p in enumerate(points):
        prev = normals[max(0, i-1)]
        following = normals[min(i, len(normals)-1)]
        nx, ny = prev[0] + following[0], prev[1] + following[1]
        length = math.hypot(nx, ny)
        nx, ny = nx/length, ny/length
        width = max(route.widths[max(0, i-1)], route.widths[min(i, len(route.widths)-1)])
        half = width/2 / (nx*following[0]+ny*following[1])
        edges.append(((p[0]+nx*half,p[1]+ny*half,p[2]), (p[0]-nx*half,p[1]-ny*half,p[2])))
    TUBE_EDGES[group] = edges
    for i, (a,b) in enumerate(zip(edges, edges[1:])):
        SURFACES.append(Surface(f'{group}_{i:02}', group, (a[1],b[1],b[0],a[0])))


def hauteur_y(points, y):
    for a,b in zip(points,points[1:]):
        if a[1] <= y <= b[1]:
            return a[2] + (b[2]-a[2]) * (y-a[1])/(b[1]-a[1])
    raise ValueError(f'altitude absente à y={y}')


rect('quartier', 'quartier', -40,40,0,72,0)
ramp('descente_public', 'descente', -3,3,72,84,'y',0,-5)
ramp('descente_service', 'descente',24,28,72,84,'y',0,-5)
rect('arriere_guichet','billets',18,28,84,88,-5)
rect('billets','billets',-18,18,84,108,-5)
ramp('escalier_quais','descente',-9,-4,108,118,'y',-5,-9)
for name,x0,x1,z in [('quai_gauche',-9,-4,-9),('voie_gauche',-4,0,-9.75),
                       ('voie_droite',0,4,-9.75),('quai_droit',4,9,-9)]:
    rect(name,'quais',x0,x1,118,190,z)
rect('entree_tunnel','tunnel_a',-7.75,-4.25,190,194,lambda x,y: hauteur_y(A_POINTS,y)+.75)
# L'accès descend de 0,75 m dans la première niche, au blockout.
tube(Route('A',A_POINTS,A_WIDTHS,'A'),'tunnel_a')
def galerie_z(x,y):
    if y<=222 or y>=290: return hauteur_y(A_POINTS,y)
    return hauteur_y(A_POINTS,222)+(hauteur_y(A_POINTS,290)-hauteur_y(A_POINTS,222))*(y-222)/68

for name,x0,x1,y0,y1 in [
    ('est_1',.25,24.25,214,216.5),('est_coude',24.25,26.75,214,220.5),
    ('est_2',26.75,65,218,220.5),('nord_1',62.5,65,220.5,244.5),
    ('nord_coude_1',65,71,242,244.5),('nord_2',68.5,71,244.5,268.5),
    ('nord_coude_2',62.5,71,268.5,271),('nord_3',62.5,65,271,302),
    ('ouest',A_POINTS[-1][0]+2.25,65,302,304.5)]:
    rect('galerie_'+name,'galeries',x0,x1,y0,y1,galerie_z)
quad('acces_sang_froid','secret_2',[(71,260),(76,260),(76,262.5),(71,262.5)],
     lambda x,y: (1-(x-71)/5)*galerie_z(x,y)+((x-71)/5)*-14.5)
rect('sang_froid','secret_2',76,108,260,284,-14.5)
rect('depot_sud','depot',7.5,71.5,322,362,-18)
rect('depot_nord_ouest','depot',7.5,37.75,362,366,-18)
rect('depot_nord_est','depot',41.25,71.5,362,366,-18)
ramp('embarquement','depot',37.75,41.25,362,366,'y',-18,-17.25)
tube(Route('B',B_POINTS,B_WIDTHS,'B'),'tunnel_b')
bx,by,_=B_POINTS[-1]
rect('poste_lobby','poste',bx-2,bx,by-8,by+8,-18)
ramp('poste_escalier','poste',bx-6,bx-2,by-2,by+2,'x',-16,-18)
rect('poste_cabine','poste',bx-16,bx-6,by-5,by+5,-16)
for name,y0 in [('aller',328),('retour',352)]:
    ramp(f'machinerie_{name}','machinerie',71.5,87.5,y0,y0+4,'x',-18,-22)
for name,x0,x1,y0,y1 in [('sud',87.5,119.5,326,334),('nord',87.5,119.5,350,358),
                           ('ouest',87.5,97.5,334,350),('est',109.5,119.5,334,350)]:
    rect(f'machinerie_{name}_sol','machinerie',x0,x1,y0,y1,-22)
rect('acces_secret_4','secret_4',119.5,124.5,342,344.5,-22)
rect('secret_4','secret_4',124.5,132.5,340,346,-22)
for i in range(4):
    y=366+i*15.5
    rect(f'fret_voiture_{i+1}','fret',37.75,41.25,y,y+15,-17.25)
    if i<3: rect(f'fret_raccord_{i+1}','fret',37.75,41.25,y+15,y+15.5,-17.25)
rect('station_privee','privee',41.25,59.25,366,430,-17.25)
ramp('remontee','remontee',48,52,430,466.5,'y',-17.25,0)
rect('parvis','parvis',24,72,466.5,500.5,0)

rect('toit_rame_garee','secret_3',15.5,19.5,344,359,-14.75)
ramp('acces_toit_rame','secret_3',19.5,26,353,355.5,'x',-14.75,-18)

NICHES=[]
for group,points in [('tunnel_a',A_POINTS),('tunnel_b',B_POINTS)]:
    travelled=0
    lengths=[math.dist(a[:2],b[:2]) for a,b in zip(points,points[1:])]
    for step in range(6,math.floor(sum(lengths)),12):
        travelled=0
        for i,(a,b,length) in enumerate(zip(points,points[1:],lengths)):
            if step<=travelled+length: break
            travelled+=length
        along=step-travelled; t=along/length
        dx,dy=(b[0]-a[0])/length,(b[1]-a[1])/length
        nx,ny=-dy,dx
        ea,eb=TUBE_EDGES[group][i][0],TUBE_EDGES[group][i+1][0]
        cx,cy=ea[0]+(eb[0]-ea[0])*t,ea[1]+(eb[1]-ea[1])*t
        coords=[(cx+dx*u+nx*v,cy+dy*u+ny*v) for u,v in [(-1.5,0),(1.5,0),(1.5,1.5),(-1.5,1.5)]]
        height=lambda x,y,a=a,b=b,dx=dx,dy=dy,length=length: a[2]+(b[2]-a[2])*((x-a[0])*dx+(y-a[1])*dy)/length
        surface=Surface(f'niche_{group}_{step}',group,tuple((x,y,height(x,y)) for x,y in coords))
        NICHES.append(surface)

rect('arriere_boutique','secret_1',-28,-20,12,18,0)

LABELS=[('1','Quartier',0,36,'0 m'),('2','Billets',0,96,'−5 m'),('3','Quais',0,154,'−9 / −9,75 m'),
 ('4','Tunnel A',18,256,'−9,75 → −18 m'),('5','Galeries',65,263,'descente de service'),
 ('6','Dépôt',40,342,'−18 m'),('7','Tunnel B',-27,368,'−18 m'),
 ('8','Aiguillage',bx-10,by,'cabine −16 m'),('9','Machinerie',104,342,'−22 m'),
 ('10','À bord',39.5,398,'plancher −17,25 m'),('11','Privée',50,400,'quai −17,25 m'),('12','Parvis',48,483,'0 m')]
LAMP_BUDGET={'quartier':18,'billets':8,'quais':12,'tunnel_a':16,'galeries':12,'depot':12,'tunnel_b':8,'poste':4,'machinerie':8,'fret':6,'privee':6,'parvis':8}
# Arêtes orientées de progression ; une proximité de sols n'ouvre pas une porte.
LINKS=[('quartier','secret_1','facultatif'),('quartier','billets','service'),('billets','quartier','grille ouverte depuis les billets'),
 ('billets','quais','escalier'),('quais','tunnel_a','deux traversées'),('tunnel_a','galeries','avant grille'),
 ('galeries','tunnel_a','après grille et raccourci'),('galeries','secret_2','facultatif'),
 ('tunnel_a','depot','sortie'),('depot','secret_3','escalier latéral, NPC exclus'),('depot','tunnel_b','objectif A'),('tunnel_b','poste','objectif A'),
 ('poste','tunnel_b','retour'),('tunnel_b','depot','retour'),('depot','machinerie','objectif B'),
 ('machinerie','depot','seconde rampe'),('machinerie','secret_4','facultatif'),
 ('depot','fret','après A et B et arène'),('fret','privee','après voyage'),('privee','parvis','escalier mécanique')]

SECRETS=[('S1',-24,15,'Arrière-boutique'),('S2',92,272,'Sang-Froid'),('S3',17.5,351,'Toit de rame'),('S4',128.5,343,'Derrière le ventilateur')]
LIGHT_CLUSTERS={'rue_station':{'quartier':18,'billets':8,'quais':12,'phares_signaux':4},
 'station_tunnel':{'quais':12,'tunnel_a':16,'galeries':12,'phares_signaux':4},
 'depot_objectifs':{'depot':12,'tunnel_b_proche':4,'tunnel_a_proche':4,'poste':4,'machinerie':8,'fret':6,'privee':6,'phares_signaux':4},
 'voyage':{'depot':12,'fret':6,'privee':6,'phares_signaux':4},
 'sortie':{'fret':6,'privee':6,'parvis':8,'phares_signaux':4}}
