"""Pupitre de service, commande et cadre de l'afficheur du voyage.

see: docs/assets/tunnels-references.md#pupitre-de-la-dernière-voiture--9-octobre
"""
from math import cos, pi, sin

from tools.metro.blockout.control_panels import create as control_panel
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


FLOOR = -17.25


def slab(p,x0,x1,y0,y1,z0,z1,thickness,material):
    vertices=[(x,y,FLOOR+z+dz) for x in (x0,x1)
              for y,z in ((y0,z0),(y1,z1)) for dz in (0,thickness)]
    p.mesh(vertices,[(0,1,3,2),(4,6,7,5),(0,4,5,1),
                     (2,3,7,6),(0,2,6,4),(1,5,7,3)],material)


def cabinet(p):
    p.box((38.84,426.14,FLOOR),(1.32,1.05,.13),'acier')
    vertices=[(x,y,FLOOR+z) for x in (38.89,40.11)
              for y,z in ((426.20,.13),(427.16,.13),(427.16,1.47),(426.20,1.34))]
    p.mesh(vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),
                     (3,7,6,2),(0,4,7,3),(1,2,6,5)],'petrole')
    slab(p,38.75,40.25,426.12,427.22,1.30,1.46,.11,'acier')
    p.box((38.84,426.185,FLOOR+.66),(1.32,.04,.67),'acier')
    p.box((39.05,426.18,FLOOR+.22),(.90,.03,.30),'nuit')
    for z in (.25,.29,.33,.37,.41,.45):
        p.box((39.075,426.169,FLOOR+z),(.85,.012,.013),'acier')
    for x in (38.93,40.04):
        for z in (.17,.60,1.27):
            p.cylinder((x,426.174,FLOOR+z),.016,.018,'ivoire','Y',6)
    p.proxy((38.75,425.80,FLOOR),(1.50,1.42,1.57))
    p.beam((39.5,427.16,FLOOR+.30),(39.5,427.505,FLOOR+.30),.045,'acier')


def gauge(p):
    x,y,z=38.975,426.147,FLOOR+1.02
    p.cylinder((x,y+.025,z),.113,.065,'acier','Y',24)
    p.cylinder((x,y-.011,z),.092,.015,'ivoire','Y',24)
    for i in range(7):
        angle=(-135+i*45)*pi/180
        a=(x+.074*sin(angle),y-.022,z+.074*cos(angle))
        b=(x+.060*sin(angle),y-.022,z+.060*cos(angle))
        p.beam(a,b,.008,'nuit')
    p.beam((x,y-.029,z),(x-.047,y-.029,z+.040),.012,'rouge')
    p.cylinder((x,y-.03,z),.015,.014,'nuit','Y',10)


def monitor(p):
    p.box((38.85,426.13,FLOOR+1.70),(1.30,.17,.50),'petrole')
    for x in (38.85,40.105):
        p.box((x,426.058,FLOOR+1.70),(.045,.085,.50),'acier')
    for z in (1.70,2.140):
        p.box((38.895,426.058,FLOOR+z),(1.21,.085,.060),'acier')
    for x in (38.99,40.01):
        p.beam((x,426.30,FLOOR+1.36),(x,426.30,FLOOR+1.74),.05,'acier')
        p.box((x-.06,426.24,FLOOR+1.365),(.12,.12,.06),'acier')
    p.beam((39.9,426.28,FLOOR+1.79),(39.9,426.28,FLOOR+1.365),.024,'nuit')


def lever(p):
    p.cylinder((40.04,426.56,FLOOR+1.49),.09,.06,'petrole',sides=16)
    p.beam((40.04,426.56,FLOOR+1.51),(40.04,426.40,FLOOR+1.70),.035,'acier')
    p.cylinder((40.04,426.40,FLOOR+1.70),.045,.14,'nuit','X',12)
    for y in (426.64,426.79,426.94):
        z=1.41+(y-426.12)/1.10*.16
        p.cylinder((39.07,y,FLOOR+z+.014),.032,.028,'petrole',sides=12)


def build(a):
    p=Piece('n5_fret_pupitre_depart',a.mats,'caisson profilé, plateau incliné, cadran et afficheur encadré')
    cabinet(p)
    gauge(p)
    monitor(p)
    lever(p)
    install(a,p,(0,0,0))
    control_panel(a,'use_n5_depart',(39.5,426.04,FLOOR+1.01),label='DEPART',variant='start')
