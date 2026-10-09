"""Blockout N5 complet ; recette C.metro_blockout().

see: docs/4-technique/blockout-metro.md#reproduire
"""
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
sys.path.insert(0,str(ROOT/"tools/blender"))
sys.path.insert(0,str(ROOT/"tools/metro/layout"))
import cassandre as C
from tools.blender import geo_utils
from tools.metro.blockout import layout as P
from tools.metro.layout.produce_plan import prepare
from tools.metro.quartier.build_pilot import main as quartier
from tools.metro.blockout.geometry import build_support, HEIGHT
from tools.metro.blockout.traffic_layout import branch, attach, extended_route, hidden_surfaces
from tools.metro.blockout.rail_architecture import build as rail_architecture, prepare_materials
from tools.metro.blockout.station_head import platform_guard
from tools.metro.blockout.station_ticket_hall import build as station_ticket_hall
from tools.metro.blockout.station_descent import build as station_descent
from tools.metro.blockout.station_dressing import build as station_dressing
from tools.metro.blockout.control_panels import create as control_panel
from tools.metro.blockout.refuge_controls import create as refuge_control
from tools.metro.blockout.service_galleries import build as service_galleries
from tools.metro.blockout.depot_workshop import build as depot_workshop
from tools.metro.blockout.switching_post import build as switching_post
from tools.metro.blockout.machinery_room import build as machinery_room
from tools.metro.blockout.freight_carriage import build as freight, prepare_materials as prepare_freight_materials, preview as preview_freight
from tools.metro.blockout.tower_approach import build as tower_approach
from tools.metro.blockout.encounters import build as encounters

OUT = ROOT/"assets_src/blender/metro_blockout.blend"
GLB = ROOT/"public/assets/levels/metro_blockout.glb"
REPORT = ROOT/"docs/assets/blockout-metro"


def marker(a,name,at=(0,0,0),**extras):
    obj=bpy.data.objects.new(name,None)
    a.logic.objects.link(obj)
    obj.location=at
    for key,value in extras.items(): obj[key]=value
    return obj


def volume(a,name,origin,size,lane):
    obj=geo_utils.build_proxy_object(name,"box",origin,size)
    a.logic.objects.link(obj)
    obj["voie"]=lane
    return obj


def control(a,name,at,label,angle=0,target=None):
    return control_panel(a,name,at,angle,label,target,
                         variant='stop' if '_stop_' in name else 'start',
                         mount='wall')


def upgrade_access_controls(a):
    for name,caption in (('use_quartier_trappe','TRAPPE'),('use_quartier_grille','GRILLE'),('use_n5_raccourci','RACCOURCI')):
        old=bpy.data.objects.get(name)
        if old is None: continue
        at=tuple(old.location); angle=math.pi if name=='use_quartier_grille' else old.rotation_euler.z; extras=dict(old.items())
        for obj in (old,bpy.data.objects.get('kit_quartier_'+name+'_voyant')):
            if obj: bpy.data.objects.remove(obj,do_unlink=True)
        trappe=name=='use_quartier_trappe'
        if trappe:
            for obsolete in ('kit_quartier_support_trappe','col_box_quartier_support_trappe'):
                obj=bpy.data.objects.get(obsolete)
                if obj: bpy.data.objects.remove(obj,do_unlink=True)
        body=control_panel(a,name,at,angle,label=caption,target=extras.get('target'),variant='start',
                           mount='pedestal' if trappe else 'wall',pedestal_height=1.1)
        for key,value in extras.items(): body[key]=value
        if name=='use_quartier_grille':
            a.box('n5_grille_potelet',(-2.31,84.04,-5),(.22,.2,.91),'acier',True)
            a.box('n5_grille_socle',(-2.42,83.98,-5),(.44,.35,.08),'acier',True)


