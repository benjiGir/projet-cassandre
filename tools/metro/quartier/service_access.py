"""Trappe rétractable et enveloppe de la descente de service."""
import bpy

from tools.metro.quartier.geometry import Piece
from tools.metro.kit.geometry import FACES


def hatch(a):
    def omit(original):
        return original.name.startswith('col_') or original.data.materials[0].name!='quartier_petrole'

    panels=a.place('trappe_service_2m',(25,70,0),omit=omit)
    for panel in panels:
        for vertex in panel.data.vertices:
            vertex.co.x=26+(vertex.co.x-26)*1.9/1.7
            vertex.co.y=71+(vertex.co.y-71)*1.96/1.7
        panel.data.update()
    door=a.door(panels,'door_quartier_trappe','coulisse',2.1)
    for panel in panels: panel['sens']='+'
    for name,origin,size in (
        ('sud',(24.9,69.9,-.15),(2.2,.18,.168)),
        ('nord',(24.9,71.92,-.15),(2.2,.18,.168)),
        ('ouest',(24.9,70.08,-.15),(.18,1.84,.168)),
        ('est',(26.92,70.08,-.15),(.18,1.84,.168))):
        a.box('trappe_cadre_'+name,origin,size,'acier')
    a.command('use_quartier_trappe',(24.4,71,1.1),door.name,'Trappe de service ouverte')
    a.box('support_trappe',(24.2,70.9,0),(.4,.2,.9),'acier')
    a.letters('ACCES SERVICE',(25,71.98,2.35),.28)


def stairs(a):
    p=Piece('escalier_service',a.mats,'onze marches de 25 cm ; massif fermé sous les marches')
    for i in range(11):
        y=74+i*.5
        z=-2.25-i*.25
        p.box((25,y,z-.15),(2,.5,.15),'ardoise')
        p.box((25,y+.45,z-.4),(2,.05,.4),'ardoise')
    vertices=[(x,y,z) for x in (25,27)
              for y,z in ((74,-2.25),(79.5,-5),(79.5,-5.25),(74,-5.25))]
    p.mesh(vertices,FACES,'ardoise')
    ramp_vertices=[(x,y,z) for x in (25,27)
                   for y,z in ((74,-2.25),(79.5,-5),(79.5,-5.25),(74,-2.5))]
    ramp=p.mesh(ramp_vertices,FACES,'ardoise',True)
    bpy.data.objects.remove(ramp,do_unlink=True)
    for obj in list(p.collection.objects):
        p.collection.objects.unlink(obj)
        (a.col if obj.name.startswith('col_') else a.shell).objects.link(obj)
    bpy.data.collections.remove(p.collection)


def enclose(a):
    a.box('service_palier_haut',(25,70,-2.5),(2,4,.25),'ardoise')
    stairs(a)
    a.box('service_palier_bas',(25,79.5,-5.25),(2,4.5,.25),'ardoise')
    for side,x in (('ouest',24.75),('est',27)):
        a.box('service_puits_'+side,(x,70,-5.25),(.25,2,5),'enduit')
        a.box('service_mur_'+side,(x,72,-5.25),(.25,12,5.25),'enduit')
    a.box('service_fond_sud',(25,69.75,-5.25),(2,.25,5),'enduit')
    a.box('service_plafond',(25,72,0),(2,12,.25),'ardoise',False)
    a.box('service_linteau',(25,83.75,-1.5),(2,.25,1.5),'enduit')
