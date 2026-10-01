"""Repères permanents de la carte Or et de la circulation des employés."""
import json
from pathlib import Path
import bpy
from mathutils import Vector
import lib_helpers as H

REGIONS = json.loads((Path(H.TEX_DIR) / "sig_personnel.json").read_text())["regions"]


def panneau(name, region, origin, width, props, front="-y"):
    right = Vector({"-y": (1, 0, 0), "+y": (-1, 0, 0), "-x": (0, -1, 0)}[front])
    normal = Vector({"-y": (0, -1, 0), "+y": (0, 1, 0), "-x": (-1, 0, 0)}[front])
    origin = Vector(origin)
    up = Vector((0, 0, width / 8))
    mesh = bpy.data.meshes.new("rear_sign_" + name)
    mesh.from_pydata([origin, origin + right * width, origin + right * width + up, origin + up], [], [(0, 1, 2, 3)])
    mesh.update()
    x, y, w, h = REGIONS[region]
    uv = mesh.uv_layers.new(name="UVMap")
    for loop, coord in zip(uv.data, ((x/128, 1-(y+h)/128), ((x+w)/128, 1-(y+h)/128),
                                  ((x+w)/128, 1-y/128), (x/128, 1-y/128))):
        loop.uv = coord
    mesh.materials.append(H.textured_material("sig_personnel"))
    obj = bpy.data.objects.new(mesh.name, mesh)
    props.objects.link(obj)
    points = [origin - normal * .015 - up * .02 - right * .02,
              origin + right * (width + .02) + up * 1.02 - normal * .055]
    bounds = tuple(min(v[i] for v in points) for i in range(3)) + tuple(max(v[i] for v in points) for i in range(3))
    H.box(mesh.name + "_support", bounds, "metal_bac_acier", props, subdiv=10)


def installer(zone, props):
    if zone == "reserve":
        panneau("reserve_personnel", "personnel", (6, 131.70, 3.26), 4, props)
        panneau("sav_reserve", "sav", (19.70, 131.1, 2.135), 2.2, props, "-x")
    elif zone == "c_bu":
        panneau("objectif_or", "or", (8.75, 139.68, 3.15), 3, props)
        panneau("objectif_voiture", "voiture", (8.75, 139.68, 2.75), 3, props)
        panneau("parking_entree", "parking", (29, 139.68, 2.65), 3, props)
        panneau("sav_personnel", "sav", (22, 132.30, 2.135), 2, props, "+y")
    elif zone == "pc_secu":
        panneau("cctv_indice", "cctv", (23, 144.18, 2.6), 3.0, props)
    elif zone == "souterrain":
        panneau("voiture_direction", "direction", (65.5, 123.70, -3.3), 3, props)
        panneau("parking_retour", "retour", (47, 123.70, -3.3), 3, props)
        # Yellow frame on the wall focuses attention on the reserved car.
        H.boxes("rear_direction_cadre", [
            ((65.25, 123.67, -6, 65.35, 123.69, -2.7), "aplat:#f2c230"),
            ((68.65, 123.67, -6, 68.75, 123.69, -2.7), "aplat:#f2c230"),
        ], "palette", props, subdiv=10)
