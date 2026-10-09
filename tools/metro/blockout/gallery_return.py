"""Seconde pente et débouché des galeries dans le tunnel A.

see: docs/4-technique/blockout-metro.md#galeries-de-service
"""
import math

from tools.metro.blockout import layout as P
from tools.metro.blockout.gallery_distribution import plinth, tube
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


def handrail(p):
    points=[(64.8,y,P.galerie_z(64.8,y)+1.03) for y in (272,273,299,303.95)]
    z=P.galerie_z(64.8,304.2)
    points += [(64.55+.25*math.cos(math.pi*i/12),303.95+.25*math.sin(math.pi*i/12),z+1.03)
               for i in range(1,7)]
    points.append((61.8,304.2,z+1.03))
    for a,b in zip(points,points[1:]):
        tube(p,a,b,.027)
    tube(p,points[0],(64.985,272,points[0][2]),.027)
    tube(p,points[-1],(61.8,304.485,z+1.03),.027)
    for y in (272.4,276.5,281,285.5,290,294.5,298.5,302.8):
        zz=P.galerie_z(64.8,y)
        p.box((64.958,y-.065,zz+.875),(.035,.13,.17),'acier')
        tube(p,(64.975,y,zz+.96),(64.8,y,zz+.96),.018,'acier')
        tube(p,(64.8,y,zz+.96),(64.8,y,zz+1.03),.018,'acier')
    for x in (62.1,64.1):
        p.box((x-.065,304.458,z+.875),(.13,.035,.17),'acier')
        tube(p,(x,304.475,z+.96),(x,304.2,z+.96),.018,'acier')
        tube(p,(x,304.2,z+.96),(x,304.2,z+1.03),.018,'acier')


def portal(p,z):
    for y in (301.96,304.38):
        p.box((41.5,y,z),(.22,.16,2.84),'acier')
        p.box((41.722,y+.035,z+.18),(.016,.09,2.58),'armoire_ivoire')
        p.box((41.725,y+.035,z+.02),(.025,.09,.15),'ambre')
    p.beam((41.61,302,z+2.89),(41.61,304.5,z+2.89),.2,'acier')
    p.box((41.722,302.06,z+2.84),(.016,2.38,.09),'armoire_ivoire')
    p.box((41.84,302.15,z+.004),(.32,2.2,.006),'petrole')


def junction_box(p,z):
    x,y=56.5,304.48
    p.proxy((x,y-.22,z+1),(1,.22,.83))
    p.box((x,y-.20,z+1),(1,.20,.83),'acier')
    p.box((x+.035,y-.225,z+1.04),(.93,.025,.75),'armoire_ivoire')
    for high in (1.13,1.65):
        p.cylinder((x+.045,y-.238,z+high),.023,.09,'acier','Z',10)
    p.box((x+.84,y-.26,z+1.31),(.035,.035,.16),'acier')
    p.box((x+.12,y-.26,z+1.44),(.30,.02,.13),'acier')
    p.box((x+.15,y-.283,z+1.47),(.24,.008,.065),'nuit')
    for i in range(4):
        p.box((x+.18,y-.286,z+1.10+i*.045),(.56,.026,.018),'acier')
    for xx in (x+.17,x+.83):
        for high in (1.02,1.77):
            p.box((xx-.06,304.465,z+high-.055),(.12,.045,.11),'acier')
    p.beam((57,304.38,z+1.83),(57,304.38,z+2.81),.06,'acier')
    p.beam((57,304.38,z+2.81),(57,302.15,z+2.81),.06,'acier')
    for yy in (302.4,303.4,304.2):
        p.beam((57,yy,z+2.84),(57,yy,z+3.015),.025,'acier')
    for high in (2.02,2.55):
        p.beam((57,304.38,z+high),(57,304.50,z+high),.025,'acier')


def build(a):
    p=Piece('n5_galerie_retour',a.mats,'main courante continue dans le coude, plinthes, coffret raccordé et cadre clair au débouché')
    handrail(p)
    z=P.galerie_z(57,303.25)
    portal(p,z)
    junction_box(p,z)
    for x in (62.508,64.968):
        for y0,y1 in ((271.03,273),(273,299),(299,302 if x<64 else 304.492)):
            plinth(p,x,x+.024,y0,y1)
    plinth(p,41.76,62.508,302.008,302.032)
    plinth(p,41.76,64.968,304.468,304.492)
    install(a,p,(0,0,0))
