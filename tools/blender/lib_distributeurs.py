"""Distributeurs statiques et cassables : une façade, un mesh, un matériau."""
import math
from pathlib import Path

import bpy

from mathutils import Matrix, Vector

from atlas_mesh import mesh
import lib_helpers as H

FACADES = ("soda_5g_cola", "chips_illumi", "cafe_reveille")


def machine(name, facade, coll):
    if facade not in FACADES:
        raise ValueError(f"Façade de distributeur inconnue : {facade}")
    front = "-y"

    def swatch(i):
        u = (i + .5) / 8
        return u, u, .02, .02

    def crop(x0, y0, x1, y1):
        return x0 / 128, x1 / 128, 1 - y1 / 256, 1 - y0 / 256

    pieces = []

    def piece(bounds, rect):
        pieces.append((bounds, rect, front))

    piece((0, .12, .06, .90, .75, 1.90), swatch(0))
    piece((.025, .065, .14, .875, .12, 1.84), (0, 1, .0625, 1))
    # Bandeau, vitrage et trappe avancent devant le caisson.
    piece((.078, .045, 1.51, .822, .065, 1.78), crop(8, 8, 120, 41))
    piece((.091, .050, .534, .596, .065, 1.457), crop(10, 54, 87, 187))
    piece((.118, 0, .168, .756, .065, .443), crop(14, 200, 111, 238))
    for row in range(4):
        y0, y1 = 90 + row * 17, 103 + row * 17
        z0 = .14 + (244 - y1) / 240 * 1.70
        z1 = .14 + (244 - y0) / 240 * 1.70
        piece((.656, .02, z0, .795, .065, z1), crop(95, y0, 116, y1))
    piece((.669, .026, .655, .789, .065, .690), swatch(1))
    piece((.707, .02, .547, .795, .065, .620), swatch(2))
    for x in (.055, .735):
        piece((x, .09, 0, x + .11, .70, .06), swatch(1))
    if facade == "cafe_reveille":
        piece((.320, .029, .823, .387, .050, .922), swatch(2))
        piece((.267, .018, .664, .407, .050, .793), swatch(3))
        piece((.407, .023, .697, .438, .050, .757), swatch(3))
        piece((.225, 0, .623, .475, .065, .650), swatch(2))
    obj = mesh(name, pieces, f"prd_distributeur_{facade}", coll)
    nodes = obj.data.materials[0].node_tree
    bsdf = next(n for n in nodes.nodes if n.type == "BSDF_PRINCIPLED")
    emission = nodes.nodes.get("vending_emission") or nodes.nodes.new("ShaderNodeTexImage")
    emission.name = "vending_emission"
    emission.image = bpy.data.images.load(str(Path(H.TEX_DIR) / f"prd_distributeur_{facade}_emission.png"),
                                          check_existing=True)
    emission.interpolation = "Closest"
    nodes.links.new(emission.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = .55
    return obj


def fit(obj, bounds, front="-y"):
    """Pose dans l'encombrement existant, sans agrandir le collider du prop."""
    angle = math.radians({"-y": 0, "+y": 180, "-x": 270, "+x": 90}[front])
    rotation = Matrix.Rotation(angle, 3, "Z")
    points = [rotation @ v.co for v in obj.data.vertices]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    for vertex, point in zip(obj.data.vertices, points):
        vertex.co = Vector(tuple(bounds[i] + (point[i] - low[i]) / (high[i] - low[i])
                                 * (bounds[i + 3] - bounds[i]) for i in range(3)))
    obj.data.update()
    return obj


def prop(name, bounds, facade, coll, front="-y", *, masse=70, pv=30, contenu):
    obj = fit(machine(f"prop_{name}", facade, coll), bounds, front)
    for key, value in dict(masse=masse, pv=pv, matiere="electronique", contenu=contenu).items():
        obj[key] = value
    return obj
