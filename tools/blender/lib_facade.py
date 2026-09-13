"""
Bibliothèque de l'avant-magasin et de la galerie — niveau v2, jalon N9.

Second module de la bibliothèque, après `lib_rayons.py`. La coupure n'est pas
arbitraire : `lib_rayons` meuble une SURFACE DE VENTE (gondoles, produits,
bandeaux de catégorie), celui-ci meuble ce qu'on traverse avant d'y entrer —
la ligne de caisses, les portiques, les kiosques de galerie, et les deux
machines « signature » du plan d'origine.

Mêmes conventions que `lib_rayons`, dont il réutilise `asset_coll` et `place` :
géométrie en boîtes à 64 px/m, transform figée dans le mesh à la pose, un
`col_box_*` par asset solide, et rien de transparent (invariant #5, tout est
`MeshLambertMaterial`). Les enseignes viennent de l'atlas `sig_facade`
(`tools/textures/generate_facade.py`).

Une absence assumée : **pas de plante verte**. Une galerie marchande en réclame,
mais aucune texture du projet ne porte de feuillage et en inventer une est un
travail de charte (N3), pas de meuble. Bancs, corbeilles et panneaux tiennent
le rôle en attendant.
"""

from __future__ import annotations

import random

import lib_helpers as H
from lib_rayons import Garnissage, asset_coll, stock_shelf

# --- Ligne de caisses --------------------------------------------------------

# Emprise d'une caisse, reprise TELLE QUELLE du blockout validé : 4 × 1,5 m au
# sol, collider à 1,10 m. Cette hauteur est un choix de game design, pas un
# détail de modèle — sous les 1,60 m des yeux, donc la ligne de caisses est un
# obstacle de DÉPLACEMENT et ne coupe aucune ligne de vue (note du plan de
# masse sur l'espace `caisses`).
CAISSE_L, CAISSE_P, CAISSE_H = 4.0, 1.5, 1.10


def caisse() -> str:
    """Caisse enregistreuse : socle, tapis, poste, écran, et son panneau
    lumineux sur mât.

    Le mât monte à 2,65 m et n'a PAS de collider : il doit rester au-dessus de
    la tête sans jamais devenir un obstacle, et au-dessus de 1,60 m il ne
    coupe de toute façon aucun rayon de vision.
    """
    name = "mob_caisse"
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr = CAISSE_L, CAISSE_P

    H.boxes(f"{name}_socle", [
        ((0, 0, 0, lo, pr, 0.15), "trim:plinthe"),
        # Bourrelet de protection sur la tranche client : une caisse prend des
        # coups de caddie toute la journée, et c'est ce qui la date.
        ((0, -0.03, 0.60, lo, 0.03, 0.78), "trim:joint_caoutchouc"),
    ], "trim_hypermarche", coll)

    acier = [((0, 0, 0.15, lo, pr, 0.85), "world"),
             # Poste de l'hôte de caisse, au bout de la travée.
             ((lo - 1.0, 0.20, 0.85, lo - 0.10, pr - 0.20, 1.25), "world")]
    H.boxes(f"{name}_acier", acier, "metal_bac_acier", coll)

    # Tapis roulant : la seule surface sombre de l'ensemble, donc ce qui donne
    # sa lecture à la caisse de loin.
    H.box(f"{name}_tapis", (0.15, 0.20, 0.85, lo - 1.05, pr - 0.20, 0.92),
          "trim_hypermarche", coll, uv="trim:joint_caoutchouc")
    H.box(f"{name}_ecran", (lo - 0.75, 0.62, 1.25, lo - 0.35, 0.68, 1.58),
          "trim_hypermarche", coll, uv="trim:joint_caoutchouc")
    H.box(f"{name}_separateur", (0.15, 0.24, 0.92, 0.22, pr - 0.24, 1.02),
          "metal_peint_rouge", coll)

    H.box(f"{name}_mat", (lo / 2 - 0.05, pr / 2 - 0.05, 1.25, lo / 2 + 0.05, pr / 2 + 0.05, 2.40),
          "metal_bac_acier", coll)
    # Panneau double face : on entre dans la ligne de caisses par le sud et on
    # en ressort par le nord, il doit se lire des deux côtés.
    # Panneau de 1,00 m : exactement le pas de répétition de la bande `caisse`,
    # donc UN mot entier et non deux moitiés (voir `_uv_enseigne`). Double face —
    # on entre dans la ligne de caisses par le sud et on en ressort par le nord.
    H.boxes(f"{name}_enseigne", [
        ((lo / 2 - 0.50, pr / 2 - 0.06, 2.40, lo / 2 + 0.50, pr / 2 - 0.03, 2.65), "enseigne:caisse"),
        ((lo / 2 - 0.50, pr / 2 + 0.03, 2.40, lo / 2 + 0.50, pr / 2 + 0.06, 2.65), "enseigne:caisse"),
    ], "sig_facade", coll)

    H.col_box(name[4:], (0, 0, 0, lo, pr, CAISSE_H), coll)
    return name


