"""Vocabulaire modulaire N3. Dimensions SI et dégagements de N1/N2.

see: docs/assets/kit-metro.md#pièces
"""
import math

from geometry import Piece, FACES, slab
import geo_utils


def profile(width, crown=4.5, spring=2.25, steps=12):
    return [(0, 0), (0, spring)] + [
        (width / 2 - width / 2 * math.cos(i * math.pi / steps),
         spring + (crown - spring) * math.sin(i * math.pi / steps))
        for i in range(1, steps + 1)
    ] + [(width, 0)]


def rails(p, width, length):
    for i in range(math.ceil(length)):
        p.box((0, i, -.25), (width, min(1, length - i), .25), "sol", True)
    for y in range(math.ceil(length / .75)):
        p.box((width / 2 - 1.25, y * .75, 0), (2.5, .18, .08), "acier")
    for x in (width / 2 - .75, width / 2 + .75):
        p.box((x - .06, 0, .08), (.12, length, .08), "acier")


def tunnel(materials, name="tunnel_4m", width=4.5, niche=False, radius=None):
    length = radius * math.pi / 24 if radius else 4
    p = Piece(name, materials, f"Tube {width:g} m libres, couronne 4,5 m ; longueur {length:.3f} m" )
    mapper = None
    if radius:
        def mapper(x, y, z):
            a = y / radius
            return (width / 2 + radius - (radius + width / 2 - x) * math.cos(a),
                    (radius + width / 2 - x) * math.sin(a), z)
        p.collection["rayon"] = radius
        p.collection["angle_deg"] = 7.5
        p.collection["sortie"] = [width / 2 + radius - (radius + width / 2) * math.cos(math.pi / 24),
                                  (radius + width / 2) * math.sin(math.pi / 24), 0]
        p.collection["sortie_cap_deg"] = -7.5
    for a, b in zip(profile(width), profile(width)[1:]):
        if niche and a == (0, 0):
            # Le volume de refuge commence au-delà de la paroi, sans façade bouchée.
            p.box((-.25, 0, 0), (.25, .5, 2.25), "beton", True)
            p.box((-.25, 3.5, 0), (.25, .5, 2.25), "beton", True)
            continue
        if niche and a[0] < .1 and a[1] < 2.75:
            t = (2.75 - a[1]) / (b[1] - a[1])
            cut = (a[0] + t * (b[0] - a[0]), 2.75)
            slab(p, cut, b, length)
            slab(p, a, cut, .5)
            slab(p, a, cut, .5, mapper=lambda x, y, z: (x, y + 3.5, z))
            continue
        slab(p, a, b, length, mapper=mapper)
    rails(p, width, length)
    # La transformation courbe s'applique aussi aux rails et à leurs proxies.
    if mapper:
        for obj in list(p.collection.objects):
            if obj.name.startswith("col_hull_") or "col_hull_" + obj.name in p.collection.objects:
                continue
            for vertex in obj.data.vertices:
                vertex.co = mapper(*vertex.co)
            if obj.name.startswith("col_box_"):
                obj.name = obj.name.replace("col_box_", "col_hull_")
        p.collection["collision_sol"] = "prismes convexes de 1 m au plus"
    for x in (.2, width - .2):
        for z in (1.25, 1.5):
            if not (niche and x < 1):
                obj = p.box((x - .06, 0, z), (.12, length, .08), "acier")
                if mapper:
                    for v in obj.data.vertices:
                        v.co = mapper(*v.co)
    if niche:
        p.box((-1.5, .5, -.25), (1.5, 3, .25), "petrole", True)
        p.box((-1.75, .5, 0), (.25, 3, 2.75), "beton", True)
        for y in (.25, 3.5):
            p.box((-1.75, y, 0), (1.75, .25, 2.75), "beton", True)
        p.box((-1.75, .5, 2.75), (1.75, 3, .25), "beton", True)
        p.box((-.3, .5, 2.5), (.3, 3, .25), "petrole")
        p.box((-1.6, 1, 2.35), (.08, 2, .12), "lampe")
        p.collection["refuge_libre"] = [3, 1.5, 2.75]
    return p


