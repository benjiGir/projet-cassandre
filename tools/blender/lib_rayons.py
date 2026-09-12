"""Bibliothèque d'assets du rayon — niveau v2, jalon N4.

Chaque fonction construit UN asset dans la collection source `_LIB` (exclue
de l'export, comme `_KIT`) : un objet par matériau, plus son proxy de
collision. `place()` en dépose une copie dans la scène.

Conventions suivies : origine au coin au sol, un seul matériau par objet,
64 px/m, proxy cuboid `col_box_<nom>`, nommage `mob_`/`prd_`/`sig_`/`str_`/
`deco_`/`gp_` — voir `docs/pipeline/harmonisation-assets.md`.

Pourquoi un objet par matériau plutôt qu'un objet par pièce : la fusion au
chargement (ADR 0023) regroupe par matériau. Une gondole en vingt petits
objets coûterait vingt bakes et vingt meshes pour le même résultat visuel ;
en quatre objets (tôle, rouge, acier, trim), une allée entière de gondoles
finit en quatre appels de dessin.

Dans une session MCP :
    import sys; sys.path.insert(0, "<repo>/tools/blender")
    import lib_helpers, lib_rayons; lib_rayons.build_all()
"""

from __future__ import annotations

import math
import os
import random

import bmesh
import bpy

import lib_helpers as H

LIB_NAME = "_LIB"

# Repères de la gondole, partagés par la tête de gondole et le générateur de garnissage.
GOND_DEPTH = 1.25
GOND_HEIGHT = 2.0
GOND_LEVELS = (0.15, 0.50, 0.90, 1.30, 1.70)   # dessus de plinthe + quatre tablettes
SHELF_T = 0.04                                  # épaisseur d'une tablette
LIP_DROP = 0.06                                 # retombée de la tranche sous la tablette

KENNEY_GLB = os.path.join(
    H.ROOT, "assets_src", "cc0_raw", "kenney_food-kit", "Models", "GLB format")


# ---------------------------------------------------------------------------
# Socle
# ---------------------------------------------------------------------------

def lib() -> bpy.types.Collection:
    coll = H.collection(LIB_NAME)
    layer = bpy.context.view_layer.layer_collection.children.get(LIB_NAME)
    if layer:
        layer.exclude = False
    return coll


def asset_coll(name: str) -> tuple[bpy.types.Collection, bool]:
    """Collection de l'asset et un booléen « déjà construit »."""
    existing = bpy.data.collections.get(name)
    if existing is not None:
        return existing, True
    return H.collection(name, lib()), False


def place(asset: str, location, rot_deg: float, coll: bpy.types.Collection,
          col_coll: bpy.types.Collection, suffix: str) -> list[bpy.types.Object]:
    """Dépose une copie de l'asset, transform FIGÉE dans le mesh.

    La rotation est appliquée aux sommets plutôt qu'à l'objet : les proxies
    restent alignés sur les axes du monde (donc de vraies boîtes pour Rapier,
    voir `loader.ts`), et chaque copie rendue garde son propre mesh — sans
    quoi toutes les instances partageraient un seul bake d'éclairage
    (docs/pipeline/niveau-blender.md, piège instancing-vs-bake).
    """
    src = bpy.data.collections.get(asset)
    if src is None:
        raise KeyError(f"asset inconnu : {asset}")
    a = math.radians(rot_deg)
    cos_a, sin_a = math.cos(a), math.sin(a)
    out = []
    for obj in sorted(src.objects, key=lambda o: o.name):
        me = obj.data.copy()
        for v in me.vertices:
            x, y = v.co.x, v.co.y
            v.co.x = x * cos_a - y * sin_a + location[0]
            v.co.y = x * sin_a + y * cos_a + location[1]
            v.co.z += location[2]
        base = obj.name.split(".")[0]
        copy = bpy.data.objects.new(f"{base}_{suffix}", me)
        target = col_coll if base.startswith("col_") else coll
        if base.startswith("col_"):
            copy.display_type = "WIRE"
            copy.hide_render = True
        target.objects.link(copy)
        out.append(copy)
    return out


# ---------------------------------------------------------------------------
# Mobilier de vente
# ---------------------------------------------------------------------------

