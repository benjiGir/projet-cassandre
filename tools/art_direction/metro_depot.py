"""Finition du dépôt, de ses ateliers et du quai d'embarquement.

see: docs/5-guides/direction-artistique.md
"""
import bpy

from tools.art_direction.metro_materials import DEPOT_RAMPS

FAMILIES = ("beton", "acier", "petrole", "bois", "ambre")


def apply(a, surfaces, proposed) -> dict:
    floors = {"n5_" + surface.id for surface in surfaces if surface.groupe == "depot"}
    replacements = {a.mats[name]: proposed[name] for name in (*FAMILIES, *DEPOT_RAMPS)}
    replacements[a.mats["sol"]] = proposed["sol_voie"]
    for name in ("ivoire", "armoire_ivoire", "marquage_quai"):
        replacements[a.mats[name]] = proposed["ivoire_peint"]
    objects, families = [], set()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith("col_"):
            continue
        kit = obj.get("kit", "")
        if kit not in floors and not kit.startswith("n5_depot_"):
            continue
        changed = False
        for slot in obj.material_slots:
            target = replacements.get(slot.material)
            if target is not None:
                slot.material = target
                families.add(target.name)
                changed = True
        if changed:
            objects.append(obj.name)
    return {"zone": "dépôt, ateliers et embarquement", "objets": sorted(objects),
            "matieres": sorted(families), "texture_px": 128, "texture_m": 2}