def wall(materials):
    p = Piece("mur_quai_4m", materials, "Mur 4 m longitudinal × 3 m haut, frise pétrole à 1,25 m")
    p.box((0, 0, 0), (.25, 4, 3), "ivoire", True)
    p.box((.25, 0, 0), (.05, 4, .25), "petrole")
    p.box((.25, 0, 1.25), (.05, 4, .25), "petrole")
    return p


def vault(materials):
    p = Piece("voute_station_4m", materials, "Voûte 18 m libres ; naissance à 3 m sur quai, sommet 6,5 m sur rail")
    for a, b in zip(profile(18, 6.5, 3.75), profile(18, 6.5, 3.75)[1:]):
        if min(a[1], b[1]) >= 3.75:
            slab(p, a, b, 4, "ivoire")
    return p


def quay(materials):
    p = Piece("quai_5x4", materials, "Quai 5 × 4 m ; dessus à 0,75 m du rail ; bande 0,5 m")
    p.box((0, 0, 0), (5, 4, .75), "sol", True)
    p.box((4.5, 0, .75), (.5, 4, .025), "ambre")
    for y in range(16):
        p.box((4.75, y * .25, .777), (.2, .1, .008), "ivoire")
    p.collection["sol_utile"] = .75
    return p


def track(materials):
    p = Piece("voie_4x4", materials, "Voie de station 4 × 4 m ; deux files de rails et traverses")
    rails(p, 4, 4)
    return p


