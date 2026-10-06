import math

import bmesh
from mathutils import Matrix, Vector

from weapons.config import PALETTE as P
from weapons.geometry import nouveau_mesh, peindre_eclairage, fusionner


def volume(nom, points, rayons, couleur, reference=(0, 0, 1), cotes=8):
    points = [Vector(p) for p in points]
    reference = Vector(reference)
    bm = bmesh.new()
    rings = []
    for i, (point, rayon) in enumerate(zip(points, rayons)):
        axe = (points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]).normalized()
        large = reference - axe * reference.dot(axe)
        if large.length < 0.01:
            large = axe.cross(Vector((1, 0, 0)))
        large.normalize()
        profond = axe.cross(large).normalized()
        rx, ry = rayon if isinstance(rayon, tuple) else (rayon, rayon)
        rings.append([bm.verts.new(point + large * (math.cos(a) * rx) + profond * (math.sin(a) * ry))
                      for a in [j * math.tau / cotes for j in range(cotes)]])
    for r0, r1 in zip(rings, rings[1:]):
        for j in range(cotes):
            bm.faces.new((r0[j], r0[(j + 1) % cotes], r1[(j + 1) % cotes], r1[j]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = nouveau_mesh(nom, bm, couleur)
    peindre_eclairage(ob, "#d9af8d", P["peau"], "#a87756")
    return ob


def main_poignee(role):
    pieces = [volume("paume", [(0.033, -0.053, -0.025), (0.035, -0.029, -0.018), (0.034, -0.012, 0.007)],
                     [(0.017, 0.019), (0.033, 0.019), (0.028, 0.017)], P["peau"], reference=(0, 0, 1))]
    # Les hauteurs suivent l'arc des articulations ; le petit doigt est plus court.
    for i, z in enumerate([0.026, 0.004, -0.018, -0.038]):
        longueur = [1.0, 1.04, 0.98, 0.83][i]
        if i == 0 and role in {"pistol", "shotgun"}:
            points = [(0.029, -0.010, z), (0.039, 0.026, z + 0.009),
                      (0.026, 0.054, z + 0.003), (0.008, 0.045, z - 0.002)]
        else:
            front = 0.019 + 0.70 * z if role == "pistol" else 0.004 + 0.65 * z if role == "shotgun" else 0.014
            points = [(0.031, -0.019 + z * 0.30, z), (0.037, front + 0.011 * longueur, z),
                      (0.008, front + 0.010 * longueur, z - 0.002), (-0.023, front - 0.002, z - 0.003)]
        r = 0.0092 if i < 3 else 0.008
        pieces.append(volume(f"doigt_{i}", points, [r, r * 1.08, r * 0.94, r * 0.68], P["peau"]))
    pieces.append(volume("base_pouce", [(0.030, -0.041, 0.011), (0.020, -0.025, 0.029), (0.001, -0.012, 0.039)],
                         [(0.018, 0.015), (0.015, 0.013), (0.012, 0.010)], P["peau"], reference=(0, 1, 0)))
    pieces.append(volume("pouce", [(0.005, -0.016, 0.040), (-0.019, 0.000, 0.045), (-0.021, 0.031, 0.039)],
                         [0.012, 0.011, 0.0075], P["peau"], reference=(0, 0, 1)))
    return pieces, Vector((0.033, -0.050, -0.018))


def main_support():
    pieces = [volume("paume_support", [(-0.047, -0.010, -0.025), (-0.032, 0.000, -0.033), (-0.013, 0.002, -0.031)],
                     [(0.030, 0.018), (0.039, 0.018), (0.037, 0.012)], P["peau"], reference=(0, 1, 0))]
    for i, y in enumerate([-0.035, -0.012, 0.011, 0.032]):
        r = 0.0092 if i < 3 else 0.008
        points = [(-0.038, y, -0.018), (-0.030, y, -0.035), (-0.006, y, -0.043),
                  (0.022, y, -0.032), (0.036, y, -0.006)]
        pieces.append(volume(f"doigt_support_{i}", points, [r, r * 1.07, r, r * 0.88, r * 0.65],
                             P["peau"], reference=(0, 1, 0)))
    pieces.append(volume("pouce_support", [(-0.043, -0.028, -0.023), (-0.046, -0.025, 0.004),
                         (-0.028, -0.008, 0.026), (-0.016, 0.025, 0.028)],
                         [0.015, 0.013, 0.011, 0.007], P["peau"], reference=(0, 1, 0)))
    return pieces, Vector((-0.045, -0.010, -0.028))


def construire_main(prise, poignet, role, nom):
    pieces, raccord = main_support() if role == "support" else main_poignee(role)
    local_poignet = prise.inverted() @ poignet
    milieu = local_poignet.lerp(raccord, 0.6)
    pieces.insert(0, volume("poignet", [local_poignet, milieu, raccord],
                           [(0.024, 0.024), (0.022, 0.025), (0.021, 0.023)], P["peau"], reference=(0, 0, 1)))
    main = fusionner(nom, pieces)
    main.data.transform(prise)
    main.matrix_world = Matrix.Identity(4)
    return main
