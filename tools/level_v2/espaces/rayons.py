"""Espace « rayons » : gondoles, frais, surgelés, signalisation.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

import math
import random


from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_rayons as L            # noqa: E402
import lib_public_compositions as P# noqa: E402
import plan_de_masse as plan      # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import SEED, _neons, lampe
from espaces.coque import SUBDIV_BAKE
from espaces.props import RY_CARTONS

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
    P.rayons(props)

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
