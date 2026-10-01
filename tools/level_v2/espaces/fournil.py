"""Fournil et ses volumes aplatis.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import geo_utils                  # noqa: E402
import lib_helpers as H           # noqa: E402
import lib_rayons as L            # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import _fournil_mesh_aplat, blobs_fournil, cylindre_aplat, lampe
from espaces.portes import _centrer_origine

def cuve_ouverte(nom: str, centre, rayon: float, z0: float, zhaut: float,
                 couleur: str, coll, segments: int = 20):
    """Cuve à paroi creuse, avec un rebord lisible depuis le dessus."""
    bm = bmesh.new()
    profil = ((rayon * 0.62, z0), (rayon * 0.90, z0 + 0.10),
              (rayon, zhaut - 0.09), (rayon * 0.96, zhaut),
              (rayon * 0.82, zhaut), (rayon * 0.55, z0 + 0.16))
    anneaux = []
    for r, zz in profil:
        anneaux.append([bm.verts.new((centre[0] + r * math.cos(2 * math.pi * i / segments),
                                      centre[1] + r * math.sin(2 * math.pi * i / segments), zz))
                        for i in range(segments)])
    for bas, haut in zip(anneaux, anneaux[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new((bas[i], bas[j], haut[j], haut[i]))
    bm.faces.new(tuple(reversed(anneaux[0])))
    bm.faces.new(anneaux[-1])
    return _fournil_mesh_aplat(nom, bm, couleur, coll)


def roulette_fournil(nom: str, x: float, y: float, z: float, coll):
    """Roue latérale en low poly, axe X, d'un chariot inox."""
    obj = cylindre_aplat(nom, (x, y), 0.095, z - 0.055, z + 0.055,
                         "#444a54", coll, segments=12)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for v in bm.verts:
        dx, dy, dz = v.co.x - x, v.co.y - y, v.co.z - z
        v.co = (x + dz, y + dy, z - dx)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


# --- Habillage B : fournil --------------------------------------------------

