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
           portee: float = 11.0) -> tuple[int, int]:
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

    semer(props, col_coll, "cs_k", (
        ("pottedPlant", -25.0, 22.0, z, 0), ("pottedPlant", 24.5, 22.0, z, 0),
        ("pottedPlant", -25.0, 42.5, z, 0), ("pottedPlant", 24.5, 42.5, z, 0),
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

    # Téléviseurs et hi-fi en exposition : le rayon s'appelle « électroménager
    # et TV », et il n'avait jusqu'ici pas un seul téléviseur hors du mur.
    meubles = semer(props, col_coll, "el_k", (
        ("televisionVintage", 12.0, 56.0, z + 0.16, 270),
        ("televisionVintage", 12.0, 58.0, z + 0.16, 270),
        ("televisionModern", 12.0, 60.0, z + 0.16, 270),
        ("televisionModern", 44.0, 54.0, z + 0.16, 90),
        ("televisionVintage", 44.0, 56.5, z + 0.16, 90),
        ("speaker", 43.5, 66.0, z, 90), ("speaker", 43.5, 68.0, z, 90),
        ("radio", 21.5, 66.9, z + 0.90, 200), ("laptop", 27.0, 62.9, z + 0.90, 160),
        ("pottedPlant", 11.0, 78.5, z, 0), ("pottedPlant", 44.5, 78.5, z, 0),
        ("trashcan", 11.0, 49.5, z, 0),
    ))
    rampes, lampes = _neons(space, props, logic, EL_NEON_X, EL_NEON_Y,
                            EL_NEONS_MORTS, "el", doubles=EL_NEON_X)
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
RS_RACKS = ((-16.0, 100.0, 14.0), (-16.0, 118.0, 10.0),
            (4.0, 100.0, 14.0), (4.0, 118.0, 10.0))
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

    # Réassort au sol : palettes filmées, fûts, transpalettes.
    for i, (ax, ay, rot) in enumerate(((-21.5, 102.0, 0), (-21.5, 104.0, 12),
                                       (17.0, 112.0, 0), (-2.0, 100.5, 25),
                                       (-2.0, 128.0, 0), (16.5, 126.0, 8))):
        L.place(L.palette_cartons(), (ax, ay, z), rot, props, col_coll, f"rs_pal{i}")
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

SO_PILIERS_X = (34.0, 42.0, 50.0, 58.0, 66.0, 74.0)
SO_PILIERS_Y = (98.0, 106.0, 114.0, 122.0)
SO_VOITURES = ((38.0, 116.0), (50.0, 116.0), (62.0, 116.0), (74.0, 116.0))
SO_NEON_X = (30.0, 46.0, 62.0)
SO_NEON_Y = (96.0, 106.0, 116.0)
# La MOITIÉ des tubes est morte. Sur n'importe quel autre espace ce serait de
# la négligence ; ici c'est le sujet.
SO_NEONS_MORTS = frozenset({(30.0, 106.0), (46.0, 96.0), (62.0, 116.0), (46.0, 116.0)})


def habiller_souterrain(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z

    piliers = 0
    for i, px in enumerate(SO_PILIERS_X):
        for j, py in enumerate(SO_PILIERS_Y):
            L.place(R.pilier_beton(space.hauteur), (px, py, z), 0,
                    props, col_coll, f"so_pl{i}_{j}")
            piliers += 1
            # Un extincteur sur un pilier de bout de rangée : dans cette
            # pénombre, la seule tache de rouge franc sert de repère.
            if (i, j) in ((0, 0), (5, 3)):
                L.place(R.extincteur(), (px + 0.29, py - 0.05, z + 1.0), 0,
                        props, props, f"so_ext{i}{j}")

    # Places matérialisées le long des deux longues façades, dos aux murs.
    places = 0
    for i in range(8):
        L.place(R.marquage_place(5.0, 2.5), (x0 + 4.0 + i * 2.5, y0 + 0.5, z), 0,
                props, props, f"so_pm_s{i}")
        L.place(R.marquage_place(5.0, 2.5), (x0 + 4.0 + i * 2.5, y1 - 5.5, z), 0,
                props, props, f"so_pm_n{i}")
        places += 2

    # `rot 90` : les modèles du kit arrivent longueur le long de +Y, et les
    # emplacements du blockout sont orientés est-ouest. L'origine passe donc au
    # coin opposé de l'emprise.
    voitures = 0
    for i, (vx, vy) in enumerate(SO_VOITURES):
        modele = R.MODELES_VOITURE[(i * 3) % len(R.MODELES_VOITURE)]
        L.place(R.voiture(*modele), (vx + modele[2], vy, z), 90,
                props, col_coll, f"so_au{i}")
        voitures += 1

    # Détails du même atlas, donc gratuits en lots de dessin : un cône renversé,
    # un pneu, deux caisses. Un parking construit et jamais utilisé n'existe pas.
    for i, (ax, ay, modele) in enumerate(((33.0, 96.0, "cone"), (57.0, 110.0, "cone"),
                                          (69.0, 100.0, "debris-tire"),
                                          (31.0, 121.0, "box"), (31.8, 120.2, "box"))):
        L.place(R.accessoire_car_kit(modele), (ax, ay, z), i * 37,
                props, col_coll, f"so_acc{i}")

    for i, (fx, fy) in enumerate(((x1 - 2.0, y0 + 1.0), (x1 - 1.2, y0 + 1.7))):
        L.place(R.fut(i), (fx, fy, z), 0, props, col_coll, f"so_fut{i}")
    L.place(L.poubelle(), (x0 + 1.0, y1 - 1.5, z), 0, props, col_coll, "so_pou")

    # Éclairage volontairement pauvre et froid : deux fois moins puissant et
    # deux fois moins portant que la surface de vente. C'est le seul espace du
    # niveau où éclairer davantage serait une faute.
    rampes, lampes = _neons(space, props, logic, SO_NEON_X, SO_NEON_Y,
                            SO_NEONS_MORTS, "so",
                            couleur="#c8d8e0", intensite=3.5, portee=9.0)
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
PK_LAMPADAIRES = ((-22.0, -32.0), (-22.0, -14.0), (-2.0, -38.0),
                  (-2.0, -8.0), (20.0, -32.0), (20.0, -14.0))


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
    for i, (ax, ay, modele) in enumerate(((-3.0, -33.0, "cone"), (-1.0, -32.4, "cone"),
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
    for i, (lx, ly) in enumerate(PK_LAMPADAIRES):
        L.place(R.lampadaire(5.0), (lx, ly, z), 0, props, col_coll, f"pk_lp{i}")
        lampe(logic, f"light_pk_{i}", (lx + 0.26, ly + 1.45, z + 4.45),
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

    # Accès au secret 3 (bouche d'aération à (37, 18)) : le plan le veut par le
    # comptoir puis le haut d'un meuble. Le comptoir du self est au sud de la
    # pièce, à quinze mètres de la bouche — la chaîne d'escalade est donc posée
    # ICI, contre le mur ouest : une caisse à 1,00 m puis un meuble à 2,00 m,
    # les deux hauteurs que le plan nomme, franchissables d'un saut (1,10 m).
    sx, sy = 35.0, 17.0
    H.box("caisse_acces_secret3", (sx, sy, z, sx + 1.0, sy + 1.0, z + 1.0), "carton", props)
    H.col_box("caisse_acces_secret3", (sx, sy, z, sx + 1.0, sy + 1.0, z + 1.0), col_coll)
    L.place(L.frigo_garni(SEED + 960, "frais"), (x0 + 0.3, 17.4, z), 270,
            props, col_coll, "ca_frigo_secret")

    L.place(B.fontaine_eau(), (x0 + 0.6, 2.0, z), 0, props, col_coll, "ca_fontaine")
    for i, (px, py) in enumerate(((x0 + 0.8, y1 - 1.5), (x1 - 1.4, y1 - 1.4))):
        L.place(L.poubelle(), (px, py, z), 0, props, col_coll, f"ca_pou{i}")
    for i, (px, py) in enumerate(((40.0, 19.0), (47.0, 19.0))):
        L.place(L.bac_garni(SEED + 970 + i), (px, py, z), 0, props, col_coll, f"ca_bac{i}")

    meubles = semer(props, col_coll, "ca_k", (
        ("kitchenCoffeeMachine", 47.5, 3.6, z + 1.10, 0),
        ("toaster", 45.0, 3.7, z + 1.10, 15),
        ("kitchenMicrowave", 43.0, 3.6, z + 1.10, 0),
        ("kitchenFridge", 55.0, 1.2, z, 270),
        ("pottedPlant", 34.9, 1.2, z, 0), ("pottedPlant", 54.8, 18.6, z, 0),
        ("pottedPlant", 44.0, 18.8, z, 0), ("plantSmall2", 43.0, 9.0, z + 0.75, 0),
        ("stoolBar", 38.0, 5.0, z, 0), ("stoolBar", 40.0, 5.0, z, 0),
        ("stoolBar", 42.0, 5.0, z, 0), ("stoolBar", 44.0, 5.0, z, 0),
        ("trashcan", 34.8, 12.0, z, 0), ("radio", 38.5, 3.7, z + 1.10, 200),
    ))
    rampes, lampes = _neons(space, props, logic, CA_NEON_X, CA_NEON_Y,
                            CA_NEONS_MORTS, "ca", doubles=CA_NEON_X)
    return {"tables": len(CA_TABLES), "distributeurs": len(B.FACADES_DISTRIBUTEUR),
            "meubles": meubles, "rampes": rampes, "lampes": lampes}


# --- Habillage : les bureaux --------------------------------------------------
#
# La salle de confrontation : le Directeur, puis la sortie. Le plan le pose
# volontairement SOUS `attackRange` — la révélation doit être immédiate, pas une
# embuscade. L'habillage ne doit donc rien ajouter qui coupe la ligne de vue
# entre l'entrée sud et le fond de la pièce.

BU_POSTES = ((-16.0, 145.0), (-4.0, 145.0), (-16.0, 154.0), (-4.0, 154.0))
BU_CLOISON = (-18.0, 154.0)
BU_NEON_X = (-18.0, -10.0, 2.0)
BU_NEON_Y = (142.0, 150.0, 160.0)
BU_NEONS_MORTS = frozenset({(-18.0, 160.0), (2.0, 142.0)})


def habiller_bureaux(space, gris, props, col_coll, logic) -> dict:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z

    for i, (bx, by) in enumerate(BU_POSTES):
        L.place(B.poste_bureau(i), (bx, by, z), 0, props, col_coll, f"bu_ps{i}")

    L.place(B.cloison_bureau(12.0), (BU_CLOISON[0], BU_CLOISON[1], z), 0,
            props, col_coll, "bu_cloison")

    for i, (ax, ay, rot) in enumerate(((x0 + 0.4, 143.0, 90), (x0 + 0.4, 144.0, 90),
                                       (x1 - 1.0, 148.0, 270), (-9.0, y1 - 0.9, 180))):
        L.place(B.armoire_dossiers(i % 2), (ax, ay, z), rot, props, col_coll, f"bu_ar{i}")

    L.place(B.fontaine_eau(), (x1 - 0.9, 142.0, z), 0, props, col_coll, "bu_fontaine")
    for i, (px, py) in enumerate(((x0 + 0.8, 162.0), (2.0, 143.0))):
        L.place(L.poubelle(), (px, py, z), 0, props, col_coll, f"bu_pou{i}")
    for i, (px, py, rot) in enumerate(((x0 + 1.0, 158.5, 0), (4.5, 160.0, 20))):
        L.place(L.palette_cartons(), (px, py, z), rot, props, col_coll, f"bu_pal{i}")

    # Mobilier de bureau : c'est ce qui distingue une salle de réunion d'un
    # hangar à moquette. Coin d'attente au sud-est, plantes et bibliothèques le
    # long des murs, portemanteau près de l'entrée.
    meubles = semer(props, col_coll, "bu_k", (
        ("loungeSofa", 3.0, 145.5, z, 180), ("tableCoffee", 3.6, 147.6, z, 0),
        ("pottedPlant", 1.2, 144.0, z, 0), ("pottedPlant", -18.6, 149.0, z, 0),
        ("pottedPlant", -1.0, 163.0, z, 0), ("pottedPlant", -18.0, 164.5, z, 0),
        ("bookcaseClosed", -13.0, y1 - 1.1, z, 180), ("bookcaseOpen", -11.8, y1 - 1.1, z, 180),
        ("bookcaseClosed", -19.2, 156.0, z, 90),
        ("coatRackStanding", 5.5, 141.5, z, 0),
        ("chairDesk", -14.0, 147.6, z, 180), ("chairDesk", -2.2, 147.4, z, 170),
        ("chairDesk", -14.2, 156.6, z, 190), ("chairDesk", -2.0, 156.5, z, 180),
        ("trashcan", -17.4, 143.2, z, 0), ("trashcan", -5.5, 152.0, z, 0),
        ("rugRectangle", 1.5, 144.5, z, 0),
    ))

    # « SORTIE » au-dessus de la porte de sortie, au nord. Le dernier panneau du
    # niveau, et le seul qui indique autre chose qu'un rayon.
    L.place(F.enseigne_murale("sortie"), (-7.5, y1 - 0.35, z + 2.9), 180,
            props, props, "bu_sortie")

    rampes, lampes = _neons(space, props, logic, BU_NEON_X, BU_NEON_Y,
                            BU_NEONS_MORTS, "bu", doubles=BU_NEON_X)
    return {"postes": len(BU_POSTES), "meubles": meubles, "rampes": rampes, "lampes": lampes}


# Repères « signature » que l'habillage pose lui-même, en vrai objet : le
# blockout ne doit donc plus poser leur silhouette grise.
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
    "bureaux": habiller_bureaux,
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