def gondole(length: float = 4.0) -> str:
    """Gondole double face : plinthe, dos en tôle perforée, montants rouges,
    tablettes acier, tranches à étiquettes de prix."""
    name = f"mob_gondole_{length:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    d, ht = GOND_DEPTH, GOND_HEIGHT

    trim = [((0, 0, 0, length, d, 0.15), "trim:plinthe")]
    acier = []
    for h in GOND_LEVELS[1:]:
        trim.append(((0, 0, h - LIP_DROP, length, 0.03, h + SHELF_T), "trim:tranche_etagere"))
        trim.append(((0, d - 0.03, h - LIP_DROP, length, d, h + SHELF_T), "trim:tranche_etagere"))
        acier.append(((0.08, 0.03, h, length - 0.08, d / 2 - 0.03, h + SHELF_T), "world"))
        acier.append(((0.08, d / 2 + 0.03, h, length - 0.08, d - 0.03, h + SHELF_T), "world"))

    # Montants au BORD de chaque face, jamais sur toute la profondeur : un montant
    # traversant présente à l'allée un panneau plein de 1,25 m de large tous les
    # deux mètres, et la rangée se lit comme un mur rouge (constaté en rendu).
    # Ils débordent d'un centimètre vers l'extérieur : à fleur des tranches, les
    # deux faces seraient coplanaires et se disputeraient le z-buffer.
    rouge = [((0, 0, ht - 0.06, length, d, ht), "world")]
    for x in (0.0, length / 2 - 0.04, length - 0.08):
        rouge.append(((x, -0.01, 0, x + 0.08, 0.05, ht), "world"))
        rouge.append(((x, d - 0.05, 0, x + 0.08, d + 0.01, ht), "world"))

    H.boxes(f"{name}_trim", trim, "trim_hypermarche", coll)
    H.boxes(f"{name}_acier", acier, "metal_bac_acier", coll)
    H.boxes(f"{name}_rouge", rouge, "metal_peint_rouge", coll)
    # Le dos s'arrête sous le chapeau : deux dessus au même z se battraient aussi.
    H.box(f"{name}_dos", (0, d / 2 - 0.025, 0.15, length, d / 2 + 0.025, ht - 0.06),
          "metal_tole_perforee", coll, subdiv=0.5)
    H.col_box(name[4:], (0, 0, 0, length, d, ht), coll)
    return name


def gondole_tete() -> str:
    """Tête de gondole promo : simple face, fronton à l'affiche « -50% »."""
    name = "mob_gondole_tete"
    coll, done = asset_coll(name)
    if done:
        return name
    w, d, ht = GOND_DEPTH, GOND_DEPTH, GOND_HEIGHT

    trim = [((0, 0, 0, w, d, 0.15), "trim:plinthe")]
    acier = []
    for h in GOND_LEVELS[1:]:
        trim.append(((0, 0, h - LIP_DROP, w, 0.03, h + SHELF_T), "trim:tranche_etagere"))
        acier.append(((0.08, 0.03, h, w - 0.08, d - 0.06, h + SHELF_T), "world"))

    # Flancs PLEINS. Une tête de gondole se regarde depuis l'entrée de l'allée,
    # donc de biais : à flancs ouverts on voit à travers ses étagères, garnies
    # d'un seul côté, et l'entrée d'allée se lit comme un rayonnage vide
    # (constaté en jeu). C'est aussi la réalité — une tête de gondole est un
    # bloc fermé, support de la promo.
    rouge = [((0, 0, ht - 0.06, w, d, ht), "world"),
             ((0, 0, 0, 0.05, d, ht), "world"),
             ((w - 0.05, 0, 0, w, d, ht), "world"),
             ((0, 0, ht, 0.08, 0.08, ht + 0.5), "world"),
             ((w - 0.08, 0, ht, w, 0.08, ht + 0.5), "world")]
    for x in (0.0, w - 0.08):
        rouge.append(((x, -0.01, 0, x + 0.08, 0.05, ht), "world"))
        rouge.append(((x, d, 0, x + 0.08, d + 0.01, ht), "world"))

    H.boxes(f"{name}_trim", trim, "trim_hypermarche", coll)
    H.boxes(f"{name}_acier", acier, "metal_bac_acier", coll)
    H.boxes(f"{name}_rouge", rouge, "metal_peint_rouge", coll)
    H.box(f"{name}_dos", (0, d - 0.06, 0.15, w, d, ht - 0.06),
          "metal_tole_perforee", coll, subdiv=0.5)
    # Affiches sur les flancs : un flanc plein sans rien dessus n'est qu'un pan
    # rouge de 1,25 × 2 m à hauteur de regard, à l'endroit précis où le joueur
    # entre dans l'allée. Une tête de gondole, c'est de la signalétique.
    H.boxes(f"{name}_fronton", [
        ((0.08, 0.0, ht + 0.05, w - 0.08, 0.05, ht + 0.45), "label:promo_moins_50", "-y"),
        ((-0.01, 0.20, 0.70, 0.0, 1.05, 1.55), "label:prix_choc", "-x"),
        ((w, 0.20, 0.70, w + 0.01, 1.05, 1.55), "label:prix_choc", "+x"),
    ], "prd_etiquettes", coll)
    H.col_box(name[4:], (0, 0, 0, w, d, ht), coll)
    return name


