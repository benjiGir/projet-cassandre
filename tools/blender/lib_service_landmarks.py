"""Repères SAV et chambre froide dans le couloir coupe-feu existant."""
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

import lib_helpers as H
import lib_rayons as L
import lib_electro as E
import lib_reserve as R

REGIONS = json.loads((Path(H.TEX_DIR) / "sig_service.json").read_text())["regions"]
# Origines des trois objets existants regroupés au pied du chantier froid.
POSITIONS = {"prop_csw_palette": (-38.0, 110.0, 0.0),
             "csw_flaque": (-38.25, 108.25, .005),
             "csw_seau": (-37.6, 108.55, 0.0)}


def face(name, region, origin, width, height, coll, front="-y"):
    right = {"-y": (1, 0, 0), "+y": (-1, 0, 0), "+x": (0, 1, 0)}[front]
    origin, right = Vector(origin), Vector(right)
    up = Vector((0, 0, height))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([origin, origin + right * width, origin + right * width + up, origin + up], [], [(0, 1, 2, 3)])
    mesh.update()
    x, y, w, h = REGIONS[region]
    uv = mesh.uv_layers.new(name="UVMap")
    for loop, coord in zip(uv.data, ((x/128, 1-(y+h)/128), ((x+w)/128, 1-(y+h)/128),
                                    ((x+w)/128, 1-y/128), (x/128, 1-y/128))):
        loop.uv = coord
    mesh.materials.append(H.textured_material("sig_service"))
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    return obj


def enseigne(region, y, width, props):
    name = "csw_rep_enseigne_" + region
    H.box(name + "_support", (-43.75, y, 2.8, -43.75 + width, y + .07, 3.08),
          "metal_bac_acier", props, subdiv=10)
    face(name + "_sud", region, (-43.75, y - .006, 2.81), width, .25, props)
    face(name + "_nord", region, (-43.75 + width, y + .076, 2.81), width, .25, props, "+y")


def panneau_fuite(props, col_coll):
    for tag, angle, y in (("sud", -15, 107.55), ("nord", 15, 107.85)):
        obj = H.box("csw_rep_fuite_support_" + tag, (0, -.015, 0, .55, .015, .65),
                    "palette", props, uv="aplat:#f2c230", subdiv=10)
        transform = Matrix.Translation(Vector((-38.2, y, 0))) @ Matrix.Rotation(math.radians(angle), 4, "X")
        obj.data.transform(transform)
        obj.data.update()
        sign = face("csw_rep_fuite_panneau_" + tag, "fuite",
                    (0, -.023, .12) if tag == "sud" else (.55, .023, .12),
                    .55, .3, props, "-y" if tag == "sud" else "+y")
        sign.data.transform(transform)
        sign.data.update()
    H.col_box("csw_rep_fuite", (-38.2, 107.5, 0, -37.65, 107.9, .65), col_coll)


def echelle(props, col_coll):
    """Escabeau ouvert : deux plans inclinés, six marches et une tablette."""
    vertices, faces = [], []

    def barre(start, end, radius):
        delta = Vector(end) - Vector(start)
        transform = Matrix.Translation(Vector(start)) @ delta.to_track_quat("Z", "Y").to_matrix().to_4x4()
        offset = len(vertices)
        vertices.extend(transform @ Vector((x, y, z)) for x, y, z in (
            (-radius, -radius, 0), (radius, -radius, 0), (radius, radius, 0), (-radius, radius, 0),
            (-radius, -radius, delta.length), (radius, -radius, delta.length),
            (radius, radius, delta.length), (-radius, radius, delta.length)))
        faces.extend(tuple(offset + i for i in f) for f in (
            (3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)))

    for x in (-37.35, -36.65):
        for y in (104.9, 105.9):
            barre((x, y, .04), (x, 105.4, 2.05), .035)
    for z in (.3, .6, .9, 1.2, 1.5, 1.8):
        for side in (-1, 1):
            y = 105.4 + side * .5 * (1 - z / 2.05)
            barre((-37.35, y, z), (-36.65, y, z), .04)
    mesh = bpy.data.meshes.new("csw_rep_escabeau")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        axis = max(range(3), key=lambda i: abs(poly.normal[i]))
        for index in poly.loop_indices:
            p = mesh.vertices[mesh.loops[index].vertex_index].co
            u, v = ((p.y, p.z), (p.x, p.z), (p.x, p.y))[axis]
            uv.data[index].uv = (u / 2, v / 2)
    mesh.materials.append(H.textured_material("metal_bac_acier"))
    obj = bpy.data.objects.new(mesh.name, mesh)
    props.objects.link(obj)
    H.box("csw_rep_escabeau_tablette", (-37.45, 105.2, 2.02, -36.55, 105.6, 2.1),
          "metal_peint_rouge", props, subdiv=10)
    H.col_box("csw_rep_escabeau", (-37.45, 104.85, 0, -36.55, 105.95, 2.1), col_coll)


