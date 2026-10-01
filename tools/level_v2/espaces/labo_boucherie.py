"""Laboratoire de boucherie.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_rayons as L            # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import _emprise, blobs_fournil, lampe, vraie_fenetre
from espaces.coque import SUBDIV_BAKE

# --- Habillage D : laboratoire boucherie / marée ----------------------------

def habiller_labo_boucherie(space, gris, props, col_coll, logic) -> dict:
    """Postes de découpe regroupés autour de leur chaîne du froid."""
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    t = bo.EPAISSEUR_MUR
    ix0, ix1, iy0, iy1 = x0 + t, x1 - t, y0 + t, y1 - t

    # Grès rouge avec joints à pas régulier : lecture nette du labo au seuil.
    H.box("lb_sol_gres_rouge", (ix0, iy0, z + 0.002, ix1, iy1, z + 0.012),
          "palette", props, uv="aplat:#89432e", subdiv=SUBDIV_BAKE)
    joints = []
    for i in range(1, round((ix1 - ix0) / 0.25)):
        x = ix0 + i * 0.25
        joints.append(((x - 0.008, iy0, z + 0.013, x + 0.008, iy1, z + 0.016),
                       "aplat:#69252a"))
    for i in range(1, round((iy1 - iy0) / 0.25)):
        y = iy0 + i * 0.25
        joints.append(((ix0, y - 0.008, z + 0.013, ix1, y + 0.008, z + 0.016),
                       "aplat:#69252a"))
    H.boxes("lb_joints_gres", joints, "palette", props, subdiv=1e9)

    # Grande baie côté rayon : la coque reste pleine en collision. Le vitrage
    # montre le rail et les postes de travail avant que le joueur entre.
    fenetre = (-54.5, y0, z + 1.0, -48.0, y0 + t, z + 2.5)
    vraie_fenetre("labo_boucherie_rayons", "labo", fenetre, props)
    H.box("lb_tablette_vitrine", (-54.38, y0 + t + 0.02, z + 0.82,
                                   -48.12, y0 + t + 0.42, z + 0.91),
          "metal_bac_acier", props, subdiv=1e9)

    # Table de découpe, placée sous le rail mais hors de l'axe entre les portes.
    tx0, tx1, ty0, ty1 = -54.2, -49.4, 89.7, 91.0
    pieds = []
    for x in (tx0 + 0.08, tx1 - 0.20):
        for y in (ty0 + 0.08, ty1 - 0.20):
            pieds.append(((x, y, z + 0.04, x + 0.12, y + 0.12, z + 0.84), "world"))
    pieds.append(((tx0 + 0.08, ty0 + 0.08, z + 0.34,
                   tx1 - 0.08, ty1 - 0.08, z + 0.40), "world"))
    H.boxes("lb_table_viande_structure", pieds, "metal_bac_acier", props, subdiv=1e9)
    H.box("lb_table_viande_plateau", (tx0, ty0, z + 0.84, tx1, ty1, z + 0.94),
          "metal_bac_acier", props, subdiv=SUBDIV_BAKE)
    H.col_box("lb_table_viande", (tx0, ty0, z, tx1, ty1, z + 0.96), col_coll)
    H.box("lb_planche_decoupe", (-52.4, 89.82, z + 0.94, -50.0, 90.84, z + 1.01),
          "palette", props, uv="aplat:#f2efe6", subdiv=1e9)
    viande = L.kenney_produit("meat-raw", 0.10)
    viande_x, viande_y, _ = _emprise(viande)
    L.place(viande, (-51.2 - viande_x / 2, 90.33 - viande_y / 2, z + 1.012),
            0, props, col_coll, "lb_viande_planche")

    # Scie à os verticale : arceau haut, lame claire et socle sombre.
    H.box("lb_scie_socle", (-53.95, 90.02, z + 0.96, -53.05, 90.75, z + 1.32),
          "palette", props, uv="aplat:#444a54", subdiv=1e9)
    H.boxes("lb_scie_arceau", [
        ((-53.88, 90.08, z + 1.28, -53.78, 90.18, z + 2.03), "world"),
        ((-53.22, 90.08, z + 1.28, -53.12, 90.18, z + 2.03), "world"),
        ((-53.88, 90.08, z + 1.93, -53.12, 90.18, z + 2.03), "world"),
        ((-53.75, 90.12, z + 1.38, -53.70, 90.16, z + 1.91), "world"),
    ], "metal_bac_acier", props, subdiv=1e9)
    H.box("lb_scie_guide", (-53.94, 90.10, z + 1.02, -53.35, 90.16, z + 1.08),
          "palette", props, uv="aplat:#f2c230", subdiv=1e9)

    # Poste marée : bac de rinçage à gauche, glace et poissons alignés à droite.
    fx0, fx1, fy0, fy1 = -58.8, -55.2, 85.6, 86.65
    pieds_maree = []
    for x in (fx0 + 0.07, fx1 - 0.19):
        for y in (fy0 + 0.07, fy1 - 0.19):
            pieds_maree.append(((x, y, z + 0.03, x + 0.12, y + 0.12, z + 0.82), "world"))
    H.boxes("lb_table_maree_pieds", pieds_maree, "metal_bac_acier", props, subdiv=1e9)
    H.box("lb_table_maree_plateau", (fx0, fy0, z + 0.82, fx1, fy1, z + 0.92),
          "metal_bac_acier", props, subdiv=SUBDIV_BAKE)
    H.col_box("lb_table_maree", (fx0, fy0, z, fx1, fy1, z + 0.94), col_coll)
    H.boxes("lb_bac_rincage", [
        ((-58.62, 85.77, z + 0.92, -57.52, 86.50, z + 1.00), "aplat:#babcbc"),
        ((-58.50, 85.88, z + 0.94, -57.64, 86.39, z + 0.97), "aplat:#444a54"),
    ], "palette", props, subdiv=1e9)
    H.box("lb_glace_poisson", (-57.35, 85.70, z + 0.92, -55.38, 86.58, z + 1.04),
          "palette", props, uv="aplat:#b5d2e8", subdiv=1e9)
    poisson = L.kenney_produit("fish", 0.18)
    poisson_x, poisson_y, _ = _emprise(poisson)
    for i, cx in enumerate((-57.02, -56.36, -55.70)):
        # Le modèle est allongé sur Y. Rotation de 90° : trois poissons
        # parallèles au bord du bac, posés dans l'emprise de la glace.
        L.place(poisson, (cx + poisson_y / 2, 86.14 - poisson_x / 2, z + 1.045),
                90, props, col_coll, f"lb_poisson_{i + 1}")
    robinet = [((-58.16, 86.32, z + 0.96, -58.10, 86.38, z + 1.29), "world"),
               ((-58.15, 86.32, z + 1.24, -57.78, 86.38, z + 1.30), "world"),
               ((-57.84, 86.32, z + 1.04, -57.78, 86.38, z + 1.27), "world")]
    H.boxes("lb_robinet_maree", robinet, "metal_bac_acier", props, subdiv=1e9)
    H.boxes("lb_robinet_poignees", [
        ((-58.34, 86.28, z + 0.97, -58.23, 86.42, z + 1.05), "aplat:#d8231f"),
        ((-58.02, 86.28, z + 0.97, -57.91, 86.42, z + 1.05), "aplat:#1f5fbf"),
    ], "palette", props, subdiv=1e9)

    # Vivier rectangulaire adossé au poste marée, regardé depuis l'entrée.
    vx0, vx1, vy0, vy1 = -59.35, -56.25, 89.1, 92.0
    H.boxes("lb_vivier_soubassement", [
        ((vx0, vy0, z, vx1, vy1, z + 0.34), "aplat:#444a54"),
        ((vx0 + 0.05, vy0 + 0.05, z + 0.34, vx1 - 0.05, vy1 - 0.05, z + 0.39),
         "aplat:#babcbc"),
        ((vx1 - 0.12, vy0, z + 0.34, vx1 - 0.05, vy1, z + 1.32), "aplat:#babcbc"),
    ], "palette", props, subdiv=SUBDIV_BAKE)
    vitres_vivier = H.boxes("vitre_lb_vivier", [
        ((vx1 - 0.07, vy0 + 0.06, z + 0.39, vx1 - 0.035, vy1 - 0.06, z + 1.28),
         f"aplat:{H.VERRE_TEINTE}"),
        ((vx0 + 0.06, vy0 + 0.06, z + 0.39, vx0 + 0.095, vy1 - 0.06, z + 1.28),
         f"aplat:{H.VERRE_TEINTE}"),
        ((vx0 + 0.06, vy0 + 0.06, z + 0.39, vx1 - 0.06, vy0 + 0.095, z + 1.28),
         f"aplat:{H.VERRE_TEINTE}"),
        ((vx0 + 0.06, vy1 - 0.095, z + 0.39, vx1 - 0.06, vy1 - 0.06, z + 1.28),
         f"aplat:{H.VERRE_TEINTE}"),
    ], "verre", props, subdiv=1e9)
    vitres_vivier["pv"] = 30
    vitres_vivier["matiere"] = "verre"
    H.box("lb_vivier_eau", (vx0 + 0.12, vy0 + 0.12, z + 0.78,
                             vx1 - 0.12, vy1 - 0.12, z + 0.84),
          "palette", props, uv="aplat:#b5d2e8", subdiv=SUBDIV_BAKE)
    homards = [((-57.9, 89.9, z + 0.87), (0.28, 0.10, 0.075)),
               ((-58.7, 90.8, z + 0.87), (0.25, 0.09, 0.07)),
               ((-57.1, 91.2, z + 0.87), (0.24, 0.09, 0.07))]
    blobs_fournil("lb_homards_vivier", homards, "#b02931", props)
    H.boxes("lb_homards_pinces", [
        ((-58.14, 89.80, z + 0.87, -58.02, 89.75, z + 0.91), "aplat:#b02931"),
        ((-57.76, 89.80, z + 0.87, -57.64, 89.75, z + 0.91), "aplat:#b02931"),
        ((-58.93, 90.71, z + 0.87, -58.82, 90.66, z + 0.91), "aplat:#b02931"),
        ((-58.53, 90.71, z + 0.87, -58.42, 90.66, z + 0.91), "aplat:#b02931"),
    ], "palette", props, subdiv=1e9)

    # Tubes nus, calés sur les deux lignes de travail.
    reglettes, tubes = [], []
    for i, (cx, cy) in enumerate(((-55.5, 88.0), (-49.0, 94.2)), start=1):
        reglettes.append(((cx - 1.55, cy - 0.11, z + 3.22,
                           cx + 1.55, cy + 0.11, z + 3.34), "world"))
        tubes.append(((cx - 1.35, cy - 0.035, z + 3.18,
                       cx + 1.35, cy + 0.035, z + 3.23), "aplat:#f2efe6"))
        lampe(logic, f"light_lb_poste_{i}", (cx, cy, z + 2.95),
              color="#fff4df", intensity=5.0, distance=8.0)
    H.boxes("lb_reglettes", reglettes, "metal_bac_acier", props, subdiv=1e9)
    H.boxes("lb_tubes", tubes, "palette", props, subdiv=1e9)
    return {"tables de travail": 2, "vivier cassable": 1, "fenêtre sur les rayons": 1,
            "lampes": 2}
