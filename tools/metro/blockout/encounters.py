"""Première passe de rencontres du métro ; marqueurs glTF et ressources."""
import json
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from tools.blender import geo_utils
from tools.metro.blockout import layout as P


GROUPS = {
    'metro_quartier': ('costard', ((-10,50,0),(10,54,0),(9,63,0))),
    'metro_billets_tireurs': ('costard', ((-12,93,-5),(-13,104,-5))),
    'metro_billets_garde': ('vigile', ((-11.5,101,-5),)),
    'metro_quais_sud': ('costard', ((-6.5,141,P.QUAI_Z),(6.5,145,P.QUAI_Z),(6.5,154,P.QUAI_Z))),
    'metro_quais_nord': ('costard', ((-6.5,173,P.QUAI_Z),(6.5,176,P.QUAI_Z))),
    'metro_quais_garde': ('vigile', ((-6.5,171,P.QUAI_Z),)),
    'metro_galerie_entree': ('rampant', ((23,215.25,None),(40,219.25,None))),
    'metro_galerie_coude': ('rampant', ((69.75,261,None),(69.75,266,None),(63.75,283,None))),
    'metro_galerie_retour': ('rampant', ((63.75,300,None),(45,303.25,None))),
    'metro_depot_tireurs': ('costard', ((45,345,-18),(58,351,-18),(64,355,-18))),
    'metro_depot_garde': ('vigile', ((47,358,-18),)),
    'metro_acces_poste': ('vigile', ((10,348.7,-18),)),
    'metro_machinerie_tireurs': ('costard', ((95,329,-22),(115,329,-22))),
    'metro_machinerie_meute': ('rampant', ((113,352,-22),(114,343,-22))),
    'metro_rame_1_nord': ('rampant', ((39.5,419,-17.25),(39.5,423,-17.25))),
    'metro_rame_1_sud': ('rampant', ((39.5,371.5,-17.25),(39.5,375,-17.25))),
    'metro_rame_2_nord': ('rampant', ((39.5,417,-17.25),(39.5,420.75,-17.25),(39.5,422,-17.25))),
    'metro_rame_2_sud': ('rampant', ((39.5,369.5,-17.25),(39.5,373.25,-17.25),(39.5,376.5,-17.25))),
    'metro_arrivee': ('costard', ((58,419,-17.25),(58,426,-17.25))),
    'metro_parvis_tireurs': ('costard', ((32,489,0),(62,491,0),(50,493,0))),
    'metro_parvis_garde': ('vigile', ((50,495,0),)),
}

TRIGGERS = (
    ('quartier','metro_quartier',(-8,26,-.5),(16,4,3)),
    ('billets','metro_billets',(9,89.8,-5.4),(9,4,3)),
    ('quais_sud','metro_quais_sud',(-9,119,-13.4),(5,3,3)),
    ('quais_nord','metro_quais_nord',(-9,150,-13.4),(18,3,3)),
    ('galerie_entree','metro_galerie_entree',(2,213.75,P.galerie_z(2,215.25)-.4),(5,3,3)),
    ('galerie_coude','metro_galerie_coude',(62.25,238,-16),(3,5,3)),
    ('galerie_retour','metro_galerie_retour',(62.25,278,-17.5),(3,4,4)),
    ('depot','metro_depot',(37.5,322,-18.4),(4,3,3)),
    ('acces_poste','metro_acces_poste',(26,346,-18.4),(3,20,3)),
    ('machinerie_sud','metro_machinerie',(70,327.5,-19),(3,5.5,4)),
    ('machinerie_nord','metro_machinerie',(70,350.5,-19),(3,5.5,4)),
    ('parvis','metro_parvis',(48,466.5,-.4),(4,3.5,3)),
)

