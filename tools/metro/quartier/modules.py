"""Pièces de rue N3b, métriques et réutilisables hors scène de présentation.

see: docs/assets/kit-quartier.md#pièces
"""
import bpy

from tools.metro.kit.geometry import FACES
from tools.metro.quartier.geometry import Piece, consolidate


def facade(mats, variant):
    p = Piece("facade_" + variant + "_4m", mats, "4 × 0,5 × 3,5 m ; fenêtres en retrait ; façade vers -Y")
    material = {"balcon": "enduit", "brique": "brique", "volets": "ardoise"}[variant]
    for origin, size in [((0, 0, 0), (4, .5, .75)), ((0, 0, 2.5), (4, .5, 1)),
                         ((0, 0, .75), (.5, .5, 1.75)), ((1.75, 0, .75), (.5, .5, 1.75)),
                         ((3.5, 0, .75), (.5, .5, 1.75))]:
        p.box(origin, size, material, True, seg=1)
    for x in (.5, 2.25):
        for z in (.75, 2.4):
            p.box((x - .07, -.08, z), (1.39, .15, .1), "ivoire")
        for edge in (x, x + 1.17):
            p.box((edge, -.02, .85), (.08, .15, 1.55), "ivoire")
        p.box((x + .08, .19, .85), (1.09, .025, 1.55), "nuit", True)
        if variant == "balcon":
            p.box((x + .08, .14, .85), (.49, .025, 1.55), "vitre_chaude")
        p.box((x + .61, -.02, .85), (.04, .15, 1.55), "ivoire")
        p.box((x + .08, -.02, 1.6), (1.09, .15, .05), "ivoire")
        if variant == "volets":
            for edge in (x - .35, x + 1.28):
                p.box((edge, -.12, .85), (.3, .1, 1.55), "petrole")
    p.box((0, -.12, 3.25), (4, .7, .15), "ivoire")
    if variant == "balcon":
        p.box((.25, -.7, .65), (3.5, .7, .1), "ardoise", True)
        for x in (.35, 1, 1.65, 2.35, 3, 3.65):
            p.box((x, -.65, .75), (.06, .06, .8), "acier")
        p.box((.3, -.68, 1.55), (3.4, .08, .08), "acier")
        for x in (.3, 3.62):
            p.box((x, -.6, 1.55), (.08, .6, .08), "acier")
    return p


def storefront(mats, kind):
    p = Piece("vitrine_" + kind + "_4m", mats, "4 × 2 × 3,5 m ; devanture vitrée avec intérieur visible")
    for x in (0, 3.75):
        p.box((x, 0, 0), (.25, 2, 3.5), "enduit", True, seg=1)
    p.box((0, 0, 2.75), (4, 2, .75), "enduit", True, seg=1)
    p.box((.25, .05, 0), (3.5, 1.95, .12), "pave", True)
    p.box((.25, 1.85, .12), (3.5, .15, 2.63), "ivoire", True, seg=1)
    frame = "petrole" if kind == "laverie" else "rouge"
    p.box((.25, -.08, .12), (3.5, .12, .25), frame)
    for x in (.25, 2.4, 3.65):
        p.box((x, -.08, .37), (.1, .12, 2.38), frame)
    p.box((.25, -.08, 2.6), (3.5, .12, .15), frame)
    for x, width in ((.35, 2.05), (2.5, 1.15)):
        p.box((x, 0, .37), (width, .03, 2.23), "verre")
    p.proxy((.25, 0, .12), (3.5, .15, 2.63))
    p.box((2.6, -.16, 1.15), (.1, .08, .35), "ivoire")
    p.box((.25, -.15, 2.8), (3.5, .18, .5), frame)
    p.text("LAVOMAT" if kind == "laverie" else "NUIT & JOUR", (2, -.26, 2.94), .29)
    p.box((.5, .45, 2.62), (3, .65, .07), "lampe")
    if kind == "laverie":
        for x in (.6, 1.65, 2.7):
            p.box((x, .9, .12), (.8, .75, 1.1), "ivoire")
            p.cylinder((x + .4, .87, .72), .3, .1, "acier", "Y")
            p.cylinder((x + .4, .81, .72), .21, .04, "nuit", "Y")
            p.box((x + .1, .85, 1.05), (.15, .04, .07), "petrole")
    else:
        for z in (.4, 1, 1.6):
            p.box((.5, 1.5, z), (2.75, .3, .08), "bois")
            for i in range(7):
                p.box((.6 + i * .38, 1.55, z + .08), (.2, .2, .27), "ambre" if i % 2 else "petrole")
        p.box((.6, .65, .12), (1.5, .4, .75), "bois")
    return p


