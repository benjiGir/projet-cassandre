"""
Bibliothèque de la réserve et du parking souterrain — niveau v2, jalon N9.

Quatrième module, après `lib_rayons` (la surface de vente), `lib_facade`
(l'avant-magasin) et `lib_electro` (l'électroménager). Celui-ci meuble
l'arrière du magasin : le quai, les racks, et le parking en sous-sol.

**Aucun atlas neuf.** C'est le premier lot d'habillage qui s'en passe, et c'est
volontaire : une carrosserie est un aplat, un vitrage est une bande sombre, un
phare est une bande claire — tout existe déjà dans `trim_hypermarche` et dans
les matériaux peints. Ajouter un atlas pour ça aurait coûté seize cases pour
trois aplats.

Deux ambiances à tenir, et elles ne ressemblent à rien de ce qui précède :

- **la réserve** est haute (8 m), en béton, éclairée par des suspensions
  industrielles isolées et non par un plafond de néons. Ses racks de 6 m sont
  le seul vrai couvert du niveau (ADR 0025) ;
- **le souterrain** est bas (3,5 m), sombre, et sa portée de vue est coupée en
  permanence par des piliers tous les 8 m. Le plan lui demande de la tension,
  pas de la lisibilité.
"""

from __future__ import annotations

import random

import lib_helpers as H
from lib_rayons import asset_coll

# Carrosseries disponibles. Trois teintes seulement, et c'est assez : un parking
# de 1995 n'est pas un nuancier, et à 640×360 c'est la SILHOUETTE qui distingue
# deux voitures, pas leur peinture.
CARROSSERIES = ("metal_peint_rouge", "mur_platre", "metal_bac_acier", "mur_platre_use")


# --- Réserve -----------------------------------------------------------------

