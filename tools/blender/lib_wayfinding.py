"""Route signage for the hub, underground exit and staff corridor.

The front faces local -Y. Each printed face has its own arrow: a left turn
seen from one side becomes right when approached from the opposite side.
"""
import json
from pathlib import Path
import bpy
import lib_helpers as H
import lib_rayons as L

BANDS = json.loads((Path(H.TEX_DIR) / "sig_parcours.json").read_text())["bands"]
# zone, suffix, front, back, origin, yaw, suspension length
PLACEMENTS = (
    ("hub", "hub_approche", "reserve_avancer", "magasin_avancer", (-1.0, 57.0, 2.85), 0, 2.9),
    ("hub", "hub_reserve", "reserve_avancer", "magasin_avancer", (-1.0, 85.0, 2.85), 0, 2.9),
    ("souterrain", "so_bureaux_relais", "bureaux_gauche", "bureaux_droite", (32.0, 117.5, -3.45), 270, .7),
    ("souterrain", "so_magasin_relais", "magasin_gauche", "magasin_droite", (32.0, 117.5, -3.10), 270, .35),
    ("souterrain", "so_bureaux_rampe", "bureaux_avancer", "parking_avancer", (39.0, 123.55, -3.45), 0, .7),
    ("souterrain", "so_magasin_rampe", "magasin_avancer", None, (39.0, 123.55, -3.10), 0, .35),
    ("c_bu", "personnel_bureaux", "bureaux_gauche", None, (34.6, 139.68, 2.5), 0, 0),
    ("c_bu", "personnel_magasin", "magasin_gauche", None, (34.6, 139.68, 2.15), 0, 0),
    ("c_bu", "escalier_bureaux", "bureaux_avancer", None, (4.0, 139.68, 2.5), 0, 0),
    ("c_bu", "escalier_magasin", "magasin_gauche", None, (4.0, 139.68, 2.15), 0, 0),
)


def panneau(front, back=None, suspension=0):
    name = f"sig_parcours_{front}_{back or 'vide'}_{suspension:g}".replace(".", "_")
    coll, done = L.asset_coll(name)
    if done:
        return name
    width, height = 2.0, .25
    parts = [((-.035, 0, -.035, width + .035, .065, height + .035), "world")]
    if suspension:
        parts += [((x, .025, height, x + .025, .05, height + suspension), "world")
                  for x in (.2, width - .225)]
    H.boxes(name + "_support", parts, "metal_bac_acier", coll, subdiv=10)
    vertices, faces, uvs = [], [], []
    for band, rear in ((front, False), (back, True)):
        if band is None:
            continue
        meta = BANDS[band]
        v0 = 1 - (meta["y"] + meta["height"]) / 128
        v1 = 1 - meta["y"] / 128
        quad = [(0, -.006, 0), (width, -.006, 0), (width, -.006, height), (0, -.006, height)]
        if rear:
            quad = [(width, .071, 0), (0, .071, 0), (0, .071, height), (width, .071, height)]
        start = len(vertices)
        vertices.extend(quad)
        faces.append(tuple(range(start, start + 4)))
        uvs.extend(((0, v0), (1, v0), (1, v1), (0, v1)))
    mesh = bpy.data.meshes.new(name + "_faces")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    for loop, coord in zip(uv.data, uvs):
        loop.uv = coord
    mesh.materials.append(H.textured_material("sig_parcours"))
    obj = bpy.data.objects.new(name + "_faces", mesh)
    coll.objects.link(obj)
    return name


def installer(zone, props):
    placed = []
    for target, suffix, front, back, position, rotation, suspension in PLACEMENTS:
        if target == zone:
            placed.extend(L.place(panneau(front, back, suspension), position, rotation,
                                  props, props, f"nav_{suffix}"))
    if zone == "souterrain":
        # Blue portal marks the correct ramp without narrowing its opening.
        H.boxes("sig_parcours_portique_nav_so_rampe", [
            ((35.78, 123.71, -6, 35.95, 123.73, -2.87), "aplat:#1f5fbf"),
            ((44.05, 123.71, -6, 44.22, 123.73, -2.87), "aplat:#1f5fbf"),
            ((35.78, 123.71, -2.95, 44.22, 123.73, -2.80), "aplat:#1f5fbf"),
        ], "palette", props, subdiv=10)
    return placed
