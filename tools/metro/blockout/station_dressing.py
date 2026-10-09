"""Mobilier public adossé, composé dans le build métro via cassandre_cli.

see: docs/assets/board-metro.md#1-direction-validée
"""
import math

from tools.metro.blockout.layout import QUAI_Z
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


def extrude_profile(p, x0, width, contour, material):
    vertices = [(x, y, z) for x in (x0, x0 + width) for y, z in contour]
    n = len(contour)
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    p.mesh(vertices, faces, material)


def ticket_terminal(a, name, origin, angle):
    p = Piece('n5_billets_terminal_' + name, a.mats,
              'borne de billets à tête inclinée, écran, pavé, monnayeur et réceptacle ; face -Y')
    p.box((.13, -.58, 0), (.9, .55, .13), 'acier')
    extrude_profile(p, .08, 1,
                    ((-.64, .13), (-.62, .92), (-.76, 1.13), (-.61, 1.94),
                     (-.5, 2.06), (-.04, 2.06), (0, .13)), 'petrole')
    p.proxy((.08, -.76, 0), (1, .76, 2.06))
    p.box((.17, -.635, .22), (.82, .025, .53), 'acier')
    p.box((.35, -.67, .45), (.46, .045, .18), 'nuit')
    p.box((.34, -.74, .44), (.48, .12, .055), 'acier')
    p.box((.19, -.04, 2.015), (.78, .04, .035), 'ivoire')

    def face(x, z, w, h, material, offset=0):
        front = lambda high: -.76 + (high - 1.13) * .15 / .81 - .012 - offset
        vertices = [(x, front(z), z), (x + w, front(z), z),
                    (x + w, front(z + h), z + h), (x, front(z + h), z + h)]
        p.mesh(vertices, [(0, 1, 2, 3)], material)

    face(.18, 1.49, .8, .4, 'acier')
    face(.22, 1.525, .72, .33, 'nuit', .015)
    face(.27, 1.735, .5, .045, 'ivoire', .019)
    face(.27, 1.625, .28, .065, 'petrole', .019)
    face(.6, 1.625, .28, .065, 'ambre', .019)
    face(.17, 1.19, .47, .23, 'acier')
    for row in range(3):
        for col in range(3):
            face(.2 + col * .14, 1.21 + row * .065, .1, .045, 'ivoire', .015)
    face(.77, 1.21, .045, .18, 'nuit', .02)
    face(.7, 1.4, .23, .035, 'ivoire', .02)
    p.text('BILLETS', (.58, -.78, 1.02), .13, 'ivoire')
    install(a, p, origin, angle)


def route_map(a, name, origin, angle=0, compact=False):
    p = Piece('n5_plan_reseau_' + name, a.mats,
              'cadre mural peu profond et graphique original à deux branches, sans marque réelle')
    width = 1.9 if compact else 2.55
    p.box((0, -.11, .96), (width, .1, 1.67), 'acier')
    for x in (.16, width - .23):
        for z in (1.1, 2.39):
            p.box((x, -.015, z), (.07, .035, .07), 'acier')
    p.box((.09, -.135, 1.05), (width - .18, .035, 1.49), 'ivoire')
    for x in (.04, width - .1):
        p.box((x, -.16, 1), (.06, .055, 1.58), 'petrole')
    p.box((.1, -.16, 2.48), (width - .2, .055, .08), 'petrole')
    p.text('PLAN', (width / 2, -.179, 2.29), .17, 'petrole')
    main = ((.3, 1.42), (.75, 1.42), (1.07, 1.73), (width - .3, 1.73))
    branch = ((.48, 1.98), (.92, 1.98), (1.19, 1.73))
    for points, material in ((main, 'petrole'), (branch, 'ambre')):
        for (x0, z0), (x1, z1) in zip(points, points[1:]):
            p.beam((x0, -.185, z0), (x1, -.185, z1), .047, material)
        for x, z in points:
            p.cylinder((x, -.212, z), .07, .024, material, axis='Y', sides=8)
            p.cylinder((x, -.23, z), .033, .015, 'ivoire', axis='Y', sides=8)
    p.box((.28, -.178, 1.19), (.3, .02, .03), 'petrole')
    p.box((.71, -.178, 1.19), (.5, .02, .03), 'acier')
    install(a, p, origin, angle)


def seating(a, name, origin, angle, count=3, wood=False):
    p = Piece('n5_assises_' + name, a.mats,
              'coques séparées inclinées, traverse porteuse et pieds dégagés ; face -Y')
    width = .72 * count
    p.box((.09, -.3, .34), (width - .18, .1, .1), 'acier')
    for x in (.22, width - .32):
        p.box((x, -.34, .06), (.11, .14, .35), 'acier')
        p.box((x - .15, -.61, .025), (.41, .58, .05), 'acier')
    for i in range(count):
        x = .04 + i * .72
        material = 'bois' if wood else ('petrole' if i != 1 else 'acier')
        extrude_profile(p, x, .64,
                        ((-.71, .47), (-.7, .54), (-.21, .56), (-.15, .5)), material)
        extrude_profile(p, x, .64,
                        ((-.21, .52), (-.12, 1.03), (-.03, 1.07), (.025, 1.02), (-.12, .5)), material)
        if wood:
            for y in (-.6, -.43):
                p.box((x, y, .548), (.64, .016, .01), 'nuit')
        for z in (.67, .86):
            p.beam((x + .13, -.15 + (z - .52) * .176, z),
                   (x + .51, -.15 + (z - .52) * .176, z), .025, 'acier')
    for x in (0, width - .045):
        p.beam((x + .022, -.45, .5), (x + .022, -.4, .76), .045, 'acier')
        p.beam((x + .022, -.58, .75), (x + .022, -.13, .75), .05, 'acier')
    p.proxy((0, -.72, 0), (width, .78, 1.07))
    install(a, p, origin, angle)