def rack_palettes(longueur: float = 4.0, hauteur: float = 6.0, seed: int = 0) -> str:
    """Rack à palettes chargé : échelles, lisses, palettes et cartons.

    C'est le seul vrai couvert du niveau — 6 m de haut, très au-dessus des
    1,60 m des yeux, donc un Costard posté derrière reste `idle` (ADR 0025). Le
    collider couvre TOUTE l'emprise, y compris les niveaux vides : un rack à
    moitié plein dont on pourrait traverser le haut serait un piège de
    lisibilité.
    """
    name = f"str_rack_{longueur:g}m_{hauteur:g}m_{seed}".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr = longueur, 1.5
    rng = random.Random(seed or 11)
    niveaux = [0.15 + i * 1.85 for i in range(int((hauteur - 0.4) // 1.85) + 1)]

    # Échelles d'extrémité, en profilé : deux montants et leurs diagonales.
    acier = []
    for x in (0.0, lo - 0.12):
        for y in (0.0, pr - 0.12):
            acier.append(((x, y, 0, x + 0.12, y + 0.12, hauteur), "world"))
    for z in niveaux:
        acier.append(((0, 0, z, lo, 0.10, z + 0.14), "world"))
        acier.append(((0, pr - 0.10, z, lo, pr, z + 0.14), "world"))
    H.boxes(f"{name}_acier", acier, "metal_peint_rouge", coll)
    H.box(f"{name}_pied", (0, 0, 0, lo, pr, 0.18),
          "trim_hypermarche", coll, uv="trim:bord_quai")

    # Chargement : une palette par emplacement, parfois vide. Un rack plein à
    # 100 % se lit comme un mur ; c'est le désordre qui dit « réserve ».
    bois, cartons = [], []
    for z in niveaux:
        x = 0.14
        while x < lo - 1.10:
            if rng.random() < 0.22:                      # emplacement vide
                x += 1.10 + rng.uniform(0.05, 0.25)
                continue
            bois.append(((x, 0.12, z + 0.14, x + 1.00, pr - 0.12, z + 0.28), "world"))
            hc = rng.uniform(0.55, 1.25)
            marge = rng.uniform(0.02, 0.10)
            cartons.append(((x + marge, 0.16, z + 0.28,
                             x + 1.00 - marge, pr - 0.16, z + 0.28 + hc), "world"))
            x += 1.00 + rng.uniform(0.08, 0.22)
    H.boxes(f"{name}_palettes", bois, "bois_palette", coll)
    H.boxes(f"{name}_cartons", cartons, "carton", coll, subdiv=0.6)

    H.col_box(name[4:], (0, 0, 0, lo, pr, hauteur), coll)
    return name


def porte_quai(largeur: float = 3.0) -> str:
    """Porte de quai à rideau métallique, avec son tablier et ses butoirs.

    Se plaque contre un mur : sa profondeur est de 0,30 m, dont 0,10 de rideau.
    Pas de collider — elle est déjà dans l'épaisseur d'un mur qui en a un.
    """
    name = f"str_porte_quai_{largeur:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    lo, ht = largeur, 3.60
    H.box(f"{name}_rideau", (0.16, 0.20, 0.10, lo - 0.16, 0.30, ht - 0.30),
          "metal_tole_perforee", coll, subdiv=0.6)
    cadre = [((0, 0.18, 0, 0.16, 0.32, ht), "world"),
             ((lo - 0.16, 0.18, 0, lo, 0.32, ht), "world"),
             ((0, 0.18, ht - 0.30, lo, 0.32, ht), "world")]
    H.boxes(f"{name}_cadre", cadre, "metal_bac_acier", coll)
    H.box(f"{name}_seuil", (0, 0.14, 0, lo, 0.32, 0.10),
          "trim_hypermarche", coll, uv="trim:bord_quai")
    # Butoirs de caoutchouc : le détail qui date un quai de déchargement.
    butoirs = [((0.30, 0.10, 1.00, 0.70, 0.20, 1.60), "world"),
               ((lo - 0.70, 0.10, 1.00, lo - 0.30, 0.20, 1.60), "world")]
    H.boxes(f"{name}_butoirs", butoirs, "trim_hypermarche", coll)
    return name


def transpalette() -> str:
    """Transpalette abandonné au milieu d'une allée de réserve."""
    name = "deco_transpalette"
    coll, done = asset_coll(name)
    if done:
        return name
    H.boxes(f"{name}_fourches", [
        ((0, 0, 0.04, 0.16, 1.15, 0.12), "world"),
        ((0.38, 0, 0.04, 0.54, 1.15, 0.12), "world"),
        ((0, 1.15, 0.04, 0.54, 1.32, 0.22), "world"),
    ], "metal_bandes_danger", coll)
    H.boxes(f"{name}_timon", [
        ((0.20, 1.20, 0.22, 0.34, 1.30, 1.05), "world"),
        ((0.06, 1.18, 1.05, 0.48, 1.32, 1.16), "world"),
    ], "metal_bac_acier", coll)
    H.col_box(name[5:], (0, 0, 0, 0.54, 1.32, 1.16), coll)
    return name


def fut(seed: int = 0) -> str:
    """Fût de 200 litres. Cylindrique : c'est la seule silhouette ronde de la
    réserve, et elle tranche sur des racks qui ne sont que des angles droits."""
    name = f"deco_fut_{seed}"
    coll, done = asset_coll(name)
    if done:
        return name
    H.cylinder(f"{name}_corps", (0.29, 0.29), 0.29, 0.0, 0.88, "metal_bandes_danger", coll)
    H.cylinder(f"{name}_couvercle", (0.29, 0.29), 0.31, 0.84, 0.90, "metal_bac_acier", coll)
    H.col_box(name[5:], (0, 0, 0, 0.58, 0.58, 0.90), coll)
    return name


def suspension(seed: int = 0) -> str:
    """Suspension industrielle : un réflecteur au bout d'une tige.

    Un plafond de néons encastrés n'existe pas sous 8 m de hauteur ; ce qui
    éclaire une réserve, ce sont des luminaires suspendus, isolés, et qui
    laissent des trous d'ombre entre eux. Le tube porte le marqueur `_neon`
    (voir `lib_rayons.neon`) : sans lui, une source ressort noire au bake.
    """
    name = f"str_suspension_{seed}"
    coll, done = asset_coll(name)
    if done:
        return name
    H.box(f"{name}_tige", (0.26, 0.26, 0.40, 0.34, 0.34, 2.40), "metal_bac_acier", coll)
    H.cylinder(f"{name}_reflecteur", (0.30, 0.30), 0.42, 0.10, 0.44,
               "metal_bac_acier", coll, segments=8)
    H.cylinder(f"{name}_neon", (0.30, 0.30), 0.26, 0.02, 0.12, "mur_platre", coll, segments=8)
    return name


# --- Parking souterrain ------------------------------------------------------

def voiture(carrosserie: str, seed: int = 0) -> str:
    """Voiture à l'arrêt, 4,00 × 1,90 × 1,45 m.

    Construite en six volumes : capot, coffre, habitacle, vitrages, pare-chocs,
    roues. Le vitrage est une bande de caoutchouc sombre et les phares une
    bande claire — aucun atlas dédié, et à 640×360 la différence ne se voit
    pas. Le museau est en `-y` : posée à `rot 0`, la voiture regarde le sud.
    """
    name = f"veh_auto_{carrosserie}_{seed}".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    lo, la, ht = 4.00, 1.90, 1.45
    bas, toit = 0.34, ht

    caisse = [((0.10, 0.0, bas, lo - 0.10, la, 0.86), "world"),          # bas de caisse
              ((1.10, 0.06, 0.86, 2.95, la - 0.06, toit), "world")]      # pavillon
    H.boxes(f"{name}_caisse", caisse, carrosserie, coll, subdiv=0.7)

    # Vitrages : pare-brise incliné impossible en boîtes, donc une ceinture
    # vitrée continue — ce que lit l'œil de toute façon à cette résolution.
    vitres = [((1.04, 0.02, 0.92, 1.14, la - 0.02, toit - 0.08), "trim:joint_caoutchouc"),
              ((2.91, 0.02, 0.92, 3.01, la - 0.02, toit - 0.08), "trim:joint_caoutchouc"),
              ((1.14, 0.02, 0.92, 2.91, 0.08, toit - 0.08), "trim:joint_caoutchouc"),
              ((1.14, la - 0.08, 0.92, 2.91, la - 0.02, toit - 0.08), "trim:joint_caoutchouc")]
    H.boxes(f"{name}_vitres", vitres, "trim_hypermarche", coll)

    H.boxes(f"{name}_pare_chocs", [
        ((0.0, 0.04, 0.40, 0.12, la - 0.04, 0.72), "trim:joint_caoutchouc"),
        ((lo - 0.12, 0.04, 0.40, lo, la - 0.04, 0.72), "trim:joint_caoutchouc"),
    ], "trim_hypermarche", coll)
    # Phares avant (bande claire) et feux arrière (rouge peint).
    H.boxes(f"{name}_phares", [
        ((0.02, 0.16, 0.60, 0.06, 0.52, 0.76), "trim:neon"),
        ((0.02, la - 0.52, 0.60, 0.06, la - 0.16, 0.76), "trim:neon"),
    ], "trim_hypermarche", coll)
    H.boxes(f"{name}_feux", [
        ((lo - 0.05, 0.14, 0.62, lo - 0.01, 0.46, 0.80), "world"),
        ((lo - 0.05, la - 0.46, 0.62, lo - 0.01, la - 0.14, 0.80), "world"),
    ], "metal_peint_rouge", coll)

    roues = []
    for x in (0.62, lo - 1.24):
        for y in (-0.04, la - 0.22):
            roues.append(((x, y, 0.0, x + 0.62, y + 0.26, bas + 0.28), "world"))
    H.boxes(f"{name}_roues", roues, "trim_hypermarche", coll)

    H.col_box(name[4:], (0, 0, 0, lo, la, ht), coll)
    return name


def pilier_beton(hauteur: float = 3.5, numero: str | None = None) -> str:
    """Pilier de parking : béton, bandes de danger au pied.

    1 × 1 m, les cotes du volume gris du blockout. Les bandes jaunes ne sont
    pas un ornement — dans une pénombre où la portée de vue est coupée en
    permanence, elles sont ce qui rend un pilier visible avant qu'on s'y cogne.
    """
    name = f"str_pilier_beton_{hauteur:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    H.box(f"{name}_corps", (0, 0, 0, 1.0, 1.0, hauteur), "mur_platre_use", coll, subdiv=0.7)
    H.box(f"{name}_bande", (-0.02, -0.02, 0.35, 1.02, 1.02, 0.85),
          "metal_bandes_danger", coll)
    H.col_box(name[4:], (0, 0, 0, 1.0, 1.0, hauteur), coll)
    return name


def marquage_place(longueur: float = 5.0, largeur: float = 2.50) -> str:
    """Marquage au sol d'une place de stationnement : trois traits peints.

    2 cm au-dessus de la dalle et sans collider — une peinture n'arrête
    personne, et coplanaire avec le sol elle se disputerait le z-buffer.
    """
    name = f"deco_place_{longueur:g}x{largeur:g}".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    t = 0.12
    traits = [((0, 0, 0, t, largeur, 0.02), "world"),
              ((longueur - t, 0, 0, longueur, largeur, 0.02), "world"),
              ((0, 0, 0, longueur, t, 0.02), "world")]
    H.boxes(f"{name}_traits", traits, "mur_platre", coll)
    return name


def extincteur() -> str:
    """Extincteur mural et son panneau. La seule tache de rouge franc du
    souterrain, donc un repère de navigation autant qu'un décor."""
    name = "deco_extincteur"
    coll, done = asset_coll(name)
    if done:
        return name
    H.box(f"{name}_panneau", (0, 0, 0, 0.42, 0.04, 0.60), "metal_peint_rouge", coll)
    H.cylinder(f"{name}_corps", (0.21, 0.13), 0.11, 0.10, 0.62,
               "metal_peint_rouge", coll, segments=8)
    H.box(f"{name}_tete", (0.16, 0.08, 0.62, 0.26, 0.18, 0.72), "metal_bac_acier", coll)
    return name


def build_all() -> list[str]:
    """Construit tout le module. Idempotent, comme les autres bibliothèques."""
    names = [porte_quai(3.0), transpalette(), fut(0), fut(1), suspension(0),
             pilier_beton(3.5), marquage_place(5.0, 2.5), extincteur()]
    names += [rack_palettes(4.0, 6.0, s) for s in (1, 2, 3)]
    names += [voiture(c, i) for i, c in enumerate(CARROSSERIES)]
    return names
