"""Deux volées publiques, palier et enveloppe fermée.

see: docs/4-technique/blockout-metro.md#guichet-et-validation
"""
import math

from tools.metro.blockout.layout import DESCENT
from tools.metro.blockout.geometry import prism, wall
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


def build(a):
    p=Piece('n5_descente_quai',a.mats,'32 marches, palier, murs carrelés et mains courantes fixées')
    for segment,(name,lo,hi,z0,z1,count) in enumerate(DESCENT):
        if count:
            run=(hi-lo)/count
            for i in range(count):
                y=lo+i*run; top=z0-i*.25
                p.box((-8.96,y,top-.25),(4.92,run,.25),'sol')
                p.box((-8.91,y+run-.065,top+.006),(4.82,.055,.014),'acier')
                for offset in (.10,.145):
                    p.box((-8.88,y+run-offset,top+.006),(4.76,.016,.008),'nuit')
        else:
            p.box((-8.96,lo,z0-.015),(4.92,hi-lo,.025),'sol')
        roof=[(-9,lo,z0+2.95),(-4,lo,z0+2.95),(-4,hi,z1+2.95),(-9,hi,z1+2.95)]
        prism(p,roof,.2,'ivoire',False)
        for x,reverse in ((-9,True),(-4,False)):
            start,end=(x,lo,z0),(x,hi,z1)
            if reverse: start,end=end,start
            wall(p,start,end,start[2]-.35,end[2]-.35,start[2]+2.75,end[2]+2.75,'ivoire')
            inset=.012 if reverse else -.012
            band_start=(start[0]+inset,start[1],start[2])
            band_end=(end[0]+inset,end[1],end[2])
            for bottom,top in ((.08,.3),(2.35,2.48)):
                wall(p,band_start,band_end,start[2]+bottom,end[2]+bottom,start[2]+top,end[2]+top,'petrole',False)
            inside=x+(.16 if reverse else -.16)
            p.beam((inside,lo,z0+.95),(inside,hi,z1+.95),.065,'acier')
            for i in range(math.ceil((hi-lo)/1.65)+1):
                if segment and i==0: continue
                t=i/math.ceil((hi-lo)/1.65)
                y=lo+(hi-lo)*t; z=z0+(z1-z0)*t+.95
                p.beam((x,y,z-.15),(inside,y,z),.045,'acier')
                p.box((x-.025 if reverse else x-.005,y-.06,z-.2),(.03,.12,.2),'acier')
        mid=(lo+hi)/2; floor=(z0+z1)/2
        p.box((-7.25,mid-.12,floor+2.50),(1.5,.24,.14),'acier')
        p.box((-7.12,mid-.075,floor+2.475),(1.24,.15,.025),'lampe')
        for x in (-7.05,-5.95):
            p.beam((x,mid,floor+2.64),(x,mid,floor+2.75),.04,'acier')
        a.point('n5_descente_'+name,(-6.5,mid,floor+2.3),'#d6d1b7',9,9)
    p.box((-9.15,106.28,-5),(.15,.24,3.5),'petrole',True)
    p.box((-4,106.28,-5),(.15,.24,3.5),'petrole',True)
    p.box((-9.15,106.28,-2.25),(5.3,.24,.75),'petrole',True)
    p.text('QUAIS',(-6.5,106.245,-2.02),.21,'ivoire')
    for y,z in ((106.27,-5),(118.05,-13)):
        p.box((-8.94,y,z+.006),(4.88,.16,.016),'ivoire')
        for i in range(24):
            p.box((-8.88+i*.2,y+.05,z+.023),(.08,.065,.01),'acier')
    install(a,p,(0,0,0))
