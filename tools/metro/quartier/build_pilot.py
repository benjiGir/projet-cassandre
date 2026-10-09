"""Place pilote N4b ; recette C.quartier_pilot().

see: docs/4-technique/pilote-quartier.md#reproduire
"""
from pathlib import Path
import json
import math
import sys

import bpy
from mathutils import Euler, Vector

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools/blender"))
from tools.blender import geo_utils
from tools.metro.quartier.authoring import Author
from tools.metro.quartier import site_details
from tools.metro.quartier import station_access, service_access
import cassandre as C

OUT = ROOT / "assets_src/blender/quartier_pilote.blend"
GLB = ROOT / "public/assets/levels/quartier_pilote.glb"
REPORT = ROOT / "docs/assets/pilote-quartier"


def main(save=True):
    geo_utils.wipe_scene()
    geo_utils.configure_scene()
    scene = bpy.context.scene
    scene["cassandre_niveau"], scene["cassandre_etape"] = "metro", "quartier_N4b"
    a = Author(ROOT)
    # see: docs/4-technique/pilote-quartier.md#sols-et-limites
    a.box("place", (-20, 40, -.25), (40, 32, .25), "pave")
    a.box("rue", (-5.5, 8, -.5), (11, 32, .25), "sol")
    for x in (-8, 5.5):
        a.box("trottoir_" + str(x), (x, 8, -.25), (2.5, 32, .25), "pave")
    # Cour avec une seule ouverture sur un sol inférieur : la trappe.
    for name, origin, size in (("cour_sud", (20, 64, -.25), (8, 6, .25)),
                               ("cour_ouest", (20, 70, -.25), (5, 2, .25)),
                               ("cour_est", (27, 70, -.25), (1, 2, .25))):
        a.box(name, origin, size, "pave")
    a.box("fond_rue", (-8.25, 7.75, -.25), (16.5, .25, 3.5), "brique")

    house_number = 1

    def building(name, x, y, length, angle=0, grounds=None):
        nonlocal house_number
        variants = ("balcon", "brique", "volets")
        for i in range(length // 4):
            offset = Vector((i * 4, 0, 0))
            offset.rotate(Euler((0, 0, angle)))
            at = (x + offset.x, y + offset.y)
            kind = (grounds or {}).get(i, "habitation")
            if kind in ("laverie", "epicerie"):
                a.place("vitrine_" + kind + "_4m", (*at, 0), angle)
            else:
                site_details.frontage(a, kind, (*at, 0), angle, house_number)
            house_number += 1
            variant = variants[(i // 2 + sum(map(ord, name))) % 3]
            for z in (3.5, 7, 10.5):
                a.place("facade_" + variant + "_4m", (*at, z), angle, collision=False)
            a.place("corniche_4m", (*at, 14), angle, collision=False)
        a.placed.append({"building": name})

    building("ouest_place", -20, 40, 32, math.pi / 2, {1: "cafe"})
    building("est_place_sud", 20, 64, 24, -math.pi / 2, {1: "pharmacie"})
    building("est_place_nord", 20, 72, 4, -math.pi / 2)
    building("rue_ouest", -8, 8, 32, math.pi / 2, {5: "laverie"})
    building("rue_est", 8, 40, 32, -math.pi / 2, {0: "epicerie", 5: "atelier"})
    building("front_place_sud_ouest", -8, 40, 12, math.pi)
    building("front_place_sud_est", 20, 40, 12, math.pi)
    building("front_nord_ouest", -19, 72, 16)
    building("front_nord_est", 3, 72, 16)
    # Les extrémités des modules de façade sont fermées par des murs de retour.
    for name, origin, size in (("dos_place_ouest", (-22.25, 40, 0), (.25, 32, 14)),
                               ("dos_rue_ouest", (-10.25, 8, 0), (.25, 32, 14)),
                               ("dos_rue_est", (10, 8, 0), (.25, 32, 14)),
                               ("dos_place_est", (22, 40, 0), (.25, 24, 14)),
                               ("dos_place_est_nord", (22, 68, 0), (.25, 4, 14)),
                               ("rue_retour_ouest", (-20, 8, 0), (12, .25, 14)),
                               ("rue_retour_est", (8, 8, 0), (12, .25, 14)),
                               ("angle_nord_ouest", (-20, 72, 0), (1, 2.25, 14)),
                               ("angle_nord_est", (19, 72, 0), (1, 2.25, 14)),
                               ("retour_nord_ouest", (-22.25, 72, 0), (2.25, 2.25, 14)),
                               ("retour_nord_est", (20, 72, 0), (2.25, 2.25, 14)),
                               ("fond_nord_ouest", (-20, 74, 0), (17, .25, 14)),
                               ("fond_nord_est", (3, 74, 0), (17, .25, 14)),
                               ("fond_front_sud_ouest", (-20, 37.75, 0), (12, .25, 14)),
                               ("fond_front_sud_est", (8, 37.75, 0), (12, .25, 14)),
                               ("cour_est", (28, 64, 0), (.25, 8, 3.5)),
                               ("cour_sud", (20, 63.75, 0), (8, .25, 3.5)),
                               ("cour_nord", (19, 72, 0), (9.25, .25, 3.5)),
                               ("cour_passage_nord", (20, 68, 0), (4, .25, 3.5)),
                               ("cour_bloc_est", (24, 68, 0), (.25, 4, 3.5))):
        a.box(name, origin, size, "brique")

    for name, origin, size in (("place_ouest", (-22.25, 40, 14), (2.25, 34.25, .16)),
                               ("place_est", (20, 40, 14), (2.25, 34.25, .16)),
                               ("rue_ouest", (-10.25, 8, 14), (2.25, 32, .16)),
                               ("rue_est", (8, 8, 14), (2.25, 32, .16)),
                               ("front_sud_ouest", (-20, 37.75, 14), (12, 2.25, .16)),
                               ("front_sud_est", (8, 37.75, 14), (12, 2.25, .16)),
                               ("front_nord_ouest", (-20, 72, 14), (17, 2.25, .16)),
                               ("front_nord_est", (3, 72, 14), (17, 2.25, .16))):
        a.box("toit_" + name, origin, size, "ardoise", False)
    # L'accès de service reste ouvert au sol, le bâtiment se poursuit au-dessus.
    for z in (3.5, 7, 10.5):
        a.place("facade_brique_4m", (20, 68, z), -math.pi / 2, collision=False)
    a.place("corniche_4m", (20, 68, 14), -math.pi / 2, collision=False)
    a.box("plafond_porche_cour", (20, 64, 3.35), (2.25, 4, .15), "ardoise", False)
    a.box("dos_porche_cour", (22, 64, 3.5), (.25, 4, 10.5), "brique", False)

    entrance = a.place("bouche_6x12", (-3, 72, 0))
    station_access.enclose(a, entrance)
    gate = a.door(a.place("grille_5m", (-2.5, 72.1, 0), collision=False), "door_quartier_grille")
    a.command("use_quartier_grille", (-2.2, 84.15, -3.75), gate.name, "Grille de la place déverrouillée")
    a.box("panneau_retour_place", (-2, 84, -2.6), (4, .15, .7), "petrole", False)
    for x in (-1.7, 1.7):
        a.box("suspente_retour_" + str(x), (x, 84.02, -1.9), (.08, .08, .4), "acier", False)
    a.letters("RETOUR PLACE", (0, 84.18, -2.35), .25, angle=math.pi)
    for x in (-2.5, 2.25):
        a.box("guide_grille_" + str(x), (x, 72, 3.5), (.25, .25, 2.5), "acier", False)
    a.box("moteur_grille", (-2.5, 72, 5.9), (5, .4, .25), "acier", False)

    service_access.hatch(a)
    a.letters("COUR DE SERVICE", (19.82, 66, 2.7), .22, angle=-math.pi / 2)
    a.box("panneau_service", (6.5, 71.85, 2.1), (9, .12, .7), "petrole", False)
    a.letters("ACCES SERVICE >", (11, 71.81, 2.31), .38)
    service_access.enclose(a)
    a.box("billets_sol", (-18, 84, -5.25), (36, 8, .25), "pave")
    a.box("arriere_guichet_sol", (18, 84, -5.25), (10, 4, .25), "pave")
    for name, origin, size in (("billets_ouest", (-18.25, 84, -5), (.25, 8, 3.5)),
                               ("billets_fond", (-18, 92, -5), (36, .25, 3.5)),
                               ("billets_est", (18, 88, -5), (.25, 4, 3.5)),
                               ("guichet_est", (28, 84, -5), (.25, 4, 3.5)),
                               ("guichet_nord", (18, 88, -5), (10, .25, 3.5)),
                               ("billets_sud_ouest", (-18, 83.75, -5), (16, .25, 3.5)),
                               ("billets_sud_est", (2, 83.75, -5), (23, .25, 3.5)),
                               ("service_sud_est", (27, 83.75, -5), (1, .25, 3.5))):
        a.box(name, origin, size)
    a.box("billets_plafond", (-18, 84, -1.5), (36, 8, .25), "enduit", False)
    a.box("guichet_plafond", (18, 84, -1.5), (10, 4, .25), "enduit", False)
    a.letters("QUAIS — HORS PILOTE", (0, 91.98, -2.6), .5, "petrole")

    a.place("kiosque_3x2", (-11, 53, 0))
    site_details.bus_stop(a)
    site_details.trees(a)
    site_details.fountain(a)
    site_details.terrace(a)
    a.place("fourgon_5m", (-2.7, 39, -.25), math.pi)
    a.place("vehicule_citadine", (-5, 23, -.25))
    a.place("vehicule_berline", (5, 31, -.25), math.pi)
    for x, y, angle in ((-15, 64, 0), (10.5, 61, math.pi), (15, 50, -math.pi / 2)):
        a.place("banc_2m", (x, y, 0), angle)
        a.place("corbeille", (x + 2.5, y, 0))
    for x in (-7.3, 7.05):
        for y in (12, 20, 28, 36):
            a.place("borne_075m", (x, y, 0))
    for i, (x, y, angle) in enumerate(((-7.5, 14, 0), (-7.5, 30, 0), (7.1, 22, math.pi),
                                      (7.1, 38, math.pi), (-18, 47, 0), (-18, 67, 0),
                                      (17, 47, math.pi), (17, 67, math.pi))):
        a.place("lampadaire_5m", (x, y, 0), angle)
        a.point("rue_" + str(i), (x + (1 if angle == 0 else -1), y + .2, 4.8), intensity=12, distance=16)
    for i, (x, y) in enumerate(((-7, 34), (7, 38), (-18.7, 50), (18.7, 58))):
        a.point("commerce_" + str(i), (x, y, 2), intensity=7, distance=9)
    for i, at in enumerate(((0, 75, 1.5), (0, 81, -1.5), (26, 71, 2), (26, 78, -1))):
        a.point("acces_" + str(i), at, "#9fb9c6", 9, 10)
    a.point("place_centre", (1, 58, 9), "#6682a5", 20, 30)
    a.point("place_nord", (0, 69, 8), "#6682a5", 15, 22)
    for x in (-10, 8, 24):
        a.point("billets_" + str(x), (x, 86, -2), "#d1d9c2", 10, 15)
        a.box("billets_tube_" + str(x), (x - 1, 85.9, -1.7), (2, .2, .12), "lampe", False)
    a.place("repere_tour_56m", (-12, 150, 0), collision=False)
    # Un soin avant toute rencontre, comme demandé par l'état d'arrivée blessé.
    health = a.box("trousse", (-10.8, 52.7, .8), (.45, .25, .3), "ivoire", False)
    health.name, health["soin"] = "use_quartier_soin", 25
    a.box("trousse_support", (-11, 52.5, 0), (1, .75, .8), "bois")
    a.box("trousse_croix_1", (-10.64, 52.67, .88), (.12, .03, .16), "rouge", False)
    a.box("trousse_croix_2", (-10.72, 52.665, .93), (.28, .03, .06), "rouge", False)
    spawn = bpy.data.objects.new("spawn_player", None)
    a.logic.objects.link(spawn)
    spawn.location = (0, 12, -.15)
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (.008, .014, .022, 1)
    scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .18
    bpy.context.view_layer.update()
    if not save:
        return a
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
    REPORT.mkdir(parents=True, exist_ok=True)
    spaces = [{"id": "quartier_place", "nom": "Place et rue", "x": [-24, 28.5], "z": [-72, -8], "y": [-.5, 15]},
              {"id": "quartier_billets", "nom": "Accès aux billets", "x": [-18.5, 28.5], "z": [-92.5, -84], "y": [-5.5, -1]},
              {"id": "quartier_service", "nom": "Descente de service", "x": [24.5, 27.5], "z": [-84, -70], "y": [-5.5, 0]}]
    (GLB.parent / "quartier_pilote.espaces.json").write_text(json.dumps({"espaces": spaces}, ensure_ascii=False, indent=2) + "\n")
    (REPORT / "assemblage.json").write_text(json.dumps({"instances": a.placed,
        "lights": sum(o.name.startswith("light_") for o in scene.objects),
        "doors": [o.name for o in scene.objects if o.name.startswith("door_")],
        "source": str(OUT.relative_to(ROOT)), "limits": ["Pilote N4b, pas le parcours N5.", "Pas de rencontres N7 ni de vapeur animée."]}, ensure_ascii=False, indent=2) + "\n")
    result = C.export(out=GLB, niveau="metro")
    if not result.get("ok"):
        raise RuntimeError(result)
    for name, pose, floor in (("rue", (0, 12, 0), -.25), ("place", (0, 44, 0), 0),
                              ("bouche", (0, 67, 0), 0), ("escalier", (0, 76, 0), -1.5),
                              ("cour", (22, 66, 270), 0)):
        shot = C.shot(pose, mode="material", sol=floor, nom="quartier_" + name)
        print("[quartier-pilot-shot] " + json.dumps(shot))
    print("[quartier-pilot] " + json.dumps({"blend": str(OUT), "glb": str(GLB), "instances": len(a.placed), "export": result}))


if __name__ == "__main__":
    main()
