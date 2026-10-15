"""Matières de la planque du vigile et de la gaine VMC.

see: docs/5-guides/direction-artistique.md
"""
import json
from pathlib import Path
import re

import bpy

from tools.art_direction.store_checkout import metric_uv
from tools.art_direction.store_reserve import RAMPS as RESERVE_RAMPS, carton_uv
from tools.art_direction.store_offices import RAMPS as OFFICE_RAMPS
from tools.art_direction.store_workshops import RAMPS as WORKSHOP_RAMPS
from tools.art_direction.surface_recipes import build_materials

ROOT = Path(__file__).resolve().parents[2]
RAMPS = {key:RESERVE_RAMPS[key] for key in ("reserve_carton","reserve_bois")}
RAMPS.update({key:OFFICE_RAMPS[key] for key in ("office_moquette","office_plafond_vestiaires",
                                             "office_bois","office_metal","office_peint")})
RAMPS.update({key:WORKSHOP_RAMPS[key] for key in ("atelier_inox","atelier_noir","atelier_email")})
RAMPS.update({
    "annex_enduit":("79776b","a29e86","bdb99e","d0c9aa"),
    "annex_tissu":("926e4b","b78d63","c4996d","cfae81"),
    "annex_plastique":("6c6156","968472","b9a58a","cbbba0"),
    "annex_tole":("646e6c","9caa9f","aeb9ac","c4cec0"),
    "annex_plancher":("596662","74857c","92a18f","adbaa5"),
    "annex_plafond":("6d7975","89958b","a0ac9e","b8c0ad"),
})
EXPLICIT = {
    "sol_secret4":("sols","office_moquette"),
    "plafond_secret4":("plafonds","office_plafond_vestiaires"),
    "sol_gaine":("sols","annex_plancher"),
    "plafond_gaine":("plafonds","annex_plafond"),
    "s4_caisse_tele":("mobilier","reserve_bois"),
    "s4_caisse_butin":("mobilier","reserve_bois"),
    "s4_bouteilles_carton":("mobilier","reserve_carton"),
    "s4_antenne0":("mobilier","atelier_inox"),
    "s4_antenne1":("mobilier","atelier_inox"),
    "s4_casier_aeration":("mobilier","atelier_noir"),
    "mob_k_tableCoffee_s4_table":("mobilier","office_bois"),
    "ps_gaine_cadre":("mobilier","atelier_inox"),
    "ps_gaine_joues":("mobilier","atelier_inox"),
}
MIXED = {
    "mob_k_loungeSofa_s4_canape":{"#deb789":"annex_tissu","#e8d794":"office_bois"},
    "mob_k_kitchenFridge_s4_frigo":{"#f1f1f1":"atelier_email","#d5d7d8":"atelier_inox","#a2a3a1":"atelier_noir"},
    "s4_casier":{"#605c58":"office_metal","#444a54":"office_peint"},
    "s4_tele_crt":{"#444a54":"atelier_noir","#988776":"annex_plastique","#111014":"atelier_noir"},
    "mob_k_radio_s4_radio":{"#babcbc":"atelier_inox","#e8d794":"annex_plastique"},
}


def palette_materials(obj, materials, colors):
    import lib_helpers as H
    previous_uv = [loop.uv.copy() for loop in obj.data.uv_layers.active.data]
    slots = list(obj.data.materials)
    keys = []
    for poly in obj.data.polygons:
        name = re.sub(r"\.\d+$","",slots[poly.material_index].name)
        if name == "mat_palette":
            u,v = previous_uv[poly.loop_indices[0]]
            swatch = min(7,max(0,int(u*8)))+8*min(7,max(0,7-int(v*8)))
            keys.append(colors.get(H.PALETTE[swatch]))
        else:
            current = name.removeprefix("da_")
            if current not in RAMPS:
                raise ValueError(f"Matière inattendue dans {obj.name}: {name}")
            keys.append(current)
    metric_uv(obj)
    mesh = obj.data
    mesh.materials.clear()
    mesh.materials.append(bpy.data.materials["mat_palette"])
    family_slots = {}
    for poly,key in zip(mesh.polygons,keys):
        if key is None:
            poly.material_index = 0
            for index in poly.loop_indices:
                mesh.uv_layers.active.data[index].uv = previous_uv[index]
        else:
            if key not in family_slots:
                family_slots[key] = len(mesh.materials)
                mesh.materials.append(materials[key])
            poly.material_index = family_slots[key]
    return sorted(family_slots)


def apply():
    base = bpy.data.materials.get("mat_palette")
    if base is None:
        raise ValueError("Ouvrir le magasin avant cette passe")
    materials = build_materials({key:base for key in RAMPS},
                               ROOT/"assets_src/library/art_direction/textures",RAMPS)
    bpy.context.view_layer.update()
    counts = {"sols":0,"murs":0,"plafonds":0,"mobilier":0}
    objects,families = [],set()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.visible_get() or obj.name.startswith("col_"):
            continue
        name = re.sub(r"\.\d+$","",obj.name)
        if name in MIXED:
            keys = palette_materials(obj,materials,MIXED[name])
            counts["mobilier"] += 1
            families.update(keys)
            objects.append({"nom":name,"categorie":"mobilier","matieres":keys})
            continue
        category,key = EXPLICIT.get(name,(None,None))
        if name.startswith("mur_secret4_"):
            category,key = "murs","annex_enduit"
        elif name.startswith("mur_gaine_"):
            category,key = "murs","annex_tole"
        if key is None:
            continue
        if len(obj.material_slots) != 1:
            raise ValueError(f"Un matériau attendu sur {name}")
        if key == "reserve_carton":
            carton_uv(obj)
        else:
            metric_uv(obj)
        obj.material_slots[0].material = materials[key]
        counts[category] += 1
        families.add(key)
        objects.append({"nom":name,"categorie":category,"matiere":key})
    if counts != {"sols":2,"murs":9,"plafonds":2,"mobilier":14}:
        raise ValueError(f"Sélection incomplète : {counts}")
    for mat in list(bpy.data.materials):
        if mat.name.startswith("da_") and mat.users == 0:
            bpy.data.materials.remove(mat)
    return {"zone":"planque du vigile et gaine VMC",**counts,"matieres":sorted(families),
            "objets":sorted(objects,key=lambda obj:obj["nom"]),"texture_px":128,"texture_m":2}


def write_report(report):
    path = ROOT/"renders/reviews/annexes-da/deploiement.json"
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
