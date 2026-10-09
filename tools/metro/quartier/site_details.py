"""Rez-de-chaussée et mobilier de la place, hors bibliothèque N3b.

see: docs/4-technique/pilote-quartier.md#composition-de-la-place
"""
import math

import bpy
from mathutils import Matrix, Vector

from tools.metro.quartier.geometry import Piece, consolidate


def install(a, piece, origin, angle=0):
    consolidate(piece)
    transform = Matrix.Translation(Vector(origin)) @ Matrix.Rotation(angle, 4, "Z")
    for obj in list(piece.collection.objects):
        obj.data.transform(transform @ obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
        proxy = obj.name.startswith("col_")
        piece.collection.objects.unlink(obj)
        (a.col if proxy else a.props).objects.link(obj)
    bpy.data.collections.remove(piece.collection)
    a.placed.append({"detail": piece.name, "origin": list(origin), "angle": angle})


def frontage(a, kind, origin, angle, number):
    p = Piece("rdc_" + str(number), a.mats, "entrée ou commerce fermé, 4 × 0,5 × 3,5 m")
    wall = "enduit" if number % 3 else "brique"
    p.box((0, 0, 0), (4, .5, 3.5), wall, True)
    p.box((0, -.1, 0), (4, .12, .35), "ardoise")
    p.box((0, -.13, 3.25), (4, .2, .18), "ivoire")
    if kind == "habitation":
        p.box((1.43, -.16, .02), (1.14, .2, 2.62), "ivoire")
        p.box((1.55, -.2, .05), (.9, .06, 2.42), "petrole" if number % 2 else "bois")
        p.box((1.65, -.24, 1.2), (.7, .03, .9), "nuit")
        for x in (1.65, 1.99, 2.32):
            p.box((x, -.28, 1.2), (.035, .03, .9), "acier")
        p.box((2.3, -.3, .94), (.05, .06, .18), "ambre")
        p.box((2.7, -.15, 1.35), (.15, .07, .23), "acier")
        p.box((1.79, -.15, 2.73), (.42, .07, .25), "petrole")
        p.text(str(number), (2, -.24, 2.8), .17)
        for x in (.35, 2.9):
            p.box((x - .07, -.14, 1.05), (.87, .16, 1.28), "ivoire")
            p.box((x, -.24, 1.15), (.73, .035, 1.07), "nuit")
            for edge in (x + .22, x + .49):
                p.box((edge, -.27, 1.15), (.035, .04, 1.07), "acier")
            p.box((x, -.27, 1.66), (.73, .04, .04), "acier")
    elif kind in ("cafe", "pharmacie"):
        frame = "rouge" if kind == "cafe" else "petrole"
        p.box((.25, -.16, .35), (3.5, .18, 2.4), frame)
        p.box((.38, -.23, .48), (3.24, .05, 2.12), "vitre_chaude")
        p.box((.42, -.3, .52), (3.16, .035, 1.72), "nuit")
        for x in (.4, 1.45, 2.55, 3.55):
            p.box((x, -.35, .5), (.07, .08, 2.1), frame)
        p.box((.25, -.38, 2.77), (3.5, .2, .45), frame)
        p.text("LE PASSAGE" if kind == "cafe" else "PHARMACIE", (2, -.61, 2.89), .26)
        if kind == "cafe":
            for i in range(8):
                p.box((.2 + i * .45, -.9, 2.66), (.45, .7, .08), "rouge" if i % 2 else "ivoire")
        else:
            p.box((.8, -.4, 1.25), (.2, .06, .65), "petrole")
            p.box((.58, -.4, 1.47), (.64, .06, .2), "petrole")
    else:
        p.box((.35, -.12, .3), (3.3, .15, 2.4), "acier")
        for i in range(18):
            p.box((.4, -.18, .4 + i * .12), (3.2, .09, .075), "ardoise")
        p.box((.25, -.2, 2.82), (3.5, .2, .42), "ivoire")
        p.text("ATELIER", (2, -.44, 2.93), .26, "petrole")
    install(a, p, origin, angle)


def trees(a):
    mat = bpy.data.materials.new("quartier_feuillage")
    mat.use_nodes = True
    mat.diffuse_color = (.18, .29, .2, 1)
    mat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = mat.diffuse_color
    mat.node_tree.nodes.get("Principled BSDF").inputs["Roughness"].default_value = 1
    a.mats["feuillage"] = mat
    for index, at in enumerate(((-12, 61, 0), (12, 58, 0))):
        p = Piece("arbre_place_" + str(index), a.mats, "arbre en jardinière ; couronne au-dessus de 3 m")
        p.box((-1.75, -1.75, 0), (3.5, 3.5, .35), "ardoise", True)
        p.box((-1.55, -1.55, .35), (3.1, 3.1, .08), "bois")
        for x in (-1.78, 1.48):
            p.box((x, -1.78, .35), (.3, 3.56, .14), "ivoire")
        for y in (-1.78, 1.48):
            p.box((-1.48, y, .35), (2.96, .3, .14), "ivoire")
        p.beam((0, 0, .4), (.15, .1, 3.8), .32, "bois")
        p.proxy((-.2, -.2, .4), (.55, .55, 3.4))
        for i, center in enumerate(((-.8, -.25, 4.2), (.85, .25, 4.7), (.1, .1, 5.5))):
            p.beam((.08, 0, 2.8), center, .16, "bois")
            vertices = []
            for ring in range(5):
                latitude = -.5 * math.pi + (ring + .12) / 4.24 * math.pi
                for side in range(10):
                    longitude = side * math.tau / 10
                    radius = 1.6 + .14 * math.sin(side * 7 + ring * 3 + i)
                    vertices.append((center[0] + radius * math.cos(latitude) * math.cos(longitude),
                                     center[1] + radius * math.cos(latitude) * math.sin(longitude),
                                     center[2] + 1.3 * math.sin(latitude)))
            faces = [(r * 10 + j, r * 10 + (j + 1) % 10, (r + 1) * 10 + (j + 1) % 10, (r + 1) * 10 + j)
                     for r in range(4) for j in range(10)]
            for start, reverse in ((0, True), (40, False)):
                for j in range(1, 9):
                    face = (start, start + j, start + j + 1)
                    faces.append(tuple(reversed(face)) if reverse else face)
            p.mesh(vertices, faces, "feuillage")
        install(a, p, at)


def fountain(a):
    p = Piece("fontaine_place", a.mats, "fontaine sèche octogonale, diamètre 4,8 m ; repère bas")
    p.cylinder((0, 0, .1), 2.4, .2, "ardoise", sides=8)
    p.cylinder((0, 0, .23), 2.1, .12, "nuit", sides=8)
    vertices = [(r * math.cos(i * math.tau / 8), r * math.sin(i * math.tau / 8), z)
                for z, r in ((.2, 2.4), (.2, 2.05), (.65, 2.4), (.65, 2.05)) for i in range(8)]
    faces = []
    for i in range(8):
        j = (i + 1) % 8
        faces.extend(((i, j, j + 16, i + 16), (i + 8, i + 24, j + 24, j + 8),
                      (i + 16, j + 16, j + 24, i + 24), (i, i + 8, j + 8, j)))
    p.mesh(vertices, faces, "ivoire")
    p.proxy((-2.25, -2.25, 0), (4.5, 4.5, .65))
    p.cylinder((0, 0, .45), .65, .5, "ardoise", sides=8)
    p.cylinder((0, 0, 1.14), .32, .9, "ivoire", sides=8)
    p.cylinder((0, 0, 1.66), .85, .17, "ivoire", sides=8)
    p.cylinder((0, 0, 1.79), .72, .12, "nuit", sides=8)
    p.proxy((-.35, -.35, .65), (.7, .7, 1.2))
    install(a, p, (-2.5, 56, 0))


def terrace(a):
    for index, at in enumerate(((-15.5, 45, 0), (-15.5, 48, 0), (-12.5, 46.5, 0))):
        p = Piece("table_cafe_" + str(index), a.mats, "guéridon et deux chaises, bordure ouest")
        p.cylinder((0, 0, .75), .48, .08, "ivoire")
        p.cylinder((0, 0, .35), .06, .7)
        p.cylinder((0, 0, .05), .27, .08)
        p.proxy((-.48, -.48, 0), (.96, .96, .8))
        for x in (-1, 1):
            p.box((x - .23, -.23, .43), (.46, .46, .05), "bois")
            for dx in (-.2, .17):
                for y in (-.2, .17):
                    p.box((x + dx, y, 0), (.035, .035, .43), "acier")
            p.box((x + (-.25 if x < 0 else .2), -.23, .48), (.05, .46, .44), "petrole")
            p.proxy((x - .25, -.25, 0), (.5, .5, .9))
        install(a, p, at)


def bus_stop(a):
    a.place("abribus_4m", (-5.65, 28, 0), math.pi / 2)
    a.box("arret_bus_poteau", (-6.1, 33.4, 0), (.08, .08, 2.8), "acier")
    a.box("arret_bus_panneau", (-6.15, 33.15, 2.2), (.15, .75, .6), "petrole", False)
    a.letters("BUS 24", (-5.97, 33.52, 2.42), .18, angle=math.pi / 2)
    # see: docs/4-technique/pilote-quartier.md#composition-de-la-place
    for y in range(28, 34):
        a.box("arret_marque_" + str(y), (-5.4, y, -.247), (.12, .65, .004), "ambre", False)
    for x in (-4, -2, 0, 2, 4):
        a.box("passage_pieton_" + str(x), (x - .55, 39.15, -.247), (1.1, .55, .004), "ivoire", False)
