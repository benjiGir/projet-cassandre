"""Faïence et équipements des sanitaires attenants à la cafétéria.

see: docs/assets/sanitaires-direction-artistique.md
"""
import json
from pathlib import Path
import re

import bpy

from tools.art_direction.store_checkout import RAMPS as CHECKOUT_RAMPS, metric_uv
from tools.art_direction.store_cafeteria import RAMPS as CAFETERIA_RAMPS
from tools.art_direction.surface_recipes import RAMPS as QUAY_RAMPS, build_materials

ROOT = Path(__file__).resolve().parents[2]
RAMPS = {
    "store_inox": CHECKOUT_RAMPS["store_inox"],
    "store_enduit": CAFETERIA_RAMPS["store_enduit"],
    "wc_stratifie": QUAY_RAMPS["petrole"],
    "wc_faience": ("a8afa3", "c9cfc1", "d5dacc", "e2e6dc"),
}
PARTITIONS = {"wc_cloisons", "wc_urinoir_separation"}
METAL = {"wc_lisse", "wc_plaque_chasse", "wc_seche_mains", "wc_tuyaux", "wc_pieds", "wc_robinets", "wc_cadres_miroirs"}


def apply():
    base = bpy.data.materials.get("mat_palette")
    if base is None:
        raise ValueError("Ouvrir le magasin avant la passe de sanitaires")
    materials = build_materials({key: base for key in RAMPS},
                                ROOT / "assets_src/library/art_direction/textures", RAMPS)
    bpy.context.view_layer.update()
    objects = []
    counts = {"murs": 0, "plafond": 0, "cabines": 0, "metal": 0}
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.visible_get():
            continue
        name = re.sub(r"\.\d+$", "", obj.name)
        if name.startswith("mur_toilettes_"):
            category, key = "murs", "wc_faience"
        elif name == "plafond_toilettes":
            category, key = "plafond", "store_enduit"
        elif name in PARTITIONS:
            category, key = "cabines", "wc_stratifie"
        elif name in METAL:
            category, key = "metal", "store_inox"
        else:
            continue
        if len(obj.material_slots) != 1:
            raise ValueError(f"Matière unique attendue : {name}")
        if obj.data.users > 1:
            obj.data = obj.data.copy()
        metric_uv(obj)
        obj.material_slots[0].material = materials[key]
        counts[category] += 1
        objects.append({"nom": name, "categorie": category, "matiere": key})
    if counts != {"murs": 5, "plafond": 1, "cabines": len(PARTITIONS), "metal": len(METAL)}:
        raise ValueError(f"Sélection incomplète : {counts}")
    for mat in list(bpy.data.materials):
        if mat.name.startswith(("da_store_", "da_wc_")) and mat.users == 0:
            bpy.data.materials.remove(mat)
    for image in list(bpy.data.images):
        if image.name.startswith(("store_", "wc_")) and image.users == 0:
            bpy.data.images.remove(image)
    return {"zone": "sanitaires", **counts, "sol": "damier partagé avec la cafétéria, conservé",
            "objets": sorted(objects, key=lambda item: item["nom"]), "matieres": sorted(RAMPS),
            "texture_px": 128, "texture_m": 2}


def write_report(report):
    path = ROOT / "docs/assets/sanitaires-da/deploiement.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
