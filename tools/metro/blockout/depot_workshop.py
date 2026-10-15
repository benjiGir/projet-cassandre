"""Charpente, ateliers et accès du dépôt.

see: docs/4-technique/blockout-metro.md#dépôt
"""
import math

from tools.metro.blockout.vault_profile import profile
from tools.metro.blockout.depot_entry import build as depot_entry
from tools.metro.blockout.depot_fitting_bench import build as fitting_bench
from tools.metro.blockout.depot_bogie_bays import build as bogie_bays
from tools.metro.blockout.depot_motor_bench import build as motor_bench
from tools.metro.blockout.depot_relay_bench import build as relay_bench
from tools.metro.blockout.depot_boarding_platform import build as boarding
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


FLOOR = -18


def structure(a):
    p=Piece('n5_depot_charpente',a.mats,'hall de 24 m, ateliers latéraux bas et charpente fixée')
    for y in (326,342,358):
        for x in (28,51):
            p.box((x-.25,y-.25,FLOOR),(.5,.5,6.5),'beton',True)
            p.box((x-.32,y-.32,FLOOR),(.64,.64,.18),'acier')
        p.beam((27.5,y,FLOOR+6.35),(51.5,y,FLOOR+6.35),.26,'acier')
        p.beam((27.5,y,FLOOR+5.45),(51.5,y,FLOOR+5.45),.14,'acier')
        for i in range(6):
            x=27.5+i*4
            p.beam((x,y,FLOOR+5.45),(x+4,y,FLOOR+6.3),.09,'acier')
        for x in (32,46):
            z=FLOOR+4.15
            p.box((x-.9,y-.12,z),(1.8,.24,.16),'acier')
            p.box((x-.8,y-.14,z-.035),(1.6,.28,.035),'lampe')
            for xx in (x-.7,x+.7): p.beam((xx,y,z+.16),(xx,y,FLOOR+5.45),.035,'acier')
            a.point(f'n5_depot_travee_{x}_{y}',(x,y,z-.22),'#dfbf83',18,18)
    for x in (28,51): p.beam((x,322,FLOOR+6.3),(x,366,FLOOR+6.3),.3,'acier')
    for y0,y1 in ((322,328),(356,366)):
        p.box((51.3,y0,FLOOR),(.2,y1-y0,4.7),'beton',True)
    p.box((51.3,332,FLOOR),(.2,20,1.1),'beton')
    p.proxy((51.3,332,FLOOR),(.2,20,1.5))
    for y in (332,336,340,344,348,351.8):
        p.box((51.28,y,FLOOR+1.1),(.24,.2,3.6),'acier')
    for z in (1.5,2.9,4.58):
        p.box((51.27,332,FLOOR+z),(.26,20,.12),'acier')
    for y in (328,352): p.box((51.3,y,FLOOR+3.1),(.2,4,1.6),'beton')
    for x,y in ((52,330),(52,354),(20,348),(65,330),(65,354)):
        p.box((x,y,FLOOR+3.7),(1.6,.18,.15),'acier')
        p.box((x+.1,y-.025,FLOOR+3.675),(1.4,.23,.025),'lampe')
        p.beam((x+.8,y+.09,FLOOR+3.85),(x+.8,y+.09,FLOOR+4.7),.04,'acier')
        a.point(f'n5_depot_atelier_{x}_{y}',(x+.8,y,FLOOR+3.45),'#dfbf83',10,12)
    for y in (328,352):
        frame(p,51.25,y,y+4,3.1)
        p.box((51.12,y+.8,FLOOR+3.21),(.18,2.4,.22),'acier')
        p.box((51.08,y+.94,FLOOR+3.24),(.04,2.12,.12),'lampe')
        a.point('n5_depot_atelier_seuil_'+str(y),(50.75,y+2,FLOOR+2.9),'#dfbf83',8,10)
    install(a,p,(0,0,0))


def pedestrian_edges(a):
    p=Piece('n5_depot_circulation',a.mats,'allée de quatre mètres, traits de bord hors des voies')
    for x in (44.2,48.25):
        p.box((x,328.5,FLOOR+.015),(.05,33.5,.012),'ivoire')
    for y in (346.05,350.1):
        p.box((13.5,y,FLOOR+.015),(23.1,.05,.012),'ivoire')
    install(a,p,(0,0,0))


