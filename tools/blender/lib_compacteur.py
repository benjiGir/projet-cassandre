"""Compacteur et planque du vigile — habillage du board des coulisses.

La presse reste un décor de maintenance. Les balles devant le secret utilisent
les props cassables existants ; la télé utilise la chaîne animée « foot ».
Toutes les cotes sont en mètres, dans les deux pièces du plan de masse.
"""
import json
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

import lib_helpers as H
import lib_rayons as L
import lib_bureaux as B
import lib_reserve as R

SIGNS = json.loads((Path(H.TEX_DIR) / "sig_compacteur.json").read_text())["regions"]


def plaque(name, region, origin, width, height, coll, front="-y"):
    right = {"-y": Vector((1, 0, 0)), "+y": Vector((-1, 0, 0)),
             "-x": Vector((0, -1, 0)), "+x": Vector((0, 1, 0))}[front]
    origin = Vector(origin)
    up = Vector((0, 0, height))
    vertices = [origin, origin + right * width, origin + right * width + up, origin + up]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], [(0, 1, 2, 3)])
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    x, y, w, h = SIGNS[region]
    coordinates = ((x / 128, 1 - (y + h) / 128), ((x + w) / 128, 1 - (y + h) / 128),
                   ((x + w) / 128, 1 - y / 128), (x / 128, 1 - y / 128))
    for loop, coord in zip(uv.data, coordinates):
        loop.uv = coord
    mesh.materials.append(H.textured_material("sig_compacteur"))
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    return obj


def rod(name, start, end, radius, color, coll):
    direction = Vector(end) - Vector(start)
    obj = H.box(name, (-radius, -radius, 0, radius, radius, direction.length),
                "palette", coll, uv=f"aplat:{color}", subdiv=10)
    transform = Matrix.Translation(Vector(start)) @ direction.to_track_quat("Z", "Y").to_matrix().to_4x4()
    obj.data.transform(transform)
    obj.data.update()
    return obj


def local_cardboard_uv(obj, origin):
    origin = Vector(origin)
    uv = obj.data.uv_layers.active
    for polygon in obj.data.polygons:
        axis = max(range(3), key=lambda i: abs(polygon.normal[i]))
        for index in polygon.loop_indices:
            p = obj.data.vertices[obj.data.loops[index].vertex_index].co - origin
            u, v = ((p.y, p.z), (p.x, p.z), (p.x, p.y))[axis]
            uv.data[index].uv = (u / 2, v / 2)


def balle(name, position, props, col_coll, height=1.3, loose=False):
    x, y, z = position
    bounds = (x, y, z, x + 1.2, y + .78, z + height)
    if loose:
        obj = H.prop(name, bounds, "carton_mal_cercle", props,
                     masse=14, pv=26, matiere="carton")
    else:
        obj = H.boxes(name, [
            ((x, y, z, x + 1.2, y + .78, z + height - .12), "world"),
            ((x + .04, y + .02, z + height - .12,
              x + 1.16, y + .75, z + height - .04), "world"),
            ((x + .1, y + .05, z + height - .04,
              x + 1.1, y + .7, z + height), "world"),
        ], "carton_compresse", props, subdiv=.75)
        H.col_box(name, bounds, col_coll)
    local_cardboard_uv(obj, position)
    return obj


def palettes_vides(props, col_coll):
    pieces = []
    x, y = -35.3, 116.5
    for level in range(3):
        z = level * .15
        for yy in (0, .35, .7):
            pieces.append(((x, y + yy, z, x + 1.2, y + yy + .08, z + .07), "world"))
        for xx in (0, .28, .56, .84, 1.12):
            pieces.append(((x + xx, y, z + .07, x + xx + .08, y + .8, z + .15), "world"))
    H.boxes("co_palettes_vides", pieces, "bois_palette", props, subdiv=.75)
    H.col_box("co_palettes_vides", (x, y, 0, x + 1.2, y + .8, .45), col_coll)


