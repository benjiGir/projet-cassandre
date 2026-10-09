"""Ventilation, fosse protégée et poste force du local N5.

see: docs/4-technique/blockout-metro.md#machinerie
"""
import math

from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install
from tools.metro.blockout.control_panels import create as control_panel


FLOOR=-22


def annulus(p,y0,y1,outer,inner,material):
    vertices=[]
    for y,r in ((y0,outer),(y1,outer),(y0,inner),(y1,inner)):
        vertices.extend((103.5+r*math.cos(i*math.tau/32),y,FLOOR+r*math.sin(i*math.tau/32)) for i in range(32))
    faces=[]
    for i in range(32):
        j=(i+1)%32
        faces.extend(((i,j,32+j,32+i),(64+i,96+i,96+j,64+j),
                      (i,64+i,64+j,j),(32+i,32+j,96+j,96+i)))
    obj=p.mesh(vertices,faces,material)
    for poly in obj.data.polygons:
        if poly.index%4<2: poly.use_smooth=True


def enclosure(a):
    p=Piece('n5_machinerie_fosse',a.mats,'plafond continu, cuvelage et garde-corps ajourés')
    p.box((97.5,334,-17),(12,16,.2),'beton')
    for origin,size in (((97.3,334,-26),(.2,16,4)),((109.5,334,-26),(.2,16,4)),
                        ((97.5,333.8,-26),(12,.2,4)),((97.5,350,-26),(12,.2,4))):
        p.box(origin,size,'beton',True)
    for start,end in (((97.5,334),(109.5,334)),((109.5,334),(109.5,350)),
                      ((109.5,350),(97.5,350)),((97.5,350),(97.5,334))):
        x0,y0=start; x1,y1=end
        p.proxy((min(x0,x1)-.08,min(y0,y1)-.08,FLOOR),
                (max(.16,abs(x1-x0)+.16),max(.16,abs(y1-y0)+.16),1.5))
        for h in (.15,.72,1.45):
            p.beam((x0,y0,FLOOR+h),(x1,y1,FLOOR+h),.075,'acier' if h!=1.45 else 'ambre')
        count=math.ceil(math.dist(start,end)/2.6)
        for i in range(count+1):
            x=x0+(x1-x0)*i/count; y=y0+(y1-y0)*i/count
            p.box((x-.045,y-.045,FLOOR),(.09,.09,1.5),'acier')
            p.box((x-.13,y-.13,FLOOR),(.26,.26,.07),'acier')
    for y in (331,353):
        p.box((87.5,y-.12,-17.3),(32,.24,.3),'beton')
    install(a,p,(0,0,0))


def ventilation(a):
    p=Piece('n5_machinerie_ventilation',a.mats,'ventilateur axial sur socles et gaine verticale raccordée au plafond')
    annulus(p,338.5,342.5,3.2,2.95,'petrole')
    for y in (338.35,338.65,342.35):
        annulus(p,y,y+.15,3.32,2.95,'acier')
    p.cylinder((103.5,339.35,FLOOR),.65,1.6,'acier','Y',24)
    p.cylinder((103.5,338.43,FLOOR),.44,.2,'ivoire','Y',20)
    for i in range(7):
        theta=i*math.tau/7
        shape=[(.55,theta-.12),(.9,theta+.48),(2.72,theta+.31),(2.86,theta-.05)]
        vertices=[(103.5+r*math.cos(t),y,FLOOR+r*math.sin(t)) for y in (338.92,339.05) for r,t in shape]
        p.mesh(vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'ivoire')
    for i in range(8):
        t=i*math.tau/8
        p.beam((103.5+.5*math.cos(t),338.22,FLOOR+.5*math.sin(t)),
               (103.5+2.94*math.cos(t),338.22,FLOOR+2.94*math.sin(t)),.045,'acier')
    annulus(p,338.2,338.24,1.75,1.72,'acier')
    for x in (100.7,105.7):
        p.box((x,338.7,-26),(.6,3.2,.85),'beton')
        p.box((x+.1,338.9,-25.15),(.4,2.8,1.4),'acier')
    # Transition fermée de la section circulaire vers la gaine rectangulaire.
    vertices=[]
    for y in (342.5,345.2):
        for i in range(32):
            t=i*math.tau/32
            scale=3.2 if y==342.5 else 2.7/max(abs(math.cos(t)),abs(math.sin(t)))
            vertices.append((103.5+scale*math.cos(t),y,FLOOR+scale*math.sin(t)))
    p.mesh(vertices,[(i,(i+1)%32,(i+1)%32+32,i+32) for i in range(32)]+[tuple(range(32,64))],'acier')
    p.box((100.8,345.2,-24.7),(5.4,3.2,7.7),'acier')
    for z in (-22.8,-19.6,-17.25):
        p.box((100.72,345.12,z),(5.56,3.36,.12),'petrole')
    a.point('n5_machinerie_ventilateur',(103.5,336.5,-19.4),'#d4b58a',14,15)
    p.box((102.6,335.9,-18.1),(1.8,.24,.15),'acier')
    p.box((102.74,335.94,-18.135),(1.52,.16,.035),'lampe')
    for x in (102.8,104.2): p.beam((x,336,-17.95),(x,336,-17),.04,'acier')
    install(a,p,(0,0,0))