def hall_services(a):
    p=Piece('n5_depot_reseaux',a.mats,'coffrets, conduites et luminaires fixés au garage')
    for y in (346,351):
        p.box((41.74,y,FLOOR),(.58,1.15,2.15),'acier',True)
        p.box((42.325,y+.07,FLOOR+.1),(.025,1.01,1.95),'petrole')
        p.box((42.35,y+.88,FLOOR+.94),(.045,.055,.28),'ivoire')
        for z in (1.55,1.67,1.79):
            p.box((42.355,y+.23,FLOOR+z),(.012,.48,.025),'acier')
        p.beam((42.01,y+.55,FLOOR+2.15),(42.01,y+.55,FLOOR+3.25),.07,'acier')
        p.beam((42.01,y+.55,FLOOR+3.25),(41.87,y+.55,FLOOR+3.25),.07,'acier')
    for x,z in ((41.87,3.25),(42.12,3.46)):
        p.beam((x,344.6,FLOOR+z),(x,361,FLOOR+z),.11,'acier')
        for y in (345,349,353,357,361):
            p.beam((41.7,y,FLOOR+3.7),(x+.12,y,FLOOR+3.7),.06,'acier')
            p.beam((x,y,FLOOR+3.7),(x,y,FLOOR+z),.04,'acier')
    for y in (350,358):
        p.box((41.71,y,FLOOR+2.75),(.22,1.4,.21),'acier')
        p.box((41.94,y+.12,FLOOR+2.8),(.025,1.16,.1),'lampe')
        a.point('n5_depot_reseau_'+str(y),(42.12,y+.7,FLOOR+2.85),'#dfbf83',6,9)
    install(a,p,(0,0,0))


def frame(p,x,y0,y1,height=2.65,axis='x'):
    for y in (y0,y1-.15):
        origin=(x,y,FLOOR); size=(.18,.15,height+.15)
        if axis=='y': origin=(y,x,FLOOR); size=(.15,.18,height+.15)
        p.box(origin,size,'acier')
    a=(x+.09,y0,FLOOR+height+.08); b=(x+.09,y1,FLOOR+height+.08)
    if axis=='y': a=(y0,x+.09,FLOOR+height+.08); b=(y1,x+.09,FLOOR+height+.08)
    p.beam(a,b,.18,'acier')


def receiving_bays(a):
    p=Piece('n5_depot_baies',a.mats,'habillage fermé des garages de réception A et VB')
    # Les retraits et ouvertures reprennent exactement les garages qui masquent le trafic.
    for x,end in ((36.8,361.8),(41.55,366)):
        for y0,y1 in ((322,324),(344.5,end)):
            p.box((x,y0,FLOOR),(.15,y1-y0,4.7),'beton')
        p.box((x,324,FLOOR+2.75),(.15,4,1.95),'beton')
        frame(p,x-.035,324,328)
    p.box((36.8,344.5,FLOOR+4.7),(4.9,21.5,.2),'acier')
    for y in (346,354,362):
        p.box((36.75,y,FLOOR+4.5),(5,.18,.3),'acier')
    for y in (350.2,):
        for x0,x1 in ((7.5,9.5),):
            p.box((x0,y,FLOOR),(x1-x0,.15,4.7),'beton')
        p.box((9.5,y,FLOOR+2.75),(4,.15,1.95),'beton')
        frame(p,y-.035,9.5,13.5,axis='y')
    p.box((31.6,350.2,FLOOR),(.2,7.6,4.7),'beton')
    for y in (350.04,):
        p.box((10.6,y,FLOOR+3.4),(1.8,.18,.22),'acier')
        p.box((10.72,y-.025,FLOOR+3.43),(1.56,.23,.1),'lampe')
    # Portail arqué côté dépôt : les reins ferment les jours entre tube et linteau.
    shape=profile(2.75,4.5)
    for (t0,z0),(t1,z1) in zip(shape,shape[1:]):
        y0=350.5+7*t0; y1=350.5+7*t1
        verts=[(x,y,FLOOR+z) for x in (7.46,7.66)
               for y,z in ((y0,z0),(y1,z1),(y1,4.5),(y0,4.5))]
        p.mesh(verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'beton')
    install(a,p,(0,0,0))
    a.letters('POSTE',(11.5,350.155,FLOOR+2.99),.22)
    a.point('n5_depot_portal_b',(11.5,349.7,FLOOR+3.2),'#dfbf83',10,12)
    a.point('n5_depot_portal_b_retour',(11.5,358.1,FLOOR+3.2),'#dfbf83',8,10)


