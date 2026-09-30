"""Six ensembles ponctuels ; empreintes des grands meubles conservées."""
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

import lib_helpers as H
import lib_rayons as L

REGIONS = json.loads((Path(H.TEX_DIR) / "sig_compositions.json").read_text())["regions"]
HEADS = (("ry1s0_sud", "cola"), ("ry2s1_sud", "reassort"))


def bandeau(name, region, x, y, z, width, height, props):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x,y,z),(x+width,y,z),(x+width,y,z+height),(x,y,z+height)], [], [(0,1,2,3)])
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    px, py, w, h = REGIONS[region]
    for loop, coord in zip(uv.data, ((px/128,1-(py+h)/128),((px+w)/128,1-(py+h)/128),
                                    ((px+w)/128,1-py/128),(px/128,1-py/128))):
        loop.uv = coord
    mesh.materials.append(H.textured_material("sig_compositions"))
    obj = bpy.data.objects.new(name, mesh)
    props.objects.link(obj)


def galerie(props, col_coll):
    # Rack mobile, à côté du kiosque presse ; allée sud encore large de 5 m.
    H.boxes("comp_ga_presse_support", [
        ((-24.7,5.25,0,-23.8,5.75,.12),"world"),
        ((-24.6,5.62,.12,-24.5,5.72,1.75),"world"),
        ((-24.0,5.62,.12,-23.9,5.72,1.75),"world"),
        ((-24.7,5.58,1.55,-23.8,5.72,1.8),"world"),
    ], "metal_peint_rouge", props, subdiv=.75)
    H.boxes("comp_ga_presse_tablettes", [
        ((-24.65,5.27,z,-23.85,5.65,z+.035),"world") for z in (.4,.9,1.4)
    ], "metal_bac_acier", props, subdiv=10)
    magazines=[]
    for row, z in enumerate((.435,.935,1.435)):
        for i in range(3):
            label=("mag_verite","mag_ovni","mag_stars")[(row+i)%3]
            magazines.append(((-24.59+i*.25,5.29,z,-24.37+i*.25,5.36,z+.27),f"label:{label}","-y"))
    H.boxes("comp_ga_presse_journaux", magazines, "prd_kiosque", props, subdiv=10)
    bandeau("comp_ga_presse_titre","presse",-24.69,5.565,1.62,.88,.11,props)
    H.col_box("comp_ga_presse",(-24.7,5.25,0,-23.8,5.75,1.8),col_coll)

    # Coin inutilisé du comptoir désimlock ; pas de débord sur l'allée.
    H.boxes("comp_ga_reparation_poste", [
        ((8.45,6.12,1.06,9.45,6.67,1.08),"aplat:#1f5fbf"),
        ((9.2,6.3,1.08,9.42,6.64,1.45),"aplat:#444a54"),
        ((8.8,6.32,1.08,8.95,6.6,1.12),"aplat:#2f3541"),
        ((8.53,6.5,1.09,8.83,6.56,1.12),"aplat:#605c58"),
        ((8.54,6.5,1.09,8.62,6.56,1.13),"aplat:#d8231f"),
        ((8.98,6.16,1.08,9.11,6.4,1.13),"aplat:#605c58"),
    ], "palette", props, subdiv=10)
    H.boxes("comp_ga_reparation_ecrans", [
        ((8.82,6.34,1.122,8.93,6.56,1.125),"aplat:#111014"),
    ], "palette", props, subdiv=10)
    phone = H.box("comp_ga_reparation_telephone",(0,0,0,.19,.34,.035),
                  "palette",props,uv="aplat:#2f3541",subdiv=10)
    screen = H.box("comp_ga_reparation_telephone_ecran",(.02,.03,.036,.17,.3,.038),
                   "palette",props,uv="aplat:#b5d2e8",subdiv=10)
    transform=Matrix.Translation(Vector((8.54,6.18,1.08))) @ Matrix.Rotation(math.radians(62),4,"X")
    for obj in (phone,screen):
        obj.data.transform(transform)
        obj.data.update()
    bandeau("comp_ga_reparation_titre","reparation",8.45,6.075,1.08,1,.125,props)
    return {"ensembles":2,"proxies ajoutes":1}


def nourriture(g, model, height, x, y, z, angle=0):
    asset = L.kenney_produit(model, height)
    source = bpy.data.collections[asset].objects[0].data.copy()
    lo = Vector(tuple(min(v.co[i] for v in source.vertices) for i in range(3)))
    h = max(v.co.z for v in source.vertices)-lo.z
    for vertex in source.vertices:
        vertex.co = (vertex.co-lo)*(height/h)
    g.add(source,"prd_kenney",x,y,z,-1,angle)
    bpy.data.meshes.remove(source)