def force(a):
    p=Piece('n5_machinerie_force',a.mats,'alignement d’armoires électriques et commande sur la façade')
    for i in range(5):
        x=110.8+i*1.35
        p.box((x,356.8,FLOOR),(1.25,1.15,2.65),'acier',True)
        p.box((x+.065,356.755,FLOOR+.14),(1.12,.045,2.37),'petrole')
        p.box((x+.94,356.7,FLOOR+.95),(.06,.04,.3),'ivoire')
        p.box((x+.2,356.7,FLOOR+1.82),(.55,.03,.36),'nuit')
        for j in range(4):
            p.box((x+.2,356.7,FLOOR+.35+j*.085),(.7,.025,.025),'acier')
    p.box((110.8,357.8,FLOOR+2.65),(6.65,.18,.28),'acier')
    p.box((117.25,357.8,FLOOR+2.93),(.2,.18,2.07),'acier')
    p.box((110.8,357.8,-17.2),(6.65,.2,.2),'acier')
    at=(115,356.65,FLOOR+1.3)
    p.box((at[0]-.27,at[1]-.02,at[2]-.35),(.54,.025,.7),'acier')
    install(a,p,(0,0,0))
    control_panel(a,'use_n5_courant',at,label='COURANT',variant='power')


def fixtures(a):
    p=Piece('n5_machinerie_equipements',a.mats,'pompes d’exhaure, conduites ancrées et appliques de circulation')
    for y in (339,344):
        p.box((88, y,FLOOR),(1.8,2,.2),'beton',True)
        p.cylinder((88.9,y+.65,FLOOR+.6),.45,.9,'petrole','Z',16)
        p.cylinder((88.9,y+1.4,FLOOR+.7),.36,.8,'acier','Y',16)
        p.box((88.55,y+1.05,FLOOR+.1),(.7,.6,.35),'acier')
        p.cylinder((88.9,y+.65,FLOOR+2.35),.12,2.6,'acier')
        p.cylinder((88.18,y+.65,FLOOR+3.6),.12,1.65,'acier','X')
        p.box((87.51,y+.45,FLOOR+3.43),(.15,.4,.34),'acier')
        p.proxy((88,y,FLOOR),(1.8,2,1.1))
    for x,y,side in ((93,326.04,1),(115,326.04,1)):
        p.box((x-.75,y,-18.2),(1.5,.16,.22),'acier')
        yy=y+.165 if side==1 else y-.025
        p.box((x-.63,yy,-18.155),(1.26,.035,.13),'lampe')
        a.point(f'n5_machinerie_applique_{x}_{y}',(x,y+side*.5,-18.2),'#d4b58a',12,14)
    for x in (93,115):
        p.box((x-.75,355.4,-18.2),(1.5,.24,.15),'acier')
        p.box((x-.63,355.44,-18.235),(1.26,.16,.035),'lampe')
        for xx in (x-.55,x+.55): p.beam((xx,355.52,-18.05),(xx,355.52,-17),.04,'acier')
        a.point(f'n5_machinerie_nord_{x}',(x,355.25,-18.35),'#d4b58a',14,14)
    for y in (328,352):
        for x in (77,84):
            z=-18-(x-71.5)/4
            p.box((x-.45,y+.04,z+2.6),(.9,.14,.2),'acier')
            p.box((x-.36,y+.185,z+2.64),(.72,.035,.12),'lampe')
            a.point(f'n5_machinerie_rampe_{x}_{y}',(x,y+.45,z+2.68),'#d4b58a',6,9)
        for yy in (y+.14,y+3.86):
            p.beam((71.6,yy,-17.05),(87.4,yy,-21),.055,'acier')
            for x in (72,76,80,84,87):
                z=-18-(x-71.5)/4
                p.beam((x,yy,z+.1),(x,yy,z+.95),.045,'acier')
    install(a,p,(0,0,0))


