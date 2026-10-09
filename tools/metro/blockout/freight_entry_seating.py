"""Sièges de service de la première voiture, hors allée centrale.

see: docs/assets/tunnels-references.md#sièges-de-la-première-voiture--9-octobre
"""
from math import pi

from mathutils import Vector

from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


FLOOR = -17.25


def tube(p, a, b, radius=.024):
    a, b = Vector(a), Vector(b)
    obj = p.cylinder((0, 0, 0), radius, (b-a).length, 'acier', sides=12)
    rotation = (b-a).to_track_quat('Z', 'Y').to_matrix()
    for v in obj.data.vertices:
        v.co = rotation @ v.co + (a+b)/2


def profile(p, outline, y, width, material):
    count = len(outline)
    vertices = [(x, yy, z) for yy in (y, y+width) for x, z in outline]
    faces = [tuple(reversed(range(count))), tuple(range(count, 2*count))]
    faces += [(i, (i+1)%count, (i+1)%count+count, i+count) for i in range(count)]
    return p.mesh(vertices, faces, material)


def seat(p, y, folded=False):
    profile(p, ((.09,.50),(.17,.50),(.21,1.12),(.17,1.27),
                (.09,1.30),(.05,1.24)), y, .58, 'ivoire')
    profile(p, ((.174,.64),(.198,.67),(.233,1.11),(.212,1.22),
                (.177,1.24),(.155,1.20)), y+.035, .51, 'petrole')
    p.box((.216,y+.055,1.12),(.020,.47,.030),'acier')
    if folded:
        outline=((.22,.48),(.30,.48),(.34,.93),(.30,1.03),(.24,1.03),(.20,.96))
        profile(p, outline, y, .58, 'ivoire')
        profile(p, ((.30,.53),(.326,.55),(.367,.94),(.335,1.00),
                    (.309,1.00),(.294,.94)), y+.035, .51, 'petrole')
        p.box((.20,y+.11,.77),(.018,.36,.065),'acier')
        p.proxy((.05,y,.45),(.32,.58,.87))
    else:
        profile(p, ((.18,.43),(.61,.43),(.65,.48),(.65,.51),
                    (.59,.55),(.20,.54)), y, .58, 'ivoire')
        profile(p, ((.23,.52),(.60,.52),(.619,.551),(.584,.586),
                    (.26,.575),(.22,.55)), y+.035, .51, 'petrole')
        for yy in (y+.065,y+.515):
            profile(p, ((.10,.45),(.12,.20),(.52,.40),(.52,.45)), yy, .035, 'acier')
        p.proxy((.06,y,.40),(.60,.58,.20))
    p.cylinder((.18,y+.29,.465),.047,.64,'acier','Y')
    p.box((.10,y+.06,.43),(.12,.46,.05),'acier')
    for yy in (y-.015,y+.595):
        p.cylinder((.18,yy,.465),.061,.035,'petrole','Y')
        p.cylinder((.18,yy,.465),.022,.039,'acier','Y',6)


def bench(a, name, at, angle, folded=False):
    p = Piece(name, a.mats, 'deux sièges sur consoles, charnières et barres rondes')
    for y in (.035,.735):
        seat(p,y,folded=folded and y>.7)
    for y in (.10,1.22):
        p.box((0,y-.055,.12),(.10,.11,.74),'acier')
        for z in (.20,.79):
            p.cylinder((.113,y,z),.024,.026,'acier','X',6)
    for y in (-.055,1.405):
        p.box((.30,y-.05,0),(.16,.10,.027),'acier')
        tube(p,(.38,y,.027),(.38,y,2.60))
        p.box((.32,y-.05,2.55),(.12,.10,.06),'acier')
        for z in (.78,1.02):
            tube(p,(.08,y,z),(.38,y,z))
        tube(p,(.38,y,1.02),(.43,y,1.02))
        tube(p,(.43,y,1.02),(.64,y,.93))
        tube(p,(.64,y,.93),(.64,y,.64))
        tube(p,(.64,y,.64),(.26,y,.64))
    install(a,p,at,angle)


def handrails(a,name,y0,y1):
    rails = Piece(name,a.mats,'barres continues sur montants et suspentes de toiture')
    for x in (38.13,40.87):
        tube(rails,(x,y0,FLOOR+2.60),(x,y1,FLOOR+2.60))
        for y in (y0,y1):
            tube(rails,(x,y,FLOOR+2.60),(x,y,FLOOR+3.20),.018)
            rails.box((x-.08,y-.065,FLOOR+3.15),(.16,.13,.10),'acier')
    install(a,rails,(0,0,0))


def build(a):
    for y in (371.2,374):
        bench(a,'n5_fret_sieges_ouest_'+str(y),(37.75,y,FLOOR),0,folded=y==374)
        bench(a,'n5_fret_sieges_est_'+str(y),(41.25,y+1.35,FLOOR),pi)
    handrails(a,'n5_fret_sieges_barres',371.145,375.405)
