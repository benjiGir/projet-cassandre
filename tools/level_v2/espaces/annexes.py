"""Petits espaces : labo, VMC, passerelles, compacteur, planque.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_reserve as R           # noqa: E402
import lib_rayons as L            # noqa: E402
import lib_compacteur as C        # noqa: E402
import lib_service_landmarks as S # noqa: E402
import plan_de_masse as plan      # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import cylindre_aplat, lampe
from espaces.eclairage import eclairage_couloir

# --- Habillage : le labo du photomaton (secret 1) -----------------------------
#
# L'arrière-boutique du photomaton, derrière le pan de mur qui s'efface. Une
# chambre noire : lumière rouge inactinique, bacs de révélateur, et le mur des
# photos d'identité qui sortent de la machine — toutes de reptiliens.

def habiller_labo(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    t = bo.EPAISSEUR_MUR
    ouest, sud, nord = x0 + t, y0 + t, y1 - t

    # Le panneau de liège et ses photos, contre le mur ouest, face à l'entrée.
    H.box("labo_liege", (ouest, 3.2, z + 0.9, ouest + 0.04, 8.8, z + 2.6), "bois_palette", props)
    photos = []
    for i in range(10):
        for j in range(3):
            py, pz = 3.45 + i * 0.52, z + 1.05 + j * 0.52
            photos.append(((ouest + 0.04, py, pz, ouest + 0.06, py + 0.36, pz + 0.44),
                           "label:planche_photo", "+x"))
    # L'atlas des kiosques, déjà dans la cellule de la galerie : celui des écrans
    # y ouvrirait un lot de dessin pour trente vignettes.
    H.boxes("labo_photos", photos, "prd_kiosque", props)

    # L'établi et ses bacs, contre le mur sud.
    H.box("labo_etabli", (-35.5, sud, z, -31.5, sud + 0.8, z + 0.9), "metal_bac_acier", props)
    H.col_box("labo_etabli", (-35.5, sud, z, -31.5, sud + 0.8, z + 0.9), col_coll)
    H.boxes("labo_bacs", [((-35.2 + k * 1.2, sud + 0.1, z + 0.9, -34.3 + k * 1.2, sud + 0.7, z + 0.98),
                           "aplat:#bdae9a") for k in range(3)], "palette", props)

    # Une corde à linge où sèchent les derniers tirages.
    H.box("labo_corde", (-35.75, 7.0, z + 2.3, -30.25, 7.02, z + 2.32), "metal_bac_acier", props)
    sechage = [((-35.0 + k * 0.8, 6.99, z + 1.9, -34.7 + k * 0.8, 7.03, z + 2.3),
                "label:planche_photo", "-y") for k in range(6)]
    H.boxes("labo_sechage", sechage, "prd_kiosque", props)

    # L'ampoule rouge : la seule lumière de la pièce.
    H.box("labo_ampoule", (-33.1, 5.9, z + 3.2, -32.9, 6.1, z + 3.45), "metal_peint_rouge", props)
    lampe(logic, "light_labo_rouge", (-33.0, 6.0, z + 3.0), color="#ff2a10", intensity=5.0, distance=8.0)
    return {"photos": len(photos) + len(sechage), "lampes": 1}


# --- Habillage : le local VMC (secret 3) --------------------------------------
#
# Derrière le distributeur coulissant de la cafétéria. De la chaleur, un ronronnement,
# et ce que le Directeur cache au chaud : une couvée.

def habiller_vmc(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    t = bo.EPAISSEUR_MUR
    est, nord = x1 - t, y1 - t

    # Caisson de ventilation le long du mur nord, posé au sol, et un ventilateur
    # à l'est.
    H.box("vmc_caisson", (x0 + t, nord - 0.7, z, est, nord, z + 2.2), "metal_bac_acier", props)
    H.col_box("vmc_caisson", (x0 + t, nord - 0.7, z, est, nord, z + 2.2), col_coll)
    H.cylinder("vmc_ventilateur", (36.0, 22.4), 0.35, z, z + 0.9, "metal_bac_acier", props)

    # Le nid : de la paille, et six œufs d'un vert qui ne trompe personne.
    H.box("vmc_nid", (38.2, 21.2, z, 40.2, 23.0, z + 0.12), "carton", props)
    oeufs = 0
    for k in range(6):
        cylindre_aplat(f"vmc_oeuf{k}", (38.64 + (k % 3) * 0.55, 21.64 + (k // 3) * 0.6), 0.15,
                       z + 0.12, z + 0.5, "#65814b", props)
        oeufs += 1

    largeur, milieu = plan.PASSAGES[frozenset({"cafeteria", "secret3"})]
    a, b = milieu - largeur / 2, milieu + largeur / 2
    H.boxes("vmc_cadre", [((a - .06, y0 + t, z, a, y0 + t + .06, z + 2.25), "world"),
                          ((b, y0 + t, z, b + .06, y0 + t + .06, z + 2.25), "world"),
                          ((a, y0 + t, z + 2.25, b, y0 + t + .06, z + 2.31), "world")],
            "metal_bac_acier", props)

    # Une chaleur orangée : c'est elle qu'on aperçoit depuis la cafétéria.
    lampe(logic, "light_vmc_couvee", (39.2, 22.2, z + 1.2), color="#ff8a3a", intensity=4.0, distance=6.0)
    return {"oeufs": oeufs, "lampes": 1}


def habiller_c_short_ramp(space, gris, props, col_coll, logic) -> dict:
    """Raccourci du couloir du personnel : néons dont un mort, une palette
    poussable, un distributeur cassable (`electronique`), une fuite au sol."""
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    cy = (y0 + y1) / 2

    lampes = eclairage_couloir(space, props, logic)
    # Un tube grillé de plus, sans lampe : le raccourci n'est pas éclairé à
    # neuf, contrairement au couloir du personnel qu'il prolonge.
    L.place(L.neon(2.0, eteint=True), (x0 + 10.0 - 1.0, cy - 0.17, z + space.hauteur - 0.18),
            0, props, props, "csr_neon_mort")

    L.place(R.transpalette(), (x0 + 4.0, y0 + 1.5, z), 90, props, col_coll, "csr_transpal")
    L.place(L.palette_cartons(), (x0 + 20.0, y1 - 2.0, z), 180, props, col_coll, "csr_palette_deco")
    H.prop("csr_palette", (x0 + 26.0, cy - 0.5, z, x0 + 27.2, cy + 0.5, z + 0.15),
          "bois_palette", props, masse=20, matiere="bois")

    H.prop("csr_distributeur", (x1 - 4.0, y0 + 1.0, z, x1 - 3.1, y0 + 1.75, z + 1.9),
          "metal_peint_rouge", props, masse=70, pv=30, matiere="electronique",
          contenu="donut:2")

    # Fuite : une flaque au sol, un seau posé dessous — visuel seulement, sans
    # goutte-à-goutte sonore (hors scope Blender de ce lot).
    H.box("csr_flaque", (x0 + 9.3, cy - 1.0, z + 0.005, x0 + 10.7, cy + 1.0, z + 0.006),
          "palette", props, uv="aplat:#111014")
    H.cylinder("csr_seau", (x0 + 10.0, cy), 0.2, z, z + 0.3, "metal_bac_acier", props)

    return {"meubles": 4, "lampes": lampes}


def habiller_c_short_w(space, gris, props, col_coll, logic) -> dict:
    """Couloir coupe-feu : repères SAV et froid, chantier regroupé à l'est."""
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    cx = (x0 + x1) / 2

    lampes = eclairage_couloir(space, props, logic)
    L.place(L.neon(2.0, eteint=True), (cx - 0.17, y1 - 10.0 - 1.0, z + space.hauteur - 0.18),
            90, props, props, "csw_neon_mort")

    L.place(R.transpalette(), (x0 + 1.5, y0 + 6.0, z), 0, props, col_coll, "csw_transpal")
    H.prop("csw_palette", (cx - 0.6, y0 + 20.0, z, cx + 0.6, y0 + 21.2, z + 0.15),
          "bois_palette", props, masse=20, matiere="bois")

    H.prop("csw_distributeur", (x1 - 1.75, y1 - 4.0, z, x1 - 1.0, y1 - 3.1, z + 1.9),
          "metal_peint_rouge", props, masse=70, pv=30, matiere="electronique",
          contenu="canette:3")

    H.box("csw_flaque", (cx - 1.0, y0 + 29.3, z + 0.005, cx + 1.0, y0 + 30.7, z + 0.006),
          "palette", props, uv="aplat:#111014")
    H.cylinder("csw_seau", (cx, y0 + 30.0), 0.2, z, z + 0.3, "metal_bac_acier", props)

    S.regrouper_existants()
    reperes = S.installer(props, col_coll)
    return {"meubles": 4, "lampes": lampes, **reperes}


def habiller_compacteur(space, gris, props, col_coll, logic):
    return C.habiller_compacteur(space, props, col_coll, logic, lampe)


def habiller_planque(space, gris, props, col_coll, logic):
    return C.habiller_planque(space, props, col_coll, logic, lampe)