def presse(props, col_coll):
    green, dark, steel = "aplat:#65814b", "aplat:#2f3541", "aplat:#605c58"
    H.boxes("co_presse_chassis", [
        ((-34.3, 112.55, .05, -31.55, 114.7, .22), dark),
        ((-34.2, 112.65, .22, -31.7, 112.9, 2.95), green),
        ((-34.2, 112.9, .22, -33.96, 114.65, 2.95), green),
        ((-31.94, 112.9, .22, -31.7, 114.65, 2.95), green),
        ((-34.2, 112.9, 2.72, -31.7, 114.65, 2.95), green),
        ((-33.96, 112.9, .22, -31.94, 114.28, 2.72), dark),
        ((-33.88, 114.42, 1.42, -32.02, 114.69, 1.57), green),
        ((-31.68, 113.45, 1.08, -31.1, 114.25, 1.85), steel),
        ((-31.45, 113.7, .12, -31.32, 113.92, 1.1), steel),
        ((-31.65, 113.55, 0, -31.15, 114.15, .12), dark),
        ((-31.64, 114.25, 1.13, -31.14, 114.3, 1.8), "aplat:#d5d7d8"),
        ((-31.55, 114.31, 1.52, -31.43, 114.37, 1.66), "aplat:#d8231f"),
        ((-31.29, 114.31, 1.3, -31.18, 114.36, 1.42), "aplat:#2e9e44"),
        ((-31.56, 114.31, 1.28, -31.46, 114.35, 1.39), "aplat:#111014"),
        ((-34.0, 113.02, 2.95, -33.44, 113.66, 3.35), dark),
    ], "palette", props, subdiv=.75)
    H.boxes("co_presse_portes", [
        ((-33.96, 114.45, .24, -31.94, 114.64, 1.4), "world"),
        ((-33.85, 114.66, .65, -32.05, 114.72, .76), "world"),
        ((-33.85, 114.66, 1.13, -32.05, 114.72, 1.24), "world"),
    ], "metal_bac_acier", props, subdiv=.75)
    grille = []
    for i in range(9):
        x = -33.82 + i * .215
        grille.append(((x, 114.6, 1.61, x + .045, 114.68, 2.61), "aplat:#444a54"))
    for z in (1.61, 2.07, 2.57):
        grille.append(((-33.87, 114.6, z, -32.02, 114.68, z + .045), "aplat:#444a54"))
    H.boxes("co_presse_grille", grille, "palette", props, subdiv=10)
    H.box("co_presse_carton_charge", (-33.7, 114.3, 1.6, -32.2, 114.52, 2.15),
          "carton_compresse", props, subdiv=.75)
    H.cylinder("co_presse_verin", (-32.95, 113.5), .19, 2.95, 3.58,
               "metal_bac_acier", props, segments=10)
    H.cylinder("co_presse_tige", (-32.95, 113.5), .08, 3.58, 4.06,
               "metal_bac_acier", props, segments=8)
    rod("co_presse_conduite0", (-33.72, 113.4, 3.3), (-33.72, 113.4, 3.68), .045, "#111014", props)
    rod("co_presse_conduite1", (-33.72, 113.4, 3.68), (-33.02, 113.4, 3.68), .045, "#111014", props)
    H.box("co_presse_poignee", (-32.2, 114.73, .85, -31.96, 114.82, 1.15),
          "palette", props, uv="aplat:#111014", subdiv=10)
    H.box("co_presse_seuil_danger", (-34.22, 114.7, .1, -31.68, 114.75, .28),
          "metal_bandes_danger", props, subdiv=.75)
    plaque("co_plaque_presse", "presse", (-31.72, 114.675, 2.74), 2.46, .31, props, "+y")
    plaque("co_plaque_maintenance", "maintenance", (-32.18, 114.735, .88), 1.45, .18, props, "+y")
    plaque("co_plaque_danger", "danger", (-31.16, 114.305, 1.1), .46, .23, props, "+y")
    H.col_box("co_presse", (-34.3, 112.55, 0, -31.7, 114.82, 2.95), col_coll)
    H.col_box("co_presse_commandes", (-31.68, 113.45, 0, -31.1, 114.37, 1.85), col_coll)
    H.boxes("co_marquage_presse", [
        ((-34.6, 112.4, .012, -34.5, 116.1, .022), "aplat:#f2c230"),
        ((-30.8, 112.4, .012, -30.7, 116.1, .022), "aplat:#f2c230"),
        ((-34.6, 116.0, .012, -30.7, 116.1, .022), "aplat:#f2c230"),
    ], "palette", props, subdiv=10)


