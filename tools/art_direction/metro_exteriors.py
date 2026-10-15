"""Matières du quartier et dernières pièces de décor du métro.

see: docs/5-guides/direction-artistique.md
"""
from collections import Counter
import json
from pathlib import Path
import re

import bpy

from tools.art_direction.surface_recipes import RAMPS as QUAY_RAMPS, build_materials
from tools.art_direction.metro_materials import ARRIVAL_RAMPS
from tools.art_direction.store_finish import RAMPS as FINISH_RAMPS
from tools.art_direction.store_checkout import metric_uv
from tools.art_direction.vehicle_finish import apply as finish_vehicles

ROOT = Path(__file__).resolve().parents[2]
RAMPS = {key:QUAY_RAMPS[key] for key in ("acier","petrole","bois","ambre")}
RAMPS.update({"parvis_feuillage":ARRIVAL_RAMPS["parvis_feuillage"],
              "exterior_rue":("303b40","414c4e","4d5857","64706a"),
              "store_rouge":FINISH_RAMPS["store_rouge"]})
RAMPS.update({
    "exterior_enduit":("9d9e8e","beb9a4","d2ccb7","e4dbc2"),
    "exterior_brique":("694f43","866149","96745b","b69676"),
    "exterior_ardoise":("3e4b50","515f64","657377","7c8988"),
    "exterior_pave":("606b65","7c897e","8c9a8a","a8b39e"),
    "exterior_email":("9ca393","c1c7b4","dbddc9","ece7d3"),
    "exterior_nuit":("131e25","1b2a33","23343c","30454a"),
})
REPLACEMENTS = {"quartier_enduit":"exterior_enduit","quartier_brique":"exterior_brique",
                "quartier_ardoise":"exterior_ardoise","quartier_pave":"exterior_pave",
                "quartier_ivoire":"exterior_email","quartier_sol":"exterior_rue",
                "quartier_acier":"acier","quartier_petrole":"petrole","quartier_bois":"bois",
                "quartier_ambre":"ambre","quartier_rouge":"store_rouge",
                "quartier_nuit":"exterior_nuit","quartier_feuillage":"parvis_feuillage",
                "metro_acier":"acier","metro_ivoire":"exterior_email"}


def apply():
    base = bpy.data.materials.get("quartier_acier")
    if base is None:
        raise ValueError("Ouvrir le métro pour cette passe")
    materials = build_materials({key:base for key in RAMPS},
                               ROOT/"assets_src/library/art_direction/textures",RAMPS)
    bpy.context.view_layer.update()
    objects,families,counts = [],set(),Counter()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.visible_get() or obj.name.startswith(("col_","spawn_","trig_","secret_","cam_")):
            continue
        # Les lettres et les pictogrammes restent un signal, sans grain de mur.
        if obj.get("inscription") or obj.get("kit","").startswith("texte_") or obj.name.startswith("kit_texte_"):
            continue
        changed = []
        marked = obj.get("art_finish_family")
        for slot in obj.material_slots:
            original = re.sub(r"\.\d+$","",slot.material.name) if slot.material else ""
            key = marked if marked in RAMPS else REPLACEMENTS.get(original)
            if key is not None:
                changed.append((slot,key))
        if not changed:
            continue
        if len(obj.material_slots) != 1:
            raise ValueError(f"Décor attendu à matériau unique : {obj.name}")
        key = changed[0][1]
        metric_uv(obj)
        obj.material_slots[0].material = materials[key]
        obj["art_finish_family"] = key
        category = "commandes" if obj.name.startswith("use_") or "_commande_" in obj.name else "quartier"
        counts[category] += 1
        families.add(key)
        objects.append({"nom":obj.name,"matiere":key,"categorie":category})
    vehicles = finish_vehicles()
    for mat in list(bpy.data.materials):
        if mat.name.startswith("da_") and mat.users == 0:
            bpy.data.materials.remove(mat)
    return {"zone":"quartier et détails restants du métro","objets_modifies":len(objects)+len(vehicles),
            "categories":dict(counts),"objets":objects,"vehicules":vehicles,
            "matieres":sorted(families),"texture_px":128,"texture_m":2}


def write_report(report):
    path = ROOT/"renders/reviews/finition-da/deploiement-metro.json"
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
