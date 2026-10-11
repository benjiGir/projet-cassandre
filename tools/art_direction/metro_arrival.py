"""Finition froide de la gare privée, de la remontée et du parvis.

see: docs/assets/arrivee-direction-artistique.md
"""
import bpy

GROUPS = {"privee", "remontee", "parvis"}
DETAIL_PREFIXES = ("n5_privee_", "n5_remontee_", "n5_parvis_", "n5_tour_")
FAMILIES = ("acier", "petrole", "bois", "ambre", "prive_pierre", "prive_sol", "parvis_feuillage")
FIXTURES = {"use_n5_fin", "kit_quartier_n5_tour_commande_bouton"}


def apply(a, surfaces, proposed) -> dict:
    floors = {"n5_" + surface.id for surface in surfaces if surface.groupe in GROUPS}
    replacements = {a.mats[name]: proposed[name] for name in FAMILIES}
    replacements[a.mats["pave"]] = proposed["prive_pave"]
    replacements[a.mats["sol"]] = proposed["sol_voie"]
    replacements[a.mats["ivoire"]] = proposed["ivoire_peint"]
    objects, families = [], set()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith("col_"):
            continue
        kit = obj.get("kit", "")
        tower = kit == "repere_tour_56m" and obj.parent is not None and obj.parent.name == "stage_voyage_arrivee"
        if kit not in floors and not kit.startswith(DETAIL_PREFIXES) and obj.name not in FIXTURES and not tower:
            continue
        changed = False
        for slot in obj.material_slots:
            target = replacements.get(slot.material)
            if tower and slot.material == a.mats["ardoise"]:
                target = proposed["acier"]
            if target is not None:
                slot.material = target
                families.add(target.name)
                changed = True
        if changed:
            objects.append(obj.name)
    return {"zone": "station privée, remontée et parvis", "objets": sorted(objects),
            "matieres": sorted(families), "texture_px": 128, "texture_m": 2}