def traffic(a):
    library=ROOT/"assets_src/library/lib_metro_N3.blend"
    with bpy.data.libraries.load(str(library),link=False) as (available,loaded):
        loaded.collections=[n for n in available.collections if n=="kit_metro_voiture_ligne_15m"]
    for collection in loaded.collections:
        bpy.data.collections["_LIB"].children.link(collection)
        a.assets[collection.name.removeprefix("kit_metro_")]=collection
    model=marker(a,"train_modele_n5")
    for obj in a.place("voiture_ligne_15m",(-1.4,-7.5,0),collision=False):
        obj.parent=model
        obj.matrix_parent_inverse=Matrix.Identity(4)
    defs=[("A",tuple(reversed(P.ROUTES[0].points)),True,8),
          ("B",P.ROUTES[1].points,True,23),
          ("VB",tuple(reversed(P.B_POINTS)),False,12)]
    _,_,vb_points=branch()
    defs=[(lane,vb_points if lane=="VB" else points,enabled,first) for lane,points,enabled,first in defs]
    for lane,points,enabled,first in defs:
        extended=extended_route(lane,points)
        names=[]
        for i,point in enumerate(extended):
            name=f"rail_n5_{lane}_{i}"
            marker(a,name,point)
            names.append(name)
        length=sum(math.dist(p,q) for p,q in zip(points,points[1:]))
        marker(a,"voie_n5_"+lane,voie=lane,trajet="ligne",points=",".join(names),
               debut_visible=160,fin_visible=160+length,premier=first,active=enabled,
               marge_visuelle=64)
        for i,(p,q) in enumerate(zip(points,points[1:])):
            delta=Vector(q)-Vector(p)
            distance=math.hypot(delta.x,delta.y)
            lo=[min(p[k],q[k]) for k in range(3)]
            size=[max(.25,abs(q[k]-p[k])) for k in range(3)]
            volume(a,f"nav_voie_n5_{lane}_{i}",(lo[0]-1.8,lo[1]-1.8,lo[2]-.25),(size[0]+3.6,size[1]+3.6,size[2]+3.5),lane)
        for number,along in enumerate([4+P.SIGNAL_SPACING*i for i in range(max(1,math.ceil((length-4)/P.SIGNAL_SPACING))) ]):
            remaining=min(along,length-1)
            for p,q in zip(points,points[1:]):
                span=math.dist(p,q)
                if remaining<=span:
                    center=Vector(p).lerp(Vector(q),remaining/span); break
                remaining-=span
            marker(a,f"signal_train_n5_{lane}_{number}",tuple(center+Vector((0,0,3.8))),voie=lane,aspect="feu")
            ceiling=3.55+3.7*math.sin(math.pi*(center.x+9)/18) if lane=="B" or lane=="A" and center.y<190 else 4.5
            a.box(f"n5_suspente_signal_{lane}_{number}",(center.x-.04,center.y-.04,center.z+4.06),(.08,.08,ceiling-4.06),"acier",False)
    for lane,x in (("A",-9),("B",4)):
        volume(a,"refuge_train_n5_quai_"+lane,(x,118,P.QUAI_Z),(5,72,3),lane)
        for y in (134,172):
            volume(a,f"traversee_train_n5_{lane}_{y}",(-4,y-1.5,P.RAIL_Z-.25),(8,3,4),lane)
    bx,by,_=P.B_POINTS[-1]
    for i,y in enumerate((by+22,)):
        volume(a,"refuge_train_n5_sas_b_"+str(i),(bx-5,y-.5,-18),(.6,1,2.8),"VB")
        a.point("n5_sas_b_refuge_"+str(i),(bx-4.3,y,-15.6),"#91b6a4",5,6)
    for i,niche in enumerate(P.NICHES):
        lane="A" if niche.groupe=="tunnel_a" else "VB"
        _,(cx,cy,cz)=refuge_control(a,niche,i)
        volume(a,f"refuge_train_n5_{lane}_{i}",(cx-.3,cy-.3,cz),(.6,.6,2.8),lane)