def bac_promo() -> str:
    """Bac de promotion : cuve acier sur socle rouge, bandeau de rayon devant."""
    name = "mob_bac_promo"
    coll, done = asset_coll(name)
    if done:
        return name
    # Cuve basse (0.60 m) : à 0.80 m les parois cachaient entièrement la
    # marchandise, et le bac se lisait comme une caisse grise (constaté en rendu).
    w, d, ht = 1.5, 1.0, 0.60
    acier = [((0, 0, 0.25, w, 0.06, ht), "world"),
             ((0, d - 0.06, 0.25, w, d, ht), "world"),
             ((0, 0, 0.25, 0.06, d, ht), "world"),
             ((w - 0.06, 0, 0.25, w, d, ht), "world"),
             ((0.06, 0.06, 0.25, w - 0.06, d - 0.06, 0.30), "world")]
    H.boxes(f"{name}_acier", acier, "metal_bac_acier", coll)
    H.box(f"{name}_socle", (0.05, 0.05, 0, w - 0.05, d - 0.05, 0.25),
          "metal_peint_rouge", coll)
    # Bandeau sur les quatre faces : un bac est contourné, pas regardé de face.
    H.boxes(f"{name}_bandeau", [
        ((0, -0.02, 0.34, w, 0.0, ht - 0.02), "trim:bandeau_rayon"),
        ((0, d, 0.34, w, d + 0.02, ht - 0.02), "trim:bandeau_rayon"),
        ((-0.02, 0, 0.34, 0.0, d, ht - 0.02), "trim:bandeau_rayon"),
        ((w, 0, 0.34, w + 0.02, d, ht - 0.02), "trim:bandeau_rayon"),
    ], "trim_hypermarche", coll)
    H.col_box(name[4:], (-0.02, -0.02, 0, w + 0.02, d + 0.02, ht), coll)
    return name


def presentoir() -> str:
    """Tourniquet : mât rouge et trois plateaux ronds. Casse la grille orthogonale des allées."""
    name = "mob_presentoir"
    coll, done = asset_coll(name)
    if done:
        return name
    c = (0.35, 0.35)
    H.cylinder(f"{name}_mat", c, 0.04, 0.0, 1.6, "metal_peint_rouge", coll, segments=6)
    for i, z in enumerate((0.55, 0.95, 1.35)):
        H.cylinder(f"{name}_plateau{i}", c, 0.32, z, z + 0.03, "metal_bac_acier", coll)
    H.cylinder(f"{name}_socle", c, 0.30, 0.0, 0.06, "metal_bac_acier", coll)
    H.col_box(name[4:], (0.05, 0.05, 0, 0.65, 0.65, 1.6), coll)
    return name


def frigo_mural() -> str:
    """Meuble réfrigéré mural, façade ouverte (pas de vitre : rien de transparent en Lambert)."""
    name = "mob_frigo_2m"
    coll, done = asset_coll(name)
    if done:
        return name
    w, d, ht = 2.0, 0.8, 2.2
    acier = [((0, 0, 0, 0.08, d, ht), "world"),
             ((w - 0.08, 0, 0, w, d, ht), "world"),
             ((0, d - 0.08, 0, w, d, ht), "world"),
             ((0, 0, 0, w, d, 0.30), "world"),
             ((0, 0, ht - 0.15, w, d, ht), "world")]
    for h in (0.60, 1.05, 1.50):
        acier.append(((0.08, 0.06, h, w - 0.08, d - 0.08, h + SHELF_T), "world"))
    H.boxes(f"{name}_acier", acier, "metal_bac_acier", coll)
    trim = [((0, 0, 0, w, 0.03, 0.30), "trim:plinthe"),
            ((0.08, 0.0, ht - 0.28, w - 0.08, 0.06, ht - 0.15), "trim:neon")]
    H.boxes(f"{name}_trim", trim, "trim_hypermarche", coll)
    H.col_box(name[4:], (0, 0, 0, w, d, ht), coll)
    return name


def caddie() -> str:
    """Caddie en décor statique. Le panier est en tôle perforée : à 640×360, les trous
    peints dans l'albedo se lisent comme du grillage, sans un seul triangle de fil."""
    name = "mob_caddie"
    coll, done = asset_coll(name)
    if done:
        return name
    w, d, ht = 0.60, 0.95, 1.00
    panier = [((0.02, 0.05, 0.55, w - 0.02, 0.09, 0.92), "world"),
              ((0.02, d - 0.13, 0.55, w - 0.02, d - 0.09, 0.92), "world"),
              ((0.02, 0.05, 0.55, 0.06, d - 0.09, 0.92), "world"),
              ((w - 0.06, 0.05, 0.55, w - 0.02, d - 0.09, 0.92), "world"),
              ((0.02, 0.05, 0.55, w - 0.02, d - 0.09, 0.58), "world")]
    H.boxes(f"{name}_panier", panier, "metal_tole_perforee", coll)
    rouge = [((0.02, d - 0.10, 0.95, w - 0.02, d - 0.05, ht), "world")]
    for x in (0.06, w - 0.10):
        for y in (0.08, d - 0.16):
            rouge.append(((x, y, 0.12, x + 0.04, y + 0.04, 0.56), "world"))
    H.boxes(f"{name}_rouge", rouge, "metal_peint_rouge", coll)
    roues = []
    for x in (0.06, w - 0.12):
        for y in (0.08, d - 0.18):
            roues.append(((x, y, 0.0, x + 0.06, y + 0.10, 0.12), "world"))
    H.boxes(f"{name}_roues", roues, "metal_bac_acier", coll)
    H.col_box(name[4:], (0, 0, 0, w, d, ht), coll)
    return name