def portique() -> str:
    """Portique antivol : deux montants de 1,80 m, 1,60 m d'écart.

    Solides tous les deux — on passe ENTRE, comme dans un vrai magasin. C'est
    aussi ce qui fait qu'ils se remarquent : un décor qu'on traverse ne se
    remarque pas.
    """
    name = "mob_portique"
    coll, done = asset_coll(name)
    if done:
        return name
    ecart, ep, prof, ht = 1.60, 0.12, 0.45, 1.80
    for i, x in enumerate((0.0, ecart + ep)):
        H.box(f"{name}_montant{i}", (x, 0, 0, x + ep, prof, ht), "mur_platre", coll)
        H.box(f"{name}_bande{i}", (x - 0.01, 0.05, ht - 0.35, x + ep + 0.01, 0.08, ht - 0.10),
              "trim_hypermarche", coll, uv="trim:corniere")
        H.col_box(f"{name[4:]}_m{i}", (x, 0, 0, x + ep, prof, ht), coll)
    return name


def rail_caddies() -> str:
    """File de caddies : le rail bas qui les canalise, sans les caddies.

    Les caddies eux-mêmes sont posés séparément (`lib_rayons.caddie`) : une
    file figée dans un seul asset ne se réarrange pas, et c'est justement
    l'irrégularité de la file qui la rend crédible.
    """
    name = "str_rail_caddies"
    coll, done = asset_coll(name)
    if done:
        return name
    lo, ecart, ht = 5.0, 1.30, 0.35
    barres = []
    for y in (0.0, ecart):
        barres.append(((0, y, ht - 0.06, lo, y + 0.06, ht), "world"))
        for x in (0.0, lo / 2 - 0.03, lo - 0.06):
            barres.append(((x, y, 0, x + 0.06, y + 0.06, ht), "world"))
    H.boxes(f"{name}_barres", barres, "metal_bac_acier", coll)
    return name


# --- Galerie marchande -------------------------------------------------------

KIOSQUE_L, KIOSQUE_P, KIOSQUE_H = 6.0, 4.0, 3.0


# Thème de marchandise par enseigne : un kiosque de presse et un réparateur de
# téléphones ne montrent pas les mêmes silhouettes sur leurs étagères, et c'est
# à ça qu'on les reconnaît de loin avant de lire le bandeau.
THEME_KIOSQUE = {
    "presse_libre": "epicerie",     # piles de formats plats et bariolés
    "clefs_minute": "entretien",    # petits objets sombres alignés
    "desimlock": "entretien",
    "photomaton": "petit_dej",      # cartons clairs
}


