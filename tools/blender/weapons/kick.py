"""Bottine de travail et pantalon, dans la pose d'impact du coup de pied."""
import math

import bmesh
from mathutils import Matrix, Vector

from weapons.geometry import colorer_faces, fusionner, nouveau_mesh, pave, tube

PIVOT = (.18, .65, -.22)


def sections(nom, profils, couleur):
    bm = bmesh.new()
    rings = [[bm.verts.new(point) for point in profil] for profil in profils]
    count = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(count):
            bm.faces.new((a[i], a[(i + 1) % count], b[(i + 1) % count], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return nouveau_mesh(nom, bm, couleur)


def contour(z, largeur=1):
    return [(x * largeur, y, z) for x, y in (
        (-.061, -.122), (.061, -.122), (.079, -.093), (.088, -.015),
        (.110, .095), (.112, .183), (.096, .253), (.058, .288),
        (0, .297), (-.058, .288), (-.096, .253), (-.112, .183),
        (-.110, .095), (-.088, -.015), (-.079, -.093),
    )]


def anneau(z, rx, ry, cy=-.038):
    return [(math.cos(i * math.tau / 12) * rx, cy + math.sin(i * math.tau / 12) * ry, z)
            for i in range(12)]


def pantalon(cheville):
    profils = []
    for center, width, depth in (
        ((.35, .03, -.94), .14, .13),
        ((.26, .29, -.54), .115, .10),
        (tuple(cheville), .080, .071),
    ):
        profils.append([Vector(center) + Vector((math.cos(i * math.tau / 10) * width,
                                                math.sin(i * math.tau / 10) * depth, 0))
                        for i in range(10)])
    obj = sections("kick_pantalon", profils, "#3f4b43")
    colorer_faces(obj.data, ["#4a554b" if p.normal.x < -.4 else "#303a34" if p.normal.x > .4 else "#3f4b43"
                            for p in obj.data.polygons])
    return obj


def construire_coup_de_pied():
    rotation = Matrix.Rotation(math.radians(63), 4, 'X') @ Matrix.Rotation(math.radians(29), 4, 'Z')
    origine = Vector(PIVOT)
    cheville_locale = Vector((0, -.038, .205))
    pieces = []
    pieces.append(sections("kick_semelle", [contour(.0, 1.045), contour(.027, 1.06), contour(.044, 1.025)], "#252725"))
    pieces.append(sections("kick_trépointe", [contour(.044, 1.04), contour(.058, 1.035)], "#bd996a"))
    pieces.append(pave("kick_talon", (0, -.067, -.014), (.145, .117, .035), "#1c211f"))
    for y in (-.096, -.055, .066, .119, .172, .225):
        width = .14 if y < 0 else .195 if y < .2 else .165
        pieces.append(pave("kick_crampon", (0, y, -.008), (width, .029, .022), "#353936"))
    profils = []
    for y, width, bottom, top in (
        (-.116, .050, .059, .120), (-.085, .076, .058, .162),
        (-.01, .084, .058, .164), (.07, .102, .058, .131),
        (.155, .107, .058, .117), (.235, .090, .060, .111),
        (.280, .055, .067, .098), (.295, .012, .076, .084),
    ):
        bevel = min(.023, width * .4)
        profils.append([(x, y, z) for x, z in (
            (-width + bevel, bottom), (width - bevel, bottom), (width, bottom + .02),
            (width, top - .022), (width - bevel, top - .003), (width * .45, top + .008),
            (0, top + .012), (-width * .45, top + .008), (-width + bevel, top - .003),
            (-width, top - .022), (-width, bottom + .02),
        )])
    pied = sections("kick_cuir", profils, "#976338")
    colorer_faces(pied.data, ["#b5834d" if p.normal.z > .6 else "#8e5b33" if p.normal.x > .5
                            else "#a16e41" if p.normal.x < -.5 else "#9c6b3e" for p in pied.data.polygons])
    pieces.append(pied)
    pieces.append(sections("kick_tige", [anneau(.091, .079, .081), anneau(.15, .074, .074),
                                         anneau(.184, .069, .069), anneau(.207, .075, .074)], "#85592f"))
    pieces.append(sections("kick_col_rembourré", [anneau(.195, .078, .077), anneau(.213, .079, .078),
                                                  anneau(.222, .070, .070)], "#35352e"))
    languette = [(-.043, .177, .127), (.043, .177, .127), (.038, .040, .216),
                (.029, .029, .224), (-.029, .029, .224), (-.038, .040, .216)]
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in languette])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    pieces.append(nouveau_mesh("kick_languette", bm, "#4b3424"))
    for i in range(5):
        z = .135 + i * .018
        y = .155 - i * .027
        for sign in (-1, 1):
            x = sign * (.043 - i * .001)
            pieces.append(tube("kick_oeillet", (x, y, z), (x, y + .003, z + .006), .010, "#bcae89", 8))
            pieces.append(tube("kick_trou_oeillet", (x, y + .003, z + .006), (x, y + .004, z + .008), .004, "#39332a", 6))
        if i < 4:
            for sign in (-1, 1):
                pieces.append(tube("kick_lacet_croisé", (sign * .042, y + .004, z + .009),
                                   (-sign * .041, y - .023, z + .027), .0043, "#e3d7b9", 5))
    for sign in (-1, 1):
        points = [(sign * .035, .063, .124), (sign * .069, .096, .124),
                  (sign * .080, .177, .119), (sign * .064, .236, .111), (0, .265, .104)]
        for a, b in zip(points, points[1:]):
            pieces.append(tube("kick_couture_empeigne", a, b, .0035, "#d2ae78", 4))
        pieces.append(tube("kick_couture_quartier", (sign * .078, -.036, .082),
                           (sign * .075, -.03, .199), .0025, "#bd915a", 4))
    for a, b in (((-.031, .242, .125), (-.006, .249, .125)),
                 ((.010, .254, .123), (.033, .249, .123)),
                 ((-.066, .205, .125), (-.047, .211, .127))):
        pieces.append(tube("kick_éraflure", a, b, .0025, "#c39a6b", 4))
    pieces.append(pave("kick_attache_arrière", (0, -.113, .195), (.033, .021, .056), "#55432e"))
    for obj in pieces:
        for vertex in obj.data.vertices:
            vertex.co = origine + rotation @ ((vertex.co - cheville_locale) * 1.10)
    cheville = origine + rotation @ ((Vector((0, -.038, .218)) - cheville_locale) * 1.10)
    pieces.append(pantalon(cheville))
    obj = fusionner("vm_kick", pieces)
    obj["prise"] = [PIVOT[0], PIVOT[2], -PIVOT[1]]
    return obj
