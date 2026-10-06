"""Variante T2 du pilote : le modèle, les trajets et les commandes sont dans le GLB.

see: docs/4-technique/trains-metro.md#contrat-blender
"""
import math
import bpy
import geo_utils
from mathutils import Matrix, Vector


def configure_trains(logic, box, place, letters, suspend_fixture):
    def marker(name, position, **extras):
        obj = bpy.data.objects.new(name, None)
        logic.objects.link(obj)
        obj.location = position
        for key, value in extras.items():
            obj[key] = value
        return obj

    def volume(name, origin, size, lane):
        obj = geo_utils.build_proxy_object(name, "box", origin, size)
        logic.objects.link(obj)
        obj["voie"] = lane
        return obj

    # La maintenance du pilote N4 devient une bouche de tunnel, fermée au joueur.
    remove = ("kit_pilote_local_", "col_box_pilote_local_", "kit_pilote_service_",
              "col_box_pilote_service_", "kit_pilote_bouton_service", "door_pilote_", "use_pilote_",
              "kit_pilote_fond_station_sud", "col_box_pilote_fond_station_sud",
              "kit_pilote_fond_station_droit", "col_box_pilote_fond_station_droit")
    for obj in list(bpy.context.scene.objects):
        if any(c.name.startswith("kit_metro_") for c in obj.users_collection):
            continue
        if obj.name.startswith(remove) or obj.name in {"light_pilote_local", "aperçu_local"}:
            bpy.data.objects.remove(obj, do_unlink=True)
        elif obj.type == "MESH" and obj.name.startswith("kit_pilote_"):
            ys = [v.co.y for v in obj.data.vertices]
            if ys and min(ys) >= 84:
                bpy.data.objects.remove(obj, do_unlink=True)
    # Retirer seulement les deux inscriptions de fermeture / service, par leur pose.
    for obj in list(bpy.context.scene.objects):
        if obj.type == "MESH" and obj.name.startswith("inscription_"):
            ys = [v.co.y for v in obj.data.vertices]
            if ys and (max(ys) < .5 or min(ys) > 83):
                bpy.data.objects.remove(obj, do_unlink=True)

    for index, (x, width) in enumerate(((0, 5.4), (8.6, .8), (12.6, 5.4))):
        box(f"portail_sud_jambage_{index}", (x, -.25, 0), (width, .25, 6.5), "ivoire")
    for x in (5.4, 9.4):
        box(f"portail_sud_linteau_{x}", (x, -.25, 3.4), (3.2, .25, 3.1), "ivoire", False)
    box("portail_nord_droit", (12.6, 23.75, 0), (5.4, .25, 6.5), "ivoire")
    box("portail_nord_linteau", (9.25, 23.75, 3.4), (3.35, .25, 3.1), "ivoire", False)

    # Les masques noirs occultent les extensions hors champ, sans bloquer les rames.
    for name, x, y, width, height in (("sud_A", 5.4, -.3, 3.2, 3.4), ("sud_B", 9.4, -.3, 3.2, 3.4),
                                     ("nord_B", 9.25, 24.05, 3.35, 3.4), ("tube_A", 4.75, 84.05, 4.5, 4.5)):
        obj = box("masque_" + name, (x, y, 0), (width, .125, height), "petrole")
        material = bpy.data.materials.get("metro_obscurite")
        if material is None:
            material = bpy.data.materials.new("metro_obscurite")
            material.diffuse_color = (.001, .001, .001, 1)
            material.use_nodes = True
            material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (.001, .001, .001, 1)
        obj.data.materials.clear()
        obj.data.materials.append(material)

    model = marker("train_modele_ligne", (0, 0, 0))
    for obj in place("voiture_ligne_15m", (-1.4, -7.5, 0), visual_only=True):
        obj.parent = model
        obj.matrix_parent_inverse = Matrix.Identity(4)

    routes = (
        ("A", "ligne", [(7, 204, 0), (7, -120, 0)], 120, 204, 5, True),
        # La bifurcation est derrière le portail sud, hors de la pièce pilote.
        ("A", "depot", [(7, 204, 0), (7, -30, 0), (17, -120, 0)], 120, 204, 5, True),
        ("B", "retour", [(11, -120, 0), (11, 144, 0)], 120, 144, 15, False),
    )
    for lane, route, points, start, end, first, enabled in routes:
        names = []
        for index, position in enumerate(points):
            name = f"rail_{lane}_{route}_{index}"
            marker(name, position)
            names.append(name)
        marker(f"voie_{lane}_{route}", (0, 0, 0), voie=lane, trajet=route,
               points=",".join(names), debut_visible=start, fin_visible=end, premier=first, active=enabled)

    for lane, x, sign_x, yaw in (("A", 7, 3.4, 0), ("B", 11, 14.6, 180)):
        for y in (6, 18):
            name = f"signal_quai_{lane}_{y}"
            marker(f"signal_train_{lane}_{y}", (sign_x, y, 3.25), voie=lane, cap=yaw)
            for z in (2.75, 3.7):
                box(name + str(z), (sign_x - 1.25, y - .055, z), (2.5, .11, .05), "acier", False)
            for dx in (-1.25, 1.2):
                box(name + str(dx), (sign_x + dx, y - .055, 2.8), (.05, .11, .9), "acier", False)
            for index, dx in enumerate((-.9, .9)):
                suspend_fixture(name + f"_suspente_{index}", sign_x + dx, y, 3.75)
        volume(f"nav_voie_{lane}_quai", (x - 2, 0, -.3), (4, 24, 3.5), lane)
        safe_x = .3 if lane == "A" else 13.4
        volume(f"refuge_train_{lane}_quai", (safe_x, .1, .7), (4.3, 23.8, 2.5), lane)
        for y in (8, 18):
            volume(f"traversee_train_{lane}_{y}", (x - 2, y, -.3), (4, 3, 3.5), lane)
            for stripe_y in (y, y + 2.9):
                box(f"traversee_bande_{lane}_{stripe_y}", (x - 2, stripe_y, .02), (4, .1, .02), "ambre", False)
    volume("nav_voie_A_tube", (4.75, 24, -.3), (4.5, 60, 3.5), "A")
    for y in (28, 40, 52, 64, 76):
        volume(f"refuge_train_A_{y}", (3.05, y + .5, 0), (1.25, 3, 2.8), "A")
        marker(f"signal_train_A_tube_{y}", (9.215, y + 2, 2.6), voie="A", cap=270)
        for z in (2.1, 3.05):
            box(f"signal_tube_{y}_{z}", (9.22, y + .75, z), (.08, 2.5, .05), "acier", False)
        for dy in (.75, 3.2):
            box(f"signal_tube_{y}_{dy}", (9.22, y + dy, 2.15), (.08, .05, .9), "acier", False)

    def control(name, lane, kind, wall_x, y, title, facing=1, bottom=1.45):
        left = wall_x if facing == 1 else wall_x - .2
        obj = box(name, (left, y - .21, bottom), (.2, .42, .62), "petrole", False)
        center = Vector((wall_x, y, round((bottom + .31) * 4) / 4))
        obj.data.transform(Matrix.Translation(-center))
        obj.location = center
        obj.name = "use_" + name
        obj["train"], obj["voie"] = kind, lane
        front = wall_x + facing * .205
        box(name + "face", (front - .0125, y - .135, bottom + .2),
            (.025, .27, .28), "signal" if kind == "stop" else "ambre", False)
        plaque_x = wall_x if facing == 1 else wall_x - .05
        box(name + "etiquette", (plaque_x, y - .65, bottom + .69), (.05, 1.3, .3), "petrole", False)
        letters(title, (wall_x + facing * .065, y, bottom + .78), .12, facing * math.pi / 2)
    control("train_arret_A", "A", "stop", 0, 3, "ARRET A")
    control("train_aiguille_A", "A", "switch", 0, 21.25, "LIGNE / DEPOT")
    control("train_arret_B", "B", "stop", 18, 10, "ARRET B", facing=-1)
    for y in (28, 40, 52, 64, 76):
        control(f"train_refuge_{y}", "A", "stop", 3.25, y + 2, "ARRET A", bottom=.95)
    trigger = geo_utils.build_proxy_object("trig_metro_tunnel", "box", (4.75, 24, 0), (4.5, 3, 3))
    logic.objects.link(trigger)
    trigger["evenement"] = "metro_tunnel"
