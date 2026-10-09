"""Tête nord de station et seuil de la galerie de maintenance.

see: docs/assets/tunnels-references.md#première-zone-reprise-tête-nord-et-accès-de-maintenance
"""
import math

from tools.metro.blockout import layout as P
from tools.metro.blockout.geometry import prism
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install
from tools.metro.blockout.vault_profile import profile, station_height


def platform_guard(a,x,start,end):
    p=Piece(f'n5_garde_quai_{x}_{start}',a.mats,'garde-corps ajouré du quai')
    p.proxy((x,start,P.QUAI_Z),(.15,end-start,1.5))
    for z in (.68,1.44):
        p.beam((x+.075,start,P.QUAI_Z+z),(x+.075,end,P.QUAI_Z+z),.06,'acier')
    count=math.ceil((end-start)/2.75)
    for i in range(count+1):
        y=start+(end-start)*i/count
        p.box((x,y-.035,P.QUAI_Z),(.15,.07,1.5),'acier')
        p.box((x-.035,y-.09,P.QUAI_Z),(.22,.18,.06),'acier')
    install(a,p,(0,0,0))


def ceiling(x):
    return station_height(x)+.2


def panel(piece,x0,x1,bottom0,bottom1,material='ivoire',y=190):
    xs=[x0]+[-9+18*t for t,_ in profile(2.8,6.5) if x0<-9+18*t<x1]+[x1]
    for lo,hi in zip(xs,xs[1:]):
        za,zb=[bottom0+(bottom1-bottom0)*(x-x0)/(x1-x0) for x in (lo,hi)]
        vertices=[(x,yy,z) for yy in (y-.15,y+.15)
                  for x,z in ((lo,za),(hi,zb),(hi,ceiling(hi)),(lo,ceiling(lo)))]
        piece.mesh(vertices,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],material,True)


def opening(piece,left,right,clip_left=None,clip_right=None):
    points=profile(P.RAIL_Z+2.75,P.RAIL_Z+4.5)
    for (t0,z0),(t1,z1) in zip(points,points[1:]):
        x0,x1=left+(right-left)*t0,left+(right-left)*t1
        lo=max(x0,clip_left if clip_left is not None else left)
        hi=min(x1,clip_right if clip_right is not None else right)
        if hi<=lo: continue
        za=z0+(z1-z0)*(lo-x0)/(x1-x0)
        zb=z0+(z1-z0)*(hi-x0)/(x1-x0)
        x0,x1,z0,z1=lo,hi,za,zb
        panel(piece,x0,x1,z0,z1)
        vertices=[(x,y,z) for y in (189.81,189.85)
                  for x,z in ((x0,z0),(x1,z1),(x1,z1+.18),(x0,z0+.18))]
        piece.mesh(vertices,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'enduit')


def gallery(piece,a):
    x=.25
    z0,z1=P.galerie_z(x,214),P.galerie_z(x,216.5)
    for y,z in ((213.85,z0),(216.5,z1)):
        piece.box((x-.12,y,z),(.52,.15,2.75),'acier')
        piece.box((x-.14,y+.025,z+.12),(.05,.1,2.48),'petrole')
    piece.beam((x+.05,213.85,z0+2.81),(x+.05,216.65,z1+2.81),.27,'acier')
    prism(piece,[(x-.12,214,z0+.03),(x+.4,214,z0+.03),
                 (x+.4,216.5,z1+.03),(x-.12,216.5,z1+.03)],.03,'acier',False)
    for y in (214.1,216.2):
        z=P.galerie_z(x,y)
        piece.box((x+.45,y,z+.02),(.2,.15,.015),'ambre')
    z=P.galerie_z(1,214)
    piece.box((.65,214.08,z+.06),(2.2,.085,2.58),'petrole')
    for xx in (.7,2.65):
        piece.box((xx,214.055,z+.12),(.045,.03,2.44),'acier')
    for zz in (z+.12,z+2.52):
        piece.box((.7,214.055,zz),(2,.03,.045),'acier')
    piece.box((2.5,214.17,z+1.05),(.12,.08,.1),'acier')
    piece.box((x-.15,214.72,z0+2.84),(.07,1.08,.22),'petrole')
    a.letters('SERVICE',(x-.17,215.25,z0+2.87),.16,angle=-math.pi/2)
    lamp_z=P.galerie_z(3.5,214)+2.4
    piece.box((3.05,214.02,lamp_z),(.9,.12,.18),'acier')
    piece.box((3.12,214.14,lamp_z+.035),(.76,.035,.11),'lampe')
    a.point('n5_seuil_galerie',(3.5,214.35,lamp_z+.06),'#d4b58a',7,8)


def build(a):
    p=Piece('n5_tete_station',a.mats,'front maçonné, accès de maintenance et seuil industriel')
    floor=P.RAIL_Z-.25
    for left,right in ((-9,-7.6),(-4.85,-4.25),(.125,.375),(3.75,9)):
        panel(p,left,right,floor,floor)
        p.box((left,189.81,P.QUAI_Z+.05),(right-left,.045,.22),'petrole')
    panel(p,-7.6,-4.85,P.QUAI_Z+2.8,P.QUAI_Z+2.8)
    opening(p,-4.25,.25,clip_right=.125)
    opening(p,.25,3.75,clip_left=.375)
    for x in (-7.6,-4.95):
        p.box((x,189.8,P.QUAI_Z),(.1,.4,2.8),'enduit')
    p.box((-7.6,189.8,P.QUAI_Z+2.7),(2.75,.4,.1),'enduit')
    a.letters('SERVICE',(-6.225,189.78,P.QUAI_Z+2.97),.18,material='petrole')
    end_z=P.hauteur_y(P.A_POINTS,197.5)
    for y in (190.2,192,194,196,197.2):
        z=P.QUAI_Z+(end_z-P.QUAI_Z)*(y-190)/7.5
        p.beam((-7.55,y,z+.12),(-7.55,y,z+.92),.045,'acier')
    p.beam((-7.55,190.2,P.QUAI_Z+.895),(-7.55,197.2,end_z+.96),.06,'acier')
    p.box((-7.73,192.8,P.QUAI_Z+2.12),(.14,.7,.2),'acier')
    p.box((-7.59,192.86,P.QUAI_Z+2.16),(.035,.58,.12),'lampe')
    p.box((-6.3,197.4,end_z+2.35),(.6,.09,.15),'acier')
    p.box((-6.25,197.37,end_z+2.38),(.5,.035,.09),'lampe')
    a.point('n5_acces_service',(-7.3,193.15,P.QUAI_Z+2.25),'#d4b58a',7,9)
    p.box((-4.25,190,P.RAIL_Z+2.35),(.28,.25,.45),'acier')
    for y in (201,212):
        z=P.hauteur_y(P.A_POINTS,y)
        p.box((.08,y-.4,z+2.22),(.17,.8,.23),'acier')
        p.box((.04,y-.34,z+2.27),(.045,.68,.13),'lampe')
        a.point('n5_tunnel_applique_'+str(y),(-.2,y,z+2.3),'#d4b58a',5,8)
    gallery(p,a)
    install(a,p,(0,0,0))
