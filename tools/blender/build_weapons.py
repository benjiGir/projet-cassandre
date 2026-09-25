"""
Armes du joueur en vue subjective — PROJET_CASSANDRE.

    blender -b --factory-startup -P tools/blender/build_weapons.py

Construit le pied-de-biche et le fusil à pompe par code, y pose les avant-bras
du « Man in Long Sleeves » CC0 de Quaternius (voir
`assets_src/LICENCES_ASSETS.md`), et exporte `public/assets/weapons/armes.glb` :

    vm_crowbar        pied-de-biche + avant-bras droit
    vm_pistol         pistolet + avant-bras droit
    vm_shotgun        pompe (carcasse, canon) + avant-bras droit
      vm_shotgun_pump   fût mobile + avant-bras gauche (glisse au pompage)
    world_crowbar     pied-de-biche seul, à poser au sol
    world_pistol      pistolet seul
    world_shotgun     pompe seule, fût compris

Les `vm_*` sont exprimés dans le REPÈRE DE L'ŒIL : origine à la caméra, X à
droite, Y devant, Z en haut dans Blender — soit, après la conversion glTF,
exactement le repère local de la caméra three.js (-Z devant). Le jeu les
accroche à la caméra sans décalage ; placer l'arme à l'écran se règle ICI,
en regardant `renders/armes/*.png`, jamais par des constantes en TypeScript.

Les couleurs sont portées par les sommets (un seul matériau par mesh, donc un
seul lot de dessin), en aplats par face : le rendu 640×360 fait le reste.

Options :
    --out FICHIER      défaut : public/assets/weapons/armes.glb
    --renders DIR      vues de contrôle depuis l'œil (défaut : renders/armes)

Code retour : 0 = export écrit, 1 = échec.
"""

from __future__ import annotations

import math
import os
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

SOURCE = "assets_src/cc0_raw/quaternius_man_long_sleeves/man_long_sleeves.glb"
# Gabarit des BRAS, pas du héros : à 1,80 m, un bras de 56 cm ne peut pas tenir
# le fût d'une pompe posée dans le champ. Tous les viewmodels trichent ainsi,
# et des mains plus grandes se lisent mieux à 640×360.
GABARIT_BRAS = 2.20

# Champ de vision vertical et proportions du jeu (`moveConfig.fovBase`, 640×360).
FOV_VERTICAL_DEG = 75
RENDU_W, RENDU_H = 640, 360

PALETTE = {
    "rouge": "#b52a1f",
    "acier_sombre": "#2c2e33",
    "acier": "#4b4f57",
    "acier_clair": "#7b808a",
    "bois": "#7a4722",
    "bois_sombre": "#5a3318",
    "scotch": "#1c1c1f",
    # Le sweat du héros : vert kaki d'origine du modèle, un peu relevé pour
    # rester lisible sous un néon.
    "manche": "#4a5a33",
    "poignet": "#3b4829",
    "peau": "#c89a78",
    # Pistolet (docs/assets/board-pistolet.md section 3.7) : inox clair sur
    # carcasse noire, trois valeurs d'inox pour peindre l'éclairage à la
    # manière du Build. `acier_bleui` reprend `acier_sombre` (même hex,
    # #2c2e33) : c'est la même famille de teinte, pas une nouvelle couleur.
    "inox_clair": "#d4d7dc",
    "inox": "#a2a7b0",
    "inox_ombre": "#6e737c",
    "acier_bleui": "#2c2e33",
    "carcasse": "#3b3d44",
    "plaquettes": "#25262a",
    "point": "#f3f0e6",
}

# Placement des armes dans le repère de l'œil (mètres, X droite, Y devant,
# Z haut) : le point où se referme la main droite. C'est ICI qu'on règle la
# place de l'arme à l'écran.
PRISE_PDB = (0.27, 0.40, -0.26)
AXE_PDB = (-0.15, 0.90, 0.60)          # la barre pointe devant, le col s'arrête sous le réticule
PRISE_POMPE = (0.21, 0.30, -0.25)
AXE_CANON = (-0.06, 1.0, 0.07)         # presque droit devant : on voit le flanc gauche
# Board de références (docs/assets/board-pistolet.md, section 3.3) : la
# culasse descend d'environ 3,4 cm à prise égale par rapport à l'ancien
# modèle (dessus à +0,085 contre +0,119) — la prise recule et descend pour
# garder le bout du canon au même endroit à l'écran.
PRISE_PISTOLET = (0.16, 0.30, -0.20)
AXE_PISTOLET = (-0.07, 1.0, 0.10)      # plus relevé que le pompe : une arme de poing se tient haut
# Un vrai pistolet (22 cm) tenu à bout de bras ne couvre presque rien de
# l'écran : agrandi comme les bras le sont déjà (`GABARIT_BRAS`), il retrouve
# le poids visuel du pompe. Le modèle au sol, lui, garde sa vraie taille.
ECHELLE_PISTOLET_VM = 1.25
# Bout du canon dans le repère de l'arme (origine au milieu de la poignée,
# +Y vers la bouche, +Z en haut) — board section 3.3. Utilisé à la fois pour
# construire le canon et pour poser l'extra `bout_canon` : un seul endroit à
# changer si la cote bouge.
BOUT_CANON_PISTOLET = (0.0, 0.141, 0.077)

# Os gardés pour un avant-bras : le coude est coupé, hors champ.
OS_AVANT_BRAS = ("LowerArm", "Palm", "MiddleHand", "Fingers", "Thumb1", "Thumb2")


def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg_value(args, flag, default):
    return args[args.index(flag) + 1] if flag in args else default


def srgb_lineaire(h: str) -> tuple[float, float, float, float]:
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (lin[0], lin[1], lin[2], 1.0)


# --- Géométrie par code ------------------------------------------------------


