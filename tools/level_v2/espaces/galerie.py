"""Espace « galerie » marchande.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_facade as F            # noqa: E402
import lib_rayons as L            # noqa: E402
import lib_public_compositions as P# noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import _neons, lampe, semer
from espaces.coque import EPAISSEUR_PLAFOND, SUBDIV_BAKE

# --- Habillage : la galerie marchande ----------------------------------------
#
# Transit, gags, et le secret 1. Quatre kiosques aux cotes du blockout, et la
# VERRIÈRE que le plan de masse réclame : « la seule lumière naturelle du
# niveau, contraste avec la surface de vente ».

GA_KIOSQUES = tuple(-30.0 + 6.0 + i * 14.0 for i in range(4))
GA_KIOSQUE_Y = 6.0
GA_ENSEIGNES = ("presse_libre", "clefs_minute", "desimlock", "photomaton")
# Verrières : au-dessus de l'allée SUD, celle qu'on parcourt en arrivant du
# parking. Une verrière au-dessus d'un kiosque n'éclairerait que son toit.
GA_VERRIERE_COTE = 4.0
GA_VERRIERE_X = (-22.0, -2.0, 18.0)
GA_VERRIERE_Y = 1.0
# Néons : allée nord seulement. L'allée sud est éclairée par les verrières, et
# c'est ce contraste qui donne son caractère à la galerie.
GA_NEON_X = (-26.0, -14.0, -2.0, 10.0, 22.0)
GA_NEON_Y = (11.5,)
GA_NEONS_MORTS = frozenset({(-14.0, 11.5)})
# Devantures à rideau baissé le long du mur nord, de part et d'autre de la
# trouée vers les caisses (x ∈ [-6, 6], déclarée par le plan). Sans elles, ce
# mur est soixante mètres de plâtre nu ; avec, la galerie raconte un centre
# commercial à moitié dévitalisé — ce que ce magasin EST.
GA_DEVANTURE_L = 5.0
GA_DEVANTURES_N = (-29.5, -23.5, -17.5, -11.5, 6.5, 12.5, 18.5, 24.5)
# Mur sud : même traitement, en évitant la trouée du parking (x ∈ [-4, 4]).
# Les deux longs murs habillés ferment enfin les deux bouts de la galerie, qui
# sonnaient creux en rendu.
GA_DEVANTURES_S = (-29.5, -23.5, -17.5, -11.5, 4.5, 10.5, 16.5, 24.5)


def _sol_galerie(space, coll, col_coll) -> None:
    """Trois bandes : les deux allées en terrazzo fin, la bande des kiosques en
    terrazzo large. Le sol dessine la circulation avant qu'on l'ait comprise."""
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    bandes = ((y0, GA_KIOSQUE_Y, "sol_terrazzo_fin"),
              (GA_KIOSQUE_Y, GA_KIOSQUE_Y + 4.0, "sol_terrazzo"),
              (GA_KIOSQUE_Y + 4.0, y1, "sol_terrazzo_fin"))
    for i, (ya, yb, texture) in enumerate(bandes):
        H.box(f"sol_galerie_{i}", (x0, ya, z - bo.EPAISSEUR_SOL, x1, yb, z),
              texture, coll, subdiv=SUBDIV_BAKE)
    H.col_box("sol_galerie", (x0, y0, z - bo.EPAISSEUR_SOL, x1, y1, z), col_coll)


def _plafond_galerie(space, coll) -> None:
    """Plafond percé des trois verrières. Toujours sans collider — un plafond
    solide ferait croire au bake du pathfinding qu'il y a un sol à 6 m."""
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z + space.hauteur
    haut = z + EPAISSEUR_PLAFOND
    trous = [(vx, vx + GA_VERRIERE_COTE) for vx in GA_VERRIERE_X]
    ya, yb = GA_VERRIERE_Y, GA_VERRIERE_Y + GA_VERRIERE_COTE
    bandes = [(y0, ya, [(x0, x1)]),
              (ya, yb, bo._segments_restants(x0, x1, trous)),
              (yb, y1, [(x0, x1)])]
    i = 0
    for by0, by1, segments in bandes:
        for sx0, sx1 in segments:
            H.box(f"plafond_galerie_{i}", (sx0, by0, z, sx1, by1, haut),
                  "plafond_dalles", coll, subdiv=SUBDIV_BAKE)
            i += 1