def benne(props, col_coll):
    H.boxes("co_benne", [
        ((-26.85, 119.2, .25, -24.55, 120.65, .4), "aplat:#444a54"),
        ((-26.85, 119.2, .4, -26.73, 120.65, 1.4), "aplat:#65814b"),
        ((-24.67, 119.2, .4, -24.55, 120.65, 1.4), "aplat:#65814b"),
        ((-26.73, 119.2, .4, -24.67, 119.32, 1.4), "aplat:#65814b"),
        ((-26.73, 120.53, .4, -24.67, 120.65, 1.4), "aplat:#65814b"),
        ((-26.8, 120.03, 1.4, -24.6, 120.61, 1.49), "aplat:#3b4528"),
        ((-26.7, 119.07, 1.1, -24.7, 119.18, 1.22), "aplat:#444a54"),
    ], "palette", props, subdiv=.75)
    for x in (-26.7, -24.9):
        for y in (119.35, 120.3):
            H.box(f"co_benne_roue_{x}_{y}", (x, y, 0, x + .2, y + .25, .3),
                  "palette", props, uv="aplat:#111014", subdiv=10)
    H.box("co_benne_dechets", (-26.7, 119.35, .45, -24.7, 120.48, 1.09),
          "carton_compresse", props, subdiv=.75)
    H.col_box("co_benne", (-26.85, 119.07, 0, -24.55, 120.65, 1.49), col_coll)


def habiller_compacteur(space, props, col_coll, logic, light):
    presse(props, col_coll)
    palettes_vides(props, col_coll)
    benne(props, col_coll)
    L.place(R.transpalette(), (-30.4, 120.1, 0), 20, props, col_coll, "co_transpalette")
    for i, x in enumerate((-35.2, -30.55)):
        for level in range(2):
            balle(f"co_balle_stock_{i}_{level}", (x, 126.6, level * 1.3), props, col_coll)
    for i, y in enumerate((123.5, 124.65)):
        balle(f"co_balle_quai_{i}", (-25.7, y, 0), props, col_coll)
    balle("co_balle_secret_bas", (-32.6, 126.9, 0), props, col_coll, loose=True)
    balle("co_balle_secret_haut", (-32.6, 126.9, 1.3), props, col_coll, height=1.05, loose=True)
    plaque("co_plaque_quai", "quai", (-24.35, 117.0, 2.84), 2.0, .25, props, "-x")
    H.box("co_projecteur_dos", (-33.18, 115.1, 4.22, -32.32, 115.55, 4.6),
          "palette", props, uv="aplat:#2f3541", subdiv=10)
    H.box("co_projecteur_lampe", (-33.1, 115.06, 4.28, -32.4, 115.09, 4.52),
          "palette", props, uv="aplat:#f2efe6", subdiv=10)
    rod("co_projecteur_tige", (-32.75, 115.3, 4.6), (-32.75, 115.3, 4.96), .04, "#444a54", props)
    light(logic, "light_co_projecteur", (-32.75, 115.0, 4.1), color="#fff0d0", intensity=16, distance=14)
    H.box("co_camera_support", (-35.74, 118.15, 3.1, -35.23, 118.27, 3.22),
          "palette", props, uv="aplat:#444a54", subdiv=10)
    H.box("co_camera_corps", (-35.38, 118.14, 3.2, -35.04, 118.5, 3.43),
          "palette", props, uv="aplat:#d5d7d8", subdiv=10)
    H.boxes("co_camera_carton", [
        ((-35.53, 118.05, 3.18, -35.47, 118.58, 3.58), "world"),
        ((-35.53, 118.05, 3.52, -34.98, 118.58, 3.58), "world"),
        ((-35.53, 118.05, 3.18, -34.98, 118.11, 3.52), "world"),
        ((-35.53, 118.52, 3.18, -34.98, 118.58, 3.52), "world"),
        ((-35.04, 118.11, 3.18, -34.98, 118.52, 3.52), "world"),
    ], "carton", props, subdiv=10)
    return {"presse": 1, "balles": 8, "benne": 1, "lampes": 1}


