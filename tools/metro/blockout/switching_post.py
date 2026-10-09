"""Accès et pupitre du poste de manœuvre local.

see: docs/4-technique/blockout-metro.md#poste-daiguillage
"""
import math

from tools.metro.blockout import layout as P
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install
from tools.metro.blockout.control_panels import create as control_panel


BX,BY,_=P.B_POINTS[-1]
FLOOR=-16


def access(a):
    p=Piece('n5_poste_acces',a.mats,'passage encadré, huit marches et mains courantes')
    x=BX-.22
    for lo,hi in ((BY-2,BY-1.4),(BY+1.4,BY+2)):
        p.box((x,lo,-18),(.22,hi-lo,4),'beton',True)
    p.box((x,BY-1.4,-15.2),(.22,2.8,1.2),'beton',True)
    for y in (BY-1.4,BY+1.25):
        p.box((x+.01,y,-18),(.27,.15,2.8),'acier')
    p.box((x+.01,BY-1.4,-15.3),(.27,2.8,.15),'acier')
    p.box((x+.24,BY-.6,-15.02),(.035,1.2,.25),'petrole')
    a.letters('POSTE',(x+.28,BY,-14.97),.17,angle=math.pi/2)
    p.box((BX-1.95,BY+1.87,-17.95),(1.7,.09,2.7),'petrole')
    for xx in (BX-1.88,BX-.32):
        p.box((xx,BY+1.83,-17.83),(.045,.06,2.42),'acier')
    for i in range(8):
        xx=BX-2-(i+1)*.5
        z=-18+(i+1)*.25
        p.box((xx,BY-2,z-.25),(.5,4,.25),'beton')
        p.box((xx+.42,BY-1.85,z+.005),(.08,3.7,.015),'ivoire')
    for y in (BY-1.86,BY+1.86):
        p.beam((BX-2.12,y,-16.94),(BX-5.88,y,-15.06),.06,'acier')
        for i in range(4):
            xx=BX-2.5-i
            z=-18+(BX-2-xx)*.5
            p.beam((xx,y,z+.08),(xx,y,z+1.0),.045,'acier')
    p.box((BX-1.55,BY+1.84,-15.4),(.8,.16,.2),'acier')
    p.box((BX-1.49,BY+1.80,-15.365),(.68,.035,.12),'lampe')
    a.point('n5_poste_lobby',(BX-1.15,BY+1.65,-15.32),'#d4c6a7',6,9)
    for xx,y,z in ((BX-5.3,BY+1.95,-13.6),):
        p.box((xx-.45,y,z),(.9,.15,.2),'acier')
        p.box((xx-.36,y-.04,z+.035),(.72,.035,.12),'lampe')
        a.point('n5_poste_acces_'+str(xx),(xx,y-.3,z+.08),'#d4c6a7',6,9)
    install(a,p,(0,0,0))