def habiller_galerie(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    _sol_galerie(space, props, col_coll)
    _plafond_galerie(space, props)

    for i, (gx, enseigne) in enumerate(zip(GA_KIOSQUES, GA_ENSEIGNES)):
        L.place(F.kiosque(enseigne), (gx, GA_KIOSQUE_Y, z), 0, props, col_coll, f"ga{i}")

    # Verrières et leur lumière : portée longue, le seul endroit du niveau où
    # la lumière tombe de haut, et le seul où l'on voit le ciel en marchant.
    for i, vx in enumerate(GA_VERRIERE_X):
        L.place(F.verriere(GA_VERRIERE_COTE), (vx, GA_VERRIERE_Y, z + space.hauteur),
                0, props, props, f"ga_vr{i}")
        # Clair de lune : il fait nuit dehors (le ciel du niveau), et la
        # verrière vitrée le montre désormais.
        lampe(logic, f"light_ga_lune_{i}",
              (vx + GA_VERRIERE_COTE / 2, GA_VERRIERE_Y + GA_VERRIERE_COTE / 2, z + space.hauteur - 1.0),
              color="#c8d4f0", intensity=10.0, distance=18.0)

    # Les deux machines « signature » du plan d'origine, en vrai et non plus en
    # silhouette : leurs positions viennent des repères du plan de masse, pas
    # d'ici (voir `SIGNATURES_HABILLEES`).
    signatures = 0
    for label, rx, ry, _nature, *_alt in space.reperes:
        if "machine à pinces" in label:
            L.place(F.machine_pinces(), (rx - 0.5, ry - 0.5, z), 15, props, col_coll, "ga_pinces")
            signatures += 1
        elif "photomaton" in label:
            # Dos au mur ouest, rideau vers la galerie (`rot 90`) : juste à côté
            # du pan de mur qu'il ouvre (`PORTES_LIBRES`, secret 1). Le repère est
            # le centre de son emprise de 1,40 × 1,20 m.
            L.place(F.photomaton(), (rx + 0.7, ry - 0.6, z), 90, props, col_coll, "ga_photo")
            signatures += 1

    # Devantures fermées le long des deux longs murs, dos au mur. Au sud,
    # `place(..., 180)` retourne l'asset : sa devanture regarde vers le nord.
    devantures = 0
    for i, dx in enumerate(GA_DEVANTURES_N):
        L.place(F.devanture_fermee(GA_DEVANTURE_L),
                (dx, y1 - bo.EPAISSEUR_MUR - F.DEVANTURE_PROF, z), 0,
                props, col_coll, f"ga_dvn{i}")
        devantures += 1
    for i, dx in enumerate(GA_DEVANTURES_S):
        L.place(F.devanture_fermee(GA_DEVANTURE_L),
                (dx + GA_DEVANTURE_L, y0 + bo.EPAISSEUR_MUR + F.DEVANTURE_PROF, z), 180,
                props, col_coll, f"ga_dvs{i}")
        devantures += 1

    # Réassort abandonné derrière les kiosques : leur dos donne sur l'allée
    # nord et n'a rien à montrer, contrairement à leur façade.
    for i, (px, py, rot) in enumerate(((-22.0, 10.4, 0), (-7.5, 10.6, 15),
                                       (6.5, 10.4, 0), (20.5, 10.6, 25))):
        L.place(L.palette_cartons(), (px, py, z), rot, props, col_coll, f"ga_pal{i}")

    # Bancs dos à dos au milieu de l'allée nord, et corbeilles.
    bancs = 0
    # Un banc fait 1,80 × 0,50. Dos à dos = décalés d'une profondeur en y, et
    # celui de 180° posé par son coin opposé (voir les îlots des caisses).
    for i, (bx, by, rot) in enumerate(((-18.0, 13.0, 0), (-16.2, 14.0, 180),
                                       (8.0, 13.0, 0), (9.8, 14.0, 180))):
        L.place(F.banc(), (bx, by, z), rot, props, col_coll, f"ga_bc{i}")
        bancs += 1
    for i, (px, py) in enumerate(((-19.5, 13.2), (11.5, 13.2), (x1 - 1.3, 2.0))):
        L.place(L.poubelle(), (px, py, z), 0, props, col_coll, f"ga_pou{i}")

    # Panneau d'accueil face à l'arrivée du parking, et panneaux directionnels.
    L.place(F.enseigne_murale("bienvenue"), (-1.5, y0 + 0.35, z + 3.0), 0, props, props, "ga_bienvenue")
    for i, px in enumerate((-15.0, 13.0)):
        L.place(L.panneau_allee(), (px, 9.2, z + 3.4), 0, props, col_coll, f"ga_pan{i}")

    # Plantes en bac tout le long : une galerie marchande en est pleine, et
    # c'est le seul élément vivant d'un espace autrement minéral. Elles
    # n'existaient pas au lot précédent faute de texture de feuillage — le
    # Kenney Furniture Kit en a, et il tient dans un seul matériau.
    meubles = semer(props, col_coll, "ga_k", (
        ("pottedPlant", -27.0, 8.0, z, 0), ("pottedPlant", -13.0, 8.0, z, 0),
        ("pottedPlant", 1.0, 8.0, z, 0), ("pottedPlant", 15.0, 8.0, z, 0),
        ("pottedPlant", 28.5, 8.0, z, 0), ("pottedPlant", -27.0, 13.5, z, 0),
        ("pottedPlant", 28.5, 13.5, z, 0),
        ("trashcan", -5.0, 13.0, z, 0), ("trashcan", 5.0, 2.0, z, 0),
    ))

    rampes, lampes = _neons(space, props, logic, GA_NEON_X, GA_NEON_Y, GA_NEONS_MORTS,
                            "ga", doubles=GA_NEON_X)
    P.galerie(props, col_coll)
    return {"kiosques": len(GA_KIOSQUES), "devantures": devantures, "meubles": meubles,
            "verrieres": len(GA_VERRIERE_X), "signatures": signatures, "bancs": bancs,
            "rampes": rampes, "lampes": lampes + len(GA_VERRIERE_X)}