def kiosque(enseigne: str, seed: int = 0) -> str:
    """Kiosque de galerie : comptoir en façade, réserve fermée derrière,
    bandeau d'enseigne en fronton.

    Bloc PLEIN de 3 m : c'est le premier vrai couvert du niveau (au-dessus des
    1,60 m des yeux, contrairement à la ligne de caisses), et le plan y pose
    une embuscade par occlusion. On ne rentre donc pas dans un kiosque, on le
    contourne — d'où un unique collider sur toute l'emprise.
    """
    name = f"mob_kiosque_{enseigne}"
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr, ht = KIOSQUE_L, KIOSQUE_P, KIOSQUE_H

    H.box(f"{name}_plinthe", (0, 0, 0, lo, pr, 0.15), "trim_hypermarche", coll, uv="trim:plinthe")
    murs = [((0, pr - 0.30, 0.15, lo, pr, ht), "world"),
            ((0, 0, 0.15, 0.30, pr, ht), "world"),
            ((lo - 0.30, 0, 0.15, lo, pr, ht), "world")]
    H.boxes(f"{name}_murs", murs, "mur_platre", coll, subdiv=0.6)

    # Comptoir de façade, à 1,05 m : la hauteur d'un comptoir, et la seule
    # partie du kiosque que le joueur longe de près.
    H.box(f"{name}_comptoir", (0.30, 0, 0.15, lo - 0.30, 0.80, 1.05), "metal_bac_acier", coll)
    H.box(f"{name}_chant", (0.30, -0.02, 0.97, lo - 0.30, 0.02, 1.05),
          "trim_hypermarche", coll, uv="trim:corniere")
    # Rayonnage du fond, vu par-dessus le comptoir : sans lui le kiosque est
    # une boîte vide avec une enseigne dessus.
    niveaux = (1.20, 1.70, 2.20)
    etageres = [((0.35, pr - 0.75, z, lo - 0.35, pr - 0.32, z + 0.05), "world")
                for z in niveaux]
    H.boxes(f"{name}_etageres", etageres, "metal_tole_perforee", coll)

    # Étagères GARNIES. Une tablette nue se lit comme un rayonnage vide, et
    # c'est exactement ce qu'on voit d'un kiosque : sa marchandise par-dessus
    # le comptoir. Même garnissage que les gondoles (`lib_rayons`), donc même
    # désordre délibéré et même assemblage en un mesh par matériau.
    rng = random.Random(hash((name, seed)) & 0xFFFF)
    g = Garnissage()
    for z in niveaux:
        stock_shelf(g, 0.40, lo - 0.40, pr - 0.70, z + 0.05, -1, rng,
                    max_h=0.40, density=0.75, theme=THEME_KIOSQUE.get(enseigne))
    g.finish(name, coll)

    # Fronton : débord de 8 cm devant la façade, sinon l'enseigne serait
    # coplanaire avec le mur et les deux se disputeraient le z-buffer.
    H.box(f"{name}_fronton", (0, -0.08, 2.35, lo, 0, ht), "metal_peint_rouge", coll)
    H.box(f"{name}_enseigne", (0.25, -0.11, 2.52, lo - 0.25, -0.08, 2.77),
          "sig_facade", coll, uv=f"enseigne:{enseigne}")

    H.col_box(name[4:], (0, 0, 0, lo, pr, ht), coll)
    return name


def enseigne_murale(bande: str, longueur: float = 3.0) -> str:
    """Panneau d'enseigne à plaquer sur un mur ou au-dessus d'une porte.

    Hauteur 0,25 m pour une bande de 16 px : la densité du projet, 64 px/m.
    Même rôle que `lib_rayons.bandeau_rayon` mais sur l'atlas de façade — un
    rayon dit ce qu'on y trouve, une enseigne dit où l'on est.
    """
    name = f"sig_enseigne_{bande}_{longueur:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    H.box(f"{name}_panneau", (0, 0, 0, longueur, 0.08, 0.25),
          "sig_facade", coll, uv=f"enseigne:{bande}")
    return name


DEVANTURE_PROF, DEVANTURE_HT = 0.70, 3.20


