"""Parking extérieur.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_facade as F            # noqa: E402
import lib_reserve as R           # noqa: E402
import lib_rayons as L            # noqa: E402

from espaces.commun import lampe
from enseigne import poser as poser_enseigne

# --- Habillage : le parking extérieur -----------------------------------------
#
# Le spawn, et donc la première image du jeu. À CIEL OUVERT : c'est le seul
# espace sans plafond, donc le seul sans rien où accrocher un néon. Et comme le
# niveau tourne en `hybride` (ambiante 0,18, pas de soleil), il n'y a pas de
# lumière du jour — c'est un parking de NUIT, éclairé par ses mâts et rien
# d'autre. Choix assumé, et une bien meilleure entrée en matière qu'un plein
# soleil sur du bitume.

PK_VOITURES_X = tuple(-24.0 + 4.0 + i * 7.0 for i in range(6))
PK_VOITURES_Y = (-34.0, -16.0)
PK_ABRI = (14.0, -24.0)
PK_ACCESSOIRES = (
    (-7.8, -30.25, "cone"), (-6.8, -30.25, "cone"),
    (21.75, -21.5, "cone"), (-22.5, -10.0, "debris-tire"),
    (21.5, -7.0, "box"), (22.3, -7.8, "box"), (-21.0, -6.0, "box"),
)
# (x, y) du FÛT et côté vers lequel la crosse porte la tête. Le premier jet en
# plantait un dans l'axe des portes automatiques, à 4 m d'elles et décalé de
# 2 m, et un autre contre le point de départ (retour de playtest du 2026-09-18).
# Deux mâts encadrent maintenant l'entrée, tête vers elle ; les quatre autres
# sont dans les intervalles des files de places, tête au-dessus de l'allée.
PK_LAMPADAIRES = ((-6.5, -6.0, "+x"), (6.5, -6.0, "-x"),
                  (-14.5, -33.0, "+y"), (13.5, -33.0, "+y"),
                  (-14.5, -15.0, "-y"), (13.5, -15.0, "-y"))
# Origine de l'asset par rapport au fût, et rotation, selon le côté de la tête
# (l'asset a sa tête à +y, fût centré en (0,26 ; 0,26)).
PK_POSE_MAT = {"+y": ((-0.26, -0.26), 0), "-y": ((0.26, 0.26), 180),
               "-x": ((0.26, -0.26), 90), "+x": ((-0.26, 0.26), 270)}
PK_TETE = 1.19                                 # porte-à-faux de la tête


PK_VEHICULES = (
    ("citadine_miel", -20.0, -34.0, "pk_au_citadine"),
    ("berline_bleu_acier", -6.0, -34.0, "pk_au_berline"),
    ("suv_olive", 8.0, -16.0, "pk_au_suv"),
    ("muscle_prune", -13.5, -29.5, "pk_au_muscle_pdb"),
    ("pickup_creme", 1.0, -34.0, "pk_au_pickup"),
    ("sportive_turquoise", 15.0, -34.0, "pk_au_sportive"),
    ("tout_terrain_sable", -20.0, -16.0, "pk_au_4x4"),
    ("citadine_rouge_brique", -6.0, -16.0, "pk_au_citadine_rouge"),
    ("roadster", -13.0, -16.0, "pk_au_roadster"),
    ("scooter", 1.0, -16.0, "pk_au_scooter"),
)


def placer_voitures_exterieur(space, props, col_coll) -> int:
    for modele, vx, vy, suffix in PK_VEHICULES:
        asset, bounds = R.voiture_proposition(modele)
        L.place(asset, (vx + bounds[1], vy, space.z), 90, props, col_coll, suffix)
    return len(PK_VEHICULES)


def placer_caddies_parking(space, props, col_coll):
    # File parallèle au rail, côté entrée, avec les poignées vers l'ouest.
    placed = []
    for i in range(3):
        placed.extend(L.place(L.caddie(),
                              (PK_ABRI[0] + 1.95 + i, PK_ABRI[1] + 1.25, space.z),
                              90, props, col_coll, f"pk_cd{i}"))
    return placed


def habiller_parking(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z

    voitures = placer_voitures_exterieur(space, props, col_coll)

    for i, (ax, ay, modele) in enumerate(PK_ACCESSOIRES):
        L.place(R.accessoire_car_kit(modele), (ax, ay, z), i * 43,
                props, col_coll, f"pk_acc{i}")

    L.place(R.abri_caddies(6.0), (PK_ABRI[0], PK_ABRI[1], z), 0, props, col_coll, "pk_abri")
    placer_caddies_parking(space, props, col_coll)

    # Marquages au sol : UN par emplacement, aligné sur la voiture qui s'y range.
    # Les voitures du blockout sont alignées le long de X, museau à l'ouest —
    # une file pare-chocs contre pare-chocs et non une rangée d'emplacements
    # côte à côte. Les bandes suivent donc ce pas de 7 m, et non une trame
    # régulière qui les ferait se chevaucher.
    places = 0
    for j, vy in enumerate(PK_VOITURES_Y):
        for i, vx in enumerate(PK_VOITURES_X):
            L.place(R.marquage_place(5.0, 2.5), (vx - 0.5, vy - 0.3, z), 0,
                    props, props, f"pk_pm{j}_{i}")
            places += 1

    # Mâts d'éclairage : la seule lumière du parking.
    lampes = 0
    for i, (lx, ly, cote) in enumerate(PK_LAMPADAIRES):
        (ox, oy), rot = PK_POSE_MAT[cote]
        L.place(R.lampadaire(5.0), (lx + ox, ly + oy, z), rot, props, col_coll, f"pk_lp{i}")
        dx, dy = {"+y": (0, 1), "-y": (0, -1), "+x": (1, 0), "-x": (-1, 0)}[cote]
        lampe(logic, f"light_pk_{i}", (lx + dx * PK_TETE, ly + dy * PK_TETE, z + 4.45),
              color="#fff0d0", intensity=16.0, distance=22.0)
        lampes += 1

    for i, (px, py) in enumerate(((x0 + 1.0, y1 - 1.5), (x1 - 1.4, y0 + 1.2))):
        L.place(L.poubelle(), (px, py, z), 0, props, col_coll, f"pk_pou{i}")
    L.place(F.enseigne_murale("bienvenue"), (-3.0, y1 - 0.3, z + 3.4), 180,
            props, props, "pk_bienvenue")

    poser_enseigne(props, logic)

    return {"voitures": voitures, "places": places, "lampadaires": len(PK_LAMPADAIRES),
            "lampes": lampes}
