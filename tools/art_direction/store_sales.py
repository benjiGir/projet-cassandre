"""Sols et mobilier de vente : allée centrale, rayons et électroménager.

see: docs/assets/vente-direction-artistique.md
"""
import json
from pathlib import Path
import re

import bpy
from mathutils import Vector

from tools.art_direction.surface_recipes import build_materials
from tools.art_direction.store_checkout import RAMPS as CHECKOUT_RAMPS, metric_uv

ROOT = Path(__file__).resolve().parents[2]
RAMPS = {key: CHECKOUT_RAMPS[key] for key in
         ("store_terrazzo", "store_terrazzo_fin", "store_carrelage", "store_inox")}
RAMPS.update({
    "store_damier": ("656c66", "788177", "b6beae", "c9d0be"),
    "store_email": ("8c968a", "b8c0ae", "cbd1bf", "dce0d1"),
    "store_rouge": ("71312c", "97463d", "ab5446", "c07158"),
    "store_perfore": ("778078", "a4afa3", "b8c1b2", "cbd2c1"),
    "store_carton": ("856341", "ac875b", "b69465", "c6a37a"),
    "store_bois": ("6f523a", "997249", "ad8154", "c69862"),
})
FLOORS = {"mat_sol_terrazzo": "store_terrazzo", "mat_sol_terrazzo_fin": "store_terrazzo_fin",
          "mat_sol_carrelage_blanc": "store_carrelage", "mat_sol_damier": "store_damier"}
FURNITURE = {"mat_metal_bac_acier": "store_inox", "mat_metal_peint_rouge": "store_rouge",
             "mat_metal_tole_perforee": "store_perfore", "mat_mur_platre": "store_email",
             "mat_carton": "store_carton", "mat_bois_palette": "store_bois"}
CONNECTORS = {"sol_c_hb_ry", "sol_c_hb_el", "sol_c_hb_rs"}
ZONES = ((-6, 44, 6, 92), (-52, 48, -10, 84), (10, 48, 46, 80))


def material_key(mat, mapping):
    name = re.sub(r"\.\d+$", "", mat.name) if mat else ""
    return mapping.get(name) or (name[3:] if name.startswith("da_") and name[3:] in RAMPS else None)


def apply():
    base = bpy.data.materials.get("mat_palette")
    if base is None:
        raise ValueError("Ouvrir le magasin avant la passe de matières")
    materials = build_materials({key: base for key in RAMPS},
                                ROOT / "assets_src/library/art_direction/textures", RAMPS)
    bpy.context.view_layer.update()
    objects, floors, furniture, families = [], 0, 0, set()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.visible_get():
            continue
        name = re.sub(r"\.\d+$", "", obj.name)
        floor = name.startswith(("sol_hub_", "sol_rayons_")) or name == "sol_electro" or name in CONNECTORS
        if not floor:
            if not name.startswith(("mob_", "deco_palette_cartons_", "str_estrade_micro_")):
                continue
            center = sum((obj.matrix_world @ Vector(corner) for corner in obj.bound_box), Vector()) / 8
            if not (0 <= center.z <= 3 and any(x0 <= center.x <= x1 and y0 <= center.y <= y1
                     for x0, y0, x1, y1 in ZONES)):
                continue
        if len(obj.material_slots) != 1:
            continue
        key = material_key(obj.material_slots[0].material, FLOORS if floor else FURNITURE)
        if key is None:
            if floor:
                raise ValueError(f"Sol sans famille connue : {name}")
            continue
        if obj.data.users > 1:
            obj.data = obj.data.copy()
        if not floor:
            metric_uv(obj)
        obj.material_slots[0].material = materials[key]
        families.add(key)
        objects.append({"nom": name, "matiere": key})
        floors += int(floor)
        furniture += int(not floor)
    if floors != 12 or furniture < 100:
        raise ValueError(f"Sélection incomplète : {floors} sols, {furniture} éléments de mobilier")
    for mat in list(bpy.data.materials):
        if mat.name.startswith("da_store_") and mat.users == 0:
            bpy.data.materials.remove(mat)
    for image in list(bpy.data.images):
        if image.name.startswith("store_") and image.users == 0:
            bpy.data.images.remove(image)
    return {"zone": "allée centrale, rayons et électroménager", "sols": floors,
            "mobilier": furniture, "objets": sorted(objects, key=lambda item: item["nom"]),
            "matieres": sorted(families), "texture_px": 128, "texture_m": 2}


def write_report(report):
    path = ROOT / "docs/assets/vente-da/deploiement.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