def installer(props, col_coll):
    blue, yellow = "aplat:#1f5fbf", "aplat:#f2c230"
    # Minces plaques de peinture contre la coque ; aucun nouveau mur solide.
    for tag, y, color in (("sav", 118, blue), ("froid", 107, yellow)):
        H.boxes("csw_rep_cadre_" + tag, [
            ((-43.742, y - 1.5, 0, -43.72, y - .75, 2.7), color),
            ((-43.742, y + .75, 0, -43.72, y + 1.5, 2.7), color),
            ((-43.742, y - 1.5, 2.35, -43.72, y + 1.5, 2.7), color),
        ], "palette", props, subdiv=.75)
        face("csw_rep_nom_" + tag, tag, (-43.71, y - 1.5, 2.36), 3, .375, props, "+x")
    enseigne("sav", 116.5, 1.2, props)
    enseigne("technique", 105.5, 1.8, props)

    # Chantier froid à l'est, hors des passages et des portes battantes.
    echelle(props, col_coll)
    H.boxes("csw_rep_outils", [
        ((-37.55, 106.5, 0, -36.6, 107.15, .6), "aplat:#444a54"),
        ((-37.65, 106.4, .6, -36.5, 107.25, .72), "aplat:#605c58"),
        ((-37.48, 106.6, .72, -36.75, 107.08, .96), yellow),
        ((-37.28, 106.78, .96, -36.95, 106.9, 1.04), "aplat:#111014"),
    ], "palette", props, subdiv=.75)
    H.col_box("csw_rep_outils", (-37.65, 106.4, 0, -36.5, 107.25, 1.04), col_coll)
    H.boxes("csw_rep_poste_froid", [
        ((-36.31, 104.5, 1.15, -36.26, 108.0, 2.85), "aplat:#919292"),
        ((-36.38, 104.85, .15, -36.28, 104.95, 3.5), "aplat:#605c58"),
        ((-36.38, 107.8, .15, -36.28, 107.9, 3.5), "aplat:#605c58"),
        ((-36.39, 104.85, 1.8, -36.28, 107.9, 1.9), "aplat:#605c58"),
        ((-36.43, 107.3, 1.55, -36.32, 107.55, 2.05), "aplat:#d8231f"),
    ], "palette", props, subdiv=.75)
    panneau_fuite(props, col_coll)
    H.box("csw_rep_maintenance_support", (-38.02, 104.46, 2.64, -36.28, 104.52, 2.88),
          "metal_bac_acier", props, subdiv=10)
    face("csw_rep_maintenance", "maintenance", (-38.0, 104.45, 2.65), 1.7, .213, props)
    face("csw_rep_maintenance_revers", "maintenance", (-36.3, 104.53, 2.65), 1.7, .213, props, "+y")
    H.boxes("csw_rep_maintenance_suspension", [
        ((x, 104.47, 2.85, x + .025, 104.495, 4.0), "world")
        for x in (-37.8, -36.55)
    ], "metal_bac_acier", props, subdiv=10)

    # Retours SAV : chariot bleu et deux appareils hors emballage.
    H.boxes("csw_rep_chariot", [
        ((-37.75, 116.1, .12, -36.5, 117.85, .27), blue),
        ((-37.72, 117.6, .27, -37.64, 117.8, 1.18), "aplat:#605c58"),
        ((-36.61, 117.6, .27, -36.53, 117.8, 1.18), "aplat:#605c58"),
        ((-37.72, 117.6, 1.1, -36.53, 117.8, 1.2), "aplat:#605c58"),
    ], "palette", props, subdiv=.75)
    for x in (-37.62, -36.62):
        for y in (116.25, 117.6):
            wheel = H.cylinder(f"csw_rep_roue_{x}_{y}", (x, y), .1, -.06, .06,
                               "metal_bac_acier", props, segments=8)
            wheel.data.transform(Matrix.Translation(Vector((x, y, .1))) @ Matrix.Rotation(math.pi/2, 4, "X")
                                 @ Matrix.Translation(Vector((-x, -y, 0))))
            wheel.data.update()
    H.box("csw_rep_carton_retours", (-37.58, 116.25, .27, -36.7, 117.1, .94),
          "carton", props, subdiv=.75)
    L.place(E.petit_appareil("app_micro_ondes"), (-37.35, 116.45, .94), 0,
            props, props, "csw_rep_micro")
    L.place(E.petit_appareil("app_aspirateur"), (-37.3, 117.15, .27), 0,
            props, props, "csw_rep_aspirateur")
    H.col_box("csw_rep_chariot", (-37.75, 116.1, 0, -36.5, 117.85, 1.24), col_coll)
    face("csw_rep_depot_retours", "retours", (-37.75, 116.09, .27), 1.25, .156, props)
    L.place(R.extincteur(), (-43.7, 120.1, 1.05), -90, props, props, "csw_rep_extincteur")
    return {"reperes": 2, "proxies": 4, "lampes ajoutees": 0}


def regrouper_existants():
    for name, target in POSITIONS.items():
        obj = bpy.data.objects[name]
        if obj.data.users > 1:
            obj.data = obj.data.copy()
        lo = Vector(tuple(min((obj.matrix_world @ v.co)[i] for v in obj.data.vertices) for i in range(3)))
        delta = obj.matrix_world.inverted().to_3x3() @ (Vector(target) - lo)
        for vertex in obj.data.vertices:
            vertex.co += delta
        obj.data.update()
