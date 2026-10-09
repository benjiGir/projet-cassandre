"""Poste d'ajustage contre la paroi orientale du dépôt.

see: docs/4-technique/blockout-metro.md#dépôt
"""
import math

from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


AT = (70.6, 336.3, -18)
ANGLE = -math.pi / 2


def table(p):
    p.proxy((0,-.05,0), (4,.92,.94))
    p.box((0,0,.86), (4,.8,.08), 'bois')
    p.box((0,-.025,.83), (4,.035,.11), 'acier')
    for x in (.12,3.76):
        for y in (.08,.65):
            p.box((x,y,0), (.075,.075,.86), 'acier')
            p.box((x-.035,y-.035,0), (.145,.145,.04), 'acier')
        p.beam((x+.037,.117,.20), (x+.037,.687,.76), .04, 'acier')
    p.box((.25,.12,.27), (3.5,.55,.055), 'acier')
    p.box((.25,.1,.50), (.95,.57,.30), 'acier')
    for z in (.52,.665):
        p.box((.275,.07,z), (.90,.04,.12), 'atelier_bleu')
        p.box((.58,.04,z+.046), (.29,.035,.025), 'armoire_ivoire')
    p.box((1.55,.20,.325), (.75,.40,.30), 'atelier_bleu')
    p.box((1.60,.17,.52), (.65,.035,.06), 'acier')
    p.box((2.78,.22,.325), (.56,.32,.20), 'bois')


