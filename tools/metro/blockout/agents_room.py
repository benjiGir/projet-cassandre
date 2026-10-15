"""Vestiaire des agents et seuil de son accès latéral.

see: docs/4-technique/blockout-metro.md#galeries-de-service
"""
import math
from mathutils import Matrix, Vector

from tools.metro.blockout.gallery_distribution import tube
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install

Z=-15.55


def prepare_materials(a):
    paint=a.mats['petrole'].copy()
    paint.name='metro_agents_peinture_ivoire'
    paint.diffuse_color=a.mats['ivoire'].diffuse_color
    paint.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=paint.diffuse_color
    a.mats['agents_ivoire']=paint


def open_leaf(p,at):
    objects=[p.box((0,-.015,0),(.63,.03,1.79),'petrole'),
             p.box((.48,-.047,.75),(.09,.032,.17),'acier')]
    for base in (.16,1.30):
        for j in range(3):
            objects.append(p.box((.14,-.045,base+j*.06),(.37,.026,.019),'nuit'))
    objects.append(p.box((.17,-.040,1.60),(.28,.025,.075),'acier'))
    rotation=Matrix.Rotation(math.radians(310),3,'Z')
    for obj in objects:
        for vertex in obj.data.vertices:
            vertex.co=rotation @ vertex.co+Vector(at)


def lockers(p):
    y=263.48
    for i,x in enumerate((77.2,78,78.8,79.6)):
        p.proxy((x,y,Z),(.70,.64,2.05))
        for xx in (x+.06,x+.59):
            for yy in (y+.08,y+.52):
                p.box((xx,yy,Z),(.045,.045,.14),'acier')
        p.box((x,y,Z+.14),(.70,.62,.035),'acier')
        p.box((x,y+.59,Z+.175),(.70,.035,1.84),'agents_ivoire')
        for xx in (x,x+.665):
            p.box((xx,y,Z+.175),(.035,.62,1.84),'acier')
        p.box((x,y,Z+2.015),(.70,.62,.035),'acier')
        if i==3:
            p.box((x+.035,y+.02,Z+1.77),(.63,.57,.025),'agents_ivoire')
            tube(p,(x+.04,y+.37,Z+1.66),(x+.66,y+.37,Z+1.66),.017,'acier')
            open_leaf(p,(x+.685,y,Z+.18))
            p.proxy((x+.66,y-.50,Z+.18),(.45,.52,1.79))
            for high in (.36,1.79):
                p.cylinder((x+.685,y,Z+high),.028,.12,'acier','Z',10)
            xx,yy=x+.35,y+.36
            shape=[(-.18,1.04),(.18,1.04),(.21,1.57),(.09,1.64),
                   (0,1.54),(-.09,1.64),(-.21,1.57)]
            vertices=[(xx+dx,yy+d,Z+high) for d in (-.035,.035) for dx,high in shape]
            faces=[tuple(range(7)),tuple(range(7,14))]
            faces += [(j,(j+1)%7,(j+1)%7+7,j+7) for j in range(7)]
            p.mesh(vertices,faces,'ambre')
            p.box((xx-.18,yy-.048,Z+1.18),(.36,.013,.045),'agents_ivoire')
            for offset in (-.14,.08):
                p.box((xx+offset,y+.13,Z+.18),(.11,.28,.065),'nuit')
            helmet(p,(xx,y+.32,Z+1.805))
        else:
            p.box((x+.035,y-.025,Z+.18),(.63,.025,1.79),'petrole')
            p.box((x+.47,y-.048,Z+.93),(.09,.032,.17),'acier')
            p.cylinder((x+.515,y-.075,Z+1.015),.024,.025,'agents_ivoire','Y',8)
            p.box((x+.19,y-.05,Z+1.78),(.28,.025,.075),'acier')
            p.box((x+.205,y-.076,Z+1.795),(.25,.006,.043),'agents_ivoire')
            for base in (.34,1.48):
                for j in range(3):
                    p.box((x+.16,y-.055,Z+base+j*.06),(.37,.026,.019),'nuit')


def helmet(p,at):
    x,y,z=at
    vertices=[]
    for radius,high in ((.15,0),(.145,.055),(.105,.13),(.025,.16)):
        vertices += [(x+radius*math.cos(math.tau*i/10),
                      y+radius*.85*math.sin(math.tau*i/10),z+high) for i in range(10)]
    faces=[(j+i,j+(i+1)%10,j+(i+1)%10+10,j+i+10) for j in (0,10,20) for i in range(10)]
    faces.append(tuple(range(30,40)))
    p.mesh(vertices,faces,'ambre')
    p.box((x-.17,y-.18,z),(.34,.08,.025),'ambre')


def bench(p):
    x,y=77.2,261.7
    p.proxy((x,y,Z),(2.7,.45,.48))
    for yy in (y,y+.155,y+.31):
        p.box((x,yy,Z+.435),(2.7,.135,.045),'bois')
    for xx in (x+.22,x+2.43):
        for yy in (y+.04,y+.37):
            p.box((xx,yy,Z+.015),(.045,.045,.405),'acier')
        p.box((xx-.06,y+.015,Z),(.165,.415,.025),'acier')
        p.box((xx,y+.02,Z+.4),(.045,.41,.035),'acier')
    p.beam((x+.24,y+.225,Z+.18),(x+2.45,y+.225,Z+.18),.035,'acier')
    for yy in (y+.10,y+.30):
        p.box((x+.2,yy,Z+.115),(2.3,.025,.025),'acier')
    p.box((x+.42,y+.05,Z+.482),(.34,.28,.035),'petrole')
    p.box((x+.46,y+.08,Z+.517),(.26,.23,.025),'petrole')


