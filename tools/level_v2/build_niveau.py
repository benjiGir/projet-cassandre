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


def plafond(space, coll) -> bool:
    """Dalle de plafond, SANS collider. Retourne False quand l'espace est à ciel
    ouvert."""
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


def _neons_rayons(space, props, logic) -> tuple[int, int]:
    """Rampes de néons et leurs lampes de jeu.

    Deux lampes par rampe d'allée : une lampe ponctuelle au milieu d'un tube de
    4 m donnerait une flaque ronde là où il faut une traînée. Les rampes des
    dégagements latéraux n'en portent qu'une — elles éclairent un couloir, pas
    une allée, et le budget de lampes se dépense là où le joueur regarde.
    """
    ht = space.z + space.hauteur
    rampes = lampes = 0
    for x in RY_NEON_ALLEES + RY_NEON_BORDS:
        double = x in RY_NEON_ALLEES
        for y in RY_NEON_Y:
            mort = (x, y) in RY_NEONS_MORTS
            L.place(L.neon(4.0, eteint=mort), (x, y, ht - 0.18), 90,
                    props, props, f"ry_n{x:g}_{y:g}".replace(".", "_").replace("-", "m"))
            rampes += 1
            if mort:
                continue
            offsets = (1.0, 3.0) if double else (2.0,)
            for k, dy in enumerate(offsets):
                lampe(logic, f"light_ry_{x:g}_{y:g}_{k}".replace(".", "_").replace("-", "m"),
                      (x - 0.17, y + dy, ht - 0.65),
                      color="#dceeff", intensity=6.0, distance=11.0)
                lampes += 1

    # Bloc de secours au-dessus du passage vers la réserve : la seule lumière
    # d'une autre couleur de la pièce, donc le seul repère qui se voit de loin
    # dans l'ombre.
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


HABILLAGE = {
    "rayons": habiller_rayons,
}


# --- Assemblage --------------------------------------------------------------


def main() -> None:
    args = bo.get_args()
    out = os.path.abspath(bpy.path.abspath(
        bo.arg_value(args, "--out", "assets_src/blender/niveau_v2.blend")))

    geo_utils.wipe_scene()
    geo_utils.configure_scene()
    L.build_all()

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
        elif habillage is None:
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
            habilles.append((space.id, compte))

    portes = bo.poser_portes(ouvertures, materiaux_espace(plan.ALL[0], gris, cache), shell, logic_coll)
    reperes = bo.poser_reperes(gris, props, col_coll, logic_coll)
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
