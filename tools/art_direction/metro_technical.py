"""Finition de la machinerie, du local d'entretien et du poste d'aiguillage.

see: docs/assets/technique-direction-artistique.md
"""
import bpy

GROUPS = {"machinerie", "poste", "secret_4"}
DETAIL_PREFIXES = ("n5_machinerie_", "n5_poste_")
FAMILIES = ("beton", "acier", "petrole", "bois", "ambre")
PIT_FLOOR = "kit_quartier_n5_fond_fosse"


def apply(a, surfaces, proposed) -> dict:
    floors = {"n5_" + surface.id: surface for surface in surfaces if surface.groupe in GROUPS}
    replacements = {a.mats[name]: proposed[name] for name in FAMILIES}
    for name in ("ivoire", "armoire_ivoire", "peinture_ivoire"):
        replacements[a.mats[name]] = proposed["ivoire_peint"]
    objects, families = [], set()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith("col_"):
            continue
        kit = obj.get("kit", "")
        surface = floors.get(kit)
        if surface is None and not kit.startswith(DETAIL_PREFIXES) and obj.name != PIT_FLOOR:
            continue
        changed = False
        for slot in obj.material_slots:
            material = slot.material
            target = replacements.get(material)
            if material in (a.mats["sol"], a.mats["ardoise"]):
                target = proposed["sol" if surface is not None and surface.groupe == "poste" else "sol_voie"]
            elif material == a.mats["enduit"]:
                target = proposed["ivoire_mur" if surface is not None and surface.groupe == "poste" else "beton"]
            elif material == a.mats["ivoire"] and kit == "n5_machinerie_ventilation":
                target = proposed["atelier_metal"]
            if target is not None:
                slot.material = target
                families.add(target.name)
                changed = True
        if changed:
            objects.append(obj.name)
    return {"zone": "machinerie, local d'entretien et poste d'aiguillage", "objets": sorted(objects),
            "matieres": sorted(families), "texture_px": 128, "texture_m": 2}
