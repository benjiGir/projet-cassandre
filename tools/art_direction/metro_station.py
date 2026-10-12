"""Finition des quais, tunnels et raccords du réseau.

see: docs/5-guides/direction-artistique.md
"""
import bpy

GROUPS = {"quais", "tunnel_a", "tunnel_b"}
DETAIL_PREFIXES = (
    "n5_garde_quai_", "n5_arriere_", "n5_assises_ouest_", "n5_assises_est_",
    "n5_plan_reseau_ouest_", "n5_plan_reseau_est_", "n5_corbeille_ouest_",
    "n5_corbeille_est_", "n5_quai_entretien_ouest_",
)
DETAILS = {"n5_architecture_rails", "n5_tete_station"}
FAMILIES = ("ivoire", "sol", "beton", "acier", "petrole", "bois", "ambre")


def apply(a, surfaces, proposed) -> dict:
    floors = {"n5_" + surface.id: surface for surface in surfaces if surface.groupe in GROUPS}
    replacements = {a.mats[name]: proposed[name] for name in FAMILIES}
    replacements[a.mats["marquage_quai"]] = proposed["ivoire_peint"]
    objects, families = [], set()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith("col_"):
            continue
        kit = obj.get("kit", "")
        surface = floors.get(kit)
        detail = (kit in DETAILS or kit.startswith(DETAIL_PREFIXES)) and not kit.startswith("n5_arriere_guichet")
        fixture = obj.name.startswith("kit_quartier_n5_suspente_affiche_")
        barrier = obj.name == "door_n5_tunnel"
        if surface is None and not detail and not fixture and not barrier:
            continue
        changed = False
        for slot in obj.material_slots:
            material = slot.material
            target = replacements.get(material)
            if material == a.mats["sol"]:
                walkway = surface is not None and surface.id.startswith(("quai_gauche", "quai_droit", "entree_tunnel", "niche_"))
                target = proposed["sol" if walkway else "sol_voie"]
            elif material == a.mats["ivoire"] and kit not in DETAILS and surface is None:
                target = proposed["ivoire_peint"]
            elif material == a.mats["enduit"] and kit == "n5_tete_station":
                target = proposed["ivoire"]
            if target is not None:
                slot.material = target
                families.add(target.name)
                changed = True
        if changed:
            objects.append(obj.name)
    return {"zone": "quais, tunnels A/B et arrière-tunnels", "objets": sorted(objects),
            "matieres": sorted(families), "texture_px": 128, "texture_m": 2}
