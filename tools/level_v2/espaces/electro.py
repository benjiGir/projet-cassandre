"""Espace « électroménager ».

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_bureaux as B           # noqa: E402
import lib_electro as E           # noqa: E402
import lib_rayons as L            # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import _emprise, _neons, semer

# --- Habillage : l'électroménager --------------------------------------------
#
# Le rayon « elevee » du plan, celui du mur d'écrans et de la carte Or.
#
# Refait le 2026-09-18, en direct dans Blender, après un retour de playtest
# « beaucoup de props mal placés ». Le premier jet posait chaque famille
# d'objets sur sa propre grille sans regarder les autres : une étagère et trois
# téléviseurs AU SOL dans l'entrée même du rayon, un portable flottant à 90 cm
# au-dessus de rien, un mur d'écrans collé au mur sud (le plan y cache deux
# Costards « derrière » : il n'y avait pas de derrière), des rangées tournées
# vers le dos des cabines, et des cabines « ouvertes » fermées par un collider
# plein. La règle qui en sort : **on compose par ZONE, pas par famille.**
#
#   ouest  — Image & Son : l'entrée reste dégagée ; téléviseurs sur leurs
#            meubles le long du mur, deux cabines de démonstration.
#   centre — le mur d'écrans, AUTONOME et face à l'entrée : c'est lui qu'on
#            voit en arrivant du carrefour, et il cache le reste du rayon.
#   est    — gros électroménager en îlots dos à dos, petit électroménager sur
#            les étagères des murs nord et sud, la cabine de la carte Or au
#            fond, dans le coin nord-est.
#
# Les spawns du plan de masse ne bougent pas ; ce sont les meubles qui leur
# donnent enfin le couvert déclaré (suit_el1 DANS la cabine sud-ouest, suit_el2
# et suit_el3 derrière le mur d'écrans).

# Mur d'écrans, `rot 270` : ses dalles regardent l'ouest, donc l'entrée.
# Origine au coin nord-ouest de son emprise x ∈ [24, 25], y ∈ [55, 69].
EL_MUR_ECRANS = (24.0, 69.0)
# (x, y, rot) de l'ORIGINE, emprises 5 × 5 m. L'ouverture regarde l'est pour la
# cabine sud-ouest (on la découvre en la dépassant, suit_el1 y attend), le sud
# pour les deux autres. Celle de la carte Or DOIT s'ouvrir au sud : la carte
# est un repère plat tourné vers ±y, et dans une cabine ouverte à l'ouest on ne
# la voyait que par la tranche.
EL_CABINES = ((21.0, 48.5, 90), (16.0, 74.5, 0), (40.5, 74.5, 0))
# Îlots de gros électroménager, deux rangées de 4 m bout à bout et dos à dos :
# la face sud à `rot 0`, la face nord à `rot 180` (origine au coin opposé).
EL_ILOTS = ((30.0, 57.0), (30.0, 66.0))
# Rangées adossées au mur est, face à l'ouest (`rot 270`) : y du bout NORD.
EL_RANGEES_EST = (54.0, 58.5, 69.5, 74.0)
# Étagères de petit électroménager, 2 m chacune : x du bord OUEST.
EL_ETAGERES_NORD = (23.0, 25.5, 28.0, 30.5, 33.0, 35.5, 38.0)
EL_ETAGERES_SUD = (26.0, 28.5, 31.0, 33.5, 36.0, 38.5, 41.0)
# Mur Image & Son, contre le mur ouest de part et d'autre de l'entrée (y 56..68) :
# y du bord SUD de chaque meuble télé, puis de chaque enceinte colonne.
EL_MEUBLES_TV = (48.7, 50.9, 69.0, 71.6, 74.2, 76.8)
EL_ENCEINTES = (50.3, 52.5, 70.6, 75.8, 78.5)
# Rampes de néons, tube le long de y : (x, y du bout sud). Au-dessus des
# allées, jamais d'un meuble — la règle des rayons (voir `_neons`).
EL_NEONS = ((13.5, 57.0), (13.5, 65.0), (18.5, 57.0), (18.5, 65.0),
            (13.5, 49.0), (13.5, 72.0), (22.5, 72.0),
            (27.5, 49.0), (27.5, 57.0), (27.5, 65.0), (27.5, 73.0),
            (34.0, 51.0), (34.0, 60.4), (34.0, 70.0),
            (41.5, 49.0), (41.5, 56.0), (41.5, 63.0), (41.5, 69.5))
EL_NEONS_MORTS = frozenset({(18.5, 65.0), (27.5, 73.0), (41.5, 49.0), (34.0, 51.0)})
EL_NEONS_DOUBLES = (13.5, 18.5, 27.5, 41.5)


def habiller_electro(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    mx, my = EL_MUR_ECRANS
    L.place(E.mur_ecrans(14.0), (mx, my, z), 270, props, col_coll, "el_mur")

    for i, (cx, cy, rot) in enumerate(EL_CABINES):
        L.place(E.cabine_demo(i), (cx, cy, z), rot, props, col_coll, f"el_cab{i}")

    rangees = 0
    for i, (ix, iy) in enumerate(EL_ILOTS):
        for k in range(2):
            L.place(E.rangee_blanc(4.0, 1 + (2 * i + k) % 4), (ix + 4.0 * k, iy, z), 0,
                    props, col_coll, f"el_il{i}s{k}")
            L.place(E.rangee_blanc(4.0, 1 + (2 * i + k + 1) % 4), (ix + 4.0 * (k + 1), iy + 1.8, z), 180,
                    props, col_coll, f"el_il{i}n{k}")
            rangees += 2
    for i, ry in enumerate(EL_RANGEES_EST):
        L.place(E.rangee_blanc(4.0, 1 + i % 4), (x1 - bo.EPAISSEUR_MUR - 0.9, ry, z), 270,
                props, col_coll, f"el_rge{i}")
        rangees += 1

    # Petit électroménager : sur des étagères, contre les murs. C'est la seule
    # marchandise du rayon qu'on voit de près, donc celle qui porte le détail.
    petits = 0
    fond_n = y1 - bo.EPAISSEUR_MUR - 0.6
    for i, ex in enumerate(EL_ETAGERES_NORD):
        L.place(E.etagere_petits(i % 3), (ex, fond_n, z), 0, props, col_coll, f"el_etn{i}")
        petits += 1
    fond_s = y0 + bo.EPAISSEUR_MUR + 0.6
    for i, ex in enumerate(EL_ETAGERES_SUD):
        L.place(E.etagere_petits((i + 1) % 3), (ex + 2.0, fond_s, z), 180,
                props, col_coll, f"el_ets{i}")
        petits += 1

    # Image & Son : un téléviseur sur CHAQUE meuble télé, une enceinte colonne
    # entre deux meubles, tous tournés vers la salle. Les modèles Kenney
    # regardent le -y local, comme le reste de la bibliothèque : face à l'est,
    # c'est `rot 90`, origine au coin sud-EST de l'emprise. Le premier jet avait
    # `rot 270` — les écrans regardaient le mur.
    ouest = x0 + bo.EPAISSEUR_MUR + 0.05
    h_meuble = B.MEUBLES["cabinetTelevision"][0]
    tele = []

    def contre_mur_ouest(modele, y_sud, z_pose, recul=0.0):
        lx, ly, _ = _emprise(B.meuble(modele))
        return (modele, ouest + recul + ly, y_sud, z_pose, 90)

    lx_meuble, ly_meuble, _ = _emprise(B.meuble("cabinetTelevision"))
    for i, ty in enumerate(EL_MEUBLES_TV):
        tele.append(contre_mur_ouest("cabinetTelevision", ty, z))
        modele = "televisionModern" if i % 2 else "televisionVintage"
        lx_tv, ly_tv, _ = _emprise(B.meuble(modele))
        tele.append(contre_mur_ouest(modele, ty + (lx_meuble - lx_tv) / 2, z + h_meuble,
                                     recul=max(0.0, (ly_meuble - ly_tv) / 2)))
    for sy in EL_ENCEINTES:
        tele.append(contre_mur_ouest("speaker", sy, z))
    meubles = semer(props, col_coll, "el_k", tele)

    # Réserve de cartons et poubelle : là où un vendeur les laisse, contre un
    # mur ou un meuble, jamais dans une allée ni une entrée.
    L.place(L.palette_cartons(), (25.6, y0 + 1.0, z), 0, props, col_coll, "el_pal0")
    L.place(L.poubelle(), (23.3, 53.8, z), 0, props, col_coll, "el_pou0")

    rampes, lampes = _neons(space, props, logic, (), (), EL_NEONS_MORTS, "el",
                            doubles=EL_NEONS_DOUBLES, positions=EL_NEONS)
    return {"cabines": len(EL_CABINES), "rangees": rangees, "petits": petits,
            "meubles": meubles, "rampes": rampes, "lampes": lampes}
