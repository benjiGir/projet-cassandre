"""Quai d'arrivée et seuil de la remontée, dans le groupe du voyage.

see: docs/4-technique/blockout-metro.md#rame-de-fret-et-arrivée
"""
from tools.metro.blockout.rail_architecture import track
from tools.metro.quartier.geometry import Piece


FLOOR = -17.25


def bench(p,y,length):
    for yy in (y+.30,y+length-.30):
        p.box((58.48,yy-.07,FLOOR),(.36,.14,.43),'acier')
        p.box((58.38,yy-.12,FLOOR),(.56,.24,.07),'acier')
        p.beam((58.68,yy,FLOOR+.40),(58.98,yy,FLOOR+1.02),.055,'acier')
    for x in (58.30,58.43,58.56,58.69,58.82):
        p.box((x,y,FLOOR+.43),(.115,length,.065),'bois')
    for z in (.66,.80,.94):
        p.box((58.96,y,FLOOR+z),(.065,length,.11),'bois')
    for yy in (y+.04,y+length-.04):
        p.beam((58.90,yy,FLOOR+.94),(58.90,yy,FLOOR+.72),.032,'acier')
        p.beam((58.90,yy,FLOOR+.72),(58.27,yy,FLOOR+.72),.032,'acier')
        p.beam((58.27,yy,FLOOR+.72),(58.27,yy,FLOOR+.46),.032,'acier')
    p.proxy((58.25,y,FLOOR),(.80,length,1.05))


def wall_finish(p):
    p.box((59.13,366.2,FLOOR+.03),(.10,63.6,.20),'acier')
    p.box((59.12,366.2,FLOOR+3.05),(.11,63.6,.12),'acier')
    for y in range(367,429,4):
        length=min(3.94,429.8-y)
        p.box((59.11,y,FLOOR+.25),(.12,length,2.74),'prive_pierre')
        p.box((59.09,y+.03,FLOOR+2.18),(.025,length-.06,.025),'acier')
    for y,length in ((388.65,3.4),(412.6,4.3)):
        p.box((59.07,y,FLOOR+.52),(.075,length,1.02),'nuit')
        for i in range(round(length/.16)):
            p.box((59.02,y+i*.16,FLOOR+.55),(.055,.115,.96),'bois')
    bench(p,389,2.70)
    bench(p,413,3.60)


def portal(p,a):
    for x in (47.62,52):
        p.box((x,429.43,FLOOR),(.38,.57,4),'prive_pierre')
        p.box((x-.02,429.40,FLOOR),(.42,.61,.18),'acier')
    p.box((47.62,429.43,FLOOR+3.05),(4.76,.57,.95),'prive_pierre')
    p.box((48,429.40,FLOOR+3.05),(4,.12,.14),'acier')
    p.box((49.04,429.345,FLOOR+3.30),(1.92,.06,.40),'petrole')
    p.text('PARVIS',(50,429.33,FLOOR+3.40),.20,'ivoire')
    p.box((48.25,429.63,FLOOR+3.0),(3.5,.20,.05),'lampe')
    p.box((48,426,FLOOR+.016),(4,4,.014),'pave')
    a.point('n5_privee_sortie',(50,429.15,FLOOR+2.85),'#cbdde2',14,8)


def build(a,stage):
    from tools.metro.blockout.freight_carriage import staged
    p=Piece('n5_privee_arrivee',a.mats,'quai froid, parements, bancs intégrés et sortie vers le parvis')
    p.box((32.5,366,-18),(.25,62,6.75),'acier')
    p.box((32.5,366,-11.25),(8.75,64,.2),'acier')
    p.box((32.5,366,-18),(8.75,.2,6.75),'acier')
    p.box((41.25,365.8,FLOOR),(18,.2,6),'prive_pierre')
    p.box((32.5,429.8,-18),(8.75,.2,6.75),'acier')
    p.box((32.5,366,-18),(8.95,64,.2),'sol')
    track(p,((39.5,366,-18),(39.5,428,-18)))
    p.box((41.46,366,FLOOR+.006),(.46,64,.018),'ivoire')
    p.box((41.92,366,FLOOR+.006),(.12,64,.018),'acier')
    for x in (44,47,50,53,56,59):
        p.box((x,366,FLOOR+.005),(.025,64,.012),'acier')
    for y in range(366,431,4):
        p.box((42.04,y,FLOOR+.005),(17.21,.025,.012),'acier')
    for y in (374,390,406,422):
        p.box((41.45,y,-11.6),(17.8,.24,.35),'acier')
        p.box((53,y-.35,FLOOR),(.65,.7,5.65),'prive_pierre',True)
        p.box((52.95,y-.4,FLOOR),(.75,.8,.18),'acier')
        p.box((53-.03,y-.38,FLOOR+1.15),(.71,.76,.06),'acier')
        for x in (44.6,56.5):
            p.box((x,y-.9,-11.85),(.24,1.8,.2),'acier')
            p.box((x+.045,y-.8,-11.89),(.15,1.6,.04),'lampe')
            p.beam((x+.12,y,-11.65),(x+.12,y,-11.25),.035,'acier')
        a.point('n5_privee_quai_'+str(y),(54.2,y,-12.3),'#b9d4df',20,12)
    wall_finish(p)
    portal(p,a)
    staged(a,p,stage)