PICKUPS = (
    ('soin_rue',(1.5,20,-.25),'soin',50),
    ('ammo_rue',(1.5,25,-.25),'munitions',24),
    ('soin_billets',(-15,92,-5),'soin',25),
    ('ammo_billets',(-15,94,-5),'munitions',24),
    ('soin_vestiaire',(78,261,-15.55),'soin',25),
    ('ammo_vestiaire',(78,263,-15.55),'munitions',24),
    ('ammo_depot',(49,327,-18),'munitions',36),
    ('soin_depot',(49,329,-18),'soin',50),
    ('soin_machinerie',(93,354,-22),'soin',25),
    ('ammo_machinerie',(115,355,-22),'munitions',24),
    ('soin_rame',(39.5,400.5,-17.25),'soin',25),
    ('ammo_rame',(39.5,402,-17.25),'munitions',36),
    ('soin_parvis',(50,470,0),'soin',25),
)


def inspect_positions(a,spawns):
    bpy.context.view_layer.update()
    vertices=[]
    faces=[]
    for obj in a.col.objects:
        if obj.type!='MESH': continue
        offset=len(vertices)
        vertices.extend(obj.matrix_world @ vertex.co for vertex in obj.data.vertices)
        faces.extend(tuple(offset+index for index in face.vertices) for face in obj.data.polygons)
    tree=BVHTree.FromPolygons(vertices,faces)
    readings=[]
    errors=[]
    capsules={'costard':(.4,.5),'vigile':(.5,.5),'rampant':(.35,.25)}
    positions=[(item['nom'],item['pieds'],*capsules[item['espece']]) for item in spawns]
    positions += [('use_metro_'+name,at,.3,0) for name,at,_,_ in PICKUPS]
    for name,(x,y,z),radius,half_height in positions:
        hit,_,_,_=tree.ray_cast(Vector((x,y,z+.8)),Vector((0,0,-1)),1.8)
        ground=None if hit is None else hit.z
        heights=(radius+.015,radius+half_height,radius+2*half_height) if half_height else (.4,)
        clearance=min(tree.find_nearest(Vector((x,y,z+high)))[3] for high in heights)
        readings.append({'nom':name,'sol':ground,'rayon':radius,'degagement':round(clearance,3)})
        if ground is None or abs(ground-z)>.12:
            errors.append(f'{name} : sol attendu {z:.2f}, sol trouvé {ground}')
        if clearance<radius+.01:
            errors.append(f'{name} : obstacle à {clearance:.3f} m, rayon {radius}')
    if errors: raise ValueError('\n'.join(errors))
    return readings


def build(a):
    spawns=[]
    for group,(kind,points) in GROUPS.items():
        prefix={'costard':'suit','rampant':'rampant','vigile':'vigile'}[kind]
        for index,(x,y,z) in enumerate(points,1):
            z=P.galerie_z(x,y) if z is None else z
            obj=bpy.data.objects.new(f'spawn_{prefix}_{group}_{index:02d}',None)
            a.logic.objects.link(obj)
            obj.location=(x,y,z+.02)
            obj['groupe']=group
            spawns.append({'nom':obj.name,'groupe':group,'espece':kind,'pieds':list(obj.location)})
    placement=inspect_positions(a,spawns)
    for name,event,origin,size in TRIGGERS:
        obj=geo_utils.build_proxy_object('trig_metro_'+name,'box',origin,size)
        a.logic.objects.link(obj)
        obj['evenement']=event
    for name,(x,y,z),property_name,amount in PICKUPS:
        obj=a.box('ramassage_'+name,(x-.12,y-.12,z+.08),(.24,.24,.16),'petrole',False)
        obj.name='use_metro_'+name
        obj[property_name]=amount
    root=Path(__file__).resolve().parents[3]
    (root/'docs/assets/blockout-metro/rencontres.json').write_text(json.dumps({
        'spawns':spawns,
        'implantation':placement,
        'declencheurs':[{'nom':name,'evenement':event,'origine':origin,'taille':size} for name,event,origin,size in TRIGGERS],
        'ramassages':[{'nom':name,'pieds':at,'propriete':prop,'quantite':amount} for name,at,prop,amount in PICKUPS],
    },ensure_ascii=False,indent=2)+'\n')