def nouveau_mesh(nom: str, bm: bmesh.types.BMesh, couleur: str) -> bpy.types.Object:
    """Mesh plat (normales par face) dont TOUTES les faces portent `couleur`
    en attribut de coin `Col`."""
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    teindre(me, couleur)
    ob = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def teindre(me: bpy.types.Mesh, couleur: str):
    attr = me.color_attributes.get("Col") or me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    rgba = srgb_lineaire(couleur)
    for d in attr.data:
        d.color = rgba
    me.color_attributes.active_color = attr


def pave(nom: str, centre, taille, couleur: str) -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(taille), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(centre), verts=bm.verts)
    return nouveau_mesh(nom, bm, couleur)


def tube(nom: str, debut, fin, rayon: float, couleur: str, cotes: int = 6) -> bpy.types.Object:
    """Cylindre à `cotes` faces entre deux points — 6 suffisent à 640×360."""
    a, b = Vector(debut), Vector(fin)
    axe = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=cotes, radius1=rayon, radius2=rayon, depth=axe.length)
    rot = Vector((0, 0, 1)).rotation_difference(axe.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=bm.verts)
    return nouveau_mesh(nom, bm, couleur)


def balayage(nom: str, chemin: list[Vector], largeur: float, epaisseur: float, couleur: str,
             normale=Vector((1, 0, 0))) -> bpy.types.Object:
    """Section rectangulaire balayée le long d'un chemin plan (normale fixe)."""
    bm = bmesh.new()
    anneaux = []
    for i, p in enumerate(chemin):
        t = (chemin[min(i + 1, len(chemin) - 1)] - chemin[max(i - 1, 0)]).normalized()
        cote = normale.cross(t).normalized()
        n = normale
        coins = [p + n * (largeur / 2) * sx + cote * (epaisseur / 2) * sy for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
        anneaux.append([bm.verts.new(c) for c in coins])
    for r0, r1 in zip(anneaux, anneaux[1:]):
        for k in range(4):
            bm.faces.new((r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k]))
    bm.faces.new(list(reversed(anneaux[0])))
    bm.faces.new(anneaux[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return nouveau_mesh(nom, bm, couleur)


def colorer_faces(me: bpy.types.Mesh, couleurs: list[str]):
    """Une couleur hex par polygone, même ordre que `me.polygons` (donc même
    ordre que les `bm.faces.new(...)` qui ont produit le mesh)."""
    attr = me.color_attributes.get("Col") or me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for p, couleur in zip(me.polygons, couleurs):
        rgba = srgb_lineaire(couleur)
        for li in p.loop_indices:
            attr.data[li].color = rgba
    me.color_attributes.active_color = attr


def prisme(nom: str, y0: float, y1: float, profil: list[tuple[float, float]], couleurs: list[str]) -> bpy.types.Object:
    """Prisme à profil polygonal (X, Z) constant, balayé le long de Y entre
    `y0` et `y1`, avec deux capuchons. `couleurs` : une couleur par face
    latérale (face i entre `profil[i]` et `profil[i+1]`), puis le capuchon de
    `y0` et celui de `y1` — `len(profil) + 2` couleurs."""
    n = len(profil)
    bm = bmesh.new()
    a0 = [bm.verts.new((x, y0, z)) for x, z in profil]
    a1 = [bm.verts.new((x, y1, z)) for x, z in profil]
    for k in range(n):
        bm.faces.new((a0[k], a0[(k + 1) % n], a1[(k + 1) % n], a1[k]))
    bm.faces.new(list(reversed(a0)))
    bm.faces.new(a1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    colorer_faces(me, couleurs)
    ob = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def fusionner(nom: str, pieces: list[bpy.types.Object]) -> bpy.types.Object:
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for p in pieces:
        p.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    pieces[0].name = nom
    pieces[0].data.name = nom
    return pieces[0]


def construire_pied_de_biche() -> bpy.types.Object:
    """Repère de l'outil : la barre monte le long de +Y, origine au milieu du
    poing, col de cygne et pied de biche en haut, biseau en bas."""
    pieces = []
    bas, haut = -0.15, 0.30
    # Biseau : 12 cm coudés de 15° vers l'avant (+Z), comme le vrai.
    coude = math.radians(15)
    chemin_bas = [Vector((0, bas - 0.10 * math.cos(coude), 0.10 * math.sin(coude))), Vector((0, bas, 0))]
    pieces.append(balayage("pdb_biseau", chemin_bas + [Vector((0, bas + 0.04, 0))], 0.024, 0.010, PALETTE["acier_sombre"]))
    pieces.append(balayage("pdb_barre", [Vector((0, bas + 0.03, 0)), Vector((0, haut, 0))], 0.024, 0.024, PALETTE["rouge"]))
    # Col de cygne : demi-tour de 6 cm de rayon vers l'avant (+Z).
    r = 0.06
    arc = [Vector((0, haut + r * math.sin(a), r - r * math.cos(a))) for a in [i * math.pi / 8 for i in range(9)]]
    pieces.append(balayage("pdb_col", arc, 0.024, 0.024, PALETTE["rouge"]))
    # Pied de biche : la griffe revient vers le bas, aplatie et fendue.
    griffe = [Vector((0, haut, 2 * r)), Vector((0, haut - 0.07, 2 * r + 0.012))]
    for dx in (-0.007, 0.007):
        g = balayage("pdb_griffe", [p + Vector((dx, 0, 0)) for p in griffe], 0.009, 0.012, PALETTE["acier_sombre"])
        pieces.append(g)
    # Scotch noir sous le poing : lit la main même quand la barre est de profil.
    pieces.append(balayage("pdb_scotch", [Vector((0, -0.07, 0)), Vector((0, 0.07, 0))], 0.028, 0.028, PALETTE["scotch"]))
    return fusionner("pied_de_biche", pieces)


def construire_pistolet(vue_subjective: bool = False) -> bpy.types.Object:
    """Repère de l'arme : canon vers +Y, Z en haut, origine au milieu de la
    poignée (là où se referme le poing). Beretta 92FS deux tons, gabarit
    compact — cotes et priorités de silhouette dans
    `docs/assets/board-pistolet.md`.

    `vue_subjective` applique les trois exagérations de la section 3.2 (le
    modèle au sol garde ses vraies cotes, `1,0` partout) : la CULASSE
    (glissière, rails, canon, leviers) est élargie ×1,2 en largeur et hauteur
    AUTOUR DE L'AXE DU CANON (les longueurs, le long de Y, ne bougent pas),
    le CHIEN ×1,3, et les points de visée ×2. Toutes trois sont injectées
    directement dans les formules de coordonnées ci-dessous plutôt
    qu'appliquées après coup : un poste comme les leviers, ancré sur le flanc
    de la culasse, reste ainsi collé à la surface qu'il touche quelle que
    soit l'échelle.
    """
    pieces = []
    ech_culasse = 1.2 if vue_subjective else 1.0
    ech_chien = 1.3 if vue_subjective else 1.0
    ech_visee = 2.0 if vue_subjective else 1.0

    # --- Culasse : profil hexagonal (chanfreins de 3 mm sur les deux arêtes
    # hautes — silhouette priorité 1), élargi autour de l'axe du canon. ------
    axe_canon_z = 0.077
    demi_largeur = 0.014 * ech_culasse
    z_bas = axe_canon_z - (axe_canon_z - 0.061) * ech_culasse
    z_haut = axe_canon_z + (0.085 - axe_canon_z) * ech_culasse
    chanfrein = 0.003 * ech_culasse
    profil_culasse = [
        (-demi_largeur, z_bas),
        (demi_largeur, z_bas),
        (demi_largeur, z_haut - chanfrein),
        (demi_largeur - chanfrein, z_haut),
        (-(demi_largeur - chanfrein), z_haut),
        (-demi_largeur, z_haut - chanfrein),
    ]
    # k : 0 dessous (jamais vu), 1 flanc droit, 2 chanfrein droit, 3 dessus,
    # 4 chanfrein gauche, 5 flanc gauche (section 3.4 : le liseré clair du
    # dessus est LA signature de la culasse).
    couleur_defaut = {
        0: PALETTE["carcasse"], 2: PALETTE["inox_clair"], 3: PALETTE["inox_clair"], 4: PALETTE["inox_clair"],
    }

    # Bloc arrière (plein), Y [-0,037 ; +0,037] : flancs subdivisés en 5
    # bandes pour les stries (section 3.8 : 3 claires, 2 sombres, 7 mm
    # chacune), en dehors desquelles ils restent en `inox` uni. Une DÉCOUPE
    # DE FACE, pas un relief : aucun chevauchement, aucun z-fighting.
    y0_arriere, y1_arriere = -0.037, 0.037
    y_stries0, y_stries1, n_bandes = -0.033, 0.002, 5
    bornes = [y0_arriere]
    if y_stries0 > bornes[0]:
        bornes.append(y_stries0)
    pas = (y_stries1 - y_stries0) / n_bandes
    bandes = ["clair" if i % 2 == 0 else "sombre" for i in range(n_bandes)]
    for i in range(n_bandes):
        bornes.append(y_stries0 + pas * (i + 1))
    if y1_arriere > bornes[-1]:
        bornes.append(y1_arriere)
    segments = list(zip(bornes[:-1], bornes[1:]))
    etiquettes, i_bande = [], 0
    for a, b in segments:
        if a >= y_stries0 - 1e-6 and b <= y_stries1 + 1e-6 and i_bande < n_bandes:
            etiquettes.append(bandes[i_bande])
            i_bande += 1
        else:
            etiquettes.append("plain")
    couleur_flanc = {"plain": PALETTE["inox"], "clair": PALETTE["inox"], "sombre": PALETTE["inox_ombre"]}

    bm = bmesh.new()
    anneaux = [[bm.verts.new((x, y, z)) for x, z in profil_culasse] for y in bornes]
    n = len(profil_culasse)
    couleurs = []
    for k in range(n):
        for i in range(len(segments)):
            bm.faces.new((anneaux[i][k], anneaux[i][(k + 1) % n], anneaux[i + 1][(k + 1) % n], anneaux[i + 1][k]))
            couleurs.append(couleur_flanc[etiquettes[i]] if k in (1, 5) else couleur_defaut[k])
    bm.faces.new(list(reversed(anneaux[0])))
    couleurs.append(PALETTE["inox"])        # capuchon arrière : face à la caméra (silhouette priorité 2 renvoie ici)
    bm.faces.new(anneaux[-1])
    couleurs.append(PALETTE["inox_ombre"])  # marche vers l'ouverture
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("pist_culasse_arriere")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    colorer_faces(me, couleurs)
    culasse_arriere = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(culasse_arriere)
    pieces.append(culasse_arriere)

    # Nez, Y [0,117 ; 0,133] : même profil, flancs unis (les stries ne
    # courent que sur les 3,5 cm arrière, section 3.8).
    pieces.append(prisme(
        "pist_culasse_nez", 0.117, 0.133, profil_culasse,
        [PALETTE["carcasse"], PALETTE["inox"], PALETTE["inox_clair"], PALETTE["inox_clair"],
         PALETTE["inox_clair"], PALETTE["inox"], PALETTE["inox_ombre"], PALETTE["inox"]],
    ))

    # Ouverture du dessus, Y [0,037 ; 0,117] : deux rails clairs, le canon
    # visible entre eux (silhouette priorité 2).
    z_rail_haut = axe_canon_z - (axe_canon_z - 0.076) * ech_culasse
    largeur_rail = 0.005 * ech_culasse
    for signe in (-1, 1):
        centre_x = signe * (demi_largeur - largeur_rail / 2)
        pieces.append(pave(
            "pist_rail", (centre_x, 0.077, (z_bas + z_rail_haut) / 2),
            (largeur_rail, 0.117 - 0.037, z_rail_haut - z_bas), PALETTE["inox_clair"],
        ))

    # Canon : prisme à 6 pans (silhouette priorité 2), de l'intérieur de la
    # culasse jusqu'à la bouche — `bout_canon` de l'assemblage LIT cette même
    # cote, un seul endroit où la changer.
    rayon_canon = 0.007 * ech_culasse
    pieces.append(tube(
        "pist_canon", (0, -0.02, axe_canon_z), (0, BOUT_CANON_PISTOLET[1], axe_canon_z),
        rayon_canon, PALETTE["acier_bleui"], 6,
    ))

    # --- Carcasse : UN SEUL bloc de la queue de castor au nez, sans jamais
    # flotter (défaut n°2 du diagnostic — poignée, pontet, détente qui ne se
    # touchaient pas). --------------------------------------------------------
    z_carcasse_bas, z_carcasse_haut = 0.044, 0.061
    pieces.append(pave(
        "pist_carcasse", (0, (y0_arriere + 0.117) / 2, (z_carcasse_bas + z_carcasse_haut) / 2),
        (0.030, 0.117 - y0_arriere, z_carcasse_haut - z_carcasse_bas), PALETTE["carcasse"],
    ))

    # Queue de castor : dépasse derrière la culasse, colle à la carcasse (pas
    # de jour — silhouette priorité 6).
    y0_tang, y1_tang = -0.050, -0.037
    pieces.append(pave(
        "pist_queue_castor", (0, (y0_tang + y1_tang) / 2, 0.0388),
        (0.020, y1_tang - y0_tang, 0.0125), PALETTE["carcasse"],
    ))

    # Pontet ajouré, avant carré (silhouette priorité 7) : trois barres, un
    # vrai trou — pas une plaque pleine.
    e = 0.005
    y0_pontet, y1_pontet = 0.010, 0.073
    z0_pontet, z1_pontet = 0.012, 0.046
    pieces.append(pave(
        "pist_pontet_bas", (0, (y0_pontet + y1_pontet) / 2, z0_pontet + e / 2),
        (0.010, y1_pontet - y0_pontet, e), PALETTE["carcasse"],
    ))
    pieces.append(pave(
        "pist_pontet_avant", (0, y1_pontet - e / 2, (z0_pontet + z1_pontet) / 2),
        (0.010, e, z1_pontet - z0_pontet), PALETTE["carcasse"],
    ))
    pieces.append(pave(
        "pist_pontet_arriere", (0, y0_pontet + e / 2, (z0_pontet + z1_pontet) / 2),
        (0.010, e, z1_pontet - z0_pontet), PALETTE["carcasse"],
    ))
    # Détente, suspendue au bas de la carcasse dans le trou du pontet
    # (silhouette priorité 10, lisible au sol seulement).
    pieces.append(pave("pist_detente", (0, 0.035, (0.022 + 0.044) / 2), (0.006, 0.008, 0.044 - 0.022), PALETTE["acier_bleui"]))

    # --- Poignée : pavé à dos chanfreiné (silhouette priorité 9, au sol
    # seulement), incliné à 18° vers l'arrière, l'axe passe par l'origine. ---
    angle = math.radians(18)
    demi_hauteur = 0.045
    dy = demi_hauteur * math.tan(angle)
    haut_poignee = Vector((0, dy, demi_hauteur))
    bas_poignee = Vector((0, -dy, -demi_hauteur))
    pieces.append(balayage("pist_poignee", [haut_poignee, bas_poignee], 0.034, 0.055, PALETTE["plaquettes"]))
    # Semelle : déborde d'1 mm sous le chargeur.
    axe = (bas_poignee - haut_poignee).normalized()
    pieces.append(balayage(
        "pist_semelle", [bas_poignee - axe * 0.001, bas_poignee - axe * 0.005], 0.036, 0.057, PALETTE["carcasse"],
    ))

    # --- Organes de visée et chien, sur le dessus de la culasse (silhouette
    # priorités 3 et 4). --------------------------------------------------
    taille_point = 0.002 * ech_visee
    z_hausse = z_haut + 0.0025
    for signe in (-1, 1):
        pieces.append(pave("pist_hausse", (signe * 0.006, -0.031, z_hausse), (0.008, 0.006, 0.005), PALETTE["acier_bleui"]))
        # 2 points de visée sur la face arrière de la hausse.
        pieces.append(pave(
            "pist_hausse_point", (signe * 0.006, -0.034, z_hausse), (taille_point, 0.001, taille_point), PALETTE["point"],
        ))
    pieces.append(pave("pist_guidon", (0, 0.127, z_haut + 0.003), (0.003, 0.010, 0.006), PALETTE["acier_bleui"]))
    # 1 point de visée sur le dessus du guidon : c'est le dessus qu'on voit depuis l'œil.
    pieces.append(pave(
        "pist_guidon_point", (0, 0.127, z_haut + 0.0065), (taille_point, taille_point, 0.001), PALETTE["point"],
    ))
    # Chien armé, ×1,3 en vue subjective — crante le haut de la silhouette arrière.
    haut_chien = z_haut + 0.006 * ech_chien
    hauteur_chien = 0.029 * ech_chien
    pieces.append(pave(
        "pist_chien", (0, -0.0425, haut_chien - hauteur_chien / 2),
        (0.009 * ech_chien, 0.011 * ech_chien, hauteur_chien), PALETTE["acier_bleui"],
    ))
    # Deux leviers de sûreté, ancrés sur le flanc élargi (silhouette priorité 5).
    saillie = 0.004 * ech_culasse
    for signe in (-1, 1):
        pieces.append(pave(
            "pist_levier", (signe * (demi_largeur + saillie / 2 - 0.001), -0.0235, 0.070),
            (saillie + 0.006, 0.013, 0.008), PALETTE["acier_bleui"],
        ))

    return fusionner("pistolet", pieces)


def construire_pompe() -> tuple[bpy.types.Object, bpy.types.Object]:
    """Repère de l'arme : le canon part vers +Y, Z en haut, origine au milieu
    de la poignée pistolet (là où se referme la main droite). Retourne la
    carcasse et le fût mobile, ce dernier avec son origine à sa position de
    repos."""
    pieces = []
    # Poignée pistolet, inclinée de 15° vers l'arrière.
    pieces.append(tube("pompe_poignee", (0, 0.02, -0.06), (0, -0.01, 0.06), 0.018, PALETTE["bois_sombre"], 5))
    pieces.append(pave("pompe_carcasse", (0, 0.10, 0.10), (0.045, 0.22, 0.07), PALETTE["acier"]))
    pieces.append(pave("pompe_pontet", (0, 0.07, 0.055), (0.012, 0.06, 0.02), PALETTE["acier_sombre"]))
    pieces.append(pave("pompe_crosse", (0, -0.07, 0.10), (0.042, 0.14, 0.055), PALETTE["bois_sombre"]))
    pieces.append(tube("pompe_canon", (0, 0.20, 0.118), (0, 0.66, 0.118), 0.017, PALETTE["acier_sombre"]))
    pieces.append(tube("pompe_magasin", (0, 0.20, 0.082), (0, 0.58, 0.082), 0.014, PALETTE["acier"]))
    pieces.append(pave("pompe_guidon", (0, 0.645, 0.140), (0.006, 0.012, 0.010), PALETTE["acier_clair"]))
    carcasse = fusionner("pompe", pieces)

    fut = tube("pompe_fut", (0, 0.22, 0.085), (0, 0.38, 0.085), 0.030, PALETTE["bois"], 6)
    return carcasse, fut


# --- Héros : bras posés par IK ------------------------------------------------


def importer_heros():
    bpy.ops.import_scene.gltf(filepath=SOURCE)
    scene = bpy.context.scene
    arm = next(o for o in scene.objects if o.type == "ARMATURE")
    for o in list(scene.objects):
        if o.type == "MESH" and o.parent is not arm:
            bpy.data.objects.remove(o)
    mesh = next(o for o in scene.objects if o.type == "MESH" and o.parent is arm)
    for o in scene.objects:
        o.select_set(False)
    # Hauteur ramenée en mètres : tout le reste du script parle en mètres.
    bpy.context.view_layer.update()
    haut = max((mesh.matrix_world @ v.co).z for v in mesh.data.vertices)
    racine = arm.parent
    racine.scale = [GABARIT_BRAS / haut] * 3
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = bpy.data.actions["HumanArmature|Man_Idle"]
    scene.frame_set(0)
    # Pose de repos figée, action retirée : sinon la moindre réévaluation de
    # l'animation écraserait les poses de bras figées plus bas.
    arm.animation_data.action = None
    bpy.context.view_layer.update()
    return scene, arm, mesh


class Oeil:
    """Repère de l'œil du héros, qui regarde vers -Y comme le modèle."""

    def __init__(self, arm):
        tete = arm.matrix_world @ arm.pose.bones["Head"].head
        self.avant = Vector((0, -1, 0))
        self.droite = Vector((-1, 0, 0))
        self.haut = Vector((0, 0, 1))
        # Au-dessus du cou et un peu en arrière : les épaules passent devant
        # l'œil, et la main gauche atteint le fût bras tendu.
        self.origine = tete + self.haut * 0.12 - self.avant * 0.06

    def monde(self, p) -> Vector:
        p = Vector(p)
        return self.origine + self.droite * p.x + self.avant * p.y + self.haut * p.z

    def direction(self, d) -> Vector:
        d = Vector(d)
        return (self.droite * d.x + self.avant * d.y + self.haut * d.z).normalized()

    def matrice_vers_oeil(self) -> Matrix:
        """Monde -> repère de l'œil (X droite, Y devant, Z haut)."""
        m = Matrix.Identity(4)
        m.col[0][:3] = self.droite
        m.col[1][:3] = self.avant
        m.col[2][:3] = self.haut
        m.col[3][:3] = self.origine
        return m.inverted()


def repere(origine: Vector, x: Vector, y: Vector) -> Matrix:
    """Matrice orthonormée d'axes X, Y donnés (Y réorthogonalisé, Z = X × Y)."""
    x = x.normalized()
    z = x.cross(y).normalized()
    y = z.cross(x).normalized()
    m = Matrix.Identity(4)
    m.col[0][:3] = x
    m.col[1][:3] = y
    m.col[2][:3] = z
    m.col[3][:3] = origine
    return m


class Bras:
    """IK à trois os (épaule, coude, poignet) + rotation de main imposée.

    Axes de main du modèle, relevés sur le squelette : Y va du poignet vers
    les doigts, Z sort par le dos de la main. Le pouce est du côté -X pour la
    main droite, +X pour la gauche (squelette miroir).
    """

    def __init__(self, scene, arm, cote: str):
        self.arm = arm
        self.cote = cote
        self.cible = bpy.data.objects.new(f"ik_{cote}", None)
        self.main = bpy.data.objects.new(f"main_{cote}", None)
        self.pole = bpy.data.objects.new(f"pole_{cote}", None)
        for o in (self.cible, self.main, self.pole):
            scene.collection.objects.link(o)
        pb = arm.pose.bones[f"Palm.{cote}"]
        ik = pb.constraints.new("IK")
        ik.target = self.cible
        ik.pole_target = self.pole
        ik.chain_count = 3
        self.ik = ik
        rot = pb.constraints.new("COPY_ROTATION")
        rot.target = self.main
        rot.mute = True
        self.rot = rot
        self.chaine = [f"UpperArm.{cote}", f"LowerArm.{cote}", f"Palm.{cote}"]
        self.repos = {n: arm.pose.bones[n].matrix_basis.copy() for n in self.chaine}

    def poser(self, prise: Matrix, coude: Vector, recul_poignet: float = 0.075, decalage_paume: float = 0.035):
        """`prise` : repère de la main (axes du modèle) centré sur l'objet saisi.
        Le poignet recule le long des doigts et sort vers le dos de la main."""
        y = Vector(prise.col[1][:3])
        z = Vector(prise.col[2][:3])
        centre = Vector(prise.col[3][:3])
        self.cible.location = centre - y * recul_poignet + z * decalage_paume
        self.main.matrix_world = prise
        self.pole.location = coude
        for n in self.chaine:
            self.arm.pose.bones[n].matrix_basis = self.repos[n]
        self.ik.mute = False
        self.rot.mute = True
        # L'angle de pôle dépend du roulis des os, propre à chaque modèle : on
        # garde celui qui pose réellement le coude au plus près de sa cible.
        meilleur = None
        for angle in range(-180, 180, 15):
            self.ik.pole_angle = math.radians(angle)
            bpy.context.view_layer.update()
            c = self.arm.matrix_world @ self.arm.pose.bones[f"LowerArm.{self.cote}"].head
            d = (c - coude).length
            if meilleur is None or d < meilleur[0]:
                meilleur = (d, angle)
        self.ik.pole_angle = math.radians(meilleur[1])
        # En deux temps : l'IK place le bras, on fige sa pose, puis la main
        # prend la rotation voulue. Dans une même pile, le solveur IK écrase
        # la rotation de la paume, qui fait partie de sa chaîne.
        bpy.context.view_layer.update()
        figees = {n: self.arm.pose.bones[n].matrix.copy() for n in self.chaine}
        self.ik.mute = True
        for n in self.chaine:
            self.arm.pose.bones[n].matrix = figees[n]
            bpy.context.view_layer.update()
        self.rot.mute = False

    def ecart(self) -> str:
        bpy.context.view_layer.update()
        epaule = self.arm.matrix_world @ self.arm.pose.bones[f"UpperArm.{self.cote}"].head
        poignet = self.arm.matrix_world @ self.arm.pose.bones[f"Palm.{self.cote}"].head
        cible = self.cible.matrix_world.translation
        m = self.arm.matrix_world @ self.arm.pose.bones[f"Palm.{self.cote}"].matrix
        voulu = self.main.matrix_world
        alignement = [Vector(m.col[i][:3]).normalized().dot(Vector(voulu.col[i][:3]).normalized()) for i in (1, 2)]
        return (f"bras {self.cote} : épaule->cible {(cible - epaule).length:.2f} m, "
                f"poignet à {(poignet - cible).length * 100:.1f} cm de la cible, "
                f"doigts/dos alignés à {alignement[0]:.2f}/{alignement[1]:.2f}")

    def fermer_poing(self, doigts_deg: float, pouce_deg: float):
        """Fléchit les doigts vers la paume : rotation NÉGATIVE autour de l'axe
        X de l'os (Y des doigts vers -Z, côté paume), pour les deux mains."""
        for nom, angle in ((f"Fingers.{self.cote}", doigts_deg), (f"Thumb1.{self.cote}", pouce_deg * 0.5),
                           (f"Thumb2.{self.cote}", pouce_deg)):
            pb = self.arm.pose.bones[nom]
            pb.rotation_mode = "XYZ"
            pb.rotation_euler = (-math.radians(angle), 0, 0)


def extraire_avant_bras(scene, mesh, cotes: tuple[str, ...], nom: str) -> bpy.types.Object:
    """Copie figée (armature appliquée) des seuls sommets de l'avant-bras et
    de la main, recolorée : manche, poignet, peau."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    me.transform(mesh.matrix_world)

    groupes = {g.index: g.name for g in mesh.vertex_groups}
    garder = {f"{b}.{c}" for b in OS_AVANT_BRAS for c in cotes}
    dominant = []
    for v in mesh.data.vertices:
        meilleur = max(v.groups, key=lambda g: g.weight, default=None)
        dominant.append(groupes.get(meilleur.group) if meilleur else None)

    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    a_supprimer = [v for v in bm.verts if dominant[v.index] not in garder]
    bmesh.ops.delete(bm, geom=a_supprimer, context="VERTS")
    matieres = [m.name for m in mesh.data.materials]
    couleurs = {f.index: matieres[f.material_index] for f in bm.faces}
    bm.to_mesh(me)
    bm.free()
    me.materials.clear()
    for p in me.polygons:
        p.use_smooth = False

    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for p in me.polygons:
        teinte = PALETTE["peau"] if couleurs[p.index] == "Skin" else PALETTE["manche"]
        rgba = srgb_lineaire(teinte)
        for li in p.loop_indices:
            attr.data[li].color = rgba
    me.color_attributes.active_color = attr

    ob = bpy.data.objects.new(nom, me)
    scene.collection.objects.link(ob)
    return ob


# --- Assemblage --------------------------------------------------------------


def vers_gltf(v) -> list[float]:
    """Repère de l'œil Blender (X droite, Y devant, Z haut) -> glTF (Y haut,
    -Z devant), soit le repère local de la caméra three.js."""
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def placer(ob: bpy.types.Object, m: Matrix):
    ob.data.transform(m)
    ob.matrix_world = Matrix.Identity(4)


def assembler(scene, arm, mesh, oeil: Oeil):
    droit, gauche = Bras(scene, arm, "R"), Bras(scene, arm, "L")
    vers_oeil = oeil.matrice_vers_oeil()

    # Pied-de-biche : poing droit en bas à droite, barre qui monte vers
    # l'avant et rentre vers le centre de l'écran.
    prise_pdb = oeil.monde(PRISE_PDB)
    axe_pdb = oeil.direction(AXE_PDB)
    outil_pdb = repere(prise_pdb, oeil.droite.cross(axe_pdb), axe_pdb)  # +Y le long de la barre
    pdb = construire_pied_de_biche()
    placer(pdb, outil_pdb)
    # Main droite : pouce le long de la barre (vers le col), dos vers la droite.
    main_pdb = repere(prise_pdb, -axe_pdb, oeil.avant)
    droit.poser(main_pdb, coude=oeil.monde((0.35, 0.05, -0.75)), recul_poignet=0.09, decalage_paume=0.04)
    droit.fermer_poing(95, 35)
    bpy.context.view_layer.update()
    print("[armes] pied-de-biche,", droit.ecart())
    bras_pdb = extraire_avant_bras(scene, mesh, ("R",), "bras_pdb")
    vm_crowbar = fusionner("vm_crowbar", [pdb, bras_pdb])
    placer(vm_crowbar, vers_oeil)

    # Pistolet : même poing droit que le pied-de-biche, arme tenue plus haut
    # et plus au centre — c'est ce qui le distingue du pompe à l'écran.
    prise_pist = oeil.monde(PRISE_PISTOLET)
    axe_pist = oeil.direction(AXE_PISTOLET)
    arme_pist = repere(prise_pist, axe_pist.cross(oeil.haut), axe_pist)
    pistolet = construire_pistolet(vue_subjective=True)
    placer(pistolet, arme_pist @ Matrix.Scale(ECHELLE_PISTOLET_VM, 4))
    haut_pist = Vector(arme_pist.col[2][:3])
    main_pist = repere(prise_pist, -haut_pist, axe_pist)
    droit.poser(main_pist, coude=oeil.monde((0.30, 0.02, -0.72)), recul_poignet=0.085, decalage_paume=0.04)
    droit.fermer_poing(100, 30)
    bpy.context.view_layer.update()
    print("[armes] pistolet,", droit.ecart())
    bras_pist = extraire_avant_bras(scene, mesh, ("R",), "bras_pistolet")
    vm_pistol = fusionner("vm_pistol", [pistolet, bras_pist])
    placer(vm_pistol, vers_oeil)

    # Pompe : poignée en bas à droite, canon pointé vers le réticule.
    prise_pompe = oeil.monde(PRISE_POMPE)
    axe_canon = oeil.direction(AXE_CANON)
    arme = repere(prise_pompe, axe_canon.cross(oeil.haut), axe_canon)
    carcasse, fut = construire_pompe()
    placer(carcasse, arme)
    placer(fut, arme)
    haut_arme = Vector(arme.col[2][:3])
    droite_arme = Vector(arme.col[0][:3])

    # Main droite sur la poignée : pouce vers la carcasse, doigts vers l'avant.
    main_poignee = repere(prise_pompe, -haut_arme, axe_canon)
    droit.poser(main_poignee, coude=oeil.monde((0.35, 0.0, -0.75)), recul_poignet=0.09, decalage_paume=0.04)
    droit.fermer_poing(100, 30)
    # Main gauche sous le fût : paume vers le haut, pouce vers l'avant.
    centre_fut = Vector(arme @ Vector((0, 0.30, 0.085)))
    main_fut = repere(centre_fut - haut_arme * 0.02, axe_canon, droite_arme)
    gauche.poser(main_fut, coude=oeil.monde((-0.25, 0.25, -0.75)), recul_poignet=0.085, decalage_paume=0.04)
    gauche.fermer_poing(85, 20)
    bpy.context.view_layer.update()
    print("[armes] pompe,", droit.ecart())
    print("[armes] pompe,", gauche.ecart())
    bras_droit = extraire_avant_bras(scene, mesh, ("R",), "bras_pompe_d")
    bras_gauche = extraire_avant_bras(scene, mesh, ("L",), "bras_pompe_g")

    vm_shotgun = fusionner("vm_shotgun", [carcasse, bras_droit])
    placer(vm_shotgun, vers_oeil)
    vm_pump = fusionner("vm_shotgun_pump", [fut, bras_gauche])
    placer(vm_pump, vers_oeil)

    # Tout ce que le jeu doit savoir de la géométrie voyage dans les extras,
    # en repère glTF : rien à deviner ni à recopier en TypeScript.
    vm_pump.parent = vm_shotgun
    # Surtout pas `pivot` : `GLTFLoader` (three r185) réserve cet extra pour
    # `Object3D.pivot` et l'efface de tout nœud qui a des enfants.
    vm_crowbar["prise"] = vers_gltf(PRISE_PDB)
    vm_pistol["prise"] = vers_gltf(PRISE_PISTOLET)
    vm_pistol["bout_canon"] = vers_gltf(
        vers_oeil @ (arme_pist @ (Matrix.Scale(ECHELLE_PISTOLET_VM, 4) @ Vector(BOUT_CANON_PISTOLET))))
    vm_shotgun["prise"] = vers_gltf(PRISE_POMPE)
    vm_shotgun["bout_canon"] = vers_gltf(vers_oeil @ (arme @ Vector((0, 0.66, 0.118))))
    vm_pump["axe_glissiere"] = vers_gltf(Vector(AXE_CANON).normalized())

    return vm_crowbar, vm_pistol, vm_shotgun, vm_pump


def armes_au_sol():
    """Mêmes armes, sans bras, posées à plat : origine au centre, longueur
    le long de +Y, dessous à Z = 0."""
    pdb = construire_pied_de_biche()
    placer(pdb, Matrix.Rotation(math.radians(90), 4, "Y") @ Matrix.Translation((0, -0.1, 0)))
    pistolet = construire_pistolet(vue_subjective=False)
    pistolet.name = pistolet.data.name = "world_pistol"
    # Recentre la longueur (queue de castor -0,050 -> bouche 0,141, milieu
    # 0,0455) et la hauteur (semelle -0,046 -> chien 0,091, milieu 0,0225)
    # avant la rotation à plat — la mise au sol finale (zmin -> 0) suit.
    placer(pistolet, Matrix.Rotation(math.radians(90), 4, "Y") @ Matrix.Translation((0, -0.0455, -0.0225)))
    carcasse, fut = construire_pompe()
    pompe = fusionner("world_shotgun", [carcasse, fut])
    placer(pompe, Matrix.Rotation(math.radians(90), 4, "Y") @ Matrix.Translation((0, -0.25, -0.05)))
    pdb.name = pdb.data.name = "world_crowbar"
    for ob in (pdb, pistolet, pompe):
        zmin = min(v.co.z for v in ob.data.vertices)
        ob.data.transform(Matrix.Translation((0, 0, -zmin)))
    return pdb, pistolet, pompe


# --- Contrôle et export ------------------------------------------------------


def rendre_vues(scene, objets, dossier: str):
    """Vue depuis l'œil, au champ de vision et au format du jeu, une par arme."""
    os.makedirs(dossier, exist_ok=True)
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "VERTEX"
    scene.render.resolution_x, scene.render.resolution_y = RENDU_W, RENDU_H
    scene.render.film_transparent = False
    scene.world = scene.world or bpy.data.worlds.new("fond")
    scene.world.color = (0.25, 0.25, 0.3)
    cam_data = bpy.data.cameras.new("oeil")
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle_y = math.radians(FOV_VERTICAL_DEG)
    cam_data.clip_start = 0.1
    cam = bpy.data.objects.new("oeil", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    # Repère de l'œil : caméra Blender regarde vers -Z local, Y local en haut.
    cam.matrix_world = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
    for o in scene.objects:
        if o.type == "MESH":
            xs = [v.co for v in o.data.vertices]
            mn = [round(min(c[i] for c in xs), 2) for i in range(3)]
            mx = [round(max(c[i] for c in xs), 2) for i in range(3)]
            o.data.calc_loop_triangles()
            print(f"[armes] {o.name}: {len(xs)} sommets, {len(o.data.loop_triangles)} triangles, boîte {mn} -> {mx}")
    for nom, visibles in objets.items():
        for o in scene.objects:
            if o.type == "MESH":
                o.hide_render = o.name not in visibles
        scene.render.filepath = os.path.join(dossier, f"{nom}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[armes] vue {scene.render.filepath}")


def rendre_debug(scene, objets, dossier: str):
    """Vues orthographiques de côté et de dessus, œil à l'origine : pour voir
    où tombent les mains quand la vue subjective ne montre rien d'utile."""
    cam_data = bpy.data.cameras.new("debug")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 1.6
    cam = bpy.data.objects.new("debug", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    repere_oeil = bpy.data.objects.new("repere_oeil", None)
    scene.collection.objects.link(repere_oeil)
    vues = {
        # caméra à droite (+X) regardant vers -X, Z en haut
        "cote": (1.6, Matrix(((0, 0, 1, 3), (1, 0, 0, 0.45), (0, 1, 0, -0.2), (0, 0, 0, 1)))),
        # caméra au-dessus regardant vers le bas, Y devant vers le haut de l'image
        "dessus": (1.6, Matrix(((1, 0, 0, 0.1), (0, 1, 0, 0.45), (0, 0, 1, 3), (0, 0, 0, 1)))),
    }
    for nom, visibles in objets.items():
        for o in scene.objects:
            if o.type == "MESH":
                o.hide_render = o.name not in visibles
        for vue, (echelle, m) in vues.items():
            cam_data.ortho_scale = echelle
            cam.matrix_world = m
            scene.render.filepath = os.path.join(dossier, f"debug_{nom}_{vue}.png")
            bpy.ops.render.render(write_still=True)


def exporter(chemin: str, objets):
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(o in objets)
    bpy.ops.export_scene.gltf(
        filepath=chemin,
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_vertex_color="ACTIVE",
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_skins=False,
        export_materials="NONE",
    )
    print(f"[armes] écrit {chemin}")


def main() -> int:
    args = get_args()
    out = arg_value(args, "--out", "public/assets/weapons/armes.glb")
    renders = arg_value(args, "--renders", "renders/armes")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene, arm, mesh = importer_heros()
    oeil = Oeil(arm)
    vm_crowbar, vm_pistol, vm_shotgun, vm_pump = assembler(scene, arm, mesh, oeil)

    # Le héros n'a plus rien à faire dans la scène : seuls ses bras figés restent.
    for o in list(scene.objects):
        if o.type in {"ARMATURE", "EMPTY"} or o is mesh:
            bpy.data.objects.remove(o)
    world_crowbar, world_pistol, world_shotgun = armes_au_sol()

    vues = {
        "pied_de_biche": {"vm_crowbar"},
        "pistolet": {"vm_pistol"},
        "pompe": {"vm_shotgun", "vm_shotgun_pump"},
    }
    rendre_vues(scene, vues, renders)
    if "--debug" in args:
        rendre_debug(scene, vues, renders)
    exporter(out, [vm_crowbar, vm_pistol, vm_shotgun, vm_pump,
                   world_crowbar, world_pistol, world_shotgun])
    return 0


if __name__ == "__main__":
    sys.exit(main())
