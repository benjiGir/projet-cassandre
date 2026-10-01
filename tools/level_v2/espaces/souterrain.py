"""Parking souterrain.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

import random


from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_backstage_route as BR
import lib_helpers as H           # noqa: E402
import lib_reserve as R           # noqa: E402
import lib_rayons as L            # noqa: E402
import lib_wayfinding as W        # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import SEED, _neons, lampe
from espaces.props import PROPS_PHYSIQUES

# --- Habillage : le parking souterrain ---------------------------------------
#
# 48 × 32 m sous 3,5 m, six mètres plus bas que le reste. Le plan lui demande
# de la TENSION, pas de la lisibilité : piliers tous les 8 m, portée de vue
# coupée en permanence, pénombre. L'éclairage y est donc volontairement pauvre
# — c'est le seul espace du niveau où éclairer davantage serait une faute.
#
# Refait le 2026-09-18 en direct dans Blender : le premier jet semait piliers,
# marquages et voitures sur trois grilles indépendantes. D'où des voitures
# garées EN TRAVERS de l'allée, perpendiculaires aux places tracées à côté
# d'elles, des piliers au milieu d'une place, un pilier planté devant la rampe
# de sortie, et des marquages qui se chevauchaient. Un parking se dessine à
# partir d'UNE trame, celle de la structure :
#
#   - lignes de piliers tous les 8 m en x (38, 46, … 70) ;
#   - trois files de places de 5 m, perpendiculaires aux allées : le long du mur
#     sud, en double file dos à dos au milieu (épine à y = 108), le long du mur
#     nord — interrompue devant la rampe de sortie, que deux piliers encadrent ;
#   - trois places par travée entre deux piliers ;
#   - deux allées est-ouest et deux transversales, dont celle de l'ouest où
#     rejoint l’escalier piéton.

SO_LIGNES_X = (38.0, 46.0, 54.0, 62.0, 70.0)
SO_PILIERS_Y = (97.0, 108.0, 119.0)       # front sud, épine, front nord
SO_PROF_PLACE = 5.0
SO_EPINE = 108.0
# La travée de l’escalier piéton reste libre au nord (x ∈ [38, 46]).
SO_ACCES_SORTIE = (38.0, 46.0)
# Rampes de néons, tube le long de y, EN TRAVERS des allées est-ouest.
SO_NEONS = tuple((x, y) for y in (98.25, 113.75) for x in (34.0, 42.0, 50.0, 58.0, 66.0, 74.0)) \
    + ((34.0, 106.0), (74.0, 106.0))
# La MOITIÉ des tubes est morte. Sur n'importe quel autre espace ce serait de
# la négligence ; ici c'est le sujet.
SO_NEONS_MORTS = frozenset({(42.0, 98.25), (58.0, 98.25), (74.0, 98.25),
                            (34.0, 113.75), (50.0, 113.75), (66.0, 113.75), (74.0, 106.0)})
# Environ une place sur trois occupée : un parking plein n'a plus d'allées
# lisibles, un parking vide n'a jamais servi.
SO_TAUX_OCCUPATION = 0.36
# Deux fûts au fond du coin sud-est, une poubelle au nord-ouest : (x, y) de
# l'origine, soit le coin sud-ouest de leur emprise.
SO_FUTS = ((76.0, 93.0), (76.8, 93.7))
SO_POUBELLE = (31.0, 122.5)
SO_ACCESSOIRES = ((39.2, 121.6, "cone"), (44.8, 121.6, "cone"),
                  (51.0, 94.0, "debris-tire"), (31.4, 120.4, "box"), (32.3, 121.3, "box"))


def _travees_so(space, sauf=()) -> list[tuple[float, float]]:
    """Emprises libres entre deux piliers (ou un pilier et un mur), en x."""
    x0, x1 = space.x
    t = bo.EPAISSEUR_MUR
    bornes = [x0 + t] + [v for lx in SO_LIGNES_X for v in (lx - 0.5, lx + 0.5)] + [x1 - t]
    travees = [(bornes[i], bornes[i + 1]) for i in range(0, len(bornes), 2)]
    return [(a, b) for a, b in travees
            if not any(a < s1 and s0 < b for s0, s1 in sauf)]


def _files_so(space) -> list[tuple[str, float, float, list]]:
    """(nom, y du fond, y de l'avant, travées) pour chaque file de places."""
    y0, y1 = space.y
    t = bo.EPAISSEUR_MUR
    centre = _travees_so(space)[1:-1]            # la double file s'arrête aux lignes 36 et 68
    return [
        ("sud", y0 + t, y0 + t + SO_PROF_PLACE, _travees_so(space)),
        ("mil_s", SO_EPINE, SO_EPINE - SO_PROF_PLACE, centre),
        ("mil_n", SO_EPINE, SO_EPINE + SO_PROF_PLACE, centre),
        ("nord", y1 - t, y1 - t - SO_PROF_PLACE, _travees_so(space, sauf=(SO_ACCES_SORTIE,))),
    ]


def _places_so(space):
    """Toutes les places : (file, xa, xb, y du fond, y de l'avant)."""
    places = []
    for nom, fond, avant, travees in _files_so(space):
        for a, b in travees:
            w = (b - a) / 3.0
            for k in range(3):
                places.append((nom, a + k * w, a + (k + 1) * w, fond, avant))
    return places


def _marquages_so(space, props) -> int:
    """Les traits de séparation d'une file, en UN mesh par file : peinture
    à 2 cm au-dessus de la dalle, sans collider (voir `R.marquage_place`)."""
    z = space.z
    poses = 0
    for nom, fond, avant, travees in _files_so(space):
        ya, yb = min(fond, avant), max(fond, avant)
        traits = []
        for a, b in travees:
            w = (b - a) / 3.0
            for k in range(4):
                xk = a + k * w
                traits.append(((xk - 0.06, ya, z, xk + 0.06, yb, z + 0.02), "world"))
        H.boxes(f"so_marquage_{nom}", traits, "mur_platre", props)
        poses += len(traits)
    return poses


def _points_reserves_so(space) -> list[tuple[float, float]]:
    """Ce qu'une voiture ne doit jamais recouvrir : spawns, ramassages,
    mobilier physique et accessoires posés dans une place."""
    points = [(67.0, 121.0), (67.0, 117.5)]
    points += [(x, y) for _n, x, y, _c in space.spawns]
    points += [(r[1], r[2]) for r in space.reperes]
    points += [(e[0], e[1]) for e in PROPS_PHYSIQUES.get(space.id, ())]
    points += [(x, y) for x, y, _m in SO_ACCESSOIRES]
    points += [(x + 0.3, y + 0.3) for x, y in (*SO_FUTS, SO_POUBELLE)]
    return points


SO_VEHICULES = (
    "citadine_bleu_orage", "berline_ivoire", "suv_sable", "citadine_miel",
    "sportive_rouge_corail", "tout_terrain_vert_foret", "citadine_rouge_brique",
    "berline_vert_sauge", "motocross", "custom", "roadster", "scooter",
    "suv_bleu_petrole", "berline_bleu_acier", "sportive_argent",
)


def placer_voitures_souterrain(space, props, col_coll) -> int:
    z = space.z
    # Voitures DANS les places, dans le sens des places. Tirage déterministe,
    # jamais sur un spawn, un ramassage ou un meuble physique.
    reserves = _points_reserves_so(space)
    rng = random.Random(SEED + 17)
    modeles = [m for m in R.MODELES_VOITURE if m[2] <= SO_PROF_PLACE - 0.1]
    voitures = 0
    for file, xa, xb, fond, avant in _places_so(space):
        ya, yb = min(fond, avant), max(fond, avant)
        if any(xa - 1.0 < px < xb + 1.0 and ya - 1.0 < py < yb + 1.0 for px, py in reserves):
            continue
        if rng.random() > SO_TAUX_OCCUPATION:
            continue
        # Garder les tirages initiaux pour conserver places et orientations.
        rng.randrange(len(modeles))
        modele = SO_VEHICULES[voitures % len(SO_VEHICULES)]
        asset, bounds = R.voiture_proposition(modele)
        w, lng = bounds[:2]
        if lng > SO_PROF_PLACE - 0.1:
            raise ValueError(f"Véhicule trop long pour une place : {modele}")
        cx = (xa + xb) / 2
        # Rangée à 30 cm du fond de la place, comme on se gare.
        cy = fond + (0.3 + lng / 2) * (1 if avant > fond else -1)
        if rng.random() < 0.5:
            origine, rot = (cx - w / 2, cy - lng / 2, z), 0
        else:
            origine, rot = (cx + w / 2, cy + lng / 2, z), 180
        L.place(asset, origine, rot, props, col_coll, f"so_au{voitures}")
        voitures += 1

    return voitures


def habiller_souterrain(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z

    piliers = 0
    for lx in SO_LIGNES_X:
        for py in SO_PILIERS_Y:
            L.place(R.pilier_beton(space.hauteur), (lx - 0.5, py - 0.5, z), 0,
                    props, col_coll, f"so_pl{lx:g}_{py:g}".replace(".", "_"))
            piliers += 1
    # Deux extincteurs, deux repères dans la pénombre : face à la rampe de quai
    # (on le voit en arrivant), et à côté de la rampe de sortie.
    L.place(R.extincteur(), (SO_LIGNES_X[0] - 0.5, SO_EPINE - 0.21, z + 1.0), 90,
            props, props, "so_ext0")
    L.place(R.extincteur(), (SO_LIGNES_X[1] + 0.21, SO_PILIERS_Y[2] - 0.5, z + 1.0), 180,
            props, props, "so_ext1")

    places = _marquages_so(space, props)

    voitures = placer_voitures_souterrain(space, props, col_coll)
    placer_voiture_direction(space, props, col_coll)
    lampe(logic, "light_so_direction", (67, 119.5, z + 2.8),
          color="#e8dfbe", intensity=3.0, distance=7.0)
    voitures += 1

    # Détails du même atlas, donc gratuits en lots de dessin : deux cônes qui
    # interdisent de stationner devant la rampe de sortie (sur les côtés — un
    # cône au milieu la faisait lire comme fermée), un pneu, deux caisses.
    for i, (ax, ay, modele) in enumerate(SO_ACCESSOIRES):
        L.place(R.accessoire_car_kit(modele), (ax, ay, z), i * 37,
                props, col_coll, f"so_acc{i}")

    for i, (fx, fy) in enumerate(SO_FUTS):
        L.place(R.fut(i), (fx, fy, z), 0, props, col_coll, f"so_fut{i}")
    L.place(L.poubelle(), (*SO_POUBELLE, z), 0, props, col_coll, "so_pou")

    # Éclairage volontairement pauvre et froid : deux fois moins puissant et
    # deux fois moins portant que la surface de vente.
    rampes, lampes = _neons(space, props, logic, (), (), SO_NEONS_MORTS, "so",
                            couleur="#c8d8e0", intensite=3.5, portee=9.0,
                            positions=SO_NEONS)
    W.installer("souterrain", props)
    BR.installer("souterrain", props)
    return {"piliers": piliers, "voitures": voitures, "places": places,
            "rampes": rampes, "lampes": lampes + 1}


def placer_voiture_direction(space, props, col_coll):
    """Berline réservée, face à l'allée ; la carte Or reste accessible à pied."""
    asset, bounds = R.voiture_proposition("berline_bleu_acier")
    width = bounds[0]
    return L.place(asset, (67.0 + width / 2, 123.4, space.z), 180,
                   props, col_coll, "so_direction")
