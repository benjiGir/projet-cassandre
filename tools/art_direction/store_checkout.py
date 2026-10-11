"""Matières de la galerie et des caisses, au build comme en retouche locale.

see: docs/assets/caisses-direction-artistique.md
"""
import json
from pathlib import Path
import re

import bpy

from tools.art_direction.surface_recipes import build_materials

ROOT = Path(__file__).resolve().parents[2]
TEXTURES = ROOT / "assets_src/library/art_direction/textures"
REVIEW = ROOT / "docs/assets/caisses-da"
RAMPS = {
    "store_terrazzo": ("8b8675", "a0a69b", "b1b6ac", "c2c6b8"),
    "store_terrazzo_fin": ("8e968b", "a3ac9f", "b1b6ac", "c2c6b8"),
    "store_carrelage": ("8a9186", "b6beae", "c1c8b8", "cdd3c4"),
    "store_stratifie": ("a49e8d", "c5bdad", "d2cbb8", "dfd8c8"),
    "store_inox": ("757f7b", "949f99", "a8b1aa", "bcc4bb"),
    "store_plastique": ("303b42", "434d55", "535f64", "677276"),
    "store_tapis": ("181e21", "252d30", "303a3e", "414b50"),
}
FLOORS = {"mat_sol_terrazzo": "store_terrazzo", "mat_sol_terrazzo_fin": "store_terrazzo_fin",
          "mat_sol_carrelage_blanc": "store_carrelage"}
CONNECTORS = {"sol_c_pk_ga", "sol_c_ga_cs"}
PARTS = {"plinthe": "store_plastique", "meuble": "store_stratifie", "dessus": "store_inox",
         "inox": "store_inox", "tapis": "store_tapis", "scan": "store_plastique",
         "registre": "store_plastique", "crt": "store_plastique", "lecteur_cb": "store_plastique",
         "tapis_attente": "store_tapis", "mat": "store_plastique"}


def metric_uv(obj):
    if obj.data.users > 1:
        obj.data = obj.data.copy()
    mesh = obj.data
    uv = mesh.uv_layers.active or mesh.uv_layers.new(name="UVMap")
    normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
    for polygon in mesh.polygons:
        normal = normal_matrix @ polygon.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        for index in polygon.loop_indices:
            point = obj.matrix_world @ mesh.vertices[mesh.loops[index].vertex_index].co
            u, v = ((point.y, point.z), (point.x, point.z), (point.x, point.y))[axis]
            uv.data[index].uv = (u / 2, v / 2)


def apply() -> dict:
    base = bpy.data.materials.get("mat_palette")
    if base is None:
        raise ValueError("Palette du magasin absente ; ouvrir niveau_v2.blend")
    source = {key: base for key in RAMPS}
    for original, key in FLOORS.items():
        source[key] = bpy.data.materials.get(original) or base
    materials = build_materials(source, TEXTURES, RAMPS)
    objects, families = [], set()
    floors, furniture = 0, 0
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith("col_"):
            continue
        name = re.sub(r"\.\d+$", "", obj.name)
        floor = name.startswith(("sol_caisses_", "sol_galerie_")) or name in CONNECTORS
        lane = re.fullmatch(r"ck_lane\d+_(.+)", name)
        key = PARTS.get(lane.group(1)) if lane else None
        if floor:
            for slot in obj.material_slots:
                original = re.sub(r"\.\d+$", "", slot.material.name) if slot.material else ""
                key = FLOORS.get(original) or (original.removeprefix("da_") if original.removeprefix("da_") in RAMPS else None)
                if key is not None:
                    slot.material = materials[key]
                    families.add(key)
            if key is None:
                raise ValueError(f"Sol sans famille connue : {obj.name}")
            floors += 1
        elif key is not None:
            metric_uv(obj)
            obj.data.materials.clear()
            obj.data.materials.append(materials[key])
            for polygon in obj.data.polygons:
                polygon.material_index = 0
            furniture += 1
            families.add(key)
        else:
            continue
        objects.append(obj.name)
    for material in list(bpy.data.materials):
        if material.name.startswith("da_store_") and material.users == 0:
            bpy.data.materials.remove(material)
    for image in list(bpy.data.images):
        if image.name.startswith("store_") and image.users == 0:
            bpy.data.images.remove(image)
    if floors != 7 or furniture != 66:
        raise ValueError(f"Sélection incomplète : {floors} sols et {furniture} éléments de caisse")
    return {"zone": "galerie d’entrée et six caisses", "objets": sorted(objects), "sols": floors,
            "mobilier": furniture, "matieres": sorted(families), "texture_px": 128, "texture_m": 2}


def write_report(report):
    REVIEW.mkdir(parents=True, exist_ok=True)
    (REVIEW / "deploiement.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