def devanture_fermee(longueur: float = 5.0) -> str:
    """Devanture de galerie, rideau de fer BAISSÉ.

    Une galerie marchande a des boutiques sur ses côtés ; sans elles, ses murs
    sont soixante mètres de plâtre nu. Mais les quatre kiosques du plan de masse
    tiennent déjà le rôle des commerces VIVANTS, et en ouvrir huit de plus
    demanderait huit enseignes de plus — l'atlas est plein.

    Fermées, donc. Ce n'est pas un pis-aller : un centre commercial des années
    90 à moitié dévitalisé est exactement le magasin que ce niveau raconte, et
    un rideau de fer est plus éloquent qu'une vitrine de plus. La tôle perforée
    fait le rideau sans un seul triangle de nervure — à 640×360, les trous
    peints dans l'albedo se lisent comme de l'ondulé.

    Profondeur 0,70 m : elle mord sur la circulation validée au blockout, assez
    peu pour ne rien changer à un couloir de 6 m.
    """
    name = f"mob_devanture_fermee_{longueur:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr, ht = longueur, DEVANTURE_PROF, DEVANTURE_HT

    H.box(f"{name}_rideau", (0.25, pr - 0.12, 0.10, lo - 0.25, pr - 0.06, 2.55),
          "metal_tole_perforee", coll, subdiv=0.6)
    # Rail bas : la barre lestée du rideau, la seule pièce qui dit qu'il
    # DESCEND et n'est pas un mur de tôle.
    H.box(f"{name}_barre", (0.25, pr - 0.14, 0.10, lo - 0.25, pr - 0.04, 0.22),
          "metal_bandes_danger", coll)
    tableau = [((0, pr - 0.25, 0, 0.25, pr, ht), "world"),
               ((lo - 0.25, pr - 0.25, 0, lo, pr, ht), "world"),
               ((0, pr - 0.25, 2.55, lo, pr, ht), "world")]
    H.boxes(f"{name}_tableau", tableau, "mur_platre", coll, subdiv=0.6)
    # Bandeau d'enseigne VIDE : le caisson est resté, l'enseigne est partie.
    H.box(f"{name}_caisson", (0.10, pr - 0.32, 2.62, lo - 0.10, pr - 0.25, 3.02),
          "metal_bac_acier", coll)
    H.col_box(name[4:], (0, pr - 0.25, 0, lo, pr, ht), coll)
    return name


def banc() -> str:
    """Banc de galerie. Assise à 0,45 m : franchissable d'un saut (1,10 m),
    donc jamais un piège de circulation."""
    name = "deco_banc"
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr, ht = 1.80, 0.50, 0.45
    H.box(f"{name}_assise", (0, 0, ht - 0.08, lo, pr, ht), "bois_palette", coll)
    pieds = []
    for x in (0.10, lo - 0.22):
        pieds.append(((x, 0.05, 0, x + 0.12, pr - 0.05, ht - 0.08), "world"))
    H.boxes(f"{name}_pieds", pieds, "metal_bac_acier", coll)
    H.col_box(name[5:], (0, 0, 0, lo, pr, ht), coll)
    return name


def verriere(cote: float = 4.0) -> str:
    """Panneau de verrière — la seule lumière naturelle du niveau (note du plan
    de masse sur la galerie).

    Le panneau porte le marqueur `_neon` dans son nom : `bake_vertex_lighting.py`
    remet à blanc la couleur de sommet des objets ainsi marqués, sinon une
    source de lumière ressort noire dans un bake de lumière seule. La lumière
    elle-même vient d'un `light_*` posé dessous par le niveau — c'est lui qui
    éclaire en jeu, pas ce panneau.
    """
    name = f"str_verriere_{cote:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    H.box(f"{name}_neon", (0.12, 0.12, 0, cote - 0.12, cote - 0.12, 0.06), "mur_platre", coll)
    cadre = [((0, 0, 0, cote, 0.12, 0.14), "world"),
             ((0, cote - 0.12, 0, cote, cote, 0.14), "world"),
             ((0, 0.12, 0, 0.12, cote - 0.12, 0.14), "world"),
             ((cote - 0.12, 0.12, 0, cote, cote - 0.12, 0.14), "world")]
    # Meneaux : sans eux, une verrière de 4 m est un rectangle blanc.
    for t in (1 / 3, 2 / 3):
        cadre.append(((0.12, cote * t - 0.04, 0, cote - 0.12, cote * t + 0.04, 0.10), "world"))
    H.boxes(f"{name}_cadre", cadre, "metal_bac_acier", coll)
    return name