def machinery_access(a):
    p=Piece('n5_depot_acces_techniques',a.mats,'deux seuils raccordés à la boucle de machinerie')
    for y,label in ((328,'MACHINERIE'),(352,'RETOUR')):
        frame(p,71.36,y,y+4,3.2)
        p.box((71.36,y,FLOOR+3.37),(.28,4,1.63),'beton')
        p.box((71.32,y+.7,FLOOR+3.4),(.05,2.6,.35),'petrole')
        a.letters(label,(71.29,y+2,FLOOR+3.48),.22,angle=-math.pi/2)
        p.box((71.18,y+.18,FLOOR+2.35),(.15,.7,.22),'acier')
        p.box((71.14,y+.24,FLOOR+2.4),(.045,.58,.12),'lampe')
        a.point('n5_depot_seuil_'+str(y),(70.8,y+.5,FLOOR+2.5),'#dfbf83',6,10)
    install(a,p,(0,0,0))


def western_passage(a):
    p=Piece('n5_depot_passage_poste',a.mats,'seuil ajouré et relais muraux ; le parcours tourne vers la vraie porte')
    frame(p,27.4,345.92,350.27,3.1)
    for y in (346,350.2):
        p.beam((27.49,y,FLOOR+3.3),(27.49,y,FLOOR+4.7),.055,'acier')
    p.box((27.38,347.2,FLOOR+3.3),(.24,1.8,.16),'acier')
    p.box((27.64,347.34,FLOOR+3.33),(.035,1.52,.1),'lampe')
    a.point('n5_depot_passage_poste',(27.9,348,FLOOR+3.25),'#dfbf83',9,12)
    p.box((31.82,350.7,FLOOR+1.1),(.2,1.3,1.6),'acier')
    p.box((32.025,350.78,FLOOR+1.2),(.025,1.14,1.4),'petrole')
    p.box((32.055,350.94,FLOOR+1.75),(.025,.82,.62),'nuit')
    for z in (1.95,2.2):
        p.beam((32.09,351.03,FLOOR+z),(32.09,351.67,FLOOR+z),.035,'ivoire')
    p.beam((32.095,351.17,FLOOR+1.95),(32.095,351.49,FLOOR+2.2),.035,'ambre')
    for y in (351.08,351.6):
        p.box((32.09,y,FLOOR+1.94),(.025,.055,.055),'ambre')
    p.box((31.81,350.78,FLOOR+2.94),(.29,1.14,.18),'acier')
    p.box((32.105,350.9,FLOOR+2.97),(.025,.9,.1),'lampe')
    a.point('n5_depot_relais_poste',(32.3,351.3,FLOOR+2.9),'#dfbf83',7,10)
    p.beam((31.91,351.36,FLOOR+2.7),(31.91,351.36,FLOOR+3.5),.08,'acier')
    p.beam((31.91,351.36,FLOOR+3.5),(31.91,350.05,FLOOR+3.5),.08,'acier')
    p.beam((31.91,350.05,FLOOR+3.5),(11.5,350.05,FLOOR+3.5),.08,'acier')
    for x in (12,17,22,27,31.6):
        p.beam((x,350.19,FLOOR+3.5),(x,349.99,FLOOR+3.5),.04,'acier')
    p.box((13.7,350.04,FLOOR+2.2),(.2,.16,.9),'acier')
    p.box((13.73,350.015,FLOOR+2.3),(.14,.025,.7),'lampe')
    a.point('n5_depot_coude_poste',(13.8,349.55,FLOOR+2.7),'#dfbf83',7,9)
    install(a,p,(0,0,0))


def maintenance_bay(a):
    p=Piece('n5_depot_maintenance',a.mats,'atelier bas, bogies et pièces déposées sans voie orpheline')
    for y in (324,357):
        p.box((67,y,FLOOR),(2.5,2,1.2),'bois',True)
        for z in (.15,.95): p.box((66.98,y-.02,FLOOR+z),(2.54,.08,.1),'acier')
    install(a,p,(0,0,0))
    bogie_bays(a)
    fitting_bench(a)
    motor_bench(a)
    relay_bench(a)


def build(a,stage):
    before=set(a.props.objects)
    structure(a)
    pedestrian_edges(a)
    receiving_bays(a)
    western_passage(a)
    hall_services(a)
    depot_entry(a)
    machinery_access(a)
    maintenance_bay(a)
    boarding(a)
    for obj in set(a.props.objects)-before:
        obj.parent=stage
