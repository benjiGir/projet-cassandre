"""Premier tronçon de maintenance ; construit par C.metro_blockout().

see: docs/4-technique/blockout-metro.md#galeries-de-service
"""
import math

from tools.metro.blockout import layout as P
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


def wheel(p,center,radius=.19):
    x,y,z=center
    vertices=[(x+r*math.cos(t),y+d,z+r*math.sin(t))
              for d in (-.018,.018) for r in (radius,radius-.032)
              for t in (math.tau*i/16 for i in range(16))]
    faces=[]
    for i in range(16):
        j=(i+1)%16
        faces.extend(((i,j,16+j,16+i),(32+i,48+i,48+j,32+j),
                      (i,32+i,32+j,j),(16+i,16+j,48+j,48+i)))
    p.mesh(vertices,faces,'rouge')
    p.cylinder(center,.042,.05,'acier','Y',10)
    for angle in (0,math.tau/3,math.tau*2/3):
        p.beam(center,(x+(radius-.025)*math.cos(angle),y,z+(radius-.025)*math.sin(angle)),.022,'rouge')


def valve_station(p,z):
    x,y=7.8,216.35
    p.cylinder((x,y,z+2.32),.098,.24,'acier','X',12)
    p.cylinder((x,y,z+1.13),.068,2.30,'acier','Z',12)
    for high in (.13,.65,2.17):
        p.cylinder((x,y,z+high),.10,.055,'acier','Z',12)
    for high in (.55,1.95):
        p.box((x-.13,216.46,z+high-.08),(.26,.04,.16),'acier')
        p.beam((x,216.48,z+high),(x,y,z+high),.045,'acier')
    p.cylinder((x,y,z+1.43),.095,.24,'petrole','Z',12)
    p.cylinder((x,216.245,z+1.43),.042,.21,'acier','Y',10)
    wheel(p,(x,216.145,z+1.43))
    p.cylinder((x+.175,y,z+1.88),.028,.35,'acier','X',10)
    p.cylinder((x+.35,216.26,z+1.88),.028,.18,'acier','Y',10)
    p.cylinder((x+.35,216.19,z+1.88),.15,.06,'acier','Y',16)
    p.cylinder((x+.35,216.155,z+1.88),.125,.014,'ivoire','Y',16)
    for i in range(7):
        angle=math.radians(25+130*i/6)
        a=(x+.35+.092*math.cos(angle),216.143,z+1.88+.092*math.sin(angle))
        b=(x+.35+.11*math.cos(angle),216.143,z+1.88+.11*math.sin(angle))
        p.beam(a,b,.009,'nuit')
    p.beam((x+.35,216.133,z+1.88),(x+.292,216.133,z+1.953),.018,'rouge')
    p.cylinder((x,y,z+.035),.13,.06,'acier','Z',12)
    p.box((6.6,216.30,z+.003),(2.4,.19,.018),'nuit')
    for xx in (6.6,8.96):
        p.box((xx,216.30,z+.024),(.04,.19,.012),'acier')
    for i in range(24):
        p.box((6.65+i*.097,216.31,z+.024),(.025,.17,.012),'acier')


def workbench(p,z):
    x,y=18.0,214.015
    p.proxy((x,y,z),(2.1,.38,.92))
    p.box((x,y,z+.85),(2.1,.35,.07),'bois')
    p.box((x,y+.33,z+.84),(2.1,.025,.08),'acier')
    for xx in (x+.13,x+1.84):
        p.box((xx,y+.05,z),(.07,.22,.85),'acier')
        p.box((xx-.035,y+.01,z),(.14,.32,.045),'acier')
        p.beam((xx,y+.29,z+.78),(xx,y+.025,z+.42),.045,'acier')
        p.box((xx-.045,214.002,z+.35),(.16,.035,.49),'acier')
    p.box((x+.15,y+.025,z+.47),(.64,.29,.33),'acier')
    for high in (.49,.65):
        p.box((x+.175,y+.32,z+high),(.59,.018,.135),'petrole')
        p.box((x+.35,y+.341,z+high+.07),(.23,.014,.025),'ivoire')
    p.box((x+.04,y+.025,z+1.14),(2.02,.035,.68),'acier')
    p.box((x+.09,y+.065,z+1.19),(1.92,.016,.58),'ivoire')
    for xx in (x+.18,x+1.87):
        for high in (1.24,1.71):
            p.cylinder((xx,214.104,z+high),.019,.012,'nuit','Y',8)
    for offset,length in ((.3,.30),(.72,.39),(1.19,.27)):
        xx=x+offset
        p.beam((xx,214.145,z+1.31),(xx,214.145,z+1.31+length),.035,'acier')
        for sign in (-1,1):
            p.beam((xx,214.145,z+1.31+length),(xx+sign*.045,214.145,z+1.36+length),.028,'acier')
        p.beam((xx,214.035,z+1.57),(xx,214.145,z+1.57),.024,'acier')
    p.box((x+.18,y+.05,z+.93),(.56,.23,.035),'rouge')
    for xx in (x+.18,x+.705):
        p.box((xx,y+.05,z+.965),(.035,.23,.12),'rouge')
    for yy in (y+.05,y+.245):
        p.box((x+.215,yy,z+.965),(.49,.035,.12),'rouge')
    p.box((x+.215,y+.085,z+.966),(.49,.16,.016),'nuit')
    for xx in (x+.28,x+.62):
        p.beam((xx,y+.14,z+1.01),(xx,y+.14,z+1.16),.028,'acier')
    p.beam((x+.28,y+.14,z+1.16),(x+.62,y+.14,z+1.16),.035,'acier')
    p.box((x+1.48,y+.09,z+.932),(.37,.21,.016),'ivoire')
    p.box((x+1.58,y+.06,z+.95),(.19,.16,.012),'ivoire')
    for xx in (x+.65,x+1.25):
        p.beam((xx,214.10,z+1.76),(xx,214.10,z+1.99),.035,'acier')
        p.beam((xx,214.10,z+1.99),(xx,214.24,z+1.99),.035,'acier')
    p.box((x+.5,214.13,z+1.95),(.9,.15,.09),'acier')
    p.box((x+.56,214.16,z+1.933),(.78,.09,.017),'lampe')
    p.beam((x+.95,214.03,z+1.82),(x+.95,214.03,z+2.15),.025,'acier')
    p.beam((x+.95,214.03,z+2.15),(17,214.03,z+2.15),.025,'acier')
    p.beam((17,214.03,z+2.15),(17,214.03,z+1.73),.025,'acier')


def build(a):
    z=P.galerie_z(8,215.25)
    p=Piece('n5_premiere_galerie_entretien',a.mats,'réseau raccordé, vanne, manomètre, établi mural et outils ; allée 2,10 m')
    valve_station(p,z)
    workbench(p,z)
    for y in (214.008,216.468):
        p.box((1.8,y,z+.015),(22.2,.024,.18),'ardoise')
    install(a,p,(0,0,0))
    a.point('n5_premiere_galerie_etabli',(18.95,214.48,z+1.86),'#dfceb5',4,4.4)
