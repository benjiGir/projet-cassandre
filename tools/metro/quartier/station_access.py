"""Enveloppe de la bouche N4b, raccordée à la place et aux billets.

see: docs/4-technique/pilote-quartier.md#enveloppe-de-lescalier-public
"""
from tools.metro.kit.geometry import FACES
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


def enclose(a, entrance):
    for obj in entrance:
        if not obj.name.startswith("col_hull_"):
            continue
        for vertex in obj.data.vertices:
            surface = -(vertex.co.y - 73) * .5
            if vertex.co.z < surface - .1:
                vertex.co.z = -5.25
        obj.data.update()

    for side, x in (("ouest", -3.25), ("est", 3)):
        a.box("bouche_mur_exterieur_" + side, (x, 71.85, -5.5), (.25, 12.4, 9), "enduit")
    for side, x in (("ouest", -3), ("est", 2)):
        a.box("bouche_soubassement_" + side, (x, 72, -5.25), (1, 12, 5), "enduit")
        wall_x = -3.25 if side == "ouest" else 3
        a.box("bouche_couvertine_" + side, (wall_x, 71.85, 3.5), (.25, 12.4, .12), "ivoire", False)
    a.box("bouche_fond_haut", (-3, 84, -1.5), (6, .25, 5), "enduit")
    a.box("bouche_socle", (-3, 72, -5.5), (6, 12, .25), "ardoise")
    a.box("bouche_massif_palier_haut", (-2, 72, -5.25), (4, 1, 5), "enduit")
    a.box("bouche_plafond_bas", (-3, 81, -1.5), (6, 3, .25), "enduit")
    for side, x in (("ouest", -2.25), ("est", 2)):
        a.box("bouche_raccord_palier_bas_" + side, (x, 83, -5.25), (.25, 1, .25), "ardoise")

    p = Piece("massif_escalier_public", a.mats, "soubassement sous marches ; rampe de collision pleine")
    vertices = [(x, y, z) for x in (-2, 2)
                for y, z in ((73, -.4), (83, -5.25), (83, -5.5), (73, -5.5))]
    p.mesh(vertices, FACES, "enduit")
    install(a, p, (0, 0, 0))
