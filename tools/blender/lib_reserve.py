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

import os
import random

import lib_helpers as H
from lib_rayons import asset_coll

# Kenney Car Kit 3.1, CC0 confirmé et explicitement fléché « voitures des deux
# parkings » dans `assets_src/LICENCES_ASSETS.md`.
#
# Pourquoi CE pack et pas les autres voitures du dépôt : tous ses modèles
# partagent UN SEUL atlas de pastilles unies, donc tout le parc automobile du
# niveau ne coûte qu'un matériau et se fond en un lot au chargement (ADR 0023).
# Le budget sous tension du niveau v2 est le nombre de lots de dessin — un pack
# à vingt textures séparées en coûterait vingt. Les packs `retro3d_car` et
# `quaternius_cars` restent inutilisés : le premier est marqué « à confirmer »
# au registre des licences et ne s'utilise donc pas, le second est en `.blend`
# et n'a pas d'atlas commun.
CAR_GLB = os.path.join(H.ROOT, "assets_src", "cc0_raw", "kenney_car-kit",
                       "Models", "GLB format")

# (modèle, largeur, longueur, hauteur) en mètres RÉELS. Le pack est modélisé à
# des proportions de jouet — une berline mise à 4,40 m de long en fait 2,59 de
# large et 2,24 de HAUT, plus qu'un homme. Chaque axe est donc remis à sa cote,
# ce qui écrase un peu la silhouette mais donne une voiture à la bonne taille ;
# personne n'a l'original sous les yeux pour comparer.
MODELES_VOITURE = (("sedan", 1.82, 4.40, 1.48),
                   ("suv", 1.95, 4.60, 1.78),
                   ("hatchback-sports", 1.76, 4.05, 1.40),
                   ("van", 2.00, 4.90, 2.05),
                   ("taxi", 1.82, 4.40, 1.50),
                   ("sedan-sports", 1.86, 4.30, 1.34),
                   ("suv-luxury", 1.98, 4.80, 1.80),
                   ("delivery", 2.10, 5.20, 2.45))


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
    # Rentré d'un centimètre sous les montants et la première lisse : à leurs
    # cotes, ses quatre faces étaient dans les plans des leurs.
    H.box(f"{name}_pied", (0.01, 0.01, 0, lo - 0.01, pr - 0.01, 0.18),
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

def voiture(modele: str, largeur: float, longueur: float, hauteur: float) -> str:
    """Voiture du Kenney Car Kit, ramenée à une longueur réelle.

    Remplace une voiture montée en boîtes, qui n'avait ni arche de roue, ni
    pare-brise incliné, ni la moindre courbe — et dont la carrosserie texturée
    en plâtre se lisait comme un matelas. Le pack a tout ça pour trois cents
    triangles, et il était dans le dépôt depuis N2.

    Le modèle arrive avec sa longueur le long de **+Y** (conversion Y-up → Z-up
    de l'import glTF) : une voiture posée à `rot 0` est donc orientée
    nord-sud. Son collider est calculé sur l'encombrement réel après mise à
    l'échelle, jamais sur des cotes recopiées à la main.
    """
    name = f"veh_{modele.replace('-', '_')}"
    coll, done = asset_coll(name)
    if done:
        return name
    obj = H.import_kit(name, os.path.join(CAR_GLB, f"{modele}.glb"),
                       "prd_kenney_car", coll, dimensions=(largeur, longueur, hauteur))
    lx, ly, lz = H.kit_bounds(obj)
    H.col_box(name[4:], (0, 0, 0, lx, ly, lz), coll)
    return name


# Petits accessoires du même pack, donc du MÊME atlas : ils ne coûtent pas un
# matériau de plus. (modèle, largeur, longueur, hauteur).
ACCESSOIRES_CAR_KIT = {
    "cone": (0.40, 0.40, 0.70),
    "box": (0.60, 0.60, 0.55),
    "debris-tire": (0.68, 0.24, 0.68),
}


def accessoire_car_kit(modele: str) -> str:
    """Cône, caisse ou pneu abandonné, pris dans le Kenney Car Kit.

    Même atlas que les voitures : semer une douzaine de ces objets ne coûte
    donc aucun lot de dessin supplémentaire. C'est exactement le genre de
    détail qui fait qu'un parking a l'air utilisé plutôt que construit.
    """
    name = f"veh_acc_{modele.replace('-', '_')}"
    coll, done = asset_coll(name)
    if done:
        return name
    obj = H.import_kit(name, os.path.join(CAR_GLB, f"{modele}.glb"),
                       "prd_kenney_car", coll, dimensions=ACCESSOIRES_CAR_KIT[modele])
    lx, ly, lz = H.kit_bounds(obj)
    H.col_box(name[4:], (0, 0, 0, lx, ly, lz), coll)
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


# --- Parking extérieur -------------------------------------------------------

def lampadaire(hauteur: float = 5.0) -> str:
    """Mât d'éclairage de parking : fût, crosse, projecteur.

    Le parking est le SEUL espace à ciel ouvert du niveau, donc le seul sans
    plafond où accrocher des néons. Et comme le niveau tourne en `hybride`
    (ambiante 0,18, pas de soleil), il n'y a pas de lumière du jour : c'est un
    parking de nuit, éclairé par ses mâts et rien d'autre. Un choix assumé —
    c'est aussi une bien meilleure entrée en matière qu'un plein soleil.

    La tête porte le marqueur `_neon` : sans lui, une source ressort noire dans
    un bake de lumière seule.
    """
    name = f"str_lampadaire_{hauteur:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    H.box(f"{name}_socle", (0, 0, 0, 0.52, 0.52, 0.30), "mur_platre_use", coll)
    H.box(f"{name}_fut", (0.16, 0.16, 0.30, 0.36, 0.36, hauteur), "metal_bac_acier", coll)
    H.box(f"{name}_crosse", (0.16, 0.36, hauteur - 0.22, 0.36, 1.30, hauteur), "metal_bac_acier", coll)
    H.box(f"{name}_capot", (0.02, 1.05, hauteur - 0.34, 0.50, 1.85, hauteur - 0.22),
          "metal_bac_acier", coll)
    H.box(f"{name}_neon", (0.06, 1.10, hauteur - 0.40, 0.46, 1.80, hauteur - 0.34),
          "mur_platre", coll)
    H.col_box(name[4:], (0, 0, 0, 0.52, 0.52, hauteur), coll)
    return name


def abri_caddies(longueur: float = 6.0) -> str:
    """Abri à caddies : quatre poteaux, une couverture, un rail au sol.

    6 × 4 × 2,50 m, les cotes du volume gris du blockout — mais OUVERT, alors
    que le blockout en faisait un bloc plein. C'est voulu : un abri qu'on peut
    traverser est un couvert partiel, ce qui vaut mieux qu'un mur de plus sur un
    parking dont le plan dit qu'il est un tutoriel, pas un combat. Seuls les
    poteaux ont un collider.
    """
    name = f"str_abri_caddies_{longueur:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr, ht = longueur, 4.0, 2.50
    poteaux = []
    for x in (0.0, lo - 0.16):
        for y in (0.0, pr - 0.16):
            poteaux.append(((x, y, 0, x + 0.16, y + 0.16, ht), "world"))
    H.boxes(f"{name}_poteaux", poteaux, "metal_bac_acier", coll)
    for i, (x, y) in enumerate(((0.0, 0.0), (lo - 0.16, 0.0),
                                (0.0, pr - 0.16), (lo - 0.16, pr - 0.16))):
        H.col_box(f"{name[4:]}_p{i}", (x, y, 0, x + 0.16, y + 0.16, ht), coll)
    H.box(f"{name}_couverture", (-0.25, -0.25, ht, lo + 0.25, pr + 0.25, ht + 0.16),
          "metal_tole_perforee", coll, subdiv=0.8)
    H.box(f"{name}_bandeau", (-0.25, -0.28, ht - 0.06, lo + 0.25, -0.25, ht + 0.16),
          "metal_bandes_danger", coll)
    H.box(f"{name}_rail", (0.60, pr / 2 - 0.04, 0, lo - 0.60, pr / 2 + 0.04, 0.30),
          "metal_bac_acier", coll)
    return name


def build_all() -> list[str]:
    """Construit tout le module. Idempotent, comme les autres bibliothèques."""
    names = [porte_quai(3.0), transpalette(), fut(0), fut(1), suspension(0),
             pilier_beton(3.5), marquage_place(5.0, 2.5), extincteur(),
             lampadaire(5.0), abri_caddies(6.0)]
    names += [rack_palettes(4.0, 6.0, s) for s in (1, 2, 3)]
    names += [voiture(*m) for m in MODELES_VOITURE]
    names += [accessoire_car_kit(a) for a in ACCESSOIRES_CAR_KIT]
    return names