def maintenance_room(a):
    p=Piece('n5_machinerie_local_entretien',a.mats,'local de maintenance, établi, pièces et réseaux fixés')
    for y in (342,344.35):
        p.box((124.44,y,FLOOR),(.18,.15,2.7),'acier')
    p.box((124.44,342,FLOOR+2.55),(.18,2.5,.15),'acier')
    p.box((124.5,342,FLOOR+.012),(.24,2.5,.018),'acier')
    p.box((131.45,341,FLOOR+.85),(.9,3.8,.12),'acier',True)
    for y in (341.15,344.4):
        p.box((131.57,y,FLOOR),(.65,.22,.85),'acier',True)
    p.box((132.29,341,FLOOR+.97),(.14,3.8,1.2),'petrole')
    for i in range(7):
        y=341.25+i*.48
        p.beam((132.25,y,FLOOR+1.35),(132.25,y+.15,FLOOR+1.75),.05,'acier')
    p.box((131.7,343.5,FLOOR+.97),(.4,.3,.22),'acier')
    p.cylinder((131.78,343.63,FLOOR+1.22),.09,.24,'ivoire','Z',12)
    for z in (.5,1.25,2):
        p.box((126.5,345.3,FLOOR+z),(3.2,.55,.09),'acier')
        for x in (126.57,129.48):
            p.box((x,345.72,FLOOR),(.07,.07,2.6),'acier')
        for i in range(3):
            p.box((126.8+i*.92,345.4,FLOOR+z+.09),(.68,.35,.45),'bois' if z<1.5 else 'petrole')
    p.proxy((126.5,345.3,FLOOR),(3.2,.55,2.6))
    p.box((127.2,340.04,FLOOR),(1.4,.58,2.2),'acier',True)
    p.box((127.28,340.625,FLOOR+.12),(1.24,.035,1.95),'petrole')
    p.box((128.2,340.67,FLOOR+.95),(.06,.04,.26),'ivoire')
    for start,end in (((119.6,344.34,FLOOR+2.75),(124.7,344.34,FLOOR+2.75)),
                      ((124.7,344.34,FLOOR+2.75),(124.7,345.84,FLOOR+2.75)),
                      ((124.7,345.84,FLOOR+2.75),(132.35,345.84,FLOOR+2.75))):
        p.beam(start,end,.08,'acier')
    for x in (120,122,124):
        p.beam((x,344.34,FLOOR+2.75),(x,344.48,FLOOR+2.75),.045,'acier')
    for x in (125,128,131):
        p.beam((x,345.84,FLOOR+2.75),(x,345.98,FLOOR+2.75),.045,'acier')
    for x in (121,128):
        y=343.2
        p.box((x-.65,y-.1,FLOOR+3.15),(1.3,.2,.14),'acier')
        p.box((x-.54,y-.075,FLOOR+3.115),(1.08,.15,.035),'lampe')
        for xx in (x-.45,x+.45):
            p.beam((xx,y,FLOOR+3.29),(xx,y,FLOOR+3.5),.035,'acier')
        a.point('n5_local_entretien_'+str(x),(x,y,FLOOR+2.95),'#d4b58a',7,9)
    install(a,p,(0,0,0))


def build(a):
    enclosure(a)
    ventilation(a)
    force(a)
    fixtures(a)
    maintenance_room(a)