def cafeteria(props):
    H.boxes("comp_ca_repas_plateau", [
        ((38.4,9.4,.75,39.2,9.96,.765),"world"),
        ((38.4,9.4,.765,38.425,9.96,.79),"world"),
        ((39.175,9.4,.765,39.2,9.96,.79),"world"),
        ((38.4,9.4,.765,39.2,9.425,.79),"world"),
        ((38.4,9.935,.765,39.2,9.96,.79),"world"),
    ],"metal_bac_acier",props,subdiv=10)
    g=L.Garnissage()
    nourriture(g,"sandwich",.13,38.48,9.55,.765,-12)
    nourriture(g,"cup-coffee",.15,38.96,9.54,.765,20)
    nourriture(g,"utensil-fork",.014,38.75,9.65,.77,0)
    g.finish("comp_ca_repas",props)
    H.box("comp_ca_repas_serviette",(39.25,9.5,.75,39.58,9.83,.754),
          "mur_platre",props,subdiv=10)

    g=L.Garnissage()
    nourriture(g,"cup-tea",.16,43.35,14.45,.75,0)
    nourriture(g,"cup-coffee",.15,44.25,15.15,.75,130)
    g.finish("comp_ca_pause",props)
    H.boxes("comp_ca_pause_journal",[
        ((43.68,14.7,.75,44.13,15.18,.765),"label:mag_verite","+z"),
    ],"prd_kiosque",props,subdiv=10)
    # Travail de pause : dossier cartonné et trois fiches, face au second siège.
    H.box("comp_ca_pause_dossier",(43.3,15.23,.75,43.7,15.65,.767),
          "carton",props,subdiv=10)
    H.box("comp_ca_pause_feuille",(43.34,15.26,.768,43.66,15.6,.771),
          "mur_platre",props,subdiv=10)
    return {"ensembles":2,"proxies ajoutes":0}


def rayons(props):
    for suffix, composition in HEADS:
        proxies=[o for o in bpy.context.scene.objects if o.name.startswith("col_box_") and o.name.endswith("_"+suffix)]
        if len(proxies)!=1:
            raise RuntimeError(f"Tête attendue introuvable : {suffix}")
        points=[proxies[0].matrix_world@Vector(c) for c in proxies[0].bound_box]
        x=min(p.x for p in points);y=min(p.y for p in points)
        old=[o for o in bpy.context.scene.objects
             if (o.name.endswith("_"+suffix) and any("_"+m+"_" in o.name for m in L.Garnissage.MATERIAUX))
             or o.name=="comp_ry_"+composition+"_produits"]
        if not old:
            raise RuntimeError(f"Garnissage attendu absent : {suffix}")
        for obj in old:
            mesh=obj.data
            bpy.data.objects.remove(obj,do_unlink=True)
            if mesh.users==0:bpy.data.meshes.remove(mesh)
        parts=[]
        levels=(.15,.54,.94,1.34,1.74)
        for level,z in enumerate(levels):
            count=4 if composition=="cola" else (3,0,2,1,0)[level]
            for i in range(count):
                xx=x+.11+i*.255
                label="soda_5g_cola" if composition=="cola" else "lessive_profonde"
                parts.append(((xx,y+.065,z,xx+.21,y+.27,z+.23),f"label:{label}","-y"))
                if composition=="cola":
                    parts.append(((xx,y+.33,z,xx+.21,y+.54,z+.23),f"label:{label}","-y"))
        H.boxes("comp_ry_"+composition+"_produits",parts,"prd_etiquettes",props,subdiv=10)
        if composition=="reassort":
            H.boxes("comp_ry_reassort_carton",[
                ((x+.15,y+.1,.54,x+.95,y+.62,.56),"world"),
                ((x+.15,y+.1,.56,x+.18,y+.62,.79),"world"),
                ((x+.92,y+.1,.56,x+.95,y+.62,.79),"world"),
                ((x+.18,y+.1,.56,x+.92,y+.13,.79),"world"),
                ((x+.18,y+.59,.56,x+.92,y+.62,.79),"world"),
                ((x+.18,y+.13,.78,x+.92,y+.25,.8),"world"),
            ],"carton",props,subdiv=10)
            H.boxes("comp_ry_reassort_stock",[
                ((x+.23+i*.21,y+.28,.56,x+.4+i*.21,y+.48,.79),"label:lessive_profonde","-y")
                for i in range(3)
            ],"prd_etiquettes",props,subdiv=10)
        bandeau("comp_ry_"+composition+"_titre",composition,x+.08,y-.025,2.065,1.09,.38,props)
    return {"ensembles":2,"proxies ajoutes":0}
