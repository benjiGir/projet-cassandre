"""Vestiaires.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_facade as F            # noqa: E402
import lib_rayons as L            # noqa: E402
import plan_de_masse as plan      # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import lampe
from espaces.portes import _centrer_origine, porte_double

# --- Habillage A : vestiaires et pointeuse ----------------------------------

def habiller_vestiaires(space, gris, props, col_coll, logic) -> dict:
    """Vestiaires du personnel : deux îlots qui cadrent le Costard, casier
    du vigile cassable, pointeuse face à l'entrée, banc et douches au fond.

    Les ouvertures du plan restent la seule circulation : arrivée au sud,
    sortie vers le fournil à l'ouest. Le mur vers le PC et le plafond de la
    gaine restent pleins.
    """
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z

    # Échantillons réels de palette : gris neutre, beige, olive. La palette du
    # jeu est fermée (aucun aplat inventé à la modélisation).
    CASIER, PORTE, VERT = "#a2a3a1", "#bdae9a", "#65814b"
    SOMBRE, ACIER, PAPIER = "#111014", "#babcbc", "#f2efe6"

    caissons, portes, details = [], [], []
    rangs = ((144.5, 145.5), (141.5, 142.5))
    # Une petite banque à l'est complète la rangée de jeu sans obstruer la
    # pointeuse au fond. La rangée basse reste à l'ouest, dégagée de l'entrée.
    # L'allée au nord de la banque est réservée à l'accès de la salle de douches.
    segments = (((24.75, 26.75, 5), (28.25, 30.25, 5)), ((24.75, 26.75, 5),))
    niveaux = ((0.12, 0.88), (0.98, 1.74))

    for no_rang, (face_sud, face_nord) in enumerate(rangs):
        for no_segment, (debut, fin, nombre) in enumerate(segments[no_rang]):
            largeur = (fin - debut) / nombre
            for i in range(nombre):
                xa, xb = debut + i * largeur, debut + (i + 1) * largeur
                fente_costard = no_rang == 0 and no_segment == 0 and i == 4
                if fente_costard:
                    # Vrai passage visuel, et balistique, vers le Costard
                    # derrière le casier : carcasse latérale, tablette basse
                    # et tablette haute. Le reste de la banque reste plein.
                    xa_fente, xb_fente = xa + 0.035, xb - 0.035
                    caissons.extend([
                        ((xa + 0.012, face_sud + 0.025, z + 0.06,
                          xb - 0.012, face_nord - 0.025, z + 0.98), f"aplat:{CASIER}"),
                        ((xa + 0.012, face_sud + 0.025, z + 0.98,
                          xa_fente, face_nord - 0.025, z + 1.82), f"aplat:{CASIER}"),
                        ((xb_fente, face_sud + 0.025, z + 0.98,
                          xb - 0.012, face_nord - 0.025, z + 1.82), f"aplat:{CASIER}"),
                        ((xa_fente, face_sud + 0.025, z + 1.70,
                          xb_fente, face_nord - 0.025, z + 1.82), f"aplat:{CASIER}"),
                    ])
                else:
                    caissons.append(((xa + 0.012, face_sud + 0.025, z + 0.06,
                                      xb - 0.012, face_nord - 0.025, z + 1.82),
                                     f"aplat:{CASIER}"))
                for cote, face_y in ((0, face_sud), (1, face_nord)):
                    for niveau, (bas, haut) in enumerate(niveaux):
                        ouvert = no_rang == 0 and no_segment == 0 and i == 4 and cote == 0 and niveau == 1
                        sens = "-y" if cote == 0 else "+y"
                        if ouvert:
                            # Pas de panneau noir peint : la fente traverse la
                            # carcasse, le Costard réel forme la silhouette.
                            # Vantail écarté à 90°, sa tranche forme une ligne
                            # dans l'axe de la fente centrale.
                            portes.append(((xa + 0.025, face_y - 0.43, z + bas,
                                            xa + 0.065, face_y - 0.005, z + haut),
                                           f"aplat:{VERT}", "-x"))
                            continue

                        teinte = VERT if (i + no_rang * 3 + cote) % 8 == 0 else PORTE
                        portes.append(((xa + 0.035, face_y - 0.018 if cote == 0 else face_y - 0.005,
                                        z + bas, xb - 0.035,
                                        face_y + 0.005 if cote == 0 else face_y + 0.018,
                                        z + haut), f"aplat:{teinte}", sens))

                        # Poignée et deux fentes d'aération, visibles à 640×360.
                        hy0, hy1 = ((face_y - 0.050, face_y - 0.022) if cote == 0
                                    else (face_y + 0.022, face_y + 0.050))
                        details.append(((xb - 0.095, hy0, z + bas + 0.32,
                                         xb - 0.055, hy1, z + bas + 0.43),
                                        f"aplat:{ACIER}", sens))
                        for dz in (0.17, 0.23):
                            details.append(((xa + 0.12, hy0, z + haut - dz - 0.018,
                                             xa + 0.22, hy1, z + haut - dz),
                                            f"aplat:{SOMBRE}", sens))

            # La fente reste libre au tir. Son linteau supérieur est décoratif
            # et n'a pas de collider séparé, qui flotterait au-dessus du sol.
            if no_rang == 0 and no_segment == 0:
                xa_fente, xb_fente = debut + 4 * largeur + 0.035, debut + 5 * largeur - 0.035
                H.col_box("vs_banque_0_0_gauche",
                          (debut, face_sud, z, xa_fente, face_nord, z + 1.82), col_coll)
                H.col_box("vs_banque_0_0_bas",
                          (xa_fente, face_sud, z, fin, face_nord, z + 0.98), col_coll)
            else:
                H.col_box(f"vs_banque_{no_rang}_{no_segment}",
                          (debut, face_sud, z, fin, face_nord, z + 1.82), col_coll)

    H.boxes("vs_casiers_caissons", caissons, "palette", props)
    H.boxes("vs_casiers_portes", portes, "palette", props)
    H.boxes("vs_casiers_details", details, "palette", props)

    # Rangée de dix casiers de 40 cm le long du mur ouest, décalée au nord pour
    # dégager la porte vers le fournil. Le sixième est le casier cassable.
    wx0, wx1 = x0 + bo.EPAISSEUR_MUR, x0 + bo.EPAISSEUR_MUR + 0.50
    wy0, pas, n_casiers, emplacement = 147.5, 0.40, 10, 5
    mur_casiers, facades_casiers, details_mur = [], [], []
    for i in range(n_casiers):
        ya = wy0 + i * pas
        yb = ya + pas
        if i == emplacement:
            continue
        mur_casiers.append(((wx0, ya + 0.025, z, wx1, yb - 0.025, z + 1.8),
                            f"aplat:{CASIER}"))
        for niveau, (bas, haut) in enumerate(niveaux):
            teinte = VERT if i == 6 and niveau == 0 else PORTE
            facades_casiers.append(((wx1 - 0.012, ya + 0.04, z + bas,
                                     wx1 + 0.018, yb - 0.04, z + haut),
                                    f"aplat:{teinte}", "+x"))
            details_mur.append(((wx1 + 0.018, ya + 0.31, z + bas + 0.32,
                                 wx1 + 0.045, ya + 0.36, z + bas + 0.43),
                                f"aplat:{ACIER}", "+x"))
            for dz in (0.17, 0.23):
                details_mur.append(((wx1 + 0.018, ya + 0.15, z + haut - dz - 0.018,
                                     wx1 + 0.045, ya + 0.25, z + haut - dz),
                                    f"aplat:{SOMBRE}", "+x"))

    H.boxes("vs_casiers_ouest", mur_casiers, "palette", props)
    H.boxes("vs_casiers_ouest_portes", facades_casiers, "palette", props)
    H.boxes("vs_casiers_ouest_details", details_mur, "palette", props)
    H.col_box("vs_casiers_ouest_sud", (wx0, wy0, z, wx1, wy0 + emplacement * pas, z + 1.8), col_coll)
    H.col_box("vs_casiers_ouest_nord",
              (wx0, wy0 + (emplacement + 1) * pas, z, wx1, wy0 + n_casiers * pas, z + 1.8), col_coll)

    cy0 = wy0 + emplacement * pas
    casier_vigile = H.boxes("prop_vestiaires_casier_vigile", [
        ((wx0, cy0, z, wx1, cy0 + pas, z + 1.8), f"aplat:{CASIER}"),
        ((wx1 - 0.012, cy0 + 0.035, z + 0.08, wx1 + 0.018, cy0 + pas - 0.035, z + 1.72),
         f"aplat:{PORTE}", "+x"),
        # Cadenas rouge identifiable : anse acier, corps rouge, trou de serrure.
        ((wx1 + 0.018, cy0 + 0.18, z + 0.35, wx1 + 0.05, cy0 + 0.34, z + 0.50),
         "aplat:#d8231f", "+x"),
        ((wx1 + 0.024, cy0 + 0.235, z + 0.39, wx1 + 0.055, cy0 + 0.285, z + 0.45),
         f"aplat:{SOMBRE}", "+x"),
        ((wx1 + 0.018, cy0 + 0.19, z + 0.49, wx1 + 0.045, cy0 + 0.22, z + 0.61),
         f"aplat:{ACIER}", "+x"),
        ((wx1 + 0.018, cy0 + 0.30, z + 0.49, wx1 + 0.045, cy0 + 0.33, z + 0.61),
         f"aplat:{ACIER}", "+x"),
        ((wx1 + 0.018, cy0 + 0.19, z + 0.58, wx1 + 0.045, cy0 + 0.33, z + 0.61),
         f"aplat:{ACIER}", "+x"),
    ], "palette", props, subdiv=1e9)
    casier_vigile["masse"] = 55.0
    casier_vigile["pv"] = 35.0
    casier_vigile["matiere"] = "metal"
    casier_vigile["contenu"] = "sandwich:1"

    # Pointeuse murale au fond, face à la porte d'arrivée : boîtier posé hors
    # du mur, horloge au-dessus, râteliers de cartes et manette lisibles.
    # L'origine du mesh interactif est centrée sur son volume : la portée E
    # correspond donc bien à l'objet, pas à l'origine du niveau.
    support = H.box("vs_pointeuse_support", (24.20, 151.58, z + 0.72,
                                              26.80, 151.70, z + 2.82),
                    "palette", props, uv=f"aplat:{ACIER}")
    H.box("vs_pointeuse_plaque", (24.28, 151.48, z + 0.78,
                                   26.72, 151.59, z + 2.72),
          "palette", props, uv=f"aplat:{CASIER}")
    use_pointeuse = H.box("use_pointeuse", (25.12, 151.27, z + 0.88,
                                             25.88, 151.57, z + 1.95),
                           "palette", props, uv=f"aplat:{CASIER}")
    _centrer_origine(use_pointeuse)
    pointage = []
    pointage.extend([
        # Afficheur mécanique, carte marquée en attente et fente de lecture.
        ((25.25, 151.22, z + 1.53, 25.75, 151.27, z + 1.78), f"aplat:{SOMBRE}", "-y"),
        ((25.31, 151.19, z + 1.59, 25.68, 151.22, z + 1.72), "aplat:#d8231f", "-y"),
        ((25.28, 151.20, z + 1.28, 25.72, 151.27, z + 1.34), f"aplat:{ACIER}", "-y"),
        ((25.39, 151.17, z + 1.24, 25.61, 151.20, z + 1.28), f"aplat:{PAPIER}", "-y"),
        # Manette jaune et poignée rouge, saillantes devant la façade.
        ((25.35, 151.02, z + 1.02, 25.70, 151.18, z + 1.11), "aplat:#f2c230", "-y"),
        ((25.58, 151.00, z + 1.03, 25.68, 151.14, z + 1.32), "aplat:#d8231f", "-y"),
        # Horloge murale analogique, cadran et aiguilles sous le plafond.
        ((25.20, 151.24, z + 2.16, 25.80, 151.31, z + 2.70), f"aplat:{SOMBRE}", "-y"),
        ((25.25, 151.20, z + 2.21, 25.75, 151.24, z + 2.65), f"aplat:{PAPIER}", "-y"),
        ((25.48, 151.18, z + 2.40, 25.52, 151.20, z + 2.61), f"aplat:{SOMBRE}", "-y"),
        ((25.50, 151.17, z + 2.39, 25.69, 151.20, z + 2.43), f"aplat:{SOMBRE}", "-y"),
    ])
    for centre_x in (24.65, 26.35):
        pointage.append(((centre_x - 0.31, 151.30, z + 0.96,
                          centre_x + 0.31, 151.56, z + 1.82), f"aplat:{SOMBRE}", "-y"))
        pointage.append(((centre_x - 0.27, 151.26, z + 1.00,
                          centre_x + 0.27, 151.30, z + 1.78), f"aplat:{CASIER}", "-y"))
        for carte in range(5):
            zz = 1.12 + carte * 0.12
            pointage.append(((centre_x - 0.22, 151.23, z + zz,
                              centre_x + 0.22, 151.26, z + zz + 0.065), f"aplat:{PAPIER}", "-y"))
            pointage.append(((centre_x - 0.18, 151.21, z + zz + 0.02,
                              centre_x - 0.10, 151.23, z + zz + 0.04),
                             "aplat:#d8231f" if carte == 4 else f"aplat:{ACIER}", "-y"))
    H.boxes("vs_pointeuse_details", pointage, "palette", props)

    # Tableau d'affichage face à la porte d'arrivée : planning et portrait du
    # Directeur, à gauche de la pointeuse, sans se cacher derrière les casiers.
    H.boxes("vs_tableau_affichage", [
        ((21.00, 151.58, z + 0.94, 23.35, 151.70, z + 2.60), f"aplat:{CASIER}", "-y"),
        ((21.08, 151.48, z + 1.02, 23.27, 151.58, z + 2.52), "aplat:#806e5a", "-y"),
        ((21.16, 151.42, z + 1.10, 23.19, 151.48, z + 2.44), f"aplat:{PAPIER}", "-y"),
        ((21.28, 151.38, z + 1.28, 21.98, 151.42, z + 2.22), "aplat:#2f3541", "-y"),
        ((21.38, 151.35, z + 1.42, 21.88, 151.38, z + 2.10), f"aplat:{VERT}", "-y"),
        ((21.44, 151.32, z + 1.86, 21.51, 151.35, z + 1.93), "aplat:#f2c230", "-y"),
        ((21.72, 151.32, z + 1.86, 21.79, 151.35, z + 1.93), "aplat:#f2c230", "-y"),
        ((22.12, 151.38, z + 1.25, 22.55, 151.42, z + 1.34), "aplat:#d8231f", "-y"),
        ((22.12, 151.38, z + 1.40, 22.55, 151.42, z + 1.48), "aplat:#6eb4d6", "-y"),
        ((22.12, 151.38, z + 1.93, 22.85, 151.42, z + 2.20), "aplat:#d8231f", "-y"),
    ], "palette", props)

    # Banc et patères près de l'entrée, hors du passage vers le fournil.
    L.place(F.banc(), (22.5, 142.5, z), 0, props, col_coll, "vs_banc")
    crochets = [((20.28, 141.00, z + 1.78, 20.36, 143.40, z + 1.86), "world", "+x")]
    for i in range(5):
        hy = 141.15 + i * 0.43
        crochets.extend([
            ((20.33, hy, z + 1.52, 20.58, hy + 0.045, z + 1.78), "world", "+x"),
            ((20.52, hy - 0.06, z + 1.70, 20.59, hy + 0.10, z + 1.76), "world", "+x"),
        ])
    H.boxes("vs_patères", crochets, "metal_bac_acier", props)

    # Salle de douches séparée, attenante aux vestiaires : deux postes ouverts,
    # grand sol carrelé commun, aucun bac ni cabine qui rétrécit l'espace.
    porte_douches = (30.25, 31.75)
    parois = [
        ((27.75, 147.0, z, 28.0, 151.75, z + 3.0), f"aplat:{ACIER}"),
        ((28.0, 146.875, z, porte_douches[0], 147.125, z + 3.0), f"aplat:{ACIER}"),
        ((porte_douches[1], 146.875, z, 33.75, 147.125, z + 3.0), f"aplat:{ACIER}"),
        ((porte_douches[0], 146.875, z + 2.15, porte_douches[1], 147.125, z + 3.0),
         f"aplat:{ACIER}"),
    ]
    H.boxes("vs_douches_cloison", parois, "palette", props)
    for i, (bounds, _) in enumerate(parois):
        # La traverse au-dessus de la porte commence à 2,15 m : son mesh
        # ferme visuellement l'ouverture, mais n'a pas besoin de collider.
        if i < 3:
            H.col_box(f"vs_douches_cloison_{i}", bounds, col_coll)

    # Double porte vitrée dépolie, qui s'ouvre dans la pièce humide. La traverse
    # au-dessus est pleine : aucune vue ni ouverture vers la gaine ou le PC.
    ouverture_douches = plan.Opening("vestiaires", "douches", "y", 147.0,
                                     porte_douches, z, z)
    porte_double(ouverture_douches, ("door_douches_g", "door_douches_d"), 2.15,
                 "portes_verre", "porte:porte_vav", props,
                 dict(sens="auto", auto=True, portee=1.4, referme=True, delai=0.8,
                      groupe="vestiaires_douches"), vers=1)

    # Plaque pictogramme au-dessus de l'entrée : douche immédiatement lisible.
    H.boxes("vs_panneau_douches", [
        ((30.42, 146.72, z + 2.32, 31.58, 146.84, z + 2.80), "aplat:#2f3541", "-y"),
        ((30.63, 146.68, z + 2.61, 31.27, 146.72, z + 2.66), f"aplat:{PAPIER}", "-y"),
        ((31.18, 146.68, z + 2.47, 31.23, 146.72, z + 2.62), f"aplat:{PAPIER}", "-y"),
        ((30.62, 146.68, z + 2.42, 30.67, 146.72, z + 2.57), f"aplat:{PAPIER}", "-y"),
    ], "palette", props)

    # Sol humide à niveau, avec caniveau affleurant — rien à enjamber.
    H.box("vs_douches_sol", (28.02, 147.28, z + 0.004,
                              33.73, 151.72, z + 0.014),
          "palette", props, uv="aplat:#8999b1")
    caniveau = [((30.93, 147.55, z + 0.015, 31.07, 151.52, z + 0.025), f"aplat:{SOMBRE}")]
    for i in range(12):
        yy = 147.70 + i * 0.32
        caniveau.append(((30.84, yy, z + 0.016, 31.16, yy + 0.035, z + 0.026),
                         f"aplat:{ACIER}"))
    H.boxes("vs_douches_caniveau", caniveau, "palette", props)

    tuyaux = []
    for numero, cx in enumerate((29.25, 32.50), start=1):
        # Réseau apparent, pommeau en disque, commande dédiée à chaque poste.
        tuyaux.extend([
            ((cx - 0.04, 151.45, z + 0.72, cx + 0.04, 151.58, z + 2.12), "world"),
            ((cx - 0.04, 150.95, z + 2.06, cx + 0.04, 151.50, z + 2.14), "world"),
            ((cx - 0.18, 150.82, z + 2.02, cx + 0.18, 151.02, z + 2.08), "world"),
            ((cx - 0.18, 151.43, z + 1.02, cx + 0.18, 151.60, z + 1.37), f"aplat:{ACIER}"),
            ((cx - 0.11, 151.25, z + 1.13, cx + 0.11, 151.44, z + 1.21), "aplat:#f2c230"),
        ])
        commande = H.box(f"use_douche_{numero}",
                         (cx - 0.14, 151.35, z + 0.96, cx + 0.14, 151.58, z + 1.30),
                         "palette", props, uv=f"aplat:{ACIER}")
        _centrer_origine(commande)
        # Colonne continue ; le shader TSL ajoute les filets qui défilent.
        flux = H.box(f"fx_douche_{numero}_stream_0",
                     (cx - 0.11, 150.85, z + 0.25,
                      cx + 0.11, 150.99, z + 2.02),
                     "palette", props, uv="aplat:#6eb4d6")
        _centrer_origine(flux)
    H.boxes("vs_douches_tuyaux", tuyaux, "metal_bac_acier", props)
    lampe(logic, "light_vs_douches", (31.0, 149.4, z + 2.25),
          color="#a7d5e2", intensity=4.5, distance=6.5)

    # Six réglettes au-dessus des allées; une est grillée (un tube sur six).
    reglettes, tubes = [], []
    lampes = 0
    positions = ((22.5, 142.5), (27.0, 142.5), (31.5, 142.5),
                 (22.5, 150.0), (27.0, 150.0), (31.5, 150.0))
    mort = (31.5, 150.0)
    for i, (lx, ly) in enumerate(positions):
        reglettes.append(((lx - 1.25, ly - 0.10, z + 2.76,
                           lx + 1.25, ly + 0.10, z + 2.90), "world"))
        teinte = "#767676" if (lx, ly) == mort else "#d5d7d8"
        tubes.append(((lx - 1.10, ly - 0.035, z + 2.72,
                       lx + 1.10, ly + 0.035, z + 2.77), f"aplat:{teinte}"))
        if (lx, ly) != mort:
            lampe(logic, f"light_vs_{i}", (lx, ly, z + 2.25),
                  color="#c6d2b9", intensity=5.0, distance=9.0)
            lampes += 1
    H.boxes("vs_reglettes", reglettes, "metal_bac_acier", props)
    H.boxes("vs_tubes", tubes, "palette", props)

    return {"façades de casiers": 4, "modules": 30, "douches": 2,
            "bancs": 1, "lampes": lampes}