# ---------------------------------------------------------------------------
# Signalétique
# ---------------------------------------------------------------------------

def panneau_allee() -> str:
    """Panneau d'allée suspendu, double face, avec ses deux tiges."""
    name = "sig_panneau_allee"
    coll, done = asset_coll(name)
    if done:
        return name
    w = 1.60
    H.box(f"{name}_panneau", (0, 0, 0, w, 0.06, 0.45),
          "trim_hypermarche", coll, uv="trim:bandeau_rayon")
    # Tiges jusqu'à 2 m au-dessus du panneau : posé à 3 m, l'ensemble touche le
    # plafond d'une salle de vente (5 m).
    tiges = [((0.15, 0.01, 0.45, 0.19, 0.05, 2.0), "world"),
             ((w - 0.19, 0.01, 0.45, w - 0.15, 0.05, 2.0), "world")]
    H.boxes(f"{name}_tiges", tiges, "metal_bac_acier", coll)
    return name


def promo_suspendu() -> str:
    """Affiche promo suspendue au-dessus d'une tête de gondole."""
    name = "sig_promo_suspendu"
    coll, done = asset_coll(name)
    if done:
        return name
    H.box(f"{name}_affiche", (0, 0, 0, 0.9, 0.04, 0.7),
          "prd_etiquettes", coll, uv="label:prix_choc", front="-y")
    H.box(f"{name}_tige", (0.43, 0.01, 0.7, 0.47, 0.03, 1.5), "metal_bac_acier", coll)
    return name


def neon(length: float = 4.0, eteint: bool = False) -> str:
    """Rampe de néons.

    Le tube porte le marqueur `_neon` : `bake_vertex_lighting.py` lui force une
    couleur de sommet blanche, sinon une source de lumière ressort noire dans un
    bake de lumière seule.

    `eteint` produit la même rampe avec un tube nommé `_tube_mort`, donc SANS ce
    marqueur : il reste éclairé par ses voisins, comme un tube grillé. Un
    plafond dont toutes les rampes fonctionnent n'a pas d'âge — quelques-unes
    mortes suffisent à dater le magasin et à creuser des zones d'ombre où il
    devient intéressant d'aller voir.
    """
    name = f"sig_rampe_{'morte_' if eteint else ''}{length:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    H.box(f"{name}_carter", (0, 0, 0.06, length, 0.34, 0.18), "metal_bac_acier", coll)
    suffixe = "tube_mort" if eteint else "tube_neon"
    H.box(f"{name}_{suffixe}", (0.05, 0.05, 0.0, length - 0.05, 0.29, 0.07),
          "mur_platre", coll)
    return name


def bandeau_rayon(theme: str, length: float = 4.0) -> str:
    """Bandeau de catégorie posé sur le dessus d'une rangée.

    Hauteur 0.25 m pour une bande de 16 px : c'est la densité du projet,
    64 px/m. Sa couleur de fond porte autant d'information que son texte —
    à vingt mètres et à 640×360, on reconnaît le rayon à sa couleur.
    """
    name = f"sig_bandeau_{theme}_{length:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    H.box(f"{name}_bandeau", (0, 0, 0, length, 0.08, 0.25),
          "sig_bandeaux", coll, uv=f"trim:rayon_{theme}")
    return name


# ---------------------------------------------------------------------------
# Structure et déco
# ---------------------------------------------------------------------------

def pilier() -> str:
    name = "str_pilier"
    coll, done = asset_coll(name)
    if done:
        return name
    H.box(f"{name}_corps", (0, 0, 0.6, 0.5, 0.5, 5.0), "mur_platre", coll)
    H.box(f"{name}_socle", (0, 0, 0, 0.5, 0.5, 0.6), "metal_bandes_danger", coll)
    H.col_box(name[4:], (0, 0, 0, 0.5, 0.5, 5.0), coll)
    return name


