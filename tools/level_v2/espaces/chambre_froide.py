"""Chambre froide.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_door_controls as DC
import lib_helpers as H           # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import blobs_fournil, lampe
from espaces.coque import SUBDIV_BAKE
from espaces.portes import _centrer_origine

# --- Habillage D : chambre froide --------------------------------------------

def habiller_chambre_froide(space, gris, props, col_coll, logic) -> dict:
    """Rail continu, rideau PVC, panneaux isolés et froid bleuté."""
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    t = bo.EPAISSEUR_MUR
    ix0, ix1, iy0, iy1 = x0 + t, x1 - t, y0 + t, y1 - t

    H.box("cf_sol_isole", (ix0, iy0, z + 0.002, ix1, iy1, z + 0.012),
          "palette", props, uv="aplat:#b5d2e8", subdiv=SUBDIV_BAKE)
    H.boxes("cf_givre_angles", [
        ((ix0, iy0, z + 0.014, ix0 + 0.35, iy1, z + 0.02), "aplat:#d5d7d8"),
        ((ix1 - 0.20, iy0, z + 0.014, ix1, iy1, z + 0.02), "aplat:#d5d7d8"),
        ((ix0 + 0.35, iy1 - 0.20, z + 0.014, ix1 - 0.20, iy1, z + 0.02), "aplat:#d5d7d8"),
    ], "palette", props, subdiv=SUBDIV_BAKE)

    # Habillage isotherme clair posé sur le vieux mur, avec les joints en relief
    # devant : la chambre froide se lit comme une enceinte lavable et isolée.
    faces_panneaux = [
        ((ix0 + 0.012, iy0, z + 0.03, ix0 + 0.022, iy1, z + 3.72), "aplat:#f1f1f1"),
        ((ix1 - 0.022, iy0, z + 0.03, ix1 - 0.012, 106.12, z + 3.72), "aplat:#f1f1f1"),
        ((ix1 - 0.022, 107.88, z + 0.03, ix1 - 0.012, iy1, z + 3.72), "aplat:#f1f1f1"),
        ((ix0, iy0 + 0.012, z + 0.03, -53.10, iy0 + 0.022, z + 3.72), "aplat:#f1f1f1"),
        ((-50.90, iy0 + 0.012, z + 0.03, ix1, iy0 + 0.022, z + 3.72), "aplat:#f1f1f1"),
        ((ix0, iy1 - 0.022, z + 0.03, ix1, iy1 - 0.012, z + 3.72), "aplat:#f1f1f1"),
    ]
    H.boxes("cf_faces_panneaux", faces_panneaux, "palette", props, subdiv=SUBDIV_BAKE)

    # Panneaux sandwich et joints visibles, sans recouvrir les deux accès.
    panneaux = []
    for yy in (101.0, 104.0, 107.0, 110.0, 113.0):
        panneaux.append(((ix0, yy - 0.025, z, ix0 + 0.035, yy + 0.025, z + 3.7), "aplat:#babcbc"))
    for yy0, yy1 in ((iy0, 106.05), (108.45, iy1)):
        panneaux.append(((ix1 - 0.035, yy0, z, ix1, yy1, z + 3.7), "aplat:#babcbc"))
    for xx in (-57.0, -54.0, -51.0, -48.0):
        panneaux.append(((xx - 0.025, iy1 - 0.035, z, xx + 0.025, iy1, z + 3.7),
                         "aplat:#babcbc"))
    H.boxes("cf_joints_panneaux", panneaux, "palette", props, subdiv=SUBDIV_BAKE)

    # Rideau à lanières au passage labo/chambre froide, indépendant du rail.
    rideau = []
    ouverture_lo, ouverture_hi = -53.0, -51.0
    largeur = 0.16
    pas = 0.20
    x = ouverture_lo + 0.02
    i = 0
    while x + largeur <= ouverture_hi - 0.01:
        bas = 0.05 if i % 2 == 0 else 0.11
        rideau.append(((x, 97.975, z + bas, x + largeur, 98.025, z + 2.35),
                       f"aplat:{H.VERRE_TEINTE}"))
        x += pas
        i += 1
    H.boxes("cf_rideau_lanieres", rideau, "verre", props, subdiv=1e9)
    H.box("cf_rail_rideau", (ouverture_lo, 97.91, z + 2.35,
                              ouverture_hi, 98.09, z + 2.43),
          "metal_bac_acier", props, subdiv=1e9)

    # L'axe du labo arrive sur un aiguillage. Les deux voies de stockage restent
    # contre le mur ouest et dégagent une allée entière jusqu'à la porte est.
    centres = [(-57.5, 101.3), (-57.5, 105.5), (-57.5, 109.7),
               (-54.5, 103.4), (-54.5, 107.6), (-54.5, 111.0)]
    rails, suspentes = [], []
    voies = ((-52.0, 88.5, 99.2), (-57.5, 99.2, 112.5), (-54.5, 99.2, 112.5))
    for rail_x, start_y, end_y in voies:
        rails.append(((rail_x - 0.055, start_y, z + 2.96,
                       rail_x + 0.055, end_y, z + 3.06), "world"))
        support_y = start_y + 0.5
        while support_y < end_y:
            suspentes.append(((rail_x - 0.035, support_y - 0.035, z + 3.06,
                                rail_x + 0.035, support_y + 0.035, z + 3.70), "world"))
            support_y += 2.5
    # Barre de transfert au seuil de la chambre froide, raccordée aux deux voies.
    for transfer_y in (99.2, 112.5):
        rails.append(((-57.5, transfer_y - 0.055, z + 2.96,
                       -52.0, transfer_y + 0.055, z + 3.06), "world"))
        for support_x in (-56.0, -54.0, -52.0):
            suspentes.append(((support_x - 0.035, transfer_y - 0.035, z + 3.06,
                                support_x + 0.035, transfer_y + 0.035, z + 3.70), "world"))
    H.boxes("cf_rails_aeriens", rails + suspentes, "metal_bac_acier", props, subdiv=1e9)

    # Six flancs de bœuf : masse continue, quartier d'épaule asymétrique,
    # puis un seul jarret pris dans un crochet relié au rail.
    volumes_viande, volumes_gras, crochets = [], [], []
    deports = (-0.06, 0.04, 0.08, -0.03, -0.08, 0.05)
    for i, (cx, cy) in enumerate(centres):
        cote = -1 if i % 2 == 0 else 1
        dx = deports[i]
        hx = cx + cote * 0.11
        volumes_viande.extend([
            # Flanc large et lourd, sans taille ni paire de jambes.
            ((cx + dx, cy, z + 1.36), (0.43, 0.20, 0.69)),
            # Épaule/brisket débordant d'un côté; alternance gauche/droite.
            ((cx + dx + cote * 0.17, cy - 0.015, z + 1.57), (0.30, 0.205, 0.40)),
            # Jarret unique, qui rejoint la viande et reçoit la pointe du crochet.
            ((hx, cy, z + 2.19), (0.13, 0.13, 0.25)),
        ])
        # Un capuchon de gras étroit sur le flanc visible, jamais en anneaux.
        volumes_gras.append(
            ((cx + dx - cote * 0.27, cy - 0.17, z + 1.30), (0.075, 0.028, 0.48)))
        crochets.extend([
            # Tige depuis le rail, coude déporté puis pointe entrant dans le jarret.
            ((cx - 0.025, cy - 0.025, z + 2.60,
              cx + 0.025, cy + 0.025, z + 2.96), "world"),
            ((min(cx, hx), cy - 0.04, z + 2.56,
              max(cx, hx), cy + 0.04, z + 2.62), "world"),
            ((hx - 0.03, cy - 0.035, z + 2.42,
              hx + 0.03, cy + 0.035, z + 2.59), "world"),
        ])
    blobs_fournil("cf_carcasses", volumes_viande, "#89432e", props)
    blobs_fournil("cf_tranches_gras", volumes_gras, "#dbd0c4", props)
    H.boxes("cf_crochets", crochets, "metal_bac_acier", props, subdiv=1e9)
    for i, (cx, cy) in enumerate(centres):
        dx = deports[i]
        H.col_box(f"cf_carcasse_{i}", (cx + dx - 0.52, cy - 0.24, z + 0.06,
                                        cx + dx + 0.52, cy + 0.24, z + 2.49), col_coll)

    # Évaporateur mural à deux ventilateurs : repère lisible de la chambre froide.
    H.box("cf_evaporateur", (-57.8, iy1 - 0.68, z + 2.88,
                              -48.2, iy1 - 0.08, z + 3.66),
          "metal_bac_acier", props, subdiv=SUBDIV_BAKE)
    ventilateurs = [((-55.6, iy1 - 0.70, z + 3.27), (0.31, 0.055, 0.31)),
                    ((-50.4, iy1 - 0.70, z + 3.27), (0.31, 0.055, 0.31))]
    blobs_fournil("cf_evaporateur_ventilateurs", ventilateurs, "#444a54", props)
    ailettes = []
    for cx in (-55.6, -50.4):
        ailettes.extend([
            ((cx - 0.22, iy1 - 0.78, z + 3.25, cx + 0.22, iy1 - 0.75, z + 3.29), "world"),
            ((cx - 0.025, iy1 - 0.78, z + 3.06, cx + 0.025, iy1 - 0.75, z + 3.48), "world"),
        ])
    H.boxes("cf_evaporateur_grilles", ailettes, "metal_bac_acier", props, subdiv=1e9)

    # Cadre isolant et déverrouillage intérieur sur le vantail côté couloir.
    H.boxes("cf_cadre_porte", [
        ((-44.31, 106.18, z, -44.25, 106.30, z + 2.32), "aplat:#d5d7d8"),
        ((-44.31, 107.70, z, -44.25, 107.82, z + 2.32), "aplat:#d5d7d8"),
        ((-44.31, 106.18, z + 2.24, -44.25, 107.82, z + 2.34), "aplat:#d5d7d8"),
        ((-44.27, 106.28, z + 0.04, -44.24, 107.72, z + 0.09), "aplat:#444a54"),
    ], "palette", props, subdiv=1e9)
    DC.control("use_chambre_froide_secours", (-44.5, 108.0, z + 1.25), "-x", props,
               target="door_chambre_froide_couloir",
               message="Déverrouillage intérieur de la porte frigorifique.")

    H.box("cf_reglette", (-54.1, 106.4, z + 3.70, -50.3, 106.6, z + 3.78),
          "metal_bac_acier", props, subdiv=1e9)
    H.box("cf_tube", (-53.8, 106.46, z + 3.66, -50.6, 106.54, z + 3.70),
          "palette", props, uv="aplat:#d5d7d8", subdiv=1e9)
    lampe(logic, "light_chambre_froide", (-52.2, 106.5, z + 3.42),
          color="#b5d2e8", intensity=2.2, distance=7.0)
    return {"carcasses suspendues": len(centres), "rails": 2,
            "rideau à lanières": 1, "déverrouillage intérieur": 1, "lampes": 1}
