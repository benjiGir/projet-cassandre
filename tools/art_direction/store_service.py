"""Matières de la chambre froide et du compacteur.

see: docs/5-guides/direction-artistique.md
"""
import json
from pathlib import Path
import re

import bpy

from tools.art_direction.store_checkout import metric_uv
from tools.art_direction.store_reserve import RAMPS as RESERVE_RAMPS, carton_uv
from tools.art_direction.store_workshops import RAMPS as WORKSHOP_RAMPS
from tools.art_direction.surface_recipes import build_materials

ROOT = Path(__file__).resolve().parents[2]
RAMPS = {key:RESERVE_RAMPS[key] for key in ("reserve_sol","reserve_enduit","reserve_plafond",
                                         "reserve_bois","reserve_carton","reserve_rideau")}
RAMPS.update({key:WORKSHOP_RAMPS[key] for key in ("atelier_inox","atelier_noir","atelier_email")})
RAMPS.update({
    "cold_sol":("647980","82969a","9fafae","b9c5bc"),
    "cold_paroi":("b5c2c2","d8e1df","eaf0eb","f5f5ed"),
    "cold_plafond":("a3b4b4","c5d2cf","dce5de","edf0e4"),
    "cold_evaporateur":("5a6a6b","8b9c98","adbcb3","cfdbcf"),
    "cold_givre":("aabfbe","c4d4ce","dbe4d7","eaf0de"),
    "service_peint":("36463c","586c4e","7b8c64","a0ac85"),
})
EXPLICIT = {
    "cf_faces_panneaux":("murs","cold_paroi"),
    "cf_sol_isole":("sols","cold_sol"),
    "cf_givre_angles":("mobilier","cold_givre"),
    "cf_joints_panneaux":("mobilier","atelier_inox"),
    "cf_evaporateur":("mobilier","cold_evaporateur"),
    "cf_evaporateur_ventilateurs":("mobilier","atelier_noir"),
    "co_palettes_vides":("mobilier","reserve_bois"),
    "co_camera_carton":("mobilier","reserve_carton"),
    "door_compacteur_service":("mobilier","reserve_rideau"),
    "compacteur_service_rails":("mobilier","atelier_inox"),
    "co_camera_support":("mobilier","atelier_noir"),
    "co_camera_corps":("mobilier","atelier_email"),
    "co_presse_grille":("mobilier","atelier_noir"),
    "co_presse_poignee":("mobilier","atelier_noir"),
    "co_presse_conduite0":("mobilier","atelier_noir"),
    "co_presse_conduite1":("mobilier","atelier_noir"),
}
MIXED = {"co_presse_chassis","co_benne","cf_cadre_porte"}
PALETTE_FAMILIES = {"#65814b":"service_peint","#3b4528":"service_peint",
                    "#2f3541":"atelier_noir","#444a54":"atelier_noir","#111014":"atelier_noir",
                    "#605c58":"atelier_inox","#babcbc":"atelier_inox","#d5d7d8":"atelier_email",
                    "#f1f1f1":"cold_paroi"}


def selection(name, original):
    if name in ("sol_chambre_froide","sol_compacteur"):
        return "sols", "cold_sol" if "froide" in name else "reserve_sol"
    if name in ("plafond_chambre_froide","plafond_compacteur"):
        return "plafonds", "cold_plafond" if "froide" in name else "reserve_plafond"
    if name.startswith(("mur_chambre_froide_","imposte_chambre_froide_","linteau_chambre_froide_")):
        return "murs","cold_paroi"
    if name.startswith(("mur_compacteur_","imposte_compacteur_","linteau_compacteur_")) or name == "imposte_c_short_w_compacteur":
        return "murs","reserve_enduit"
    if name in EXPLICIT:
        return EXPLICIT[name]
    furniture = name.startswith(("cf_","co_")) or "_co_transpalette" in name
    if furniture:
        if original == "mat_metal_bac_acier":
            return "mobilier","atelier_inox"
        current = original.removeprefix("da_")
        return "mobilier",current if current in RAMPS else None
    return None,None


def palette_materials(obj, materials):
    """Garde les couleurs des boutons et les UV des faces non remplacées."""
    import lib_helpers as H
    mesh = obj.data
    previous_uv = [loop.uv.copy() for loop in mesh.uv_layers.active.data]
    keys = []
    original_slots = list(mesh.materials)
    for polygon in mesh.polygons:
        mat = original_slots[polygon.material_index]
        name = re.sub(r"\.\d+$","",mat.name)
        if name == "mat_palette":
            u,v = previous_uv[polygon.loop_indices[0]]
            swatch = min(7,max(0,int(u*8)))+8*min(7,max(0,7-int(v*8)))
            keys.append(PALETTE_FAMILIES.get(H.PALETTE[swatch]))
        else:
            current = name.removeprefix("da_")
            keys.append(current if current in RAMPS else None)
    metric_uv(obj)
    mesh = obj.data
    mesh.materials.clear()
    palette = bpy.data.materials["mat_palette"]
    mesh.materials.append(palette)
    family_slots = {}
    for polygon,key in zip(mesh.polygons,keys):
        if key is None:
            polygon.material_index = 0
            for index in polygon.loop_indices:
                mesh.uv_layers.active.data[index].uv = previous_uv[index]
            continue
        if key not in family_slots:
            family_slots[key] = len(mesh.materials)
            mesh.materials.append(materials[key])
        polygon.material_index = family_slots[key]
    return sorted(family_slots)


def apply():
    base = bpy.data.materials.get("mat_palette")
    if base is None:
        raise ValueError("Ouvrir le magasin avant cette passe")
    materials = build_materials({key:base for key in RAMPS},
                               ROOT/"assets_src/library/art_direction/textures",RAMPS)
    bpy.context.view_layer.update()
    counts = {"sols":0,"murs":0,"plafonds":0,"mobilier":0}
    objects,families,preserved = [],set(),[]
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.visible_get() or obj.name.startswith("col_"):
            continue
        name = re.sub(r"\.\d+$","",obj.name)
        if name in MIXED:
            keys = palette_materials(obj,materials)
            counts["mobilier"] += 1
            families.update(keys)
            objects.append({"nom":name,"categorie":"mobilier","matieres":keys})
            continue
        if len(obj.material_slots) != 1:
            continue
        mat = obj.material_slots[0].material
        original = re.sub(r"\.\d+$","",mat.name) if mat else ""
        category,key = selection(name,original)
        if key is None:
            if category:
                preserved.append({"nom":name,"matiere":original})
            continue
        if key == "reserve_carton":
            carton_uv(obj)
        else:
            metric_uv(obj)
        obj.material_slots[0].material = materials[key]
        counts[category] += 1
        families.add(key)
        objects.append({"nom":name,"categorie":category,"matiere":key})
    if counts["sols"] != 3 or counts["plafonds"] != 2 or counts["murs"] < 18 or counts["mobilier"] < 20:
        raise ValueError(f"Sélection incomplète : {counts}")
    for mat in list(bpy.data.materials):
        if mat.name.startswith("da_") and mat.users == 0:
            bpy.data.materials.remove(mat)
    return {"zone":"chambre froide et compacteur",**counts,"matieres":sorted(families),
            "objets":sorted(objects,key=lambda obj:obj["nom"]),"atlas_conserves":preserved,
            "texture_px":128,"texture_m":2}


def write_report(report):
    path = ROOT/"renders/reviews/service-da/deploiement.json"
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
