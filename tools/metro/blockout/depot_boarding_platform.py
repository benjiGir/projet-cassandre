"""Marches, garde-corps et marquise ancrés au quai de service.

see: docs/assets/tunnels-references.md#appuis-du-quai-de-service--9-octobre
"""
from tools.metro.blockout.rail_architecture import track
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


FLOOR = -18
DECK = -17.25
POST_X = 34.87


def tube(p,a,b,radius=.025,material='atelier_metal'):
    from mathutils import Vector
    a,b=Vector(a),Vector(b)
    obj=p.cylinder((0,0,0),radius,(b-a).length,material,sides=10)
    rotation=(b-a).to_track_quat('Z','Y').to_matrix()
    for vertex in obj.data.vertices:
        vertex.co=rotation @ vertex.co+(a+b)/2


def foot(p,y,z,width=.20):
    p.box((POST_X-width/2,y-width/2,z),(width,width,.025),'atelier_metal')
    for dx in (-.065,.065):
        for dy in (-.065,.065):
            p.cylinder((POST_X+dx,y+dy,z+.034),.014,.018,'acier',sides=6)


def stairs(p):
    for y in (364,365,366):
        z=FLOOR+(y-363)*.25
        p.box((34.78,y+.02,z+.002),(2.90,.94,.010),'acier')
        p.box((34.78,y+.02,z+.012),(2.90,.08,.006),'ivoire')
        for yy in (y+.30,y+.56,y+.82):
            p.box((34.82,yy,z+.013),(2.82,.012,.005),'nuit')
    lower=(POST_X,363.65,FLOOR+1.08)
    upper=(POST_X,366.25,DECK+1.08)
    for y,z in ((363.65,FLOOR),(365.30,-17.50)):
        foot(p,y,z)
        top=lower[2]+(y-lower[1])/(upper[1]-lower[1])*(upper[2]-lower[2])
        tube(p,(POST_X,y,z+.025),(POST_X,y,top),.021)
    tube(p,lower,upper,.027)
    tube(p,(POST_X,363.65,FLOOR+.53),(POST_X,366.25,DECK+.53),.019)
    for y,z,length in ((363.55,FLOOR,.45),(364,-17.75,1),(365,-17.50,1)):
        p.proxy((34.75,y,z),(.23,length,1.30))


def guard(p):
    p.box((34.75,366,DECK),(.12,4,.12),'acier')
    for y in (366.25,369.75):
        foot(p,y,DECK)
        p.beam((POST_X,y,DECK+.025),(POST_X,y,-13.68),.085,'acier')
    foot(p,368,DECK,.18)
    tube(p,(POST_X,368,DECK+.025),(POST_X,368,DECK+1.08),.021)
    for z,radius in ((DECK+1.08,.027),(DECK+.53,.019)):
        tube(p,(POST_X,366.25,z),(POST_X,369.75,z),radius)
        tube(p,(POST_X,369.75,z),(37.30,369.75,z),radius)
    for x in (36.1,37.3):
        p.box((x-.08,369.67,DECK),(.16,.16,.025),'atelier_metal')
        tube(p,(x,369.75,DECK+.025),(x,369.75,DECK+1.08),.021)
    p.box((34.75,369.70,DECK),(2.63,.1,.12),'acier')
    p.proxy((34.75,366,DECK),(.23,4,1.45))
    p.proxy((34.75,369.70,DECK),(3,.15,1.45))
    p.box((37.35,366,DECK+.003),(.14,4,.010),'ambre')
    for x in (34.96,37.16):
        p.box((x,366,DECK+.002),(.025,3.65,.009),'atelier_metal')


def canopy(p):
    p.box((34.75,366,-13.70),(2.65,4.10,.08),'acier')
    for x in (34.78,37.32):
        p.box((x,366,-13.78),(.08,4.1,.15),'acier')
    for y in (366.25,368,369.75):
        p.box((34.82,y-.045,-13.79),(2.55,.09,.12),'atelier_metal')
    for y in (366.25,369.75):
        p.box((POST_X-.06,y-.055,-14.50),(.12,.11,.22),'atelier_metal')
        p.beam((POST_X,y,-14.40),(35.78,y,-13.73),.055,'acier')
        for z in (-14.45,-14.34):
            p.cylinder((POST_X,y-.067,z),.018,.025,'acier','Y',8)
    for x in (35.15,35.65,36.15,36.65):
        p.box((x,366,-13.62),(.025,4.1,.025),'acier')
    p.box((35.85,367,-13.98),(.18,2,.10),'acier')
    p.box((35.88,367.10,-14.005),(.12,1.8,.025),'lampe')
    for y in (367.3,368.7):
        tube(p,(35.94,y,-13.88),(35.94,y,-13.69),.015,'acier')
    tube(p,(35.94,367.3,-13.87),(POST_X,367.3,-13.72),.015,'acier')
    tube(p,(POST_X,367.3,-13.72),(POST_X,366.25,-13.72),.015,'acier')
    p.box((POST_X-.05,366.17,-14.14),(.10,.16,.18),'acier')
    tube(p,(POST_X,366.25,-13.72),(POST_X,366.25,-13.96),.015,'acier')


def frontage(p):
    p.box((32.5,365.8,FLOOR),(2.25,.2,6.25),'beton')
    p.box((37.55,365.8,-13.4),(8.7,.2,1.9),'beton')
    p.box((32.9,365.65,FLOOR+2.8),(1.4,.15,.2),'acier')
    p.box((33.02,365.62,FLOOR+2.84),(1.16,.025,.1),'lampe')


def build(a):
    p=Piece('n5_depot_embarquement',a.mats,'quai ouvert, appuis au sol, main courante et marquise sur consoles')
    stairs(p)
    guard(p)
    canopy(p)
    install(a,p,(0,0,0))
    rails=Piece('n5_depot_rails_fret',a.mats,'raccord de la voie A au garage du fret')
    track(rails,[(39.25,346,FLOOR),(39.5,366,FLOOR)])
    install(a,rails,(0,0,0))
    front=Piece('n5_depot_front_quai',a.mats,'front ouvert vers les marches et la rame')
    frontage(front)
    install(a,front,(0,0,0))
    a.point('n5_depot_quai',(35.5,368,-14.15),'#dfbf83',10,10)
    a.point('n5_depot_marches',(33.6,365.3,FLOOR+2.85),'#dfbf83',8,11)
