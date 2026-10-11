"""Grain discret de peinture, chrome et pneus ; couleurs de véhicules conservées."""
from pathlib import Path
import re

import bpy

from tools.art_direction.store_checkout import metric_uv
from tools.art_direction.surface_recipes import build_materials

ROOT = Path(__file__).resolve().parents[2]
RAMPS = {"vehicle_surface":("d2d5cf","e6e8df","f5f6ef","fffdf5")}
ORIGINALS = {"MAT_VEHICULES_COL_V1", "MAT_EXTENSION_VOITURES_COL", "MAT_MOTOS_COL_V1",
             "MAT_EXTENSION_MOTOS_COL"}


def apply():
    objects = []
    materials = None
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.visible_get() or obj.name.startswith("col_"):
            continue
        slots = [slot for slot in obj.material_slots if slot.material and
                 (re.sub(r"\.\d+$","",slot.material.name) in ORIGINALS
                  or re.sub(r"\.\d+$","",slot.material.name) == "da_vehicle_surface")]
        if not slots:
            continue
        colors = obj.data.color_attributes.get("Col")
        if colors is None:
            raise ValueError(f"Couleurs de véhicule absentes : {obj.name}")
        if materials is None:
            materials = build_materials({"vehicle_surface":slots[0].material},
                                        ROOT/"assets_src/library/art_direction/textures",RAMPS)
            mat = materials["vehicle_surface"]
            nodes,links = mat.node_tree.nodes,mat.node_tree.links
            shader = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
            texture = next(node for node in nodes if node.type == "TEX_IMAGE")
            vertex = next((node for node in nodes if node.type == "VERTEX_COLOR"),None)
            if vertex is None:
                vertex = nodes.new("ShaderNodeVertexColor")
            vertex.layer_name = "Col"
            mix = nodes.new("ShaderNodeMixRGB")
            mix.blend_type = "MULTIPLY"
            mix.inputs[0].default_value = 1
            links.new(vertex.outputs["Color"],mix.inputs[1])
            links.new(texture.outputs["Color"],mix.inputs[2])
            links.new(mix.outputs[0],shader.inputs["Base Color"])
        metric_uv(obj)
        obj.data.color_attributes.active_color = obj.data.color_attributes.get("Col")
        obj.data.color_attributes.render_color_index = obj.data.color_attributes.find("Col")
        for slot in slots:
            slot.material = materials["vehicle_surface"]
        objects.append(obj.name)
    return objects
