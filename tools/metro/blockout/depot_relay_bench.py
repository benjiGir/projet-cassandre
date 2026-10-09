"""Maintenance électrique hors du coude VB, sur un établi autonome.

see: docs/assets/tunnels-references.md#maintenance-électrique-du-passage-ouest--9-octobre
"""
import math

from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


AT = (25.4,356.4,-18)
ANGLE = -math.pi/2


def table(p):
    p.proxy((0,-.05,0),(4,1.03,.94))
    p.box((0,0,.86),(4,.8,.08),'bois')
    p.box((0,-.025,.83),(4,.035,.11),'acier')
    for x in (.12,3.78):
        for y in (.08,.90):
            height=2.45 if y==.90 else .86
            p.box((x,y,0),(.075,.075,height),'acier')
            p.box((x-.035,y-.035,0),(.145,.145,.04),'acier')
        p.beam((x+.037,.117,.20),(x+.037,.937,.78),.04,'acier')
    p.box((.12,.90,2.38),(3.735,.075,.075),'acier')
    p.box((.15,.885,1.02),(3.7,.045,.70),'armoire_ivoire')
    p.box((.24,.13,.28),(3.52,.54,.05),'acier')
    p.box((.3,.17,.33),(.9,.42,.27),'atelier_bleu')
    p.box((.35,.14,.53),(.8,.035,.055),'atelier_metal')
    for x in (2.4,2.82):
        p.box((x,.22,.33),(.34,.33,.19),'bois')


def meter(p):
    vertices=[(x,y,z) for x in (.15,.84)
              for y,z in ((.08,.94),(.08,1.19),(.55,1.39),(.55,.94))]
    p.mesh(vertices,[(0,3,2,1),(4,5,6,7),(0,4,7,3),
                     (1,2,6,5),(0,1,5,4),(3,7,6,2)],'atelier_bleu')
    p.cylinder((.43,.070,1.085),.105,.022,'acier','Y',16)
    p.cylinder((.43,.054,1.085),.088,.012,'armoire_ivoire','Y',16)
    p.beam((.43,.045,1.085),(.393,.045,1.133),.012,'rouge')
    for dx,dz in ((-.065,0),(-.043,.043),(0,.065),(.043,.043),(.065,0)):
        p.box((.425+dx,.041,1.08+dz),(.012,.008,.012),'acier')
    p.cylinder((.71,.053,1.08),.043,.032,'acier','Y',12)
    p.beam((.695,.034,1.064),(.724,.034,1.096),.012,'armoire_ivoire')
    for x,color in ((.27,'rouge'),(.50,'nuit')):
        p.cylinder((x,.051,.99),.025,.032,color,'Y',10)
    p.proxy((.15,.04,.94),(.69,.51,.45))


def relay(p):
    p.box((1.10,.22,.94),(.95,.47,.04),'atelier_bleu')
    p.box((1.22,.37,.98),(.34,.18,.04),'nuit')
    p.cylinder((1.38,.46,1.105),.105,.30,'relais_cuivre','X',16)
    p.cylinder((1.3775,.46,1.105),.04,.385,'atelier_metal','X',12)
    for x in (1.205,1.555):
        p.cylinder((x,.46,1.105),.115,.025,'nuit','X',12)
    p.box((1.10,.39,.98),(.095,.14,.27),'atelier_metal')
    p.cylinder((1.1475,.46,1.245),.026,.18,'acier','Y',10)
    p.beam((1.1475,.46,1.245),(1.67,.46,1.24),.035,'atelier_metal')
    p.beam((1.67,.46,1.24),(1.77,.46,1.18),.025,'atelier_metal')
    p.beam((1.77,.32,1.18),(1.77,.60,1.18),.025,'acier')
    p.box((1.72,.26,.98),(.33,.38,.04),'nuit')
    for y in (.32,.46,.60):
        for x in (1.83,1.98):
            p.box((x-.025,y-.025,1.02),(.05,.05,.08),'relais_cuivre')
            p.cylinder((x,y,1.108),.025,.016,'atelier_metal',sides=8)
        p.beam((1.77,y,1.18),(1.90,y,1.13),.02,'relais_cuivre')
    p.beam((1.15,.46,1.315),(1.32,.46,1.255),.012,'acier')
    p.beam((1.15,.46,1.255),(1.15,.46,1.315),.012,'acier')
    for x in (1.28,1.60):
        p.box((x-.035,.23,.98),(.07,.08,.05),'nuit')
        p.cylinder((x,.27,1.035),.025,.02,'relais_cuivre',sides=8)
        p.beam((x,.30,1.02),(x,.39,1.06),.012,'relais_cuivre')
    p.proxy((1.10,.22,.94),(.95,.47,.39))


