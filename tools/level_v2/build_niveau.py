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

import bpy

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
sys.path.insert(0, os.path.join(os.path.dirname(ICI), "blender"))

import geo_utils                      # noqa: E402
import lib_helpers as H               # noqa: E402
import lib_electro as E               # noqa: E402
import lib_facade as F                # noqa: E402
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
    "reserve": ("sol_beton", "mur_platre_use", "plafond_dalles"),
    "souterrain": ("sol_beton_brut", "mur_platre_use", "plafond_dalles"),
    "bureaux": ("sol_moquette", "mur_platre", "plafond_dalles"),
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
PLAFOND_SUR_MESURE = frozenset({"galerie"})

# Idem pour le SOL, quand l'habillage le découpe en bandes de textures
# différentes. Le défaut est volontairement l'inverse — `main()` pose un sol
# uni à tout espace qui n'est pas listé ici, habillé ou non. Un habillage qui
# oublie son sol donne ainsi une pièce banale, jamais un trou dans lequel le
# joueur tombe.
SOL_SUR_MESURE = frozenset({"rayons", "caisses", "galerie", "hub"})


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
    # Un espace en rampe monte : son plafond suit le point HAUT, sinon il
    # couperait la montée. Même calcul que la hauteur de mur de `murs_espace`.
    z = space.z if not space.rampe else max(space.rampe[1], space.rampe[2])
    H.box(f"plafond_{space.id}", (x0, y0, z + space.hauteur, x1, y1, z + space.hauteur + EPAISSEUR_PLAFOND),
          texture, coll, subdiv=SUBDIV_BAKE)
    return True


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
RY_NEONS_MORTS = frozenset({(-50.0, 74.0), (-13.5, 50.0), (-28.75, 74.0), (-36.25, 50.0)})


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


