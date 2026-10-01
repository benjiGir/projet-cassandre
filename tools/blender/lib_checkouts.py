"""Six travées de caisses du niveau v2 ; recettes communes au build et à Cassandre."""
import json
import math
import re
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

import lib_helpers as H
import lib_rayons as L

SIGNAGE = json.loads((Path(H.TEX_DIR) / "sig_caisses.json").read_text())
H.LABELS.update(SIGNAGE["labels"])
LANES = (-22.5, -15.5, -8.5, 5.0, 12.0, 19.0)
LANE_Y = 30.0
PISTOL_POSITION = (5.5, 30.5, 1.25)
CARTS = ((-6.5, 26.0, 40), (7.75, 28.0, 200), (-18.5, 36.75, 120), (17.0, 27.5, 300))


def palette_uv(color):
    index = H.PALETTE.index(color)
    return ((index % 8 + .5) / 8, 1 - (index // 8 + .5) / 8)


def prism(name, outline, z0, z1, color, props):
    """Contour chanfreiné ou concave ; UV fixes dans la palette commune."""
    n = len(outline)
    verts = [(x, y, z) for z in (z0, z1) for x, y in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    faces.extend((i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.materials.append(H.textured_material("palette"))
    uv = mesh.uv_layers.new(name="UVMap")
    for loop in uv.data:
        loop.uv = palette_uv(color)
    obj = bpy.data.objects.new(name, mesh)
    props.objects.link(obj)
    return obj


def placard(name, region, x, y, z, w, h, props, reverse=False):
    px, py, pw, ph = SIGNAGE["regions"][region]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x, y, z), (x + w, y, z), (x + w, y, z + h), (x, y, z + h)], [],
                     [(0, 1, 2, 3)] if not reverse else [(3, 2, 1, 0)])
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    coords = [(px / 128, 1 - (py + ph) / 128), ((px + pw) / 128, 1 - (py + ph) / 128),
              ((px + pw) / 128, 1 - py / 128), (px / 128, 1 - py / 128)]
    for loop in mesh.loops:
        u, v = coords[loop.vertex_index]
        uv.data[loop.index].uv = (1 - u if reverse else u, v)
    mesh.materials.append(H.textured_material("sig_caisses"))
    obj = bpy.data.objects.new(name, mesh)
    props.objects.link(obj)


def lane(number, x, y, z, props, colliders):
    name = f"ck_lane{number}"
    def box(part, bounds, color, **kwargs):
        return H.box(name + "_" + part, bounds, "palette", props, uv="aplat:" + color, **kwargs)
    footprint = [(0, .15), (.15, 0), (2.1, 0), (2.35, .25), (2.35, 1.1),
                 (1.15, 1.1), (1.15, 5.05), (1.0, 5.2), (.15, 5.2), (0, 5.05)]
    prism(name + "_plinthe", footprint, .03, .15, "#2f3541", props)
    prism(name + "_meuble", footprint, .15, .79, "#dbd0c4", props)
    prism(name + "_dessus", footprint, .79, .845, "#babcbc", props)
    box("parechoc", (-.035, .2, .55, -.005, 5.0, .65), "#d8231f")
    box("tapis", (.11, 2.0, .846, 1.04, 5.08, .885), "#111014")
    H.boxes(name + "_inox", [
        ((.02, 1.96, .847, .095, 5.06, .90), "trim:corniere"),
        ((1.055, 1.96, .847, 1.13, 5.06, .90), "trim:corniere"),
        ((.12, .12, .847, 2.14, .20, .91), "trim:corniere"),
        ((.12, .94, .847, 2.25, 1.02, .91), "trim:corniere"),
        ((2.13, .2, .847, 2.23, .94, .91), "trim:corniere"),
    ], "trim_hypermarche", props)
    box("scan", (.18, 1.2, .846, 1.0, 1.88, .90), "#2f3541")
    box("laser", (.24, 1.52, .901, .94, 1.59, .904), "#e93f3f", subdiv=10)
    box("registre", (1.02, 1.02, .847, 1.7, 1.8, .92), "#444a54")
    box("crt", (1.05, 1.06, .92, 1.64, 1.49, 1.27), "#605c58")
    H.box(name + "_ecran", (1.095, 1.49, 1.005, 1.595, 1.502, 1.225), "sig_caisses", props,
          uv="label:ck_prix", front="+y", subdiv=10)
    box("clavier", (1.1, 1.54, .923, 1.58, 1.73, .95), "#111014", subdiv=10)
    box("lecteur_cb", (-.11, 1.56, .985, .05, 1.94, 1.27), "#444a54", subdiv=10)
    H.box(name + "_cb_face", (-.115, 1.59, 1.015, -.111, 1.90, 1.24), "sig_caisses", props,
          uv="label:ck_cb", front="-x", subdiv=10)
    box("separateur", (.14, 3.7, .886, 1.00, 3.77, .96), "#d8231f", subdiv=10)
    # Deux proxies suivent le L et laissent la place de l'opérateur ouverte.
    H.col_box(name + "_tapis", (0, 1.1, 0, 1.15, 5.2, .95), colliders)
    H.col_box(name + "_ensachage", (0, 0, 0, 2.35, 1.1, .92), colliders)
    H.col_box(name + "_registre", (1.15, 1.1, .82, 1.7, 1.8, .96), colliders)
    H.cylinder(name + "_tabouret_pied", (1.8, 2.45), .12, 0, .49, "metal_bac_acier", props)
    box("tabouret", (1.52, 2.17, .49, 2.08, 2.73, .57), "#69252a")
    # Mat bas côté caisse, panneau haut : le numéro est le repère, pas un mur.
    box("mat", (.15, 1.10, .91, .25, 1.2, 2.75), "#444a54")
    box("cadre_numero", (-.16, 1.055, 2.74, .57, 1.265, 3.49), "#111014")
    for front, yy in (("-y", 1.045), ("+y", 1.27)):
        H.box(name + "_numero_" + front[-1] + ("a" if front[0] == "-" else "b"),
              (-.105, yy, 2.795, .515, yy + .012, 3.415), "sig_caisses", props,
              uv=f"label:ck_num_{number}", front=front, subdiv=10)
    # Présentoir d'impulsion bas, le long de l'attente, à 2 m du tapis.
    H.boxes(name + "_confiserie", [
        ((-2.65, 2.8, 0, -2.0, 5.1, .12), "aplat:#69252a"),
        ((-2.64, 4.99, .12, -2.03, 5.1, 1.21), "aplat:#69252a"),
        *[((-2.62, 2.83, h, -2.02, 5.08, h + .035), "aplat:#605c58") for h in (.35, .7, 1.05)],
    ], "palette", props)
    stock = []
    for row, h in enumerate((.385, .735, 1.085)):
        for i in range(7):
            if (number + row + i) % 5 == 0:
                continue
            label = ("chips_illumi", "soda_5g_cola", "sables_reptiliens")[(number + row + i) % 3]
            stock.append(((-2.57, 2.87 + .29 * i, h, -2.13, 3.10 + .29 * i, h + .16), f"label:{label}", "+x"))
    H.boxes(name + "_produits_confiserie", stock, "prd_etiquettes", props, subdiv=10)
    H.col_box(name + "_confiserie", (-2.65, 2.8, 0, -2.0, 5.1, 1.21), colliders)
    box("tapis_attente", (-1.94, 1.0, .006, -.09, 8.5, .012), "#444a54", subdiv=1.5)
    if number in (2, 3, 5):
        groceries = L.Garnissage()
        for label, xx, yy, angle in (("lait_trainees_blanches", .25, 4.3, 12),
                                     ("chips_illumi", .60, 4.6, -18),
                                     ("cafe_reveille", .60, 3.9, 8)):
            source = bpy.data.collections[L.produit(label)].objects[0].data
            groceries.add(source, "prd_etiquettes", xx, yy, .885, -1, angle)
        source = bpy.data.collections[L.kenney_produit("soda-bottle", .28)].objects[0].data
        groceries.add(source, "prd_kenney", .24, 3.95, .885, -1, 24)
        groceries.finish(name + "_achats", props)
        H.boxes(name + "_sac", [
            ((1.43, .38, .845, 1.83, .68, .865), "world"),
            ((1.43, .38, .865, 1.46, .68, 1.20), "world"),
            ((1.8, .38, .865, 1.83, .68, 1.20), "world"),
            ((1.46, .38, .865, 1.8, .41, 1.20), "world"),
            ((1.46, .65, .865, 1.8, .68, 1.20), "world"),
        ], "carton", props, subdiv=10)
        box("ticket", (1.13, 1.78, .923, 1.25, 2.15, .929), "#f2efe6", subdiv=10)
    if number in (1, 6):
        H.boxes(name + "_fermeture", [
            ((-1.9, 5.25, 0, -1.78, 5.37, .8), "aplat:#444a54"),
            ((-.2, 5.25, 0, -.08, 5.37, .8), "aplat:#444a54"),
            ((-1.85, 5.27, .73, -.13, 5.35, .80), "aplat:#d8231f"),
        ], "palette", props)
        H.col_box(name + "_fermeture", (-1.9, 5.25, 0, -.08, 5.37, .8), colliders)
    for obj in [o for o in bpy.context.scene.objects if o.name.startswith((name + "_", "col_box_" + name + "_"))]:
        obj.data.transform(Matrix.Translation(Vector((x, y, z))))
        obj.data.update()


def install(props, colliders, z=0):
    for number, x in enumerate(LANES, 1):
        lane(number, x, LANE_Y, z, props, colliders)
    H.box("ck_cadre_central", (-2.10, 31.05, z + 3.15, 2.1, 31.2, z + 4.3), "palette", props, uv="aplat:#444a54")
    for x in (-1.75, 1.75):
        H.box("ck_suspente", (x, 31.1, z + 4.3, x + .06, 31.16, z + 4.95), "palette", props, uv="aplat:#444a54")
    placard("ck_bandeau", "caisses", -2.0, 31.04, z + 3.225, 4.0, 1.0, props)
    placard("ck_bandeau_retour", "sortie", -2.0, 31.21, z + 3.225, 4.0, 1.0, props, reverse=True)
    for i, x in enumerate((-2.5, 2.25)):
        H.boxes(f"ck_antivol{i}", [
            ((x, 23.0, z, x + .25, 23.45, z + .13), "aplat:#444a54"),
            ((x + .035, 23.045, z + .13, x + .215, 23.405, z + 1.80), "aplat:#babcbc"),
            ((x + .03, 23.14, z + .3, x + .22, 23.31, z + 1.55), "aplat:#444a54"),
            ((x + .035, 23.045, z + 1.80, x + .215, 23.405, z + 1.90), "aplat:#d8231f"),
        ], "palette", props)
        H.col_box(f"ck_antivol{i}", (x, 23.0, z, x + .25, 23.45, z + 1.9), colliders)
    bpy.context.scene["checkout_layout_version"] = 1
    return {"caisses": len(LANES), "files_ouvertes": 4, "files_fermees": 2, "passage_file": 2.0}


def move_group(suffix, delta):
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and obj.name.endswith(suffix):
            obj.data = obj.data.copy()
            obj.data.transform(Matrix.Translation(Vector(delta)))
            obj.data.update()


def rework_scene():
    props, colliders = (bpy.data.collections[n] for n in ("PROPS", "COL"))
    remove = []
    for obj in list(bpy.context.scene.objects):
        if re.search(r"^(mob_caisse_|col_box_caisse)_?.*_cs\d$", obj.name) or re.search(r"_cs_(?:il\d[ab]|pq\d)$", obj.name) or obj.name.startswith(("ck_", "col_box_ck_")):
            remove.append(obj.name)
            mesh = obj.data if obj.type == "MESH" else None
            bpy.data.objects.remove(obj, do_unlink=True)
            if mesh and mesh.users == 0:
                bpy.data.meshes.remove(mesh)
    already = bpy.context.scene.get("checkout_layout_version", 0) >= 1
    if not already:
        move_group("_cs_tete0", (0, 4.0, 0))
        move_group("_cs_tete1", (0, 4.0, 0))
        move_group("_cs_pres0", (-5.0, -3.0, 0))
        move_group("_cs_pres1", (7.0, -3.0, 0))
        move_group("_cs_cdl1", (2.75, -1.5, 0))
        move_group("_cs_cdl2", (2.0, 2.25, 0))
        move_group("_cs_cd0", (-1.35, -.3, 0))
        move_group("_cs_cd1", (-1.35, -.3, 0))
        move_group("_cs_cd2", (-1.35, -.3, 0))
        move_group("_cs_cd3", (-1.35, -.3, 0))
        for obj in bpy.context.scene.objects:
            if obj.type == "MESH" and obj.name.endswith("_cs_rail"):
                transform = Matrix.Translation(Vector((-24.5, 21.5, 0))) @ Matrix.Rotation(math.pi / 2, 4, "Z") @ Matrix.Translation(Vector((24.5, -22.0, 0)))
                obj.data = obj.data.copy()
                obj.data.transform(transform)
                obj.data.update()
        for obj_name, xy in (("prop_caisses2_0", (20.5, 27.0)), ("prop_caisses3_0", (21.75, 27.25))):
            obj = bpy.data.objects.get(obj_name)
            if not obj:
                raise RuntimeError("Prop attendu introuvable : " + obj_name)
            corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
            cx = (min(p.x for p in corners) + max(p.x for p in corners)) / 2
            cy = (min(p.y for p in corners) + max(p.y for p in corners)) / 2
            obj.data = obj.data.copy()
            obj.data.transform(Matrix.Translation(Vector((xy[0] - cx, xy[1] - cy, 0))))
            obj.data.update()
    report = install(props, colliders)
    pistol = bpy.data.objects.get("use_pistol")
    if not pistol:
        raise RuntimeError("Repère du pistolet introuvable")
    corners = [Vector(c) for c in pistol.bound_box]
    center = Vector(tuple((min(p[i] for p in corners) + max(p[i] for p in corners)) / 2 for i in range(3)))
    pistol.data = pistol.data.copy()
    pistol.data.transform(Matrix.Translation(-center))
    pistol.data.update()
    # Le loader place le ramassage à l'origine de l'objet, pas au centre du mesh.
    pose = pistol.matrix_world.copy()
    pose.translation = Vector(PISTOL_POSITION)
    pistol.matrix_world = pose
    bpy.context.scene["checkout_layout_version"] = 1
    bpy.context.view_layer.update()
    report.update({"retired_objects": len(remove), "pistol": PISTOL_POSITION, "main_path": [-2.0, 2.0]})
    return report