def main():
    a=quartier(save=False)
    prepare_materials(a)
    prepare_freight_materials(a)
    scene=bpy.context.scene
    scene["cassandre_etape"]="blockout_N5"
    for obj in list(scene.objects):
        if obj.name.startswith(("kit_quartier_billets_","col_box_quartier_billets_","kit_quartier_arriere_guichet_sol","col_box_quartier_arriere_guichet_sol","kit_quartier_guichet_","col_box_quartier_guichet_")) or obj.get("inscription")=="QUAIS — HORS PILOTE":
            bpy.data.objects.remove(obj,do_unlink=True)
    floors=[s for s in prepare(P) if s.groupe!="quartier" and s.groupe!="secret_1" and not s.id.startswith(("descente_public","descente_service"))]
    # Le toit S3 sera posé avec sa rame au lot N7 ; son ancien proxy coupait VB.
    floors=[s for s in floors if s.groupe not in ("depot","secret_3")]
    floors.extend(s for s in P.SURFACES if s.groupe=="depot")
    _,additions,_=branch()
    floors=attach(floors,additions)
    floors=attach(floors,hidden_surfaces())
    connections=[P.Surface("raccord_public","descente",((-2.25,83,-5),(2.25,83,-5),(2.25,84,-5),(-2.25,84,-5))),
                 P.Surface("raccord_service","descente",((25,83,-5),(27,83,-5),(27,84,-5),(25,84,-5))),
                 P.Surface("raccord_quai_service","fret",((34.75,366,-17.25),(37.75,366,-17.25),(37.75,370,-17.25),(34.75,370,-17.25)))]
    bx,by,_=P.B_POINTS[-1]
    connections.append(P.Surface("raccord_origine_b","tunnel_b",((bx-3.5,by+32,-18),(bx+3.5,by+32,-18),(bx+3.5,by+56,-18),(bx-3.5,by+56,-18))))
    departure=marker(a,"stage_voyage_depart")
    arrival=marker(a,"stage_voyage_arrivee")
    spaces=[]
    for s in floors:
        objects=build_support(a,s,floors+connections)
        stage=departure if s.groupe=="depot" else arrival if s.groupe in ("privee","remontee","parvis") else None
        if stage:
            for obj in objects: obj.parent=stage
        xs,ys,zs=zip(*s.points)
        spaces.append({"id":s.id,"nom":s.groupe,"x":[min(xs),max(xs)],"z":[-max(ys),-min(ys)],"y":[min(zs)-.5,max(zs)+HEIGHT.get(s.groupe,3.5)]})
    a.box("n5_fond_fosse",(97.5,334,-26.25),(12,16,.25),"ardoise")
    for x in (-3.9,3.9):
        for lo,hi in ((118,132.5),(135.5,170.5),(173.5,190)):
            platform_guard(a,x,lo,hi)
    bx,by,_=P.B_POINTS[-1]
    station_ticket_hall(a)
    station_descent(a)
    station_dressing(a)
    switching_post(a)
    machinery_room(a)
    # Grille au dernier tronçon rectiligne, commande depuis le retour de service.
    gate=a.box("n5_grille_tunnel",(37,294,P.hauteur_y(P.A_POINTS,294)),(4.5,.15,4.5),"acier",False)
    gate.name="door_n5_tunnel"
    gate["mouvement"],gate["course"],gate["referme"]="monte",4.75,False
    marker(a,"n5_grille_centre",(39.25,294,P.hauteur_y(P.A_POINTS,294)))
    service_galleries(a,gate)
    traffic(a)
    for lane,x,y in (("A",-6.5,134),("B",6.5,172)):
        marker(a,"signal_train_n5_affiche_"+lane,(x,y,P.QUAI_Z+3),voie=lane,aspect="ecran")
        a.box("n5_suspente_affiche_"+lane,(x-.025,y-.025,P.QUAI_Z+3.45),(.05,.05,2.9),"acier",False)
    freight(a,departure,arrival)
    tower_stage=marker(a,"stage_voyage_quartier_tour")
    for obj in a.props.objects:
        if "repere_tour_56m" in obj.name: obj.parent=tower_stage
    for obj in a.place("repere_tour_56m",(36,500.5,0),collision=False,
                       omit=lambda obj: obj.type=='MESH' and max(v.co.z for v in obj.data.vertices)<=6.01): obj.parent=arrival
    tower_approach(a,arrival)
    for group in {s.groupe for s in floors}:
        members=[s for s in floors if s.groupe==group]
        if group in ('galeries','depot','poste','machinerie','fret','privee','remontee','parvis','secret_2'): continue
        if group in ("billets","quais","depot","privee","parvis"):
            for i,s in enumerate(members):
                if group=="quais" and s.id.startswith("voie_"): continue
                xs,ys,zs=zip(*s.points)
                nx=max(1,math.ceil((max(xs)-min(xs))/16)); ny=max(1,math.ceil((max(ys)-min(ys))/12))
                from tools.metro.blockout.geometry import contains, height
                for ix in range(nx):
                    for iy in range(ny):
                        xy=(min(xs)+(ix+.5)*(max(xs)-min(xs))/nx,min(ys)+(iy+.5)*(max(ys)-min(ys))/ny)
                        if not contains(s.points,xy): continue
                        a.point(f"n5_{group}_{i}_{ix}_{iy}",(*xy,height(s.points,xy)+min(HEIGHT[group]-.4,4)),"#cdd6cf",12,20)
            continue
        for i,s in enumerate(members):
            if s.id.startswith('escalier_quais'): continue
            if i%max(1,len(members)//P.LAMP_BUDGET.get(group,4)): continue
            x=sum(p[0] for p in s.points)/len(s.points); y=sum(p[1] for p in s.points)/len(s.points); z=sum(p[2] for p in s.points)/len(s.points)
            if group=='tunnel_a' and y<218: continue
            a.point(f"n5_{group}_{i}",(x,y,z+min(HEIGHT.get(group,3.5)-.4,4)),"#cdd6cf" if group in ("billets","quais","privee") else "#d4b58a",12,18)
    rail_architecture(a)
    depot_workshop(a,departure)
    upgrade_access_controls(a)
    encounters(a)
    scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value=.18
    bpy.context.view_layer.update()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
    GLB.parent.mkdir(parents=True,exist_ok=True)
    (GLB.parent/"metro_blockout.espaces.json").write_text(json.dumps({"espaces":spaces},ensure_ascii=False,indent=2)+"\n")
    REPORT.mkdir(parents=True,exist_ok=True)
    (REPORT/"assemblage.json").write_text(json.dumps({"source":str(OUT.relative_to(ROOT)),"supports":len(floors),"niches":len(P.NICHES),"route":"quartier → billets → quais → A / galeries → dépôt → aiguillage et courant → rame → privée → parvis"},ensure_ascii=False,indent=2)+"\n")
    result=C.export(out=GLB,niveau="metro")
    if not result.get("ok"): raise RuntimeError(result)
    if '--sans-apercus' in sys.argv:
        print('[metro-blockout] '+json.dumps({'blend':str(OUT),'export':result}))
        return
    preview_freight(departure,arrival,True)
    for name,x,y,cap,floor in (("remontee_bas",50,431,0,P.ascent_z(431)),("remontee_palier",50,448.5,0,-8.5),
                               ("remontee_debouche",50,464,0,P.ascent_z(464)),("parvis_tour",50,472,0,0),
                               ("parvis_retour",50,477,180,0),("tour_hall",50,496.5,0,0)):
        print("[metro-blockout-shot] "+json.dumps(C.shot((x,y,cap),mode="material",sol=floor,nom="n5_"+name)))
    for name,x,y,cap in (("fret_interieur",39.5,373,0),("fret_commande",39.5,424.1,0),("privee_quai",46,424,180),("privee_sortie",46,424,0)):
        preview_freight(departure,arrival,name.startswith('privee'))
        print("[metro-blockout-shot] "+json.dumps(C.shot((x,y,cap),mode="material",sol=-17.25,nom="n5_"+name)))
    preview_freight(departure,arrival,False)
    for name,x,y,cap in (("machinerie_ventilation",103.5,330,0),("machinerie_force",115,354.5,0),("machinerie_retour",93,354,90),
                         ("machinerie_local",125.5,343.1,285)):
        print("[metro-blockout-shot] "+json.dumps(C.shot((x,y,cap),mode="material",sol=-22,nom="n5_"+name)))
    for name,x,y,cap,floor in (("poste_entree",bx+1,by,90,-18),("poste_escalier",bx-1,by,90,-18),("poste_cabine",bx-9,by-.5,0,-16)):
        print("[metro-blockout-shot] "+json.dumps(C.shot((x,y,cap),mode="material",sol=floor,nom="n5_"+name)))
    for name,x,y,cap in (("depot_entree",43.7,325,0),("depot_maintenance",60,333,0),
                         ("depot_ouest",46,348,90),("depot_atelier_seuil",49.5,330,270),
                         ("depot_quai",40,362,0),("depot_approche_rame",45,359,35),
                         ("depot_quai_oblique",35.5,362,325),
                         ("depot_mur_fret",45,363,0),
                         ("depot_poste_coude",14,348.7,55),("depot_poste_retour",29.35,361.36,270)):
        print("[metro-blockout-shot] "+json.dumps(C.shot((x,y,cap),mode="material",sol=-18,nom="n5_"+name)))
    for name,x,y,cap in (("galerie_interieur",10,215.25,270),("galerie_nord",63.75,225,0),("galerie_commande",47,303.25,90)):
        print("[metro-blockout-shot] "+json.dumps(C.shot((x,y,cap),mode="material",sol=P.galerie_z(x,y),nom="n5_"+name)))
    print("[metro-blockout-shot] "+json.dumps(C.shot((77,261.25,270),mode="material",sol=-15.55,nom="n5_local_agents")))
    for name,x,y,cap in (("borne_billets",-13,87,90),("banc_quai",-6.5,142,40),("plan_quai",-6.5,146,90),("descente_haut",-6.5,105,0),("descente_palier",-6.5,112.2,0),("descente_bas",-6.5,120,180),("guichet_service",26,85.5,90),("guichet_sortie_service",17,87,0),("billets_arrivee",0,86,0),("guichet",2,89,270),("validation",-6.5,94,0),("validation_retour",-6.5,104,180)):
        print("[metro-blockout-shot] "+json.dumps(C.shot((x,y,cap),mode="material",sol=-9 if name=="descente_palier" else P.QUAI_Z if name in ("banc_quai","plan_quai","descente_bas") else -5,nom="n5_"+name)))
    for name,pose,floor in (("tete_station",(-6.5,184,0),P.QUAI_Z),("tunnel",(-2,207,0),P.hauteur_y(P.A_POINTS,207)),("billets",(0,88,0),-5),("descente",(-6.5,105,0),-5),("quais",(-6.5,125,0),P.QUAI_Z),("galeries",(-2,215,270),P.hauteur_y(P.A_POINTS,215)),("galeries_retour",(5,215,90),P.galerie_z(5,215)),("depot",(44,329,0),-18),("privee",(49,418,0),-17.25)):
        preview_freight(departure,arrival,name=='privee')
        print("[metro-blockout-shot] "+json.dumps(C.shot(pose,mode="material",sol=floor,nom="n5_"+name)))
    preview_freight(departure,arrival)
    print("[metro-blockout] "+json.dumps({"blend":str(OUT),"export":result}))


if __name__=="__main__": main()