def console(a):
    p=Piece('n5_poste_pupitre',a.mats,'pupitre incliné, tableau optique et commande intégrée')
    left=BX-14
    y=BY+2.1
    p.box((left+.12,y+.12,FLOOR),(5.76,1.18,.92),'petrole')
    p.proxy((left,y,FLOOR),(6,1.55,1.4))
    vertices=[(x,yy,FLOOR+z) for x in (left,left+6)
              for yy,z in ((y,.92),(y+1.55,1.38),(y+1.55,1.55),(y,1.09))]
    p.mesh(vertices,[(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)],'acier')
    for xx in (left+.55,left+2.45):
        p.box((xx,y+.8,FLOOR+1.36),(1.45,.65,.72),'petrole')
        p.box((xx+.1,y+.755,FLOOR+1.46),(1.25,.05,.49),'nuit')
        for j in range(3):
            p.box((xx+.2,y+.723,FLOOR+1.55+j*.1),(.85-j*.17,.025,.025),'petrole')
        p.box((xx+.1,y+.18,FLOOR+1.16),(1.1,.38,.06),'ivoire')
        for j in range(7):
            p.box((xx+.15+j*.14,y+.22,FLOOR+1.225),(.09,.25,.025),'acier')
    for i in range(4):
        xx=left+4.55+i*.3
        p.box((xx,y+.7,FLOOR+1.38),(.15,.16,.055),'ambre' if i==0 else 'ivoire')
    # Diagramme original simplifié : deux voies et une liaison de service.
    p.box((left-.25,BY+4.78,FLOOR+1.65),(6.5,.2,1.65),'acier')
    p.box((left-.13,BY+4.745,FLOOR+1.77),(6.26,.04,1.41),'nuit')
    for height in (2.12,2.68):
        p.beam((left+.25,BY+4.68,FLOOR+height),(left+5.75,BY+4.68,FLOOR+height),.045,'ivoire')
    for x0,z0,x1,z1 in ((1.2,2.12,2.3,2.68),(3.5,2.68,4.6,2.12)):
        p.beam((left+x0,BY+4.68,FLOOR+z0),(left+x1,BY+4.68,FLOOR+z1),.045,'ambre')
    for i in range(6):
        p.box((left+.5+i,BY+4.61,FLOOR+2.64),(.075,.04,.075),'petrole')
        p.box((left+.65+i*.9,BY+4.61,FLOOR+2.08),(.075,.04,.075),'ambre')
    p.text('A',(left+.1,BY+4.61,FLOOR+2.6),.16,'ivoire')
    p.text('B',(left+.1,BY+4.61,FLOOR+2.04),.16,'ivoire')
    p.beam((left+5.9,y+1.3,FLOOR+.4),(left+5.9,BY+4.72,FLOOR+.4),.07,'acier')
    p.beam((left+5.9,BY+4.72,FLOOR+.4),(left+5.9,BY+4.72,FLOOR+1.65),.07,'acier')
    install(a,p,(0,0,0))
    at=(left+5.12,y-.035,FLOOR+1.19)
    control_panel(a,'use_n5_aiguillage',at,label='AIGUILLAGE',variant='switch')


def furnishings(a):
    p=Piece('n5_poste_mobilier',a.mats,'armoires de relais et bureau de maintenance en bordure')
    for xx in (BX-15.4,BX-14.15):
        p.box((xx,BY-4.85,FLOOR),(1.05,.65,2.2),'acier',True)
        p.box((xx+.06,BY-4.18,FLOOR+.1),(.93,.035,2),'petrole')
        p.box((xx+.78,BY-4.135,FLOOR+.98),(.04,.04,.22),'ivoire')
        for i in range(5):
            p.box((xx+.15,BY-4.145,FLOOR+.25+i*.08),(.55,.025,.025),'acier')
    p.box((BX-15.2,BY-.6,FLOOR+.78),(.9,2.2,.12),'bois',True)
    for yy in (BY-.48,BY+1.38):
        p.box((BX-15.08,yy,FLOOR),(.55,.12,.78),'acier',True)
    p.box((BX-15.05,BY-.28,FLOOR+.91),(.52,.65,.025),'ivoire')
    for i in range(3):
        p.box((BX-15.04,BY+.8+i*.15,FLOOR+.91),(.55,.09,.23),'petrole')
    p.box((BX-13.2,BY+1.1,FLOOR+.43),(.6,.6,.12),'petrole',True)
    p.box((BX-13.2,BY+1.64,FLOOR+.48),(.6,.1,.65),'petrole')
    for xx in (BX-13.13,BX-12.75):
        for yy in (BY+1.17,BY+1.55):
            p.box((xx,yy,FLOOR),(.06,.06,.43),'acier')
    for xx in (BX-12,BX-8):
        p.box((xx-.85,BY-.2,FLOOR+3.5),(1.7,.2,.17),'acier')
        p.box((xx-.73,BY-.17,FLOOR+3.465),(1.46,.14,.035),'lampe')
        for yy in (BY-.15,BY-.05):
            p.beam((xx,yy,FLOOR+3.67),(xx,yy,FLOOR+4),.035,'acier')
        a.point('n5_poste_cabine_'+str(xx),(xx,BY-.1,FLOOR+3.25),'#d4c6a7',10,12)
    install(a,p,(0,0,0))


def build(a):
    access(a)
    console(a)
    furnishings(a)
