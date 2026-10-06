import math

import bpy
import bmesh
from mathutils import Matrix, Vector

def srgb_lineaire(h: str) -> tuple[float, float, float, float]:
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (lin[0], lin[1], lin[2], 1.0)


# --- Géométrie par code ------------------------------------------------------


def nouveau_mesh(nom: str, bm: bmesh.types.BMesh, couleur: str) -> bpy.types.Object:
    """Mesh plat (normales par face) dont TOUTES les faces portent `couleur`
    en attribut de coin `Col`."""
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    teindre(me, couleur)
    ob = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def teindre(me: bpy.types.Mesh, couleur: str):
    attr = me.color_attributes.get("Col") or me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    rgba = srgb_lineaire(couleur)
    for d in attr.data:
        d.color = rgba
    me.color_attributes.active_color = attr


def pave(nom: str, centre, taille, couleur: str) -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(taille), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(centre), verts=bm.verts)
    return nouveau_mesh(nom, bm, couleur)


def tube(nom: str, debut, fin, rayon: float, couleur: str, cotes: int = 6) -> bpy.types.Object:
    """Cylindre à `cotes` faces entre deux points — 6 suffisent à 640×360."""
    a, b = Vector(debut), Vector(fin)
    axe = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=cotes, radius1=rayon, radius2=rayon, depth=axe.length)
    rot = Vector((0, 0, 1)).rotation_difference(axe.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=bm.verts)
    return nouveau_mesh(nom, bm, couleur)


def balayage(nom: str, chemin: list[Vector], largeur: float, epaisseur: float, couleur: str,
             normale=Vector((1, 0, 0))) -> bpy.types.Object:
    """Section rectangulaire balayée le long d'un chemin plan (normale fixe)."""
    bm = bmesh.new()
    anneaux = []
    for i, p in enumerate(chemin):
        t = (chemin[min(i + 1, len(chemin) - 1)] - chemin[max(i - 1, 0)]).normalized()
        cote = normale.cross(t).normalized()
        n = normale
        coins = [p + n * (largeur / 2) * sx + cote * (epaisseur / 2) * sy for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
        anneaux.append([bm.verts.new(c) for c in coins])
    for r0, r1 in zip(anneaux, anneaux[1:]):
        for k in range(4):
            bm.faces.new((r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k]))
    bm.faces.new(list(reversed(anneaux[0])))
    bm.faces.new(anneaux[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return nouveau_mesh(nom, bm, couleur)


def colorer_faces(me: bpy.types.Mesh, couleurs: list[str]):
    """Une couleur hex par polygone, même ordre que `me.polygons` (donc même
    ordre que les `bm.faces.new(...)` qui ont produit le mesh)."""
    attr = me.color_attributes.get("Col") or me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for p, couleur in zip(me.polygons, couleurs):
        rgba = srgb_lineaire(couleur)
        for li in p.loop_indices:
            attr.data[li].color = rgba
    me.color_attributes.active_color = attr


def prisme(nom: str, y0: float, y1: float, profil: list[tuple[float, float]], couleurs: list[str]) -> bpy.types.Object:
    """Prisme à profil polygonal (X, Z) constant, balayé le long de Y entre
    `y0` et `y1`, avec deux capuchons. `couleurs` : une couleur par face
    latérale (face i entre `profil[i]` et `profil[i+1]`), puis le capuchon de
    `y0` et celui de `y1` — `len(profil) + 2` couleurs."""
    n = len(profil)
    bm = bmesh.new()
    a0 = [bm.verts.new((x, y0, z)) for x, z in profil]
    a1 = [bm.verts.new((x, y1, z)) for x, z in profil]
    for k in range(n):
        bm.faces.new((a0[k], a0[(k + 1) % n], a1[(k + 1) % n], a1[k]))
    bm.faces.new(list(reversed(a0)))
    bm.faces.new(a1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    colorer_faces(me, couleurs)
    ob = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def fusionner(nom: str, pieces: list[bpy.types.Object]) -> bpy.types.Object:
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for p in pieces:
        p.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    pieces[0].name = nom
    pieces[0].data.name = nom
    return pieces[0]


def profil_lateral(nom, profil, largeur, couleur):
    bm = bmesh.new()
    anneaux = [[bm.verts.new((x, y, z)) for y, z in profil] for x in (-largeur / 2, largeur / 2)]
    n = len(profil)
    for i in range(n):
        bm.faces.new((anneaux[0][i], anneaux[0][(i + 1) % n], anneaux[1][(i + 1) % n], anneaux[1][i]))
    bm.faces.new(list(reversed(anneaux[0])))
    bm.faces.new(anneaux[1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return nouveau_mesh(nom, bm, couleur)


def section_chanfreinee(largeur, bas, haut, biseau):
    w = largeur / 2
    return [(-w + biseau, bas), (w - biseau, bas), (w, bas + biseau),
            (w, haut - biseau), (w - biseau, haut), (-w + biseau, haut),
            (-w, haut - biseau), (-w, bas + biseau)]


def biseauter(ob, largeur, segments=1):
    mod = ob.modifiers.new("biseaux", "BEVEL")
    mod.width = largeur
    mod.segments = segments
    mod.affect = "EDGES"
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


def peindre_eclairage(ob, dessus, flanc, dessous):
    colorer_faces(ob.data, [dessus if p.normal.z > 0.45 else dessous if p.normal.z < -0.4 else flanc
                           for p in ob.data.polygons])


def conduit(nom, debut, fin, exterieur, interieur, couleur, cotes=12):
    a, b = Vector(debut), Vector(fin)
    axe = b - a
    rot = Vector((0, 0, 1)).rotation_difference(axe.normalized()).to_matrix().to_4x4()
    m = Matrix.Translation((a + b) / 2) @ rot
    bm = bmesh.new()
    rings = []
    for z, r in [(-axe.length / 2, exterieur), (axe.length / 2, exterieur),
                 (-axe.length / 2, interieur), (axe.length / 2, interieur)]:
        rings.append([bm.verts.new(m @ Vector((r * math.cos(i * math.tau / cotes),
                                             r * math.sin(i * math.tau / cotes), z))) for i in range(cotes)])
    for i in range(cotes):
        j = (i + 1) % cotes
        for r0, r1 in [(0, 1), (2, 3), (0, 2), (1, 3)]:
            bm.faces.new((rings[r0][i], rings[r0][j], rings[r1][j], rings[r1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return nouveau_mesh(nom, bm, couleur)
