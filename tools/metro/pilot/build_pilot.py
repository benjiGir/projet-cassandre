"""Pièce pilote N4 : station de 24 m + tunnel de 60 m, depuis la bibliothèque N3.

see: docs/4-technique/pilote-metro.md#recette-blender
"""
from pathlib import Path
import json
import math
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/blender"))
sys.path.insert(0, str(ROOT / "tools/metro/kit"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import geo_utils
import cassandre as C
from geometry import Piece, FACES
from modules import profile

TRAFFIC = "--trains" in sys.argv
STEM = "metro_trains" if TRAFFIC else "metro_pilote"
OUT = ROOT / f"assets_src/blender/{STEM}.blend"
GLB = ROOT / f"public/assets/levels/{STEM}.glb"
REPORT = ROOT / ("docs/assets/trains-metro" if TRAFFIC else "docs/assets/pilote-metro")


def main():
    geo_utils.wipe_scene()
    geo_utils.configure_scene()
    scene = bpy.context.scene
    scene["cassandre_niveau"], scene["cassandre_etape"] = "metro", "trains_T2" if TRAFFIC else "pilote_N4"
    root = scene.collection
    geo = geo_utils.make_collection("GEO", root)
    shell = geo_utils.make_collection("SHELL", geo)
    props = geo_utils.make_collection("PROPS", geo)
    collisions = geo_utils.make_collection("COL", root)
    logic = geo_utils.make_collection("LOGIC", root)
    lamps = geo_utils.make_collection("LIGHTS", root)
    sources = geo_utils.make_collection("_LIB", root)
    library = ROOT / "assets_src/library/lib_metro_N3.blend"
    with bpy.data.libraries.load(str(library), link=False) as (available, loaded):
        loaded.collections = [n for n in available.collections if n.startswith("kit_metro_")]
    assets = {c.name.removeprefix("kit_metro_"): c for c in loaded.collections}
    for collection in assets.values():
        sources.children.link(collection)
    mats = {m.name.removeprefix("metro_"): m for m in bpy.data.materials if m.name.startswith("metro_")}
    placed = []
    serial = 0

    def place(name, origin, angle=0, roof_collision=False, omit_quay=False, visual_only=False):
        nonlocal serial
        serial += 1
        transform = Matrix.Translation(Vector(origin)) @ Matrix.Rotation(angle, 4, "Z")
        result = []
        for original in assets[name].objects:
            if original.type != "MESH":
                continue
            is_proxy = original.name.startswith("col_")
            if is_proxy and visual_only:
                continue
            if is_proxy and not roof_collision:
                low = min(v.co.z for v in original.data.vertices)
                if low >= 2.25 - 1e-6:
                    continue
            if omit_quay and is_proxy:
                continue
            obj = original.copy()
            obj.data = original.data.copy()
            if is_proxy:
                prefix = "col_box_" if original.name.startswith("col_box_") else "col_hull_"
                obj.name = f"{prefix}pilote_{serial}_{original.name}"
            else:
                obj.name = f"kit_pilote_{serial}_{original.name}"
            obj.data.transform(transform @ original.matrix_world)
            obj.matrix_world = Matrix.Identity(4)
            (collisions if is_proxy else props).objects.link(obj)
            result.append(obj)
        placed.append({"asset": name, "origin": list(origin), "angle": angle, "objects": len(result)})
        return result

    def box(name, origin, size, material="beton", collider=True):
        obj = geo_utils.build_multi_box_mesh("kit_pilote_" + name, [{"o": origin, "s": size, "mat": None}], material, mats, seg=1)
        shell.objects.link(obj)
        if collider:
            collisions.objects.link(geo_utils.build_proxy_object("col_box_pilote_" + name, "box", origin, size))
        return obj

    def letters(text, origin, size=.25, angle=0, material="ivoire"):
        piece = Piece("inscription_" + str(len(placed)), mats, "inscription pilote")
        obj = piece.text(text, origin, size, material)
        transform = Matrix.Translation(Vector(origin)) @ Matrix.Rotation(angle, 4, "Z") @ Matrix.Translation(-Vector(origin))
        obj.data.transform(transform)
        piece.collection.objects.unlink(obj)
        props.objects.link(obj)
        placed.append({"text": text})

    def point(name, position, color, intensity, distance=10):
        marker = bpy.data.objects.new("light_pilote_" + name, None)
        logic.objects.link(marker)
        marker.location = position
        marker["color"], marker["intensity"], marker["distance"], marker["decay"] = color, intensity, distance, 2
        data = bpy.data.lights.new("aperçu_" + name, "POINT")
        data.energy = intensity * 20
        data.color = tuple(int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
        obj = bpy.data.objects.new(data.name, data)
        obj.location = position
        lamps.objects.link(obj)

    station_vault = profile(18, 6.5, 3.75)
    tunnel_vault = profile(4.5)

    def profile_height(vertices, x):
        for a, b in zip(vertices, vertices[1:]):
            if b[0] > a[0] and a[0] <= x <= b[0]:
                return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])
        raise ValueError(f"Suspente hors voûte : x={x}")

    def vault_height(x):
        return profile_height(station_vault, x)

    def tunnel_height(x):
        return profile_height(tunnel_vault, x - 4.75)

    def suspend_fixture(name, sx, sy, bottom, ceiling_at=vault_height):
        ceiling = ceiling_at(sx)
        box(name, (sx - .0375, sy - .0375, bottom),
            (.075, .075, ceiling - .03 - bottom), "acier", False)
        piece = Piece(name + "_platine", mats, "Fixation sous la voûte du quai")
        corners = [(sx - .1, sy - .1), (sx + .1, sy - .1),
                   (sx + .1, sy + .1), (sx - .1, sy + .1)]
        vertices = [(cx, cy, ceiling_at(cx) + dz)
                    for dz in (-.04, .025) for cx, cy in corners]
        plate = piece.mesh(vertices, FACES, "acier")
        piece.collection.objects.unlink(plate)
        props.objects.link(plate)
        placed.append({"suspente": name, "haut": ceiling, "bas": bottom})

    def suspend_quay_light(x, y):
        for index, offset in enumerate((.3, 1.7), 1):
            suspend_fixture(f"suspente_quai_{x}_{y}_{index}", x + offset, y + .125, 3.85)

    for y in range(0, 24, 4):
        if y == 20:
            # Retrait du bord pour la descente ; la rampe remplace le sol haut ici.
            box("quai_retrait", (0, y, 0), (4, 4, .75), "sol")
            box("quai_retour", (4, 22.5, 0), (1, 1.5, .75), "sol")
            box("bord_retour", (4.5, 22.5, .75), (.5, 1.5, .025), "ambre", False)
        else:
            place("quai_5x4", (0, y, 0))
        place("quai_5x4", (18, y + 4, 0), math.pi)
        place("mur_quai_4m", (-.3, y, .75))
        place("mur_quai_4m", (18.3, y + 4, .75), math.pi)
        place("voute_station_4m", (0, y, 0))
        for x in (5, 9):
            place("voie_4x4", (x, y, 0))
    place("escalier_quai_075m", (5.5, 20, 0), math.pi / 2)
    for y in (9, 17):
        place("banc_3m", (1, y, .75), math.pi / 2)
    if not TRAFFIC:
        place("voiture_ligne_15m", (9.6, 5, 0))
    box("panneau_acces_voies", (1.35, 23.64, 2.7), (2.1, .11, .6), "petrole", False)
    letters("ACCES VOIES", (2.4, 23.625, 2.89), .19)
    for y in (3, 9, 15, 21):
        for x in (1.75, 14.5):
            place("luminaire_2m", (x, y, 3.7))
            suspend_quay_light(x, y)
            point(f"quai_{x}_{y}", (x + 1, y + .125, 3.3), "#dce5d4", 10, 12)
    # La tête de station serre la grande voûte sur la voie de service.
    box("fond_station_gauche", (0, 23.75, 0), (4.75, .25, 6.5), "ivoire")
    box("fond_station_droit", (9.25, 23.75, 0), (8.75, .25, 6.5), "ivoire")
    arch = profile(4.5)
    for i, (a, b) in enumerate(zip(arch, arch[1:])):
        if abs(a[0] - b[0]) < 1e-6:
            continue
        piece = Piece("tete_station_" + str(i), mats, "raccord visuel voûte / tube")
        cross = [(a[0] + 4.75, a[1]), (b[0] + 4.75, b[1]), (b[0] + 4.75, 6.5), (a[0] + 4.75, 6.5)]
        obj = piece.mesh([(x, y, z) for y in (23.75, 24) for x, z in cross], FACES, "ivoire")
        piece.collection.objects.unlink(obj)
        shell.objects.link(obj)
    box("fond_station_sud", (0, -.25, 0), (18, .25, 6.5), "ivoire")
    letters("ACCES FERME", (9, .01, 2.5), .45, math.pi)
    for y, text in ((5, "VOTRE TEMPS"), (13, "NOUS APPARTIENT")):
        box("cadre_affiche_" + str(y), (.025, y, 1.35), (.1, 2, 2), "petrole", False)
        box("papier_affiche_" + str(y), (.13, y + .1, 1.45), (.01, 1.8, 1.8), "ivoire", False)
        letters(text, (.145, y + 1, 2.35), .16, math.pi / 2, "petrole")
        for j in range(3):
            box(f"affiche_trait_{y}_{j}", (.145, y + .4, 1.65 + j * .12), (.012, 1.2, .05), "petrole", False)

    niches = [28, 40, 52, 64, 76]
    for y in range(24, 84, 4):
        place("tunnel_niche_4m" if y in niches else "tunnel_4m", (4.75, y, 0))
        place("luminaire_2m", (6, y + 1, 4.05))
        for index, sx in enumerate((6.3, 7.7)):
            suspend_fixture(f"suspente_tunnel_{y}_{index}", sx, y + 1.125, 4.2, tunnel_height)
        point(f"tunnel_{y}", (7, y + 2, 3.75), "#dfb657", 7, 8)
        if y in niches:
            number = niches.index(y) + 1
            box(f"panneau_refuge_{number}", (4.70, y - 1.5, 1.8), (.06, 1.3, .6), "signal", False)
            letters(f"REFUGE {number:02d}", (4.775, y - .85, 2.0), .16, math.pi / 2, "petrole")
            point(f"niche_{number}", (3.8, y + 2, 2.4), "#91b6a4", 4, 5)
            place("luminaire_2m", (3.6, y + .8, 2.6), math.pi / 2)

    # Un petit local donne un but concret à l'inspection du tunnel.
    box("local_sol", (4.75, 84, -.25), (4.5, 4, .25), "sol")
    for x in (4.5, 9.25):
        box("local_mur_" + str(x), (x, 84, 0), (.25, 4, 3), "beton")
    box("local_fond", (4.75, 88, 0), (4.5, .25, 3), "beton")
    box("local_plafond", (4.75, 84, 3), (4.5, 4, .25), "beton", False)
    for x in (4.75, 8.125):
        box("service_jambage_" + str(x), (x, 83.75, 0), (1.125, .25, 3), "acier")
    box("service_linteau", (5.875, 83.75, 2.75), (2.25, .25, .25), "acier", False)
    door = box("service_porte", (5.875, 83.8, 0), (2.25, .15, 2.75), "petrole", False)
    door.name = "door_pilote_service"
    for key, value in {"mouvement": "coulisse", "course": 2.5, "sens": "+", "duree": .6, "manuelle": True, "referme": False}.items():
        door[key] = value
    command = box("bouton_service", (5.35, 83.65, 1), (.35, .1, .5), "petrole", False)
    center = Vector((5.5, 83.75, 1.25))
    command.data.transform(Matrix.Translation(-center))
    command.location = center
    command.name = "use_pilote_service"
    command["target"], command["message"] = door.name, "Accès maintenance"
    box("bouton_service_lumiere", (5.42, 83.6, 1.1), (.2, .05, .2), "signal", False)
    letters("SERVICE", (7, 83.7, 2.85), .28)
    place("armoire_service", (5.25, 87.3, 0))
    place("luminaire_2m", (6, 85, 2.8))
    point("local", (7, 86, 2.7), "#c4ddd7", 7, 8)
    spawn = bpy.data.objects.new("spawn_player", None)
    logic.objects.link(spawn)
    spawn.location = (2.5, 3, .85)
    if TRAFFIC:
        from train_fixture import configure_trains
        configure_trains(logic, box, place, letters, suspend_fixture)
    # Les plafonds restent visuels : le graphe 2,5D prendrait leur dessus pour le sol.
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (.03, .04, .05, 1)
    scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .18
    bpy.context.view_layer.layer_collection.children["_LIB"].exclude = True
    bpy.context.view_layer.update()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
    REPORT.mkdir(parents=True, exist_ok=True)
    (REPORT / "assemblage.json").write_text(json.dumps({"instances": placed, "tunnel_m": 60,
        "niche_y": [y + 2 for y in niches], "lamps": sum(o.name.startswith("light_") for o in scene.objects), "source": str(OUT.relative_to(ROOT))}, ensure_ascii=False, indent=2) + "\n")
    spaces = [{"id": "pilote_quai", "nom": "Quai du pilote", "x": [0, 18], "z": [-24, 0], "y": [0, 6.5]},
              {"id": "pilote_tunnel", "nom": "Tunnel du pilote", "x": [3, 9.5], "z": [-84, -24], "y": [-.25, 4.5]},
              {"id": "pilote_service", "nom": "Maintenance", "x": [4.75, 9.25], "z": [-88, -84], "y": [0, 3]}]
    if TRAFFIC:
        spaces = spaces[:2]
    (GLB.parent / f"{STEM}.espaces.json").write_text(json.dumps({"espaces": spaces}, ensure_ascii=False, indent=2) + "\n")
    result = C.export(out=GLB, niveau="metro")
    if result.get("code") not in (None, 0):
        raise RuntimeError(result)
    # Les vues Blender permettent de relire l'assemblage avant le rendu en jeu.
    for name, pose, floor in (("quai", (2.5, 3, 0), .75), ("entree", (6.5, 22, 0), 0), ("niche", (7, 38, 25), 0)):
        result = C.shot(pose, mode="material", sol=floor, nom=("t2_" if TRAFFIC else "n4_") + name)
        print("[metro-pilot-shot] " + json.dumps(result))
    print("[metro-pilot] " + json.dumps({"blend": str(OUT), "glb": str(GLB), "tunnel_m": 60, "niches": len(niches)}))


if __name__ == "__main__":
    main()
