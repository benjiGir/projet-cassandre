"""Matières locales de la cafétéria, sans modifier ses lampes ni ses atlas.

see: docs/5-guides/direction-artistique.md
"""
import json
from pathlib import Path
import re

import bpy

from tools.art_direction.store_checkout import RAMPS as CHECKOUT_RAMPS, metric_uv
from tools.art_direction.store_sales import RAMPS as SALES_RAMPS
from tools.art_direction.surface_recipes import build_materials

ROOT = Path(__file__).resolve().parents[2]
RAMPS = {key: CHECKOUT_RAMPS[key] for key in
         ("store_stratifie", "store_inox", "store_plastique")}
RAMPS.update({key: SALES_RAMPS[key] for key in
              ("store_damier", "store_rouge", "store_email", "store_carton")})
RAMPS.update({
    "store_enduit": ("9f9d8e", "b9b6a6", "cbc6b4", "d8d2bf"),
    "store_plafond": ("b4b8b0", "c6c8bf", "cdd0c5", "d9dbd2"),
})
FURNITURE = {"mat_metal_bac_acier": "store_inox", "mat_metal_peint_rouge": "store_rouge",
             "mat_bois_palette": "store_stratifie", "mat_mur_platre": "store_email",
             "mat_carton": "store_carton"}
COUNTER = {"socle": "store_stratifie", "plateau": "store_inox", "glissiere": "store_inox",
           "vitrine": "store_inox", "bacs": "store_inox", "plinthe": "store_plastique"}


def selection(name, original):
    if name == "sol_cafeteria":
        return "sol", "store_damier"
    if name == "plafond_cafeteria":
        return "plafond", "store_plafond"
    if name.startswith(("mur_cafeteria_", "imposte_cafeteria_", "linteau_cafeteria_")):
        return "murs", "store_enduit"
    counter = re.fullmatch(r"mob_comptoir_self_12m_(.+)_ca_self", name)
    if counter:
        return "mobilier", COUNTER.get(counter.group(1))
    furniture = ((name.startswith(("mob_", "deco_")) and "_ca_" in name)
                 or name.startswith("prop_cafeteria")
                 or name in ("comp_ca_repas_plateau", "comp_ca_pause_dossier"))
    if furniture:
        current = original.removeprefix("da_")
        return "mobilier", FURNITURE.get(original) or (current if current in RAMPS else None)
    return None, None


def apply():
    base = bpy.data.materials.get("mat_palette")
    if base is None:
        raise ValueError("Ouvrir le magasin avant la passe de cafétéria")
    materials = build_materials({key: base for key in RAMPS},
                                ROOT / "assets_src/library/art_direction/textures", RAMPS)
    bpy.context.view_layer.update()
    objects, families = [], set()
    counts = {"sol": 0, "murs": 0, "plafond": 0, "mobilier": 0}
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.visible_get() or len(obj.material_slots) != 1:
            continue
        name = re.sub(r"\.\d+$", "", obj.name)
        mat = obj.material_slots[0].material
        original = re.sub(r"\.\d+$", "", mat.name) if mat else ""
        category, key = selection(name, original)
        if key is None:
            continue
        if obj.data.users > 1:
            obj.data = obj.data.copy()
        metric_uv(obj)
        obj.material_slots[0].material = materials[key]
        counts[category] += 1
        families.add(key)
        objects.append({"nom": name, "categorie": category, "matiere": key})
    if counts["sol"] != 1 or counts["plafond"] != 1 or counts["murs"] != 11 or counts["mobilier"] < 40:
        raise ValueError(f"Sélection incomplète : {counts}")
    for mat in list(bpy.data.materials):
        if mat.name.startswith("da_store_") and mat.users == 0:
            bpy.data.materials.remove(mat)
    for image in list(bpy.data.images):
        if image.name.startswith("store_") and image.users == 0:
            bpy.data.images.remove(image)
    return {"zone": "cafétéria", **counts, "objets": sorted(objects, key=lambda item: item["nom"]),
            "matieres": sorted(families), "texture_px": 128, "texture_m": 2}


def write_report(report):
    path = ROOT / "renders/reviews/cafeteria-da/deploiement.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
