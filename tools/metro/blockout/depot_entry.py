"""Franchissement piéton de A et raccord à l'allée du dépôt.

see: docs/4-technique/blockout-metro.md#dépôt
"""
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


FLOOR = -18
DECK_TOP = .175


def crossing(p):
    y0, y1 = 324.4, 325.95
    spans = ((37.05, 38.435), (38.625, 39.875), (40.065, 42.65))
    p.proxy((37.05, y0, FLOOR), (5.6, y1-y0, DECK_TOP))
    for x0, x1 in spans:
        p.box((x0, y0, FLOOR), (x1-x0, y1-y0, DECK_TOP), 'passage_depot')
        for y in (y0+.42, y0+.84, y0+1.26):
            p.box((x0+.025, y, FLOOR+DECK_TOP+.001), (x1-x0-.05, .012, .003), 'acier')
        for y in (y0+.025, y1-.065):
            p.box((x0+.025, y, FLOOR+DECK_TOP+.002), (x1-x0-.05, .04, .005), 'ambre')
    for x0, x1, h0, h1 in ((36.45, 37.05, 0, DECK_TOP), (42.65, 43.25, DECK_TOP, 0)):
        verts = [(x, y, z) for y in (y0, y1)
                 for x, z in ((x0,FLOOR-.1),(x1,FLOOR-.1),(x1,FLOOR+h1),(x0,FLOOR+h0))]
        p.mesh(verts, [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],
               'passage_depot', collision=True)


def guards(p):
    for y in (324.22, 327.78):
        p.proxy((41.84, y-.07, FLOOR), (1.46, .14, 1.1))
        for x in (41.96, 43.18):
            p.box((x-.11, y-.11, FLOOR), (.22, .22, .055), 'acier')
            p.cylinder((x,y,FLOOR+.56), .032, 1.04, 'acier')
            for dx in (-.065, .065):
                for dy in (-.065, .065):
                    p.cylinder((x+dx,y+dy,FLOOR+.063), .016, .018, 'acier', sides=6)
        for z in (.52, 1.06):
            p.cylinder((42.57,y,FLOOR+z), .028, 1.22, 'armoire_ivoire', axis='X')
        p.cylinder((43.12,y,FLOOR+1.06), .029, .12, 'ambre', axis='X')
        p.box((41.87,y-.025,FLOOR+.08), (1.4,.05,.13), 'acier')


def portal(p):
    for y in (324.04, 327.90):
        p.box((41.697,y,FLOOR+.17), (.02,.055,2.32), 'armoire_ivoire')
        p.box((41.699,y,FLOOR+.035), (.025,.055,.13), 'ambre')
    p.box((41.72,324.75,FLOOR+2.84), (.22,2.5,.18), 'acier')
    p.box((41.943,324.9,FLOOR+2.885), (.025,2.2,.09), 'lampe')
    for y in (325,327):
        p.beam((41.6,y,FLOOR+2.7), (41.85,y,FLOOR+2.7), .045, 'acier')
        p.beam((41.85,y,FLOOR+2.7), (41.85,y,FLOOR+2.86), .045, 'acier')
    p.beam((41.8,324.83,FLOOR+3.02), (41.8,324.83,FLOOR+3.35), .035, 'acier')
    p.box((41.70,324.73,FLOOR+3.25), (.13,.20,.14), 'acier')
    p.box((41.833,324.75,FLOOR+3.265), (.012,.16,.11), 'armoire_ivoire')
    p.beam((41.70,324.83,FLOOR+3.35), (41.64,324.83,FLOOR+3.35), .035, 'acier')


def build(a):
    paint = a.mats['armoire_ivoire'].copy()
    paint.name = 'metro_passage_depot'
    paint.diffuse_color = (.24,.31,.29,1)
    paint.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = paint.diffuse_color
    a.mats['passage_depot'] = paint
    p = Piece('n5_depot_entree', a.mats, 'passage entre rails avec gorges libres, rampes et garde-corps latéraux')
    crossing(p)
    guards(p)
    portal(p)
    p.box((43.25,324.45,FLOOR+.003), (1,.04,.008), 'armoire_ivoire')
    p.box((43.25,327.70,FLOOR+.003), (1,.04,.008), 'armoire_ivoire')
    p.box((44.20,324.45,FLOOR+.003), (.05,4.05,.008), 'armoire_ivoire')
    p.box((48.25,324.45,FLOOR+.003), (.05,4.05,.008), 'armoire_ivoire')
    install(a, p, (0,0,0))
    a.point('n5_depot_sortie_a', (42.2,326,FLOOR+2.9), '#dfbf83', 8, 10)