# --- Machines « signature » du plan d'origine --------------------------------


def photomaton() -> str:
    """Photomaton. Le plan de masse pose le secret 1 derrière lui."""
    name = "gp_photomaton"
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr, ht = 1.20, 1.40, 2.20
    caisson = [((0, 0.10, 0, lo, pr, ht), "world")]
    H.boxes(f"{name}_caisson", caisson, "mur_platre", coll, subdiv=0.6)
    # Rideau : le rouge est ce qui fait reconnaître un photomaton de loin.
    H.box(f"{name}_rideau", (0.06, 0.02, 0.35, lo - 0.06, 0.12, 1.95), "metal_peint_rouge", coll)
    H.box(f"{name}_fente", (lo - 0.45, 0, 1.05, lo - 0.15, 0.03, 1.20),
          "trim_hypermarche", coll, uv="trim:joint_caoutchouc")
    H.box(f"{name}_enseigne", (0.05, -0.03, 1.95, lo - 0.05, 0.01, 2.20),
          "sig_facade", coll, uv="enseigne:photomaton")
    H.col_box(name[3:], (0, 0, 0, lo, pr, ht), coll)
    return name


def machine_pinces() -> str:
    """Machine à pinces — le « secret dérisoire » de la liste d'origine.

    Pas de vitre : rien de transparent n'existe en `MeshLambertMaterial`
    (invariant #5). La cage est donc ouverte sur ses montants, et c'est le tas
    de peluches à l'intérieur qui la rend lisible.
    """
    name = "gp_machine_pinces"
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr, ht = 1.00, 1.00, 1.90
    H.box(f"{name}_socle", (0, 0, 0, lo, pr, 0.80), "metal_peint_rouge", coll)
    montants = [((0, 0, 0.80, 0.07, pr, ht), "world"),
                ((lo - 0.07, 0, 0.80, lo, pr, ht), "world"),
                ((0, pr - 0.07, 0.80, lo, pr, ht), "world"),
                ((0, 0, ht - 0.10, lo, pr, ht), "world"),
                ((0, 0, 0.80, lo, pr, 0.86), "world")]
    H.boxes(f"{name}_cage", montants, "metal_bac_acier", coll)
    # Le tas de lots : quatre blocs d'étiquettes, assez pour une silhouette
    # bariolée derrière les montants.
    lots = [((0.12, 0.15, 0.86, 0.42, 0.45, 1.12), "label:chips_illumi", "-y"),
            ((0.46, 0.30, 0.86, 0.76, 0.60, 1.16), "label:sables_reptiliens", "-y"),
            ((0.20, 0.50, 0.86, 0.50, 0.80, 1.10), "label:piles_lune_truquee", "-y"),
            ((0.55, 0.12, 0.86, 0.85, 0.42, 1.08), "label:cafe_reveille", "-y")]
    H.boxes(f"{name}_lots", lots, "prd_etiquettes", coll)
    H.box(f"{name}_pince", (0.42, 0.42, 1.45, 0.58, 0.58, ht - 0.10), "metal_bac_acier", coll)
    H.col_box(name[3:], (0, 0, 0, lo, pr, ht), coll)
    return name


# --- Construction ------------------------------------------------------------

# Enseignes de kiosque disponibles dans `sig_facade`.
ENSEIGNES_KIOSQUE = ("presse_libre", "clefs_minute", "desimlock", "photomaton")


def build_all() -> list[str]:
    """Construit tout le module. Idempotent, comme `lib_rayons.build_all`."""
    names = [caisse(), portique(), rail_caddies(), banc(), verriere(4.0),
             photomaton(), machine_pinces(), devanture_fermee(5.0)]
    names += [kiosque(e) for e in ENSEIGNES_KIOSQUE]
    names += [enseigne_murale(b) for b in ("sortie", "soldes", "bienvenue")]
    return names