def palette_cartons() -> str:
    """Palette bois et sa pile de cartons — le réassort en cours, marqueur « dans son jus »."""
    name = "deco_palette_cartons"
    coll, done = asset_coll(name)
    if done:
        return name
    bois = []
    for y in (0.0, 0.36, 0.72):
        bois.append(((0, y, 0, 1.2, y + 0.08, 0.10), "world"))
    for x in (0.0, 0.28, 0.56, 0.84, 1.12):
        bois.append(((x, 0, 0.10, x + 0.08, 0.8, 0.15), "world"))
    H.boxes(f"{name}_palette", bois, "bois_palette", coll)
    cartons = [((0.05, 0.05, 0.15, 0.60, 0.42, 0.52), "world"),
               ((0.62, 0.08, 0.15, 1.15, 0.45, 0.52), "world"),
               ((0.10, 0.44, 0.15, 0.66, 0.78, 0.50), "world"),
               ((0.18, 0.12, 0.52, 0.74, 0.50, 0.88), "world"),
               ((0.76, 0.30, 0.50, 1.16, 0.72, 0.84), "world")]
    H.boxes(f"{name}_cartons", cartons, "carton", coll)
    H.col_box(name[5:], (0, 0, 0, 1.2, 0.8, 0.9), coll)
    return name


def poubelle() -> str:
    name = "deco_poubelle"
    coll, done = asset_coll(name)
    if done:
        return name
    H.cylinder(f"{name}_fut", (0.25, 0.25), 0.25, 0.0, 0.85, "metal_bac_acier", coll)
    H.cylinder(f"{name}_col", (0.25, 0.25), 0.27, 0.85, 0.92, "metal_peint_rouge", coll)
    H.col_box(name[5:], (0, 0, 0, 0.5, 0.5, 0.92), coll)
    return name


# ---------------------------------------------------------------------------
# Produits
# ---------------------------------------------------------------------------

# Marques inventées (N3) et gabarit de la boîte : largeur, profondeur, hauteur.
# Les hauteurs tiennent toutes sous le dégagement d'une tablette (0.29 m) :
# un produit plus haut traverserait la tablette du dessus.
PRODUITS = {
    "cereales_pyramides": (0.20, 0.08, 0.28),
    "lait_trainees_blanches": (0.09, 0.09, 0.24),
    "eau_terre_plate": (0.10, 0.10, 0.26),
    "soda_5g_cola": (0.09, 0.09, 0.24),
    "raviolis_bunker": (0.11, 0.11, 0.13),
    "alu_protect": (0.08, 0.08, 0.26),
    "sables_reptiliens": (0.16, 0.07, 0.22),
    "cafe_reveille": (0.12, 0.10, 0.16),
    "chips_illumi": (0.22, 0.10, 0.26),
    "lessive_profonde": (0.24, 0.14, 0.28),
    "coquillettes_nouvel_ordre": (0.14, 0.08, 0.22),
    "dentifrice_sans_fluor": (0.06, 0.04, 0.18),
    "piles_lune_truquee": (0.10, 0.04, 0.14),
}


# Rayons thématiques. Un rayon mélangé se lit comme un tas ; un rayon cohérent
# se lit comme un magasin, et son bandeau de catégorie devient une information
# d'orientation plutôt qu'une décoration. Chaque thème correspond à une bande de
# `sig_bandeaux.png` (`rayon_<clé>`).
RAYONS = {
    "epicerie": (("sables_reptiliens", "chips_illumi", "coquillettes_nouvel_ordre"),
                 ("bag", "barrel", "bottle-oil")),
    "boissons": (("eau_terre_plate", "soda_5g_cola"),
                 ("soda-bottle",)),
    "petit_dej": (("cereales_pyramides", "cafe_reveille", "lait_trainees_blanches"),
                  ("carton", "carton-small")),
    "entretien": (("lessive_profonde", "alu_protect", "dentifrice_sans_fluor", "piles_lune_truquee"),
                  ()),
    "conserves": (("raviolis_bunker",),
                  ("can", "can-small")),
    "frais": (("lait_trainees_blanches",),
              ("loaf", "cabbage", "carton")),
}


def _choix(theme: str | None, max_h: float):
    """Références disponibles pour un thème, filtrées par le dégagement de la tablette."""
    if theme is None:
        boites, modeles = list(PRODUITS), list(KENNEY)
    else:
        labels, models = RAYONS[theme]
        boites = [p for p in labels]
        modeles = [k for k in KENNEY if k[0] in models]
    return ([p for p in boites if PRODUITS[p][2] <= max_h],
            [k for k in modeles if k[1] <= max_h])


def produit(label: str) -> str:
    """Face de produit prise dans l'atlas d'étiquettes ; les autres faces
    échantillonnent la couleur de fond de sa case."""
    name = f"prd_{label}"
    coll, done = asset_coll(name)
    if done:
        return name
    w, d, h = PRODUITS[label]
    H.box(name, (0, 0, 0, w, d, h), "prd_etiquettes", coll,
          uv=f"label:{label}", front="-y")
    return name


