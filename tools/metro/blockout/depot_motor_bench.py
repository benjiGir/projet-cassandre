"""Inspection d'un moteur déposé au fond de l'atelier oriental.

see: docs/assets/tunnels-references.md#poste-dinspection-du-moteur--9-octobre
"""
import math

from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


AT = (56,365,-18)


def table(p):
    p.proxy((0,-.05,0),(4,.95,.94))
    p.box((0,0,.86),(4,.8,.08),'bois')
    p.box((0,-.025,.83),(4,.035,.11),'acier')
    for x in (.12,3.78):
        for y in (.08,.66):
            p.box((x,y,0),(.075,.075,.86),'acier')
            p.box((x-.035,y-.035,0),(.145,.145,.04),'acier')
        p.beam((x+.037,.117,.22),(x+.037,.697,.76),.04,'acier')
    p.box((.24,.13,.28),(3.52,.54,.05),'acier')
    p.box((.3,.16,.33),(.88,.44,.28),'atelier_bleu')
    p.box((.34,.125,.53),(.8,.035,.055),'atelier_metal')
    p.box((2.78,.20,.33),(.60,.37,.21),'bois')


def motor(p):
    p.proxy((.86,.08,.94),(1.48,.69,.68))
    p.box((1.05,.10,.94),(1.3,.62,.06),'atelier_metal')
    for x in (1.30,1.99):
        p.box((x,.14,1.0),(.15,.53,.10),'atelier_bleu')
        for y in (.19,.62):
            p.cylinder((x+.075,y,1.015),.028,.025,'acier',sides=8)
    p.cylinder((1.70,.41,1.31),.26,.88,'atelier_bleu','X',16)
    for x in (1.23,2.17):
        p.cylinder((x,.41,1.31),.285,.10,'atelier_bleu','X',16)
    for i in range(10):
        angle=math.tau*i/10
        y,z=.41+.276*math.cos(angle),1.31+.276*math.sin(angle)
        p.beam((1.30,y,z),(2.10,y,z),.035,'atelier_bleu')
    p.cylinder((1.16,.41,1.31),.115,.08,'atelier_metal','X',12)
    p.cylinder((1.03,.41,1.31),.055,.30,'atelier_metal','X',12)
    p.box((.93,.387,1.356),(.14,.046,.017),'acier')
    p.cylinder((2.25,.41,1.31),.26,.08,'acier','X',16)
    p.cylinder((2.295,.41,1.31),.20,.012,'nuit','X',16)
    for y in (.28,.37,.46,.55):
        length=2*math.sqrt(.20**2-(y-.41)**2)
        p.box((2.304,y-.014,1.31-length/2),(.012,.028,length),'atelier_metal')
    p.box((1.57,.31,1.555),(.26,.22,.09),'atelier_bleu')
    p.box((1.60,.29,1.58),(.20,.025,.045),'armoire_ivoire')


def comparator(p):
    p.box((.83,.06,.94),(.30,.23,.06),'rouge')
    p.cylinder((1.015,.25,1.25),.025,.50,'atelier_metal',sides=10)
    p.box((.975,.20,1.44),(.08,.10,.06),'acier')
    p.beam((1.015,.25,1.47),(1.10,.41,1.47),.025,'atelier_metal')
    p.cylinder((1.10,.41,1.419),.012,.108,'atelier_metal',sides=8)
    p.cylinder((1.015,.245,1.55),.095,.055,'acier','Y',16)
    p.cylinder((1.015,.211,1.55),.078,.012,'armoire_ivoire','Y',16)
    p.beam((1.015,.201,1.55),(.987,.201,1.60),.012,'rouge')
    for dx,dz in ((0,.062),(-.062,0),(.062,0),(0,-.062)):
        p.box((1.01+dx,.199,1.545+dz),(.012,.008,.012),'acier')


