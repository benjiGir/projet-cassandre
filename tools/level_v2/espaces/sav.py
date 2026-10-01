"""Service après-vente.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

import math

import bpy
from mathutils import Matrix

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_bureaux as B           # noqa: E402
import lib_electro as E           # noqa: E402
import lib_rayons as L            # noqa: E402

from espaces.commun import _emprise, lampe
from espaces.coque import SUBDIV_BAKE
from espaces.portes import _centrer_origine

# --- Atelier SAV : réception, établis, puis mur de réglage -------------------

def habiller_sav(space, gris, props, col_coll, logic) -> dict:
    """Atelier entre réserve et personnel : guichet, établis, puis mur de réglage.

    La composition est dessinée dans son repère d'origine (entrée au sud,
    écrans au nord), puis tournée d’un quart de tour vers la réserve
    sans changer les postes, leurs colliders ni l'orientation de leurs façades.
    """
    objets_avant = set(bpy.data.objects)
    z = space.z

    # Guichet côté entrée. Le seuil garde 1,5 m de dégagement ; le comptoir se
    # contourne par son extrémité dans l'allée centrale.
    H.boxes("sav_guichet", [
        ((15.7, 81.65, z, 20.8, 82.35, z + 0.92), "aplat:#bdae9a"),
        ((15.55, 81.55, z + 0.92, 20.95, 82.45, z + 1.05), "aplat:#654933"),
        ((15.65, 81.60, z + 1.05, 20.85, 82.40, z + 1.10), "aplat:#f2efe6"),
        ((16.0, 82.34, z + 0.35, 20.5, 82.40, z + 0.80), "aplat:#444a54"),
    ], "palette", props, subdiv=SUBDIV_BAKE)
    H.col_box("sav_guichet", (15.7, 81.65, z, 20.8, 82.35, z + 0.92), col_coll)

    # Enseigne en grandes lettres géométriques, lisible depuis le seuil.
    H.box("sav_enseigne_fond", (17.20, 82.39, z + 1.53,
                                 19.80, 82.46, z + 2.25),
          "palette", props, uv="aplat:#2f3541", subdiv=1e9)
    H.boxes("sav_enseigne_pieds", [
        ((17.40, 82.40, z + 1.10, 17.52, 82.45, z + 1.58), "aplat:#444a54"),
        ((19.48, 82.40, z + 1.10, 19.60, 82.45, z + 1.58), "aplat:#444a54"),
    ], "palette", props, subdiv=1e9)
    glyphes = {
        "S": ("11111", "10000", "10000", "11111", "00001", "00001", "11111"),
        "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
        "V": ("10001", "10001", "10001", "10001", "10001", "01010", "00100"),
        "U": ("10001", "10001", "10001", "10001", "10001", "10001", "01110"),
        "R": ("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
        "G": ("01110", "10001", "10000", "10111", "10001", "10001", "01110"),
        "E": ("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
        "N": ("10001", "11001", "11001", "10101", "10011", "10011", "10001"),
        "T": ("11111", "00100", "00100", "00100", "00100", "00100", "00100"),
    }

    def lettres(nom, mot, x, y, bas_z, cellule, couleur, espace=0.018):
        pieces = []
        pas = cellule + cellule * 0.22
        depart = x
        for lettre in mot:
            if lettre == " ":
                depart += 3 * pas
                continue
            motif = glyphes[lettre]
            for ligne, rang in enumerate(motif):
                for colonne, pixel in enumerate(rang):
                    if pixel == "1":
                        xa = depart + colonne * pas
                        haut = bas_z + (6 - ligne) * pas
                        pieces.append(((xa, y, haut, xa + cellule, y + espace,
                                        haut + cellule), f"aplat:{couleur}"))
            depart += 6 * pas
        return H.boxes(nom, pieces, "palette", props, subdiv=1e9)

    lettres("sav_enseigne_lettres", "SAV", 17.85, 82.38, z + 1.63,
            0.060, "#f2891d", espace=0.045)
    H.box("sav_ticket_urgent_fond", (18.08, 85.24, z + 1.02,
                                      19.78, 85.31, z + 1.39),
          "palette", props, uv="aplat:#2f3541", subdiv=1e9)
    H.boxes("sav_ticket_urgent_pieds", [
        ((18.18, 85.20, z + 0.98, 18.28, 85.30, z + 1.05), "aplat:#444a54"),
        ((19.58, 85.20, z + 0.98, 19.68, 85.30, z + 1.05), "aplat:#444a54"),
    ], "palette", props, subdiv=1e9)
    lettres("sav_ticket_urgent", "URGENT", 18.18, 85.20, z + 1.05,
            0.033, "#f2891d", espace=0.025)

    # Sonnette réellement active : le point rouge est sur le chant accessible
    # depuis l'allée, à portée après le contournement du comptoir.
    H.box("sav_sonnette_socle", (20.05, 81.62, z + 1.08,
                                  20.45, 81.90, z + 1.20),
          "palette", props, uv="aplat:#444a54", subdiv=1e9)
    sonnette = H.box("use_sav_sonnette", (20.19, 81.69, z + 1.20,
                                           20.31, 81.81, z + 1.30),
                     "palette", props, uv="aplat:#d8231f", subdiv=1e9)
    _centrer_origine(sonnette)

    # Deux établis dos au mur de réglage, séparés par une allée de 3,8 m.
    etablis = []
    coll_etablis = []
    for i, (a, b) in enumerate(((15.8, 20.2), (24.0, 28.4))):
        avant, arriere = 84.38, 85.30
        etablis.extend([
            ((a, avant, z, b, arriere, z + 0.82), "aplat:#605c58"),
            ((a - 0.08, avant - 0.06, z + 0.82, b + 0.08, arriere + 0.06, z + 0.98),
             "aplat:#654933"),
            ((a + 0.12, avant + 0.08, z + 0.30, b - 0.12, avant + 0.18, z + 0.65),
             "aplat:#444a54"),
            ((a + 0.12, avant + 0.17, z + 0.52, b - 0.12, avant + 0.22, z + 0.56),
             "aplat:#bdae9a"),
        ])
        coll_etablis.append((a, avant, z, b, arriere, z + 0.98))
    H.boxes("sav_etablis", etablis, "palette", props, subdiv=SUBDIV_BAKE)
    for i, bounds in enumerate(coll_etablis):
        H.col_box(f"sav_etabli_{i}", bounds, col_coll)

    # Instruments faciles à reconnaître : oscilloscope, fer et bacs de pièces.
    instruments, ecrans_oscillo, commandes_oscillo, bacs, lampes_bras = [], [], [], [], []
    for cx, cy in ((16.65, 84.48), (25.0, 84.48)):
        instruments.extend([
            ((cx, cy, z + 1.00, cx + 0.72, cy + 0.42, z + 1.38), "aplat:#444a54"),
            ((cx + 0.09, cy - 0.018, z + 1.10, cx + 0.48, cy + 0.01, z + 1.31), "aplat:#111014"),
            ((cx + 0.54, cy - 0.012, z + 1.19, cx + 0.65, cy + 0.02, z + 1.30), "aplat:#f2c230"),
        ])
        ecrans_oscillo.append(((cx + 0.12, cy - 0.035, z + 1.19,
                                cx + 0.44, cy - 0.012, z + 1.22), "aplat:#57e2e1"))
        for j in range(3):
            commandes_oscillo.append(((cx + 0.53 + j * 0.045, cy - 0.03,
                                       z + 1.07, cx + 0.56 + j * 0.045,
                                       cy + 0.01, z + 1.11), "aplat:#d5d7d8"))
        # Fer à souder posé dans son support, deux pièces séparées par matériau.
        instruments.extend([
            ((cx + 0.85, cy + 0.12, z + 1.02, cx + 1.20, cy + 0.19, z + 1.07),
             "aplat:#111014"),
            ((cx + 0.96, cy + 0.13, z + 1.075, cx + 1.18, cy + 0.18, z + 1.12),
             "aplat:#bdae9a"),
        ])
        # Bacs rouges/bleus à composants sur le fond de l'établi.
        for j, couleur in enumerate(("#1f5fbf", "#d8231f", "#65814b", "#f2c230")):
            bx = cx + 0.05 + (j % 2) * 0.46
            by = cy + 0.50 + (j // 2) * 0.14
            bacs.append(((bx, by, z + 1.00, bx + 0.38, by + 0.11, z + 1.21),
                         f"aplat:{couleur}"))
            bacs.append(((bx + 0.05, by - 0.012, z + 1.14,
                          bx + 0.33, by + 0.006, z + 1.18), "aplat:#f2efe6"))
        # Bras de lampe articulé et loupe à cadre carré, silhouette claire.
        lampes_bras.extend([
            ((cx + 3.05, cy + 0.22, z + 1.00, cx + 3.14, cy + 0.31, z + 1.55),
             "aplat:#444a54"),
            ((cx + 2.62, cy + 0.22, z + 1.50, cx + 3.10, cy + 0.31, z + 1.58),
             "aplat:#d5d7d8"),
            ((cx + 2.54, cy + 0.18, z + 1.38, cx + 2.64, cy + 0.35, z + 1.50),
             "aplat:#b5d2e8"),
            ((cx + 2.49, cy + 0.16, z + 1.52, cx + 2.69, cy + 0.37, z + 1.58),
             "aplat:#f2c230"),
        ])
    H.boxes("sav_instruments", instruments, "palette", props, subdiv=1e9)
    H.boxes("sav_traces_oscillo", ecrans_oscillo, "palette", props, subdiv=1e9)
    H.boxes("sav_boutons_oscillo", commandes_oscillo, "palette", props, subdiv=1e9)
    H.boxes("sav_bacs_composants", bacs, "palette", props, subdiv=1e9)
    H.boxes("sav_lampes_loupes", lampes_bras, "palette", props, subdiv=1e9)

    # Un micro-ondes de retour est réellement dynamique et cassable. Sa façade
    # vient de l'atlas produit, pas d'un cube blanc ; le ticket URGENT est au-dessus.
    H.prop("sav_micro_onde", (18.15, 84.43, z + 0.98,
                              18.79, 84.88, z + 1.36),
          "prd_ecrans", props, uv="label:app_micro_ondes", masse=13,
          pv=16, matiere="electronique")

    # Rayonnage des retours, à l'est : les appareils ont leur vraie façade de
    # rayon, avec une étiquette orange distincte, au lieu de boîtes anonymes.
    rayonnage = []
    for yy in (82.35, 87.85):
        rayonnage.append(((30.25, yy, z, 31.60, yy + 0.14, z + 1.95),
                          "aplat:#444a54"))
    rayonnage.extend([
        ((31.38, 82.35, z, 31.55, 87.99, z + 1.95), "aplat:#605c58"),
        ((30.27, 82.35, z + 0.68, 31.38, 87.99, z + 0.80), "aplat:#bdae9a"),
        ((30.27, 82.35, z + 1.44, 31.38, 87.99, z + 1.56), "aplat:#bdae9a"),
    ])
    H.boxes("sav_rayonnage_retours", rayonnage, "palette", props,
            subdiv=SUBDIV_BAKE)
    H.col_box("sav_rayonnage_dos", (31.38, 82.35, z, 31.55, 87.99,
                                    z + 1.95), col_coll)
    H.col_box("sav_rayonnage_etagere_basse",
              (30.27, 82.35, z + 0.68, 31.38, 87.99, z + 0.80), col_coll)
    H.col_box("sav_rayonnage_etagere_haute",
              (30.27, 82.35, z + 1.44, 31.38, 87.99, z + 1.56), col_coll)

    def poser_face_est(asset, xx, yy, zz, suffix):
        lx, _ly, _lz = _emprise(asset)
        L.place(asset, (xx, yy + lx, z + zz), 270, props, col_coll, suffix)

    poser_face_est(E.gros_appareil("app_frigo"), 29.05, 83.20, 0.0,
                   "sav_frigo_retour")
    poser_face_est(E.gros_appareil("app_lave_linge"), 29.05, 85.25, 0.0,
                   "sav_lave_linge_retour")
    poser_face_est(B.meuble("televisionVintage"), 30.43, 83.0, 0.80,
                   "sav_tv_retour")
    poser_face_est(B.meuble("kitchenMicrowave"), 30.43, 85.55, 1.56,
                   "sav_micro_retour")

    tickets = []
    for xx, yy, zz in ((28.98, 83.40, 0.49), (30.34, 83.42, 0.83),
                       (28.98, 85.60, 0.49), (30.34, 85.90, 1.54)):
        tickets.extend([
            ((xx, yy, z + zz, xx + 0.06, yy + 0.28, z + zz + 0.18), "aplat:#f2891d"),
            ((xx - 0.015, yy + 0.04, z + zz + 0.12,
              xx, yy + 0.24, z + zz + 0.145), "aplat:#111014"),
        ])
    H.boxes("sav_etiquettes_depot", tickets, "palette", props, subdiv=1e9)

    # Un carton de retour déplaçable complète les deux cibles destructibles.
    H.prop("sav_carton_retour", (29.05, 82.30, z, 29.78, 83.02, z + 0.56),
          "carton", props, masse=8, pv=12, matiere="carton")

    # Quarante postes de test : dix colonnes, quatre hauteurs. L'EcranSystem
    # regroupe leurs dalles dans un lot de dessin commun au niveau.
    caissons, boutons, dalles = [], [], 0
    chaines = ("mire", "mire", "journal", "pub", "mire",
               "foot", "mire", "cctv", "pub", "mire")
    for rang in range(4):
        bas = z + 0.28 + rang * 0.76
        for colonne, chaine in enumerate(chaines):
            cx = 13.15 + (colonne + 0.5) * 1.77
            caissons.extend([
                ((cx - 0.77, 89.22, bas, cx + 0.77, 89.52, bas + 0.67),
                 "aplat:#2f3541"),
                ((cx - 0.64, 89.18, bas + 0.07,
                  cx + 0.64, 89.22, bas + 0.60), "aplat:#444a54"),
                ((cx + 0.50, 89.175, bas + 0.09,
                  cx + 0.61, 89.19, bas + 0.15), "aplat:#f2c230"),
            ])
            boutons.append(((cx - 0.08, 89.17, bas + 0.06,
                             cx + 0.08, 89.19, bas + 0.12), "aplat:#d8231f"))
            H.ecran(f"sav_{rang:02d}_{colonne:02d}",
                    (cx - 0.42, 89.17, bas + 0.09,
                     cx + 0.42, 89.23, bas + 0.61),
                    chaine, props, pv=12, front="-y")
            dalles += 1
    H.boxes("sav_caissons_tv", caissons, "palette", props, subdiv=1e9)
    H.boxes("sav_commandes_tv", boutons, "palette", props, subdiv=1e9)
    H.boxes("sav_etageres_tv", [
        ((13.0, 89.05, z + 0.29, 31.0, 89.54, z + 0.37), "aplat:#605c58"),
        ((13.0, 89.05, z + 3.32, 31.0, 89.54, z + 3.40), "aplat:#605c58"),
    ], "palette", props, subdiv=SUBDIV_BAKE)

    # Le mur froid des dalles contraste avec les lampes chaudes des établis.
    for i, (x, y) in enumerate(((18.0, 84.8), (26.4, 84.8))):
        H.box(f"sav_reglette_{i}", (x - 1.0, y, z + 3.18,
                                     x + 1.0, y + 0.10, z + 3.25),
              "metal_bac_acier", props, subdiv=1e9)
        H.box(f"sav_tube_{i}", (x - 0.86, y + 0.025, z + 3.15,
                                 x + 0.86, y + 0.075, z + 3.19),
              "palette", props, uv="aplat:#f2efe6", subdiv=1e9)
        lampe(logic, f"light_sav_etabli_{i}", (x, y + 0.42, z + 2.65),
              color="#f2c230", intensity=2.0, distance=5.0)
    lampe(logic, "light_sav_ecrans", (22.0, 87.3, z + 2.9),
          color="#6eb4d6", intensity=2.4, distance=8.0)

    # Repère de dessin (12..32, 80..90) vers la salle (20..30, 112..132).
    # On transforme les matrices des objets complets : les `use_*` gardent leur
    # origine d'interaction centrée, et les boîtes de collision restent alignées.
    bpy.context.view_layer.update()
    rotation_sav = Matrix.Rotation(math.radians(-90), 4, "Z")
    placement_sav = (
        Matrix.Translation((space.x[0], space.y[1], 0.0))
        @ rotation_sav
        @ Matrix.Translation((-12.0, -80.0, 0.0))
    )
    poses = {obj: obj.matrix_world.copy() for coll in (props, col_coll, logic)
             for obj in coll.objects if obj not in objets_avant}
    for obj, pose in poses.items():
        obj.matrix_world = placement_sav @ pose

    return {"téléviseurs de réglage": dalles, "établis": 2,
            "équipements de retour": 4, "props cassables": 2,
            "sonnette active": 1, "lampes": 3}