def stair_entrance(mats):
    p = Piece("bouche_6x12", mats, "6 × 12 m ; descente -5 m ; 20 marches de 0,25 m ; passage 4 m")
    for x in (0, 5):
        p.box((x, 0, -.25), (1, 12, .25), "pave", True, seg=1)
        p.box((x + .5, 1, -5.25), (.25, 11, 6.25), "enduit", True, seg=1)
        p.box((x + .5, 1, 1), (.25, 11, .15), "ivoire")
        for y in (1, 3, 5, 7, 9, 11):
            p.box((x + .57, y, 1.15), (.1, .1, .5), "acier")
        p.box((x + .57, 1, 1.65), (.1, 10.1, .1), "acier")
    p.box((1, 0, -.25), (4, 1, .25), "pave", True)
    for i in range(20):
        p.box((1, 1 + i * .5, -(i + 1) * .25 - .15), (4, .5, .15), "ardoise")
        p.box((1, 1 + i * .5, -(i + 1) * .25), (4, .05, .025), "ivoire")
        if i < 19:
            p.box((1, 1.45 + i * .5, -(i + 2) * .25 - .15), (4, .05, .4), "ardoise")
    vertices = [(x, y, z) for x in (1, 5) for y, z in ((1, 0), (11, -5), (11, -5.25), (1, -.25))]
    ramp = p.mesh(vertices, FACES, "ardoise", True)
    bpy.data.objects.remove(ramp, do_unlink=True)
    p.box((1, 11, -5.25), (4, 1, .25), "ardoise", True)
    for x, wall in ((.95, .75), (5.05, 5.25)):
        p.beam((x, 1, .8), (x, 11, -4.2), .07, "acier")
        for y in (1, 3, 5, 7, 9, 11):
            z = .8 - (y - 1) * .5
            p.beam((wall, y, z - .07), (x, y, z - .07), .07, "acier")
    for x in (.5, 5.25):
        p.box((x, 0, 0), (.25, .4, 3.5), "acier", True)
    p.box((.5, 0, 2.85), (5, .4, .65), "petrole")
    p.text("METRO", (3, -.03, 3.01), .45)
    p.collection["sortie"] = [1, 12, -5]
    p.collection["passage_libre_m"] = 4.0
    p.collection["grille"] = "grille_5m séparée ; animation au pilote N4b"
    return p


def grille(mats):
    p = Piece("grille_5m", mats, "5 × 0,15 × 2,75 m ; pièce séparée pour door_* au pilote")
    for x in (0, 2.45, 4.9):
        p.box((x, 0, 0), (.1, .12, 2.75), "acier")
    for z in (.15, 1.2, 2.6):
        p.box((0, 0, z), (5, .12, .1), "acier")
    for i in range(1, 20):
        p.box((i * .25, .03, .15), (.04, .04, 2.55), "acier")
    p.proxy((0, 0, 0), (5, .15, 2.75))
    p.box((1.75, -.07, 1.45), (1.5, .07, .7), "ivoire")
    p.text("TRAFIC", (2.5, -.15, 1.86), .18, "nuit")
    p.text("INTERROMPU", (2.5, -.15, 1.58), .16, "nuit")
    return p


def shelter(mats):
    p = Piece("abribus_4m", mats, "4 × 1,5 × 2,75 m ; banc adossé ; façade ouverte")
    for x in (.1, 3.75):
        for y in (.1, 1.3):
            p.box((x, y, 0), (.1, .1, 2.5), "acier", True)
    p.box((0, 0, 2.5), (4, 1.5, .18), "acier")
    p.box((.2, 1.3, .35), (3.55, .03, 2), "verre")
    p.box((3.75, .2, .35), (.03, 1.1, 2), "verre")
    p.proxy((.1, 1.3, .35), (3.75, .12, 2))
    p.proxy((3.75, .2, .35), (.12, 1.1, 2))
    for x in (.75, 2.4):
        p.box((x, .85, 0), (.1, .45, .55), "acier")
    p.box((.6, .7, .5), (2.4, .6, .1), "bois", True)
    p.box((.6, 1.23, .7), (2.4, .1, .35), "bois")
    p.box((.2, 1.24, .9), (.65, .04, 1.2), "ivoire")
    p.text("S", (.52, 1.19, 1.55), .3, "petrole")
    p.box((0, -.03, 2.51), (4, .03, .17), "petrole")
    return p