def ring(p,center,outer,inner,depth,material='atelier_metal'):
    x,y,z=center
    vertices=[(x+r*math.cos(i*math.tau/12),y+r*math.sin(i*math.tau/12),zz)
              for zz,r in ((z-depth/2,outer),(z-depth/2,inner),
                           (z+depth/2,outer),(z+depth/2,inner)) for i in range(12)]
    faces=[]
    for i in range(12):
        j=(i+1)%12
        faces.extend(((i,j,j+24,i+24),(i+12,i+36,j+36,j+12),
                      (i+24,j+24,j+36,i+36),(i,i+12,j+12,j)))
    p.mesh(vertices,faces,material)


def parts(p):
    p.box((2.7,.12,.94),(1,.46,.025),'rouge')
    p.box((2.735,.155,.965),(.93,.39,.014),'nuit')
    for x in (2.7,3.665):
        p.box((x,.12,.965),(.035,.46,.085),'rouge')
    for y in (.12,.545):
        p.box((2.735,y,.965),(.93,.035,.085),'rouge')
    ring(p,(2.93,.34,1.01),.105,.05,.062)
    ring(p,(3.30,.35,1.00),.09,.045,.042)
    p.beam((3.42,.26,.996),(3.55,.44,.996),.026,'atelier_metal')
    p.box((.18,.24,.942),(.39,.32,.012),'armoire_ivoire')
    p.box((.31,.53,.96),(.13,.035,.015),'acier')
    for y in (.32,.40,.47):
        p.box((.24,y,.957),(.23,.018,.004),'petrole')


def rack(p):
    p.proxy((4.3,.12,0),(1.2,.83,2.08))
    for x in (4.3,5.43):
        for y in (.15,.88):
            p.box((x,y,0),(.065,.065,2.08),'acier')
    for z in (.08,.75,1.5,2.03):
        p.box((4.3,.15,z),(1.2,.795,.05),'acier')
    p.beam((4.33,.915,.14),(5.46,.915,2.03),.035,'acier')
    p.beam((5.46,.915,.14),(4.33,.915,2.03),.035,'acier')
    for x,z,width in ((4.39,.13,.75),(4.86,1.55,.49)):
        p.box((x,.22,z),(width,.58,.18),'atelier_bleu')
        p.box((x+.05,.20,z+.055),(width-.1,.025,.075),'armoire_ivoire')
    ring(p,(4.59,.45,.835),.18,.095,.07)
    p.box((4.98,.38,.80),(.26,.26,.13),'bois')
    for x in (4.33,5.46):
        p.beam((x,.92,1.82),(x,1,1.82),.035,'acier')


def task_light(p):
    p.box((.58,.045,2.25),(2.8,.25,.10),'acier')
    p.box((.67,.08,2.234),(2.62,.18,.016),'lampe')
    for x in (.85,3.1):
        p.box((x-.055,.955,2.09),(.11,.045,.30),'acier')
        p.beam((x,.975,2.325),(x,.17,2.325),.045,'acier')
    p.beam((1.98,.17,2.35),(1.98,.975,2.35),.035,'acier')
    p.beam((1.98,.975,2.35),(4.90,.975,2.35),.035,'acier')
    for x in (2.15,3.30,4.35):
        p.beam((x,.975,2.35),(x,1,2.35),.025,'acier')
    p.box((4.8,.86,2.25),(.2,.14,.2),'acier')
    p.box((4.825,.84,2.275),(.15,.02,.15),'armoire_ivoire')
    p.beam((4.9,.975,2.45),(4.9,.975,2.65),.035,'acier')
    p.beam((4.9,.975,2.65),(4.9,1,2.65),.035,'acier')


def build(a):
    p=Piece('n5_depot_moteur',a.mats,'moteur déposé, comparateur et pièces rangées au mur nord')
    table(p)
    motor(p)
    comparator(p)
    parts(p)
    rack(p)
    task_light(p)
    install(a,p,AT)
    a.point('n5_depot_moteur',(58,365.05,-15.94),'#dfceb5',5,5)