def _rangees(props, col_coll) -> int:
    """Cinq rangées de trois tronçons : tête de gondole, corps, tête.

    `place(..., 90)` envoie le -y local sur le +x monde : la face « avant »
    d'une gondole posée en rangée regarde donc l'est.
    """
    n = 0
    for ri, gx in enumerate(RY_RANGEES):
        droite = gx + L.GOND_DEPTH          # bord EST de la rangée
        theme_est, theme_ouest = RY_THEMES[ri]
        for si, (ya, _yb) in enumerate(RY_TRONCONS):
            tag = f"ry{ri}s{si}"
            seed = SEED + ri * 10 + si
            L.place(L.tete_garnie(seed), (gx, ya, 0), 0, props, col_coll, f"{tag}_sud")
            L.place(L.gondole_garnie(seed + 100, RY_CORPS, theme_est, theme_ouest),
                    (droite, ya + RY_TETE, 0), 90, props, col_coll, tag)
            L.place(L.tete_garnie(seed + 200), (droite, ya + 8.0, 0), 180,
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


def _props_rayons(space, props, col_coll) -> int:
    x0, x1 = space.x
    y0, y1 = space.y
    rng = random.Random(SEED)
    n = 0

    # Piliers dans les deux dégagements latéraux, jamais dans une allée.
    for i, (x, y) in enumerate(((x0 + 1.5, 52.0), (x0 + 1.5, 78.0),
                                (x1 - 2.5, 54.0), (x1 - 2.5, 76.0))):
        L.place(L.pilier(), (x, y, 0), 0, props, col_coll, f"ry_p{i}")
        n += 1

    # Bacs promo et présentoirs dans les allées TRANSVERSALES : elles sont
    # larges (4 m), et c'est là que le joueur ralentit.
    for i, (x, y) in enumerate(((-43.75, 59.0), (-28.75, 59.0), (-36.25, 71.0), (-21.25, 71.0))):
        L.place(L.bac_garni(SEED + 500 + i), (x, y, 0), 0, props, col_coll, f"ry_b{i}")
        n += 1
    for i, (x, y) in enumerate(((-50.5, 70.5), (-14.5, 59.5))):
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


def _cle(prefixe: str, x: float, y: float, suffixe: str = "") -> str:
    """Nom stable et lisible pour une rampe ou une lampe, à partir de ses cotes.
    Les coordonnées négatives deviennent `m` — un `-` dans un nom d'objet
    Blender traverse l'export mais rend les noms pénibles à lire en console."""
    return f"{prefixe}_{x:g}_{y:g}{suffixe}".replace(".", "_").replace("-", "m")


def _neons(space, props, logic, xs, ys, morts, prefixe: str,
           doubles=()) -> tuple[int, int]:
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
    """
    ht = space.z + space.hauteur
    rampes = lampes = 0
    for x in xs:
        for y in ys:
            mort = (x, y) in morts
            L.place(L.neon(4.0, eteint=mort), (x, y, ht - 0.18), 90,
                    props, props, _cle(f"{prefixe}_n", x, y))
            rampes += 1
            if mort:
                continue
            for k, dy in enumerate((1.0, 3.0) if x in doubles else (2.0,)):
                lampe(logic, "light_" + _cle(prefixe, x, y, f"_{k}"),
                      (x - 0.17, y + dy, ht - 0.65),
                      color="#dceeff", intensity=6.0, distance=11.0)
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
    L.place(L.neon(2.0), (-32.0, space.y[1] - 0.6, ht - 1.4), 0, props, props, "ry_secours")
    lampe(logic, "light_ry_secours", (-31.0, space.y[1] - 0.9, ht - 1.6),
          color="#4dff73", intensity=3.0, distance=7.0)
    return rampes, lampes + 1


def habiller_rayons(space, gris, props, col_coll, logic) -> dict:
    n_sol = _sol_rayons(space, props, col_coll)
    gondoles = _rangees(props, col_coll)
    frais = _frais_mur_ouest(space, props, col_coll)
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

    void = n_sol
    return {"gondoles": gondoles, "frigos": frais, "props": props_n + 1,
            "signes": signes, "rampes": rampes, "lampes": lampes}


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
    for i, (px, py, rot) in enumerate(((x0 + 0.5, CS_CAISSES_Y, 0), (x1 - 1.75, CS_CAISSES_Y, 0))):
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
        L.place(L.tete_garnie(SEED + 760 + i), (ix, 27.0, z), 0, props, col_coll, f"cs_il{i}a")
        L.place(L.tete_garnie(SEED + 770 + i), (ix + 1.25, 28.25, z), 180, props, col_coll, f"cs_il{i}b")
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

    # Verrières et leur lumière. Blanc chaud et portée longue : c'est du jour,
    # pas un tube fluorescent, et c'est le seul endroit du niveau où la lumière
    # tombe de haut.
    for i, vx in enumerate(GA_VERRIERE_X):
        L.place(F.verriere(GA_VERRIERE_COTE), (vx, GA_VERRIERE_Y, z + space.hauteur),
                0, props, props, f"ga_vr{i}")
        lampe(logic, f"light_ga_jour_{i}",
              (vx + GA_VERRIERE_COTE / 2, GA_VERRIERE_Y + GA_VERRIERE_COTE / 2, z + space.hauteur - 1.0),
              color="#fff2d8", intensity=14.0, distance=20.0)

    # Les deux machines « signature » du plan d'origine, en vrai et non plus en
    # silhouette : leurs positions viennent des repères du plan de masse, pas
    # d'ici (voir `SIGNATURES_HABILLEES`).
    signatures = 0
    for label, rx, ry, _nature in space.reperes:
        if "machine à pinces" in label:
            L.place(F.machine_pinces(), (rx - 0.5, ry - 0.5, z), 15, props, col_coll, "ga_pinces")
            signatures += 1
        elif "photomaton" in label:
            L.place(F.photomaton(), (rx - 0.6, ry - 0.7, z), 0, props, col_coll, "ga_photo")
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
    for i, (bx, rot) in enumerate(((-18.0, 0), (-16.0, 180), (8.0, 0), (10.0, 180))):
        L.place(F.banc(), (bx, 13.0 if rot == 0 else 13.5, z), rot, props, col_coll, f"ga_bc{i}")
        bancs += 1
    for i, (px, py) in enumerate(((-19.5, 13.2), (11.5, 13.2), (x1 - 1.3, 2.0))):
        L.place(L.poubelle(), (px, py, z), 0, props, col_coll, f"ga_pou{i}")

    # Panneau d'accueil face à l'arrivée du parking, et panneaux directionnels.
    L.place(F.enseigne_murale("bienvenue"), (-1.5, y0 + 0.35, z + 3.0), 0, props, props, "ga_bienvenue")
    for i, px in enumerate((-15.0, 13.0)):
        L.place(L.panneau_allee(), (px, 9.2, z + 3.4), 0, props, col_coll, f"ga_pan{i}")

    rampes, lampes = _neons(space, props, logic, GA_NEON_X, GA_NEON_Y, GA_NEONS_MORTS,
                            "ga", doubles=GA_NEON_X)
    return {"kiosques": len(GA_KIOSQUES), "devantures": devantures,
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

    rampes, lampes = _neons(space, props, logic, HB_NEON_X, HB_NEON_Y,
                            HB_NEONS_MORTS, "hb", doubles=HB_NEON_X)
    return {"panneaux": panneaux, "rampes": rampes, "lampes": lampes}


# --- Habillage : l'électroménager --------------------------------------------
#
# Le rayon « elevee » du plan, celui du mur d'écrans et de la carte Or. Cotes
# des volumes gris du blockout, à l'unité près : mur d'écrans de 14 × 1 × 3,
# quatre cabines de 5 × 5 × 2,5, et le carton qui donne accès à la carte.

EL_CABINES = ((16.0, 58.0), (32.0, 58.0), (16.0, 70.0), (32.0, 70.0))
EL_MUR_ECRANS = (14.0, 49.0)
EL_CARTON_OR = (40.0, 74.0)
# Rangées d'exposition. Leur façade regarde le -y local, donc une rangée posée
# à `rot 0` présente sa marchandise à qui se tient au SUD d'elle. Toutes sont
# donc calées sur les deux dégagements est-ouest que laissent les cabines
# (y ∈ [63, 70] et y ∈ [75, 80]) : le joueur arrive par l'ouest et les longe.
EL_RANGEES = ((21.0, 66.5), (26.5, 66.5), (38.0, 66.5),
              (21.0, 77.0), (28.0, 77.0), (40.0, 77.0))
EL_ETAGERES = ((11.0, 54.0), (11.0, 58.0), (43.5, 52.0))
EL_NEON_X = (12.5, 22.0, 30.0, 38.0, 44.0)
EL_NEON_Y = (49.0, 56.0, 64.0, 72.0)
EL_NEONS_MORTS = frozenset({(44.0, 72.0), (12.5, 64.0), (30.0, 49.0)})


def habiller_electro(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z

    # `rot 180` : les dalles du mur d'écrans regardent le -y local, donc posé
    # tel quel contre le mur sud il diffuserait vers le mur. Retourné, il occupe
    # la même emprise (d'où l'origine au coin opposé) et regarde la salle.
    L.place(E.mur_ecrans(14.0), (EL_MUR_ECRANS[0] + 14.0, EL_MUR_ECRANS[1] + 1.0, z), 180,
            props, col_coll, "el_mur")

    for i, (cx, cy) in enumerate(EL_CABINES):
        L.place(E.cabine_demo(i), (cx, cy, z), 0, props, col_coll, f"el_cab{i}")

    rangees = 0
    for i, (rx, ry) in enumerate(EL_RANGEES):
        L.place(E.rangee_blanc(4.0, 1 + i % 2), (rx, ry, z), 0,
                props, col_coll, f"el_rg{i}")
        rangees += 1

    # Petit électroménager : sur des étagères, pas posé au sol. C'est la seule
    # marchandise du rayon qu'on voit de près, donc celle qui porte le détail.
    petits = 0
    for i, (px, py) in enumerate(EL_ETAGERES):
        L.place(E.etagere_petits(i), (px, py, z), 0, props, col_coll, f"el_et{i}")
        petits += 1

    # Carton d'accès à la carte Or, repris À L'IDENTIQUE du blockout : 1 m, donc
    # franchissable d'un saut (1,10 m). Changer cette hauteur casserait un accès
    # déjà validé en jouant.
    cx, cy = EL_CARTON_OR
    H.box("carton_acces_or", (cx, cy, z, cx + 1.0, cy + 1.0, z + 1.0), "carton", props)
    H.col_box("carton_acces_or", (cx, cy, z, cx + 1.0, cy + 1.0, z + 1.0), col_coll)

    for i, (px, py, rot) in enumerate(((x0 + 1.2, y1 - 2.0, 0), (x1 - 2.4, y0 + 1.5, 25))):
        L.place(L.palette_cartons(), (px, py, z), rot, props, col_coll, f"el_pal{i}")
    for i, (px, py) in enumerate(((x0 + 0.8, y0 + 0.8), (x1 - 1.3, y1 - 1.3))):
        L.place(L.poubelle(), (px, py, z), 0, props, col_coll, f"el_pou{i}")

    rampes, lampes = _neons(space, props, logic, EL_NEON_X, EL_NEON_Y,
                            EL_NEONS_MORTS, "el", doubles=EL_NEON_X)
    return {"cabines": len(EL_CABINES), "rangees": rangees, "petits": petits,
            "rampes": rampes, "lampes": lampes}


# Repères « signature » que l'habillage pose lui-même, en vrai objet : le
# blockout ne doit donc plus poser leur silhouette grise.
SIGNATURES_HABILLEES = frozenset({"sig_machine_a_pinces", "sig_photomaton"})


HABILLAGE = {
    "rayons": habiller_rayons,
    "caisses": habiller_caisses,
    "galerie": habiller_galerie,
    "hub": habiller_hub,
    "electro": habiller_electro,
}


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

    sols = murs = plafonds = vols = lampes = 0
    habilles = []
    for space in plan.ALL:
        materiaux = materiaux_espace(space, gris, cache)
        habillage = HABILLAGE.get(space.id)

        if space.rampe:
            sens, z0, z1 = space.rampe
            bo.pente(f"sol_{space.id}", space.x, space.y, z0, z1, sens, materiaux, shell, col_coll)
        elif space.id not in SOL_SUR_MESURE:
            bo.boite(f"sol_{space.id}",
                     (space.x[0], space.y[0], space.z - bo.EPAISSEUR_SOL),
                     (space.largeur, space.profondeur, bo.EPAISSEUR_SOL),
                     "sol", materiaux, shell, col_coll)
        sols += 1
        murs += bo.murs_espace(space, ouvertures, materiaux, shell, col_coll)
        if plafond(space, shell):
            plafonds += 1

        if habillage is None:
            vols += bo.volumes(space, materiaux, props, col_coll)
            lampes += eclairage_par_defaut(space, logic_coll)
        else:
            compte = habillage(space, materiaux, props, col_coll, logic_coll)
            lampes += compte["lampes"]
            if space.id in PLAFOND_SUR_MESURE:
                plafonds += 1
            habilles.append((space.id, compte))

    portes = bo.poser_portes(ouvertures, materiaux_espace(plan.ALL[0], gris, cache), shell, logic_coll)
    reperes = bo.poser_reperes(gris, props, col_coll, logic_coll, sauter=SIGNATURES_HABILLEES)
    costards, directeurs = bo.poser_spawns(logic_coll)

    # La bibliothèque est un dépôt de patrons, jamais du décor : exclue de la
    # vue, elle ne part pas à l'export (même discipline qu'à la salle d'essai).
    lib_layer = bpy.context.view_layer.layer_collection.children.get(L.LIB_NAME)
    if lib_layer:
        lib_layer.exclude = True

    bpy.ops.wm.save_as_mainfile(filepath=out)

    print("\n[niveau] " + "-" * 54)
    print(f"[niveau] {sols} sols, {murs} morceaux de mur, {plafonds} plafonds, {vols} volumes gris")
    for espace, compte in habilles:
        detail = ", ".join(f"{v} {k}" for k, v in compte.items())
        print(f"[niveau] HABILLÉ {espace} : {detail}")
    restants = [s.id for s in plan.ALL if s.id not in HABILLAGE and not s.couloir]
    print(f"[niveau] encore en gris : {', '.join(restants)}")
    print(f"[niveau] {lampes} light_* (le pool n'en allume que 48, voir ADR 0026)")
    print(f"[niveau] {portes} portes, {reperes['use']} use_*, {reperes['secret']} secrets, "
          f"{reperes['signature']} emplacements signature")
    print(f"[niveau] {costards} spawn_suit_*, {directeurs} spawn_director_*, {reperes['spawn']} spawn_player")
    print(f"[niveau] écrit : {out}")


if __name__ == "__main__":
    main()