def kiosk(mats):
    p = Piece("kiosque_3x2", mats, "3 × 2 × 3 m ; auvent en pente ; façade de vente en retrait")
    p.box((.25, .25, 0), (2.5, 1.5, 1.25), "petrole", True)
    p.box((.25, 1.5, 1.25), (2.5, .25, 1.25), "acier", True)
    for x in (.25, 2.65):
        p.box((x, .25, 1.25), (.1, 1.25, 1.25), "acier", True)
    p.box((.25, .1, 1.25), (2.5, .5, .12), "bois")
    p.mesh([(x, y, height + dz) for dz in (0, .12) for x, y, height in
            ((0, 0, 2.7), (3, 0, 2.7), (3, 2, 2.95), (0, 2, 2.95))
            ], FACES, "rouge")
    p.box((.25, .02, 2.3), (2.5, .1, .35), "ivoire")
    p.text("LE KIOSQUE", (1.5, -.1, 2.38), .23, "petrole")
    for x in (.45, 1.05, 1.65, 2.25):
        p.box((x, .6, 1.37), (.45, .05, .65), "ivoire")
        p.box((x + .05, .53, 1.8), (.35, .03, .12), "rouge")
    return p


def street_props(mats):
    pieces = []
    p = Piece("lampadaire_5m", mats, "fût effilé 5 m ; luminaire déporté au-dessus de la rue")
    p.cylinder((.2, .2, .125), .2, .25)
    p.beam((.2, .2, .25), (.2, .2, 4.7), .12)
    p.proxy((.1, .1, 0), (.2, .2, 4.7))
    p.beam((.2, .2, 4.7), (1.15, .2, 5), .12)
    p.box((.9, -.05, 4.84), (.65, .5, .15), "acier")
    p.box((.96, 0, 4.8), (.53, .4, .04), "lampe")
    pieces.append(p)
    p = Piece("banc_2m", mats, "2 × 0,75 × 1 m ; assise à 0,5 m")
    for x in (.2, 1.7):
        p.box((x, .1, 0), (.1, .5, .5), "acier")
    for y in (.1, .3, .5):
        p.box((0, y, .5), (2, .17, .08), "bois")
    for z in (.72, .88):
        p.box((0, .65, z), (2, .08, .12), "bois")
    p.proxy((0, .1, 0), (2, .65, .6))
    p.proxy((0, .65, .6), (2, .1, .4))
    pieces.append(p)
    p = Piece("borne_075m", mats, "borne urbaine à tête claire ; base ancrée au sol")
    p.cylinder((.125, .125, .375), .1, .75)
    p.cylinder((.125, .125, .78), .12, .12, "ivoire")
    p.proxy((0, 0, 0), (.25, .25, .85))
    pieces.append(p)
    p = Piece("corbeille", mats, "0,5 × 0,5 × 0,9 m ; couvercle distinct et pied")
    p.cylinder((.25, .25, .48), .24, .7, "petrole")
    p.cylinder((.25, .25, .86), .27, .08)
    p.box((.18, .18, 0), (.14, .14, .15), "acier")
    p.proxy((0, 0, 0), (.5, .5, .9))
    pieces.append(p)
    p = Piece("trappe_service_2m", mats, "2 × 2 m ; cadre fixe, panneau séparable pour la cour de service")
    for x in (0, 1.85):
        p.box((x, 0, -.15), (.15, 2, .15), "acier", True)
    for y in (0, 1.85):
        p.box((.15, y, -.15), (1.7, .15, .15), "acier", True)
    p.box((.15, .15, -.08), (1.7, 1.7, .07), "petrole", True)
    for x in (.3, 1.6):
        p.box((x, .85, -.005), (.1, .3, .025), "ivoire")
    p.collection["integration"] = "panneau à extraire en door_* ; cadre seul autour de l'ouverture N4b"
    pieces.append(p)
    return pieces


def tower(mats):
    p = Piece("repere_tour_56m", mats, "repère unique distant, 24 × 18 × 56 m ; hors parcours ; vapeur au pilote")
    p.box((0, 0, 0), (24, 18, 6), "ardoise", seg=2)
    p.box((0, 2, 6), (7, 14, 17), "acier", seg=2)
    corners = [(8, 3), (20, 3), (23, 6), (23, 13), (20, 16), (8, 16), (5, 13), (5, 6)]
    vertices = [(x, y, z) for z in (6, 54) for x, y in corners]
    faces = [(i, (i + 1) % 8, (i + 1) % 8 + 8, i + 8) for i in range(8)]
    for i in range(1, 7):
        faces.extend([(0, i + 1, i), (8, 8 + i, 8 + i + 1)])
    p.mesh(vertices, faces, "nuit")
    for z in range(8, 53, 3):
        p.box((8, 2.96, z), (12, .04, .22), "petrole")
        for x in (9, 12, 18):
            p.box((x, 2.9, z + .4), (.8, .05, .9), "vitre_chaude" if z % 2 else "acier")
    p.box((8, 3, 54), (12, 13, 2), "acier")
    for x, height in ((8, 46), (20, 56)):
        p.box((x, 2.6, 6), (.5, .4, height - 6), "ardoise", seg=2)
    return p


