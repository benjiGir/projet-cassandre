"""Matières du fournil, du laboratoire de boucherie et du SAV.

see: docs/assets/ateliers-direction-artistique.md
"""
import json
from pathlib import Path
import re

import bpy

from tools.art_direction.store_checkout import metric_uv
from tools.art_direction.store_offices import RAMPS as OFFICE_RAMPS
from tools.art_direction.store_reserve import RAMPS as RESERVE_RAMPS, carton_uv
from tools.art_direction.surface_recipes import build_materials

ROOT = Path(__file__).resolve().parents[2]
RAMPS = {key: RESERVE_RAMPS[key] for key in ("reserve_sol", "reserve_carton")}
RAMPS.update({key: OFFICE_RAMPS[key] for key in ("office_enduit", "office_bois")})
RAMPS.update({
    "atelier_gres": ("7c5141", "895438", "a16b47", "b78660"),
    "atelier_joint": ("795341", "805742", "865b45", "8c6049"),
    "atelier_faience": ("8e9d92", "bdc7b5", "dadfca", "eae9d5"),
    "atelier_plafond": ("969d92", "bbc0b1", "d5d6c4", "e8e5d1"),
    "atelier_inox": ("74857f", "9ea9a0", "c1c8b9", "d7d9c8"),
    "atelier_noir": ("273033", "3d4748", "56605c", "6b756b"),
    "atelier_planche": ("a09d89", "c2bdaa", "dad6c0", "eae6d4"),
    "atelier_email": ("8c958b", "b0b7a5", "c7cbb6", "d9dbc5"),
})
ZONES = ("fournil", "labo", "sav")
MIXED = {"sav_guichet", "sav_etablis"}
EXPLICIT = {"fournil_babcbc": "atelier_inox", "fournil_pousse_babcbc": "atelier_inox",
            "fournil_petrin_cuve": "atelier_inox", "fournil_desserte_cuve": "atelier_inox",
            "fournil_444a54": "atelier_noir", "fournil_pousse_444a54": "atelier_noir",
            "fournil_deb789": "office_bois", "lb_planche_decoupe": "atelier_planche",
            "lb_joints_gres": "atelier_joint",
            "lb_scie_socle": "atelier_noir", "sav_etageres_tv": "atelier_noir"}


def selection(name, original):
    if name in ("sol_fournil", "sol_labo", "lb_sol_gres_rouge"):
        return "sols", "atelier_gres"
    if name == "sol_sav":
        return "sols", "reserve_sol"
    if name in {"plafond_" + zone for zone in ZONES}:
        return "plafonds", "atelier_plafond"
    if any(name.startswith(prefix + zone + "_") for prefix in ("mur_", "imposte_", "linteau_") for zone in ZONES):
        return "murs", "office_enduit" if "sav" in name else "atelier_faience"
    if name.startswith("parapet_fournil_"):
        return "murs", "atelier_faience"
    if name.startswith(("fournil_four_", "fournil_rotissoire_")):
        if name.endswith(("_inox", "_hotte")):
            return "mobilier", "atelier_inox"
        if name.endswith("_noir"):
            return "mobilier", "atelier_noir"
    if name in EXPLICIT:
        return "mobilier", EXPLICIT[name]
    furniture = name.startswith(("lb_", "sav_")) or (name.startswith("mob_") and "_sav_" in name)
    if name == "prop_sav_carton_retour":
        return "mobilier", "reserve_carton"
    if furniture:
        current = original.removeprefix("da_")
        return "mobilier", {"mat_metal_bac_acier": "atelier_inox", "mat_mur_platre": "atelier_email"}.get(
            original) or (current if current in RAMPS else None)
    return None, None


def workbench_materials(obj, materials):
    metric_uv(obj)
    keys = ("atelier_email", "office_bois", "atelier_planche", "atelier_noir")
    obj.data.materials.clear()
    for key in keys:
        obj.data.materials.append(materials[key])
    used = set()
    for polygon in obj.data.polygons:
        height = (obj.matrix_world @ polygon.center).z
        if obj.name == "sav_guichet":
            index = 2 if height > 1.045 else 1 if height > .915 else 0
        else:
            index = 1 if height > .815 else 3
        polygon.material_index = index
        used.add(keys[index])
    return used


def apply():
    base = bpy.data.materials.get("mat_palette")
    if base is None:
        raise ValueError("Ouvrir le magasin avant la passe des ateliers")
    materials = build_materials({key: base for key in RAMPS},
                                ROOT / "assets_src/library/art_direction/textures", RAMPS)
    bpy.context.view_layer.update()
    objects, families, preserved = [], set(), []
    counts = {"sols": 0, "murs": 0, "plafonds": 0, "mobilier": 0}
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.visible_get() or obj.name.startswith("col_"):
            continue
        name = re.sub(r"\.\d+$", "", obj.name)
        if name in MIXED:
            keys = workbench_materials(obj, materials)
            families.update(keys)
            counts["mobilier"] += 1
            objects.append({"nom": name, "categorie": "mobilier", "matieres": sorted(keys)})
            continue
        if len(obj.material_slots) != 1:
            continue
        mat = obj.material_slots[0].material
        original = re.sub(r"\.\d+$", "", mat.name) if mat else ""
        category, key = selection(name, original)
        if key is None:
            if category is not None:
                preserved.append({"nom": name, "matiere": original})
            continue
        if key == "reserve_carton":
            carton_uv(obj)
        else:
            metric_uv(obj)
        obj.material_slots[0].material = materials[key]
        counts[category] += 1
        families.add(key)
        objects.append({"nom": name, "categorie": category, "matiere": key})
    if counts["sols"] != 4 or counts["plafonds"] != 3 or counts["murs"] < 22 or counts["mobilier"] < 20:
        raise ValueError(f"Sélection incomplète : {counts}")
    for mat in list(bpy.data.materials):
        if mat.name.startswith("da_") and mat.users == 0:
            bpy.data.materials.remove(mat)
    for image in list(bpy.data.images):
        if image.name.startswith(("atelier_", "office_", "reserve_")) and image.users == 0:
            bpy.data.images.remove(image)
    return {"zone": "fournil, labo et SAV", **counts, "objets": sorted(objects, key=lambda item: item["nom"]),
            "atlas_conserves": preserved, "matieres": sorted(families), "texture_px": 128, "texture_m": 2}


def write_report(report):
    path = ROOT / "docs/assets/ateliers-da/deploiement.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
