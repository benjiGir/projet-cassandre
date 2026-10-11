"""Matières de la réserve et du quai, sans remplacer les atlas fonctionnels.

see: docs/assets/reserve-direction-artistique.md
"""
import json
from pathlib import Path
import re

import bpy

from tools.art_direction.store_checkout import RAMPS as CHECKOUT_RAMPS, metric_uv
from tools.art_direction.surface_recipes import build_materials

ROOT = Path(__file__).resolve().parents[2]
RAMPS = {key: CHECKOUT_RAMPS[key] for key in ("store_inox",)}
RAMPS.update({
    "reserve_sol": ("69716c", "979e93", "b6bcaf", "c7cbbe"),
    "reserve_enduit": ("7c8279", "aab0a0", "c6caba", "dbddcb"),
    "reserve_plafond": ("68716c", "8b9689", "a5ae9d", "bbc3af"),
    "reserve_rouge": ("493b32", "873c2c", "b14b32", "c87e52"),
    "reserve_carton": ("514531", "947244", "b28d55", "ddd2ad"),
    "reserve_bois": ("524331", "84683e", "a58752", "c3ab74"),
    "reserve_rideau": ("67746e", "88978c", "a1ac9d", "b7c0b0"),
    "reserve_fut": ("44534e", "687b6d", "839381", "a1ac94"),
    "reserve_outil": ("896d3e", "b6934f", "c9a959", "dfc174"),
})
FURNITURE = {"mat_metal_bac_acier": "store_inox", "mat_metal_peint_rouge": "reserve_rouge",
             "mat_bois_palette": "reserve_bois", "mat_carton": "reserve_carton",
             "mat_metal_tole_perforee": "reserve_rideau"}
PREVIOUS = {"store_rouge": "reserve_rouge", "store_carton": "reserve_carton", "store_bois": "reserve_bois"}
FLOORS = {"sol_reserve", "plateforme_rs", "rampe_plateforme_rs"}
WALLS = {"imposte_c_hb_rs_reserve", "imposte_compacteur_reserve", "mur_c_hb_rs_n2", "mur_c_hb_rs_n3"}
DOORS = {"door_argent", "door_reserve_nord", "door_compacteur_reserve", "door_sav_reserve"}
METAL = {"rs_garde_quai", "compacteur_reserve_rails"}


def selection(name, original):
    if name in FLOORS:
        return "sols", "reserve_sol"
    if name == "plafond_reserve":
        return "plafond", "reserve_plafond"
    if name.startswith(("mur_reserve_", "imposte_reserve_", "linteau_reserve_")) or name in WALLS:
        return "murs", "reserve_enduit"
    furniture = ((name.startswith(("str_rack_", "str_porte_quai_", "deco_palette_cartons_",
                                  "deco_fut_", "deco_transpalette_")) and "_rs_" in name)
                 or name.startswith("prop_reserve") or name in METAL or name in DOORS)
    if not furniture:
        return None, None
    if name.startswith("deco_fut_") and "_corps_" in name:
        return "mobilier", "reserve_fut"
    if name.startswith("deco_transpalette_fourches_"):
        return "mobilier", "reserve_outil"
    if name == "door_compacteur_reserve":
        return "mobilier", "reserve_rideau"
    current = original.removeprefix("da_")
    return "mobilier", FURNITURE.get(original) or PREVIOUS.get(current) or (current if current in RAMPS else None)


def carton_uv(obj):
    """Centre ruban et étiquette sur chaque carton joint, à 64 texels/m."""
    metric_uv(obj)
    mesh = obj.data
    adjacency = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        adjacency[a].append(b)
        adjacency[b].append(a)
    centers, visited = {}, set()
    for vertex in mesh.vertices:
        if vertex.index in visited:
            continue
        component, pending = [], [vertex.index]
        while pending:
            index = pending.pop()
            if index in visited:
                continue
            visited.add(index)
            component.append(index)
            pending.extend(adjacency[index])
        points = [mesh.vertices[index].co for index in component]
        center = [(min(point[axis] for point in points) + max(point[axis] for point in points)) / 2
                  for axis in range(3)]
        for index in component:
            centers[index] = center
    uv = mesh.uv_layers.active
    scale = obj.matrix_world.to_scale()
    for polygon in mesh.polygons:
        axis = max(range(3), key=lambda i: abs(polygon.normal[i]))
        a, b = ((1, 2), (0, 2), (0, 1))[axis]
        for index in polygon.loop_indices:
            vertex = mesh.loops[index].vertex_index
            point, center = mesh.vertices[vertex].co, centers[vertex]
            uv.data[index].uv = ((point[a] - center[a]) * scale[a] / 2 + .5,
                                 (point[b] - center[b]) * scale[b] / 2 + (.0 if axis == 2 else .5))


def apply():
    base = bpy.data.materials.get("mat_palette")
    if base is None:
        raise ValueError("Ouvrir le magasin avant la passe de réserve")
    materials = build_materials({key: base for key in RAMPS},
                                ROOT / "assets_src/library/art_direction/textures", RAMPS)
    bpy.context.view_layer.update()
    objects, families, preserved = [], set(), []
    counts = {"sols": 0, "murs": 0, "plafond": 0, "mobilier": 0}
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
    if counts["sols"] != 3 or counts["plafond"] != 1 or counts["murs"] < 16 or counts["mobilier"] < 45:
        raise ValueError(f"Sélection incomplète : {counts}")
    for mat in list(bpy.data.materials):
        if mat.name.startswith("da_") and mat.users == 0:
            bpy.data.materials.remove(mat)
    for image in list(bpy.data.images):
        if image.name.startswith(("store_", "reserve_")) and image.users == 0:
            bpy.data.images.remove(image)
    return {"zone": "réserve et quai de livraison", **counts,
            "objets": sorted(objects, key=lambda item: item["nom"]),
            "atlas_conserves": preserved, "matieres": sorted(families), "texture_px": 128, "texture_m": 2}


def write_report(report):
    path = ROOT / "docs/assets/reserve-da/deploiement.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
