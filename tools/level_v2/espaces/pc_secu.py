"""PC sécurité et ses caméras.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_bureaux as B           # noqa: E402
import plan_de_masse as plan      # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import _emprise, cloison_pleine, lampe, poser
from espaces.coque import EPAISSEUR_PLAFOND
from espaces.portes import HAUTEUR_VANTAIL, porte_double

# --- Habillage : PC sécurité, le PILOTE des coulisses v2 --------------------
# `pc_secu` exerce les systèmes d'écrans et de caméras : huit CRT construits
# ici, un poste E qui parcourt six caméras, le vigile endormi et son guichet.

# (nom, chaîne) des six caméras de la console — voir `poser_cameras_pc_secu`
# pour leur position/visée réelle. Dans l'ordre où E les fait défiler.
PC_SECU_CAMS = ("cam_rayons", "cam_hub", "cam_reserve", "cam_souterrain",
               "cam_electro", "cam_direction")


def poser_cameras_pc_secu(props, logic) -> int:
    """Les six `cam_*` cyclées par `use_pc_secu` — un point de vue par grand
    espace du niveau, dont un cadrant le Directeur à son poste
    (`spawn_director_bu1`, plan de masse). Empties : rendues dans `logic`,
    jamais dans `props` (voir `validate_level.py::cam_*`, EMPTY obligatoire)."""
    H.cam("rayons", (-30.0, 75.0, 2.6), (-30.0, 50.0, 1.0), logic, "RAYONS")
    H.cam("hub", (0.0, 86.0, 3.2), (0.0, 48.0, 1.0), logic, "ALLEE CENTRALE")
    H.cam("reserve", (8.0, 126.0, 5.0), (-8.0, 100.0, 1.0), logic, "RESERVE")
    H.cam("souterrain", (68.0, 118.0, -4.0), (34.0, 96.0, -5.0), logic, "PARKING -1")
    H.cam("electro", (38.0, 74.0, 3.0), (14.0, 52.0, 1.0), logic, "ELECTROMENAGER")
    H.cam("direction", (-42.0, 149.0, 6.2), (-38.0, 159.0, 5.2), logic, "DIRECTION")
    return len(PC_SECU_CAMS)


# La cloison sépare le sas d'accueil du poste. Une seconde délimite le passage
# technique à l'est; la grille de gaine reste au niveau haut des marches.
PS_PARTITION_Y0, PS_PARTITION_Y1 = 144.25, 144.5   # cloison, épaisseur 0,25 m
PS_PORTE_INT = (37.25, 38.75)                       # passage aligné sur l'entrée
PS_FENETRE_INT = (39.25, 42.0)                      # guichet vitré intérieur
PS_SERVICE_X0, PS_SERVICE_X1 = 42.35, 42.60         # séparation poste / passage technique
PS_SERVICE_PORTE = (150.35, 151.50)                # accès aux marches de la gaine
PS_GAINE_PUITS_X = (43.75, 45.75)
PS_GAINE_PUITS_Y = (150.0, 152.0)


def habiller_pc_secu(space, gris, props, col_coll, logic) -> dict:
    """Poste de surveillance du board (`docs/assets/board-coulisses.md`, 3.2.C).

    Une porte vitrée donne sur le couloir, puis un passage cadré sans vantail
    mène au guichet et au poste. Consoles, meubles CRT, chaise et supports sont
    construits ici; seuls le vigile CC0 et les flux animés viennent d'assets.
    Le plafond reste continu au-dessus de l'escalier d'accès à la gaine."""
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    t = bo.EPAISSEUR_MUR
    ht = z + space.hauteur
    # Nettement plus sombre que `mur_platre` (institutionnel clair) : après la
    # 1ère passe, `#444a54` s'y confondait à l'œil (soubassement invisible au
    # rendu). `#2f3541` est déjà la couleur du plafond — cohérent, et lisible.
    WAINSCOT, CEILING_DARK = "#2f3541", "#2f3541"

    def wainscot(nom, x_a, x_b, y_a, y_b):
        """Soubassement peint, 1 m de haut, 3 cm en saillie du mur — jamais à
        fleur (z-fighting, voir `retro-texture-density`)."""
        H.box(nom, (x_a, y_a, z, x_b, y_b, z + 1.0), "palette", props, uv=f"aplat:{WAINSCOT}")

    # --- Plafond sombre, continu au-dessus des dernières marches.
    H.box("plafond_ps_guichet", (x0, y0, ht, x1, PS_PARTITION_Y0, ht + EPAISSEUR_PLAFOND),
          "palette", props, uv=f"aplat:{CEILING_DARK}")
    px0, px1 = PS_GAINE_PUITS_X
    py0, py1 = PS_GAINE_PUITS_Y
    ceiling_parts = [
        ((x0, PS_PARTITION_Y1, ht, px0, y1, ht + EPAISSEUR_PLAFOND), f"aplat:{CEILING_DARK}"),
        ((px1, PS_PARTITION_Y1, ht, x1, y1, ht + EPAISSEUR_PLAFOND), f"aplat:{CEILING_DARK}"),
        ((px0, PS_PARTITION_Y1, ht, px1, py0, ht + EPAISSEUR_PLAFOND), f"aplat:{CEILING_DARK}"),
        ((px0, py0, ht, px1, py1, ht + EPAISSEUR_PLAFOND), f"aplat:{CEILING_DARK}"),
    ]
    H.boxes("plafond_ps_moniteurs", ceiling_parts, "palette", props)
    puits_walls = [
        ((px0 + 0.12, py0, ht, px1 - 0.12, py0 + 0.12, ht + 1.0), f"aplat:{WAINSCOT}"),
        ((px0, py0 + 0.12, ht, px0 + 0.12, py1, ht + 1.0), f"aplat:{WAINSCOT}"),
        ((px1 - 0.12, py0 + 0.12, ht, px1, py1, ht + 1.0), f"aplat:{WAINSCOT}"),
    ]
    H.boxes("ps_gaine_puits", puits_walls, "palette", props)
    for i, (bounds, _uv) in enumerate(puits_walls):
        H.col_box(f"ps_gaine_puits_{i}", bounds, col_coll)

    # --- Cloison vitrée entre sas et poste : passage central aligné avec la
    # porte extérieure, guichet à droite, parois pleines jusqu'aux murs latéraux.
    px0, px1 = PS_PORTE_INT
    fx0, fx1 = PS_FENETRE_INT
    # Insérée entre les murs est/ouest de la coque (`x0 + t` .. `x1 - t`) :
    # aux bornes brutes `x0`/`x1`, elle recouvrait 0,25 m du mur périmétrique
    # (trouvé par `audit_niveau.py`).
    for a, b in ((x0 + t, px0), (px1, fx0), (fx1, x1 - t)):
        if b - a > 0.01:
            cloison_pleine(f"ps_cloison_{a:.2f}", (a, PS_PARTITION_Y0, z, b, PS_PARTITION_Y1, ht), props, col_coll,
                            texture="mur_platre")
    H.box("ps_cloison_allege", (fx0, PS_PARTITION_Y0, z, fx1, PS_PARTITION_Y1, z + 0.9),
          "metal_bac_acier", props)
    H.col_box("ps_cloison_allege", (fx0, PS_PARTITION_Y0, z, fx1, PS_PARTITION_Y1, z + 0.9), col_coll)
    H.box("ps_cloison_bandeau", (fx0, PS_PARTITION_Y0, z + 2.2, fx1, PS_PARTITION_Y1, ht),
          "mur_platre", props)
    # Le guichet garde une fente étroite au-dessus du comptoir; la vitre reste
    # pleine du point de vue du joueur, avec un collider sur toute la baie.
    gx_mid0, gx_mid1 = 40.2, 41.0
    vitre_parts = [
        ((fx0, PS_PARTITION_Y0, z + 0.9, fx1, PS_PARTITION_Y1, z + 1.12), f"aplat:{H.VERRE_TEINTE}"),
        ((fx0, PS_PARTITION_Y0, z + 1.30, fx1, PS_PARTITION_Y1, z + 2.2), f"aplat:{H.VERRE_TEINTE}"),
        ((fx0, PS_PARTITION_Y0, z + 1.12, gx_mid0, PS_PARTITION_Y1, z + 1.30), f"aplat:{H.VERRE_TEINTE}"),
        ((gx_mid1, PS_PARTITION_Y0, z + 1.12, fx1, PS_PARTITION_Y1, z + 1.30), f"aplat:{H.VERRE_TEINTE}"),
    ]
    H.boxes("vitre_ps_cloison", vitre_parts, "verre", props)
    H.col_box("ps_cloison_vitre", (fx0, PS_PARTITION_Y0, z + 0.9, fx1, PS_PARTITION_Y1, z + 2.2), col_coll)
    cloison_pleine("ps_cloison_linteau_passe", (px0, PS_PARTITION_Y0, z + 2.15,
                                                   px1, PS_PARTITION_Y1, ht), props, col_coll,
                    texture="mur_platre")
    H.boxes("ps_passe_poste_cadre", [
        ((px0 - 0.07, PS_PARTITION_Y0 - 0.035, z, px0, PS_PARTITION_Y1 + 0.035, z + 2.12),
         "aplat:#444a54"),
        ((px1, PS_PARTITION_Y0 - 0.035, z, px1 + 0.07, PS_PARTITION_Y1 + 0.035, z + 2.12),
         "aplat:#444a54"),
        ((px0, PS_PARTITION_Y0 - 0.035, z + 2.15, px1, PS_PARTITION_Y1 + 0.035, z + 2.22),
         "aplat:#767676"),
    ], "palette", props)
    porte_double(plan.Opening("pc_secu", "pc_poste", "y",
                              (PS_PARTITION_Y0 + PS_PARTITION_Y1) / 2,
                              (px0, px1), z, z),
                 ("door_pc_poste_g", "door_pc_poste_d"), 2.15,
                 "portes_pc", "porte:porte_pc", props,
                 dict(sens="auto", auto=True, portee=1.8, referme=True, delai=0.6,
                      groupe="pc_poste"), vers=1)

    # Passage technique à l'est : le poste de surveillance fait 8,1 × 7,25 m
    # (≈59 m²). L'ouverture au nord mène directement aux marches de la gaine.
    sy0, sy1 = PS_SERVICE_PORTE
    for a, b in ((PS_PARTITION_Y1, sy0), (sy1, y1 - t)):
        if b - a > 0.01:
            cloison_pleine("ps_cloison_service", (PS_SERVICE_X0, a, z, PS_SERVICE_X1, b, ht),
                            props, col_coll, texture="mur_platre")
    H.boxes("ps_passage_technique_cadre", [
        ((PS_SERVICE_X0 - 0.04, sy0 - 0.08, z, PS_SERVICE_X1 + 0.04, sy0, z + 2.35), "aplat:#444a54"),
        ((PS_SERVICE_X0 - 0.04, sy1, z, PS_SERVICE_X1 + 0.04, sy1 + 0.08, z + 2.35), "aplat:#444a54"),
        ((PS_SERVICE_X0 - 0.04, sy0, z + 2.35, PS_SERVICE_X1 + 0.04, sy1, z + 2.45), "aplat:#babcbc"),
    ], "palette", props)
    # =========================== SAS D'ACCUEIL ==============================
    gy0, gy1 = y0, PS_PARTITION_Y0
    wainscot("ps_g_soub_o", x0 + t, x0 + t + 0.03, gy0 + t, gy1 - t)
    wainscot("ps_g_soub_e", x1 - t - 0.03, x1 - t, gy0 + t, gy1 - t)

    # L'entrée sud vitrée déclarée au plan : cadre métallique et panneau de
    # vidéosurveillance, vu dès l'approche depuis le couloir.
    entree = next(o for o in plan.openings()
                  if frozenset({o.a, o.b}) == frozenset({"c_bu", "pc_secu"}))
    ex0, ex1 = entree.span
    cadre_entree = [
        ((ex0, y0 - 0.07, z, ex0 + 0.09, y0 + 0.07, z + 2.18), "aplat:#444a54"),
        ((ex1 - 0.09, y0 - 0.07, z, ex1, y0 + 0.07, z + 2.18), "aplat:#444a54"),
        ((ex0, y0 - 0.07, z + 2.10, ex1, y0 + 0.07, z + 2.20), "aplat:#444a54"),
        ((ex0 + 0.04, y0 - 0.04, z, ex1 - 0.04, y0 + 0.04, z + 0.025), "aplat:#babcbc"),
    ]
    H.boxes("ps_entree_dormant", cadre_entree, "palette", props)
    H.col_box("pc_entree_linteau",
              (ex0, y0 - 0.25, z + HAUTEUR_VANTAIL[frozenset({"c_bu", "pc_secu"})],
               ex1, y0 + 0.25, ht), col_coll)
    H.box("ps_entree_enseigne", ((ex0 + ex1) / 2 - 1.0, y0 - 0.30, z + 2.37,
                                 (ex0 + ex1) / 2 + 1.0, y0 - 0.25, z + 2.82),
          "palette", props, uv="aplat:#d8231f", front="-y")
    H.boxes("ps_entree_icone", [
        (((ex0 + ex1) / 2 - 0.42, y0 - 0.34, z + 2.54,
          (ex0 + ex1) / 2 + 0.18, y0 - 0.31, z + 2.68), "aplat:#dbd0c4", "-y"),
        (((ex0 + ex1) / 2 + 0.18, y0 - 0.34, z + 2.57,
          (ex0 + ex1) / 2 + 0.34, y0 - 0.31, z + 2.65), "aplat:#dbd0c4", "-y"),
        (((ex0 + ex1) / 2 - 0.08, y0 - 0.34, z + 2.43,
          (ex0 + ex1) / 2 + 0.02, y0 - 0.31, z + 2.54), "aplat:#dbd0c4", "-y"),
    ], "palette", props)

    # Comptoir de réception dans la cloison intérieure, face au sas. Deux
    # montants portent le plateau jusqu'au sol; la vitre et son hygiaphone
    # cadrent la fente de service.
    H.box("ps_guichet_comptoir", (fx0 + 0.12, PS_PARTITION_Y0 - 0.48, z + 0.91,
                                  fx1 - 0.12, PS_PARTITION_Y0 + 0.02, z + 1.02),
          "metal_bac_acier", props)
    H.col_box("ps_guichet_comptoir", (fx0 + 0.12, PS_PARTITION_Y0 - 0.48, z + 0.91,
                                      fx1 - 0.12, PS_PARTITION_Y0 + 0.02, z + 1.02), col_coll)
    piliers_comptoir = [
        ((fx0 + 0.18, PS_PARTITION_Y0 - 0.20, z, fx0 + 0.32, PS_PARTITION_Y0 - 0.04, z + 0.91), "world"),
        ((fx1 - 0.32, PS_PARTITION_Y0 - 0.20, z, fx1 - 0.18, PS_PARTITION_Y0 - 0.04, z + 0.91), "world"),
    ]
    H.boxes("ps_guichet_piliers", piliers_comptoir, "metal_bac_acier", props)
    for i, (bounds, _uv) in enumerate(piliers_comptoir):
        H.col_box(f"ps_guichet_pilier_{i}", bounds, col_coll)
    H.box("ps_guichet_plateau", (40.15, PS_PARTITION_Y0 - 0.40, z + 1.02,
                                  40.95, PS_PARTITION_Y0 - 0.08, z + 1.06),
          "palette", props, uv="aplat:#bdae9a")
    H.boxes("ps_guichet_hygiaphone", [
        ((40.35, PS_PARTITION_Y0 - 0.035, z + 1.35, 40.85, PS_PARTITION_Y0 - 0.015, z + 1.51), "aplat:#767676"),
        ((40.43, PS_PARTITION_Y0 - 0.04, z + 1.52, 40.77, PS_PARTITION_Y0 - 0.015, z + 1.57), "aplat:#babcbc"),
    ], "palette", props)
    H.boxes("ps_guichet_perforations", [
        ((40.45 + i * 0.055, PS_PARTITION_Y0 - 0.045, z + 1.39,
          40.47 + i * 0.055, PS_PARTITION_Y0 - 0.041, z + 1.46), "aplat:#111014")
        for i in range(5)
    ], "palette", props)
    H.box("ps_guichet_panneau", (39.85, PS_PARTITION_Y0 - 0.025, z + 2.40,
                                 41.35, PS_PARTITION_Y0 + 0.01, z + 2.78),
          "palette", props, uv="aplat:#deb789")
    H.box("ps_guichet_panneau_bandeau", (39.85, PS_PARTITION_Y0 - 0.03, z + 2.63,
                                          41.35, PS_PARTITION_Y0 - 0.01, z + 2.78),
          "palette", props, uv="aplat:#d8231f")

    # Affiche de consignes, bien en vue en entrant : un aplat blanc cassé, un
    # bandeau rouge — lisible comme une affiche réglementaire sans texte.
    H.box("ps_affiche", (x0 + t, gy0 + 2.6, z + 1.3, x0 + t + 0.03, gy0 + 3.3, z + 2.0),
          "palette", props, uv="aplat:#deb789")
    H.box("ps_affiche_bandeau", (x0 + t + 0.031, gy0 + 2.6, z + 1.85, x0 + t + 0.034, gy0 + 3.3, z + 2.0),
          "palette", props, uv="aplat:#d8231f")

    # Vue sur l'intérieur allumé, depuis le couloir sombre : une petite source
    # chaude juste derrière la vitre, en plus du tube du guichet.
    lampe(logic, "light_ps_guichet_vitre", (40.6, PS_PARTITION_Y1 + 0.75, z + 1.65),
          color="#f2b25a", intensity=1.2, distance=3.0)

    # ========================= SALLE DES MONITEURS ===========================
    my0, my1 = PS_PARTITION_Y1, y1
    wainscot("ps_m_soub_o", x0 + t, x0 + t + 0.03, my0 + t, my1 - t)
    wainscot("ps_m_soub_e", x1 - t - 0.03, x1 - t, my0 + t, my1 - t)

    # --- Mur de huit CRT fabriqués ici, en deux rangées de quatre. Chaque
    # écran a un caisson, un bezel, des boutons et une vraie tablette de support.
    ny = y1 - t
    centres = (35.25, 37.25, 39.25, 41.25)
    rangs = ((0.42, 1.47), (1.56, 2.61))
    chaines = ("cctv", "cctv", "cctv", "foot", "cctv", "journal", "pub", "cctv")
    hs = 6
    n = 0
    caissons, bezels, commandes, cadres = [], [], [], []
    ecrans = []
    for row, (bas, haut) in enumerate(rangs):
        for col, cx in enumerate(centres):
            i = row * 4 + col
            bas, haut = z + bas, z + haut
            caissons.append(((cx - 0.85, ny - 0.42, bas, cx + 0.85, ny, haut),
                              "aplat:#443e3b"))
            ex0, ex1 = cx - 0.61, cx + 0.61
            ez0, ez1 = bas + 0.18, haut - 0.23
            ey0, ey1 = ny - 0.48, ny - 0.42
            bezels.extend([
                ((cx - 0.69, ey0, ez0 - 0.06, cx - 0.60, ey1, ez1 + 0.06), "aplat:#111014"),
                ((cx + 0.60, ey0, ez0 - 0.06, cx + 0.69, ey1, ez1 + 0.06), "aplat:#111014"),
                ((cx - 0.60, ey0, ez0 - 0.06, cx + 0.60, ey1, ez0), "aplat:#111014"),
                ((cx - 0.60, ey0, ez1, cx + 0.60, ey1, ez1 + 0.06), "aplat:#111014"),
            ])
            ecrans.append((i, (ex0, ey0 - 0.012, ez0, ex1, ey0 + 0.012, ez1)))
            # Trois boutons et une bande de voyants identifient la commande de
            # chaque canal; un voyant rouge fixe signale le CRT hors service.
            for j, color in enumerate(("#babcbc", "#f2c230", "#d8231f")):
                commandes.append(((cx - 0.32 + j * 0.16, ny - 0.49, bas + 0.045,
                                   cx - 0.25 + j * 0.16, ny - 0.46, bas + 0.115),
                                  f"aplat:{'#d8231f' if i == hs and j == 2 else color}"))
            cadres.append(((cx - 0.82, ny - 0.12, bas, cx - 0.77, ny - 0.04, haut), "aplat:#767676"))
            cadres.append(((cx + 0.77, ny - 0.12, bas, cx + 0.82, ny - 0.04, haut), "aplat:#767676"))
    H.boxes("ps_crt_caissons", caissons, "palette", props)
    H.boxes("ps_crt_bezels", bezels, "palette", props)
    H.boxes("ps_crt_commandes", commandes, "palette", props)
    H.boxes("ps_crt_rails", cadres, "palette", props)
    H.boxes("ps_crt_support", [
        ((34.35, ny - 0.46, z, 42.15, ny, z + 0.28), "aplat:#2f3541"),
        ((34.35, ny - 0.46, z + 1.47, 42.15, ny, z + 1.56), "aplat:#767676"),
        *((((centre_gauche + centre_droit) / 2 - 0.035, ny - 0.40, z + 0.28,
              (centre_gauche + centre_droit) / 2 + 0.035, ny - 0.05, z + 2.61), "aplat:#767676")
          for centre_gauche, centre_droit in zip(centres, centres[1:])),
    ], "palette", props)
    H.col_box("ps_crt_support", (34.35, ny - 0.46, z, 42.15, ny, z + 2.61), col_coll)
    for i, (index, bounds) in enumerate(ecrans):
        if index == hs:
            H.box("ps_ecran_hs", bounds, "prd_ecrans", props, uv="label:ecran_eteint")
        else:
            H.ecran(f"ps_{n}", bounds, chaines[index], props, pv=30)
            n += 1

    # Trois magnétoscopes time-lapse fabriqués sur un rack indépendant, contre
    # le côté est du poste, hors du passage menant aux marches VMC.
    vx, vw = 41.15, 0.86
    vy, vfin = 148.10, 149.05
    chassi, fentes, diodes, commandes = [], [], [], []
    for i in range(3):
        vz = z + 0.48 + i * 0.24
        chassi.append(((vx, vy, vz, vx + vw, vfin, vz + 0.20), "aplat:#605c58"))
        fentes.append(((vx + 0.12, vy - 0.025, vz + 0.09, vx + 0.62, vy - 0.005, vz + 0.14), "aplat:#111014"))
        diodes.append(((vx + 0.69, vy - 0.03, vz + 0.06, vx + 0.74, vy - 0.005, vz + 0.11), "aplat:#d8231f"))
        commandes.append(((vx + 0.12, vy - 0.025, vz + 0.04, vx + 0.20, vy - 0.005, vz + 0.08), "aplat:#babcbc"))
    H.boxes("ps_vcr_chassis", chassi, "palette", props)
    H.boxes("ps_vcr_fentes", fentes, "palette", props)
    H.boxes("ps_vcr_diodes", diodes, "palette", props)
    H.boxes("ps_vcr_commandes", commandes, "palette", props)
    # Le bloc de magnétoscopes repose sur un rack métallique étroit. Le plateau
    # rejoint exactement le dessous du premier magnétoscope (z = 0,48 m); les
    # montants restent hors de la façade et de ses commandes.
    rx0, rx1 = vx - 0.08, vx + vw + 0.08
    ry0, ry1 = vy - 0.05, vfin + 0.08
    H.box("ps_vcr_rack_plateau", (rx0, ry0, z + 0.42, rx1, ry1, z + 0.48),
          "metal_bac_acier", props)
    H.boxes("ps_vcr_rack_pieds", [
        ((rx0, ry0, z, rx0 + 0.06, ry0 + 0.06, z + 0.43), "world"),
        ((rx1 - 0.06, ry0, z, rx1, ry0 + 0.06, z + 0.43), "world"),
        ((rx0, ry1 - 0.06, z, rx0 + 0.06, ry1, z + 0.43), "world"),
        ((rx1 - 0.06, ry1 - 0.06, z, rx1, ry1, z + 0.43), "world"),
    ], "metal_bac_acier", props)

    # --- Console fabriquée en U ouvert côté opérateur. Le vigile est pile en
    # face du poste; le gros écran de commande et son interaction sont centrés.
    cx = 38.30
    dy0, dy1 = 148.75, 149.80
    console_parts = [
        ((36.60, dy0, z + 0.12, 37.25, dy1 - 0.08, z + 0.91), "aplat:#443e3b"),
        ((39.35, dy0, z + 0.12, 40.00, dy1 - 0.08, z + 0.91), "aplat:#443e3b"),
        ((36.60, dy0, z + 0.12, 40.00, dy0 + 0.10, z + 0.23), "aplat:#2f3541"),
        ((36.48, dy0 - 0.03, z + 0.91, 40.12, dy1, z + 1.04), "aplat:#605c58"),
        ((36.48, dy1 - 0.09, z + 1.04, 40.12, dy1, z + 1.16), "aplat:#767676"),
    ]
    H.boxes("ps_console_structure", console_parts, "palette", props)
    H.col_box("ps_console", (36.48, dy0, z + 0.12, 40.12, dy1, z + 0.96), col_coll)
    H.boxes("ps_console_facades", [
        ((36.78, dy0 - 0.025, z + 0.38, 37.07, dy0 + 0.015, z + 0.72), "aplat:#2f3541"),
        ((39.56, dy0 - 0.025, z + 0.38, 39.85, dy0 + 0.015, z + 0.72), "aplat:#2f3541"),
        ((36.78, dy0 - 0.03, z + 0.77, 37.07, dy0 + 0.015, z + 0.82), "aplat:#d8231f"),
        ((39.56, dy0 - 0.03, z + 0.77, 39.85, dy0 + 0.015, z + 0.82), "aplat:#f2c230"),
    ], "palette", props)
    # Écran de commande, monté dans un boîtier incliné par son socle; son face
    # tournée vers le sud regarde exactement le vigile assis.
    mx = cx + 0.65
    H.box("ps_console_ecran_pied", (mx - 0.08, dy1 - 0.20, z + 1.04,
                                    mx + 0.08, dy1 - 0.10, z + 1.14),
          "palette", props, uv="aplat:#767676")
    H.box("ps_console_ecran_boitier", (mx - 0.50, dy1 - 0.08, z + 1.13,
                                        mx + 0.50, dy1 + 0.01, z + 1.64),
          "palette", props, uv="aplat:#111014")
    H.box("ps_console_ecran_bord", (mx - 0.44, dy1 - 0.095, z + 1.19,
                                     mx + 0.44, dy1 - 0.075, z + 1.58),
          "palette", props, uv="aplat:#767676")
    console_screen = (mx - 0.39, dy1 - 0.11, z + 1.23,
                      mx + 0.39, dy1 - 0.09, z + 1.54)
    H.ecran("ps_console", console_screen, "cctv", props, pv=30)
    n += 1
    boutons = []
    for i, color in enumerate(("#d8231f", "#f2c230", "#babcbc", "#babcbc", "#d8231f",
                               "#f2c230", "#babcbc", "#babcbc", "#d8231f", "#f2c230")):
        bx = 37.05 + (i % 5) * 0.25
        by = 148.94 + (i // 5) * 0.26
        boutons.append(((bx, by, z + 1.04, bx + 0.12, by + 0.10, z + 1.09), f"aplat:{color}"))
    H.boxes("ps_console_boutons", boutons, "palette", props)
    # Téléphone rouge dédié aux urgences; combiné et socle reposent sur le
    # plateau, à gauche des commandes vidéo.
    H.boxes("ps_console_telephone", [
        ((36.78, 149.52, z + 1.04, 37.15, 149.76, z + 1.09), "aplat:#d8231f"),
        ((36.82, 149.57, z + 1.09, 37.10, 149.67, z + 1.14), "aplat:#111014"),
        ((36.79, 149.54, z + 1.15, 37.14, 149.70, z + 1.20), "aplat:#babcbc"),
    ], "palette", props)
    H.cylinder("ps_console_joystick", (39.68, 149.42), 0.055, z + 1.04, z + 1.18,
               "metal_bac_acier", props, segments=8)
    H.box("ps_console_boule_joystick", (39.61, 149.35, z + 1.17,
                                        39.75, 149.49, z + 1.24),
          "palette", props, uv="aplat:#d8231f")

    # Chaise métallique à roulettes, elle aussi construite dans ce script.
    sx, sy = cx, 147.58
    H.boxes("ps_chaise_structure", [
        ((sx - 0.43, sy - 0.22, z + 0.55, sx + 0.43, sy + 0.30, z + 0.68), "aplat:#2f3541"),
        ((sx - 0.39, sy - 0.28, z + 0.68, sx - 0.30, sy - 0.18, z + 1.18), "aplat:#444a54"),
        ((sx + 0.30, sy - 0.28, z + 0.68, sx + 0.39, sy - 0.18, z + 1.18), "aplat:#444a54"),
        ((sx - 0.30, sy - 0.28, z + 0.68, sx + 0.30, sy - 0.18, z + 1.18), "aplat:#2f3541"),
        ((sx - 0.52, sy - 0.16, z + 0.65, sx - 0.41, sy + 0.23, z + 0.76), "aplat:#767676"),
        ((sx + 0.41, sy - 0.16, z + 0.65, sx + 0.52, sy + 0.23, z + 0.76), "aplat:#767676"),
        ((sx - 0.045, sy - 0.03, z + 0.14, sx + 0.045, sy + 0.03, z + 0.55), "aplat:#767676"),
        ((sx - 0.48, sy - 0.035, z + 0.09, sx + 0.48, sy + 0.035, z + 0.15), "aplat:#767676"),
        ((sx - 0.035, sy - 0.42, z + 0.09, sx + 0.035, sy + 0.42, z + 0.15), "aplat:#767676"),
    ], "palette", props)
    for i, (wx, wy) in enumerate(((sx - 0.43, sy), (sx + 0.43, sy), (sx, sy - 0.36),
                                  (sx, sy + 0.36))):
        H.box(f"ps_chaise_roulette_{i}", (wx - 0.07, wy - 0.07, z + 0.02,
                                          wx + 0.07, wy + 0.07, z + 0.10),
              "palette", props, uv="aplat:#111014")
    vigile = B.vigile_assis()
    largeur_vigile, _, _ = _emprise(vigile)
    # `poser` prend le coin inférieur de l'emprise : le centrer explicitement
    # sur l'assise évite le décalage de 28 cm dû à l'origine asymétrique du GLB.
    # Un léger recul place le bassin contre le dossier, le rehaussement de 10 cm
    # pose les cuisses sur l'assise sans modifier l'alignement face aux écrans.
    poser(vigile, sx - largeur_vigile / 2, sy - 0.14, z + 0.10, "+y", props, props, "ps_vigile")

    bo.boite_centree("use_pc_secu", (cx, dy0 + 0.10, z + 1.11), (0.12, 0.12, 0.12),
                     "repere", {"repere": H.textured_material("metal_bac_acier")}, logic,
                     extras={"cameras": ",".join(PC_SECU_CAMS)})

    # Tableau à clés mural ouvert : cinq badges pendent, un crochet reste vide.
    ax0, ay0 = x0 + t, my0 + 1.65
    H.box("ps_cle_tableau", (ax0, ay0, z + 1.05, ax0 + 0.08, ay0 + 1.18, z + 2.2),
          "palette", props, uv="aplat:#605c58")
    H.boxes("ps_cle_cadre", [
        ((ax0 + 0.08, ay0 - 0.03, z + 1.02, ax0 + 0.13, ay0 + 1.21, z + 2.24), "aplat:#babcbc"),
        ((ax0 + 0.08, ay0 - 0.03, z + 1.02, ax0 + 0.13, ay0 + 1.21, z + 1.08), "aplat:#babcbc"),
        ((ax0 + 0.08, ay0 - 0.03, z + 2.18, ax0 + 0.13, ay0 + 1.21, z + 2.24), "aplat:#babcbc"),
    ], "palette", props)
    crochets, badges, anneaux, cles, dents = [], [], [], [], []
    for i in range(6):
        hy = ay0 + 0.12 + i * 0.18
        crochets.append(((ax0 + 0.13, hy, z + 1.94, ax0 + 0.30, hy + 0.035, z + 1.99), "aplat:#babcbc"))
        if i != 4:
            badges.append(((ax0 + 0.24, hy - 0.045, z + 1.84, ax0 + 0.29, hy + 0.045, z + 1.93),
                           "aplat:#f2c230" if i % 2 == 0 else "aplat:#d8231f"))
            anneaux.extend([
                ((ax0 + 0.27, hy - 0.055, z + 1.75, ax0 + 0.31, hy + 0.055, z + 1.78), "aplat:#d5d7d8"),
                ((ax0 + 0.27, hy - 0.055, z + 1.83, ax0 + 0.31, hy + 0.055, z + 1.86), "aplat:#d5d7d8"),
                ((ax0 + 0.27, hy - 0.055, z + 1.78, ax0 + 0.31, hy - 0.03, z + 1.83), "aplat:#d5d7d8"),
                ((ax0 + 0.27, hy + 0.03, z + 1.78, ax0 + 0.31, hy + 0.055, z + 1.83), "aplat:#d5d7d8"),
            ])
            cles.append(((ax0 + 0.28, hy - 0.012, z + 1.56, ax0 + 0.32, hy + 0.012, z + 1.75),
                         "aplat:#d5d7d8"))
            dents.append(((ax0 + 0.28, hy + 0.012, z + 1.56, ax0 + 0.32, hy + 0.06, z + 1.60),
                          "aplat:#d5d7d8"))
    H.boxes("ps_cle_crochets", crochets, "palette", props)
    H.boxes("ps_cle_badges", badges, "palette", props)
    H.boxes("ps_cle_anneaux", anneaux, "palette", props)
    H.boxes("ps_cle_cles", cles, "palette", props)
    H.boxes("ps_cle_dents", dents, "palette", props)

    # Tableau de planning des rondes, et tableau incendie près de la porte.
    H.box("ps_planning", (x1 - t - 0.08, my0 + 1.5, z + 1.2, x1 - t - 0.03, my0 + 2.7, z + 2.0),
          "palette", props, uv="aplat:#deb789", front="-x")

    # Tableau de signalisation incendie, près de la porte.
    H.box("ps_tableau_incendie", (x0 + t + 0.03, my0 + 0.3, z + 1.3, x0 + t + 0.08, my0 + 1.1, z + 2.0),
          "palette", props, uv="aplat:#d8231f", front="+x")

    # Petit coin de pause dans le passage technique : le placard porte la
    # machine à café et le plateau de donuts à hauteur de main (aucun objet ne
    # flotte au-dessus du meuble).
    H.box("ps_pause_meuble", (44.42, 145.38, z, 45.65, 146.62, z + 0.86),
          "metal_bac_acier", props)
    H.col_box("ps_pause_meuble", (44.42, 145.38, z, 45.65, 146.62, z + 0.86), col_coll)
    H.box("ps_pause_plateau", (44.28, 145.27, z + 0.86, 45.65, 146.73, z + 0.95),
          "palette", props, uv="aplat:#605c58")
    H.box("ps_cafe_machine", (44.96, 145.78, z + 0.95, 45.48, 146.35, z + 1.82),
          "palette", props, uv="aplat:#d8231f", front="-x")
    H.box("ps_cafe_ecran", (44.93, 145.91, z + 1.42, 44.96, 146.22, z + 1.63),
          "palette", props, uv="aplat:#111014", front="-x")
    H.box("ps_cafe_bec", (44.86, 146.02, z + 1.17, 44.95, 146.09, z + 1.34),
          "metal_bac_acier", props)
    H.box("ps_pause_plateau_donuts", (44.38, 145.72, z + 0.95, 44.90, 146.28, z + 1.00),
          "palette", props, uv="aplat:#bdae9a")

    # Escalier de cinq marches régulières (0,40 m), puis trappe grillagée
    # fermée vers la gaine. Le vide du plafond suit l'escalier : les 2 m de
    # dégagement restent libres jusqu'à l'autre côté de la porte.
    marches, nez_marches = [], []
    marche_x0, marche_x1 = 44.18, 45.32
    marche_y0 = PS_GAINE_PUITS_Y[0]
    for i in range(8):
        y_a, y_b = marche_y0 + i * 0.25, marche_y0 + (i + 1) * 0.25
        z_haut = z + (i + 1) * 0.25
        marches.append(((marche_x0, y_a, z, marche_x1, y_b, z_haut), "world"))
        nez_marches.append(((marche_x0, y_a - 0.015, z_haut - 0.045,
                             marche_x1, y_a + 0.015, z_haut - 0.01),
                            "aplat:#f2c230"))
        H.col_box(f"ps_gaine_marche_{i}", (marche_x0, y_a, z, marche_x1, y_b, z_haut), col_coll)
    H.boxes("ps_gaine_marches", marches, "metal_bac_acier", props)
    H.boxes("ps_gaine_nez_marches", nez_marches, "palette", props)
    # Joues de seuil : elles ferment les bandes de 18 cm de part et d'autre de
    # la dernière marche, tout en laissant 1,14 m de passage utile.
    joues = [
        (44.0, y1 - 0.25, z, marche_x0, y1, z + 2.0),
        (marche_x1, y1 - 0.25, z, 45.5, y1, z + 2.0),
    ]
    H.boxes("ps_gaine_joues", [(b, "aplat:#444a54") for b in joues], "palette", props)
    for i, bounds in enumerate(joues):
        H.col_box(f"ps_gaine_joue_{i}", bounds, col_coll)
    # Cadre rouge et jaune lisible depuis la salle, autour du vantail à z=2..4.
    H.boxes("ps_gaine_cadre", [
        ((43.96, y1 - 0.04, z + 2.0, 44.02, y1 + 0.04, z + 4.0), "aplat:#444a54"),
        ((45.48, y1 - 0.04, z + 2.0, 45.54, y1 + 0.04, z + 4.0), "aplat:#444a54"),
    ], "palette", props)

    # --- Lumière : froide et pauvre. Un seul tube faible côté guichet, la
    # lueur bleutée des écrans domine la salle des moniteurs, une lampe de
    # bureau chaude sur la console — jamais la grille neutre par défaut.
    lampe(logic, "light_ps_guichet", (x0 + 6.0, y0 + 2.0, ht - 0.4), color="#7fb0d8", intensity=1.5, distance=6.0)
    lampe(logic, "light_ps_ecrans_a", (38.0, ny - 1.0, z + 2.25), color="#5fa0d0", intensity=3.5, distance=7.0)
    lampe(logic, "light_ps_ecrans_b", (34.8, ny - 1.0, z + 2.2), color="#5fa0d0", intensity=2.5, distance=5.0)
    lampe(logic, "light_ps_bureau", (cx, 149.4, z + 1.0), color="#f2b25a", intensity=1.8, distance=3.5)

    return {"écrans animés/cassables": n, "écran HS": 1, "clés": 5, "lampes": 4}