def habiller_fournil(space, gris, props, col_coll, logic) -> dict:
    """Ligne de production du sud vers le nord, avec une allée centrale libre."""
    z = space.z
    # Les silhouettes sont groupées par aplat pour garder peu de lots de dessin.
    inox, noir, orange = "#babcbc", "#444a54", "#e8741c"
    pieces = {c: [] for c in (inox, noir, orange, "#deb789", "#f2efe6", "#b8612e")}
    def add(c, b):
        pieces[c].append((b, f"aplat:{c}"))
    decalage_four = .8
    def add_four(c, b):
        x0, y0, z0, x1, y1, z1 = b
        add(c, (x0, y0 + decalage_four, z0, x1, y1 + decalage_four, z1))

    # Four à sole focal, sur le mur nord : quatre étages et hublots orange.
    add_four(noir, (11, 154, .2, 17, 154.85, 2.75))
    for tier in range(4):
        zz = .36 + tier * .54
        add_four(inox, (11.25, 153.92, zz, 16.75, 154.02, zz + .42))
        for door in range(4):
            xx = 11.42 + door * 1.28
            add_four(noir, (xx, 153.82, zz + .15, xx + 1.12, 153.9, zz + .38))
            add_four(orange, (xx + .43, 153.79, zz + .20, xx + .72, 153.81, zz + .31))
    add_four(inox, (11.2, 153.5, 2.9, 16.8, 154, 3.15))
    add_four(noir, (12, 153.5, 3.15, 16, 154, 3.55))

    # Pétrin à cuve ronde et deux plans contre le flanc ouest.
    add(inox, (8.8, 143, .91, 10.5, 144.3, 1.03))
    add(noir, (9.05, 143.2, .12, 10.3, 144.1, .9))
    add(noir, (8.96, 143.22, 1.03, 9.43, 144.08, 1.72))
    add(inox, (9.26, 143.57, 1.55, 9.89, 143.72, 1.64))
    add("#b8612e", (9.37, 143.52, 1.66, 9.46, 143.77, 1.78))
    cuve_ouverte("fournil_petrin_cuve", (9.87, 143.68), .47, 1.00, 1.49,
                 inox, props, segments=24)
    cylindre_aplat("fournil_petrin_pate", (9.87, 143.68), .34, 1.30, 1.35,
                    "#f2efe6", props, segments=20)
    add(inox, (9.69, 143.64, 1.34, 9.75, 143.72, 1.61))
    add(inox, (9.62, 143.59, 1.32, 9.81, 143.76, 1.37))
    for ya in (145, 149):
        add(noir, (8.45, ya, .78, 11.6, ya + 1, .9))
        for xx in (8.6, 11.2): add(inox, (xx, ya + .08, .08, xx + .14, ya + .92, .78))

    # Chambre de pousse : tournée vers l'allée, dos plaqué au mur ouest.
    # Son assemblage dédié permet de pivoter coque, porte, commande et collider
    # d'un seul tenant sans faire tourner les autres appareils du fournil.
    pousse_root = bpy.data.objects.new("grp_fournil_pousse", None)
    props.objects.link(pousse_root)
    pousse_pieces = {c: [] for c in (inox, noir)}

    def add_pousse(c, b):
        pousse_pieces[c].append((b, f"aplat:{c}"))

    def attacher_pousse(obj):
        pose_monde = obj.matrix_world.copy()
        obj.parent = pousse_root
        obj.matrix_world = pose_monde
        return obj

    add_pousse(inox, (8.55, 150.8, .10, 10.4, 152, .20))
    add_pousse(inox, (8.55, 150.8, 2.34, 10.4, 152, 2.45))
    add_pousse(inox, (8.55, 151.88, .20, 10.4, 152, 2.34))
    add_pousse(inox, (8.55, 150.82, .20, 8.68, 151.88, 2.34))
    add_pousse(inox, (10.27, 150.82, .20, 10.4, 151.88, 2.34))
    # Jambages et linteau fixes encadrent le vantail animé.
    add_pousse(inox, (8.58, 150.64, .12, 8.72, 150.82, 2.40))
    add_pousse(inox, (10.23, 150.64, .12, 10.37, 150.82, 2.40))
    add_pousse(inox, (8.72, 150.64, 2.28, 10.23, 150.82, 2.42))
    # Rails latéraux du chariot et six plateaux ouverts.
    for xx in (8.91, 9.98):
        add_pousse(inox, (xx, 151.02, .28, xx + .045, 151.68, 2.12))
    for level in range(7):
        zz = .36 + level * .245
        add_pousse(noir, (8.94, 151.00, zz, 10.02, 151.055, zz + .026))
        add_pousse(inox, (8.94, 151.63, zz, 10.02, 151.68, zz + .026))
        for xx in (9.04, 9.30, 9.56, 9.82):
            add_pousse(inox, (xx, 151.055, zz, xx + .028, 151.63, zz + .022))
    for c, parts in pousse_pieces.items():
        if parts:
            attacher_pousse(H.boxes(f"fournil_pousse_{c[1:]}", parts, "palette", props))
    attacher_pousse(blobs_fournil("fournil_pate_pousse", (
        ((9.30, 151.16, 1.47), (.24, .20, .15)),
        ((9.68, 151.20, 1.58), (.36, .25, .22)),
        ((9.48, 151.48, 1.77), (.26, .17, .16)),
    ), "#f2efe6", props))

    # Trois chariots à échelles : cadres tubulaires ouverts, plateaux-grilles
    # espacés et roulettes basses. Rangés en baie au nord-est, près du four ;
    # la porte des vestiaires et son débouché restent libres.
    chariots = []
    for no, x0 in enumerate((16.95, 17.85, 18.75), start=1):
        x1, y0, y1 = x0 + .88, 150.35, 150.97
        chariots.append((no, x0, x1, y0, y1))
        for xx in (x0, x0 + .055, x1 - .055, x1):
            add(inox, (xx, y0 + .035, .20, xx + .035, y1 - .035, 1.90))
        for ya in (y0 + .035, y1 - .075):
            add(inox, (x0 + .025, ya, .20, x1 - .025, ya + .04, .28))
            add(inox, (x0 + .025, ya, 1.84, x1 - .025, ya + .04, 1.90))
        for level in range(7):
            zz = .38 + level * .225
            # Chaque niveau forme un plateau ajouré, lisible de face sans
            # remplir le volume comme un bloc noir.
            add(inox, (x0 + .055, y0 + .045, zz, x1 - .055, y0 + .09, zz + .028))
            add(inox, (x0 + .055, y1 - .09, zz, x1 - .055, y1 - .045, zz + .028))
            for rod in range(1, 4):
                xx = x0 + .055 + rod * .19
                add(inox, (xx, y0 + .085, zz, xx + .026, y1 - .085, zz + .022))
        # Petite poignée supérieure, tournée vers l'allée.
        add(noir, (x0 + .08, y0 - .045, 1.82, x1 - .08, y0 - .005, 1.87))

    # Îlot de façonnage au centre : plan fariné, pâtons et cuve à gauche,
    # balance à droite. Il laisse 2 m entre son bord et le four : axe de service
    # dégagé depuis la porte sud, avec une boucle libre vers les vestiaires.
    add(inox, (12.40, 146.45, .79, 15.00, 148.05, .91))
    for xx in (12.48, 14.86):
        for yy in (146.53, 147.91):
            add(inox, (xx, yy, .16, xx + .07, yy + .07, .79))
    add(noir, (12.55, 146.62, .34, 14.92, 147.90, .42))
    add(inox, (12.55, 146.62, .42, 14.92, 147.90, .47))
    # Planche en bois, plaque de cuisson et pains en cours de façonnage.
    add("#deb789", (12.62, 146.58, .92, 13.86, 147.78, .98))
    add(noir, (13.98, 146.62, .92, 14.54, 147.36, .98))
    for edge in (13.98, 14.52):
        add(inox, (edge, 146.62, .98, edge + .035, 147.36, 1.04))
    add(inox, (13.98, 146.62, .98, 14.55, 146.655, 1.04))
    add(inox, (13.98, 147.325, .98, 14.55, 147.36, 1.04))
    blobs_fournil("fournil_pains_faconnage", (
        ((12.91, 146.86, 1.07), (.17, .12, .09)),
        ((13.35, 146.90, 1.07), (.17, .12, .09)),
        ((12.91, 147.30, 1.07), (.17, .12, .09)),
        ((13.35, 147.34, 1.07), (.17, .12, .09)),
    ), "#b8612e", props)
    cuve_ouverte("fournil_desserte_cuve", (14.02, 147.82), .25, .91, 1.17,
                 inox, props, segments=16)
    cylindre_aplat("fournil_desserte_pate", (14.02, 147.82), .17, 1.105, 1.13,
                    "#f2efe6", props, segments=16)
    # Afficheur orange de la balance, visible depuis les deux accès.
    add(noir, (14.58, 147.48, 1.00, 14.84, 147.64, 1.30))
    add(inox, (14.68, 147.54, .91, 14.74, 147.60, 1.00))
    add(orange, (14.61, 147.455, 1.19, 14.81, 147.47, 1.25))

    # Rôtissoire sur la ligne chaude au fond, hors du débouché des deux portes.
    # Ligne chaude plaquée au mur nord, alignée sur le four à sole.
    rot_y = 154.70
    add(noir, (17, rot_y, .15, 19.1, rot_y + 1.05, 1.35))
    add(inox, (17.08, rot_y - .07, .32, 19, rot_y, 1.22))
    add(noir, (17.24, rot_y - .11, .36, 18.84, rot_y - .08, 1.17))
    add(inox, (17.16, rot_y - .12, .30, 17.24, rot_y, 1.24))
    add(inox, (18.84, rot_y - .12, .30, 18.92, rot_y, 1.24))
    add(inox, (17.16, rot_y - .12, 1.20, 18.92, rot_y, 1.28))
    add(inox, (17.16, rot_y - .12, .27, 18.92, rot_y, .34))
    for xx in (17.55, 18.05, 18.55):
        add("#b8612e", (xx, rot_y - .04, .54, xx + .16, rot_y - .01, 1.02))
        add(inox, (xx + .07, rot_y - .07, .48, xx + .09, rot_y + .01, 1.08))
    add(orange, (17.55, rot_y - .08, 1.08, 18.55, rot_y - .06, 1.15))
    for c, parts in pieces.items():
        if parts: H.boxes(f"fournil_{c[1:]}", parts, "palette", props)

    # Vitre de la rôtissoire : on voit les broches et les poulets, le halo est
    # une résistance fine en partie haute plutôt qu'un grand panneau orange.
    vitre_rotissoire = H.box("vitre_fournil_rotissoire",
                            (17.25, rot_y - .095, .36, 18.83, rot_y - .075, 1.17),
                            "verre", props, uv=f"aplat:{H.VERRE_TEINTE}")
    vitre_rotissoire["solide"] = False

    # Chariot à grilles dans l'étuve, puis roues des chariots de refroidissement.
    for no, x0, x1, y0, y1 in chariots:
        for xi in (x0 + .055, x1 - .055):
            for yi in (y0 + .08, y1 - .08):
                roulette_fournil(f"fournil_chariot_{no}_roulette_{xi:.2f}_{yi:.2f}",
                                 xi, yi, .14, props)
        col_coll.objects.link(geo_utils.build_proxy_object(
            f"col_box_fournil_chariot_{no}", "box", (x0, y0, 0),
            (x1 - x0, y1 - y0, 1.90)))

    # Collider de l'îlot ; l'allée de service reste >1,2 m sur ses deux côtés.
    col_coll.objects.link(geo_utils.build_proxy_object(
        "col_box_fournil_desserte", "box", (12.40, 146.45, 0), (2.60, 1.60, 1.17)))

    # Vantail vitré à cadre inox : seul le verre est enfant du door_ animé.
    bx0, by0, bz0, bx1, by1, bz1 = (8.72, 150.70, .20, 10.23, 150.78, 2.28)
    cadre = [
        ((bx0, by0, bz0, bx1, by1, bz0 + .08), f"aplat:{inox}"),
        ((bx0, by0, bz1 - .08, bx1, by1, bz1), f"aplat:{inox}"),
        ((bx0, by0, bz0, bx0 + .08, by1, bz1), f"aplat:{inox}"),
        ((bx1 - .08, by0, bz0, bx1, by1, bz1), f"aplat:{inox}"),
        ((9.445, by0, bz0 + .08, 9.505, by1, bz1 - .08), f"aplat:{inox}"),
        ((bx0 + .08, by0, 1.19, bx1 - .08, by1, 1.25), f"aplat:{inox}"),
    ]
    door = H.boxes("door_fournil_pousse", cadre, "palette", props)
    _centrer_origine(door)
    for cle, valeur in dict(mouvement="battant", charniere="min", sens="-", angle=105,
                            manuelle=True, referme=False).items():
        door[cle] = valeur
    attacher_pousse(door)
    fenetres = [
        ((8.81, 150.724, .29, 9.43, 150.756, 1.17), f"aplat:{H.VERRE_TEINTE}"),
        ((9.52, 150.724, .29, 10.14, 150.756, 1.17), f"aplat:{H.VERRE_TEINTE}"),
        ((8.81, 150.724, 1.27, 9.43, 150.756, 2.19), f"aplat:{H.VERRE_TEINTE}"),
        ((9.52, 150.724, 1.27, 10.14, 150.756, 2.19), f"aplat:{H.VERRE_TEINTE}"),
    ]
    vitre = H.boxes("vitre_door_fournil_pousse", fenetres, "verre", props)
    vitre["solide"] = False
    bpy.context.view_layer.update()
    vitre.parent = door
    vitre.matrix_parent_inverse = door.matrix_world.inverted()
    bpy.context.view_layer.update()

    # Desserte à poulet, juste devant la rôtissoire : plateau, étagère basse
    # et pieds ouverts. Le repère alimentaire sera posé sur son plateau.
    desserte_y = rot_y - .88
    poulet_y = rot_y - .60
    desserte = [
        ((17.62, desserte_y, .86, 17.72, desserte_y + .10, .96), "aplat:#444a54"),
        ((18.78, desserte_y, .86, 18.88, desserte_y + .10, .96), "aplat:#444a54"),
        ((17.62, desserte_y + .46, .86, 17.72, desserte_y + .56, .96), "aplat:#444a54"),
        ((18.78, desserte_y + .46, .86, 18.88, desserte_y + .56, .96), "aplat:#444a54"),
        ((17.62, desserte_y, .91, 18.88, desserte_y + .56, .99), "aplat:#babcbc"),
        ((17.68, desserte_y + .06, .32, 18.82, desserte_y + .50, .38), "aplat:#babcbc"),
        ((17.68, desserte_y + .03, .38, 17.76, desserte_y + .51, .42), "aplat:#444a54"),
        ((18.74, desserte_y + .03, .38, 18.82, desserte_y + .51, .42), "aplat:#444a54"),
    ]
    H.boxes("fournil_desserte_poulet", desserte, "palette", props, subdiv=.1)
    cylindre_aplat("fournil_poulet_plateau", (18.25, poulet_y), .28, .99, 1.035,
                    inox, props, segments=12)
    col_coll.objects.link(geo_utils.build_proxy_object(
        "col_box_fournil_desserte_poulet", "box", (17.62, desserte_y, 0), (1.26, .56, 1.035)))

    # Plans de préparation solides : le joueur ne peut plus les traverser.
    for index, ya in enumerate((145, 149), start=1):
        col_coll.objects.link(geo_utils.build_proxy_object(
            f"col_box_fournil_table_{index}", "box", (8.45, ya, 0), (3.15, 1.0, .90)))

    poussoir_centre = Vector((10.5, 150.5, 1.25))
    poussoir = H.boxes("use_fournil_pousse", [
        ((10.31, 150.62, 1.02, 10.69, 150.74, 1.48), f"aplat:{noir}"),
        ((10.35, 150.58, 1.06, 10.65, 150.62, 1.44), f"aplat:{inox}"),
        ((10.42, 150.54, 1.18, 10.58, 150.58, 1.34), f"aplat:{orange}"),
        ((10.45, 150.535, 1.38, 10.55, 150.58, 1.42), "aplat:#65814b"),
    ], "palette", logic, subdiv=0.1)
    for vertex in poussoir.data.vertices:
        vertex.co -= poussoir_centre
    poussoir.location = poussoir_centre
    poussoir["target"] = "door_fournil_pousse"
    poussoir["message"] = "La pâte a pris toute la chambre."
    attacher_pousse(poussoir)

    col_pousse = geo_utils.build_proxy_object(
        "col_box_fournil_pousse", "box", (8.55, 150.8, .1), (1.85, 1.2, 2.35))
    col_coll.objects.link(col_pousse)
    attacher_pousse(col_pousse)

    # Rotation de 90° : le dos (+Y local) vient contre la face intérieure du
    # mur ouest (x=8.25), et le vantail s'ouvre vers l'allée (+X monde).
    pousse_root.matrix_world = (
        Matrix.Translation(Vector((8.85, 151.4, 0)))
        @ Matrix.Rotation(math.pi / 2, 4, "Z")
        @ Matrix.Translation(Vector((-9.475, -151.4, 0)))
    )

    # Reprend le repère nourriture du plan pour placer le poulet à côté de la
    # rôtissoire et lui donner un nom explicite ; le loader instancie le modèle.
    ancien_poulet = bpy.data.objects.get("use_nourriture_fournil_1")
    if ancien_poulet is not None:
        bpy.data.objects.remove(ancien_poulet, do_unlink=True)
    bo.boite_centree("use_fournil_poulet", (18.25, poulet_y, 1.35), (0.5, 0.5, 0.5),
                     "repere", gris, logic, extras={"aliment": "poulet"})

    # Sacs cassables : silhouette resserrée, col ficelé et étiquette lisible.
    alphabet = {
        "F": ("11111", "10000", "11110", "10000", "10000", "10000", "10000"),
        "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
        "R": ("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
        "I": ("11111", "00100", "00100", "00100", "00100", "00100", "11111"),
        "N": ("10001", "11001", "11001", "10101", "10011", "10011", "10001"),
        "E": ("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
    }
    for i, (x, y) in enumerate(((8.8, 141.8), (9.55, 141.8), (8.8, 142.55), (9.55, 142.55)), start=1):
        sack = H.prop(f"fournil_farine_{i}", (x, y, .05, x + .58, y + .48, .82),
                      "palette", props, uv="aplat:#bdae9a", masse=8, pv=12, matiere="farine")
        cx, cy = x + .29, y + .24
        for vertex in sack.data.vertices:
            scale = .68 if vertex.co.z > .5 else .88
            vertex.co.x = cx + (vertex.co.x - cx) * scale
        sack.data.update()

        details = [
            ((x + .20, y + .12, .79, x + .38, y + .36, .84), "aplat:#a58a60"),
            ((x + .25, y + .17, .84, x + .33, y + .31, .89), "aplat:#b8612e"),
            ((x + .04, y - .013, .19, x + .54, y - .006, .68), "aplat:#654933"),
            ((x + .055, y - .021, .205, x + .525, y - .013, .665), "aplat:#f2efe6"),
            ((x + .105, y - .032, .555, x + .475, y - .021, .625), "aplat:#b8612e"),
        ]
        pixel_w, pixel_h = .0115, .023
        text_x, text_z = cx - 35 * pixel_w / 2, .315
        for letter_index, letter in enumerate("FARINE"):
            for row, line in enumerate(alphabet[letter]):
                for column, bit in enumerate(line):
                    if bit == "1":
                        px = text_x + (letter_index * 6 + column) * pixel_w
                        pz = text_z + (6 - row) * pixel_h
                        details.append(((px, y - .032, pz, px + pixel_w * .78,
                                         y - .021, pz + pixel_h * .78), "aplat:#444a54"))
        label = H.boxes(f"fournil_farine_details_{i}", details, "palette", props)
        bpy.context.view_layer.update()
        label.parent = sack
        label.matrix_parent_inverse = sack.matrix_world.inverted()

    for name, origin, size in (
        ("four", (11, 154 + decalage_four, 0), (6, .9, 2.85)),
        ("petrin", (8.8, 143, .1), (1.82, 1.3, 1.75)),
        ("rotissoire", (17, rot_y, 0), (2.1, 1.05, 1.35)),
    ):
        col_coll.objects.link(geo_utils.build_proxy_object(f"col_box_fournil_{name}", "box", origin, size))

    for i, x in enumerate((9.5, 13, 17)):
        lampe(logic, f"light_fournil_neutre_{i}", (x, 147.5, 4), color="#e8eff0", intensity=2.2, distance=7)
        L.place(L.neon(2.0), (x - 1.0, 147.33, 4.32), 0,
                props, props, f"fournil_neon_{i}")
    lampe(logic, "light_fournil_four", (14, 153 + decalage_four, 1.8), color="#ff8a3a", intensity=3.8, distance=6)
    lampe(logic, "light_fournil_rotissoire", (18.1, rot_y - .35, 1.2), color="#ff9a45", intensity=1.5, distance=3.5)
    return {"props": 4, "lampes": 5}