# Modèles Kenney retenus : silhouettes rondes ou molles que des boîtes ne donnent pas.
# (nom du fichier, hauteur cible en mètres)
KENNEY = [
    ("soda-bottle", 0.28), ("bottle-oil", 0.26), ("can", 0.12), ("can-small", 0.09),
    ("carton", 0.24), ("carton-small", 0.16), ("loaf", 0.14), ("cabbage", 0.16),
    ("bag", 0.22), ("barrel", 0.26),
]


def kenney_produit(model: str, target_height: float) -> str:
    """Importe un modèle du Kenney Food Kit, le met à l'échelle et le rebascule
    sur notre atlas requantifié (`tools/textures/make_kenney_atlas.py`)."""
    name = f"prd_k_{model.replace('-', '_')}"
    coll, done = asset_coll(name)
    if done:
        return name
    before = set(bpy.data.objects)
    before_img = set(bpy.data.images)
    before_mat = set(bpy.data.materials)
    bpy.ops.import_scene.gltf(filepath=os.path.join(KENNEY_GLB, f"{model}.glb"))
    new = [o for o in bpy.data.objects if o not in before]

    # Fusion à la main plutôt que `object.join` : l'opérateur dépend de la sélection
    # et de l'objet actif, or l'import glTF pose un empty racine porteur de la
    # conversion Y-up → Z-up. On lit chaque matrice monde AVANT de rien supprimer.
    bpy.context.view_layer.update()
    bm = bmesh.new()
    for obj in new:
        if obj.type != "MESH":
            continue
        tmp = obj.data.copy()
        tmp.transform(obj.matrix_world)
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    for obj in new:
        bpy.data.objects.remove(obj, do_unlink=True)

    # Le pack arrive avec son propre matériau et son atlas 512×512. On ne garde
    # que l'atlas requantifié : laissé traîner, l'original violait le plafond de
    # 128 px et faisait échouer `validate_level.py`.
    for mat in [m for m in bpy.data.materials if m not in before_mat]:
        bpy.data.materials.remove(mat)
    for img in [i for i in bpy.data.images if i not in before_img and i.users == 0]:
        bpy.data.images.remove(img)

    # Échelle sur la hauteur voulue, puis origine au coin au sol (convention du kit).
    lo = [min(v.co[i] for v in bm.verts) for i in range(3)]
    hi = [max(v.co[i] for v in bm.verts) for i in range(3)]
    scale = target_height / max(hi[2] - lo[2], 1e-6)
    for v in bm.verts:
        v.co = ((v.co[0] - lo[0]) * scale, (v.co[1] - lo[1]) * scale,
                (v.co[2] - lo[2]) * scale)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.data.materials.append(H.textured_material("prd_kenney"))
    coll.objects.link(obj)
    return name


# ---------------------------------------------------------------------------
# Garnissage des rayons
# ---------------------------------------------------------------------------

class Garnissage:
    """Accumule les produits d'un meuble en UN mesh par matériau.

    Sans ça, une gondole garnie compterait soixante objets — soixante bakes
    d'éclairage et soixante meshes dans le `.glb` pour deux appels de dessin
    une fois fusionnés au chargement. On assemble donc les copies dans deux
    `bmesh` (étiquettes, Kenney) que l'on fige en fin de garnissage.
    """

    MATERIAUX = ("prd_etiquettes", "prd_kenney")

    def __init__(self):
        self.bm = {m: bmesh.new() for m in self.MATERIAUX}
        self.count = 0

    def add(self, src_mesh, material: str, x_left: float, y_face: float, z: float,
            facing: int, yaw_deg: float) -> None:
        """Dépose une copie, face visible tournée vers le client.

        Tous les produits ont leur étiquette en -y et leur origine au coin au
        sol. `facing` est la normale sortante voulue : -1 pour un client du
        côté des y décroissants, +1 sinon — le produit fait alors demi-tour,
        son étiquette avec lui.
        """
        me = src_mesh.copy()
        lo = [min(v.co[i] for v in me.vertices) for i in range(3)]
        hi = [max(v.co[i] for v in me.vertices) for i in range(3)]
        w, d = hi[0] - lo[0], hi[1] - lo[1]
        a = math.radians(yaw_deg + (180 if facing > 0 else 0))
        cos_a, sin_a = math.cos(a), math.sin(a)
        cx, cy = x_left + w / 2, y_face - facing * d / 2
        for v in me.vertices:
            px, py = v.co.x - lo[0] - w / 2, v.co.y - lo[1] - d / 2
            v.co.x = px * cos_a - py * sin_a + cx
            v.co.y = px * sin_a + py * cos_a + cy
            v.co.z += z - lo[2]
        self.bm[material].from_mesh(me)
        bpy.data.meshes.remove(me)
        self.count += 1

    def finish(self, prefix: str, coll: bpy.types.Collection) -> None:
        for material, bm in self.bm.items():
            if not bm.verts:
                bm.free()
                continue
            me = bpy.data.meshes.new(f"{prefix}_{material}")
            bm.to_mesh(me)
            bm.free()
            obj = bpy.data.objects.new(me.name, me)
            obj.data.materials.append(H.textured_material(material))
            coll.objects.link(obj)


