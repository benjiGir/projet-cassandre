"""Textures locales du personnel et de l’administration du magasin.

see: docs/assets/bureaux-direction-artistique.md
"""
import json
from pathlib import Path
import re

import bpy

from tools.art_direction.store_checkout import metric_uv
from tools.art_direction.store_reserve import RAMPS as RESERVE_RAMPS, carton_uv
from tools.art_direction.surface_recipes import build_materials
from tools.art_direction.store_office_finishes import RAMPS as FINISH_RAMPS, ceiling_frames

ROOT = Path(__file__).resolve().parents[2]
RAMPS = {key: RESERVE_RAMPS[key] for key in ("reserve_sol", "reserve_carton", "reserve_bois")}
RAMPS.update({
    "office_enduit": ("979d91", "b5b9aa", "d0d1bd", "dedeca"),
    "office_plafond": ("8c958c", "b5bcad", "c9cebc", "dedfcc"),
    "office_plafond_pc": ("273335", "364347", "465451", "5b6a60"),
    "office_plafond_vestiaires": ("a0a293", "c4c2b4", "dedbc8", "ece7d4"),
    "office_moquette": ("3b4944", "4b5951", "56645a", "637264"),
    "office_carrelage": ("78867c", "a3b0a0", "c1cbb5", "d6dcc9"),
    "office_bois": ("5c4735", "886343", "ac8357", "c4a575"),
    "office_metal": ("566762", "788980", "97a798", "bfcbba"),
    "office_peint": ("35483f", "566f5e", "7e9480", "9aaf93"),
    "office_dossiers": ("726349", "a59670", "c2b58b", "dad3b5"),
})
RAMPS.update(FINISH_RAMPS)
ZONES = ("bureaux", "direction", "c_bu", "c_escalier", "vestiaires", "pc_secu")
FLOORS = {"sol_bureaux": "office_moquette_bleue", "sol_direction": "office_moquette_bleue",
          "sol_pc_secu": "office_moquette", "sol_vestiaires": "office_carrelage",
          "sol_c_bu": "reserve_sol", "escalier_marches": "reserve_sol"}
FURNITURE = {"mat_bois_palette": "office_bois", "mat_metal_bac_acier": "office_metal",
             "mat_mur_platre": "office_peint", "mat_carton": "office_dossiers"}


def selection(name, original):
    if name in FLOORS:
        return "sols", FLOORS[name]
    if name in ("plafond_bureaux", "plafond_direction"):
        return "plafonds", "office_acoustique"
    if name in ("plafond_ps_guichet", "plafond_ps_moniteurs"):
        return "plafonds", "office_plafond_pc"
    if name == "plafond_vestiaires":
        return "plafonds", "office_plafond_vestiaires"
    if name in {"plafond_" + zone for zone in ZONES}:
        return "plafonds", "office_plafond"
    if name.startswith(("mur_", "imposte_", "linteau_")) and any(
            name.startswith(prefix + zone + "_") for prefix in ("mur_", "imposte_", "linteau_") for zone in ZONES):
        return "murs", "office_enduit"
    if name == "ps_cloison_allege":
        return "murs", "office_peint"
    if name.startswith(("et_cloison_allege_", "et_cloison_bandeau_", "et_cloison_bureau_", "et_imposte_", "ps_cloison_")):
        return "murs", "office_enduit"
    if name.startswith(("ps_g_soub_", "ps_m_soub_")):
        return "murs", "office_peint"
    if name.startswith("vs_douches_cloison") or name == "vs_douches_sol":
        return "mobilier", "office_carrelage"
    furniture = ((name.startswith(("mob_", "deco_")) and any(token in name for token in
                  ("_et_", "_di_", "_cbu_", "_vs_"))) or name.startswith(("prop_bureaux", "prop_c_bu"))
                 or name.startswith(("et_chambranle_", "et_fenetre_", "di_fenetre_", "ps_"))
                 or name in ("et_cloison_montants", "escalier_main_courante_0", "escalier_main_courante_1"))
    if not furniture:
        return None, None
    current = original.removeprefix("da_")
    if "deco_palette_cartons_cartons_" in name or name.startswith(("prop_bureaux0", "prop_bureaux1", "prop_c_bu")):
        return "mobilier", "reserve_carton"
    if "deco_palette_cartons_palette_" in name:
        return "mobilier", "reserve_bois"
    return "mobilier", FURNITURE.get(original) or (current if current in RAMPS else None)


def apply():
    base = bpy.data.materials.get("mat_palette")
    if base is None:
        raise ValueError("Ouvrir le magasin avant la passe de bureaux")
    materials = build_materials({key: base for key in RAMPS},
                                ROOT / "assets_src/library/art_direction/textures", RAMPS)
    bpy.context.view_layer.update()
    objects, families, preserved = [], set(), []
    counts = {"sols": 0, "murs": 0, "plafonds": 0, "mobilier": 0}
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.visible_get() or len(obj.material_slots) != 1:
            continue
        name = re.sub(r"\.\d+$", "", obj.name)
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
    if counts["sols"] != 6 or counts["plafonds"] < 5 or counts["murs"] < 45 or counts["mobilier"] < 70:
        raise ValueError(f"Sélection incomplète : {counts}")
    frames = ceiling_frames(materials)
    families.add("office_ossature")
    for mat in list(bpy.data.materials):
        if mat.name.startswith("da_") and mat.users == 0:
            bpy.data.materials.remove(mat)
    for image in list(bpy.data.images):
        if image.name.startswith(("office_", "reserve_")) and image.users == 0:
            bpy.data.images.remove(image)
    return {"zone": "personnel et bureaux", **counts, "faux_plafonds": frames, "objets": sorted(objects, key=lambda item: item["nom"]),
            "atlas_conserves": preserved, "matieres": sorted(families), "texture_px": 128, "texture_m": 2}


def write_report(report):
    path = ROOT / "docs/assets/bureaux-da/deploiement.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
