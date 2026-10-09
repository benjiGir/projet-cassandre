"""Bogie assemblé et châssis déposé dans l'atelier oriental.

see: docs/assets/tunnels-references.md#révision-des-bogies--9-octobre
"""
import math

from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


FLOOR = -18
AXLES = (.65, 2.55)
WHEELS = (.78, 2.22)


def wheel(p, x, y, inner):
    profile = ((-.08,.11),(-.08,.27),(-.055,.355),(-.055,.38),
               (.065,.38),(.065,.405),(.085,.405),(.085,.11))
    vertices = [(x+inner*dx, y+radius*math.cos(i*math.tau/16),
                 .43+radius*math.sin(i*math.tau/16))
                for dx,radius in profile for i in range(16)]
    for material,sections in (('bogie_web',(0,1,6)),('bogie_metal',(2,3,4,5))):
        faces = [(j*16+i,j*16+(i+1)%16,(j+1)*16+(i+1)%16,(j+1)*16+i)
                 for j in sections for i in range(16)]
        p.mesh(vertices, faces, material)
    p.cylinder((x,y,.43),.115,.20,'acier','X',12)


def wheelset(p, y, chocks=True):
    p.cylinder((1.5,y,.43),.065,2.36,'bogie_metal','X',12)
    for x,inner in ((WHEELS[0],1),(WHEELS[1],-1)):
        wheel(p,x,y,inner)
        if chocks:
            p.box((x-.058,y-.43,0),(.116,.86,.05),'bois')
            for sign in (-1,1):
                p.mesh([(x-.065,y+sign*.25,.05),(x+.065,y+sign*.25,.05),
                        (x-.065,y+sign*.43,.05),(x+.065,y+sign*.43,.05),
                        (x-.065,y+sign*.25,.17),(x+.065,y+sign*.25,.17)],
                       [(0,2,3,1),(0,1,5,4),(2,4,5,3),(0,4,2),(1,3,5)],'bois')


def frame(p, lift=0):
    for x in (.32,2.44):
        p.box((x,.20,.78+lift),(.24,2.8,.24),'bogie_bleu')
        for y0,y1 in ((.05,.20),(3,3.15)):
            p.beam((x+.12,y0,.87+lift),(x+.12,y1,.90+lift),.20,'bogie_bleu')
    for y in (1.18,1.78):
        p.box((.56,y,.72+lift),(1.88,.24,.20),'bogie_bleu')
    for y in (.2,2.9):
        p.box((.56,y,.88+lift),(1.88,.1,.12),'bogie_bleu')
    p.box((1,1.35,.92+lift),(1,.5,.10),'bogie_bleu')
    p.cylinder((1.5,1.6,1.05+lift),.33,.10,'bogie_metal',sides=16)
    p.cylinder((1.5,1.6,1.11+lift),.12,.04,'acier',sides=12)
    for x in (.44,2.56):
        for y in (1.25,1.9):
            p.cylinder((x,y,1.03+lift),.035,.025,'bogie_metal',sides=8)


def assembled(p):
    p.proxy((.2,.05,0),(2.6,3.1,1.25))
    frame(p)
    for y in AXLES:
        wheelset(p,y)
        p.box((.56,y+.37,.86),(1.88,.065,.065),'bogie_bleu')
        for x in (.44,2.56):
            p.box((x-.12,y-.14,.30),(.24,.28,.26),'bogie_bleu')
            p.cylinder((x,y,.43),.09,.28,'bogie_metal','X',12)
            p.cylinder((x,y,.67),.045,.22,'bogie_metal',sides=10)
            for z in (.59,.645,.70,.755):
                p.cylinder((x,y,z),.105,.045,'acier',sides=12)
            p.box((x-.14,y-.15,.77),(.28,.30,.035),'bogie_metal')
        for x in WHEELS:
            p.box((x-.07,y+.36,.32),(.14,.11,.23),'acier')
            p.beam((x,y+.40,.55),(x,y+.40,.88),.045,'bogie_bleu')
    for x in (.44,2.56):
        p.cylinder((x,1.6,1.03125),.18,.0225,'bogie_metal',sides=12)
        p.cylinder((x,1.6,1.115),.13,.145,'nuit',sides=12)
        for z in (1.065,1.115,1.165):
            p.cylinder((x,1.6,z),.16,.045,'nuit',sides=12)
        p.cylinder((x,1.6,1.205),.18,.035,'bogie_metal',sides=12)
    p.cylinder((1.5,1.9,.50),.16,.65,'bogie_bleu','X',12)
    for x in (1.2,1.75):
        p.beam((x,1.9,.6),(x,1.9,.78),.08,'acier')
    p.box((1.72,2.18,.33),(.22,.46,.30),'bogie_bleu')
    p.cylinder((1.83,2.12,.50),.05,.35,'bogie_metal','Y',10)


def stands(p):
    p.proxy((.2,.05,0),(2.6,3.1,1.40))
    frame(p,.25)
    for x in (.44,2.56):
        for y in AXLES:
            p.box((x-.19,y-.19,0),(.38,.38,.07),'ambre')
            p.cylinder((x,y,.47),.065,.80,'ambre',sides=10)
            p.cylinder((x,y,.945),.045,.15,'bogie_metal',sides=10)
            p.box((x-.10,y-.12,1.02),(.20,.24,.04),'ambre')
            for sign in (-1,1):
                p.beam((x+sign*.145,y,.08),(x,y,.36),.045,'ambre')


def corners(p, x0,y0,x1,y1):
    for x,dx in ((x0,1),(x1,-1)):
        for y,dy in ((y0,1),(y1,-1)):
            p.box((x if dx>0 else x-.55,y,.012),(.55,.045,.012),'ambre')
            p.box((x,y if dy>0 else y-.55,.012),(.045,.55,.012),'ambre')


def materials(a):
    for key,color in (('bogie_metal',(.48,.51,.50,1)),
                      ('bogie_web',(.24,.27,.26,1)),
                      ('bogie_bleu',(.19,.28,.30,1))):
        mat=a.mats['armoire_ivoire'].copy()
        mat.name='metro_'+key
        mat.diffuse_color=color
        mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=color
        a.mats[key]=mat


def build(a):
    materials(a)
    for name,y,make in (('assemble',339,assembled),('revision',348,stands)):
        p=Piece('n5_depot_bogie_'+name,a.mats,'châssis ajouré, roues calées ou chandelles en contact')
        make(p)
        install(a,p,(60,y,FLOOR))
    p=Piece('n5_depot_essieux',a.mats,'deux essieux déposés à côté du châssis, calés au sol')
    for y in AXLES:
        wheelset(p,y)
        p.proxy((.2,y-.43,0),(2.6,.86,.85))
    install(a,p,(64,348,FLOOR))
    p=Piece('n5_depot_bogies_postes',a.mats,'angles peints et deux luminaires suspendus au plafond')
    corners(p,59.85,338.8,63.3,342.6)
    corners(p,59.85,347.8,67.05,351.7)
    for y in (340.6,349.6):
        p.box((61.38,y-1.25,3.85),(.24,2.5,.14),'acier')
        p.box((61.42,y-1.15,3.82),(.16,2.3,.03),'lampe')
        for yy in (y-1,y+1):
            p.beam((61.5,yy,3.99),(61.5,yy,4.7),.035,'acier')
        a.point('n5_depot_bogie_'+str(y),(61.5,y,FLOOR+3.55),'#dfbf83',18,10)
    install(a,p,(0,0,FLOOR))
