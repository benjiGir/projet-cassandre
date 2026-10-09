"""Rame de service traversante et ses deux environnements d'arrêt.

see: docs/4-technique/blockout-metro.md#rame-de-fret-et-arrivée
"""
import math

import bpy

from tools.blender import geo_utils
from tools.metro.kit.materials import color
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install
from tools.metro.blockout.rail_architecture import track

FLOOR=-17.25
START=366
END=427.5
SIDES=(('ouest',37.55,366.75,369.75,369.75,373),
       ('est',41.25,423,426,419.75,423))
ROOF=((37.55,2.8),(37.8,3.04),(38.25,3.25),(40.75,3.25),(41.2,3.04),(41.45,2.8))


def endcap(p,y,base):
    outline=((37.55,base),(41.45,base))+tuple(reversed(ROOF))
    n=len(outline)
    vertices=[(x,yy,FLOOR+z) for yy in (y,y+.15) for x,z in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    p.mesh(vertices,faces,'fret_paroi')


def prepare_materials(a):
    for name,hexcode in (('fret_paroi','c6cab9'),('fret_pare_brise','243942'),
                         ('prive_pierre','aebec2'),('prive_sol','52636d')):
        mat=bpy.data.materials.new('n5_'+name)
        mat.use_nodes=True
        mat.diffuse_color=(*color(hexcode),1)
        bsdf=mat.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value=mat.diffuse_color
        bsdf.inputs['Roughness'].default_value=.25 if name=='fret_pare_brise' else .9
        a.mats[name]=mat


def empty(a,name,at):
    obj=bpy.data.objects.new(name,None)
    a.logic.objects.link(obj); obj.location=at
    return obj


def staged(a,p,stage):
    before=set(a.props.objects)
    install(a,p,(0,0,0))
    for obj in set(a.props.objects)-before: obj.parent=stage


def preview(departure,arrival,arrived=None):
    for stage,visible in ((departure,arrived is None or not arrived),(arrival,arrived is None or arrived)):
        for obj in stage.children_recursive:
            if obj.type=='MESH' and not obj.name.startswith('col_'): obj.hide_render=not visible


def shell(a):
    p=Piece('n5_fret_caisse',a.mats,'quatre caisses, fenêtres distinctes et toiture à pans arrondis')
    for side,x,door0,door1,pocket0,pocket1 in SIDES:
        windows=[]
        for i in range(4):
            start=START+i*15.5
            for offset in (2.15,5.05,7.95,10.85,13.45):
                lo,hi=start+offset-1.05,start+offset+1.05
                if lo<door1+.15 and hi>door0-.15 or lo<pocket1+.12 and hi>pocket0-.12: continue
                windows.append((lo,hi))
        holes=sorted([(door0,door1,'porte')]+[(lo,hi,'vitre') for lo,hi in windows])
        prev=START
        for lo,hi,kind in holes+[(END,END,'fin')]:
            if lo>prev: p.box((x,prev,FLOOR),(.2,lo-prev,2.8),'fret_paroi')
            if kind=='vitre':
                p.box((x,lo,FLOOR),(.2,hi-lo,1),'petrole')
                p.box((x,lo,FLOOR+2.35),(.2,hi-lo,.45),'fret_paroi')
                p.box((x+.085,lo+.07,FLOOR+1.07),(.03,hi-lo-.14,1.21),'verre')
                for yy in (lo,hi-.065): p.box((x-.015,yy,FLOOR+.97),(.23,.065,1.42),'acier')
                for z in (FLOOR+.97,FLOOR+2.325): p.box((x-.015,lo,z),(.23,hi-lo,.065),'acier')
            if kind=='porte':
                p.box((x,lo,FLOOR+2.8),(.2,hi-lo,.25),'fret_paroi')
                p.box((x-.12,lo-.1,FLOOR),(.44,.1,2.92),'acier')
                p.box((x-.12,hi,FLOOR),(.44,.1,2.92),'acier')
                p.box((x-.12,lo,FLOOR+2.9),(.44,hi-lo,.09),'acier')
                p.box((x-.2,lo,FLOOR+.005),(.6,hi-lo,.025),'acier')
            prev=hi
        for lo,hi in ((START,door0),(door1,END)):
            p.proxy((x,lo,FLOOR),(.2,hi-lo,3.05))
        pocket_x=x-.32 if side=='ouest' else x+.32
        p.box((pocket_x,pocket0,FLOOR),(.12,pocket1-pocket0,2.9),'petrole')
        for yy in (pocket0+.12,pocket1-.16):
            p.box((pocket_x-.015,yy,FLOOR+.2),(.15,.04,2.4),'acier')
    for i in range(4):
        lo=START+i*15.5; hi=lo+15
        for (x0,z0),(x1,z1) in zip(ROOF,ROOF[1:]):
            vertices=[(x,y,FLOOR+z+thick) for thick in (0,.12) for y in (lo,hi) for x,z in ((x0,z0),(x1,z1))]
            p.mesh(vertices,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(1,3,7,5),(3,2,6,7),(2,0,4,6)],'fret_paroi')
        p.box((37.55,lo,FLOOR-.25),(3.9,15,.08),'acier')
        for y in (lo+2.5,lo+12.5):
            p.box((38.3,y-.65,FLOOR-.48),(2.4,1.3,.24),'acier')
            for yy in (y-.4,y+.4):
                p.cylinder((39.5,yy,-17.525),.07,1.75,'acier','X')
                for x in (38.78,40.22): p.cylinder((x,yy,-17.525),.3,.18,'acier','X',16)
    endcap(p,END,0)
    for y in (START,END): p.proxy((37.55,y,FLOOR),(3.9,.15,3.37))
    p.box((37.55,START,FLOOR),(3.9,.15,1.03),'petrole')
    endcap(p,START,2.25)
    for x in (37.55,41.05): p.box((x,START,FLOOR+1.03),(.4,.15,1.22),'fret_paroi')
    p.box((37.95,START+.025,FLOOR+1.03),(3.1,.055,1.22),'fret_pare_brise')
    p.box((39.45,START-.015,FLOOR+1.03),(.1,.12,1.22),'acier')
    for x in (38.05,39.7):
        p.beam((x,START-.035,FLOOR+1.15),(x+.85,START-.035,FLOOR+1.7),.028,'acier')
    for x in (38.1,40.55): p.box((x,START-.07,FLOOR+.58),(.35,.07,.16),'lampe')
    p.box((38.92,START-.38,FLOOR-.14),(1.16,.38,.22),'acier')
    p.box((37.58,START-.025,FLOOR+.18),(3.84,.035,.12),'ambre')
    install(a,p,(0,0,0))
    for side,x,lo,hi,_,_ in SIDES:
        xx=x-.16 if side=='ouest' else x+.16
        parts=[{'o':(xx,lo,FLOOR),'s':(.14,hi-lo,2.88),'mat':None}]
        for yy in (lo+.14,hi-.19):
            parts.append({'o':(xx-.025,yy,FLOOR+.17),'s':(.19,.05,2.52),'mat':None})
        obj=geo_utils.build_multi_box_mesh('door_n5_rame_'+('entree' if side=='ouest' else 'sortie'),parts,'acier',a.mats)
        a.props.objects.link(obj)
        obj['mouvement'],obj['course'],obj['duree']='coulisse',3.25,.6
        obj['sens']='-' if side=='ouest' else '+'
        obj['referme'],obj['ouverte']=False,side=='ouest'


