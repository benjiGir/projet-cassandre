"""
Bibliothèque de l'électroménager et du carrefour — niveau v2, jalon N9.

Troisième module, après `lib_rayons` (la surface de vente alimentaire) et
`lib_facade` (l'avant-magasin et la galerie). Celui-ci meuble le rayon
électroménager/TV et l'allée centrale qui dessert tout le magasin.

Mêmes conventions : boîtes à 64 px/m, transform figée à la pose, un `col_box_*`
par asset solide. Les écrans et les façades
d'appareils viennent de l'atlas `prd_ecrans` (`tools/textures/generate_ecrans.py`).

Le parti pris de tout le module tient en une phrase : **un appareil
électroménager est une boîte blanche avec une façade dessinée**. Un hublot et
deux boutons peints dans l'albedo font un lave-linge à 640×360 ; les modéliser
coûterait cent fois plus de triangles pour un gain qui ne se voit qu'à un mètre.
"""

from __future__ import annotations

import random

import lib_helpers as H
from lib_rayons import asset_coll

# Contenus d'écran disponibles. `ecran_reptilien` n'est PAS dans la liste : il
# se pose à la main, une seule fois dans tout le niveau (voir `mur_ecrans`).
ECRANS = ("ecran_mire", "ecran_neige", "ecran_info", "ecran_meteo",
          "ecran_foot", "ecran_camera", "ecran_eteint", "ecran_barres")

# Hauteur minimale d'un collider de mobilier dont le dessus ne doit PAS
# devenir un sol pour le graphe de navigation (voir `rangee_blanc`).
HORS_NAVIGATION = 1.05

# Façades d'appareils, par gabarit.
GROS_APPAREILS = ("app_lave_linge", "app_four", "app_frigo")
PETITS_APPAREILS = ("app_micro_ondes", "app_aspirateur", "app_grille_pain", "app_enceinte")


# --- Mur d'écrans ------------------------------------------------------------