def waste_bin(a, name, origin, angle=0):
    p = Piece('n5_corbeille_' + name, a.mats,
              'corbeille octogonale ouverte, collerette distincte et fond sombre visible')
    sides = 8
    rings = ((.07, .2), (.84, .27), (.91, .29), (.91, .21), (.25, .18))
    vertices = [(r * math.cos(i * math.tau / sides),
                 r * math.sin(i * math.tau / sides), z)
                for z, r in rings for i in range(sides)]
    for ring, material in ((0, 'petrole'), (1, 'acier'), (2, 'acier'), (3, 'nuit')):
        faces = [(ring * sides + i, ring * sides + (i + 1) % sides,
                  (ring + 1) * sides + (i + 1) % sides, (ring + 1) * sides + i)
                 for i in range(sides)]
        p.mesh(vertices, faces, material)
    p.cylinder((0, 0, .26), .19, .025, 'nuit', sides=8)
    p.cylinder((0, 0, .045), .24, .07, 'acier', sides=8)
    for i in range(0, sides, 2):
        t = i * math.tau / sides
        p.beam((.2 * math.cos(t), .2 * math.sin(t), .1),
               (.27 * math.cos(t), .27 * math.sin(t), .83), .035, 'acier')
    p.proxy((-.29, -.29, 0), (.58, .58, .91))
    install(a, p, origin, angle)


def service_bank(a, name, origin, angle):
    p = Piece('n5_quai_entretien_' + name, a.mats,
              'armoire murale, coffret et conduits fixés, hors allée du quai')
    p.box((0, -.39, .15), (.85, .36, 1.43), 'acier')
    p.box((.07, -.425, .24), (.71, .035, 1.24), 'petrole')
    for x in (.12, .66):
        for z in (.35, 1.35):
            p.box((x, -.04, z), (.07, .06, .1), 'acier')
    p.box((.64, -.46, .86), (.06, .06, .17), 'ivoire')
    for z in (.31, .43, .55):
        p.box((.14, -.47, z), (.4, .028, .042), 'nuit')
    p.box((1.16, -.18, 1.08), (.46, .15, .57), 'acier')
    p.box((1.21, -.205, 1.15), (.36, .035, .42), 'petrole')
    for x in (1.19, 1.52):
        p.box((x, -.035, 1.35), (.07, .055, .12), 'acier')
    for x in (.34, .55, 1.35):
        p.beam((x, -.09, 1.62), (x, -.09, 2.62), .055, 'acier')
        for z in (1.9, 2.4):
            p.box((x - .065, -.12, z), (.13, .14, .065), 'acier')
    p.beam((.34, -.09, 2.62), (1.62, -.09, 2.62), .07, 'acier')
    for x in (.5, 1.5):
        p.box((x - .055, -.12, 2.58), (.11, .14, .08), 'acier')
    p.proxy((0, -.43, 0), (.85, .43, 1.58))
    install(a, p, origin, angle)


def build(a):
    ticket_terminal(a, 'hall_1', (-17.75, 85.5, -5), math.pi / 2)
    ticket_terminal(a, 'hall_2', (-17.75, 87.25, -5), math.pi / 2)
    route_map(a, 'hall', (-17.98, 90, -5), math.pi / 2)
    seating(a, 'hall', (-17.7, 94, -5), math.pi / 2, count=2, wood=True)
    waste_bin(a, 'hall', (-17.15, 93.2, -5))

    for name, y, count, wood in (('ouest_sud', 125.5, 3, False),
                                ('ouest_centre', 143.5, 2, True),
                                ('ouest_nord', 160.5, 3, False)):
        seating(a, name, (-8.85, y, QUAI_Z), math.pi / 2, count, wood)
    route_map(a, 'ouest_sud', (-8.98, 128.2, QUAI_Z), math.pi / 2, compact=True)
    route_map(a, 'ouest_nord', (-8.98, 163.2, QUAI_Z), math.pi / 2, compact=True)
    waste_bin(a, 'ouest_centre', (-8.45, 146, QUAI_Z))
    service_bank(a, 'ouest_nord', (-8.98, 181.2, QUAI_Z), math.pi / 2)

    seating(a, 'est_sud', (8.85, 143.2, QUAI_Z), -math.pi / 2, 3, True)
    seating(a, 'est_centre', (8.85, 160.2, QUAI_Z), -math.pi / 2, 2)
    seating(a, 'est_nord', (8.85, 181.2, QUAI_Z), -math.pi / 2, 3)
    route_map(a, 'est_centre', (8.98, 156.2, QUAI_Z), -math.pi / 2, compact=True)
    waste_bin(a, 'est_sud', (8.45, 144.3, QUAI_Z))