def cab(a):
    p=Piece('n5_fret_cabine',a.mats,'cabine avant fermée, embarquement latéral derrière le conducteur')
    p.box((37.75,START+.22,FLOOR),(3.5,.4,1.05),'petrole')
    p.box((37.72,START+.2,FLOOR+1.05),(3.56,.46,.1),'acier')
    p.box((40.1,START+.73,FLOOR+.45),(.62,.42,.12),'acier')
    p.box((40.1,START+1.02,FLOOR+.57),(.62,.09,.7),'petrole')
    p.box((37.75,START+1.2,FLOOR),(3.5,.1,2.8),'fret_paroi',True)
    p.box((39.0,START+1.305,FLOOR+.05),(1,.025,2.25),'acier')
    p.box((39.1,START+1.335,FLOOR+1.2),(.8,.025,.75),'fret_pare_brise')
    p.box((39.82,START+1.36,FLOOR+.92),(.04,.04,.24),'ivoire')
    install(a,p,(0,0,0))


def interior(a):
    p=Piece('n5_fret_interieur',a.mats,'soufflets ouverts, sièges rabattables et charges en bordure')
    for y in (381,396.5,412):
        for yy in (y+.03,y+.16,y+.29,y+.42):
            for x in (37.76,41.02): p.box((x,yy,FLOOR),(.22,.06,2.82),'acier')
            p.box((37.76,yy,FLOOR+2.8),(3.48,.06,.16),'acier')
            p.box((37.77,yy,FLOOR+.008),(3.46,.06,.015),'acier')
        for x in (37.99,40.93): p.box((x,y,FLOOR),(.07,.5,2.83),'petrole')
    for x in (37.82,40.5):
        for y in (414.5,):
            p.box((x,y,FLOOR),(.68,2.4,.12),'acier',True)
            p.box((x+.06,y+.09,FLOOR+.12),(.56,2.22,.84),'bois',True)
            for yy in (y+.45,y+1.86): p.box((x-.025,yy,FLOOR+.11),(.73,.06,.92),'petrole')
            for yy in (y,y+2.32):
                p.beam((x,yy,FLOOR),(x,yy,FLOOR+1.3),.055,'acier')
                p.beam((x+.68,yy,FLOOR),(x+.68,yy,FLOOR+1.3),.055,'acier')
                p.beam((x,yy,FLOOR+1.3),(x+.68,yy,FLOOR+1.3),.055,'acier')
    for i in range(4):
        y=START+i*15.5
        for x in (38.38,40.56):
            p.box((x,y+.18,FLOOR+.007),(.06,14.64,.015),'ambre')
        for yy in (() if i in (0,2) else (y+4,y+11)):
            for x in (38.13,40.87):
                p.beam((x,yy-1.55,FLOOR+2.6),(x,yy+1.55,FLOOR+2.6),.045,'acier')
                for dy in (-1.4,1.4): p.beam((x,yy+dy,FLOOR+2.6),(x,yy+dy,FLOOR+3.2),.035,'acier')
        for yy in (y+3.5,y+10.5):
            for x in (38.65,40.2):
                p.box((x,yy-1.5,FLOOR+3.02),(.15,3,.1),'acier')
                p.box((x+.025,yy-1.4,FLOOR+2.985),(.1,2.8,.035),'lampe')
                for dy in (-1,1): p.beam((x+.075,yy+dy,FLOOR+3.12),(x+.075,yy+dy,FLOOR+3.25),.035,'acier')
            a.point('n5_fret_plafond_'+str(yy),(39.5,yy,FLOOR+2.78),'#dce5d4',9,11)
    install(a,p,(0,0,0))


