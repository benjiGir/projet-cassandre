"""
Niveau v2 habillé — jalon N9 de `PLAN_NIVEAU_V2.md`.

    blender -b --factory-startup -P tools/level_v2/build_niveau.py -- \\
        --out assets_src/blender/niveau_v2.blend

Puis la chaîne habituelle :

    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/validate_level.py -- --strict
    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/export_level.py -- \\
        --out public/assets/levels/niveau_v2.glb

**La structure ne se rejoue pas, elle se réutilise.** Ce fichier importe
`build_blockout` et lui emprunte sa coque : sols, murs percés par les
ouvertures du plan, portes, `use_*`, secrets, spawns. Le blockout a été joué et
validé par l'utilisateur au jalon N8 ; toute cote redessinée ici serait une
occasion de le contredire. Ce qui change, et rien d'autre :

1. **Les matériaux de la coque**, gris au blockout, texturés ici — un
   dictionnaire par espace, passé aux MÊMES fonctions. `geo_utils` et
   `lib_helpers` partagent la densité du projet (128 px pour 2 m, soit
   64 px/m), donc les deux familles de géométrie s'accordent sans réglage.
2. **Les plafonds**, absents du blockout. Ils n'ont JAMAIS de collider : le
   bake du graphe de navigation tire un rayon vers le bas et prend le premier
   collider rencontré, un plafond solide ferait donc croire à un sol en
   altitude. Le parking extérieur n'en a pas — il est dehors.
3. **Les lampes.** Chaque espace porte les siennes (`light_*`, lues par
   `loader.ts`). Le niveau tourne en `lighting: "hybride"` : pas de soleil,
   pas de bake pour l'instant, juste les lampes du niveau et 0,18 d'ambiante.
4. **Le contenu d'un espace habillé**, pris dans la bibliothèque du jalon N4
   (`lib_rayons.py`) au lieu des boîtes grises.

**Un espace non encore habillé garde ses volumes gris**, et ça se voit : c'est
le but. Le niveau reste jouable de bout en bout à chaque lot, et ce qui est
gris est ce qui reste à faire. `HABILLAGE` est le registre qui décide.

Les lampes ne sont pas comptées : `LightPool` (`src/render/lightPool.ts`) n'en
allume que 48 à la fois, les plus proches du joueur. Poser plus de lampes que
le budget est le régime NORMAL de ce niveau, pas un dépassement.
"""

from __future__ import annotations

import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
sys.path.insert(0, os.path.join(os.path.dirname(ICI), "blender"))

import geo_utils                      # noqa: E402
import lib_helpers as H               # noqa: E402
import lib_bureaux as B               # noqa: E402
import lib_electro as E               # noqa: E402
import lib_facade as F                # noqa: E402
import lib_reserve as R               # noqa: E402
import lib_rayons as L                # noqa: E402
import plan_de_masse as plan          # noqa: E402
import build_blockout as bo           # noqa: E402

SEED = 20260913

# --- Coque texturée ----------------------------------------------------------
#
# `sol` / `mur` / `plafond` par espace. `volume` et `repere` restent les gris du
# blockout partout : un volume gris signale un espace pas encore habillé, et
# c'est une information qu'on veut garder à l'œil.

COQUE = {
    "parking_ext": ("sol_asphalte", "mur_platre_use", None),
    "galerie": ("sol_terrazzo", "mur_platre", "plafond_dalles"),
    "cafeteria": ("sol_damier", "mur_platre", "plafond_dalles"),
    "caisses": ("sol_carrelage_blanc", "mur_platre", "plafond_dalles"),
    "hub": ("sol_terrazzo", "mur_platre", "plafond_dalles"),
    "rayons": ("sol_carrelage_blanc", "mur_platre", "plafond_dalles"),
    "electro": ("sol_terrazzo_fin", "mur_platre", "plafond_dalles"),
    # Béton brut au plafond et non des dalles de faux plafond : ni une réserve
    # ni un parking souterrain n'en ont, et une dalle acoustique blanche au-
    # dessus d'un parking le fait ressembler à un bureau.
    "reserve": ("sol_beton", "mur_platre_use", "sol_beton_brut"),
    "souterrain": ("sol_beton_brut", "mur_platre_use", "sol_beton_brut"),
    "bureaux": ("sol_moquette", "mur_platre", "plafond_dalles"),
    # Les rampes du souterrain sont des rampes de PARKING : même béton que le
    # parking qu'elles desservent, pas le terrazzo de la galerie marchande.
    "c_rs_so": ("sol_beton_brut", "mur_platre_use", "sol_beton_brut"),
    "c_so_bu": ("sol_beton_brut", "mur_platre_use", "sol_beton_brut"),
    # Le secteur réservé au personnel (couloir de direction, montée et couloir
    # de service) prend la matière de la réserve : on sort de la surface de
    # vente, ça doit se voir au sol avant de se lire sur un panneau.
    "c_bu": ("sol_beton", "mur_platre_use", "plafond_dalles"),
    "c_short_ramp": ("sol_beton", "mur_platre_use", "plafond_dalles"),
    "c_short_w": ("sol_beton", "mur_platre_use", "plafond_dalles"),
    "c_escalier": ("sol_beton", "mur_platre_use", "plafond_dalles"),
    "direction": ("sol_moquette", "mur_platre", "plafond_dalles"),
    # Les deux cachettes prennent la matière de la pièce qu'elles prolongent :
    # un matériau neuf dans une cellule de 48 m est un lot de dessin de plus, et
    # les deux cellules sont dans le champ des vues déjà les plus chargées.
    "secret1": ("sol_terrazzo", "mur_platre", "plafond_dalles"),
    "secret3": ("sol_damier", "mur_platre", "plafond_dalles"),
    # Seules dans leur cellule de 48 m, les toilettes y paient un lot de dessin
    # par matière. Aux murs, le carrelage blanc des caisses fait la faïence ; le
    # sol est celui de la cafétéria, d'un seul tenant (`SOL_COMMUN`) ; le plafond,
    # en plâtre, est posé par `habiller_toilettes` (`PLAFOND_SUR_MESURE`).
    "toilettes": ("sol_damier", "sol_carrelage_blanc", "mur_platre"),
}
COQUE_COULOIR = ("sol_terrazzo", "mur_platre", "plafond_dalles")

EPAISSEUR_PLAFOND = 0.1

# Cible de subdivision des grandes surfaces (sols, plafonds).
#
# `H.subdivide` s'arrête quand plus aucune arête ne dépasse **`cible × 1.5`** —
# la garantie réelle est donc 1,5 fois la valeur passée, pas la valeur
# elle-même. Pour garantir une arête sous 1 m (donc plus d'un sommet par m², le
# seuil de `validate_level.py`), il faut passer 1 / 1,5 = 0,67 au plus. 0,60
# laisse de la marge et couvre toutes les cotes du niveau, la galerie de 60 m
# comprise — au-delà, les six passes de `subdivide` ne suffiraient plus.
#
# Le niveau n'est pas encore baké, mais une surface qui NE PEUT PAS l'être est
# une dette qu'on paierait au moment où on décide de le faire : le bake est par
# sommet, et une dalle à quatre coins ne porte aucun dégradé.
SUBDIV_BAKE = 0.6


def materiaux_espace(space, gris: dict, cache: dict) -> dict:
    """Le dictionnaire de matériaux du blockout, `sol` et `mur` remplacés par
    des textures. Les clés sont les mêmes, donc `bo.boite`/`bo.murs_espace`
    fonctionnent sans être touchées."""
    sol, mur, _ = COQUE.get(space.id, COQUE_COULOIR)
    cle = (sol, mur)
    if cle not in cache:
        lookup = dict(gris)
        lookup["sol"] = H.textured_material(sol)
        lookup["mur"] = H.textured_material(mur)
        cache[cle] = lookup
    return cache[cle]


# Espaces dont l'habillage construit son propre plafond (percé, à redans...) :
# `plafond()` les laisse tranquilles plutôt que d'en poser un second par-dessus.
PLAFOND_SUR_MESURE = frozenset({"galerie", "toilettes"})

# Idem pour le SOL, quand l'habillage le découpe en bandes de textures
# différentes. Le défaut est volontairement l'inverse — `main()` pose un sol
# uni à tout espace qui n'est pas listé ici, habillé ou non. Un habillage qui
# oublie son sol donne ainsi une pièce banale, jamais un trou dans lequel le
# joueur tombe.
SOL_SUR_MESURE = frozenset({"rayons", "caisses", "galerie", "hub"})

# Sols posés d'UN SEUL tenant avec celui d'un voisin : hôte → invités, qui en
# prennent la matière. Le jeu fusionne le décor par matière et par cellule de
# 48 m, le CENTRE de l'objet faisant foi, et un sol n'est jamais dans la même
# tranche verticale qu'un mur : seules dans leur cellule, les toilettes payaient
# un lot de dessin rien que pour leur sol (mesuré le 2026-09-24). D'un seul
# tenant avec la cafétéria, le sol commun n'en coûte qu'un pour les deux pièces.
SOL_COMMUN = {"cafeteria": ("toilettes",)}
SOL_INVITE = frozenset(i for invites in SOL_COMMUN.values() for i in invites)


def sol_commun(space, materiaux, coll, col_coll) -> None:
    """Le sol de `space` et de ses invités en un seul mesh ; un collider par pièce."""
    espaces = {s.id: s for s in plan.ALL}
    pieces = [space] + [espaces[i] for i in SOL_COMMUN[space.id]]
    e = bo.EPAISSEUR_SOL
    parts = [{"o": (s.x[0], s.y[0], s.z - e), "s": (s.largeur, s.profondeur, e), "mat": "sol"} for s in pieces]
    coll.objects.link(geo_utils.build_multi_box_mesh(f"sol_{space.id}", parts, "sol", materiaux,
                                                     seg=bo.SEG, uv_tile=2.0))
    for s in pieces:
        proxy = geo_utils.build_proxy_object(f"col_box_sol_{s.id}", "box", (0.0, 0.0, 0.0),
                                             (s.largeur, s.profondeur, e))
        proxy.location = (s.x[0], s.y[0], s.z - e)
        col_coll.objects.link(proxy)


def plafond(space, coll) -> bool:
    """Dalle de plafond, SANS collider. Retourne False quand l'espace est à ciel
    ouvert ou quand son habillage s'en charge lui-même."""
    if space.id in PLAFOND_SUR_MESURE:
        return False
    texture = COQUE.get(space.id, COQUE_COULOIR)[2]
    if texture is None:
        return False
    x0, x1 = space.x
    y0, y1 = space.y
    if space.rampe:
        # Le plafond d'une rampe SUIT la pente, à `hauteur` au-dessus du sol en
        # tout point. Posé à plat au point haut (premier jet), il laissait 10 m
        # sous plafond au bas d'une rampe de 6 m, et surtout un vide de 6,5 m
        # au-dessus du plafond du souterrain, par lequel on voyait hors du niveau.
        sens, z0, z1 = space.rampe
        bo.dalle_inclinee(f"plafond_{space.id}", space.x, space.y,
                          z0 + space.hauteur, z1 + space.hauteur, sens,
                          EPAISSEUR_PLAFOND, H.textured_material(texture), coll)
        return True
    z = space.z
    H.box(f"plafond_{space.id}", (x0, y0, z + space.hauteur, x1, y1, z + space.hauteur + EPAISSEUR_PLAFOND),
          texture, coll, subdiv=SUBDIV_BAKE)
    return True


def _plafond_au_bord(space, axe: str, at: float) -> float:
    """Sous-face du plafond au droit d'une façade (haut des murs pour un espace
    à ciel ouvert, dont les murs font `hauteur`). Suit la pente d'une rampe."""
    return plan._sol_au_bord(space, axe, at) + space.hauteur


def poser_linteaux(ouvertures, gris, cache, coll) -> int:
    """Ferme ce qu'une ouverture laisse voir AU-DESSUS du plus bas des deux
    plafonds, et ce qu'une porte laisse voir au-dessus de son vantail.

    Le blockout perce les façades sur toute leur hauteur. Tant que les deux
    voisins avaient le même plafond, rien ne se voyait ; 13 jonctions sur 21
    n'étaient pas dans ce cas, et chacune ouvrait une bande sur le vide — de
    6,5 m aux deux rampes du souterrain, où l'on voyait par-dessus le toit du
    parking. Trouvé en regardant à hauteur d'œil, dans Blender, le 2026-09-18.

    RENDUS SEULEMENT, jamais de collider : c'est la règle 1 de
    `build_blockout.py` (« aucun linteau »), qui visait le bake de navigation —
    un rayon tiré vers le bas prendrait un linteau solide pour un sol. Un
    linteau sans collider n'existe pas pour Rapier, exactement comme un plafond.
    Tous sont au-dessus de 2,5 m : aucun joueur ne peut les atteindre.
    """
    t = bo.EPAISSEUR_MUR
    espaces = {s.id: s for s in plan.ALL}
    poses = 0
    for o in ouvertures:
        a, b = espaces.get(o.a), espaces.get(o.b)
        lo, hi = o.span

        # Imposte au-dessus d'une porte : du haut du vantail jusqu'au plus bas
        # des deux plafonds. Le sas vitré pose la sienne (`HAUTEUR_VANTAIL`).
        paire = frozenset({o.a, o.b})
        hauteur_vantail = HAUTEUR_VANTAIL.get(_cle_porte(o))
        if hauteur_vantail is not None:
            bas = o.z + hauteur_vantail
            haut = min(_plafond_au_bord(s, o.axe, o.at) for s in (a, b) if s)
            # Une porte libre dicte sa matière : l'imposte du pan de mur secret
            # doit être du plâtre de la galerie, pas le béton du labo derrière —
            # sinon c'est elle qui trahit la cachette.
            libre = PORTES_LIBRES.get(paire)
            mur = (H.textured_material(libre["imposte"]) if libre and "imposte" in libre
                   else materiaux_espace(a, gris, cache)["mur"])
            # 50 cm d'épaisseur, centrée sur la façade : une vraie traverse, plus
            # épaisse que le vantail (20 cm), et une origine sur la grille.
            if o.axe == "y":
                bo.boite(f"imposte_{o.a}_{o.b}", (lo, o.at - 0.25, bas), (hi - lo, 0.5, haut - bas),
                         "mur", {"mur": mur}, coll, None, avec_collider=False)
            else:
                bo.boite(f"imposte_{o.a}_{o.b}", (o.at - 0.25, lo, bas), (0.5, hi - lo, haut - bas),
                         "mur", {"mur": mur}, coll, None, avec_collider=False)
            poses += 1

        if not (a and b):
            continue
        pa, pb = _plafond_au_bord(a, o.axe, o.at), _plafond_au_bord(b, o.axe, o.at)
        if abs(pa - pb) < 1e-6:
            continue
        # Le linteau appartient au côté HAUT, posé dans l'emprise de ses murs
        # (règle 3 du blockout : jamais à cheval sur la ligne de façade).
        grand, bas, haut = (a, pb, pa) if pa > pb else (b, pa, pb)
        mur = materiaux_espace(grand, gris, cache)["mur"]
        nom = f"linteau_{grand.id}_{o.b if grand is a else o.a}"
        # Entre les murs de son espace, jamais dedans : une ouverture qui court
        # jusqu'au bout de la façade a les murs voisins descendus jusqu'à
        # l'angle (`bo.murs_espace`), et le linteau les traverserait.
        bords = grand.y if o.axe == "x" else grand.x
        lo, hi = max(lo, bords[0] + t), min(hi, bords[1] - t)
        if o.axe == "y":
            ya = o.at - t if abs(grand.y[1] - o.at) < 1e-6 else o.at
            bo.boite(nom, (lo, ya, bas), (hi - lo, t, haut - bas),
                     "mur", {"mur": mur}, coll, None, avec_collider=False)
        else:
            xa = o.at - t if abs(grand.x[1] - o.at) < 1e-6 else o.at
            bo.boite(nom, (xa, lo, bas), (t, hi - lo, haut - bas),
                     "mur", {"mur": mur}, coll, None, avec_collider=False)
        poses += 1
    return poses


# --- Lampes ------------------------------------------------------------------


def lampe(coll, nom: str, position, color: str = "#dceeff",
          intensity: float = 6.0, distance: float = 12.0, decay: float = 2.0):
    """Empty `light_*` — `loader.ts` en fait un `THREE.PointLight`.

    Un empty plutôt qu'une vraie lampe Blender exportée en `KHR_lights_punctual` :
    la scène de bake a ses propres sources, et le watt de Blender ne se convertit
    pas en intensité three.js. L'empty porte exactement les paramètres de
    `PointLight`, lisibles tels quels.
    """
    obj = bpy.data.objects.new(nom, None)
    obj.location = position
    obj.empty_display_size = 0.3
    obj["color"] = color
    obj["intensity"] = intensity
    obj["distance"] = distance
    obj["decay"] = decay
    coll.objects.link(obj)
    return obj


# Pas de la grille de lampes d'un espace non habillé. Large exprès : ces lampes
# ne cherchent pas une ambiance, seulement à rendre l'espace lisible en
# attendant son tour.
PAS_LAMPES = 10.0


