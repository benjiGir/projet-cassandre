"""Quatre volées, sortie couverte et seuil de la tour au terme de N5.

see: docs/4-technique/blockout-metro.md#remontée-et-seuil-de-la-tour
"""
import math

from tools.metro.blockout import layout as P
from tools.metro.blockout.freight_carriage import staged
from tools.metro.quartier.geometry import Piece


def stairway(a,stage):
    p=Piece('n5_remontee_escalier',a.mats,'69 marches et trois paliers, avec proxies inclinés du plan N5')
    for name,lo,hi,z0,z1,count in P.ASCENT:
        if count:
            for i in range(count):
                y=lo+i*(hi-lo)/count; top=z0+(i+1)*.25
                p.box((48.08,y,top-.25),(3.84,(hi-lo)/count,.25),'prive_sol')
                p.box((48.14,y,top+.004),(3.72,.065,.012),'ivoire')
        else:
            p.box((48.08,lo,z0+.005),(3.84,hi-lo,.012),'prive_sol')
        for x in (48.18,51.82):
            p.beam((x,lo,z0+.95),(x,hi,z1+.95),.055,'acier')
            n=max(1,math.ceil((hi-lo)/2.4))
            for i in range(n+1):
                y=lo+(hi-lo)*i/n; z=P.ascent_z(y)
                anchor=48.02 if x<50 else 51.98
                p.beam((anchor,y,z+.95),(x,y,z+.95),.045,'acier')
        if count:
            for fraction,side in ((.3,'ouest'),(.78,'est')):
                y=lo+(hi-lo)*fraction; z=P.ascent_z(y)+2.7
                x=48.015 if side=='ouest' else 51.835
                front=48.18 if side=='ouest' else 51.8
                p.box((x,y-.45,z),(.15,.9,.18),'acier')
                p.box((front,y-.36,z+.035),(.035,.72,.11),'lampe')
                point=48.5 if side=='ouest' else 51.5
                a.point('n5_remontee_'+name+'_'+side,(point,y,z+.07),'#b9d4df',7,8)
    staged(a,p,stage)


def exit_pavilion(a,stage):
    p=Piece('n5_remontee_sortie',a.mats,'sas vitré et couverture portée au débouché de l’escalier')
    for x in (47.8,52):
        p.box((x,466.4,0),(.2,2.5,.65),'prive_pierre',True)
        p.proxy((x,466.4,.65),(.2,2.5,3.35))
        p.box((x+.085,466.56,.73),(.035,2.12,2.88),'verre')
        for y in (466.4,468.75): p.box((x,y,0),(.2,.15,4),'acier')
        p.box((x,466.4,3.65),(.2,2.5,.35),'acier')
    p.box((47.8,466.4,4),(4.4,2.5,.2),'acier')
    p.box((48,466.4,3.2),(4,.2,.8),'prive_pierre')
    p.box((48,468.72,3.2),(4,.18,.8),'acier')
    p.text('SORTIE',(50,468.70,3.35),.23,'ivoire')
    p.box((49.2,467.3,3.8),(1.6,.25,.2),'acier')
    p.box((49.33,467.34,3.765),(1.34,.17,.035),'lampe')
    a.point('n5_remontee_debouche',(50,467.45,3.5),'#cbdde2',10,11)
    staged(a,p,stage)


def perimeter(p,start,end):
    x0,y0=start; x1,y1=end
    dx,dy=x1-x0,y1-y0
    p.proxy((min(x0,x1)-.08,min(y0,y1)-.08,0),(max(.16,abs(dx)+.16),max(.16,abs(dy)+.16),1.5))
    p.beam((x0,y0,.18),(x1,y1,.18),.35,'prive_pierre')
    for z in (.74,1.44): p.beam((x0,y0,z),(x1,y1,z),.055,'acier')
    count=math.ceil(math.hypot(dx,dy)/3)
    for i in range(count+1):
        x=x0+dx*i/count; y=y0+dy*i/count
        p.box((x-.045,y-.045,0),(.09,.09,1.5),'acier')
        p.box((x-.1,y-.1,0),(.2,.2,.06),'acier')


