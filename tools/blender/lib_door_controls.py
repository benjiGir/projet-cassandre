"""Commandes murales et distributeur coulissant, partagés par le build et Cassandre."""
import math

import bmesh
from mathutils import Vector

import lib_helpers as H
from atlas_mesh import mesh as _mesh, center as _center

FRAMES = {
    "-y": (Vector((1, 0, 0)), Vector((0, -1, 0))),
    "+y": (Vector((-1, 0, 0)), Vector((0, 1, 0))),
    "-x": (Vector((0, -1, 0)), Vector((-1, 0, 0))),
    "+x": (Vector((0, 1, 0)), Vector((1, 0, 0))),
}


def _swatch(i):
    u, v = (i + .5) / 8, .125
    return (u, u, v, v)


def control(name, center, front, coll, *, card=None, target, message=None):
    u, d = FRAMES[front]
    origin = Vector(center)

    def bounds(u0, d0, z0, u1, d1, z1):
        a = origin + u * u0 + d * d0 + Vector((0, 0, z0))
        b = origin + u * u1 + d * d1 + Vector((0, 0, z1))
        return tuple(min(a[i], b[i]) for i in range(3)) + tuple(max(a[i], b[i]) for i in range(3))

    index = {"argent": 0, "or": 1, "platine": 2, None: 3}[card]
    u0, vtop = (index % 2) / 2, 1 - (index // 2) * .375
    u1, vbot = u0 + .5, vtop - .375
    pieces = [
        (bounds(-.21, -.04, -.32, .21, .05, .32), _swatch(1), front),
        (bounds(-.19, .05, -.30, .19, .09, .30), (u0, u1, vbot, vtop), front),
        (bounds(-.16, .09, .165, .16, .105, .27), (u0 + .05, u1 - .05, vtop - .09375, vtop - .0234375), front),
    ]
    if card:
        pieces.append((bounds(-.12, .09, -.13, .12, .135, -.085), _swatch(4), front))
        pieces.append((bounds(-.10, .135, -.102, .10, .14, -.094), _swatch(2), front))
    obj = _mesh(name, pieces, "prd_commandes", coll)
    if card is None:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        layer = bm.loops.layers.uv.verify()
        rings = []
        for depth, radius in ((.095, .128), (.145, .128), (.16, .10)):
            rings.append([bm.verts.new(origin + u * (math.cos(i * math.tau / 12) * radius)
                                      + d * depth + Vector((0, 0, -.045 + math.sin(i * math.tau / 12) * radius)))
                          for i in range(12)])
        for a, b in zip(rings, rings[1:]):
            for i in range(12):
                face = bm.faces.new((a[i], a[(i + 1) % 12], b[(i + 1) % 12], b[i]))
                for loop in face.loops:
                    loop[layer].uv = (.3125, .125)
        face = bm.faces.new(rings[-1])
        for loop in face.loops:
            loop[layer].uv = (.6875, .125)
        bm.normal_update()
        bm.to_mesh(obj.data)
        bm.free()
    _center(obj, center)
    obj["target"] = target
    if card:
        obj["requires"] = card
    if message:
        obj["message"] = message
    return obj


def secret_vending(props, logic):
    front = "-y"
    red, dark, metal = [(u, u, .02, .02) for u in (.125, .375, .625)]
    pieces = [
        ((35.70, 19.16, .08, 37.30, 20.27, 2.26), red, front),
        ((35.75, 19.10, .16, 37.25, 19.16, 2.22), (0, 1, .0625, 1), front),
        ((35.82, 19.04, .25, 37.18, 19.10, .57), dark, front),
        ((36.90, 19.04, 1.26, 37.14, 19.10, 1.33), dark, front),
        ((35.84, 19.20, .01, 36.01, 20.18, .08), dark, front),
        ((36.99, 19.20, .01, 37.16, 20.18, .08), dark, front),
    ]
    door = _mesh("door_secret_vmc", pieces, "prd_distributeur_secret", props)
    _center(door)
    for key, value in dict(mouvement="coulisse", sens="+", course=1.8, duree=1.1, referme=False).items():
        door[key] = value
    use = _mesh("use_grille_vmc", [((36.93, 19.025, 1.17, 37.14, 19.04, 1.25), metal, front)],
                "prd_distributeur_secret", logic)
    _center(use, (37.0, 19.0, 1.25))
    use["target"] = door.name
    use["message"] = "Le distributeur glisse : un local technique est caché derrière."
    # Traces du déplacement : un indice discret, sans pancarte « secret ».
    H.boxes("ca_secret_traces", [((35.90, 19.45, .003, 38.96, 19.47, .006), "aplat:#605c58"),
                                  ((35.90, 19.89, .003, 38.96, 19.91, .006), "aplat:#605c58")],
            "palette", props, subdiv=1e9)
    return door
