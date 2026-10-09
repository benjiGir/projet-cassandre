"""Guichet et validation ouverte dans la billetterie N5.

see: docs/assets/board-metro.md#1-direction-validée
"""
import math

from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


FLOOR = -5
GATE_Y = 98.5
GATE_WIDTH = .5
GATE_LENGTH = 1.65
GATE_X = (-10.5, -8.25, -5.25, -3.5, -1.75)


def ticket_office(a):
    p = Piece('n5_guichet', a.mats, 'comptoir vitré, bureau et accès staff depuis arrière-guichet')
    p.box((10, 84.3, FLOOR), (.18, 5.45, .95), 'petrole')
    p.proxy((9.96, 84.3, FLOOR), (.22, 5.45, 2.75))
    p.box((9.7, 84.5, FLOOR + .95), (1.45, 5.05, .13), 'acier', True)
    for y in (84.3, 86.95, 89.55):
        p.box((9.96, y, FLOOR + 1.08), (.22, .2, 1.67), 'acier')
    for y, length in ((84.5, 2.45), (87.15, 2.4)):
        p.box((10.015, y, FLOOR + 1.14), (.035, length, 1.5), 'verre')
    for z in (1.08, 2.64):
        p.box((9.96, 84.5, FLOOR + z), (.22, 5.05, .1), 'acier')
    p.box((9.96, 84.3, FLOOR + 2.75), (.22, 5.45, .25), 'petrole')
    for x, width in ((10, 5.5), (17.8, .2)):
        p.box((x, 89.55, FLOOR), (width, .2, .95), 'petrole')
        p.proxy((x, 89.55, FLOOR), (width, .2, 3))
        for z in (.95, 2.66):
            p.box((x, 89.55, FLOOR + z), (width, .2, .1), 'acier')
    for x in (10, 12.7, 15.3, 17.8):
        p.box((x, 89.55, FLOOR + .95), (.2, .2, 2.05), 'acier')
    for x in (10.2, 12.9):
        p.box((x, 89.63, FLOOR + 1.08), (2.5 if x == 10.2 else 2.4, .035, 1.58), 'verre')
    p.box((10, 89.55, FLOOR + 2.75), (8, .2, .25), 'petrole', True)
    p.box((15.62, 89.43, FLOOR + 2.78), (2.06, .1, .075), 'lampe')
    p.box((9.7, 84.3, FLOOR + 3), (8.3, 5.65, .14), 'ivoire')
    p.box((9.85, 84.9, FLOOR + 2.9), (.1, 4.35, .035), 'ivoire')
    a.letters('GUICHET', (9.84, 87.075, FLOOR + 2.81), .19, angle=-math.pi / 2)

    p.box((11.5, 85.55, FLOOR + .77), (1.05, 2.8, .12), 'bois', True)
    for y in (85.65, 88.05):
        p.box((11.64, y, FLOOR), (.74, .16, .77), 'acier', True)
    p.box((11.7, 86.4, FLOOR + .89), (.36, .68, .04), 'acier')
    p.box((11.83, 86.66, FLOOR + .93), (.08, .15, .23), 'acier')
    p.box((11.73, 86.35, FLOOR + 1.16), (.14, .78, .53), 'acier')
    p.box((11.88, 86.43, FLOOR + 1.23), (.015, .62, .36), 'nuit')
    for y in (86.55, 86.69, 86.83):
        p.box((11.9, y, FLOOR + 1.4), (.008, .36, .025), 'petrole')
    p.box((12.85, 86.55, FLOOR + .43), (.6, .6, .12), 'petrole', True)
    p.box((13.39, 86.55, FLOOR + .48), (.1, .6, .68), 'petrole')
    for x in (12.9, 13.3):
        for y in (86.6, 87):
            p.box((x, y, FLOOR), (.07, .07, .43), 'acier')
    p.box((10.02, 87.75, FLOOR + 1.084), (.42, .5, .025), 'ivoire')
    for y in (87.81, 87.9, 87.99):
        p.box((10.04, y, FLOOR + 1.112), (.3, .025, .005), 'acier')
    p.box((9.92, 86.4, FLOOR + 1.52), (.065, .27, .3), 'acier')
    for z in (1.58, 1.65, 1.72):
        p.box((9.907, 86.45, FLOOR + z), (.012, .17, .025), 'nuit')
    p.box((14, 89.05, FLOOR), (1.2, .48, 2.2), 'acier', True)
    p.box((14.09, 89.01, FLOOR + .08), (1.02, .04, 2.04), 'petrole')
    p.box((14.87, 88.95, FLOOR + .95), (.06, .07, .25), 'ivoire')
    p.box((12.7, 85.45, FLOOR + 2.84), (.24, 2.1, .14), 'acier')
    p.box((12.75, 85.55, FLOOR + 2.81), (.14, 1.9, .03), 'lampe')
    p.beam((12.82, 85.75, FLOOR + 2.98), (12.82, 85.75, FLOOR + 3), .045, 'acier')
    p.beam((12.82, 87.25, FLOOR + 2.98), (12.82, 87.25, FLOOR + 3), .045, 'acier')
    a.point('n5_guichet_interieur', (12.9, 86.5, FLOOR + 2.65), '#d1d9c2', 9, 9)
    install(a, p, (0, 0, 0))


