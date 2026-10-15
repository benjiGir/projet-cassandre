"""Déploiement local de l'étalon dans les galeries et le vestiaire.

see: docs/5-guides/direction-artistique.md
"""
import bpy

FAMILIES = ("sol", "beton", "acier", "petrole", "bois", "ambre")
DETAILS = {
    "n5_galeries_service", "n5_galerie_coffret_17",
    "n5_premiere_galerie_entretien", "n5_galerie_distribution",
    "n5_galerie_retour", "n5_local_agents",
}


def apply(a, surfaces, proposed) -> dict:
    kits = DETAILS | {"n5_" + surface.id for surface in surfaces
                      if surface.groupe == "galeries"
                      or surface.id.startswith(("local_agents", "acces_sang_froid"))}
    paint = proposed["ivoire_peint"]
    replacements = {a.mats[name]: proposed[name] for name in FAMILIES}
    replacements[a.mats["agents_ivoire"]] = paint
    replacements[a.mats["armoire_ivoire"]] = paint
    objects, families = [], set()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith("col_") or obj.get("kit") not in kits:
            continue
        changed = False
        for slot in obj.material_slots:
            if slot.material in replacements:
                slot.material = replacements[slot.material]
                families.add(slot.material.name)
                changed = True
        if changed:
            objects.append(obj.name)
    return {"zone": "galeries et vestiaire des agents", "objets": sorted(objects),
            "matieres": sorted(families), "texture_px": 128, "texture_m": 2}
