"""Cafétéria.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_bureaux as B           # noqa: E402
import lib_rayons as L            # noqa: E402
import lib_public_compositions as P# noqa: E402
import plan_de_masse as plan      # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import SEED, _neons, semer

# --- Habillage : la cafétéria -------------------------------------------------
#
# Optionnelle, et c'est ce qui la définit : le plan y met du soin (+1 PV aux
# toilettes) et le secret 3. Première pièce MEUBLÉE du niveau et non achalandée
# — on y mange, on n'y achète rien.

CA_COMPTOIR = (37.0, 3.0)
CA_FRIGO = (53.0, 16.0)
CA_TABLES = tuple((34.0 + 4.0 + (i % 3) * 5.0, 0.0 + 9.0 + (i // 3) * 5.0) for i in range(6))
CA_NEON_X = (36.0, 44.0, 52.0)
CA_NEON_Y = (6.0, 14.0)
CA_NEONS_MORTS = frozenset({(52.0, 6.0)})


def placer_distributeurs_cafeteria(space, props, col_coll):
    # Façades vers l'ouest, dos à 5 cm de la face intérieure du mur est.
    placed = []
    back_x = space.x[1] - bo.EPAISSEUR_MUR - 0.05
    for i, facade in enumerate(B.FACADES_DISTRIBUTEUR):
        placed.extend(L.place(B.distributeur(facade),
                              (back_x - 0.75, space.y[0] + 2.90 + i, space.z),
                              270, props, col_coll, f"ca_dist{i}"))
    return placed


def habiller_cafeteria(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z

    L.place(B.comptoir_self(12.0), (CA_COMPTOIR[0], CA_COMPTOIR[1], z), 0,
            props, col_coll, "ca_self")
    L.place(L.frigo_garni(SEED + 950, "frais"), (CA_FRIGO[0], CA_FRIGO[1], z), 0,
            props, col_coll, "ca_frigo")

    for i, (tx, ty) in enumerate(CA_TABLES):
        L.place(B.table_cafeteria(i % 3), (tx, ty, z), 0, props, col_coll, f"ca_tb{i}")

    placer_distributeurs_cafeteria(space, props, col_coll)

    # Accès au secret 3 : la bouche d'aération du mur nord (`plan.PASSAGES`), au-
    # dessus d'un distributeur de 1,90 m, devant lequel traîne une caisse d'un
    # mètre. Deux sauts de 1,00 et 0,90 m, sous les 1,10 m du saut. L'ancienne
    # chaîne passait par un frigo de 2,20 m — 1,20 m à sauter depuis la caisse :
    # personne ne pouvait monter, et personne ne le savait, puisque le « secret »
    # se déclenchait au sol.
    ventx = plan.PASSAGES[frozenset({"cafeteria", "secret3"})][1] - 1.0
    L.place(B.distributeur("soda_5g_cola"), (ventx + 0.05, y1 - bo.EPAISSEUR_MUR - 0.75, z), 0,
            props, col_coll, "ca_dist_vmc")
    sx, sy = ventx, y1 - bo.EPAISSEUR_MUR - 1.75
    H.box("caisse_acces_secret3", (sx, sy, z, sx + 1.0, sy + 1.0, z + 1.0), "carton", props)
    H.col_box("caisse_acces_secret3", (sx, sy, z, sx + 1.0, sy + 1.0, z + 1.0), col_coll)
    # Le cadre de la bouche, côté cafétéria : un trou dans un mur se lit comme un
    # défaut, un trou encadré comme une bouche.
    # Il mord d'un centimètre sur la baie : à fleur, ses faces intérieures
    # doublaient les bouts du mur.
    H.boxes("ca_bouche_cadre", [((ventx - 0.08, y1 - 0.3, z + 2.0, ventx + 0.01, y1 - 0.24, z + 4.0), "world"),
                                ((ventx + 1.99, y1 - 0.3, z + 2.0, ventx + 2.08, y1 - 0.24, z + 4.0), "world")],
            "metal_bac_acier", props)

    # Chantier « Les coulisses » (2026-09-26) : un distributeur CASSABLE, à
    # l'écart des tables et du comptoir (mêmes matière/contenu que ceux du
    # couloir du personnel, `habiller_c_short_ramp`/`_w`).
    H.prop("ca_distributeur", (35.0, 12.0, z, 35.9, 12.75, z + 1.9),
          "metal_peint_rouge", props, masse=70, pv=30, matiere="electronique",
          contenu="canette:3")

    L.place(B.fontaine_eau(), (x0 + 0.6, 2.0, z), 0, props, col_coll, "ca_fontaine")
    for i, (px, py) in enumerate(((x0 + 0.8, y1 - 1.5), (x1 - 1.4, y1 - 1.4))):
        L.place(L.poubelle(), (px, py, z), 0, props, col_coll, f"ca_pou{i}")
    # y = 18,6 et non 19 : le mur nord est épais de 0,25 m, le bac entrait dedans.
    for i, (px, py) in enumerate(((40.0, 18.6), (47.0, 18.6))):
        L.place(L.bac_garni(SEED + 970 + i), (px, py, z), 0, props, col_coll, f"ca_bac{i}")

    meubles = semer(props, col_coll, "ca_k", (
        ("kitchenCoffeeMachine", 47.5, 3.6, z + 1.10, 0),
        ("toaster", 45.0, 3.7, z + 1.10, 15),
        ("kitchenMicrowave", 43.0, 3.6, z + 1.10, 0),
        ("kitchenFridge", 55.0, 1.2, z, 270),
        ("pottedPlant", 34.9, 1.2, z, 0), ("pottedPlant", 53.0, 18.6, z, 0),
        ("pottedPlant", 44.0, 18.8, z, 0), ("plantSmall2", 43.0, 9.0, z + 0.75, 0),
        ("stoolBar", 38.0, 5.0, z, 0), ("stoolBar", 40.0, 5.0, z, 0),
        ("stoolBar", 42.0, 5.0, z, 0), ("stoolBar", 44.0, 5.0, z, 0),
        ("trashcan", 34.8, 12.0, z, 0), ("radio", 38.5, 3.7, z + 1.10, 200),
    ))
    rampes, lampes = _neons(space, props, logic, CA_NEON_X, CA_NEON_Y,
                            CA_NEONS_MORTS, "ca", doubles=CA_NEON_X)
    P.cafeteria(props)
    return {"tables": len(CA_TABLES), "distributeurs": len(B.FACADES_DISTRIBUTEUR),
            "meubles": meubles, "rampes": rampes, "lampes": lampes}