def vice(p):
    x = .46
    p.proxy((x-.055,-.14,.94), (.53,.51,.34))
    p.cylinder((x+.18,.25,.968), .19,.055,'acier',sides=12)
    p.box((x+.04,.04,.985), (.28,.34,.11),'atelier_bleu')
    p.box((x+.015,-.08,1.06), (.33,.38,.13),'atelier_bleu')
    for y in (-.02,.22):
        p.box((x-.055,y,1.10), (.47,.07,.15),'atelier_bleu')
        p.box((x-.055,y+.015,1.245), (.47,.055,.035),'atelier_metal')
    p.cylinder((x+.18,-.14,1.115), .035,.22,'acier','Y',10)
    p.cylinder((x+.18,-.25,1.115), .052,.055,'acier','Y',10)
    p.cylinder((x+.18,-.28,1.115), .017,.37,'acier','Z',10)
    for z in (.93,1.30):
        p.cylinder((x+.18,-.28,z), .031,.035,'acier',sides=10)
    section = ((-.085,0),(.085,0),(.085,.035),(.028,.035),(.028,.16),
               (.065,.16),(.065,.21),(-.065,.21),(-.065,.16),(-.028,.16),
               (-.028,.035),(-.085,.035))
    verts = [(xx, .135+yy, 1.18+zz) for xx in (.37,1.17) for yy,zz in section]
    n = len(section)
    faces = [tuple(reversed(range(n))), tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    p.mesh(verts, faces, 'atelier_metal')


def spanner(p,x,z,length):
    p.beam((x,.72,z), (x,.72,z+length), .035,'acier')
    for sign in (-1,1):
        p.beam((x,.72,z+length), (x+sign*.065,.72,z+length+.045), .03,'acier')
        p.beam((x+sign*.065,.72,z+length+.045), (x+sign*.065,.72,z+length+.095), .03,'acier')
    p.cylinder((x,.72,z-.018), .043,.025,'acier','Y',10)
    p.cylinder((x,.704,z-.018), .021,.009,'nuit','Y',10)
    p.beam((x,.87,z+length-.065), (x,.72,z+length-.065), .025,'acier')


def tool_board(p):
    p.box((.03,.79,1.12), (3.94,.06,.91),'acier')
    p.box((.08,.765,1.17), (3.84,.025,.81),'armoire_ivoire')
    for x in (.16,3.84):
        for z in (1.22,1.93):
            p.beam((x,.81,z), (x,.93,z), .045,'acier')
            p.cylinder((x,.745,z), .021,.014,'acier','Y',8)
    for x,z,length in ((.48,1.34,.37),(1.04,1.34,.46),(1.61,1.42,.24)):
        spanner(p,x,z,length)
    p.beam((2.2,.72,1.28),(2.2,.72,1.76),.045,'bois')
    p.box((2.06,.675,1.74),(.32,.09,.12),'acier')
    p.beam((2.2,.87,1.65),(2.2,.72,1.65),.025,'acier')
    for sign in (-1,1):
        p.beam((2.90+sign*.07,.70,1.35),(2.90,.70,1.65),.033,'rouge')
        p.beam((2.90,.70,1.65),(2.90+sign*.055,.70,1.76),.028,'acier')
    p.cylinder((2.90,.683,1.65),.031,.025,'acier','Y',10)
    p.beam((2.9,.87,1.66),(2.9,.70,1.66),.025,'acier')
    p.box((3.30,.75,1.26),(.035,.035,.46),'acier')
    p.box((3.22,.735,1.71),(.20,.055,.06),'rouge')


def tray(p):
    x,y,z=2.80,.16,.94
    p.box((x,y,z),(.8,.38,.025),'rouge')
    for xx in (x,x+.765):
        p.box((xx,y,z+.025),(.035,.38,.10),'rouge')
    for yy in (y,y+.345):
        p.box((x+.035,yy,z+.025),(.73,.035,.10),'rouge')
    p.box((x+.05,y+.05,z+.027),(.70,.28,.012),'nuit')
    for xx in (x+.18,x+.48):
        p.cylinder((xx,y+.18,z+.065),.05,.08,'acier',sides=6)
    p.beam((x+.24,y+.28,z+.07),(x+.62,y+.20,z+.07),.035,'acier')
    p.box((1.66,.24,.942),(.65,.34,.012),'armoire_ivoire')
    p.box((1.85,.28,.957),(.32,.18,.012),'armoire_ivoire')


def cabinet(p):
    x,y=-1.35,.08
    p.proxy((x,y,0),(1,.76,2.20))
    p.box((x,y,.10),(1,.74,2.10),'acier')
    for xx in (x+.06,x+.76):
        p.box((xx,y+.06,0),(.18,.61,.10),'acier')
    for xx in (x+.035,x+.515):
        p.box((xx,y-.027,.16),(.45,.04,1.97),'atelier_bleu')
        for z in (.33,1.91):
            p.cylinder((xx+.026,y-.045,z),.021,.10,'acier',sides=10)
        for z in (1.67,1.74,1.81):
            p.box((xx+.07,y-.034,z),(.31,.015,.025),'nuit')
    for xx in (x+.435,x+.525):
        p.box((xx,y-.065,1.03),(.026,.038,.20),'armoire_ivoire')
    p.box((x+.25,y-.035,1.39),(.50,.015,.13),'armoire_ivoire')


def task_light(p):
    p.box((.75,.04,2.17),(2.5,.26,.11),'acier')
    p.box((.84,.075,2.154),(2.32,.19,.016),'lampe')
    for x in (1,3):
        p.box((x-.055,.88,1.99),(.11,.045,.30),'acier')
        p.beam((x,.9,2.25),(x,.17,2.25),.045,'acier')
    p.beam((2,.17,2.28),(2,.89,2.28),.035,'acier')
    p.beam((2,.89,2.28),(2,.89,2.45),.035,'acier')
    p.beam((2,.89,2.45),(-.85,.89,2.45),.035,'acier')
    for x in (-.35,.7,1.7):
        p.beam((x,.89,2.45),(x,.94,2.45),.03,'acier')
    p.box((-.95,.81,2.35),(.20,.12,.20),'acier')
    p.box((-.93,.79,2.37),(.16,.02,.16),'armoire_ivoire')
    p.beam((-.85,.89,2.55),(-.85,.94,2.55),.035,'acier')


def build(a):
    paint=a.mats['armoire_ivoire'].copy()
    paint.name='metro_atelier_bleu'
    paint.diffuse_color=(.12,.21,.26,1)
    paint.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=paint.diffuse_color
    a.mats['atelier_bleu']=paint
    metal=a.mats['armoire_ivoire'].copy()
    metal.name='metro_atelier_metal_usine'
    metal.diffuse_color=(.45,.48,.46,1)
    metal.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=metal.diffuse_color
    a.mats['atelier_metal']=metal
    p=Piece('n5_depot_ajustage',a.mats,'étau avec rail, panneau outils, rangement et éclairage mural ; accès machinerie libre')
    table(p)
    vice(p)
    tool_board(p)
    tray(p)
    cabinet(p)
    task_light(p)
    install(a,p,AT,ANGLE)
    a.point('n5_depot_ajustage',(70.55,334.3,-15.9),'#dfceb5',5,5)