def washbasin(p):
    x,y=82.9,258.66
    outer=[(.48,0),(.48,.30),(0,.30),(-.48,.30),(-.48,0),(-.48,-.30),(0,-.30),(.48,-.30)]
    inner=[(.29*math.cos(math.tau*i/8),.21*math.sin(math.tau*i/8)) for i in range(8)]
    vertices=[(x+dx,y+dy,Z+.96) for dx,dy in outer+inner]
    p.mesh(vertices,[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)],'agents_ivoire')
    vertices=[(x+dx,y+dy,Z+.96) for dx,dy in inner]
    vertices += [(x+dx*.65,y+dy*.65,Z+.76) for dx,dy in inner]
    p.mesh(vertices,[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]+[tuple(range(8,16))],'acier')
    p.cylinder((x,y,Z+.764),.038,.008,'nuit','Z',12)
    for origin,size in (((x-.48,y+.28,Z+.75),(.96,.02,.21)),
                        ((x-.48,y-.30,Z+.75),(.96,.025,.21)),
                        ((x-.48,y-.275,Z+.75),(.025,.55,.21)),
                        ((x+.455,y-.275,Z+.75),(.025,.55,.21))):
        p.box(origin,size,'agents_ivoire')
    p.box((x-.48,258.275,Z+.96),(.96,.03,.47),'agents_ivoire')
    p.box((x-.48,258.295,Z+.945),(.96,.065,.015),'agents_ivoire')
    p.proxy((x-.48,y-.30,Z+.71),(.96,.60,.25))
    for xx in (x-.33,x+.33):
        p.box((xx-.055,258.26,Z+.54),(.11,.05,.28),'acier')
        p.beam((xx,258.285,Z+.55),(xx,258.9,Z+.75),.04,'acier')
    tube(p,(x,258.4,Z+.97),(x,258.4,Z+1.19),.025,'agents_ivoire')
    tube(p,(x,258.4,Z+1.19),(x,258.68,Z+1.19),.025,'agents_ivoire')
    tube(p,(x,258.68,Z+1.19),(x,258.68,Z+1.13),.025,'agents_ivoire')
    p.box((x-.055,258.36,Z+1.205),(.11,.12,.025),'acier')
    tube(p,(x,y,Z+.75),(x,y,Z+.45),.029,'acier')
    tube(p,(x,y,Z+.45),(x,258.28,Z+.45),.029,'acier')
    p.cylinder((x,258.295,Z+.45),.065,.04,'acier','Y',12)
    p.box((83.65,258.29,Z+1.14),(.20,.14,.29),'agents_ivoire')
    p.box((83.67,258.435,Z+1.23),(.16,.025,.08),'petrole')
    p.box((83.715,258.40,Z+1.10),(.07,.045,.04),'nuit')


def entry(p):
    for y in (260,262.38):
        p.box((75.95,y,Z),(.15,.12,2.5),'acier')
    p.box((75.95,260,Z+2.5),(.15,2.5,.12),'acier')
    p.box((75.98,260,Z+2.62),(.16,2.5,.88),'beton',True)
    for y in (258.81,262.48):
        p.box((76.13,y,Z),(.07,1.21,2.45),'petrole')
        p.box((76.205,y+.05,Z+.80),(.022,1.10,.20),'acier')
        p.box((76.23,y+.44,Z+1.02),(.028,.20,.23),'agents_ivoire')
    p.box((72.9,262.385,Z+2.13),(1,.13,.18),'acier')
    p.box((73.01,262.34,Z+2.17),(.78,.045,.08),'lampe')
    for x in (73.02,73.77):
        p.beam((x,262.50,Z+2.19),(x,262.39,Z+2.19),.035,'acier')
    p.beam((73.4,262.475,Z+2.31),(73.4,262.475,Z+2.81),.025,'acier')
    p.beam((73.4,262.475,Z+2.81),(70.8,262.475,Z+2.81),.025,'acier')
    p.beam((70.8,262.475,Z+2.81),(70.8,261.25,Z+2.81),.025,'acier')
    p.beam((70.8,261.25,Z+2.81),(68.65,261.25,Z+2.81),.025,'acier')
    for x in (69.2,70.6):
        p.beam((x,261.25,Z+2.82),(x,261.25,Z+3.015),.02,'acier')


def build(a):
    prepare_materials(a)
    p=Piece('n5_local_agents',a.mats,'quatre casiers dont un ouvert, banc ajouré, lavabo creux et accès libre')
    lockers(p)
    bench(p)
    washbasin(p)
    entry(p)
    for x,y,sx,sy in ((76.008,258.30,.025,1.65),(76.008,262.65,.025,1.58),
                      (83.968,258.30,.024,5.9),(76.04,258.258,7.9,.024),
                      (76.04,264.218,7.9,.024)):
        p.box((x,y,Z+.015),(sx,sy,.18),'ardoise')
    p.box((79,260.8,Z+3.08),(2,.18,.12),'acier')
    p.box((79.12,260.77,Z+3.055),(1.76,.24,.025),'lampe')
    for x in (79.14,80.86):
        p.beam((x,260.89,Z+3.19),(x,260.89,Z+3.515),.025,'acier')
    install(a,p,(0,0,0))
    a.point('n5_local_agents_plafond',(80,261,Z+2.8),'#d4c6a7',12,10)
    a.point('n5_local_agents_acces',(73.4,262.18,Z+2.2),'#d4c6a7',4,6)