def van(mats):
    p = Piece("fourgon_5m", mats, "fourgon original 2,25 × 5 × 2,35 m ; caisse fermée et cabine vitrée ; avant +Y")
    cross = [(.2, .75), (2.05, .75), (2.05, 2.05), (1.85, 2.3), (.4, 2.3), (.2, 2.05)]
    vertices = [(x, y, z) for y in (.15, 3) for x, z in cross]
    faces = [(i, (i + 1) % 6, (i + 1) % 6 + 6, i + 6) for i in range(6)]
    for i in range(1, 5):
        faces.extend([(0, i + 1, i), (6, 6 + i, 6 + i + 1)])
    p.mesh(vertices, faces, "ivoire")
    p.box((.2, 3, .7), (1.85, 1.65, .55), "ivoire")
    p.box((.2, 4.65, .7), (1.85, .25, .5), "ivoire")
    p.box((.1, 0, .55), (2.05, 4.95, .15), "acier")
    for x in (.22, 1.98):
        p.beam((x, 3.8, 2.3), (x, 4.4, 1.3), .11, "ivoire")
        p.beam((x, 3, 1.25), (x, 3, 2.3), .11, "ivoire")
        p.mesh([(x, 3.12, 1.28), (x, 4.25, 1.28), (x, 3.72, 2.13), (x, 3.12, 2.13)], [(0, 1, 2, 3)], "verre")
        p.box((x - .06, 3.7, 1.2), (.12, .35, .09), "acier")
        p.box((x - .14, 4.1, 1.4), (.28, .12, .18), "acier")
    p.mesh([(.27, 3.83, 2.22), (1.92, 3.83, 2.22), (1.92, 4.31, 1.35), (.27, 4.31, 1.35)], [(0, 1, 2, 3)], "verre")
    p.box((.2, 3, 2.25), (1.85, .85, .1), "ivoire")
    p.box((.2, 4.95, .65), (1.85, .05, .18), "acier")
    for x in (.35, 1.55):
        p.box((x, 4.9, .95), (.35, .025, .17), "lampe")
        p.box((x, .09, .85), (.2, .04, .3), "rouge")
        p.box((x, 3.1, .85), (.45, .55, .25), "acier")
        p.box((x, 3.1, 1.1), (.45, .12, .5), "acier")
    p.box((1.09, .11, .8), (.04, .03, 1.4), "acier")
    for x in (.18, 2.055):
        p.box((x, .35, 1.15), (.015, 2.45, .18), "petrole")
    for x in (.13, 2.1):
        for y in (1, 4):
            p.cylinder((x, y, .42), .42, .26, "nuit", "X")
            p.cylinder((x + (-.14 if x < 1 else .14), y, .42), .24, .04, "acier", "X")
    p.proxy((.2, .15, .55), (1.85, 2.85, 1.75))
    p.proxy((.2, 3, .55), (1.85, 1.9, .7))
    return p


def build(mats):
    pieces = [facade(mats, variant) for variant in ("balcon", "brique", "volets")]
    pieces += [storefront(mats, kind) for kind in ("laverie", "epicerie")]
    p = Piece("mur_aveugle_4m", mats, "4 × 0,5 × 3,5 m ; raccord de cour et pignon")
    p.box((0, 0, 0), (4, .5, 3.5), "brique", True, seg=1)
    pieces.append(p)
    p = Piece("corniche_4m", mats, "4 × 1 × 0,5 m ; terminaison de façade à hauteur multiple de 3,5 m")
    p.box((0, -.25, 0), (4, 1, .2), "ivoire")
    p.box((0, 0, .2), (4, .5, .3), "ardoise")
    pieces.append(p)
    p = Piece("trottoir_4x25", mats, "4 × 2,5 × 0,25 m ; face supérieure z=0 ; bordure chanfreinée côté +Y")
    p.box((0, 0, -.25), (4, 2.25, .25), "pave", True, seg=1)
    p.mesh([(x, y, z) for x in (0, 4) for y, z in ((2.25, -.25), (2.5, -.25), (2.5, -.07), (2.25, 0))], FACES, "ivoire", True)
    pieces.append(p)
    p = Piece("chaussee_4x4", mats, "4 × 4 m ; chaussée 0,25 m sous le trottoir")
    p.box((0, 0, -.5), (4, 4, .25), "sol", True, seg=1)
    pieces.append(p)
    pieces += [stair_entrance(mats), grille(mats), shelter(mats), kiosk(mats), *street_props(mats), tower(mats), van(mats)]
    for piece in pieces:
        consolidate(piece)
    return {p.name: p for p in pieces}
