"""Finition des rames, du garage et des suspentes de signal.

see: docs/5-guides/direction-artistique.md
"""
import re

import bpy

FAMILIES = ("acier", "petrole", "beton", "bois", "ambre", "fret_paroi", "fret_tissu", "fret_cable")
DOORS = {"door_n5_rame_entree", "door_n5_rame_sortie"}
PUBLIC_TRAIN = {"acier": "acier", "petrole": "petrole", "peinture": "fret_paroi", "sol": "sol_rame", "ivoire": "ivoire_peint", "ambre": "ambre"}


def apply(a, surfaces, proposed) -> dict:
    floors = {"n5_" + surface.id for surface in surfaces if surface.groupe == "fret"}
    replacements = {a.mats[name]: proposed[name] for name in FAMILIES}
    replacements[a.mats["ivoire"]] = proposed["ivoire_peint"]
    objects, families, groups = [], set(), {"service": 0, "trafic": 0, "suspentes": 0}
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith("col_"):
            continue
        kit = obj.get("kit", "")
        traffic = obj.parent is not None and obj.parent.name == "train_modele_n5"
        hanger = obj.name.startswith("kit_quartier_n5_suspente_signal_")
        if kit not in floors and not kit.startswith("n5_fret_") and obj.name not in DOORS and not traffic and not hanger:
            continue
        changed = False
        for slot in obj.material_slots:
            material = slot.material
            if material is None:
                continue
            if traffic:
                # La bibliothèque de trafic est chargée séparément : ses pointeurs diffèrent.
                key = re.sub(r"\.\d+$", "", material.name).removeprefix("metro_")
                target = proposed.get(PUBLIC_TRAIN.get(key))
            else:
                target = replacements.get(material)
                if material == a.mats["sol"]:
                    target = proposed["sol_rame" if kit in floors else "sol_voie"]
            if target is not None:
                slot.material = target
                families.add(target.name)
                changed = True
        if changed:
            objects.append(obj.name)
            groups["trafic" if traffic else "suspentes" if hanger else "service"] += 1
    return {"zone": "rame de service, garage, rames de trafic et suspentes", "objets": sorted(objects),
            "groupes": groups, "matieres": sorted(families), "texture_px": 128, "texture_m": 2}
