"""Parkings, raccords et dernières surfaces de décor du magasin.

see: docs/5-guides/direction-artistique.md
"""
from collections import Counter
import json
from pathlib import Path
import re

import bpy

from tools.art_direction.store_checkout import RAMPS as CHECKOUT_RAMPS, metric_uv
from tools.art_direction.store_sales import RAMPS as SALES_RAMPS
from tools.art_direction.store_reserve import RAMPS as RESERVE_RAMPS, carton_uv
from tools.art_direction.store_offices import RAMPS as OFFICE_RAMPS
from tools.art_direction.surface_recipes import build_materials
from tools.art_direction.vehicle_finish import apply as finish_vehicles

ROOT = Path(__file__).resolve().parents[2]
RAMPS = {key:CHECKOUT_RAMPS[key] for key in ("store_inox","store_terrazzo","store_carrelage")}
RAMPS.update({key:SALES_RAMPS[key] for key in ("store_damier","store_rouge","store_email","store_perfore")})
RAMPS.update({key:RESERVE_RAMPS[key] for key in ("reserve_sol","reserve_enduit","reserve_plafond",
                                             "reserve_carton","reserve_bois","reserve_fut")})
RAMPS.update({"office_enduit":OFFICE_RAMPS["office_enduit"]})
RAMPS.update({
    "finish_asphalte":("626a63","798172","8b9381","a0aa93"),
    "finish_beton":("65716a","8b9689","a6ae9d","bbc3ad"),
    "finish_plafond":("a1a598","c2c6b5","d6d9c7","e6e7d4"),
    "finish_marques":("9aa595","c1c9b8","d8ddc9","ecebd8"),
    "finish_toile_rouge":("773b33","945547","ab6a55","bb8a70"),
    "finish_toile_claire":("93988d","b7bcac","d0d3bf","e0dec8"),
})
ARCHITECTURE = ("sol_","mur_","plafond_","imposte_","linteau_")
INDUSTRIAL = ("souterrain","c_so_bu","c_short_w","c_short_ramp","sortie")


def selection(name, original):
    current = original.removeprefix("da_")
    if current in RAMPS:
        return current
    if original.startswith("da_"):
        return None
    if name.startswith(ARCHITECTURE):
        if original == "mat_sol_asphalte":
            return "finish_asphalte"
        if name.startswith("plafond_"):
            return "reserve_plafond" if any(zone in name for zone in INDUSTRIAL) else "finish_plafond"
        if name.startswith("sol_"):
            return {"mat_sol_terrazzo":"store_terrazzo","mat_sol_damier":"store_damier",
                    "mat_sol_beton":"reserve_sol","mat_sol_beton_brut":"reserve_sol"}.get(original)
        if original == "mat_mur_platre":
            return "office_enduit"
        if original == "mat_mur_platre_use":
            return "reserve_enduit" if any(zone in name for zone in INDUSTRIAL) else "finish_beton"
    if name == "escalier_parking_marches":
        return "reserve_sol"
    if name.startswith("str_pilier_beton_") and "_corps_" in name or name.startswith("str_lampadaire_") and "_socle_" in name:
        return "finish_beton"
    if name.startswith("str_pilier_corps_"):
        return "office_enduit"
    if name.startswith(("deco_place_","so_marquage_")):
        return "finish_marques"
    if original == "mat_metal_bac_acier":
        return "store_inox"
    if original == "mat_bois_palette":
        return "reserve_bois"
    if original == "mat_carton":
        return "reserve_carton"
    if original == "mat_metal_tole_perforee":
        return "store_perfore"
    if original == "mat_metal_peint_rouge":
        if name == "camp_duvet" or name.startswith("gp_photomaton_rideau_"):
            return "finish_toile_rouge"
        if name.startswith(("mob_","deco_","door_coupe_feu","comp_ga_presse_","csw_rep_escabeau_")):
            return "store_rouge"
    if name == "camp_oreiller":
        return "finish_toile_claire"
    if original == "mat_mur_platre" and name.startswith(("mob_devanture_","mob_kiosque_","gp_photomaton_caisson_")):
        return "store_email"
    return None


def apply():
    base = bpy.data.materials.get("mat_palette")
    if base is None:
        raise ValueError("Ouvrir le magasin pour cette passe")
    materials = build_materials({key:base for key in RAMPS},
                               ROOT/"assets_src/library/art_direction/textures",RAMPS)
    bpy.context.view_layer.update()
    objects,families,counts = [],set(),Counter()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.visible_get() or obj.name.startswith(("col_","use_","secret_","trig_")):
            continue
        name = re.sub(r"\.\d+$","",obj.name)
        marked = obj.get("art_finish_family")
        if marked in RAMPS:
            key = marked
            if key == "reserve_carton":
                carton_uv(obj)
            else:
                metric_uv(obj)
            obj.material_slots[0].material = materials[key]
            category = name.split("_")[0] if name.startswith(ARCHITECTURE) else "mobilier"
            counts[category] += 1
            families.add(key)
            objects.append({"nom":name,"matiere":key,"categorie":category})
            continue
        changed = []
        for slot in obj.material_slots:
            original = re.sub(r"\.\d+$","",slot.material.name) if slot.material else ""
            key = selection(name,original)
            # Cette passe ferme les trous de couverture ; les familles déjà
            # appliquées ailleurs gardent leurs matériaux et leurs UV.
            if key is not None and not original.startswith("da_"):
                changed.append((slot,key))
        if not changed:
            continue
        if len(obj.material_slots) != 1:
            raise ValueError(f"Décor attendu à matériau unique : {name}")
        key = changed[0][1]
        if key == "reserve_carton":
            carton_uv(obj)
        else:
            metric_uv(obj)
        obj.material_slots[0].material = materials[key]
        obj["art_finish_family"] = key
        category = name.split("_")[0] if name.startswith(ARCHITECTURE) else "mobilier"
        counts[category] += 1
        families.add(key)
        objects.append({"nom":name,"matiere":key,"categorie":category})
    vehicles = finish_vehicles()
    for mat in list(bpy.data.materials):
        if mat.name.startswith("da_") and mat.users == 0:
            bpy.data.materials.remove(mat)
    return {"zone":"magasin : parkings, raccords et mobilier restant","objets_modifies":len(objects)+len(vehicles),
            "categories":dict(counts),"objets":objects,"vehicules":vehicles,
            "matieres":sorted(families),"texture_px":128,"texture_m":2}


def write_report(report):
    path = ROOT/"renders/reviews/finition-da/deploiement-magasin.json"
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