def gate_body(p, x):
    y = GATE_Y
    width, length = GATE_WIDTH, GATE_LENGTH
    contour = ((x + .12, y), (x + width - .12, y), (x + width, y + .16),
               (x + width, y + length - .16), (x + width - .12, y + length),
               (x + .12, y + length), (x, y + length - .16), (x, y + .16))
    vertices = [(xx, yy, FLOOR + z) for z in (.1, 1.05) for xx, yy in contour]
    count = len(contour)
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    p.mesh(vertices, faces, 'acier')
    p.proxy((x, y, FLOOR), (width, length, 1.05))
    p.box((x + .06, y + .06, FLOOR), (width - .12, length - .12, .1), 'petrole')
    p.box((x + .07, y + .13, FLOOR + 1.055), (.36, .52, .018), 'petrole')
    p.box((x + .12, y + .23, FLOOR + 1.075), (.26, .23, .012), 'nuit')
    p.box((x + .145, y + .265, FLOOR + 1.09), (.21, .035, .008), 'ivoire')
    p.box((x + .145, y + .37, FLOOR + 1.09), (.21, .035, .008), 'ivoire')
    p.box((x + .14, y - .02, FLOOR + .81), (.22, .035, .075), 'petrole')
    for xx in (x + .012, x + width - .04):
        p.box((xx, y + .75, FLOOR + .2), (.028, .8, .66), 'verre')
        p.box((xx, y + .74, FLOOR + .82), (.028, .81, .04), 'acier')
    for yy in (y + .18, y + length - .18):
        p.box((x + .18, yy, FLOOR + .025), (.14, .08, .025), 'ivoire')


def side_barrier(p, x0, x1):
    y, length = GATE_Y + .75, x1 - x0
    p.proxy((x0, y - .055, FLOOR), (length, .11, 1.5))
    count = math.ceil(length / 2.5)
    for i in range(count + 1):
        x = x0 + length * i / count
        p.box((x - .045, y - .045, FLOOR), (.09, .09, 1.5), 'acier')
        p.box((x - .11, y - .11, FLOOR), (.22, .22, .05), 'acier')
    for i in range(count):
        x0_panel = x0 + length * i / count + .06
        x1_panel = x0 + length * (i + 1) / count - .06
        p.box((x0_panel, y - .018, FLOOR + .25), (x1_panel - x0_panel, .035, 1.14), 'verre')
    p.box((x0, y - .055, FLOOR + 1.42), (length, .11, .08), 'acier')


def validators(a):
    p = Piece('n5_portiques', a.mats, 'validation hors service, quatre passages ouverts dont un passage large de 2,50 m')
    for x in GATE_X:
        gate_body(p, x)
    side_barrier(p, -18, GATE_X[0])
    side_barrier(p, GATE_X[-1] + GATE_WIDTH, 18)
    for x in (-9.15, -6.5, -4.375, -2.625):
        for y in (GATE_Y - .35, GATE_Y + GATE_LENGTH + .3):
            p.box((x - .22, y, FLOOR + .01), (.44, .055, .008), 'ivoire')
    for x in (-9, -4):
        p.box((x - .85, 99.08, FLOOR + 3.18), (1.7, .24, .13), 'acier')
        p.box((x - .72, 99.12, FLOOR + 3.155), (1.44, .16, .025), 'lampe')
        for dx in (-.65, .65):
            p.beam((x + dx, 99.2, FLOOR + 3.31), (x + dx, 99.2, FLOOR + 3.5), .035, 'acier')
        a.point('n5_validation_' + str(x), (x, 99.2, FLOOR + 2.95), '#d1d9c2', 8, 12)
    install(a, p, (0, 0, 0))


def build(a):
    ticket_office(a)
    validators(a)