def leads(p):
    paths=(('rouge',((.27,.035,.99),(.27,.02,.957),(.42,.15,.957),
                     (.82,.19,.957),(1.02,.20,.957),(1.28,.27,1.045))),
           ('nuit',((.50,.035,.99),(.55,.02,.957),(.71,.10,.957),
                    (1.08,.11,.957),(1.42,.17,.957),(1.60,.27,1.045))))
    for color,points in paths:
        for a,b in zip(points,points[1:]):
            p.beam(a,b,.023,color)


def parts(p):
    p.box((2.35,.20,.94),(.77,.45,.025),'atelier_bleu')
    for x in (2.35,3.095):
        p.box((x,.20,.965),(.025,.45,.16),'atelier_bleu')
    for y in (.20,.625):
        p.box((2.375,y,.965),(.72,.025,.16),'atelier_bleu')
    p.box((2.39,.24,.966),(.69,.36,.012),'nuit')
    p.box((2.52,.175,1.00),(.31,.025,.06),'armoire_ivoire')
    p.box((3.38,.17,.94),(.46,.43,.012),'nuit')
    p.beam((3.45,.24,.963),(3.75,.30,.963),.022,'atelier_metal')
    p.beam((3.45,.24,.972),(3.56,.262,.972),.04,'rouge')
    for sign in (-1,1):
        p.beam((3.45,.45+sign*.05,.963),(3.65,.45,.963),.022,'rouge')
        p.beam((3.65,.45,.962),(3.74,.45+sign*.025,.962),.02,'atelier_metal')


def cabinet(p):
    p.proxy((4.25,.19,0),(1.10,.80,2.2))
    for x in (4.32,5.20):
        for y in (.28,.83):
            p.box((x,y,0),(.085,.085,.10),'acier')
    p.box((4.25,.22,.10),(1.10,.77,2.06),'acier')
    p.box((4.28,.192,.16),(1.04,.028,1.94),'armoire_ivoire')
    p.box((4.22,.19,2.16),(1.16,.83,.04),'acier')
    for z in (.35,1.80):
        p.cylinder((4.32,.173,z),.021,.10,'acier','Z',10)
    p.box((5.15,.158,.97),(.035,.035,.23),'acier')
    for z in (.42,.50,.58):
        p.box((4.50,.158,z),(.61,.015,.025),'acier')
    p.box((4.72,.157,1.60),(.26,.015,.14),'atelier_bleu')
    p.box((4.755,.145,1.64),(.19,.012,.03),'armoire_ivoire')


def task_light(p):
    p.box((.60,.04,2.25),(2.8,.25,.10),'acier')
    p.box((.69,.075,2.234),(2.62,.18,.016),'lampe')
    for x in (.72,3.23):
        p.beam((x,.9375,2.40),(x,.17,2.325),.045,'acier')
    p.beam((2,.17,2.35),(2,.9225,2.40),.035,'acier')
    p.beam((2,.9225,2.40),(3.8175,.9225,2.40),.035,'acier')
    p.beam((3.8175,.9225,2.40),(3.8175,.9225,2.05),.035,'acier')
    p.box((3.725,.83,1.83),(.18,.10,.22),'acier')
    p.box((3.747,.81,1.855),(.136,.02,.17),'armoire_ivoire')
    p.beam((3.8175,.9225,1.83),(3.8175,.9225,.20),.023,'nuit')
    p.beam((3.8175,.9225,.20),(4.30,.9225,.20),.023,'nuit')


def build(a):
    copper=a.mats['armoire_ivoire'].copy()
    copper.name='metro_relais_cuivre'
    copper.diffuse_color=(.47,.25,.11,1)
    copper.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=copper.diffuse_color
    a.mats['relais_cuivre']=copper
    p=Piece('n5_depot_relais',a.mats,'établi autonome de maintenance électrique hors rails VB')
    table(p)
    meter(p)
    relay(p)
    leads(p)
    parts(p)
    cabinet(p)
    task_light(p)
    install(a,p,AT,ANGLE)
    a.point('n5_depot_relais',(25.45,354.4,-15.94),'#dfceb5',5,5)
