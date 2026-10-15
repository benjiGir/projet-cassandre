"""Arrêts fixés au fond des refuges ; recette C.metro_blockout()."""
import math

from tools.metro.blockout import layout as P


def placement(niche):
    front=tuple((niche.points[0][k]+niche.points[1][k])/2 for k in range(3))
    back=tuple((niche.points[2][k]+niche.points[3][k])/2 for k in range(3))
    control_height=1.35
    if niche.id=='niche_tunnel_a_6':
        back=(-7.75,196.6,P.hauteur_y(P.A_POINTS,196.6))
        front=(-4.25,196.6,back[2])
        control_height=1.5
    dx,dy=front[0]-back[0],front[1]-back[1]
    length=math.hypot(dx,dy)
    nx,ny=dx/length,dy/length
    angle=math.atan2(nx,-ny)
    at=(back[0]+nx*.155,back[1]+ny*.155,back[2]+control_height)
    safe=(back[0]+nx*.7,back[1]+ny*.7,back[2])
    review=(back[0]+nx*.95,back[1]+ny*.95,back[2]+.01,math.degrees(angle)%360)
    return at,angle,safe,review


def create(a,niche,index):
    from tools.metro.blockout.control_panels import create as control_panel
    at,angle,safe,_=placement(niche)
    obj=control_panel(a,f'use_n5_stop_{index}',at,angle=angle,variant='stop',mount='wall')
    obj['train']='stop'
    obj['voie']='A' if niche.groupe=='tunnel_a' else 'VB'
    a.point(f'n5_niche_{index}',(safe[0],safe[1],safe[2]+2.4),'#91b6a4',5,6)
    return obj,safe