def stairs(materials, name="escalier_2m", steps=8, width=2.5):
    p = Piece(name, materials, f"{steps} marches de 0,25 m / giron 0,5 m ; largeur {width:g} m ; proxy rampe")
    for i in range(steps):
        p.box((0, i * .5, 0), (width, .5, (i + 1) * .25), "beton")
        p.box((0, i * .5, (i + 1) * .25), (width, .1, .015), "ambre")
    length, height = steps * .5, steps * .25
    verts = [(0, 0, -.25), (width, 0, -.25), (width, length, -.25), (0, length, -.25),
             (0, 0, .25), (width, 0, .25), (width, length, height), (0, length, height)]
    mesh = p.mesh(verts, FACES, "beton")
    mesh.hide_render = True
    mesh.name = "col_hull_" + mesh.name
    for x in (.05, width - .05):
        p.beam((x, 0, 1.25), (x, length, height + 1), .07)
        for i in range(steps // 2 + 1):
            y = min(i, steps // 2 - .1)
            p.beam((x, y, y * .5 + .2), (x, y, y * .5 + 1.25), .06)
    return p


def gallery(materials):
    p = Piece("galerie_4m", materials, "Galerie 2,5 × 4 m ; hauteur libre 3 m, gaines hors gabarit")
    p.box((0, 0, -.25), (2.5, 4, .25), "sol", True)
    for x in (-.25, 2.5):
        p.box((x, 0, 0), (.25, 4, 3), "beton", True)
    p.box((0, 0, 3), (2.5, 4, .25), "beton", True)
    for x in (.1, .35):
        p.box((x, 0, 2.75), (.12, 4, .12), "acier")
    return p


def railing(materials):
    p = Piece("garde_corps_2m", materials, "2 m ; hauteur 1,25 m, lisse basse et proxy continu")
    for y in (0, 1, 2):
        p.box((0, y, 0), (.075, .075, 1.25))
    for z in (.5, 1.18):
        p.box((0, 0, z), (.075, 2.075, .075))
    p.link(geo_utils.build_proxy_object("col_box_garde_corps", "box", (0, 0, 0), (.1, 2.1, 1.25)), True)
    return p


def portal(materials):
    p = Piece("portique_depot_8m", materials, "Travée de charpente 8 m ; ouverture 8 × 8 m")
    for x in (-.25, 8):
        p.box((x, 0, 0), (.25, .5, 8), "acier", True)
        p.box((x - .125, -.125, 0), (.5, .75, .15))
    p.box((-.25, 0, 8), (8.5, .5, .5), "acier", True)
    for x in (0, 8):
        p.beam((x, .25, 6.5), (x + (1.5 if x == 0 else -1.5), .25, 8), .12)
    return p


def furniture(materials, name):
    p = Piece(name, materials, "Mobilier de station / maintenance, à placer hors passage")
    if name == "banc_3m":
        p.box((0, .15, .45), (3, .55, .15), "petrole", True)
        p.box((0, .6, .6), (3, .12, .45), "petrole", True)
        for x in (.25, 2.5):
            p.box((x, .2, 0), (.12, .4, .45), "acier", True)
    elif name == "armoire_service":
        p.box((0, 0, 0), (1.5, .65, 2.25), "acier", True)
        for x in (.125, .8):
            p.box((x, -.025, .125), (.55, .04, 1.9), "beton")
            p.box((x + .42, -.06, 1), (.04, .06, .25), "ivoire")
        for z in (.3, .4, .5):
            p.box((.25, -.07, z), (.3, .025, .025), "sol")
        p.text("COURANT", (.75, -.075, 1.7), .15)
    elif name == "pupitre_aiguillage":
        p.box((0, 0, 0), (2, 1, .75), "acier", True)
        verts = [(0, 0, .75), (2, 0, .75), (2, 1, .75), (0, 1, .75),
                 (0, 0, 1), (2, 0, 1), (2, 1, 1.5), (0, 1, 1.5)]
        p.mesh(verts, FACES, "petrole", True)
        for x in (.3, .65, 1):
            p.box((x, -.02, .8), (.15, .05, .15), "signal")
        p.text("AIGUILLAGE", (1, -.05, .6), .16)
    return p


def signage(materials, name):
    p = Piece(name, materials, "Signalétique originale sans nom de réseau ni marque réelle")
    if name == "luminaire_2m":
        p.box((0, 0, 0), (2, .25, .15))
        p.box((.05, .025, -.025), (1.9, .2, .035), "lampe")
    elif name == "signal_voie":
        p.box((.2, .2, 0), (.1, .1, 2.5))
        p.box((0, 0, 1.6), (.5, .3, 1))
        for z, mat in ((1.75, "signal"), (2.2, "rouge")):
            p.box((.13, -.025, z), (.24, .035, .24), mat)
        p.text("VOIE", (.25, -.03, 1.35), .14)
    elif name == "arret_urgence":
        p.box((0, 0, 0), (.5, .25, .75), "acier")
        p.box((.05, -.025, .05), (.4, .04, .65), "rouge")
        p.box((.17, -.1, .27), (.16, .12, .16), "ambre")
        p.text("ARRET", (.25, -.075, .53), .085)
    else:
        label = {"panneau_sortie": "SORTIE  >", "panneau_refuge": "REFUGE", "panneau_maintenance": "SERVICE"}[name]
        p.box((0, 0, 0), (2, .12, .65), "petrole")
        p.text(label, (1, -.01, .2), .3)
        if name == "panneau_refuge":
            p.box((.1, -.025, .12), (.12, .035, .4), "ivoire")
            p.box((.1, -.025, .42), (.3, .035, .1), "ivoire")
            p.box((.32, -.025, .12), (.1, .035, .4), "ivoire")
    return p


def train_side(p, x, floor, roof):
    # see: docs/4-technique/pilote-metro.md#flancs-de-rame
    doors = ((4.5, 6), (9.5, 11))
    bays = ((0, 4.5), (6, 9.5), (11, 15))
    windows = ((.375, 2.75), (3, 4.25), (6.25, 7.75),
               (8, 9.25), (11.25, 12.75), (13, 14.625))
    sill, header = 1.45, roof - .45
    for begin, end in bays:
        for low, high, material in ((floor, 1.05, "peinture"),
                                    (1.05, 1.3, "petrole"),
                                    (1.3, sill, "peinture"),
                                    (header, roof, "peinture")):
            p.box((x, begin, low), (.125, end - begin, high - low), material, True)
        cursor = begin
        for start, stop in windows:
            if start < begin or stop > end:
                continue
            p.box((x, cursor, sill), (.125, start - cursor, header - sill), "peinture", True)
            p.box((x + .035, start, sill), (.055, stop - start, header - sill), "verre")
            p.link(geo_utils.build_proxy_object(
                f"col_box_{p.name}_vitre_{x:g}_{start:g}", "box",
                (x, start, sill), (.125, stop - start, header - sill)), True)
            cursor = stop
        p.box((x, cursor, sill), (.125, end - cursor, header - sill), "peinture", True)

    for begin, end in doors:
        door_top = roof - .125
        clear_top = door_top - .125
        p.box((x, begin, door_top), (.125, end - begin, .125), "peinture", True)
        for y in (begin, end - .1):
            p.box((x, y, floor), (.125, .1, door_top - floor), "acier", True)
        p.box((x, begin + .1, clear_top), (.125, end - begin - .2, .125), "acier", True)
        midpoint = (begin + end) / 2
        leaf_x = x + .02
        for start, stop in ((begin + .1, midpoint - .02), (midpoint + .02, end - .1)):
            for low, high in ((floor, 1.5), (2.3, clear_top)):
                p.box((leaf_x, start, low), (.085, stop - start, high - low), "petrole")
            for y in (start, stop - .08):
                p.box((leaf_x, y, 1.5), (.085, .08, .8), "petrole")
            p.box((x + .04, start + .08, 1.5), (.045, stop - start - .16, .8), "verre")
            handle_x = x + .005 if x == 0 else x + .105
            handle_y = stop - .12 if stop < midpoint else start + .09
            p.box((handle_x, handle_y, 1.14), (.015, .035, .25), "ambre")
        p.box((leaf_x, midpoint - .02, floor), (.085, .04, clear_top - floor), "acier")
        p.link(geo_utils.build_proxy_object(
            f"col_box_{p.name}_porte_{x:g}_{begin:g}", "box",
            (x, begin + .1, floor), (.125, end - begin - .2, clear_top - floor)), True)
    p.collection["portes_laterales"] = [[begin, end] for begin, end in doors]


def train(materials, name, width, freight=False):
    p = Piece(name, materials, f"Voiture 15 × {width:g} m ; {'allée 2 m et intercirculation 2,25 m' if freight else 'gabarit 3,2 m depuis rail'}")
    floor = .75
    roof = floor + 3 if freight else 3.05
    p.box((.125, 0, floor - .25), (width - .25, 15, .25), "sol", True)
    top = [(.125, roof - .25), (.35, roof + .05), (width - .35, roof + .05), (width - .125, roof - .25)]
    for a, b in zip(top, top[1:]):
        slab(p, a, b, 15, "peinture", .1)
    for x in (0, width - .125):
        train_side(p, x, floor, roof)
    # Les portes terminales restent ouvertes dans le fret.
    for y in (0, 14.875):
        if freight:
            side = (width - 2.25) / 2
            for x in (0, width - side):
                p.box((x, y, floor), (side, .125, 2.5), "peinture", True)
            p.box((0, y, floor + 2.5), (width, .125, roof - floor - 2.5), "petrole", True)
        else:
            face_y = .08 if y == 0 else 14.7
            p.box((.2, face_y, floor), (width - .4, .125, .7), "petrole", True)
            p.box((.2, face_y, 2.5), (width - .4, .125, roof - 2.5), "petrole", True)
            for x in (.1, width - .3):
                p.box((x, face_y + .05, floor), (.2, .25, roof - floor), "peinture", True)
            p.box((.3, face_y, 1.45), (width - .6, .06, 1.05), "verre", True)
            p.box((width / 2 - .3, face_y - .015, 2.6), (.6, .08, .2), "acier")
            if y == 0:
                p.text("02", (width / 2, face_y - .025, 2.62), .15)
            for x in (.3, width - .6):
                p.box((x, face_y - .04, 1.05), (.3, .08, .15), "lampe")
    for x in (.15, width - .7):
        for y in (1, 6.5, 11.5):
            p.box((x, y, floor + .15), (.55, 2, .2), "acier", True)
            p.box((x, y, floor + .35), (.55, 2, .15), "petrole", True)
            back_x = x if x < 1 else x + .45
            p.box((back_x, y, floor + .5), (.125, 2, .6), "petrole", True)
    for y in (2, 11):
        for x in (.35, width - .35):
            p.box((x, y, .125), (.15, 2, .45), "acier")
            for yy in (y + .25, y + 1.5):
                p.box((x - .15, yy, .1), (.3, .35, .35), "sol")
    for x in (.5, width - .65):
        p.box((x, .5, roof - .075), (.15, 14, .05), "lampe")
    if freight:
        p.collection["allee_libre"] = width - 1.4
        p.collection["porte_libre"] = [2.25, 2.5]
        p.box((.15, 8, floor), (.55, .6, .6), "ambre", True)
        p.box((.2, 8.1, floor + .6), (.45, .4, .04), "ivoire")
    else:
        # Le nez se resserre sur le dernier mètre, avec un pare-brise incliné.
        for obj in p.collection.objects:
            if obj.type != "MESH":
                continue
            for v in obj.data.vertices:
                x, y, z = v.co
                inset = max(0, 1 - min(y, 15 - y))
                x += (.18 if x < width / 2 else -.18) * inset
                tilt = max(0, min(1, (z - 1.2) / 1.8)) * .45 * inset
                y += tilt if y < 7.5 else -tilt
                v.co = (x, y, z)
        for obj in p.collection.objects:
            if obj.name.startswith("col_box_"):
                coords = [v.co.y for v in obj.data.vertices]
                if min(coords) < 1.5 or max(coords) > 13.5:
                    obj.name = obj.name.replace("col_box_", "col_hull_")
    return p


def coupling(materials):
    p = Piece("soufflet_fret_05m", materials, "Raccord 0,5 m, porte 2,25 × 2,5 m ; sol à 0,75 m")
    p.box((0, 0, .5), (3.75, .5, .25), "sol", True)
    for y in (0, .125, .25, .375):
        for x in (0, 3):
            p.box((x, y, .75), (.75, .08, 2.5), "acier", True)
        p.box((0, y, 3.25), (3.75, .08, .5), "acier", True)
    return p


def build(materials):
    pieces = [tunnel(materials), tunnel(materials, "tunnel_niche_4m", niche=True),
              tunnel(materials, "tunnel_large_4m", 7),
              tunnel(materials, "courbe_R32_75deg", 7, radius=32),
              tunnel(materials, "courbe_R24_75deg", 7, radius=24),
              wall(materials), vault(materials), quay(materials), track(materials),
              stairs(materials), stairs(materials, "escalier_quai_075m", 3),
              gallery(materials), railing(materials), portal(materials),
              train(materials, "voiture_ligne_15m", 2.8),
              train(materials, "voiture_fret_15m", 3.75, True), coupling(materials)]
    pieces.extend(furniture(materials, n) for n in ("banc_3m", "armoire_service", "pupitre_aiguillage"))
    pieces.extend(signage(materials, n) for n in ("luminaire_2m", "signal_voie", "arret_urgence", "panneau_sortie", "panneau_refuge", "panneau_maintenance"))
    return {p.name: p for p in pieces}
