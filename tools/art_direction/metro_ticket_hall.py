"""Finition du hall public, du guichet et de la descente.

see: docs/assets/billetterie-direction-artistique.md
"""
import bpy

DETAILS = {"n5_guichet", "n5_portiques", "n5_descente_quai", "n5_assises_hall",
           "n5_plan_reseau_hall", "n5_corbeille_hall"}
DETAIL_PREFIXES = ("n5_billets_terminal_",)
FIXTURES = {"kit_quartier_n5_grille_potelet", "kit_quartier_n5_grille_socle",
            "kit_quartier_service_sud_est"}
FAMILIES = ("ivoire", "sol", "acier", "petrole", "bois", "ambre")


def apply(a, surfaces, proposed) -> dict:
    floors = {"n5_" + surface.id for surface in surfaces if surface.groupe == "billets"}
    replacements = {a.mats[name]: proposed[name] for name in FAMILIES}
    replacements[a.mats["enduit"]] = proposed["ivoire"]
    replacements[a.mats["ardoise"]] = proposed["sol"]
    replacements[a.mats["peinture_ivoire"]] = proposed["ivoire_peint"]
    objects, families = [], set()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith("col_"):
            continue
        kit = obj.get("kit", "")
        if kit not in floors and kit not in DETAILS and not kit.startswith(DETAIL_PREFIXES) and obj.name not in FIXTURES:
            continue
        changed = False
        for slot in obj.material_slots:
            material = slot.material
            target = replacements.get(material)
            if material == a.mats["ivoire"] and kit not in floors and kit != "n5_descente_quai":
                target = proposed["ivoire_peint"]
            if target is not None:
                slot.material = target
                families.add(target.name)
                changed = True
        if changed:
            objects.append(obj.name)
    return {"zone": "billetterie, guichet et descente publique", "objets": sorted(objects),
            "matieres": sorted(families), "texture_px": 128, "texture_m": 2}