def _src(label: str):
    return bpy.data.collections[produit(label)].objects[0].data


def _src_kenney(model: str, target: float):
    return bpy.data.collections[kenney_produit(model, target)].objects[0].data


def _span(mesh, axis: int = 0) -> float:
    return max(v.co[axis] for v in mesh.vertices) - min(v.co[axis] for v in mesh.vertices)


def stock_shelf(g: Garnissage, x0: float, x1: float, y_face: float, z: float,
                facing: int, rng: random.Random, max_h: float = 0.29,
                density: float = 0.85, part_kenney: float = 0.12,
                theme: str | None = None) -> None:
    """Garnit une tablette.

    Le désordre est délibéré (skill `prop-silhouette-design`) : produits tirés
    au hasard, retrait en profondeur variable, trous, léger dévers. Une rangée
    parfaitement alignée se lit comme une texture, pas comme un rayon.

    Les modèles Kenney sont des ACCENTS (`part_kenney`), pas le fond du rayon :
    à une centaine de triangles pièce contre douze pour une boîte à étiquette,
    une salle garnie majoritairement de modèles coûtait 88 000 triangles pour
    la seule marchandise — l'essentiel du budget pour un gain de silhouette
    qui ne se voit que de près.
    """
    boites, modeles = _choix(theme, max_h)
    if not boites and not modeles:
        return
    x, precedent = x0 + rng.uniform(0.01, 0.06), None
    while x < x1 - 0.10:
        if rng.random() > density:                      # un trou dans la rangée
            x += rng.uniform(0.08, 0.22)
            continue
        if modeles and (not boites or rng.random() < part_kenney):
            model, target = rng.choice(modeles)
            ref = model
            src, material = _src_kenney(model, target), "prd_kenney"
            w, jitter, recul = _span(src), 15.0, (0.01, 0.07)
        else:
            label = rng.choice(boites)
            # Jamais deux fois la même référence de suite : sans ce garde-fou, les
            # tirages produisent des files de cinq paquets identiques qui se lisent
            # comme une erreur de copier-coller plutôt que comme un rayon.
            if label == precedent and len(boites) > 1:
                label = rng.choice([p for p in boites if p != precedent])
            ref = label
            src, material = _src(label), "prd_etiquettes"
            w, jitter, recul = PRODUITS[label][0], 4.0, (0.0, 0.05)
        precedent = ref
        if w < 1e-3:
            break
        # Deux exemplaires de front au maximum : au-delà, la répétition se voit.
        for _ in range(rng.choice((1, 1, 2, 2, 3) if w < 0.14 else (1, 1, 2))):
            if x + w > x1:
                break
            g.add(src, material, x, y_face - facing * rng.uniform(*recul),
                  z, facing, rng.uniform(-jitter, jitter))
            x += w + rng.uniform(0.004, 0.02)
        x += rng.uniform(0.0, 0.05)


def stock_bin(g: Garnissage, x0: float, y0: float, x1: float, y1: float, z: float,
              rng: random.Random, count: int) -> None:
    """Vrac d'un bac promo : orientations quelconques, c'est tout l'intérêt."""
    for _ in range(count):
        if rng.random() < 0.4:
            model, target = rng.choice(KENNEY)
            src, material = _src_kenney(model, target), "prd_kenney"
        else:
            label = rng.choice(list(PRODUITS))
            src, material = _src(label), "prd_etiquettes"
        w = _span(src)
        x = rng.uniform(x0, max(x0, x1 - w))
        y = rng.uniform(y0 + 0.1, y1)
        g.add(src, material, x, y, z + rng.uniform(0.0, 0.06),
              rng.choice((-1, 1)), rng.uniform(0, 360))


# ---------------------------------------------------------------------------
# Meubles garnis — l'asset final posé en niveau
# ---------------------------------------------------------------------------

def _clone_base(base: str, coll: bpy.types.Collection) -> None:
    for obj in sorted(bpy.data.collections[base].objects, key=lambda o: o.name):
        copy = bpy.data.objects.new(obj.name.split(".")[0], obj.data.copy())
        if copy.name.startswith("col_"):
            copy.display_type = "WIRE"
            copy.hide_render = True
        coll.objects.link(copy)


def _niveaux_gondole() -> list[tuple[float, float]]:
    """(hauteur de pose, dégagement au-dessus) pour chaque niveau d'une gondole."""
    out = [(GOND_LEVELS[0], GOND_LEVELS[1] - LIP_DROP - GOND_LEVELS[0])]
    for i, h in enumerate(GOND_LEVELS[1:], start=1):
        z = h + SHELF_T
        top = GOND_LEVELS[i + 1] - LIP_DROP if i + 1 < len(GOND_LEVELS) else GOND_HEIGHT
        out.append((z, top - z))
    return out