def habiller_planque(space, props, col_coll, logic, light):
    L.place(B.meuble("loungeSofa"), (-33.95, 129.05, 0), 90, props, col_coll, "s4_canape")
    L.place(B.meuble("tableCoffee"), (-33.5, 130.05, 0), 0, props, col_coll, "s4_table")
    L.place(B.meuble("kitchenFridge"), (-29.35, 129.4, 0), 270, props, col_coll, "s4_frigo")
    L.place(B.meuble("lampRoundTable"), (-33.2, 130.3, .45), 0, props, col_coll, "s4_lampe")
    H.box("s4_caisse_tele", (-30.05, 130.02, 0, -29.18, 131.02, .6), "bois_palette", props)
    H.col_box("s4_caisse_tele", (-30.05, 130.02, 0, -29.18, 131.02, .6), col_coll)
    H.boxes("s4_tele_crt", [
        ((-29.92, 130.06, .6, -29.23, 130.97, 1.36), "aplat:#444a54"),
        ((-30.01, 130.06, .67, -29.92, 130.97, 1.3), "aplat:#988776"),
        ((-30.02, 130.86, .77, -29.98, 130.93, 1.18), "aplat:#111014"),
        ((-29.54, 130.17, 1.36, -29.39, 130.86, 1.45), "aplat:#111014"),
    ], "palette", props, subdiv=10)
    H.ecran("s4_foot", (-30.025, 130.18, .76, -30.015, 130.81, 1.21),
            "foot", props, pv=12, front="-x")
    rod("s4_antenne0", (-29.45, 130.51, 1.43), (-29.43, 130.1, 1.78), .013, "#d5d7d8", props)
    rod("s4_antenne1", (-29.45, 130.51, 1.43), (-29.43, 130.9, 1.73), .013, "#d5d7d8", props)
    H.boxes("s4_casier", [
        ((-32.05, 131.14, 0, -31.2, 131.62, 1.88), "aplat:#605c58"),
        ((-32.0, 131.10, .12, -31.25, 131.14, 1.8), "aplat:#444a54"),
        ((-31.4, 131.04, .86, -31.32, 131.1, 1.04), "aplat:#f2c230"),
    ], "palette", props, subdiv=.75)
    H.col_box("s4_casier", (-32.05, 131.04, 0, -31.2, 131.62, 1.88), col_coll)
    H.boxes("s4_casier_aeration", [
        ((-31.84, 131.09, z, -31.41, 131.10, z + .04), "aplat:#111014")
        for z in (1.45, 1.55, 1.65)
    ], "palette", props, subdiv=10)
    H.box("s4_caisse_butin", (-30.95, 131.08, 0, -30.25, 131.63, .65), "bois_palette", props)
    H.col_box("s4_caisse_butin", (-30.95, 131.08, 0, -30.25, 131.63, .65), col_coll)
    L.place(B.meuble("radio"), (-30.88, 131.11, .65), 0, props, props, "s4_radio")
    H.boxes("s4_antivols", [
        ((-30.54, 131.05, .72, -30.42, 131.1, .86), "aplat:#f2efe6"),
        ((-29.4, 128.67, .78, -29.36, 128.87, .96), "aplat:#f2efe6"),
        ((-30.58, 131.1, .68, -30.54, 131.43, .71), "aplat:#111014"),
    ], "palette", props, subdiv=10)
    H.box("s4_bouteilles_carton", (-28.99, 129.62, 0, -28.45, 129.97, .38),
          "carton", props, subdiv=10)
    for i in range(3):
        L.place(L.produit("soda_5g_cola"), (-28.9 + i * .13, 129.68, .39), 0,
                props, props, f"s4_boisson{i}")
    plaque("s4_calendrier", "rondes", (-30.88, 131.72, 1.18), .64, .32, props)
    plaque("s4_affiche_pause", "pause", (-35.7, 130.65, 1.48), .72, .36, props, "+x")
    light(logic, "light_s4_lampe", (-33.12, 130.52, 1.02), color="#ffb46a", intensity=5, distance=6)
    light(logic, "light_s4_tele", (-30.2, 130.5, 1.05), color="#88b8ff", intensity=1.4, distance=3)
    return {"canape": 1, "tele": 1, "casier": 1, "lampes": 2}


def actualiser_pizza(space, logic):
    """Replace the existing food marker's mesh while preserving its identity."""
    obj = bpy.data.objects["use_nourriture_secret4_1"]
    if obj.get("aliment") != "pizza":
        raise RuntimeError("Le ramassage de la planque doit rester une pizza")
    entry = next(r for r in space.reperes if r[0].startswith("pizza"))
    x, y = entry[1:3]
    z = space.z + (entry[4] if len(entry) > 4 else 0)
    replacement = H.box("s4_pizza_visual", (x - .21, y - .21, z, x + .21, y + .21, z + .07),
                        "prd_surgeles", logic, uv="label:pizza_5g", front="+z", subdiv=10)
    old_mesh = obj.data
    obj.data = replacement.data
    obj.matrix_world = Matrix.Identity(4)
    bpy.data.objects.remove(replacement, do_unlink=True)
    if old_mesh.users == 0:
        bpy.data.meshes.remove(old_mesh)