def eclairage_par_defaut(space, logic) -> int:
    x0, x1 = space.x
    y0, y1 = space.y
    z = (space.z if not space.rampe else max(space.rampe[1], space.rampe[2])) + space.hauteur - 0.8
    nx = max(1, int((x1 - x0) // PAS_LAMPES))
    ny = max(1, int((y1 - y0) // PAS_LAMPES))
    pas_x = (x1 - x0) / (nx + 1)
    pas_y = (y1 - y0) / (ny + 1)
    n = 0
    for i in range(nx):
        for j in range(ny):
            lampe(logic, f"light_{space.id}_{i}_{j}",
                  (x0 + pas_x * (i + 1), y0 + pas_y * (j + 1), z),
                  intensity=7.0, distance=14.0)
            n += 1
    return n


# Pas des rampes de néons d'un couloir, le long de son grand axe.
PAS_NEONS_COULOIR = 8.0


def eclairage_couloir(space, props, logic) -> int:
    """Une rangée de rampes de néons sur l'axe du couloir, chacune avec SA lampe.

    Les couloirs recevaient jusqu'ici `eclairage_par_defaut` : des lampes sans
    luminaire, une lumière qui ne vient de nulle part. Ça ne se remarque pas
    dans une salle garnie, ça saute aux yeux dans 44 m de couloir nu.

    Sur une rampe, les tubes courent EN TRAVERS de la pente : un tube dans le
    sens de la montée crèverait le plafond incliné à un bout et pendrait dans le
    vide à l'autre. Posé en travers, il reste horizontal sur sa longueur, et son
    carter de 34 cm n'est décalé que de quelques centimètres par la pente.
    """
    x0, x1 = space.x
    y0, y1 = space.y
    long_x = space.largeur >= space.profondeur
    longueur = space.largeur if long_x else space.profondeur
    n = max(1, round(longueur / PAS_NEONS_COULOIR))
    tube = 4.0 if min(space.largeur, space.profondeur) >= 6.0 else 2.0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2

    def plafond_en(px: float, py: float) -> float:
        return bo._z_du_sol(space, px, py) + space.hauteur

    poses = 0
    for i in range(n):
        s = (i + 0.5) / n
        px, py = (x0 + s * space.largeur, cy) if long_x else (cx, y0 + s * space.profondeur)
        if space.rampe:
            # En travers de la pente. Cote prise au bord BAS du carter, qui
            # affleure ainsi le plafond au lieu de le traverser.
            en_x = space.rampe[0] == "+x"
            bord = [(px - 0.34, py), (px, py)] if en_x else [(px, py), (px, py + 0.34)]
            ht = min(plafond_en(*p) for p in bord)
            if en_x:
                origine, rot = (px, py - tube / 2, ht - 0.18), 90
            else:
                origine, rot = (px - tube / 2, py, ht - 0.18), 0
        else:
            ht = plafond_en(px, py)
            if long_x:
                origine, rot = (px - tube / 2, py - 0.17, ht - 0.18), 0
            else:
                origine, rot = (px + 0.17, py - tube / 2, ht - 0.18), 90
        L.place(L.neon(tube), origine, rot, props, props, _cle(f"{space.id}_n", px, py))
        lampe(logic, "light_" + _cle(space.id, px, py), (px, py, ht - 0.65),
              intensity=7.0, distance=14.0)
        poses += 1
    return poses


# --- Habillage : les rayons --------------------------------------------------
#
# Reprise directe de la salle d'essai du jalon N4, à l'échelle de la vraie
# pièce (42 × 36 m contre 16 × 20). Les rangées sont EXACTEMENT celles du
# blockout — mêmes x, mêmes tronçons, mêmes allées transversales — parce que
# c'est cette circulation-là qui a été jouée et validée.

# Bord GAUCHE de chaque rangée, comme au blockout (`x0 + 4 + i * 7.5`).
RY_RANGEES = tuple(-52.0 + 4.0 + i * 7.5 for i in range(5))
# Tronçons en y, comme au blockout : 8 m chacun, séparés par deux allées
# transversales de 4 m (y ∈ [58,62] et [70,74]).
RY_TRONCONS = ((50.0, 58.0), (62.0, 70.0), (74.0, 82.0))
RY_TRANSVERSALES = ((58.0, 62.0), (70.0, 74.0))
# Une tête de gondole fait 1,25 m ; un tronçon de 8 m porte donc un corps de
# 5,5 m entre ses deux têtes.
RY_TETE = 1.25
RY_CORPS = 8.0 - 2 * RY_TETE

# Thème de chaque FACE de rangée, (est, ouest). L'unité de cohérence est la
# face et non la rangée : les deux faces d'une même rangée donnent sur deux
# allées différentes. Chaque allée voit donc deux catégories voisines, comme
# dans un vrai magasin. « frais » n'est pas ici : il est le long du mur ouest,
# en meubles réfrigérés, là où le plan veut la carte Argent.
RY_THEMES = (("epicerie", "conserves"),
             ("boissons", "petit_dej"),
             ("entretien", "epicerie"),
             ("petit_dej", "boissons"),
             ("conserves", "entretien"))

# Rampes de néons : au-dessus des ALLÉES et des dégagements, jamais au-dessus
# d'une rangée. C'est ce qui fait que les gondoles reçoivent la lumière de
# biais et que leurs tablettes basses restent dans l'ombre des hautes — la
# règle qui a fait le relief de la salle d'essai.
RY_NEON_ALLEES = (-43.75, -36.25, -28.75, -21.25)
RY_NEON_BORDS = (-50.0, -13.5)
RY_NEON_Y = (50.0, 58.0, 66.0, 74.0)
# Tubes grillés : deux coins et un bout d'allée. Rien de crucial ne s'y trouve
# — l'ombre invite, elle ne punit pas.
# Le tube de (-50 ; 74) était grillé : il est juste au-dessus des armoires
# surgelées, et une vitrine dans le noir ne se lit pas. Les trois autres
# restent éteints — l'ombre invite, elle ne punit pas.
RY_NEONS_MORTS = frozenset({(-13.5, 50.0), (-28.75, 74.0), (-36.25, 50.0)})



def _sol_rayons(space, coll, col_coll) -> None:
    """Trois dalles jointives plutôt qu'une seule : les deux allées
    transversales sont en damier, et se lisent d'un bout à l'autre de la pièce
    comme repère d'orientation. Jointives et non superposées — deux meshes
    coplanaires ressortent noirs au bake (auto-occultation, piège déjà payé)."""
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    bandes = []
    y = y0
    for ya, yb in RY_TRANSVERSALES:
        bandes.append((y, ya, "sol_carrelage_blanc"))
        bandes.append((ya, yb, "sol_damier"))
        y = yb
    bandes.append((y, y1, "sol_carrelage_blanc"))
    for i, (ya, yb, texture) in enumerate(bandes):
        H.box(f"sol_rayons_{i}", (x0, ya, z - bo.EPAISSEUR_SOL, x1, yb, z),
              texture, coll, subdiv=SUBDIV_BAKE)
    # UN SEUL proxy pour toute la pièce : le découpage ci-dessus est visuel, le
    # sol physique n'a aucune raison d'être en trois morceaux.
    H.col_box("sol_rayons", (x0, y0, z - bo.EPAISSEUR_SOL, x1, y1, z), col_coll)


# Affiches de marques des flancs de têtes de gondole, par thème de la face qui
# donne sur la même allée : le flanc vend ce que l'allée vend. Une affiche pas
# encore générée (absente de `aff_affiches.json`) est ignorée, et un thème sans
# aucune affiche garde l'autocollant « PRIX CHOC » — les suivantes entreront
# d'elles-mêmes à la prochaine construction.
RY_AFFICHES = {
    "epicerie": ("coquillettes_nouvel_ordre", "sables_reptiliens", "chips_illumi"),
    "boissons": ("soda_5g_cola", "eau_terre_plate"),
    "petit_dej": ("cereales_pyramides", "cafe_reveille", "lait_trainees_blanches"),
    "entretien": ("lessive_profonde", "alu_protect", "dentifrice_sans_fluor", "piles_lune_truquee"),
    "conserves": ("raviolis_bunker",),
}


def _affiche_suivante(theme: str, compteurs: dict) -> str | None:
    """Tourne dans les affiches disponibles du thème, sans hasard : deux flancs
    voisins du même thème ne portent pas la même tant qu'il y en a deux."""
    dispo = [a for a in RY_AFFICHES[theme] if a in H.AFFICHES]
    if not dispo:
        return None
    k = compteurs.get(theme, 0)
    compteurs[theme] = k + 1
    return dispo[k % len(dispo)]


def _rangees(props, col_coll) -> int:
    """Cinq rangées de trois tronçons : tête de gondole, corps, tête.

    `place(..., 90)` envoie le -y local sur le +x monde : la face « avant »
    d'une gondole posée en rangée regarde donc l'est.
    """
    n = 0
    compteurs: dict = {}
    for ri, gx in enumerate(RY_RANGEES):
        droite = gx + L.GOND_DEPTH          # bord EST de la rangée
        theme_est, theme_ouest = RY_THEMES[ri]
        for si, (ya, _yb) in enumerate(RY_TRONCONS):
            tag = f"ry{ri}s{si}"
            seed = SEED + ri * 10 + si
            # Flancs d'une tête, dans l'ordre (-x local, +x local). Posée à 0°,
            # son -x regarde l'ouest ; tournée de 180°, il regarde l'est.
            sud = (_affiche_suivante(theme_ouest, compteurs), _affiche_suivante(theme_est, compteurs))
            nord = (_affiche_suivante(theme_est, compteurs), _affiche_suivante(theme_ouest, compteurs))
            L.place(L.tete_garnie(seed, affiches=sud), (gx, ya, 0), 0, props, col_coll, f"{tag}_sud")
            L.place(L.gondole_garnie(seed + 100, RY_CORPS, theme_est, theme_ouest),
                    (droite, ya + RY_TETE, 0), 90, props, col_coll, tag)
            L.place(L.tete_garnie(seed + 200, affiches=nord), (droite, ya + 8.0, 0), 180,
                    props, col_coll, f"{tag}_nord")
            L.place(L.bandeau_rayon(theme_est, RY_CORPS), (droite, ya + RY_TETE, L.GOND_HEIGHT),
                    90, props, col_coll, f"{tag}_est")
            L.place(L.bandeau_rayon(theme_ouest, RY_CORPS), (gx, ya + RY_TETE + RY_CORPS, L.GOND_HEIGHT),
                    270, props, col_coll, f"{tag}_ouest")
            n += 3
    return n


def _frais_mur_ouest(space, props, col_coll) -> int:
    """Le rayon frais, en meubles réfrigérés dos au mur ouest, façade vers
    l'allée. C'est le « comptoir du rayon frais » derrière lequel le plan de
    masse pose la carte Argent."""
    x0 = space.x[0]
    n = 0
    for i, y in enumerate((56.0, 58.25, 60.5, 62.75, 65.0, 67.25)):
        # rot 90 : la façade (local -y) regarde l'est, vers l'allée.
        L.place(L.frigo_garni(SEED + 300 + i), (x0 + 1.05, y - 2.0, 0), 90,
                props, col_coll, f"frais{i}")
        n += 1
    return n


# Le rayon surgelés, promis par le plan depuis le premier jour et jamais posé
# avant le 2026-09-19 (« il est où mon rayon surgelés ? »). Dans le
# prolongement du frais, contre le même mur ouest : six armoires vitrées au bout
# de l'allée transversale NORD, qui les montre de loin comme la transversale
# sud montre le frais. Deux bacs congélateurs à ses croisements libres, là où la
# transversale sud a ses bacs promo.
RY_SURGELES_Y = tuple(70.25 + 2.0 * i for i in range(6))     # bord sud de chaque armoire
RY_BACS = ((-43.75, 71.5), (-28.75, 71.5))                   # centre en x, bord sud
RY_PILIER_SURGELES = (-51.75, 68.25)
RY_LAMPES_SURGELES = ((-50.4, 73.25), (-50.4, 79.25))


def _surgeles(space, props, col_coll, logic) -> int:
    x0 = space.x[0] + bo.EPAISSEUR_MUR
    n = 0
    for i, y in enumerate(RY_SURGELES_Y):
        # rot 90 : la façade (-y local) regarde l'est, vers l'allée ; l'origine
        # passe au coin sud-EST de l'emprise, d'où `x0 + profondeur`.
        L.place(L.armoire_surgeles_garnie(SEED + 700 + i), (x0 + L.ARM_P, y, space.z), 90,
                props, col_coll, f"surg{i}")
        n += 1
    for i, (cx, y) in enumerate(RY_BACS):
        L.place(L.bac_surgeles(SEED + 720 + i), (cx - L.BAC_L / 2, y, space.z), 0,
                props, col_coll, f"surg_bac{i}")
        n += 1
    # Deux panneaux : l'un face à l'allée ouest, l'autre au bout de la
    # transversale, face à qui arrive du hub.
    ht = space.z + space.hauteur
    L.place(L.panneau_surgeles(), (x0 + 1.2, RY_SURGELES_Y[0] + 0.2, ht - 1.8), 0,
            props, props, "ry_surg_panneau0")
    L.place(L.panneau_surgeles(), (x0 + 2.7, 71.0, ht - 1.8), 90, props, props, "ry_surg_panneau1")
    # Lumière froide : le seul bleu de la pièce, qui se voit du fond de la
    # transversale.
    for i, (lx, ly) in enumerate(RY_LAMPES_SURGELES):
        lampe(logic, f"light_ry_surgeles_{i}", (lx, ly, space.z + 2.3),
              color="#bfe3ff", intensity=6.0, distance=10.0)
    return n


def _props_rayons(space, props, col_coll) -> int:
    x0, x1 = space.x
    y0, y1 = space.y
    rng = random.Random(SEED)
    n = 0

    # Piliers dans les deux dégagements latéraux, jamais dans une allée.
    # Le pilier nord-ouest est adossé au mur, entre le frais et les surgelés :
    # au milieu du dégagement, il masquait les armoires vitrées.
    for i, (x, y) in enumerate(((x0 + 1.5, 52.0), RY_PILIER_SURGELES,
                                (x1 - 2.5, 54.0), (x1 - 2.5, 76.0))):
        L.place(L.pilier(), (x, y, 0), 0, props, col_coll, f"ry_p{i}")
        n += 1

    # Bacs promo et présentoirs dans les allées TRANSVERSALES : elles sont
    # larges (4 m), et c'est là que le joueur ralentit.
    for i, (x, y) in enumerate(((-43.75, 59.0), (-28.75, 59.0), (-36.25, 71.0), (-21.25, 71.0))):
        L.place(L.bac_garni(SEED + 500 + i), (x, y, 0), 0, props, col_coll, f"ry_b{i}")
        n += 1
    # Le premier présentoir était à (-50,5 ; 70,5), devant ce qui est devenu la
    # première armoire surgelés : il est passé dans le dégagement est.
    for i, (x, y) in enumerate(((-15.2, 79.0), (-14.5, 59.5))):
        L.place(L.presentoir_garni(SEED + 600 + i), (x, y, 0), 0, props, col_coll, f"ry_t{i}")
        n += 1

    # Réassort en cours : palettes de cartons contre le mur nord.
    for i, (x, y) in enumerate(((-47.0, y1 - 1.6), (-45.2, y1 - 2.4), (-20.0, y1 - 1.6))):
        L.place(L.palette_cartons(), (x, y, 0), 0 if i != 1 else 25,
                props, col_coll, f"ry_pal{i}")
        n += 1

    for i, (x, y) in enumerate(((x0 + 1.0, y0 + 1.0), (x1 - 1.5, y1 - 1.5))):
        L.place(L.poubelle(), (x, y, 0), 0, props, col_coll, f"ry_pou{i}")
        n += 1

    # Caddies abandonnés : rien ne dit « supermarché » plus vite. Semés dans les
    # allées, jamais à moins de 2 m d'un spawn d'ennemi ou de la caisse d'accès
    # au secret — on y apparaîtrait dans le panier.
    interdits = [(x, y) for _, x, y, _ in
                 [(s[0], s[1], s[2], s[3]) for s in space.spawns]] + [(x0 + 3.0, y0 + 3.5)]
    # Le mobilier déjà posé dans les allées : bacs, présentoirs et meubles
    # réfrigérés du mur ouest. Sans ça, un caddie se gare dans un frigo.
    interdits += [(-43.75, 59.0), (-28.75, 59.0), (-36.25, 71.0), (-21.25, 71.0),
                  (-15.2, 79.0), (-14.5, 59.5)]
    # Les cartons physiques comptent comme du mobilier déjà posé. Un caddie
    # garé sur l'un d'eux ne se contente pas de faire moche : le carton est un
    # corps dynamique, il serait éjecté du collider du caddie au premier pas de
    # simulation. Trouvé par `tools/level_v2/audit_niveau.py`, pas à l'œil.
    interdits += list(RY_CARTONS)
    interdits += [(x0 + 1.05, y - 2.0) for y in (56.0, 58.25, 60.5, 62.75, 65.0, 67.25)]
    interdits += [(x0 + 1.15, y + 1.0) for y in RY_SURGELES_Y] + [(x, 72.0) for x, _ in RY_BACS]
    allees = list(RY_NEON_ALLEES) + [x0 + 2.0, x1 - 3.0]
    for i in range(9):
        x = rng.choice(allees) + rng.uniform(-1.2, 1.2)
        y = rng.uniform(y0 + 2.0, y1 - 2.0)
        if any(math.hypot(x - ax, y - ay) < 2.5 for ax, ay in interdits):
            continue
        L.place(L.caddie(), (round(x * 4) / 4, round(y * 4) / 4, 0),
                rng.randrange(0, 360, 5), props, col_coll, f"ry_c{i}")
        n += 1
    return n


def _signalisation_rayons(props, col_coll) -> int:
    """Panneaux d'allée aux deux entrées de chaque allée, affiches promo
    au-dessus des têtes de gondole côté sud (là d'où l'on arrive)."""
    n = 0
    for i, x in enumerate(RY_NEON_ALLEES):
        for j, y in enumerate((49.5, 82.5)):
            L.place(L.panneau_allee(), (x - 0.8, y, 3.0), 0, props, col_coll, f"ry_all{i}{j}")
            n += 1
    for i, gx in enumerate(RY_RANGEES):
        L.place(L.promo_suspendu(), (gx + 0.2, 49.4, 3.5), 0, props, col_coll, f"ry_promo{i}")
        n += 1
    return n


def _emprise(asset: str) -> tuple[float, float, float]:
    """(lx, ly, lz) d'un asset de la bibliothèque, en local, collider exclu.
    Pour poser un modèle importé contre un mur sans deviner ses cotes."""
    objs = [o for o in bpy.data.collections[asset].objects if not o.name.startswith("col_")]
    pts = [v.co for o in objs for v in o.data.vertices]
    return tuple(max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3))


def semer(props, col_coll, prefixe: str, items) -> int:
    """Sème du mobilier Kenney repeint sur la palette (voir `lib_bureaux.meuble`).

    Tout le kit tient dans un seul matériau, donc ces objets ne coûtent aucun
    lot de dessin supplémentaire là où il y en a déjà un — c'est ce qui permet
    d'en mettre PARTOUT. `items` : (modèle, x, y, z, rotation en degrés).
    """
    for i, (modele, x, y, zz, rot) in enumerate(items):
        L.place(B.meuble(modele), (x, y, zz), rot, props, col_coll, f"{prefixe}{i}")
    return len(items)


def _cle(prefixe: str, x: float, y: float, suffixe: str = "") -> str:
    """Nom stable et lisible pour une rampe ou une lampe, à partir de ses cotes.
    Les coordonnées négatives deviennent `m` — un `-` dans un nom d'objet
    Blender traverse l'export mais rend les noms pénibles à lire en console."""
    return f"{prefixe}_{x:g}_{y:g}{suffixe}".replace(".", "_").replace("-", "m")


def _neons(space, props, logic, xs, ys, morts, prefixe: str, doubles=(),
           couleur: str = "#dceeff", intensite: float = 6.0,
           portee: float = 11.0, positions=None) -> tuple[int, int]:
    """Pose une grille de rampes de néons et les lampes de JEU correspondantes.

    Règle non négociable, héritée de la salle d'essai de N4 : **les rampes
    courent au-dessus des allées et des dégagements, jamais au-dessus d'un
    meuble**. C'est ce qui fait que les gondoles reçoivent la lumière de biais
    et que leurs tablettes basses restent dans l'ombre des hautes. Les `xs`/`ys`
    passés ici sont donc des cotes de circulation, pas une grille régulière.

    **Deux lampes** pour une rampe dont l'axe est dans `doubles`, une seule
    sinon : une lampe ponctuelle au milieu d'un tube de 4 m donne une flaque
    ronde là où il faut une traînée, mais un couloir n'a pas besoin des deux.

    Un tube `mort` ne porte AUCUNE lampe : c'est ce qui creuse les zones
    sombres. Il reste éclairé par ses voisins, comme un tube grillé.

    `positions` remplace la grille `xs` × `ys` par une liste explicite, quand
    les allées d'un espace ne forment pas une grille (l'électroménager).
    """
    ht = space.z + space.hauteur
    rampes = lampes = 0
    for x, y in positions or [(x, y) for x in xs for y in ys]:
        mort = (x, y) in morts
        L.place(L.neon(4.0, eteint=mort), (x, y, ht - 0.18), 90,
                props, props, _cle(f"{prefixe}_n", x, y))
        rampes += 1
        if mort:
            continue
        for k, dy in enumerate((1.0, 3.0) if x in doubles else (2.0,)):
            lampe(logic, "light_" + _cle(prefixe, x, y, f"_{k}"),
                  (x - 0.17, y + dy, ht - 0.65),
                  color=couleur, intensity=intensite, distance=portee)
            lampes += 1
    return rampes, lampes


def _neons_rayons(space, props, logic) -> tuple[int, int]:
    rampes, lampes = _neons(space, props, logic,
                            RY_NEON_ALLEES + RY_NEON_BORDS, RY_NEON_Y,
                            RY_NEONS_MORTS, "ry", doubles=RY_NEON_ALLEES)

    # Bloc de secours au-dessus du passage vers la réserve : la seule lumière
    # d'une autre couleur de la pièce, donc le seul repère qui se voit de loin
    # dans l'ombre.
    ht = space.z + space.hauteur
    # Centré sur la porte coupe-feu du raccourci : c'est elle qu'il désigne.
    porte_x = plan.PASSAGES[frozenset({"c_short_w", "rayons"})][1]
    L.place(L.neon(2.0), (porte_x - 1.0, space.y[1] - 0.6, ht - 1.4), 0, props, props, "ry_secours")
    lampe(logic, "light_ry_secours", (porte_x, space.y[1] - 0.9, ht - 1.6),
          color="#4dff73", intensity=3.0, distance=7.0)
    return rampes, lampes + 1


def habiller_rayons(space, gris, props, col_coll, logic) -> dict:
    n_sol = _sol_rayons(space, props, col_coll)
    gondoles = _rangees(props, col_coll)
    frais = _frais_mur_ouest(space, props, col_coll)
    surgeles = _surgeles(space, props, col_coll, logic)
    props_n = _props_rayons(space, props, col_coll)
    signes = _signalisation_rayons(props, col_coll)
    rampes, lampes = _neons_rayons(space, props, logic)

    # Caisse d'accès au secret 2 (toit des gondoles). Reprise À L'IDENTIQUE du
    # blockout : 1 m de haut, donc franchissable d'un saut (1,1 m), puis 1 m de
    # plus jusqu'au toit d'une gondole (2 m). Les deux marges sont de 0,1 m —
    # changer cette hauteur casserait un accès déjà validé en jouant.
    x, y, z = space.x[0] + 2.5, space.y[0] + 3.0, space.z
    H.box("caisse_acces_secret", (x, y, z, x + 1.0, y + 1.0, z + 1.0), "carton", props)
    H.col_box("caisse_acces_secret", (x, y, z, x + 1.0, y + 1.0, z + 1.0), col_coll)
    camp = _campement_gondoles(space, props, logic)

    void = n_sol
    return {"gondoles": gondoles, "frigos": frais, "surgeles": surgeles, "props": props_n + 1 + camp,
            "signes": signes, "rampes": rampes, "lampes": lampes + 1 + len(RY_LAMPES_SURGELES)}


# Le campement du secret 2, sur le toit de la rangée ouest, tronçon nord. Avant
# le 2026-09-18, le « secret des gondoles » était un volume AU SOL dans une allée :
# on le trouvait en passant, sans monter nulle part. Il est maintenant là où le
# plan le voulait, et il raconte quelque chose — quelqu'un vit là-haut depuis
# longtemps. Rendu seulement : tout y est plat, rien ne gêne la course sur le toit.
RY_CAMP = (-47.92, -46.83, 75.25, 80.75)       # dessus du corps de gondole, z = 2


def _campement_gondoles(space, props, logic) -> int:
    x0, x1, y0, y1 = RY_CAMP
    z = space.z + 2.0
    # Textures déjà présentes dans la cellule des rayons : le nuancier y
    # ouvrirait un lot de dessin pour un duvet.
    H.box("camp_duvet", (x0 + 0.12, 76.9, z, x1 - 0.12, 78.8, z + 0.12), "metal_peint_rouge", props)
    H.box("camp_oreiller", (x0 + 0.22, 78.8, z, x1 - 0.22, 79.2, z + 0.14), "mur_platre", props)
    H.boxes("camp_cartons", [((x0, 80.2, z, x0 + 0.5, 80.7, z + 0.5), "world"),
                             ((x1 - 0.5, 80.25, z, x1, 80.7, z + 0.42), "world")], "carton", props)
    boites = [((x0 + 0.1 + (k % 2) * 0.16, 75.5 + k * 0.1, z, x0 + 0.17 + (k % 2) * 0.16, 75.57 + k * 0.1,
                z + 0.12), "world") for k in range(4)]
    H.boxes("camp_conserves", boites, "metal_bac_acier", props)
    H.box("camp_lanterne", (x1 - 0.3, 79.95, z, x1 - 0.16, 80.09, z + 0.22), "mur_platre", props)
    # La lanterne : une lueur chaude au-dessus d'une gondole, c'est ce qui
    # trahit le campement à qui lève les yeux dans l'allée.
    lampe(logic, "light_camp_lanterne", (x1 - 0.23, 80.0, z + 0.45), color="#ffc070",
          intensity=2.5, distance=5.0)
    return 6



# --- Habillage : la ligne de caisses -----------------------------------------
#
# Le premier vrai combat du niveau, et l'endroit où l'on ramasse le pompe. Les
# huit caisses sont EXACTEMENT celles du blockout : 4 × 1,5 m tous les 6,5 m,
# donc sept trouées de 2,5 m. Cette trame est ce qui a été joué — elle décide
# où l'on peut passer sous le feu, et elle ne se redessine pas ici.

CS_CAISSES_Y = 32.0
CS_CAISSES_X = tuple(-26.0 + 2.0 + i * 6.5 for i in range(8))
# Néons : au-dessus des dégagements, jamais au-dessus de la ligne de caisses.
CS_NEON_X = (-22.0, -11.0, 0.0, 11.0, 22.0)
CS_NEON_Y = (22.0, 28.0, 36.0, 41.0)
CS_NEONS_MORTS = frozenset({(-22.0, 41.0), (22.0, 22.0), (0.0, 41.0)})


def _sol_caisses(space, coll, col_coll) -> None:
    """Deux dalles : terrazzo au sud, dans la continuité de la galerie d'où
    l'on arrive, carrelage blanc au nord une fois la ligne franchie. Le
    changement de sol dit « tu es entré dans le magasin » sans un panneau."""
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    coupe = CS_CAISSES_Y
    for i, (ya, yb, texture) in enumerate(((y0, coupe, "sol_terrazzo"),
                                           (coupe, y1, "sol_carrelage_blanc"))):
        H.box(f"sol_caisses_{i}", (x0, ya, z - bo.EPAISSEUR_SOL, x1, yb, z),
              texture, coll, subdiv=SUBDIV_BAKE)
    H.col_box("sol_caisses", (x0, y0, z - bo.EPAISSEUR_SOL, x1, y1, z), col_coll)


def habiller_caisses(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    _sol_caisses(space, props, col_coll)

    for i, gx in enumerate(CS_CAISSES_X):
        L.place(F.caisse(), (gx, CS_CAISSES_Y, z), 0, props, col_coll, f"cs{i}")

    # Portiques antivol à l'entrée sud, là où le joueur débouche de la galerie
    # (arrivée déclarée en (0, 22)). On passe ENTRE, comme dans un vrai magasin.
    portiques = 0
    for i, px in enumerate((-3.9, -1.0, 1.9)):
        L.place(F.portique(), (px, y0 + 3.0, z), 0, props, col_coll, f"cs_pq{i}")
        portiques += 1

    # File de caddies contre le mur ouest, près de l'entrée.
    L.place(F.rail_caddies(), (x0 + 1.5, y0 + 2.0, z), 0, props, col_coll, "cs_rail")
    caddies = 0
    for i, dy in enumerate((0.2, 1.15, 2.10, 3.05)):
        L.place(L.caddie(), (x0 + 1.85, y0 + 2.1 + dy, z), 0, props, col_coll, f"cs_cd{i}")
        caddies += 1

    # Têtes de gondole promo aux deux bouts de la ligne : elles ferment la
    # perspective et donnent une couleur à un espace autrement très blanc.
    for i, (px, py, rot) in enumerate(((x0 + 0.5, CS_CAISSES_Y + 2.5, 0), (x1 - 1.75, CS_CAISSES_Y + 2.5, 0))):
        L.place(L.tete_garnie(SEED + 700 + i), (px, py, z), rot, props, col_coll, f"cs_tete{i}")

    # Bacs promo dans le dégagement sud, là où l'on ralentit en entrant.
    for i, (px, py) in enumerate(((-16.0, 24.0), (12.0, 24.0))):
        L.place(L.bac_garni(SEED + 720 + i), (px, py, z), 0, props, col_coll, f"cs_bac{i}")
    for i, (px, py) in enumerate(((-8.0, 25.5), (6.5, 25.5))):
        L.place(L.presentoir_garni(SEED + 740 + i), (px, py, z), 0, props, col_coll, f"cs_pres{i}")

    for i, (px, py) in enumerate(((x0 + 0.8, y1 - 1.5), (x1 - 1.3, y0 + 0.8))):
        L.place(L.poubelle(), (px, py, z), 0, props, col_coll, f"cs_pou{i}")

    # Îlots promo de part et d'autre de l'entrée : le dégagement sud fait
    # 52 × 12 m et sonnait creux en rendu. Deux paires de têtes de gondole
    # dos à dos donnent de la couleur et un obstacle à contourner, sans jamais
    # gêner l'axe d'entrée (x ∈ [-6, 6], la trouée déclarée par le plan).
    ilots = 0
    for i, ix in enumerate((-13.0, 11.75)):
        # `place(..., 180)` fait tourner l'asset AUTOUR DE SON ORIGINE : son
        # empreinte part alors vers -x et -y. La seconde tête se pose donc au
        # coin OPPOSÉ de la paire, sans quoi les deux se superposent (constaté
        # par `audit_niveau.py`, 1,25 × 1,25 × 2,0 de recouvrement). Et 2 cm
        # plus loin : les montants arrière débordent d'un centimètre de chaque
        # dos, et dos à dos ils se superposaient dans les mêmes plans.
        L.place(L.tete_garnie(SEED + 760 + i), (ix, 27.0, z), 0, props, col_coll, f"cs_il{i}a")
        L.place(L.tete_garnie(SEED + 770 + i), (ix + 1.25, 29.52, z), 180, props, col_coll, f"cs_il{i}b")
        ilots += 2
    for i, (px, py, rot) in enumerate(((x0 + 3.0, y0 + 6.0, 0), (x1 - 4.0, y0 + 5.0, 20))):
        L.place(L.palette_cartons(), (px, py, z), rot, props, col_coll, f"cs_pal{i}")

    # Caddies abandonnés dans le dégagement sud et entre deux caisses.
    for i, (px, py, rot) in enumerate(((-6.5, 26.0, 40), (5.0, 29.5, 200),
                                       (-20.5, 34.5, 120), (17.0, 27.5, 300))):
        L.place(L.caddie(), (px, py, z), rot, props, col_coll, f"cs_cdl{i}")
        caddies += 1

    # Enseignes : « SOLDES » au-dessus de la ligne, visible de toute la salle,
    # et « SORTIE » au-dessus de la trouée sud par laquelle on est entré.
    L.place(F.enseigne_murale("soldes"), (-1.5, y1 - 0.3, z + 3.2), 180, props, props, "cs_soldes")
    L.place(F.enseigne_murale("sortie"), (-1.5, y0 + 0.35, z + 2.6), 0, props, props, "cs_sortie")

    semer(props, col_coll, "cs_k", (
        ("pottedPlant", -25.0, 22.0, z, 0), ("pottedPlant", 24.5, 22.0, z, 0),
        ("pottedPlant", -25.0, 40.0, z, 0), ("pottedPlant", 24.5, 42.5, z, 0),
    ))

    rampes, lampes = _neons(space, props, logic, CS_NEON_X, CS_NEON_Y, CS_NEONS_MORTS,
                            "cs", doubles=CS_NEON_X)
    return {"caisses": len(CS_CAISSES_X), "portiques": portiques, "caddies": caddies,
            "ilots": ilots, "rampes": rampes, "lampes": lampes}


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
    return {"kiosques": len(GA_KIOSQUES), "devantures": devantures, "meubles": meubles,
            "verrieres": len(GA_VERRIERE_X), "signatures": signatures, "bancs": bancs,
            "rampes": rampes, "lampes": lampes + len(GA_VERRIERE_X)}


# --- Habillage : l'allée centrale (le carrefour) ------------------------------
#
# 12 × 48 m, le seul espace qu'on traverse dans les deux sens à chaque
# aller-retour. Son travail est de dire OÙ ON VA : sans signalétique, un
# carrefour n'est qu'un couloir de plus.

HB_NEON_X = (-4.5, 3.5)
HB_NEON_Y = (46.0, 54.0, 62.0, 72.0, 80.0, 88.0)
HB_NEONS_MORTS = frozenset({(-4.5, 80.0), (3.5, 54.0)})
# Panneaux suspendus aux trois embranchements, lus dans les deux sens.
# `rayon_bazar` est le nom réel du rayon électroménager en grande surface.
HB_DIRECTIONS = ((62.0, "rayon_epicerie", -4.2), (62.0, "rayon_bazar", 2.2),
                 (50.0, "rayon_promos", -1.0), (84.0, "rayon_frais", -1.0))


def _sol_hub(space, coll, col_coll) -> None:
    """Bande centrale plus fine, bordures larges : le sol dessine l'axe de
    circulation avant qu'on ait lu le moindre panneau."""
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    bandes = ((x0, x0 + 3.0, "sol_terrazzo"), (x0 + 3.0, x1 - 3.0, "sol_terrazzo_fin"),
              (x1 - 3.0, x1, "sol_terrazzo"))
    for i, (xa, xb, texture) in enumerate(bandes):
        H.box(f"sol_hub_{i}", (xa, y0, z - bo.EPAISSEUR_SOL, xb, y1, z),
              texture, coll, subdiv=SUBDIV_BAKE)
    H.col_box("sol_hub", (x0, y0, z - bo.EPAISSEUR_SOL, x1, y1, z), col_coll)


def habiller_hub(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    _sol_hub(space, props, col_coll)

    # Estrade du micro d'annonces, aux cotes exactes du blockout : 4 × 4 × 0,50,
    # donc franchissable d'un saut. C'est un point haut, pas un obstacle.
    L.place(E.estrade_micro(), (-2.0, 66.0, z), 0, props, col_coll, "hb_estrade")

    panneaux = 0
    for i, (py, bande, px) in enumerate(HB_DIRECTIONS):
        L.place(E.panneau_direction(bande), (px, py, z + 3.60), 0,
                props, props, f"hb_dir{i}")
        panneaux += 1

    for i, (px, py) in enumerate(((x0 + 0.9, 50.0), (x1 - 1.4, 58.0),
                                  (x0 + 0.9, 76.0), (x1 - 1.4, 84.0))):
        L.place(L.pilier(), (px, py, z), 0, props, col_coll, f"hb_p{i}")

    for i, (px, py) in enumerate(((-4.0, 47.5), (2.5, 88.0))):
        L.place(L.bac_garni(SEED + 800 + i), (px, py, z), 0, props, col_coll, f"hb_bac{i}")
    for i, (px, py, rot) in enumerate(((x0 + 0.8, 70.5, 0), (x1 - 2.0, 62.0, 15))):
        L.place(L.palette_cartons(), (px, py, z), rot, props, col_coll, f"hb_pal{i}")
    for i, (px, py, rot) in enumerate(((-3.0, 56.0, 70), (3.0, 78.0, 250))):
        L.place(L.caddie(), (px, py, z), rot, props, col_coll, f"hb_cd{i}")
    L.place(L.poubelle(), (x1 - 1.2, 45.5, z), 0, props, col_coll, "hb_pou")

    meubles = semer(props, col_coll, "hb_k", (
        ("pottedPlant", -5.0, 52.0, z, 0), ("pottedPlant", 4.0, 60.0, z, 0),
        ("pottedPlant", -5.0, 74.0, z, 0), ("pottedPlant", 4.0, 86.0, z, 0),
        ("loungeSofa", -4.6, 64.0, z, 90), ("trashcan", 4.2, 50.0, z, 0),
    ))
    rampes, lampes = _neons(space, props, logic, HB_NEON_X, HB_NEON_Y,
                            HB_NEONS_MORTS, "hb", doubles=HB_NEON_X)
    return {"panneaux": panneaux, "meubles": meubles, "rampes": rampes, "lampes": lampes}


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


# --- Habillage : la réserve ---------------------------------------------------
#
# 44 × 36 m sous 8 m de plafond, la pièce la plus haute du niveau. Ses racks de
# 6 m sont le SEUL vrai couvert du jeu (ADR 0025) et le plan y pose sept
# Costards : c'est le gros combat. Cotes des volumes gris du blockout, à
# l'unité près — y compris la plateforme et sa rampe, qui ne sont pas du décor
# mais le seul accès au parking souterrain.

# (x du bord ouest, y du départ, longueur). Le rack occupe 1,5 m de large.
# Longueurs bornées par le quai : un rack qui commence à y=118 ne peut pas
# faire 10 m sans entrer dans la plateforme (y ≥ 123).
RS_RACKS = ((-16.0, 100.0, 14.0), (-16.0, 118.0, 4.0),
            (4.0, 100.0, 14.0), (4.0, 118.0, 4.0))
RS_PLATEFORME_Y = 123.0            # quai surélevé, z = +3,0
RS_RAMPE_X = (-8.0, 4.0)
RS_RAMPE_Y = (115.0, 123.0)
# Suspensions industrielles : au-dessus des ALLÉES, jamais au-dessus d'un rack
# de 6 m — même règle que les néons de la surface de vente, pour la même
# raison (la lumière doit arriver de biais sur les faces de rack).
RS_SUSPENSIONS = tuple((x, y) for x in (-20.0, -5.0, 12.0)
                       for y in (100.0, 108.0, 116.0, 127.0))
RS_SUSPENSIONS_MORTES = frozenset({(-20.0, 116.0), (12.0, 100.0)})


def habiller_reserve(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    materiaux = gris

    for i, (rx, ry, longueur) in enumerate(RS_RACKS):
        # `rot 90` fait courir la longueur du rack le long de +y ; l'origine
        # passe donc au bord EST de son emprise.
        L.place(R.rack_palettes(longueur, 6.0, 1 + i % 3), (rx + 1.5, ry, z), 90,
                props, col_coll, f"rs_rk{i}")

    # Plateforme de quai, PLEINE (pas une mezzanine sur pilotis) : deux sols
    # praticables dans la même colonne casseraient le pathfinding 2.5D. Reprise
    # à l'identique du blockout, texture de béton en plus.
    px0, py0 = x0, RS_PLATEFORME_Y
    H.box("plateforme_rs", (px0, py0, z, x1, y1 - 0.25, z + 3.0),
          "sol_beton", props, subdiv=SUBDIV_BAKE)
    H.col_box("plateforme_rs", (px0, py0, z, x1, y1 - 0.25, z + 3.0), col_coll)
    H.box("plateforme_rs_chant", (px0, py0 - 0.06, z + 2.55, x1, py0, z + 3.0),
          "trim_hypermarche", props, uv="trim:bord_quai")

    # La rampe : c'est elle, et rien d'autre, qui donne accès au quai puis au
    # souterrain. La perdre en habillant couperait le niveau en deux.
    bo.pente("rampe_plateforme_rs", RS_RAMPE_X, RS_RAMPE_Y, z, z + 3.0, "+y",
             materiaux, props, col_coll)

    # Un camion de livraison à quai. C'est ce qui explique le quai : sans
    # véhicule, une plateforme surélevée n'est qu'une estrade. Posé sur la
    # plateforme, reculé contre une porte.
    camion = ("truck", 2.40, 7.20, 3.10)
    L.place(R.voiture(*camion), (-11.0, y1 - 0.9, z + 3.0), 180,
            props, col_coll, "rs_camion")

    # Portes de quai sur le mur nord, au-dessus de la plateforme.
    portes = 0
    for i, dx in enumerate((-19.0, -11.0, 8.0, 15.0)):
        L.place(R.porte_quai(3.0), (dx, y1 - 0.55, z + 3.0), 0, props, props, f"rs_pq{i}")
        portes += 1

    # Réassort au sol : palettes filmées, fûts, transpalettes. Les deux
    # dernières sont SUR le quai (y ≥ 123) : posées à z, elles étaient prises
    # dans les 3 m de la plateforme.
    for i, (ax, ay, rot) in enumerate(((-21.5, 102.0, 0), (-21.5, 104.0, 12),
                                       (17.0, 112.0, 0), (-2.0, 100.5, 25),
                                       (-2.0, 128.0, 0), (16.5, 126.0, 8))):
        az = z + 3.0 if ay >= RS_PLATEFORME_Y else z
        L.place(L.palette_cartons(), (ax, ay, az), rot, props, col_coll, f"rs_pal{i}")
    futs = 0
    for i, (fx, fy) in enumerate(((-22.0, 116.0), (-21.2, 116.7), (-22.1, 117.4),
                                  (18.5, 120.0), (17.7, 120.7))):
        L.place(R.fut(i % 2), (fx, fy, z), 0, props, col_coll, f"rs_fut{i}")
        futs += 1
    for i, (tx, ty, rot) in enumerate(((-6.0, 106.0, 20), (9.0, 121.0, 200))):
        L.place(R.transpalette(), (tx, ty, z), rot, props, col_coll, f"rs_tp{i}")
    L.place(R.extincteur(), (x0 + 0.3, 110.0, z + 1.1), 270, props, props, "rs_ext")

    # Suspensions industrielles. Un plafond de néons encastrés n'existe pas
    # sous 8 m ; ce qui éclaire une réserve, ce sont des luminaires isolés qui
    # laissent des trous d'ombre entre eux — et ces trous sont du gameplay.
    ht = z + space.hauteur
    lampes = 0
    for sx, sy in RS_SUSPENSIONS:
        L.place(R.suspension(0), (sx, sy, ht - 2.40), 0, props, props,
                _cle("rs_su", sx, sy))
        if (sx, sy) in RS_SUSPENSIONS_MORTES:
            continue
        lampe(logic, "light_" + _cle("rs", sx, sy), (sx + 0.30, sy + 0.30, ht - 2.20),
              color="#e8f0ff", intensity=13.0, distance=17.0)
        lampes += 1

    return {"racks": len(RS_RACKS), "portes_quai": portes, "futs": futs,
            "suspensions": len(RS_SUSPENSIONS), "lampes": lampes}


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
#   - lignes de piliers tous les 8 m en x (36, 44, … 68) ;
#   - trois files de places de 5 m, perpendiculaires aux allées : le long du mur
#     sud, en double file dos à dos au milieu (épine à y = 108), le long du mur
#     nord — interrompue devant la rampe de sortie, que deux piliers encadrent ;
#   - trois places par travée entre deux piliers ;
#   - deux allées est-ouest et deux transversales, dont celle de l'ouest où
#     débouche la rampe de quai.

SO_LIGNES_X = (36.0, 44.0, 52.0, 60.0, 68.0)
SO_PILIERS_Y = (97.0, 108.0, 119.0)       # front sud, épine, front nord
SO_PROF_PLACE = 5.0
SO_EPINE = 108.0
# Travées de la rampe de sortie, laissées libres au nord (x ∈ [36, 44]).
SO_ACCES_SORTIE = (36.0, 44.0)
# Rampes de néons, tube le long de y, EN TRAVERS des allées est-ouest.
SO_NEONS = tuple((x, y) for y in (98.25, 113.75) for x in (32.0, 40.0, 48.0, 56.0, 64.0, 72.0)) \
    + ((32.0, 106.0), (72.0, 106.0))
# La MOITIÉ des tubes est morte. Sur n'importe quel autre espace ce serait de
# la négligence ; ici c'est le sujet.
SO_NEONS_MORTS = frozenset({(40.0, 98.25), (56.0, 98.25), (72.0, 98.25),
                            (32.0, 113.75), (48.0, 113.75), (64.0, 113.75), (72.0, 106.0)})
# Environ une place sur trois occupée : un parking plein n'a plus d'allées
# lisibles, un parking vide n'a jamais servi.
SO_TAUX_OCCUPATION = 0.36
# Deux fûts au fond du coin sud-est, une poubelle au nord-ouest : (x, y) de
# l'origine, soit le coin sud-ouest de leur emprise.
SO_FUTS = ((74.0, 93.0), (74.8, 93.7))
SO_POUBELLE = (29.0, 122.5)
SO_ACCESSOIRES = ((37.2, 121.6, "cone"), (42.8, 121.6, "cone"),
                  (49.0, 94.0, "debris-tire"), (29.4, 120.4, "box"), (30.3, 121.3, "box"))


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
    points = [(x, y) for _n, x, y, _c in space.spawns]
    points += [(r[1], r[2]) for r in space.reperes]
    points += [(e[0], e[1]) for e in PROPS_PHYSIQUES.get(space.id, ())]
    points += [(x, y) for x, y, _m in SO_ACCESSOIRES]
    points += [(x + 0.3, y + 0.3) for x, y in (*SO_FUTS, SO_POUBELLE)]
    return points


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
        modele = modeles[rng.randrange(len(modeles))]
        w, lng = modele[1], modele[2]
        cx = (xa + xb) / 2
        # Rangée à 30 cm du fond de la place, comme on se gare.
        cy = fond + (0.3 + lng / 2) * (1 if avant > fond else -1)
        if rng.random() < 0.5:
            origine, rot = (cx - w / 2, cy - lng / 2, z), 0
        else:
            origine, rot = (cx + w / 2, cy + lng / 2, z), 180
        L.place(R.voiture(*modele), origine, rot, props, col_coll, f"so_au{voitures}")
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
    return {"piliers": piliers, "voitures": voitures, "places": places,
            "rampes": rampes, "lampes": lampes}


# --- Habillage : le parking extérieur -----------------------------------------
#
# Le spawn, et donc la première image du jeu. À CIEL OUVERT : c'est le seul
# espace sans plafond, donc le seul sans rien où accrocher un néon. Et comme le
# niveau tourne en `hybride` (ambiante 0,18, pas de soleil), il n'y a pas de
# lumière du jour — c'est un parking de NUIT, éclairé par ses mâts et rien
# d'autre. Choix assumé, et une bien meilleure entrée en matière qu'un plein
# soleil sur du bitume.

PK_VOITURES_X = tuple(-24.0 + 4.0 + i * 7.0 for i in range(6))
PK_VOITURES_Y = (-34.0, -16.0)
PK_ABRI = (14.0, -24.0)
# (x, y) du FÛT et côté vers lequel la crosse porte la tête. Le premier jet en
# plantait un dans l'axe des portes automatiques, à 4 m d'elles et décalé de
# 2 m, et un autre contre le point de départ (retour de playtest du 2026-09-18).
# Deux mâts encadrent maintenant l'entrée, tête vers elle ; les quatre autres
# sont dans les intervalles des files de places, tête au-dessus de l'allée.
PK_LAMPADAIRES = ((-6.5, -6.0, "+x"), (6.5, -6.0, "-x"),
                  (-14.5, -33.0, "+y"), (13.5, -33.0, "+y"),
                  (-14.5, -15.0, "-y"), (13.5, -15.0, "-y"))
# Origine de l'asset par rapport au fût, et rotation, selon le côté de la tête
# (l'asset a sa tête à +y, fût centré en (0,26 ; 0,26)).
PK_POSE_MAT = {"+y": ((-0.26, -0.26), 0), "-y": ((0.26, 0.26), 180),
               "-x": ((0.26, -0.26), 90), "+x": ((-0.26, 0.26), 270)}
PK_TETE = 1.19                                 # porte-à-faux de la tête


def habiller_parking(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z

    voitures = 0
    for j, vy in enumerate(PK_VOITURES_Y):
        for i, vx in enumerate(PK_VOITURES_X):
            # Un emplacement sur cinq reste vide : un parking plein au cordeau
            # se lit comme une grille, pas comme un parking.
            if (i + j) % 5 == 3:
                continue
            modele = R.MODELES_VOITURE[(i + 3 * j) % len(R.MODELES_VOITURE)]
            L.place(R.voiture(*modele), (vx + modele[2], vy, z), 90,
                    props, col_coll, f"pk_au{j}{i}")
            voitures += 1

    # Une voiture de plus à côté du pied-de-biche. Le plan le veut « sur le
    # capot » ; le repère du blockout est à 0,50 m du sol, sous la ligne de
    # capot (0,86 m), donc il est POSÉ À CÔTÉ et non dessus — écart assumé
    # plutôt qu'un pickup noyé dans la carrosserie.
    modele_pdb = R.MODELES_VOITURE[3]
    L.place(R.voiture(*modele_pdb), (-13.5 + modele_pdb[2], -29.5, z), 90,
            props, col_coll, "pk_au_pdb")
    voitures += 1

    # Cônes, pneu et caisses semés : même atlas que les voitures, donc aucun lot
    # de dessin de plus, et c'est ce qui distingue un parking utilisé d'un
    # parking construit.
    for i, (ax, ay, modele) in enumerate(((-3.0, -30.5, "cone"), (-1.0, -30.0, "cone"),
                                          (8.0, -22.0, "cone"), (-22.5, -10.0, "debris-tire"),
                                          (21.5, -7.0, "box"), (22.3, -7.8, "box"),
                                          (-21.0, -6.0, "box"))):
        L.place(R.accessoire_car_kit(modele), (ax, ay, z), i * 43,
                props, col_coll, f"pk_acc{i}")

    L.place(R.abri_caddies(6.0), (PK_ABRI[0], PK_ABRI[1], z), 0, props, col_coll, "pk_abri")
    for i, dy in enumerate((0.4, 1.35, 2.30)):
        L.place(L.caddie(), (PK_ABRI[0] + 2.6, PK_ABRI[1] + 0.5 + dy, z), 0,
                props, col_coll, f"pk_cd{i}")

    # Marquages au sol : UN par emplacement, aligné sur la voiture qui s'y range.
    # Les voitures du blockout sont alignées le long de X, museau à l'ouest —
    # une file pare-chocs contre pare-chocs et non une rangée d'emplacements
    # côte à côte. Les bandes suivent donc ce pas de 7 m, et non une trame
    # régulière qui les ferait se chevaucher.
    places = 0
    for j, vy in enumerate(PK_VOITURES_Y):
        for i, vx in enumerate(PK_VOITURES_X):
            L.place(R.marquage_place(5.0, 2.5), (vx - 0.5, vy - 0.3, z), 0,
                    props, props, f"pk_pm{j}_{i}")
            places += 1

    # Mâts d'éclairage : la seule lumière du parking.
    lampes = 0
    for i, (lx, ly, cote) in enumerate(PK_LAMPADAIRES):
        (ox, oy), rot = PK_POSE_MAT[cote]
        L.place(R.lampadaire(5.0), (lx + ox, ly + oy, z), rot, props, col_coll, f"pk_lp{i}")
        dx, dy = {"+y": (0, 1), "-y": (0, -1), "+x": (1, 0), "-x": (-1, 0)}[cote]
        lampe(logic, f"light_pk_{i}", (lx + dx * PK_TETE, ly + dy * PK_TETE, z + 4.45),
              color="#fff0d0", intensity=16.0, distance=22.0)
        lampes += 1

    for i, (px, py) in enumerate(((x0 + 1.0, y1 - 1.5), (x1 - 1.4, y0 + 1.2))):
        L.place(L.poubelle(), (px, py, z), 0, props, col_coll, f"pk_pou{i}")
    L.place(F.enseigne_murale("bienvenue"), (-3.0, y1 - 0.3, z + 3.4), 180,
            props, props, "pk_bienvenue")

    return {"voitures": voitures, "places": places, "lampadaires": len(PK_LAMPADAIRES),
            "lampes": lampes}


# --- Habillage : la cafétéria -------------------------------------------------
#
# Optionnelle, et c'est ce qui la définit : le plan y met du soin (+1 PV aux
# toilettes) et le secret 3. Première pièce MEUBLÉE du niveau et non achalandée
# — on y mange, on n'y achète rien.

CA_COMPTOIR = (37.0, 3.0)
CA_FRIGO = (53.0, 16.0)
CA_TABLES = tuple((34.0 + 4.0 + (i % 3) * 5.0, 0.0 + 9.0 + (i // 3) * 5.0) for i in range(6))
CA_NEON_X = (36.0, 44.0, 52.0)
CA_NEON_Y = (6.0, 14.0)
CA_NEONS_MORTS = frozenset({(52.0, 6.0)})


def habiller_cafeteria(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z

    L.place(B.comptoir_self(12.0), (CA_COMPTOIR[0], CA_COMPTOIR[1], z), 0,
            props, col_coll, "ca_self")
    L.place(L.frigo_garni(SEED + 950, "frais"), (CA_FRIGO[0], CA_FRIGO[1], z), 0,
            props, col_coll, "ca_frigo")

    for i, (tx, ty) in enumerate(CA_TABLES):
        L.place(B.table_cafeteria(i % 3), (tx, ty, z), 0, props, col_coll, f"ca_tb{i}")

    for i, facade in enumerate(B.FACADES_DISTRIBUTEUR):
        L.place(B.distributeur(facade), (x1 - 1.05, y0 + 2.0 + i * 1.0, z), 90,
                props, col_coll, f"ca_dist{i}")

    # Accès au secret 3 : la bouche d'aération du mur nord (`plan.PASSAGES`), au-
    # dessus d'un distributeur de 1,90 m, devant lequel traîne une caisse d'un
    # mètre. Deux sauts de 1,00 et 0,90 m, sous les 1,10 m du saut. L'ancienne
    # chaîne passait par un frigo de 2,20 m — 1,20 m à sauter depuis la caisse :
    # personne ne pouvait monter, et personne ne le savait, puisque le « secret »
    # se déclenchait au sol.
    ventx = plan.PASSAGES[frozenset({"cafeteria", "secret3"})][1] - 1.0
    L.place(B.distributeur("soda_5g_cola"), (ventx + 0.05, y1 - bo.EPAISSEUR_MUR - 0.75, z), 0,
            props, col_coll, "ca_dist_vmc")
    sx, sy = ventx, y1 - bo.EPAISSEUR_MUR - 1.75
    H.box("caisse_acces_secret3", (sx, sy, z, sx + 1.0, sy + 1.0, z + 1.0), "carton", props)
    H.col_box("caisse_acces_secret3", (sx, sy, z, sx + 1.0, sy + 1.0, z + 1.0), col_coll)
    # Le cadre de la bouche, côté cafétéria : un trou dans un mur se lit comme un
    # défaut, un trou encadré comme une bouche.
    # Il mord d'un centimètre sur la baie : à fleur, ses faces intérieures
    # doublaient les bouts du mur.
    H.boxes("ca_bouche_cadre", [((ventx - 0.08, y1 - 0.3, z + 2.0, ventx + 0.01, y1 - 0.24, z + 4.0), "world"),
                                ((ventx + 1.99, y1 - 0.3, z + 2.0, ventx + 2.08, y1 - 0.24, z + 4.0), "world")],
            "metal_bac_acier", props)

    L.place(B.fontaine_eau(), (x0 + 0.6, 2.0, z), 0, props, col_coll, "ca_fontaine")
    for i, (px, py) in enumerate(((x0 + 0.8, y1 - 1.5), (x1 - 1.4, y1 - 1.4))):
        L.place(L.poubelle(), (px, py, z), 0, props, col_coll, f"ca_pou{i}")
    # y = 18,6 et non 19 : le mur nord est épais de 0,25 m, le bac entrait dedans.
    for i, (px, py) in enumerate(((40.0, 18.6), (47.0, 18.6))):
        L.place(L.bac_garni(SEED + 970 + i), (px, py, z), 0, props, col_coll, f"ca_bac{i}")

    meubles = semer(props, col_coll, "ca_k", (
        ("kitchenCoffeeMachine", 47.5, 3.6, z + 1.10, 0),
        ("toaster", 45.0, 3.7, z + 1.10, 15),
        ("kitchenMicrowave", 43.0, 3.6, z + 1.10, 0),
        ("kitchenFridge", 55.0, 1.2, z, 270),
        ("pottedPlant", 34.9, 1.2, z, 0), ("pottedPlant", 53.0, 18.6, z, 0),
        ("pottedPlant", 44.0, 18.8, z, 0), ("plantSmall2", 43.0, 9.0, z + 0.75, 0),
        ("stoolBar", 38.0, 5.0, z, 0), ("stoolBar", 40.0, 5.0, z, 0),
        ("stoolBar", 42.0, 5.0, z, 0), ("stoolBar", 44.0, 5.0, z, 0),
        ("trashcan", 34.8, 12.0, z, 0), ("radio", 38.5, 3.7, z + 1.10, 200),
    ))
    rampes, lampes = _neons(space, props, logic, CA_NEON_X, CA_NEON_Y,
                            CA_NEONS_MORTS, "ca", doubles=CA_NEON_X)
    return {"tables": len(CA_TABLES), "distributeurs": len(B.FACADES_DISTRIBUTEUR),
            "meubles": meubles, "rampes": rampes, "lampes": lampes}


# --- Habillage : les toilettes de la cafétéria --------------------------------
#
# Demandées le 2026-09-24 (« il manque une vraie salle pour les toilettes ») :
# jusque-là, le +1 PV du plan tenait dans un cube `use_toilet` flottant au milieu
# de la cafétéria. Une salle carrelée derrière une porte « WC » : trois cabines
# au nord, deux lavabos au sud, deux urinoirs à l'est.
#
# Passe suivante, MÊME JOUR : les cuvettes et les urinoirs deviennent
# `sanitaire_*`, utilisables et cassables façon Duke Nukem 3D (contrat détaillé
# dans `tools/blender/README.md#sanitaires`) — la plaque de chasse d'eau
# (`wc_plaque_chasse`) redevient un simple décor, un `use_*` posé à côté d'un
# `sanitaire_*` lui aurait volé la portée d'usage.

WC_CABINES_X = 60.0                        # bord ouest de la première cabine
WC_CABINE_L, WC_CABINE_P = 1.25, 1.75      # largeur, profondeur depuis le mur nord
WC_PORTE_CABINE = 0.8
WC_CLOISON = 0.04
# Les cloisons de cabine s'arrêtent à 15 cm du sol : c'est à ça qu'on les
# reconnaît. Leurs COLLIDERS, eux, descendent jusqu'au sol — un proxy qui flotte
# est ce que `audit_niveau.py` appelle un objet flottant — et font 12 cm
# d'épaisseur : `validate_level.py` exige 10 cm contre le tunneling, et à 10 cm
# pile l'arrondi flottant le fait échouer.
WC_CLOISON_BAS, WC_CLOISON_HAUT = 0.15, 2.15
WC_COLLIDER_MIN = 0.12
WC_STRATIFIE = "#237978"                   # le vert d'eau des cabines de toilettes publiques
WC_URINOIRS_Y = (9.5, 11.0)
WC_NEONS_X, WC_NEONS_Y = (58.25, 61.25), (8.0,)
WC_NEONS_MORTS = frozenset({(61.25, 8.0)})  # un tube grillé au-dessus des urinoirs


def _vantail_entrouvert(nom: str, charniere, largeur: float, angle_deg: float,
                        z0: float, z1: float, props) -> None:
    """Porte de cabine ouverte vers l'intérieur. La rotation est FIGÉE dans le
    mesh et l'objet reste à l'origine, sur la grille — comme tout ce que pose
    `L.place`."""
    hx, hy = charniere
    obj = H.box(nom, (0.0, -0.015, z0, largeur, 0.015, z1), "palette", props, uv=f"aplat:{WC_STRATIFIE}")
    obj.data.transform(Matrix.Translation((hx, hy, 0.0)) @ Matrix.Rotation(math.radians(angle_deg), 4, "Z"))


def _collider_epaissi(nom: str, b, z_sol: float, col_coll) -> None:
    """Proxy d'une paroi mince : posé au sol, élargi à `WC_COLLIDER_MIN` sur son
    axe le plus mince, centré sur elle."""
    x0, y0, _, x1, y1, z1 = b
    if x1 - x0 < y1 - y0:
        c = (x0 + x1) / 2
        x0, x1 = min(x0, c - WC_COLLIDER_MIN / 2), max(x1, c + WC_COLLIDER_MIN / 2)
    else:
        c = (y0 + y1) / 2
        y0, y1 = min(y0, c - WC_COLLIDER_MIN / 2), max(y1, c + WC_COLLIDER_MIN / 2)
    H.col_box(nom, (x0, y0, z_sol, x1, y1, z1), col_coll)


# PV d'un `sanitaire_*` cassable (2026-09-24, contrat runtime partagé avec le
# loader/`SanitaireSystem`, écrit en parallèle). Choisi contre
# `src/game/player/weaponConfig.ts::damageForWeapon` : un coup de pied-de-biche
# (`meleeDamage` = 40) ne casse PAS la faïence d'un coup, il en faut deux
# (2 × 40 = 80) ; un coup de pompe à bout portant, où les neuf plombs du cône de
# 5° convergent tous sur une cible aussi proche (9 × `shotgunDamagePerPellet` =
# 9 × 6 = 54), casse en un seul tir. 50 tient entre les deux.
SANITAIRE_PV = 50


def _rendre_sanitaire(nom_pose: str, nom_final: str, sorte: str) -> None:
    """Renomme une copie posée par `poser`/`L.place` en `sanitaire_<sorte>` et
    lui donne ses extras (`sorte`, `pv`).

    Contrairement à un meuble ordinaire, un `sanitaire_*` ne garde AUCUN
    `col_box` jumeau : le loader en construit un lui-même, fixe, sur sa bbox
    monde (même logique que pour un `prop_*`, sauf que celui-ci ne bouge
    jamais). C'est pour ça que `MEUBLES["toilet"]` porte `collider=False` —
    sans quoi `L.place` aurait copié un `col_box_toilet_<suffixe>` que
    personne ne renomme ni ne retire ici.
    """
    obj = bpy.data.objects[nom_pose]
    obj.name = nom_final
    obj["sorte"] = sorte
    obj["pv"] = SANITAIRE_PV


def habiller_toilettes(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    t = bo.EPAISSEUR_MUR
    est, sud, nord = x1 - t, y0 + t, y1 - t
    yf = nord - WC_CABINE_P                     # la ligne des portes de cabine
    e = WC_CLOISON / 2
    xs = [WC_CABINES_X + i * WC_CABINE_L for i in range(3)]

    # Plafond de plâtre peint, monté comme un MUR (`bo.boite`) : il porte ainsi
    # l'attribut `Col` des murs et se fond au chargement dans le lot de plâtre que
    # la cellule a déjà — le mur est de la cafétéria. En dalles, ou sans `Col`, il
    # coûtait un lot de dessin à lui seul (mesuré : 4 lots pour la salle, ramenés
    # à 2 avec le sol carrelé).
    bo.boite("plafond_toilettes", (x0, y0, z + space.hauteur),
             (space.largeur, space.profondeur, EPAISSEUR_PLAFOND),
             "mur", {"mur": H.textured_material(COQUE[space.id][2])}, props, None, avec_collider=False)

    # Cabines : une cloison à l'ouest de chacune (la dernière s'appuie sur le mur
    # est), une façade percée de trois portes, une lisse d'acier par-dessus.
    cloisons = [(sx - e, yf + e, z + WC_CLOISON_BAS, sx + e, nord, z + WC_CLOISON_HAUT) for sx in xs]
    bords = [xs[0] - e] + [v for sx in xs for v in (sx + 0.225, sx + 0.225 + WC_PORTE_CABINE)] + [est]
    cloisons += [(a, yf - e, z + WC_CLOISON_BAS, b, yf + e, z + WC_CLOISON_HAUT)
                 for a, b in zip(bords[::2], bords[1::2])]
    H.boxes("wc_cloisons", [(c, f"aplat:{WC_STRATIFIE}") for c in cloisons], "palette", props)
    for i, c in enumerate(cloisons):
        _collider_epaissi(f"wc_cloison{i}", c, z, col_coll)
    H.box("wc_lisse", (xs[0] - e, yf - 0.03, z + WC_CLOISON_HAUT, est, yf + 0.03, z + WC_CLOISON_HAUT + 0.04),
          "metal_bac_acier", props)

    # La première cabine est ouverte — la chasse d'eau y est —, la deuxième
    # fermée, avec des chaussures qui dépassent dessous, la troisième ouverte.
    for i, sx in enumerate(xs):
        a = sx + 0.225
        if i == 1:
            porte = (a + 0.005, yf - 0.015, z + WC_CLOISON_BAS, a + WC_PORTE_CABINE - 0.005, yf + 0.015, z + 2.0)
            H.box("wc_porte_fermee", porte, "palette", props, uv=f"aplat:{WC_STRATIFIE}")
            _collider_epaissi("wc_porte_fermee", porte, z, col_coll)
        else:
            _vantail_entrouvert(f"wc_porte{i}", (a + 0.005, yf), WC_PORTE_CABINE - 0.01, 70.0,
                                z + WC_CLOISON_BAS, z + 2.0, props)
    # Cuir marron et non noir : des chaussures noires disparaissent dans les
    # cases noires du damier (constaté en rendu).
    cx = xs[1] + WC_CABINE_L / 2
    H.boxes("wc_chaussures", [((cx - 0.17, yf - 0.10, z, cx - 0.06, yf + 0.18, z + 0.09), "aplat:#654933"),
                              ((cx + 0.06, yf - 0.10, z, cx + 0.17, yf + 0.18, z + 0.09), "aplat:#654933")],
            "palette", props)

    lx, ly, _ = _emprise(B.meuble("toilet"))
    for i, sx in enumerate(xs):
        poser(B.meuble("toilet"), sx + (WC_CABINE_L - lx) / 2, nord - ly, z, "-y", props, col_coll,
              f"wc_cuvette{i}")
        _rendre_sanitaire(f"mob_k_toilet_wc_cuvette{i}", f"sanitaire_cuvette{i}", "cuvette")
    # La plaque de chasse d'eau, au-dessus du réservoir de la première cabine.
    # DÉCOR pur depuis le 2026-09-24 (`wc_plaque_chasse`, plus un `use_*`) : un
    # `use_*` passe AVANT un `sanitaire_*` au test de portée du joueur et
    # volerait l'appui sur E à la cuvette juste à côté — le soin façon Duke
    # (« +10 PV en se soulageant ») vient maintenant de `sanitaire_cuvette0`
    # elle-même, lue par le système qui gère `sanitaire_*` (hors scope ici).
    # Centrée SUR la face du mur, comme les lecteurs de carte : son origine reste
    # sur la grille.
    rx, ry = next((r[1], r[2]) for r in space.reperes if "toilettes" in r[0])
    H.box("wc_plaque_chasse", (rx - 0.125, ry - 0.04, z + 1.15, rx + 0.125, ry + 0.04, z + 1.35),
          "metal_bac_acier", props)

    # Lavabos et miroirs contre le mur sud, poubelle, sèche-mains.
    mx, _, _ = _emprise(B.meuble("bathroomMirror"))
    for i, lav_x in enumerate((57.0, 58.5)):
        bx0, _, bx1, _ = poser(B.meuble("bathroomSink"), lav_x, sud, z, "+y", props, col_coll, f"wc_lavabo{i}")
        poser(B.meuble("bathroomMirror"), (bx0 + bx1) / 2 - mx / 2, sud, z + 1.15, "+y", props, col_coll,
              f"wc_miroir{i}")
    poser(B.meuble("trashcan"), 59.75, sud, z, "+y", props, col_coll, "wc_poubelle")
    H.box("wc_seche_mains", (60.25, sud, z + 1.2, 60.55, sud + 0.2, z + 1.5), "metal_bac_acier", props)

    # Urinoirs contre le mur est : la cuvette, sa lèvre 2 cm devant (jamais à
    # fleur). Chacun est son propre `sanitaire_urinoir<i>` (UN mesh, UN
    # matériau — cuvette + lèvre, sans la descente d'eau ni la séparation :
    # le jet d'eau du jeu part du bas-centre de la bbox de l'appareil, qui
    # doit donc être celle de la cuvette seule). La descente d'eau et la
    # séparation entre les deux appareils restent du DÉCOR (`wc_tuyaux`,
    # `wc_urinoir_separation`), jamais cassables.
    tuyaux = []
    for i, uy in enumerate(WC_URINOIRS_Y):
        cuvette = (est - 0.33, uy - 0.2, z + 0.55, est, uy + 0.2, z + 1.15)
        levre = (est - 0.35, uy - 0.15, z + 0.60, est - 0.30, uy + 0.15, z + 0.72)
        obj = H.boxes(f"sanitaire_urinoir{i}",
                      [(cuvette, "aplat:#f2efe6"), (levre, "aplat:#a2a3a1")], "palette", props)
        obj["sorte"] = "urinoir"
        obj["pv"] = SANITAIRE_PV
        tuyaux.append(((est - 0.06, uy - 0.015, z + 1.15, est - 0.03, uy + 0.015, z + 1.45), "world"))
    ym = sum(WC_URINOIRS_Y) / 2
    H.box("wc_urinoir_separation", (est - 0.45, ym - e, z + 0.5, est, ym + e, z + 1.4), "palette", props,
          uv=f"aplat:{WC_STRATIFIE}")
    H.boxes("wc_tuyaux", tuyaux, "metal_bac_acier", props)

    rampes, lampes = _neons(space, props, logic, WC_NEONS_X, WC_NEONS_Y, WC_NEONS_MORTS, "wc")
    return {"cabines": len(xs), "lavabos": 2, "urinoirs": len(WC_URINOIRS_Y),
            "rampes": rampes, "lampes": lampes}


# --- Poser un meuble d'après ses VRAIES cotes -------------------------------
#
# Tous les assets de la bibliothèque, kits CC0 compris, regardent le −y local.
# Deviner la rotation d'après un voisin a déjà coûté des téléviseurs tournés
# vers le mur (électroménager, N9) : `poser` prend l'emprise VOULUE au sol (coin
# minimal) et le côté vers lequel la façade doit regarder, et calcule seul
# l'origine et la rotation depuis les cotes réelles de l'asset.

_ROTATION_FACE = {"-y": 0, "+x": 90, "+y": 180, "-x": 270}


def poser(asset: str, x_min: float, y_min: float, z: float, face: str, props, col_coll,
          suffixe: str) -> tuple[float, float, float, float]:
    """Pose `asset` pour que son emprise commence à (x_min, y_min) et que sa
    façade regarde `face`. Retourne l'emprise monde (x0, y0, x1, y1)."""
    lx, ly, _ = _emprise(asset)
    rot = _ROTATION_FACE[face]
    if face in ("-y", "+y"):
        w, d = lx, ly
    else:
        w, d = ly, lx
    origine = {"-y": (x_min, y_min), "+y": (x_min + lx, y_min + ly),
               "+x": (x_min + ly, y_min), "-x": (x_min, y_min + lx)}[face]
    L.place(asset, (origine[0], origine[1], z), rot, props, col_coll, suffixe)
    return (x_min, y_min, x_min + w, y_min + d)


def vraie_fenetre(nom: str, espace: str, bornes, props) -> None:
    """Perce une VRAIE fenêtre dans un mur de coque : on voit la ville au loin
    (le ciel de `render/ciel.ts`), plus un aplat bleu nuit.

    Seul le RENDU du mur est percé : son collider reste plein, donc la vitre
    n'a pas besoin du sien (`solide: false`) et reste incassable — casser une
    fenêtre sur le vide pour trouver un mur invisible derrière serait pire que
    de ne rien casser. Ne percer que des murs qui donnent sur l'EXTÉRIEUR du
    bâtiment : les toits n'existent pas, un plafond ne se voit que d'en dessous.

    `bornes` : le trou, en monde, à travers toute l'épaisseur du mur.
    """
    hx0, hy0, hz0, hx1, hy1, hz1 = bornes
    le_long_x = (hx1 - hx0) > (hy1 - hy0)
    # Les murs viennent d'être créés : sans cette mise à jour, leur
    # `matrix_world` vaut encore l'identité.
    bpy.context.view_layer.update()
    murs = []
    for o in list(bpy.data.collections["SHELL"].objects):
        if not o.name.startswith(f"mur_{espace}_"):
            continue
        pts = [o.matrix_world @ v.co for v in o.data.vertices]
        w = tuple(min(p[i] for p in pts) for i in range(3)) + tuple(max(p[i] for p in pts) for i in range(3))
        if w[0] <= hx0 + 1e-6 and w[3] >= hx1 - 1e-6 and w[1] <= hy0 + 1e-6 and w[4] >= hy1 - 1e-6 \
                and w[2] <= hz0 + 1e-6 and w[5] >= hz1 - 1e-6:
            murs.append((o, w))
    if len(murs) != 1:
        raise RuntimeError(f"{nom} : {len(murs)} murs de {espace} contiennent le trou {bornes}")
    mur, (wx0, wy0, wz0, wx1, wy1, wz1) = murs[0]
    materiau = mur.data.materials[0]
    nom_mur = mur.name
    bpy.data.objects.remove(mur, do_unlink=True)
    coll = bpy.data.collections["SHELL"]
    mats = {"mur": materiau}
    if le_long_x:
        morceaux = [((wx0, wy0, wz0), (wx1 - wx0, wy1 - wy0, hz0 - wz0)),
                    ((wx0, wy0, hz1), (wx1 - wx0, wy1 - wy0, wz1 - hz1)),
                    ((wx0, wy0, hz0), (hx0 - wx0, wy1 - wy0, hz1 - hz0)),
                    ((hx1, wy0, hz0), (wx1 - hx1, wy1 - wy0, hz1 - hz0))]
    else:
        morceaux = [((wx0, wy0, wz0), (wx1 - wx0, wy1 - wy0, hz0 - wz0)),
                    ((wx0, wy0, hz1), (wx1 - wx0, wy1 - wy0, wz1 - hz1)),
                    ((wx0, wy0, hz0), (wx1 - wx0, hy0 - wy0, hz1 - hz0)),
                    ((wx0, hy1, hz0), (wx1 - wx0, wy1 - hy1, hz1 - hz0))]
    for i, (origine, taille) in enumerate(morceaux):
        bo.boite(f"{nom_mur}_{nom}{i}", origine, taille, "mur", mats, coll, None, avec_collider=False)
    # Dormant alu sur le pourtour du trou, la vitre au milieu de l'épaisseur,
    # une tablette côté intérieur.
    e = 0.05
    if le_long_x:
        cadre = [(hx0, wy0, hz0, hx1, wy1, hz0 + e), (hx0, wy0, hz1 - e, hx1, wy1, hz1),
                 (hx0, wy0, hz0, hx0 + e, wy1, hz1), (hx1 - e, wy0, hz0, hx1, wy1, hz1),
                 ((hx0 + hx1) / 2 - 0.025, wy0 + 0.1, hz0, (hx0 + hx1) / 2 + 0.025, wy1 - 0.1, hz1)]
        milieu = (wy0 + wy1) / 2
        vitre = (hx0 + e, milieu - 0.01, hz0 + e, hx1 - e, milieu + 0.01, hz1 - e)
    else:
        cadre = [(wx0, hy0, hz0, wx1, hy1, hz0 + e), (wx0, hy0, hz1 - e, wx1, hy1, hz1),
                 (wx0, hy0, hz0, wx1, hy0 + e, hz1), (wx0, hy1 - e, hz0, wx1, hy1, hz1),
                 (wx0 + 0.1, (hy0 + hy1) / 2 - 0.025, hz0, wx1 - 0.1, (hy0 + hy1) / 2 + 0.025, hz1)]
        milieu = (wx0 + wx1) / 2
        vitre = (milieu - 0.01, hy0 + e, hz0 + e, milieu + 0.01, hy1 - e, hz1 - e)
    H.boxes(f"{nom}_cadre", [(b, "world") for b in cadre], "metal_bac_acier", props)
    v = H.box(f"vitre_{nom}", vitre, "verre", props, uv=f"aplat:{H.VERRE_TEINTE}")
    v["solide"] = False
    # Le mur supprimé resterait sinon dans la liste des objets de la vue.
    bpy.context.view_layer.update()


def cylindre_aplat(nom: str, centre, rayon: float, z0: float, z1: float, couleur: str, coll):
    """Cylindre d'UNE couleur du nuancier : `H.cylinder` projette ses UV comme une
    boîte, ce qui sur `palette.png` donnerait un arc-en-ciel. Ses UV sont donc
    ramenées sur le pavé de la couleur voulue — un matériau de plus : aucun."""
    obj = H.cylinder(nom, centre, rayon, z0, z1, "palette", coll)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    couche = bm.loops.layers.uv.active
    teinte = H._uv_aplat(couleur)
    for face in bm.faces:
        teinte(face, couche)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def cloison_pleine(nom: str, bornes, props, col_coll, texture: str = "mur_platre") -> None:
    """Cloison de bureau jusqu'au plafond, avec son collider. Une cloison
    d'étage est un mur : on ne la franchit que par sa porte."""
    H.box(nom, bornes, texture, props, subdiv=SUBDIV_BAKE)
    H.col_box(nom, bornes, col_coll)


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


# --- Portes animées -----------------------------------------------------------
#
# « J'aimerais des vraies portes qui bougent » (2026-09-19). Deux causes, à deux
# endroits : le jeu n'animait jamais le vantail — seul son corps physique
# glissait, invisible (ADR 0031) — et le niveau n'avait que cinq portes, des
# boîtes de 4 m sans quincaillerie. Chaque installation ci-dessous pose des
# VANTAUX : un `door_*` par vantail, origine au centre de sa boîte (le loader
# pose le corps sur l'origine, ADR 0012), sans rotation d'objet, et à UN SEUL
# matériau. La poignée partage la texture du vantail (`quincaillerie:`), le
# verre d'une porte vitrée est dans l'alpha de la sienne : deux matériaux
# feraient deux primitives glTF, donc un groupe que le loader ne reconnaît plus
# comme une porte.
#
# Le mouvement se déclare en extras, lus par le jeu (voir
# docs/reference/conventions-nommage.md#portes) : `battant` autour d'une
# charnière, `coulisse`, `monte`, `descend`. Une porte `auto` s'ouvre devant qui
# s'approche, joueur OU ennemi : seules les portes verrouillées (carte, sens
# unique, secret) gardent les Costards de leur côté, et le graphe de navigation
# traverse toutes les autres.

EP_VANTAIL = 0.05

# Hauteur du vantail de chaque façade à porte : `poser_linteaux` pose l'imposte
# au-dessus. `None` : l'installation pose elle-même ce qu'il y a au-dessus (le
# sas vitré a une traverse d'automatisme et un vitrage, pas un pan de mur).
# Sur la grille de 0,25 m : l'imposte a son origine au haut du vantail.
HAUTEUR_VANTAIL = {
    frozenset({"parking_ext", "c_pk_ga"}): None,
    frozenset({"c_pk_ga", "galerie"}): None,
    frozenset({"hub", "c_hb_rs"}): 2.0,
    frozenset({"c_hb_rs", "reserve"}): 2.5,
    frozenset({"c_bu", "c_escalier"}): 2.0,
    frozenset({"bureaux", "direction"}): 2.25,
    frozenset({"c_short_w", "rayons"}): 2.25,
    frozenset({"galerie", "secret1"}): bo.HAUTEUR_PORTE,
    frozenset({"cafeteria", "toilettes"}): 2.0,
    "sortie": 2.25,
}


def _cle_porte(o):
    return "sortie" if o is bo.OUVERTURE_SORTIE else frozenset({o.a, o.b})


def _monde(o, u0, v0, z0, u1, v1, z1):
    """Boîte monde d'après des cotes le long de la façade (u), en travers (v,
    compté depuis la ligne de façade) et en hauteur."""
    (ua, ub), (va, vb) = sorted((u0, u1)), sorted((v0, v1))
    if o.axe == "y":
        return (ua, o.at + va, z0, ub, o.at + vb, z1)
    return (o.at + va, ua, z0, o.at + vb, ub, z1)


def _charniere(o, bout: str) -> str:
    """`charniere` d'un vantail dont la charnière est au bout `bout` ("min" ou
    "max") de son grand axe, compté dans le repère de BLENDER. Le jeu la lit
    dans le repère three.js, où le +Y de Blender devient −Z : pour un vantail
    long en y (façade `axe == "x"`), les deux bouts s'échangent."""
    if o.axe == "y":
        return bout
    return "max" if bout == "min" else "min"


def _centrer_origine(obj) -> None:
    pts = [v.co.copy() for v in obj.data.vertices]
    c = Vector(tuple((min(p[i] for p in pts) + max(p[i] for p in pts)) / 2 for i in range(3)))
    for v in obj.data.vertices:
        v.co -= c
    obj.location = c


def vantail(nom: str, bornes, texture: str, uv: str, coll, extras: dict,
            quincaillerie=(), uv_quincaillerie: str | None = None):
    """Un `door_*` : le vantail et sa quincaillerie en un seul mesh, origine au
    centre, extras de mouvement posés en custom properties."""
    # La boîte englobante du vantail EST son collider et décide de sa charnière :
    # une poignée posée hors de sa hauteur (déjà arrivé, à l'étage) l'étire
    # sans rien dire.
    for b in quincaillerie:
        if not (bornes[2] <= b[2] and b[5] <= bornes[5]):
            raise ValueError(f"{nom} : quincaillerie hors du vantail ({b[2]:.2f}–{b[5]:.2f} m)")
    parts = [(bornes, uv)] + [(b, uv_quincaillerie or uv) for b in quincaillerie]
    obj = H.boxes(nom, parts, texture, coll)
    _centrer_origine(obj)
    for cle, valeur in extras.items():
        obj[cle] = valeur
    return obj


def _bequilles(o, libre: float, vers_charniere: int):
    """Rosace et béquille sur les deux faces, près du bord libre. `vers_charniere`
    vaut −1 si la charnière est du côté des u décroissants."""
    e = EP_VANTAIL / 2
    s = vers_charniere
    z = o.z
    out = []
    for f in (-1, 1):
        out.append(_monde(o, libre + s * 0.08, f * e, z + 0.99, libre + s * 0.12, f * (e + 0.02), z + 1.13))
        out.append(_monde(o, libre + s * 0.08, f * (e + 0.02), z + 1.04, libre + s * 0.24, f * (e + 0.05),
                          z + 1.07))
    return out


def _barre_anti_panique(o, a: float, b: float, face: int):
    """Barre horizontale et ses deux platines, sur la face `face` (±1 en v)."""
    e = EP_VANTAIL / 2
    z = o.z
    return [_monde(o, a + 0.10, face * (e + 0.04), z + 0.98, b - 0.10, face * (e + 0.07), z + 1.05),
            _monde(o, a + 0.08, face * e, z + 0.95, a + 0.14, face * (e + 0.07), z + 1.08),
            _monde(o, b - 0.14, face * e, z + 0.95, b - 0.08, face * (e + 0.07), z + 1.08)]


def _sens_vers(o, bout: str, vers: int) -> str:
    """`sens` forcé d'un battant pour qu'il s'ouvre du côté `vers` (±1 en v).

    Le jeu tourne le vantail autour de +Y three.js, dans le sens direct pour
    "+". Pour une façade perpendiculaire à y, le bout libre d'un vantail à
    charnière `min` part vers +x ; une rotation directe autour de +Y l'envoie
    vers −Z three.js, c'est-à-dire +y Blender : "+" ouvre vers les v POSITIFS.
    Charnière `max`, bout libre vers −x : c'est l'inverse.
    """
    if o.axe != "y":
        raise ValueError("sens forcé : seulement pour une façade perpendiculaire à y")
    positif = (bout == "min") == (vers > 0)
    return "+" if positif else "-"


def porte_double(o, noms, hauteur: float, texture: str, uv: str, coll, extras: dict,
                 quincaillerie: str | None = None, face_barre: int = 1,
                 uv_quincaillerie: str | None = None, vers: int | None = None) -> list:
    """Deux vantaux battants dans l'ouverture `o`, charnières aux deux bouts.
    `quincaillerie` : "bequille", "barre" (anti-panique, sur `face_barre`) ou
    rien (va-et-vient : la plaque de poussée est peinte). `vers` (±1 en v)
    force le côté où ils s'ouvrent ; sinon, `extras` décide (`sens`)."""
    lo, hi = o.span
    mid = (lo + hi) / 2
    e = EP_VANTAIL / 2
    out = []
    for nom, (a, b), bout, libre, s in ((noms[0], (lo, mid - 0.005), "min", mid - 0.005, -1),
                                         (noms[1], (mid + 0.005, hi), "max", mid + 0.005, 1)):
        q = []
        if quincaillerie == "bequille":
            q = _bequilles(o, libre, s)
        elif quincaillerie == "barre":
            q = _barre_anti_panique(o, a, b, face_barre)
        propres = dict(extras, mouvement="battant", charniere=_charniere(o, bout))
        if vers is not None:
            propres["sens"] = _sens_vers(o, bout, vers)
        out.append(vantail(nom, _monde(o, a, -e, o.z + 0.01, b, e, o.z + hauteur), texture, uv, coll,
                           propres, q, uv_quincaillerie))
    return out


def _use_de_carte(o, nom_porte: str, carte: str, logic) -> None:
    """Le lecteur de carte : un boîtier plaqué au mur, à droite de la porte, du
    côté d'où l'on arrive (les v négatifs pour les trois portes à carte).

    Un `use_*` reste VISIBLE en jeu : au blockout, c'était un cube de 60 cm
    flottant à un mètre du mur. La portée d'usage (2 m) se mesure jusqu'à son
    origine, pas jusqu'à sa surface : sa taille ne change rien au gameplay."""
    # Centré SUR la face du mur (il en dépasse de 4 cm) : son origine reste sur
    # la grille de 0,25 m, comme celle de tout objet hors vantail.
    face = -bo.EPAISSEUR_MUR
    centre = _monde(o, o.span[1] + 0.5, face, o.z + 1.25, o.span[1] + 0.5, face, o.z + 1.25)[:3]
    taille = (0.2, 0.08, 0.3) if o.axe == "y" else (0.08, 0.2, 0.3)
    bo.boite_centree(f"use_{nom_porte}", centre, taille, "repere",
                     {"repere": H.textured_material("metal_bac_acier")}, logic,
                     extras={"target": nom_porte, "requires": carte})


# Le sas d'entrée : deux façades vitrées, chacune avec deux vantaux coulissants
# au milieu et deux panneaux fixes CASSABLES de part et d'autre. `dedans` : le
# côté de la façade (±1 en v) où est le sas — les vantaux coulissent de ce
# côté-là, devant les panneaux fixes, sous le caisson de l'automatisme.
SAS_FIXE = 2.0
SAS_HAUT = 2.5
SAS_PV = 25


def sas_vitre(o, groupe: str, dedans: int, props, col_coll) -> int:
    lo, hi = o.span
    mid = (lo + hi) / 2
    ht = o.z + min(s.z + s.hauteur for s in plan.ALL if s.id in (o.a, o.b))
    e = EP_VANTAIL / 2
    tag = groupe
    # Panneaux fixes, sur la ligne de façade.
    for i, (a, b) in enumerate(((lo, lo + SAS_FIXE), (hi - SAS_FIXE, hi))):
        v = H.box(f"vitre_{tag}_fixe{i}", _monde(o, a + 0.06, -0.015, o.z + 0.10, b - 0.03, 0.015, SAS_HAUT),
                  "verre", props, uv=f"aplat:{H.VERRE_TEINTE}")
        v["pv"] = SAS_PV
    # Menuiseries : seuils sous les fixes, montants, caisson de l'automatisme.
    alu = [_monde(o, lo, -0.05, o.z, lo + SAS_FIXE, 0.05, o.z + 0.10),
           _monde(o, hi - SAS_FIXE, -0.05, o.z, hi, 0.05, o.z + 0.10)]
    for u in (lo, lo + SAS_FIXE - 0.03, hi - SAS_FIXE - 0.03, hi - 0.06):
        alu.append(_monde(o, u, -0.05, o.z, u + 0.06, 0.05, SAS_HAUT))
    alu.append(_monde(o, lo, dedans * 0.03, SAS_HAUT, hi, dedans * 0.28, SAS_HAUT + 0.30))
    alu.append(_monde(o, lo, -0.05, SAS_HAUT, hi, 0.05, SAS_HAUT + 0.06))
    alu.append(_monde(o, lo, -0.05, ht - 0.06, hi, 0.05, ht))
    H.boxes(f"sas_{tag}_alu", [(b, "world") for b in alu], "metal_bac_acier", props)
    # Imposte vitrée au-dessus du caisson : on voit le ciel en entrant. Pas de
    # collider (hors d'atteinte), et le parking garde son linteau au-delà de 4 m.
    v = H.box(f"vitre_{tag}_imposte", _monde(o, lo + 0.03, -0.015, SAS_HAUT + 0.06, hi - 0.03, 0.015, ht - 0.06),
              "verre", props, uv=f"aplat:{H.VERRE_TEINTE}")
    v["solide"] = False
    # Les deux vantaux, décalés côté sas pour coulisser devant les fixes.
    v0 = dedans * 0.10
    for nom, (a, b), sens in ((f"door_{tag}_g", (lo + SAS_FIXE, mid - 0.005), "-"),
                              (f"door_{tag}_d", (mid + 0.005, hi - SAS_FIXE), "+")):
        vantail(nom, _monde(o, a, v0 - e, o.z + 0.01, b, v0 + e, SAS_HAUT - 0.01), "portes_verre",
                "porte:porte_auto", props,
                dict(mouvement="coulisse", sens=sens, course=SAS_FIXE - 0.05, auto=True, portee=3.0,
                     referme=True, delai=1.0, groupe=tag))
    return 2


# Portes sans carte ouvertes par un `use_*` qui porte `target` et un `message`
# (le jeu les reconnaît à ça, `game/level/interactive.ts`). Le SENS UNIQUE de
# la porte coupe-feu tient à la place de son bouton : à plus de 2 m (portée
# d'usage) de tout point du côté rayons. Une fois ouverte, elle le reste — le
# raccourci à la Doom, mérité.
PORTES_LIBRES = {
    frozenset({"galerie", "secret1"}): dict(
        porte="door_secret_photomaton", use="use_photomaton", texture="mur_platre", imposte="mur_platre",
        # DANS le caisson du photomaton : c'est lui qu'on utilise, et le bouton
        # n'a pas à se voir.
        use_centre=(-29.0, 6.5, 1.0), use_taille=(0.5, 0.5, 0.5),
        message="Clic ! Flash ! Derrière le photomaton, un pan de mur s'efface..."),
    frozenset({"c_short_w", "rayons"}): dict(
        porte="door_coupe_feu", use="use_coupe_feu", texture="metal_peint_rouge", secours=True,
        # Sur le mur ouest du couloir, à côté de la porte, à 2,9 m de tout point
        # côté rayons : hors de la portée d'usage (2 m) depuis la surface de vente.
        use_centre=(-43.75, 86.5, 1.25), use_taille=(0.1, 0.5, 0.5),
        message="Porte coupe-feu ouverte : raccourci vers les rayons"),
    # La bouche d'aération du secret 3 : un « trou béant » avant cette passe
    # (2026-09-24, retour de playtest) — la baie n'était fermée par RIEN, le
    # local et sa lumière orange se voyaient depuis toute la cafétéria.
    # `metal_tole_perforee` (déjà le rideau `door_argent`) donne le grillage
    # sans ouvrir un nouveau matériau de vantail : toujours 7 lots de portes
    # pour tout le niveau, pas 8.
    frozenset({"cafeteria", "secret3"}): dict(
        porte="door_secret_vmc", use="use_grille_vmc", texture="metal_tole_perforee",
        # Près du haut de la grille (z = 3,75, sur la grille 0,25 m) : à au
        # moins 2,85 m de tout point du SOL de la cafétéria (`playerPosition`
        # est le centre de capsule, ~0,9 m au-dessus des pieds — la seule
        # composante VERTICALE dépasse déjà la portée de 2 m, quel que soit
        # l'endroit où l'on se tient), à moins de 1,3 m de qui se tient sur le
        # distributeur voisin (1,9 m de haut).
        use_centre=(36.0, 19.75, 3.75), use_taille=(0.3, 0.08, 0.3),
        message="La grille cède sans un bruit : il y a toujours une bouche "
                "d'aération quelque part."),
}


def _porte_libre(o, spec, props, logic) -> None:
    a, b = o.span
    if spec["porte"] == "door_secret_photomaton":
        # Le pan de mur : l'épaisseur des deux murs voisins, donc affleurant des
        # deux côtés — invisible tant qu'il est fermé. Il s'enfonce dans le sol,
        # comme un passage secret de Wolfenstein.
        z_c = o.z + bo.HAUTEUR_PORTE / 2
        if o.axe == "x":
            centre, taille = (o.at, (a + b) / 2, z_c), (2 * bo.EPAISSEUR_MUR, b - a, bo.HAUTEUR_PORTE)
        else:
            centre, taille = ((a + b) / 2, o.at, z_c), (b - a, 2 * bo.EPAISSEUR_MUR, bo.HAUTEUR_PORTE)
        bo.boite_centree(spec["porte"], centre, taille, "repere",
                         {"repere": H.textured_material(spec["texture"])}, props,
                         extras={"mouvement": "descend"})
    elif spec["porte"] == "door_secret_vmc":
        # Un seul vantail, charnière côté ouest (`bout="min"`) : la baie fait
        # 2 m de large sur 2 m de haut, DÉCOLLÉE du sol (le mur reste plein en
        # dessous, la grille commence à `o.z + 2.0`, comme `ca_bouche_cadre`/
        # `vmc_cadre` construits à la main dans `habiller_cafeteria`/
        # `habiller_vmc`). `sens` reste "auto" — pas de `_sens_vers` forcé :
        # la porte s'ouvre en s'éloignant de qui appuie sur E (`resolveAutoOpenSign`),
        # donc loin du joueur perché sur le distributeur, vers le local.
        e = EP_VANTAIL / 2
        vantail(spec["porte"], _monde(o, a + 0.02, -e, o.z + 2.0, b - 0.02, e, o.z + 4.0),
                spec["texture"], "world", props,
                dict(mouvement="battant", charniere=_charniere(o, "min"), sens="auto"))
    else:
        # La porte coupe-feu : double, rouge, barres anti-panique côté personnel
        # — le côté d'où elle s'ouvre (`plan.PORTES_SENS_UNIQUE`).
        depuis = next(s for s in plan.ALL if s.id == plan.PORTES_SENS_UNIQUE[frozenset({o.a, o.b})][0])
        bornes = depuis.y if o.axe == "y" else depuis.x
        cote_personnel = 1 if (bornes[0] + bornes[1]) / 2 > o.at else -1
        # `manuelle: "fermer"` : on peut la REFERMER à la main, des deux côtés,
        # jamais l'ouvrir. Le sens unique tient toujours à la place du bouton —
        # hors de portée côté rayons — mais la porte n'est plus un interrupteur
        # à sens unique définitif : on peut la claquer derrière soi.
        porte_double(o, (spec["porte"], f"{spec['porte']}_b"), HAUTEUR_VANTAIL[frozenset({o.a, o.b})],
                     spec["texture"], "world", props, {"groupe": "coupe_feu", "manuelle": "fermer"},
                     quincaillerie="barre", face_barre=cote_personnel)
    bo.boite_centree(spec["use"], spec["use_centre"], spec["use_taille"], "repere",
                     {"repere": H.textured_material(spec["texture"])}, logic,
                     extras={"target": spec["porte"], "message": spec["message"]})
    if spec.get("secours"):
        # Bloc de secours vert au-dessus de la porte, côté personnel : le même
        # que côté rayons, pour qu'on lise la porte des deux côtés.
        L.place(L.neon(2.0), ((a + b) / 2 - 1.0, o.at + 0.35, o.z + 2.9), 0, props, props,
                f"{spec['porte']}_secours")
        lampe(logic, f"light_{spec['porte']}_secours", ((a + b) / 2, o.at + 0.7, o.z + 2.7),
              color="#4dff73", intensity=3.0, distance=7.0)


def poser_portes_animees(ouvertures, props, col_coll, logic) -> int:
    """Toutes les portes des façades du plan. Les portes des bureaux, dans des
    cloisons que le plan ne connaît pas, sont posées par `habiller_etage`."""
    poses = 0
    for o in ouvertures:
        cle = _cle_porte(o)
        if cle == frozenset({"parking_ext", "c_pk_ga"}):
            poses += sas_vitre(o, "sas_ext", 1, props, col_coll)
        elif cle == frozenset({"c_pk_ga", "galerie"}):
            poses += sas_vitre(o, "sas_int", -1, props, col_coll)
        elif cle == frozenset({"hub", "c_hb_rs"}):
            # Va-et-vient « PRIVÉ » : elles battent des deux côtés, se referment
            # seules, et laissent passer les Costards.
            porte_double(o, ("door_reserve_vav_g", "door_reserve_vav_d"), HAUTEUR_VANTAIL[cle],
                         "portes_verre", "porte:porte_vav", props,
                         dict(sens="auto", auto=True, portee=1.8, referme=True, delai=0.6,
                              groupe="reserve_vav"))
            poses += 2
        elif cle == frozenset({"c_hb_rs", "reserve"}):
            # Le rideau métallique du quai remonte dans son caisson, au-dessus
            # de l'imposte ; il en reste la lame finale.
            lo, hi = o.span
            vantail("door_argent", _monde(o, lo + 0.02, -0.04, o.z + 0.01, hi - 0.02, 0.04,
                                          o.z + HAUTEUR_VANTAIL[cle]),
                    "metal_tole_perforee", "world", props,
                    {"mouvement": "monte", "course": HAUTEUR_VANTAIL[cle] - 0.05},
                    [_monde(o, lo + 0.02, -0.06, o.z + 0.01, hi - 0.02, 0.06, o.z + 0.10)])
            _use_de_carte(o, "door_argent", "argent", logic)
            poses += 1
        elif cle == frozenset({"c_bu", "c_escalier"}):
            # Elles s'ouvrent vers le couloir : côté escalier, un vantail qui
            # s'ouvre en balayant les premières marches passerait au travers.
            porte_double(o, ("door_or", "door_or_b"), HAUTEUR_VANTAIL[cle], "portes_verre",
                         "porte:porte_vav", props, {"groupe": "or"}, vers=-1)
            _use_de_carte(o, "door_or", "or", logic)
            poses += 2
        elif cle == "sortie":
            # L'issue de secours du bureau du Directeur : acier, barres
            # anti-panique côté bureau.
            porte_double(o, ("door_exit", "door_exit_b"), HAUTEUR_VANTAIL[cle], "metal_bac_acier",
                         "world", props, {"sens": "auto", "groupe": "sortie"},
                         quincaillerie="barre", face_barre=-1)
            _use_de_carte(o, "door_exit", "platine", logic)
            poses += 2
        elif cle == frozenset({"bureaux", "direction"}):
            porte_double(o, ("door_direction_g", "door_direction_d"), HAUTEUR_VANTAIL[cle], "portes",
                         "porte:porte_capitonnee", props,
                         dict(sens="auto", auto=True, portee=2.0, referme=False, groupe="direction"),
                         quincaillerie="bequille", uv_quincaillerie="quincaillerie:porte_capitonnee")
            poses += 2
        elif cle in PORTES_LIBRES:
            _porte_libre(o, PORTES_LIBRES[cle], props, logic)
            poses += 1
        elif cle == frozenset({"cafeteria", "toilettes"}):
            # La porte des WC se manœuvre comme celles des bureaux : à la main
            # (touche E), les Costards la poussent. Une porte de toilettes qui
            # s'écarte toute seule se lirait comme une porte de magasin.
            lo, hi = o.span
            libre = hi - 0.005
            vantail("door_wc", _monde(o, lo + 0.005, -EP_VANTAIL / 2, o.z + 0.01, libre, EP_VANTAIL / 2,
                                      o.z + HAUTEUR_VANTAIL[cle]),
                    "portes_2", "porte:porte_wc", props,
                    dict(mouvement="battant", charniere=_charniere(o, "min"), sens="auto",
                         auto="ennemis", manuelle=True, portee=1.6, referme=False),
                    _bequilles(o, libre, -1), "quincaillerie:porte_wc")
            poses += 1
    return poses


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
# Derrière la bouche d'aération de la cafétéria. De la chaleur, un ronronnement,
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

    # Cadre de la bouche vue du local, et la grille dévissée posée à côté.
    a, b = plan.PASSAGES[frozenset({"cafeteria", "secret3"})][1] - 1.0, \
        plan.PASSAGES[frozenset({"cafeteria", "secret3"})][1] + 1.0
    H.boxes("vmc_cadre", [((a - 0.08, y0 + t, z, a, y0 + t + 0.06, z + 2.0), "world"),
                          ((b, y0 + t, z, b + 0.08, y0 + t + 0.06, z + 2.0), "world")],
            "metal_bac_acier", props)
    H.box("vmc_grille", (39.0, 20.4, z, 40.4, 20.5, z + 0.9), "metal_bac_acier", props)

    # Une chaleur orangée : c'est elle qu'on aperçoit depuis la cafétéria.
    lampe(logic, "light_vmc_couvee", (39.2, 22.2, z + 1.2), color="#ff8a3a", intensity=4.0, distance=6.0)
    return {"oeufs": oeufs, "lampes": 1}


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
    L.place(R.extincteur(), (24.42, nord, z + 1.0), 180, props, props, "cbu_ext")
    meubles = semer(props, col_coll, "cbu_k", (
        ("pottedPlant", 1.6, nord - 0.45, z, 0),
        ("pottedPlant", 8.9, nord - 0.45, z, 0),
    ))
    lampes = eclairage_couloir(space, props, logic)
    return {"meubles": 7 + meubles, "lampes": lampes}


# --- Mobilier physique (`prop_*`) --------------------------------------------
#
# Le seul décor du niveau qui BOUGE. Posé ici, pour TOUS les espaces d'un coup,
# et pas au fil des habillages : le premier jet en avait mis six, tous dans
# deux espaces à l'écart, et le retour de playtest a été « je n'ai pas trouvé
# de physique ». C'était exact — on pouvait traverser le niveau d'un bout à
# l'autre sans en croiser un seul, le hub (48 m qu'on est OBLIGÉ de parcourir)
# n'en portait aucun.
#
# La règle qui en sort : **un prop doit se trouver sur le chemin, pas dans une
# pièce qu'on peut sauter.** Le parking (le plan lui donne le rôle de
# « tutoriel implicite ») et le hub en portent donc le plus.
#
# BUDGET : un prop visible = un lot de dessin, mesuré. Ce qui compte n'est pas
# le total mais le nombre VU D'UN MÊME POINT — d'où l'étalement sur les dix
# espaces plutôt qu'un tas. Vérifier au panneau de debug après chaque ajout.
# see: docs/decisions/0030-props-dynamiques.md

# taille (dx, dy, dz) · texture · masse (kg) · pv (None = indestructible) · matière
MODELES_PROPS = {
    "carton":       ((0.60, 0.60, 0.50), "carton",           8,   18, "carton"),
    "carton_grand": ((0.90, 0.90, 0.70), "carton",          14,   26, "carton"),
    "caisse":       ((0.80, 0.80, 0.80), "bois_palette",    30,   45, "bois"),
    # Indestructible : il se pousse, il ne se casse pas. Un niveau où TOUT
    # explose n'apprend rien au joueur sur ce qui explose.
    "casier":       ((0.70, 0.50, 0.90), "metal_bac_acier", 55, None, "metal"),
}

# (x, y, modèle) ou (x, y, modèle, étages). Une PILE est ce qui se lit le mieux
# de loin : trois cartons empilés qui s'écroulent quand on les bouscule disent
# « physique » bien plus fort qu'une boîte isolée au sol.
PROPS_PHYSIQUES: dict[str, tuple] = {
    # Le premier espace du jeu. La pile est droit sur le chemin du spawn
    # (0, −36) vers les portes (0, −4) : on la bouscule sans la chercher.
    "parking_ext": ((-1.5, -31.0, "carton", 3), (2.5, -25.0, "carton"),
                    (-2.0, -17.0, "caisse"), (3.0, -10.0, "carton_grand")),
    "galerie": ((-12.0, 6.0, "carton", 2), (13.5, 5.0, "caisse"),
                (7.0, 12.5, "carton_grand")),
    "cafeteria": ((36.5, 16.5, "carton", 2), (52.0, 4.0, "casier")),
    # Devant la ligne de caisses, là où se joue le premier vrai combat.
    "caisses": ((-16.0, 26.0, "carton"), (6.0, 25.0, "carton_grand", 2),
                (18.0, 38.5, "caisse"), (-9.0, 40.0, "carton")),
    # 48 m de couloir : le plus gros lot du niveau, réparti sur toute la
    # longueur et TOUJOURS à x = ±3,5 — le milieu du hub reste franc.
    # Les y sont choisis dans les TROUS de la décoration déjà posée par
    # `habiller_hub` (piliers, bacs, palettes, caddies, plantes) : c'est
    # `audit_niveau.py` qui a tranché, pas l'œil.
    "hub": ((3.5, 53.0, "caisse"), (-3.6, 59.0, "carton", 2),
            (3.6, 67.0, "carton_grand"), (3.4, 73.5, "casier"),
            (-3.4, 81.0, "carton", 3), (-3.6, 90.0, "caisse")),
    # Au centre des allées (cf. RY_NEON_ALLEES), à des y distincts pour qu'on
    # n'en voie jamais deux dans la même enfilade.
    "rayons": ((-43.75, 55.0, "carton"), (-36.25, 67.0, "carton", 2),
               (-21.25, 78.0, "carton"), (-28.75, 61.0, "carton_grand")),
    # Un rayon électroménager est fait de cartons d'électroménager.
    "electro": ((17.5, 58.0, "carton_grand", 2), (27.5, 62.0, "caisse"),
                (39.0, 71.0, "carton"), (22.5, 71.0, "carton_grand")),
    "reserve": ((-5.0, 102.0, "caisse"), (-5.0, 112.0, "caisse", 2),
                (-19.0, 110.0, "caisse"), (12.0, 104.0, "carton_grand"),
                (14.0, 118.0, "carton", 2)),
    "souterrain": ((30.5, 102.0, "casier"), (46.0, 110.0, "caisse"),
                   (58.0, 96.5, "carton")),
    "bureaux": ((-17.0, 152.0, "carton", 2), (6.5, 157.0, "carton_grand"),
                (-6.0, 163.0, "caisse")),
    # Des cartons d'archives sur le chemin de la porte Or : le couloir est
    # obligatoire, c'est ce qui les rend visibles.
    "c_bu": ((25.0, 134.0, "carton", 3), (34.0, 138.3, "carton_grand")),
}

# Emplacements que le mobilier posé AU HASARD doit éviter (les caddies des
# rayons). Dérivé de la table : une seule source, jamais deux listes à tenir
# d'accord.
RY_CARTONS = tuple((entry[0], entry[1]) for entry in PROPS_PHYSIQUES["rayons"])


def poser_props_physiques(space, coll) -> int:
    """Pose les `prop_*` d'un espace. Rendu SEUL, sans `col_box` jumeau : un
    prop construit son propre collider dynamique au chargement."""
    poses = 0
    for i, entry in enumerate(PROPS_PHYSIQUES.get(space.id, ())):
        x, y, modele = entry[0], entry[1], entry[2]
        etages = entry[3] if len(entry) > 3 else 1
        (dx, dy, dz), texture, masse, pv, matiere = MODELES_PROPS[modele]
        for etage in range(etages):
            z0 = space.z + etage * dz
            H.prop(f"{space.id}{i}_{etage}",
                   (x - dx / 2, y - dy / 2, z0, x + dx / 2, y + dy / 2, z0 + dz),
                   texture, coll, masse=masse, pv=pv, matiere=matiere)
            poses += 1
    return poses


# Repères que l'habillage pose lui-même, en vrai objet : le blockout ne doit donc
# plus poser leur silhouette grise. `use_toilet` en faisait partie jusqu'au
# 2026-09-24 (le cube flottant devenait la plaque de chasse d'eau de
# `habiller_toilettes`) ; le repère « toilettes » est désormais du genre
# "rien" dans `REGLES_REPERES` (plus aucun `use_*` à sauter), donc plus rien à
# lister ici pour lui.
SIGNATURES_HABILLEES = frozenset({"sig_machine_a_pinces", "sig_photomaton"})


HABILLAGE = {
    "rayons": habiller_rayons,
    "caisses": habiller_caisses,
    "galerie": habiller_galerie,
    "hub": habiller_hub,
    "electro": habiller_electro,
    "reserve": habiller_reserve,
    "souterrain": habiller_souterrain,
    "parking_ext": habiller_parking,
    "cafeteria": habiller_cafeteria,
    "bureaux": habiller_etage,
    "direction": habiller_direction,
    "c_escalier": habiller_escalier,
    "c_bu": habiller_couloir_direction,
    "secret1": habiller_labo,
    "secret3": habiller_vmc,
    "toilettes": habiller_toilettes,
}


# --- Recalage des spawns --------------------------------------------------------
#
# Les spawns viennent du plan de masse, dessiné AVANT l'habillage ; l'habillage
# pose ses meubles sans les regarder. Résultat au playtest du 2026-09-18 : « des
# Costards qui pop dans des props » — onze sur quarante-deux, dans un kiosque,
# une gondole, un distributeur, un rack, une caisse physique, et quatre DANS la
# plateforme de quai de la réserve (le plan les pose à z = 0, le quai est à 3 m).
#
# Chaque spawn est donc recalé après l'habillage, contre ce qui existe vraiment :
# posé sur le sol réellement sous lui (quai, rampe, sol de l'espace), puis, si sa
# capsule rencontre encore un collider ou un prop, déplacé à la case libre la
# plus proche de la grille de 0,25 m, sur le même niveau. Chaque déplacement est
# écrit dans le journal de construction : un spawn qui bouge de 3 m est une
# information de level design, pas un détail.

SPAWN_MARGE = 0.15          # jeu autour de la capsule
SPAWN_HAUTEUR = 1.9         # hauteur de capsule, arrondie au-dessus
SPAWN_MARCHE = 0.35         # `autostepMaxHeight` des ennemis (suitConfig.ts)
SPAWN_RECHERCHE = 4.0       # au-delà, c'est le plan qu'il faut corriger


def _solides() -> list:
    """(objet, min, max) de tout ce qui arrête un corps : colliders statiques et
    props. `view_layer` et non `scene` : la bibliothèque `_LIB`, exclue de la
    vue, n'en fait pas partie."""
    out = []
    for o in bpy.context.view_layer.objects:
        if o.type != "MESH" or not o.name.startswith(("col_", "prop_")):
            continue
        pts = [o.matrix_world @ Vector(v) for v in o.bound_box]
        mini = [min(p[i] for p in pts) for i in range(3)]
        maxi = [max(p[i] for p in pts) for i in range(3)]
        out.append((o, mini, maxi))
    return out


def _est_un_sol(o, mini, maxi) -> bool:
    """Un sol, une rampe, un quai : ce sur quoi l'on se tient, pas un obstacle."""
    return ("sol" in o.name or o.name.startswith("col_hull")
            or (maxi[0] - mini[0]) * (maxi[1] - mini[1]) >= 20.0)


def _sol_sous(solides, space, x: float, y: float) -> float:
    """Altitude de la surface praticable sous (x, y), sous le plafond de l'espace."""
    ref = bo._z_du_sol(space, x, y)
    meilleur = ref
    for o, mini, maxi in solides:
        if not (mini[0] < x < maxi[0] and mini[1] < y < maxi[1]):
            continue
        if not _est_un_sol(o, mini, maxi) or not (ref - 0.5 <= maxi[2] <= ref + space.hauteur - 0.5):
            continue
        dessus = maxi[2]
        if o.name.startswith("col_hull"):
            inv = o.matrix_world.inverted()
            ok, loc, _n, _i = o.ray_cast(inv @ Vector((x, y, maxi[2] + 1.0)),
                                         (inv.to_3x3() @ Vector((0, 0, -1))).normalized())
            if not ok:
                continue
            dessus = (o.matrix_world @ loc).z
        meilleur = max(meilleur, dessus)
    return meilleur


def _gene(solides, x: float, y: float, sol: float, r: float):
    """Premier solide qui gêne une capsule posée en (x, y, sol), ou None."""
    for o, mini, maxi in solides:
        if maxi[2] <= sol + SPAWN_MARCHE or mini[2] >= sol + SPAWN_HAUTEUR:
            continue
        if mini[0] - r < x < maxi[0] + r and mini[1] - r < y < maxi[1] + r:
            return o
    return None


def recaler_spawns() -> list[str]:
    solides = _solides()
    espaces = {}
    for space in plan.SPACES:
        for nom, *_ in space.spawns:
            espaces["spawn_director_" + nom if nom.startswith("director") else "spawn_" + nom] = space
    journal = []
    pas = plan.GRID
    for nom, space in espaces.items():
        spawn = bpy.data.objects.get(nom)
        if spawn is None:
            continue
        r = (0.45 if "director" in nom else 0.4) + SPAWN_MARGE
        x, y = spawn.location.x, spawn.location.y
        sol0 = _sol_sous(solides, space, x, y)
        gene = _gene(solides, x, y, sol0, r)
        if gene is None:
            if abs(sol0 - spawn.location.z) > 1e-3:
                journal.append(f"{nom} posé à z = {sol0:.2f} (au lieu de {spawn.location.z:.2f})")
            spawn.location.z = sol0
            continue
        marge = bo.EPAISSEUR_MUR + r
        n = int(SPAWN_RECHERCHE / pas)
        candidats = sorted(((i * pas, j * pas) for i in range(-n, n + 1) for j in range(-n, n + 1)),
                           key=lambda d: d[0] ** 2 + d[1] ** 2)
        trouve = None
        for dx, dy in candidats:
            if dx * dx + dy * dy > SPAWN_RECHERCHE ** 2:
                break
            cx, cy = x + dx, y + dy
            if not (space.x[0] + marge < cx < space.x[1] - marge and space.y[0] + marge < cy < space.y[1] - marge):
                continue
            sol = _sol_sous(solides, space, cx, cy)
            if abs(sol - sol0) > SPAWN_MARCHE or _gene(solides, cx, cy, sol, r) is not None:
                continue
            trouve = (cx, cy, sol)
            break
        if trouve is None:
            journal.append(f"{nom} ENCOMBRÉ ({gene.name}) et aucune place libre à moins de "
                           f"{SPAWN_RECHERCHE:g} m — à corriger dans le plan de masse")
            continue
        cx, cy, sol = trouve
        journal.append(f"{nom} déplacé de {math.hypot(cx - x, cy - y):.2f} m "
                       f"(sa capsule rencontrait {gene.name})")
        spawn.location = (cx, cy, sol)
    return journal


# --- Assemblage --------------------------------------------------------------


def main() -> None:
    args = bo.get_args()
    out = os.path.abspath(bpy.path.abspath(
        bo.arg_value(args, "--out", "assets_src/blender/niveau_v2.blend")))

    geo_utils.wipe_scene()
    geo_utils.configure_scene()
    L.build_all()
    F.build_all()
    E.build_all()
    R.build_all()
    B.build_all()

    root = bpy.context.scene.collection
    geo = geo_utils.make_collection("GEO", root)
    shell = geo_utils.make_collection("SHELL", geo)
    props = geo_utils.make_collection("PROPS", geo)
    geo_utils.make_collection("DETAIL", geo)
    col_coll = geo_utils.make_collection("COL", root)
    logic_coll = geo_utils.make_collection("LOGIC", root)

    gris = bo.creer_materiaux()
    cache: dict = {}
    ouvertures = bo.ouvertures_effectives()

    sols = murs = plafonds = vols = lampes = physiques = 0
    habilles = []
    for space in plan.ALL:
        materiaux = materiaux_espace(space, gris, cache)
        habillage = HABILLAGE.get(space.id)

        if space.rampe:
            sens, z0, z1 = space.rampe
            bo.pente(f"sol_{space.id}", space.x, space.y, z0, z1, sens, materiaux, shell, col_coll)
        elif space.id in SOL_COMMUN:
            sol_commun(space, materiaux, shell, col_coll)
        elif space.id not in SOL_SUR_MESURE and space.id not in SOL_INVITE:
            bo.boite(f"sol_{space.id}",
                     (space.x[0], space.y[0], space.z - bo.EPAISSEUR_SOL),
                     (space.largeur, space.profondeur, bo.EPAISSEUR_SOL),
                     "sol", materiaux, shell, col_coll)
        sols += 1
        murs += bo.murs_espace(space, ouvertures, materiaux, shell, col_coll)
        if plafond(space, shell):
            plafonds += 1

        if habillage is None and space.couloir:
            lampes += eclairage_couloir(space, props, logic_coll)
        elif habillage is None:
            vols += bo.volumes(space, materiaux, props, col_coll)
            lampes += eclairage_par_defaut(space, logic_coll)
        else:
            compte = habillage(space, materiaux, props, col_coll, logic_coll)
            lampes += compte["lampes"]
            if space.id in PLAFOND_SUR_MESURE:
                plafonds += 1
            habilles.append((space.id, compte))

        # Après l'habillage : le mobilier physique se pose par-dessus le décor
        # de l'espace, jamais à sa place.
        physiques += poser_props_physiques(space, props)

    portes = poser_portes_animees(ouvertures, props, col_coll, logic_coll) + len(ET_PORTES)
    linteaux = poser_linteaux(ouvertures, gris, cache, shell)
    # Palier derrière la porte de sortie : sans lui, franchir la sortie est une
    # chute d'un pas fixe avant l'écran de fin (trouvé par `audit_niveau.py`).
    bo.poser_palier_sortie(materiaux_espace(plan.SPACES[-1], gris, cache), shell, col_coll)
    reperes = bo.poser_reperes(gris, props, col_coll, logic_coll, sauter=SIGNATURES_HABILLEES)
    costards, directeurs = bo.poser_spawns(logic_coll)
    recales = recaler_spawns()

    # La bibliothèque est un dépôt de patrons, jamais du décor : exclue de la
    # vue, elle ne part pas à l'export (même discipline qu'à la salle d'essai).
    lib_layer = bpy.context.view_layer.layer_collection.children.get(L.LIB_NAME)
    if lib_layer:
        lib_layer.exclude = True

    bpy.ops.wm.save_as_mainfile(filepath=out)

    print("\n[niveau] " + "-" * 54)
    print(f"[niveau] {sols} sols, {murs} morceaux de mur, {plafonds} plafonds, {vols} volumes gris")
    print(f"[niveau] {linteaux} linteaux et impostes (rendus seulement, sans collider)")
    for espace, compte in habilles:
        detail = ", ".join(f"{v} {k}" for k, v in compte.items())
        print(f"[niveau] HABILLÉ {espace} : {detail}")
    restants = [s.id for s in plan.ALL if s.id not in HABILLAGE and not s.couloir]
    print(f"[niveau] encore en gris : {', '.join(restants)}")
    print(f"[niveau] {lampes} light_* (le pool n'en allume que 48, voir ADR 0026)")
    print(f"[niveau] {physiques} prop_* physiques (autant de lots de dessin qu'il y en a de VISIBLES)")
    print(f"[niveau] {portes} portes, {reperes['use']} use_*, {reperes['secret']} secrets, "
          f"{reperes['signature']} emplacements signature")
    print(f"[niveau] {costards} spawn_suit_*, {directeurs} spawn_director_*, {reperes['spawn']} spawn_player")
    for ligne in recales:
        print(f"[niveau] spawn recalé : {ligne}")
    print(f"[niveau] écrit : {out}")


if __name__ == "__main__":
    main()