def gondole_garnie(seed: int, length: float = 4.0,
                   theme_avant: str | None = None,
                   theme_arriere: str | None = None) -> str:
    """Gondole garnie. Les DEUX faces ont chacune leur thème : elles donnent sur
    deux allées différentes, et chacune porte son propre bandeau."""
    cle = f"{theme_avant or 'mix'}_{theme_arriere or 'mix'}"
    name = f"mob_gondole_{length:g}m_{cle}_g{seed}".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    _clone_base(gondole(length), coll)
    rng = random.Random(seed)
    g = Garnissage()
    for z, clearance in _niveaux_gondole():
        for y_face, facing, theme in ((0.045, -1, theme_avant),
                                      (GOND_DEPTH - 0.045, 1, theme_arriere)):
            stock_shelf(g, 0.08, length - 0.08, y_face, z, facing, rng,
                        max_h=clearance, theme=theme)
    g.finish(name, coll)
    return name


def tete_garnie(seed: int, theme: str | None = None) -> str:
    """Tête de gondole garnie. Sans thème, elle reste volontairement mélangée :
    c'est ce qu'est une tête de gondole, un assortiment de promotions."""
    name = f"mob_gondole_tete_{theme or 'promo'}_g{seed}"
    coll, done = asset_coll(name)
    if done:
        return name
    _clone_base(gondole_tete(), coll)
    rng = random.Random(seed)
    g = Garnissage()
    # Deux rangs de profondeur : une tête de gondole se voit de biais depuis
    # l'entrée de l'allée, et un rang unique laisse voir la tablette nue derrière.
    for z, clearance in _niveaux_gondole():
        stock_shelf(g, 0.10, GOND_DEPTH - 0.10, 0.045, z, -1, rng,
                    max_h=clearance, theme=theme)
        stock_shelf(g, 0.10, GOND_DEPTH - 0.10, 0.40, z, -1, rng,
                    max_h=clearance, density=0.7, theme=theme)
    g.finish(name, coll)
    return name


def bac_garni(seed: int) -> str:
    name = f"mob_bac_promo_g{seed}"
    coll, done = asset_coll(name)
    if done:
        return name
    _clone_base(bac_promo(), coll)
    g = Garnissage()
    # Deux couches : le fond du bac, puis un tas qui dépasse de la cuve — sans quoi
    # il n'y a rien à voir par-dessus bord.
    rng = random.Random(seed)
    stock_bin(g, 0.10, 0.10, 1.40, 0.84, 0.30, rng, 14)
    stock_bin(g, 0.18, 0.16, 1.32, 0.78, 0.46, rng, 9)
    g.finish(name, coll)
    return name


def presentoir_garni(seed: int) -> str:
    name = f"mob_presentoir_g{seed}"
    coll, done = asset_coll(name)
    if done:
        return name
    _clone_base(presentoir(), coll)
    rng = random.Random(seed)
    g = Garnissage()
    petits = [p for p, dims in PRODUITS.items() if dims[2] <= 0.22]
    for z in (0.58, 0.98, 1.38):
        for i in range(rng.choice((5, 6, 7))):
            a = 2 * math.pi * i / 7 + rng.uniform(-0.2, 0.2)
            label = rng.choice(petits)
            w, d, _ = PRODUITS[label]
            g.add(_src(label), "prd_etiquettes",
                  0.35 + 0.20 * math.cos(a) - w / 2, 0.35 + 0.20 * math.sin(a),
                  z, -1, math.degrees(a) + 90)
    g.finish(name, coll)
    return name


def frigo_garni(seed: int, theme: str = "frais") -> str:
    name = f"mob_frigo_2m_{theme}_g{seed}"
    coll, done = asset_coll(name)
    if done:
        return name
    _clone_base(frigo_mural(), coll)
    rng = random.Random(seed)
    g = Garnissage()
    # Un rayon frais vit de silhouettes rondes : la part de modèles Kenney y monte.
    for z, clearance in ((0.30, 0.30), (0.64, 0.41), (1.09, 0.41), (1.54, 0.41)):
        stock_shelf(g, 0.12, 1.88, 0.10, z, -1, rng, max_h=clearance,
                    part_kenney=0.45, theme=theme)
    g.finish(name, coll)
    return name


def build_all() -> list[str]:
    """Construit toute la bibliothèque. Idempotent."""
    names = [gondole(4.0), gondole(2.0), gondole_tete(), bac_promo(), presentoir(),
             frigo_mural(), caddie(), panneau_allee(), promo_suspendu(),
             neon(4.0), neon(4.0, eteint=True),
             pilier(), palette_cartons(), poubelle()]
    names += [bandeau_rayon(t) for t in RAYONS]
    names += [produit(p) for p in PRODUITS]
    names += [kenney_produit(m, h) for m, h in KENNEY]
    return names