def plaza(a,stage):
    p=Piece('n5_parvis_amenagement',a.mats,'axe vers la tour, limites ajourées et grilles techniques latérales')
    for origin,size in (((10,454,-.35),(14,74,.1)),((72,454,-.35),(14,74,.1)),
                        ((24,454,-.35),(23.75,12.5,.1)),((52.25,454,-.35),(19.75,12.5,.1)),
                        ((24,500.5,-.35),(48,27.5,.1))):
        p.box(origin,size,'sol')
    for start,end in (((24,466.5),(48,466.5)),((52,466.5),(72,466.5)),
                      ((24,466.5),(24,500.5)),((72,466.5),(72,500.5)),
                      ((24,500.5),(36,500.5)),((60,500.5),(72,500.5))):
        perimeter(p,start,end)
    for x in range(24,73,4): p.box((x,466.5,.005),(.025,34,.012),'acier')
    for y in (466.5,470.5,474.5,478.5,482.5,486.5,490.5,494.5,498.5):
        p.box((24,y,.005),(48,.025,.012),'acier')
    p.box((46,469,.018),(8,31.25,.018),'pave')
    for x in (45.85,54.08): p.box((x,469,.008),(.07,31,.012),'ivoire')
    for y in range(470,501,2):
        p.box((46,y,.037),(8,.025,.012),'acier')
    for x in (48,50,52):
        p.box((x,469,.037),(.025,31.25,.012),'acier')
    for x in (31,65):
        for y in (471,491):
            p.box((x-.14,y-.14,0),(.28,.28,.12),'acier')
            p.box((x-.065,y-.065,.12),(.13,.13,4.85),'acier',True)
            p.box((x-.5,y-.5,4.8),(1,1,.2),'acier')
            p.box((x-.39,y-.39,4.765),(.78,.78,.035),'lampe')
            a.point(f'n5_parvis_mat_{x}_{y}',(x,y,4.5),'#cbdde2',18,18)
    staged(a,p,stage)


def tower_base(a,stage):
    p=Piece('n5_tour_socle',a.mats,'socle raccordé à la tour, façade vitrée et entrée sous marquise')
    p.box((36,500.85,0),(24,17.65,6),'acier')
    for x,width in ((36,8),(56,4)):
        p.box((x,500.3,0),(width,.55,6),'prive_pierre')
    p.box((44,500.3,3.7),(12,.55,2.3),'prive_pierre')
    p.proxy((36,500.3,0),(24,.55,6))
    p.box((44,500.59,.05),(12,.04,3.65),'nuit')
    for lo,hi in ((44.12,48.4),(48.55,50),(50.1,51.55),(51.7,55.88)):
        p.box((lo,500.39,.12),(hi-lo,.035,3.42),'verre')
    for x in (44,48.42,50,51.58,55.88):
        p.box((x,500.3,0),(.12,.2,3.7),'acier')
    for z in (.02,3.56): p.box((44,500.28,z),(12,.24,.14),'acier')
    for x in (49.68,50.25): p.box((x,500.19,1.0),(.055,.075,.72),'ivoire')
    p.box((44.85,497.75,3.55),(10.3,2.55,.2),'acier')
    for x in (46,54):
        p.beam((x,497.9,3.74),(x,500.42,4.65),.14,'acier')
        p.box((x-.12,500.26,3.6),(.24,.16,1.2),'acier')
    p.text('HALL',(50,497.71,3.59),.26,'lampe')
    for x in (47,53):
        p.box((x-.35,498.7,3.42),(.7,.4,.13),'acier')
        p.box((x-.27,498.77,3.385),(.54,.26,.035),'lampe')
        a.point('n5_tour_entree_'+str(x),(x,498.9,3.1),'#cbdde2',10,10)
    p.box((49.76,500.14,1.0),(.48,.06,.55),'acier')
    staged(a,p,stage)
    obj=a.box('n5_tour_commande',(-.18,-.06,-.22),(.36,.12,.44),'petrole',False)
    obj.location=(50,500.14,1.28); obj.name='use_n5_fin'; obj.parent=stage
    button=a.box('n5_tour_commande_bouton',(49.93,500.02,1.24),(.14,.04,.1),'ivoire',False)
    button.parent=stage


def build(a,stage):
    stairway(a,stage)
    exit_pavilion(a,stage)
    plaza(a,stage)
    from tools.metro.blockout.tower_plaza_furniture import build as plaza_furniture
    plaza_furniture(a,stage)
    tower_base(a,stage)
