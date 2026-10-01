"""Étage des bureaux : escalier, bureaux, direction, couloir.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

import bpy

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_bureaux as B           # noqa: E402
import lib_electro as E           # noqa: E402
import lib_facade as F            # noqa: E402
import lib_reserve as R           # noqa: E402
import lib_rayons as L            # noqa: E402
import lib_wayfinding as W        # noqa: E402
import plan_de_masse as plan      # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import _emprise, _neons, cloison_pleine, poser, semer, vraie_fenetre
from espaces.coque import SUBDIV_BAKE
from espaces.eclairage import eclairage_couloir
from espaces.portes import EP_VANTAIL, _bequilles, _monde, vantail

# --- Habillage : l'escalier des bureaux ---------------------------------------
#
# Derrière la porte carte Or, du couloir du personnel (z = 0) à l'étage (z = 4).
# Le COLLIDER reste la rampe lisse de `bo.pente` : un escalier en marches serait
# une série de rebords que le character controller devrait gravir un à un. Ce
# qu'on voit, ce sont des marches de 20 cm posées à cheval sur la rampe, dont le
# dessus passe à la hauteur de la rampe au milieu de chaque giron : l'écart entre
# ce qu'on voit et ce sur quoi on marche ne dépasse jamais 10 cm.

ES_MARCHES = 20


def habiller_escalier(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    sens, z0, z1 = space.rampe
    t = bo.EPAISSEUR_MUR
    # La rampe rendue par `main()` cède la place aux marches ; son collider reste.
    rampe = bpy.data.objects.get(f"sol_{space.id}")
    if rampe is not None:
        bpy.data.objects.remove(rampe, do_unlink=True)
    giron = (y1 - y0) / ES_MARCHES
    contre = (z1 - z0) / ES_MARCHES
    marches = [((x0 + t, y0 + k * giron, z0 - bo.EPAISSEUR_SOL,
                 x1 - t, y0 + (k + 1) * giron, z0 + (k + 0.5) * contre), "world")
               for k in range(ES_MARCHES)]
    marches_obj = H.boxes("escalier_marches", marches, "mur_platre_use", props)
    # Même jeu d'attributs que les murs de la cage (qui portent `Col`) : sans
    # lui, la fusion au chargement les laisse dans deux lots séparés.
    couleur = marches_obj.data.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
    couleur.data.foreach_set("color", [1.0] * (len(marches_obj.data.vertices) * 4))
    # Le nez déborde d'un centimètre devant la contremarche : à fleur, sa façade
    # et celle de la marche se battaient sur chaque marche.
    nez = [((x0 + t, y0 + k * giron - 0.01, z0 + (k + 0.5) * contre - 0.03,
             x1 - t, y0 + k * giron + 0.04, z0 + (k + 0.5) * contre + 0.005), "trim:corniere")
           for k in range(ES_MARCHES)]
    H.boxes("escalier_nez", nez, "trim_hypermarche", props)
    # Mains courantes le long des deux murs, parallèles à la pente.
    for i, (a, b) in enumerate(((x0 + t, x0 + t + 0.08), (x1 - t - 0.08, x1 - t))):
        bo.dalle_inclinee(f"escalier_main_courante_{i}", (a, b), (y0, y1),
                          z0 + 0.9, z1 + 0.9, sens, 0.06,
                          H.textured_material("metal_bac_acier"), props)
    lampes = eclairage_couloir(space, props, logic)
    return {"marches": ES_MARCHES, "lampes": lampes}


# --- Habillage : l'étage des bureaux ------------------------------------------
#
# Demandé au playtest du 2026-09-18 : « un étage avec les bureaux de
# l'hypermarché et au bout le bureau du directeur ». Le rez-de-chaussée n'avait
# qu'une grande salle, où l'on entrait depuis le parking souterrain sans
# comprendre pourquoi un bureau de direction ouvrait sur un sous-sol.
#
# Un couloir au sud, contre la façade (fenêtres sur la nuit), quatre bureaux au
# nord derrière des cloisons pleines, chacun avec sa porte : la sécurité (le
# mur de vidéosurveillance), la comptabilité, les ressources humaines, la salle
# de pause. Au bout du couloir, à l'ouest, la porte du Directeur.

ET_CLOISON_Y = 154.5                     # cloison couloir / bureaux
ET_EP = 0.15                             # épaisseur des cloisons
ET_BUREAUX = (("securite", -29.75, -21.0), ("compta", -21.0, -12.0),
              ("rh", -12.0, -3.0), ("pause", -3.0, 7.75))
# Bord ouest de chaque porte de bureau. Un vantail de 1 m, CENTRÉ sur une
# cellule du graphe de navigation (multiple de 0,5 m) : la capsule d'un
# Costard (0,4 m de rayon) y passe avec 10 cm de jeu de chaque côté, et pas du
# tout si la porte tombe entre deux cellules.
ET_PORTES = {"securite": -26.0, "compta": -17.0, "rh": -8.0, "pause": -1.5}
ET_PORTE_L, ET_PORTE_H = 1.0, 2.2
ET_ALLEGE, ET_VITRAGE = 0.95, 2.2        # la cloison est vitrée entre ces deux hauteurs
ET_VITRE_PV = 10
# Vraies fenêtres du mur nord, sur la ville : (nom, x0, x1). Pas dans la salle
# de vidéosurveillance, dont le mur nord porte les écrans.
ET_FENETRES = (("compta", -17.5, -14.5), ("rh", -9.5, -6.5), ("pause", 2.0, 5.0))
ET_NEONS = ((-25.0, 150.3), (-17.0, 150.3), (-9.0, 150.3), (-1.0, 150.3), (5.5, 150.3),
            (-25.4, 158.5), (-16.6, 158.5), (-7.6, 158.5), (2.4, 158.5))
ET_NEONS_MORTS = frozenset({(-17.0, 150.3)})
ET_NEONS_DOUBLES = (-25.4, -16.6, -7.6, 2.4)


def habiller_etage(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    ht = z + space.hauteur
    t = bo.EPAISSEUR_MUR
    ouest, est, sud, nord = x0 + t, x1 - t, y0 + t, y1 - t

    # Cloison entre le couloir et les bureaux : une allège pleine, un VITRAGE
    # cassable, un bandeau jusqu'au plafond. Du couloir, on voit les bureaux —
    # et les Costards qui y attendent. Une vitre par bureau, coupée aux
    # cloisons de séparation : en casser une n'ouvre qu'une pièce.
    trous = [(px, px + ET_PORTE_L) for px in ET_PORTES.values()]
    separations = [b for (_n, _a, b) in ET_BUREAUX[:-1]]
    yc0, yc1 = ET_CLOISON_Y, ET_CLOISON_Y + ET_EP
    montants = []
    for i, (a, b) in enumerate(bo._segments_restants(ouest, est, trous)):
        cloison_pleine(f"et_cloison_allege_{i}", (a, yc0, z, b, yc1, z + ET_ALLEGE), props, col_coll)
        # Le bandeau au-dessus du vitrage n'a pas de collider : hors d'atteinte,
        # et un solide sans rien dessous (la vitre peut disparaître) est ce que
        # `audit_niveau.py` appelle un objet flottant.
        H.box(f"et_cloison_bandeau_{i}", (a, yc0, z + ET_VITRAGE, b, yc1, ht), "mur_platre", props,
              subdiv=SUBDIV_BAKE)
        coupes = [a] + [x for x in separations if a < x < b] + [b]
        for j, (va, vb) in enumerate(zip(coupes, coupes[1:])):
            vitre = H.box(f"vitre_et_cloison_{i}_{j}",
                          (va + 0.03, yc0 + 0.065, z + ET_ALLEGE, vb - 0.03, yc0 + 0.085, z + ET_VITRAGE),
                          "verre", props, uv=f"aplat:{H.VERRE_TEINTE}")
            vitre["pv"] = ET_VITRE_PV
        for x in coupes:
            montants.append((max(a, x - 0.03), yc0 + 0.03, z + ET_ALLEGE, min(b, x + 0.03), yc1 - 0.03,
                             z + ET_VITRAGE))
        # L'appui coiffe l'allège d'un centimètre : arasé à sa hauteur, les deux
        # dessus se battaient sur toute la longueur de la cloison.
        montants.append((a, yc0 - 0.02, z + ET_ALLEGE - 0.03, b, yc1 + 0.02, z + ET_ALLEGE + 0.01))
    H.boxes("et_cloison_montants", [(m, "world") for m in montants], "metal_bac_acier", props)
    # Au-dessus de chaque porte, l'imposte qui en fait une PORTE et non une brèche
    # jusqu'au plafond. Rendue seulement : elle est au-dessus de toute tête.
    for nom, px in ET_PORTES.items():
        H.box(f"et_imposte_{nom}", (px, yc0, z + ET_PORTE_H, px + ET_PORTE_L, yc1, ht), "mur_platre", props)
        # Le chambranle mord d'un centimètre sur la baie : c'est lui qui fait
        # l'embrasure. À fleur du bout de la cloison, bois et plâtre s'y battaient.
        for j, (ca, cb) in enumerate(((px - 0.06, px + 0.01), (px + ET_PORTE_L - 0.01, px + ET_PORTE_L + 0.06))):
            H.box(f"et_chambranle_{nom}_{j}", (ca, yc0 - 0.03, z, cb, yc1 + 0.03, z + ET_PORTE_H + 0.06),
                  "bois_palette", props)
        # La porte : bois, plaque nominative, béquille. Elle s'ouvre devant qui
        # la pousse — joueur ou Costard — et reste ouverte.
        o = plan.Opening("bureaux", nom, "y", yc0 + ET_EP / 2, (px, px + ET_PORTE_L), z, z)
        libre = px + ET_PORTE_L - 0.005
        # Elle s'ouvre à la MAIN (touche E) : une porte de bureau qui s'écarte
        # toute seule à l'approche se lit comme une porte de magasin. Les
        # Costards, eux, la poussent — sans quoi ceux qui travaillent derrière
        # n'auraient aucun chemin pour sortir de leur bureau.
        vantail(f"door_bureau_{nom}",
                _monde(o, px + 0.005, -EP_VANTAIL / 2, z + 0.01, libre, EP_VANTAIL / 2, z + ET_PORTE_H - 0.1),
                "portes", "porte:porte_bureau", props,
                dict(mouvement="battant", charniere="min", sens="auto", auto="ennemis", manuelle=True,
                     portee=1.6, referme=False),
                _bequilles(o, libre, -1), "quincaillerie:porte_bureau")
    # Cloisons entre bureaux.
    for i, (_nom, _a, b) in enumerate(ET_BUREAUX[:-1]):
        cloison_pleine(f"et_cloison_bureau_{i}", (b, ET_CLOISON_Y + ET_EP, z, b + ET_EP, nord, ht),
                       props, col_coll)

    fond = nord                      # face intérieure du mur nord
    haut_bureau = ET_CLOISON_Y + ET_EP

    # Sécurité : le mur de vidéosurveillance, et le vigile qui le regarde.
    poser(E.mur_ecrans(4.0), -27.5, fond - 1.0, z, "-y", props, col_coll, "et_sec_mur")
    poser(B.poste_bureau(1), -27.0, 161.0, z, "+y", props, col_coll, "et_sec_poste")
    poser(B.armoire_dossiers(0), ouest, 157.0, z, "+x", props, col_coll, "et_sec_ar")

    # Comptabilité : deux postes, des armoires, des archives en carton.
    poser(B.poste_bureau(2), -20.5, 157.5, z, "-y", props, col_coll, "et_cpt_ps0")
    poser(B.poste_bureau(3), -16.0, 161.75, z, "-y", props, col_coll, "et_cpt_ps1")
    for i, ay in enumerate((156.0, 157.0, 158.0)):
        poser(B.armoire_dossiers(i % 2), -12.0 - 0.55, ay, z, "-x", props, col_coll, f"et_cpt_ar{i}")
    L.place(L.palette_cartons(), (-20.6, fond - 1.0, z), 0, props, col_coll, "et_cpt_pal")

    # Ressources humaines : un bureau, deux chaises de visiteur, une bibliothèque.
    poser(B.poste_bureau(0), -9.5, 160.5, z, "-y", props, col_coll, "et_rh_ps")
    for i, cx in enumerate((-9.2, -7.9)):
        poser(B.meuble("chair"), cx, 158.4, z, "+y", props, col_coll, f"et_rh_ch{i}")
    bx0, _, bx1, _ = poser(B.meuble("bookcaseClosed"), -11.5, fond - _emprise(B.meuble("bookcaseClosed"))[1],
                           z, "-y", props, col_coll, "et_rh_bib")
    poser(B.meuble("pottedPlant"), -4.0, fond - 0.45, z, "-y", props, col_coll, "et_rh_plante")

    # Salle de pause : le coin cuisine contre le mur nord, une table, un distributeur.
    kx = -2.5
    for i, modele in enumerate(("kitchenCabinet", "kitchenCabinet", "kitchenFridge")):
        lx, ly, _ = _emprise(B.meuble(modele))
        poser(B.meuble(modele), kx, fond - ly, z, "-y", props, col_coll, f"et_pause_k{i}")
        if modele == "kitchenCabinet":
            dessus = z + B.MEUBLES["kitchenCabinet"][0]
            petit = "kitchenCoffeeMachine" if i == 0 else "kitchenMicrowave"
            poser(B.meuble(petit), kx + 0.1, fond - ly + 0.05, dessus, "-y", props, col_coll,
                  f"et_pause_p{i}")
        kx += lx
    poser(B.table_cafeteria(1), 0.2, 157.2, z, "-y", props, col_coll, "et_pause_table")
    poser(B.distributeur("chips_illumi"), est - 0.75, 159.5, z, "-x", props, col_coll, "et_pause_dist")

    # Les vraies fenêtres, au nord : de derrière la cloison vitrée du couloir,
    # on voit à travers un bureau jusqu'à la ville. Le mur sud du couloir, lui,
    # donnerait sur les toits des couloirs du rez-de-chaussée, qui n'existent
    # pas vus d'en haut : ses anciennes fausses fenêtres sont parties.
    for nom, fx0, fx1 in ET_FENETRES:
        vraie_fenetre(f"et_fenetre_{nom}", "bureaux", (fx0, y1 - t, z + 1.0, fx1, y1, z + 2.5), props)
    # Couloir : un banc, deux plantes, un extincteur.
    poser(F.banc(), -23.0, ET_CLOISON_Y - 0.5, z, "-y", props, col_coll, "et_banc")
    poser(B.meuble("pottedPlant"), 6.9, ET_CLOISON_Y - 0.5, z, "-y", props, col_coll, "et_plante0")
    poser(B.meuble("pottedPlant"), ouest + 0.1, ET_CLOISON_Y - 0.5, z, "-y", props, col_coll, "et_plante1")
    # Sur le mur sud : la cloison d'en face est vitrée à hauteur d'extincteur.
    poser(R.extincteur(), -19.0, sud, z + 1.0, "+y", props, props, "et_ext")

    rampes, lampes = _neons(space, props, logic, (), (), ET_NEONS_MORTS, "et",
                            doubles=ET_NEONS_DOUBLES, positions=ET_NEONS)
    return {"bureaux": len(ET_BUREAUX), "rampes": rampes, "lampes": lampes}


# --- Habillage : le bureau du Directeur ---------------------------------------
#
# La salle du boss : le Directeur derrière son bureau, face à la porte, le
# garde du corps près de l'entrée. Rien de haut entre la porte et lui — le plan
# veut une révélation immédiate, pas une traque entre les meubles. L'issue de
# secours au nord, sous son enseigne, termine le niveau.

DI_NEONS = ((-41.0, 147.5), (-34.0, 147.5), (-41.0, 155.0), (-34.0, 155.0), (-37.5, 160.5))
DI_NEONS_MORTS = frozenset({(-34.0, 155.0)})


def habiller_direction(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    t = bo.EPAISSEUR_MUR
    ouest, est, sud, nord = x0 + t, x1 - t, y0 + t, y1 - t

    poser(B.meuble("rugRectangle"), -40.5, 154.0, z, "-y", props, col_coll, "di_tapis")
    poser(B.poste_bureau(1), -40.0, 157.0, z, "-y", props, col_coll, "di_bureau")
    for i, cx in enumerate((-39.6, -38.1)):
        poser(B.meuble("chair"), cx, 155.3, z, "+y", props, col_coll, f"di_chaise{i}")
    ly_bib = _emprise(B.meuble("bookcaseClosed"))[1]
    poser(B.meuble("bookcaseClosed"), ouest + 0.2, nord - ly_bib, z, "-y", props, col_coll, "di_bib0")
    poser(B.meuble("bookcaseOpen"), ouest + 1.5, nord - ly_bib, z, "-y", props, col_coll, "di_bib1")
    poser(B.meuble("pottedPlant"), -32.2, nord - 0.45, z, "-y", props, col_coll, "di_plante0")
    poser(B.meuble("pottedPlant"), ouest + 0.1, sud + 0.1, z, "-y", props, col_coll, "di_plante1")

    # Le coin salon, et les deux écrans d'où le Directeur surveille son magasin.
    poser(B.meuble("loungeSofa"), ouest, 160.0, z, "+x", props, col_coll, "di_canape")
    poser(B.meuble("tableCoffee"), ouest + 1.4, 160.3, z, "+x", props, col_coll, "di_table")
    h_meuble = B.MEUBLES["cabinetTelevision"][0]
    for i, ty in enumerate((148.5, 151.0)):
        poser(B.meuble("cabinetTelevision"), ouest, ty, z, "+x", props, col_coll, f"di_meuble_tv{i}")
        poser(B.meuble("televisionModern"), ouest + 0.1, ty + 0.15, z + h_meuble, "+x",
              props, col_coll, f"di_tv{i}")
        # Le Directeur surveille son magasin : un vrai écran `ecran_*`, en
        # saillie sur la façade du téléviseur (chantier « Les coulisses »).
        H.ecran(f"di_tv{i}", (ouest + 0.16, ty + 0.30, z + h_meuble + 0.10,
                              ouest + 0.20, ty + 0.70, z + h_meuble + 0.42),
                "cctv", props)

    # Deux vraies fenêtres à l'ouest, sur la ville : l'une au-dessus des
    # écrans, l'autre au-dessus du canapé.
    for i, (fy0, fy1) in enumerate(((146.5, 149.5), (161.0, 164.0))):
        vraie_fenetre(f"di_fenetre_{i}", "direction", (x0, fy0, z + 1.25, ouest, fy1, z + 2.75), props)

    # Le portrait officiel du Directeur, dans son cadre doré : le même
    # présentateur reptilien que sur le mur d'écrans de l'électroménager. Celui
    # qui l'a remarqué là-bas comprend avant le combat.
    H.box("di_portrait_cadre", (ouest, 154.85, z + 0.95, ouest + 0.04, 157.15, z + 3.25), "palette", props,
          uv="aplat:#d98330")
    H.box("di_portrait", (ouest + 0.04, 155.0, z + 1.1, ouest + 0.06, 157.0, z + 3.1), "prd_ecrans", props,
          uv="label:ecran_reptilien", front="+x")

    # « SORTIE » au-dessus de l'issue de secours, centrée sur la porte et plaquée
    # au mur — l'ancienne enseigne des bureaux flottait à 10 cm du mur, décalée.
    s0, s1 = bo.OUVERTURE_SORTIE.span
    lx, ly, _ = _emprise(F.enseigne_murale("sortie"))
    L.place(F.enseigne_murale("sortie"), ((s0 + s1) / 2 + lx / 2, nord - 0.01, z + 2.65), 180,
            props, props, "di_sortie")

    rampes, lampes = _neons(space, props, logic, (), (), DI_NEONS_MORTS, "di",
                            doubles=(-41.0, -34.0), positions=DI_NEONS)
    return {"rampes": rampes, "lampes": lampes}


# --- Habillage : le couloir de direction --------------------------------------
#
# De la rampe du souterrain à la porte Or des bureaux : 38 m que le joueur est
# OBLIGÉ de parcourir, et qui étaient nus — terrazzo de galerie marchande, murs
# lisses, lumière sans luminaire. On sort ici de la surface de vente pour
# l'arrière du magasin : béton, plâtre usé (voir `COQUE`), et le mobilier de
# couloir qu'on trouve devant un bureau de direction — archives qui débordent,
# fontaine, distributeur, banc d'attente, deux plantes qui encadrent la porte.
# Tout est contre les murs : l'allée garde 5,5 m francs.


def habiller_couloir_direction(space, gris, props, col_coll, logic) -> dict:
    y0, y1 = space.y
    z = space.z
    sud = y0 + bo.EPAISSEUR_MUR           # face intérieure du mur sud
    nord = y1 - bo.EPAISSEUR_MUR          # face intérieure du mur nord

    # Contre le mur sud, façade vers le nord : `rot 180`, origine au coin opposé.
    for i, ax in enumerate((8.0, 9.0, 10.0)):
        L.place(B.armoire_dossiers(i % 2), (ax + 0.90, sud + 0.55, z), 180,
                props, col_coll, f"cbu_ar{i}")
    L.place(B.distributeur("cafe_reveille"), (18.0 + 0.90, sud + 0.75, z), 180,
            props, col_coll, "cbu_dist")
    L.place(L.poubelle(), (19.3, sud + 0.1, z), 0, props, col_coll, "cbu_pou")
    L.place(L.palette_cartons(), (30.0 + 1.2, sud + 0.8, z), 180, props, col_coll, "cbu_pal")

    # Contre le mur nord, façade vers le sud : `rot 0`.
    # La porte Or est en bas de l'escalier (x 3..7) : deux plantes l'encadrent,
    # son bouton est juste à l'est (x ≈ 8), la fontaine et le banc au-delà.
    L.place(B.fontaine_eau(), (10.5, nord - 0.36, z), 0, props, col_coll, "cbu_fontaine")
    L.place(F.banc(), (13.0, nord - 0.5, z), 0, props, col_coll, "cbu_banc")
    # L'extincteur ne doit pas empiéter sur l'entrée des vestiaires (x=24).
    L.place(R.extincteur(), (22.0, nord, z + 1.0), 180, props, props, "cbu_ext")
    H.boxes("cbu_ext_pictogramme", [
        ((21.57, nord - 0.24, z + 1.78, 22.01, nord - 0.19, z + 2.25), "aplat:#f2efe6", "-y"),
        ((21.74, nord - 0.27, z + 1.88, 21.85, nord - 0.24, z + 2.12), "aplat:#d8231f", "-y"),
        ((21.81, nord - 0.27, z + 2.10, 21.94, nord - 0.24, z + 2.18), "aplat:#d8231f", "-y"),
    ], "palette", props)
    meubles = semer(props, col_coll, "cbu_k", (
        ("pottedPlant", 1.6, nord - 0.45, z, 0),
        ("pottedPlant", 8.9, nord - 0.45, z, 0),
    ))
    lampes = eclairage_couloir(space, props, logic)
    W.installer("c_bu", props)
    return {"meubles": 7 + meubles, "lampes": lampes}