def boarding_environment(a,stage):
    p=Piece('n5_fret_garage',a.mats,'garage fermé autour de la rame, masqué pendant le voyage')
    p.box((34.75,366,-17.5),(3,4,.25),'sol',True)
    p.box((34.75,365,-17.75),(3,1,.25),'sol',True)
    p.box((34.75,364,-18),(3,1,.25),'sol',True)
    # Les enveloppes masquées restent visuelles : leurs collisions persisteraient au quai d'arrivée.
    p.box((32.5,366,-18),(13.75,62,.2),'sol')
    p.box((32.5,366,-18),(.25,62,6.25),'beton')
    p.box((46,366,-18),(.25,62,6.25),'beton')
    p.box((32.5,427.75,-18),(13.75,.25,6.25),'beton')
    p.box((32.5,366,-11.75),(13.75,62,.2),'beton')
    track(p,((39.5,366,-18),(39.5,427.5,-18)))
    for y in (372,387.5,403,418.5):
        p.box((32.5,y,-12.1),(13.75,.2,.35),'acier')
        for x in (33.6,44.9):
            p.box((x,y-.7,-12.65),(.22,1.4,.15),'acier')
            p.box((x+.04,y-.6,-12.685),(.14,1.2,.035),'lampe')
            p.beam((x+.11,y,-12.5),(x+.11,y,-12.1),.035,'acier')
    # Fermeture entre le dépôt et le quai privé, déjà présente dans le blockout.
    p.box((41.25,365.8,-18),(18,.2,6.75),'beton',True)
    staged(a,p,stage)
    for name,at in (('n5_departure_ref',(34,367,FLOOR)),('n5_arrival_ref',(44,425,FLOOR))): empty(a,name,at)




def build(a,departure,arrival):
    frame=empty(a,'n5_voyage_centre',(39.5,396.75,FLOOR))
    shell(a)
    cab(a)
    interior(a)
    from tools.metro.blockout.freight_entry_seating import build as entry_seating
    entry_seating(a)
    from tools.metro.blockout.freight_service_cargo import build as service_cargo
    service_cargo(a)
    from tools.metro.blockout.freight_crew_seating import build as crew_seating
    crew_seating(a)
    from tools.metro.blockout.freight_departure_console import build as departure_console
    departure_console(a)
    boarding_environment(a,departure)
    from tools.metro.blockout.private_station import build as private_station
    private_station(a,arrival)
    return frame
