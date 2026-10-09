"""Jardinières et assises latérales du parvis d'arrivée.

see: docs/assets/tunnels-references.md#gare-darrivée-et-parvis--9-octobre
"""
from math import cos, pi, sin

from tools.metro.blockout.freight_carriage import staged
from tools.metro.quartier.geometry import Piece


def chamfer(p,x,y,z,w,d,h,material,cut=.35):
    outline=((x+cut,y),(x+w-cut,y),(x+w,y+cut),(x+w,y+d-cut),
             (x+w-cut,y+d),(x+cut,y+d),(x,y+d-cut),(x,y+cut))
    vertices=[(xx,yy,zz) for zz in (z,z+h) for xx,yy in outline]
    faces=[tuple(reversed(range(8))),tuple(range(8,16))]
    faces.extend((i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8))
    p.mesh(vertices,faces,material)


def rim(p,x,y,w,d):
    def outline(x,y,w,d,c):
        return ((x+c,y),(x+w-c,y),(x+w,y+c),(x+w,y+d-c),
                (x+w-c,y+d),(x+c,y+d),(x,y+d-c),(x,y+c))
    outer=outline(x-.06,y-.06,w+.12,d+.12,.35)
    inner=outline(x+.24,y+.24,w-.48,d-.48,.20)
    vertices=[(xx,yy,z) for z in (.46,.56) for ring in (outer,inner) for xx,yy in ring]
    faces=[]
    for i in range(8):
        j=(i+1)%8
        faces.extend(((16+i,16+j,24+j,24+i),(i,8+i,8+j,j),
                      (i,j,16+j,16+i),(8+i,24+i,24+j,8+j)))
    p.mesh(vertices,faces,'prive_pierre')


def shrub(p,x,y,z,rx,ry,h,phase):
    vertices=[]
    for dz,scale in ((0,.72),(h*.28,1),(h*.78,.83),(h,.50)):
        for i in range(9):
            angle=2*pi*i/9
            r=scale*(1+.10*sin(i*3+phase))
            vertices.append((x+rx*r*cos(angle),y+ry*r*sin(angle),z+dz))
    faces=[tuple(reversed(range(9))),tuple(range(27,36))]
    faces.extend((j+i,j+(i+1)%9,j+9+(i+1)%9,j+9+i) for j in (0,9,18) for i in range(9))
    p.mesh(vertices,faces,'petrole')
    for i in range(13):
        angle=2*pi*i/13+phase*.3
        r=.35+.40*(.5+.5*sin(i*2.4))
        cx,cy=x+rx*r*cos(angle),y+ry*r*sin(angle)
        root=z+h*(.68 if r>.6 else .82)
        height=.28+.12*(.5+.5*cos(i*3.1))
        for turn in (0,2.1,4.2):
            direction=angle+turn
            dx,dy=cos(direction),sin(direction)
            tip=(cx+dx*.19,cy+dy*.19,root+height)
            verts=[(cx-dy*.095,cy+dx*.095,root),
                   (cx+dy*.095,cy-dx*.095,root),tip,
                   (cx+dx*.025,cy+dy*.025,root+.08)]
            p.mesh(verts,[(0,1,2),(0,3,1),(0,2,3),(1,3,2)],'petrole')


def island(p,x,y,w,d,side):
    chamfer(p,x,y,0,w,d,.46,'prive_pierre')
    rim(p,x,y,w,d)
    chamfer(p,x+.24,y+.24,.48,w-.48,d-.48,.015,'nuit')
    p.proxy((x,y,0),(w,d,.56))
    for i,(u,v,rx,ry,h) in enumerate(((.24,.48,1.0,.85,.95),(.52,.30,1.25,.80,.67),(.77,.64,1.05,.78,1.12))):
        shrub(p,x+w*u,y+d*v,.495,rx,ry,h,i)
    front=x+w+.06 if side=='east' else x-.62
    for yy in (y+.70,y+d-.70):
        p.box((front+.06,yy-.09,0),(.44,.18,.46),'acier')
        p.box((front+.02,yy-.15,0),(.52,.30,.07),'acier')
    for i in range(4):
        p.box((front+i*.145,y+.35,.46),(.13,d-.70,.065),'bois')
    back=x+w-.025 if side=='east' else x-.055
    for zz in (.75,.89,1.03):
        p.box((back,y+.35,zz),(.055,d-.70,.105),'bois')
    for yy in (y+.65,y+d-.65):
        p.beam((back+.027,yy,.52),(back+.027,yy,1.14),.035,'acier')
    p.proxy((front,y+.35,0),(.58,d-.70,1.15))


def vent(p,x,y):
    chamfer(p,x,y,0,2.4,3.4,.72,'prive_pierre',.18)
    p.box((x+.1,y+.1,.72),(2.2,3.2,.06),'acier')
    p.box((x-.025,y+.15,.20),(.03,3.1,.41),'nuit')
    for z in (.24,.32,.40,.48,.56):
        p.box((x-.06,y+.18,z),(.065,3.04,.035),'acier')
    p.proxy((x-.06,y,0),(2.46,3.4,.78))


def build(a,stage):
    p=Piece('n5_parvis_jardins',a.mats,'trois îlots plantés, assises orientées vers l’axe et ventilation en périphérie')
    island(p,37,477,7,4,'east')
    island(p,56,479,7,5,'west')
    island(p,37,487,7,3,'east')
    vent(p,27.5,485)
    vent(p,66.5,485)
    staged(a,p,stage)