def mur_ecrans(longueur: float = 14.0, seed: int = 0) -> str:
    """Le mur de téléviseurs du plan de masse : une grille d'écrans allumés sur
    des contenus DIFFÉRENTS.

    Tous identiques, ils se liraient comme une texture répétée ; c'est leur
    divergence qui fait le mur d'écrans. Un seul, au milieu de la grille,
    diffuse le présentateur reptilien — assez pour qu'on le remarque en
    passant, jamais assez pour que la blague s'use.

    Profondeur 1 m et hauteur 3 m : les cotes du volume gris du blockout, donc
    le collider ne change pas.
    """
    name = f"mob_mur_ecrans_{longueur:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr, ht = longueur, 1.0, 3.0
    rng = random.Random(seed or 20260913)

    H.box(f"{name}_caisson", (0, 0.25, 0, lo, pr, ht), "metal_bac_acier", coll, subdiv=0.8)
    # Bouts et dos rentrés d'un centimètre dans le caisson : à fleur, ils se
    # battaient avec ses faces.
    H.box(f"{name}_plinthe", (0.01, 0.18, 0, lo - 0.01, pr - 0.01, 0.20),
          "trim_hypermarche", coll, uv="trim:plinthe")

    # Grille d'écrans. Pas de 1,15 m, quatre rangs : la moitié basse est à
    # hauteur de regard, la moitié haute se voit de l'autre bout du rayon.
    pas_x, pas_z = 1.15, 0.66
    nx = max(1, int((lo - 0.30) // pas_x))
    marge = (lo - nx * pas_x) / 2
    dalles = []
    cases = [(i, j) for j in range(4) for i in range(nx)]
    # Le reptilien au centre de la grille, jamais en bord de mur.
    centre = (nx // 2, 1)
    for i, j in cases:
        x = marge + i * pas_x
        z = 0.45 + j * pas_z
        label = "ecran_reptilien" if (i, j) == centre else rng.choice(ECRANS)
        dalles.append(((x, 0.20, z, x + pas_x - 0.10, 0.25, z + pas_z - 0.10),
                       f"label:{label}", "-y"))
    H.boxes(f"{name}_dalles", dalles, "prd_ecrans", coll)

    H.col_box(name[4:], (0, 0, 0, lo, pr, ht), coll)
    return name


# --- Appareils ---------------------------------------------------------------

def gros_appareil(label: str) -> str:
    """Lave-linge, four ou réfrigérateur : un caisson blanc et sa façade.

    0,60 × 0,62 × 0,85 pour les deux premiers, plus haut pour le frigo — les
    gabarits réels, parce que c'est leur alignement qui fait la rangée
    d'exposition, pas leur détail.
    """
    name = f"mob_{label[4:]}"
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr = 0.60, 0.62
    ht = 1.75 if label == "app_frigo" else 0.85
    H.box(f"{name}_caisson", (0, 0, 0, lo, pr, ht), "mur_platre", coll)
    H.box(f"{name}_facade", (0.01, -0.01, 0.02, lo - 0.01, 0.0, ht - 0.02),
          "prd_ecrans", coll, uv=f"label:{label}", front="-y")
    H.col_box(name[4:], (0, 0, 0, lo, pr, ht), coll)
    return name


def petit_appareil(label: str) -> str:
    """Micro-ondes, aspirateur, grille-pain, enceinte : posés sur une tablette,
    donc sans collider — on ne bute pas dans un grille-pain."""
    name = f"prd_{label[4:]}"
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr, ht = 0.44, 0.34, 0.30
    H.box(f"{name}_corps", (0, 0, 0, lo, pr, ht), "mur_platre", coll)
    H.box(f"{name}_facade", (0.01, -0.01, 0.01, lo - 0.01, 0.0, ht - 0.01),
          "prd_ecrans", coll, uv=f"label:{label}", front="-y")
    return name


def etagere_petits(seed: int = 0) -> str:
    """Étagère de petit électroménager : trois tablettes, la marchandise dessus.

    Les appareils sont figés DANS l'asset et non posés un par un : à cette
    taille, un objet par grille-pain coûterait trente meshes pour une
    silhouette que deux appels de dessin rendent aussi bien.
    """
    name = f"mob_etagere_petits_{seed}"
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr, ht = 2.0, 0.60, 1.80
    rng = random.Random(seed or 3)

    montants = [((0, 0, 0, 0.06, pr, ht), "world"),
                ((lo - 0.06, 0, 0, lo, pr, ht), "world"),
                ((0, pr - 0.04, 0.12, lo, pr, ht), "world")]
    H.boxes(f"{name}_montants", montants, "metal_bac_acier", coll)
    # Entre les joues et 1 cm devant elles : coupée à leurs cotes, la plinthe
    # avait ses bouts et sa façade dans leurs plans.
    H.box(f"{name}_plinthe", (0.06, -0.01, 0, lo - 0.06, pr, 0.12),
          "trim_hypermarche", coll, uv="trim:plinthe")

    niveaux = (0.12, 0.62, 1.12)
    tablettes = [((0.06, 0.03, z, lo - 0.06, pr - 0.04, z + 0.04), "world")
                 for z in niveaux]
    H.boxes(f"{name}_tablettes", tablettes, "metal_bac_acier", coll)

    corps, facades = [], []
    for z in niveaux:
        x = 0.14
        while x < lo - 0.50:
            label = rng.choice(PETITS_APPAREILS)
            w, d, h = 0.44, 0.34, 0.30
            corps.append(((x, 0.10, z + 0.04, x + w, 0.10 + d, z + 0.04 + h), "world"))
            facades.append(((x + 0.01, 0.09, z + 0.05, x + w - 0.01, 0.10, z + 0.03 + h),
                            f"label:{label}", "-y"))
            x += w + rng.uniform(0.04, 0.12)
    H.boxes(f"{name}_corps", corps, "mur_platre", coll)
    H.boxes(f"{name}_facades", facades, "prd_ecrans", coll)
    H.col_box(name[4:], (0, 0, 0, lo, pr, ht), coll)
    return name


def rangee_blanc(longueur: float = 4.0, seed: int = 0) -> str:
    """Rangée d'exposition de gros électroménager, sur son estrade.

    Les appareils sont figés DANS l'asset plutôt que posés un par un : une
    rangée d'exposition est un bloc qu'on longe, et la découper en huit objets
    coûterait huit meshes pour la même silhouette.
    """
    name = f"mob_rangee_blanc_{longueur:g}m_{seed}".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    rng = random.Random(seed or 1)
    H.box(f"{name}_estrade", (0, 0, 0, longueur, 0.90, 0.15),
          "bois_palette", coll, subdiv=0.8)
    H.box(f"{name}_chant", (0, -0.02, 0.02, longueur, 0.0, 0.13),
          "trim_hypermarche", coll, uv="trim:corniere")

    caissons, facades = [], []
    x = 0.12
    while x < longueur - 0.62:
        label = rng.choice(GROS_APPAREILS)
        ht = 1.75 if label == "app_frigo" else 0.85
        caissons.append(((x, 0.12, 0.15, x + 0.60, 0.74, 0.15 + ht), "world"))
        facades.append(((x + 0.01, 0.11, 0.17, x + 0.59, 0.12, 0.13 + ht),
                        f"label:{label}", "-y"))
        x += 0.60 + rng.uniform(0.06, 0.16)
    H.boxes(f"{name}_caissons", caissons, "mur_platre", coll)
    H.boxes(f"{name}_facades", facades, "prd_ecrans", coll)
    # Collider à la silhouette : l'estrade, puis chaque appareil à SA hauteur.
    # Une seule boîte de 1,90 m (premier jet) laissait marcher dans le vide
    # au-dessus des lave-linge de 1 m, et arrêtait un tir à 1,60 m là où l'œil
    # ne voyait rien — la ligne de vue ennemie lit les mêmes colliders.
    #
    # Plancher à 1,05 m : un lave-linge fait pile 1,00 m, soit exactement la
    # marche maximale du graphe de navigation (`MAX_STEP_HEIGHT`,
    # `game/level/pathfinding.ts`). Son dessus deviendrait une cellule reliée
    # au sol, qu'un Costard (marche de 0,35 m) ne sait pas gravir — il se
    # collerait à la rangée. Cinq centimètres invisibles l'en excluent.
    H.col_box(f"{name[4:]}_estrade", (0, 0, 0, longueur, 0.90, 0.15), coll)
    for i, ((ax, ay, _, bx, by, bz), _uv) in enumerate(caissons):
        H.col_box(f"{name[4:]}_app{i}", (ax, ay, 0.15, bx, by, max(bz, HORS_NAVIGATION)), coll)
    return name


def cabine_demo(seed: int = 0) -> str:
    """Cabine de démonstration : trois cloisons, un téléviseur, un fauteuil.

    5 × 5 × 2,50 m, les cotes du volume gris du blockout. Elle est OUVERTE au
    sud : c'est une pièce où l'on entre, et le plan y pose un Costard en
    embuscade — sans ouverture, il n'y aurait pas d'embuscade.
    """
    name = f"mob_cabine_demo_{seed}"
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr, ht, ep = 5.0, 5.0, 2.50, 0.20
    rng = random.Random(seed or 7)

    cloisons = [((0, pr - ep, 0, lo, pr, ht), "world"),
                ((0, 0, 0, ep, pr, ht), "world"),
                ((lo - ep, 0, 0, lo, pr, ht), "world"),
                # Retour partiel au sud : il cadre l'entrée sans la fermer.
                ((0, 0, 0, 1.20, ep, ht), "world"),
                ((lo - 1.20, 0, 0, lo, ep, ht), "world")]
    H.boxes(f"{name}_cloisons", cloisons, "mur_platre", coll, subdiv=0.7)
    # Plinthe au pied des cloisons, et non une dalle pleine de 5 × 5 m : on
    # entre dans la cabine, et une dalle sans collider y enfonçait les pieds.
    H.boxes(f"{name}_plinthe",
            [((ax - 0.01, ay - 0.01, 0, bx + 0.01, by + 0.01, 0.12), "trim:plinthe")
             for (ax, ay, _, bx, by, _), _uv in cloisons],
            "trim_hypermarche", coll)
    # Débordante d'un centimètre, dessus compris : à fleur, ses faces étaient
    # coplanaires avec le haut et l'extérieur des cloisons.
    H.box(f"{name}_corniche", (-0.01, -0.01, ht - 0.12, lo + 0.01, pr + 0.01, ht + 0.01),
          "trim_hypermarche", coll, uv="trim:corniere")

    # Le téléviseur, contre la cloison du fond, à hauteur de regard assis.
    H.box(f"{name}_meuble_tv", (1.70, pr - 0.85, 0.12, 3.30, pr - ep, 0.55),
          "bois_palette", coll)
    H.box(f"{name}_tv_caisson", (1.55, pr - 0.55, 0.55, 3.45, pr - ep, 1.70),
          "metal_bac_acier", coll)
    H.box(f"{name}_tv_dalle", (1.62, pr - 0.58, 0.62, 3.38, pr - 0.55, 1.63),
          "prd_ecrans", coll, uv=f"label:{rng.choice(ECRANS)}", front="-y")

    # Fauteuil : assise, dossier, accoudoirs. Face au téléviseur.
    fauteuil = [((1.90, 1.10, 0.10, 3.10, 2.00, 0.45), "world"),
                ((1.90, 1.10, 0.45, 3.10, 1.35, 1.00), "world"),
                ((1.90, 1.10, 0.45, 2.15, 2.00, 0.70), "world"),
                ((2.85, 1.10, 0.45, 3.10, 2.00, 0.70), "world")]
    H.boxes(f"{name}_fauteuil", fauteuil, "metal_peint_rouge", coll)

    # Un collider par cloison, plus le meuble télé et le fauteuil. Une boîte
    # pleine de 5 × 5 m (premier jet) faisait de l'ouverture un mur invisible :
    # la cabine se voyait ouverte et ne s'ouvrait pas.
    # Découpés pour ne jamais se recouvrir aux angles : le fond sur toute la
    # largeur, les côtés s'arrêtent contre lui, les retours contre les côtés.
    for i, bornes in enumerate(((0, pr - ep, 0, lo, pr, ht),
                                (0, 0, 0, ep, pr - ep, ht),
                                (lo - ep, 0, 0, lo, pr - ep, ht),
                                (ep, 0, 0, 1.20, ep, ht),
                                (lo - 1.20, 0, 0, lo - ep, ep, ht))):
        H.col_box(f"{name[4:]}_cloison{i}", bornes, coll)
    H.col_box(f"{name[4:]}_tv", (1.55, pr - 0.85, 0, 3.45, pr - ep, 1.70), coll)
    H.col_box(f"{name[4:]}_fauteuil", (1.90, 1.10, 0, 3.10, 2.00, HORS_NAVIGATION), coll)
    return name


# --- Carrefour ---------------------------------------------------------------

def estrade_micro() -> str:
    """Estrade du micro d'annonces, au milieu de l'allée centrale.

    4 × 4 × 0,50 m, les cotes du blockout : franchissable d'un saut, donc un
    point haut et non un obstacle. Le pupitre et son micro sont dessus ; c'est
    `use_pa_mic` qui porte l'interaction, pas cet asset.
    """
    name = "str_estrade_micro"
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr, ht = 4.0, 4.0, 0.50
    H.box(f"{name}_socle", (0, 0, 0, lo, pr, ht), "bois_palette", coll, subdiv=0.8)
    # 1 cm sous le plancher : une boîte pleine arasée à `ht` doublait tout le
    # dessus de l'estrade, et bois et cornière s'y battaient sur 16 m².
    H.box(f"{name}_chant", (-0.02, -0.02, ht - 0.12, lo + 0.02, pr + 0.02, ht - 0.01),
          "trim_hypermarche", coll, uv="trim:corniere")
    H.box(f"{name}_pupitre", (1.55, 1.70, ht, 2.45, 2.30, ht + 1.05),
          "metal_bac_acier", coll)
    H.box(f"{name}_tige", (1.96, 1.96, ht + 1.05, 2.04, 2.04, ht + 1.45),
          "metal_bac_acier", coll)
    H.box(f"{name}_micro", (1.88, 1.88, ht + 1.45, 2.12, 2.12, ht + 1.62),
          "metal_tole_perforee", coll)
    H.col_box(name[4:], (0, 0, 0, lo, pr, ht), coll)
    return name


def panneau_direction(bande: str, texture: str = "sig_bandeaux",
                      longueur: float = 2.0) -> str:
    """Panneau directionnel suspendu, double face, avec ses deux tiges.

    Le carrefour du niveau dessert quatre directions ; sans signalétique on y
    tourne en rond, et le plan lui donne justement le rôle de carrefour. Double
    face parce qu'on le traverse dans les deux sens.
    """
    name = f"sig_direction_{bande}_{longueur:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    H.boxes(f"{name}_panneau", [
        ((0, 0, 0, longueur, 0.03, 0.25), f"enseigne:{bande}"),
        ((0, 0.05, 0, longueur, 0.08, 0.25), f"enseigne:{bande}"),
    ], texture, coll)
    tiges = [((0.20, 0.02, 0.25, 0.24, 0.06, 1.60), "world"),
             ((longueur - 0.24, 0.02, 0.25, longueur - 0.20, 0.06, 1.60), "world")]
    H.boxes(f"{name}_tiges", tiges, "metal_bac_acier", coll)
    return name


def build_all() -> list[str]:
    """Construit tout le module. Idempotent, comme les autres bibliothèques."""
    names = [mur_ecrans(14.0), cabine_demo(0), estrade_micro(), etagere_petits(0)]
    names += [gros_appareil(a) for a in GROS_APPAREILS]
    names += [petit_appareil(a) for a in PETITS_APPAREILS]
    names += [rangee_blanc(4.0, s) for s in (1, 2)]
    # Bandes de RAYON et non de direction : un hypermarché suspend « ÉPICERIE »
    # au-dessus de l'allée qui y mène, et « BAZAR » est le nom réel du rayon
    # électroménager en grande surface. Aucun atlas neuf n'a donc été nécessaire.
    names += [panneau_direction(b) for b in
              ("rayon_epicerie", "rayon_frais", "rayon_bazar", "rayon_promos")]
    return names
