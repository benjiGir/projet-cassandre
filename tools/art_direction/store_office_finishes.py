"""Moquette continue et faux plafonds de l’étage administratif.

see: docs/assets/bureaux-finitions.md
"""
import json
from pathlib import Path
import math

import bpy
from mathutils import Vector

from tools.art_direction.store_checkout import metric_uv
from tools.art_direction.surface_recipes import build_materials

ROOT = Path(__file__).resolve().parents[2]
RAMPS = {
    "office_moquette_bleue":("222949","343955","454b60","596176"),
    "office_acoustique":("9d9e91","c9c8b7","e1dfcb","ece9d6"),
    "office_ossature":("94998f","bec3b3","d8ddca","e9ecdb"),
}
SURFACES = {"sol_bureaux":"office_moquette_bleue","sol_direction":"office_moquette_bleue",
            "plafond_bureaux":"office_acoustique","plafond_direction":"office_acoustique"}


def ceiling_frames(materials):
    import lib_helpers as H
    frames = []
    for zone in ("bureaux","direction"):
        name = "office_ceiling_rails_"+zone
        old = bpy.data.objects.get(name)
        if old:
            mesh = old.data
            bpy.data.objects.remove(old,do_unlink=True)
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        ceiling = bpy.data.objects.get("plafond_"+zone)
        if ceiling is None:
            raise ValueError(f"Plafond absent : {zone}")
        points = [ceiling.matrix_world @ Vector(corner) for corner in ceiling.bound_box]
        # La grille s’arrête dans les murs ; les barres transversales s’arrêtent
        # au bord des longerons pour éviter des faces qui se recouvrent.
        x0,x1 = min(v.x for v in points)+.25,max(v.x for v in points)-.25
        y0,y1 = min(v.y for v in points)+.25,max(v.y for v in points)-.25
        z = min(v.z for v in points)
        width = .025
        xs = [x0+i*.6 for i in range(math.ceil((x1-x0)/.6))]+[x1]
        ys = [y0+i*.6 for i in range(math.ceil((y1-y0)/.6))]+[y1]
        parts = []
        for x in xs:
            a,b = max(x0,x-width/2),min(x1,x+width/2)
            parts.append(((a,y0,z-.04,b,y1,z-.002),"world"))
        for y in ys:
            c,d = max(y0,y-width/2),min(y1,y+width/2)
            for left,right in zip(xs,xs[1:]):
                a,b = left+width/2,right-width/2
                if b > a:
                    parts.append(((a,c,z-.04,b,d,z-.002),"world"))
        obj = H.boxes(name,parts,"palette",ceiling.users_collection[0],subdiv=2.0)
        metric_uv(obj)
        obj.data.materials[0] = materials["office_ossature"]
        attr = obj.data.color_attributes.new(name="Col",type="FLOAT_COLOR",domain="CORNER")
        for poly in obj.data.polygons:
            shade = .84 if abs(poly.normal.z) < .5 else .95
            for index in poly.loop_indices:
                attr.data[index].color = (shade,shade,shade,1)
        frames.append({"nom":name,"pas_m":.6,"largeur_m":width,"retombee_m":.04,
                       "barres":len(parts),"altitude":round(z,3)})
    return frames


def apply():
    base = bpy.data.materials.get("mat_palette")
    if base is None:
        raise ValueError("Ouvrir le magasin avant cette retouche")
    materials = build_materials({key:base for key in RAMPS},
                               ROOT/"assets_src/library/art_direction/textures",RAMPS)
    objects = []
    for name,key in SURFACES.items():
        obj = bpy.data.objects.get(name)
        if obj is None or len(obj.material_slots) != 1:
            raise ValueError(f"Surface absente ou matériau ambigu : {name}")
        metric_uv(obj)
        obj.material_slots[0].material = materials[key]
        objects.append({"nom":name,"matiere":key})
    frames = ceiling_frames(materials)
    for mat in list(bpy.data.materials):
        if mat.name.startswith("da_") and mat.users == 0:
            bpy.data.materials.remove(mat)
    return {"zone":"bureaux et direction","surfaces":objects,"ossatures":frames,
            "texture_px":128,"texture_m":2}


def write_report(report):
    path = ROOT/"docs/assets/bureaux-finitions/deploiement.json"
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
