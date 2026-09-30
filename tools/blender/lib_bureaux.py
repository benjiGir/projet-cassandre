"""
Bibliothèque de la cafétéria et des bureaux — niveau v2, jalon N9.

Cinquième et dernier module d'habillage, après `lib_rayons` (surface de vente),
`lib_facade` (avant-magasin), `lib_electro` (électroménager) et `lib_reserve`
(arrière du magasin). Celui-ci meuble les deux espaces « habités » du niveau :
celui où l'on mange et celui où l'on travaille.

Aucun atlas neuf non plus. Les écrans de bureau viennent de `prd_ecrans`
(l'atlas de l'électroménager — un moniteur et un téléviseur sont la même dalle
à cette résolution), les façades de distributeurs de `prd_etiquettes`, et tout
le reste est du bois, du stratifié et du métal peint déjà disponibles.

Les deux pièces ont en commun d'être MEUBLÉES et non achalandées : pas de
marchandise, des objets qu'on utilise. C'est ce qui doit se sentir en y
entrant, après quatre espaces de rayonnage.
"""

from __future__ import annotations

import math
import os
import random

from mathutils import Matrix, Vector

import lib_helpers as H
from lib_rayons import asset_coll
from lib_electro import ECRANS

# Étiquettes de produits réutilisées en façade de distributeur.
FACADES_DISTRIBUTEUR = ("soda_5g_cola", "chips_illumi", "cafe_reveille")


# --- Mobilier tiré du Kenney Furniture Kit ------------------------------------
#
# 140 modèles CC0 confirmés, et une particularité qui décide de tout : le pack
# n'a AUCUNE texture. Ses matériaux sont des couleurs plates nommées (`wood`,
# `metal`, `metalDark`). Importé tel quel, chaque meuble amènerait trois ou
# quatre matériaux de plus, et le budget sous tension du niveau v2 est le
# nombre de lots de dessin.
#
# `H.import_kit(..., repeindre=True)` reporte donc chaque teinte sur le
# nuancier commun (`palette.png`) : tout le kit tient dans UN matériau, se fond
# en un lot au chargement (ADR 0023), et passe au passage sous la charte de
# couleurs du projet — ce qu'un import brut n'aurait pas fait.

MEUBLES_GLB = os.path.join(H.ROOT, "assets_src", "cc0_raw", "kenney_furniture-kit",
                           "Models", "GLTF format")

# (modèle, hauteur en mètres, collider ?). Les hauteurs sont RÉELLES : le pack
# est à une échelle plausible mais pas métrique, et un canapé de 1,20 m de haut
# dans un couloir de 6 m ne trompe personne.
MEUBLES = {
    "pottedPlant": (1.05, True),
    "plantSmall2": (0.42, False),
    "bookcaseClosed": (1.80, True),
    "bookcaseOpen": (1.80, True),
    "chairDesk": (1.05, True),
    "chair": (0.95, True),
    "trashcan": (0.55, True),
    "coatRackStanding": (1.75, True),
    "loungeSofa": (0.82, True),
    "tableCoffee": (0.45, True),
    "kitchenCoffeeMachine": (0.38, False),
    "kitchenMicrowave": (0.30, False),
    "toaster": (0.22, False),
    "kitchenFridge": (1.72, True),
    "televisionVintage": (0.62, False),
    "televisionModern": (0.68, False),
    # Meuble télé bas : ce qui porte les téléviseurs du rayon Image & Son. Un
    # téléviseur posé à même le sol ne s'expose dans aucun magasin.
    "cabinetTelevision": (0.50, True),
    # Coin cuisine de la salle de pause, à l'étage des bureaux.
    "kitchenCabinet": (0.90, True),
    "speaker": (1.00, True),
    "radio": (0.24, False),
    "laptop": (0.26, False),
    "stoolBar": (0.78, True),
    "rugRectangle": (0.02, False),
    # Toilettes de la cafétéria. La cuvette n'a PAS de collider ici (2026-09-24) :
    # posée en `sanitaire_cuvette*` par `habiller_toilettes`, elle n'en veut
    # aucun jumeau — le loader construit lui-même un cuboïde fixe sur sa bbox
    # monde, comme pour un `prop_*` (voir `docs/6-reference/conventions-nommage.md`).
    "toilet": (0.78, False),
    "bathroomSink": (0.88, True),
    "bathroomMirror": (0.70, False),
    # PC sécurité, 2e reprise (2026-09-26) : des cubes maison remplacés par de
    # vrais modèles, un objet non identifiable à 2-3 m valant moins qu'un
    # meuble reconnaissable même approximatif (retour « je ne sais pas à quoi
    # ça correspond »).
    "desk": (0.75, True),
    "deskCorner": (0.75, True),          # la console en L du vigile
    "computerScreen": (0.35, False),
    "computerKeyboard": (0.04, False),
    "books": (0.14, False),              # la main courante, en pile
    "lampRoundTable": (0.35, False),      # la lampe de bureau chaude
}


def meuble(modele: str) -> str:
    """Un meuble du Kenney Furniture Kit, repeint sur le nuancier du projet."""
    hauteur, collider = MEUBLES[modele]
    name = f"mob_k_{modele}"
    coll, done = asset_coll(name)
    if done:
        return name
    obj = H.import_kit(name, os.path.join(MEUBLES_GLB, f"{modele}.glb"),
                       "palette", coll, hauteur=hauteur, repeindre=True)
    if collider:
        lx, ly, lz = H.kit_bounds(obj)
        H.col_box(name[4:], (0, 0, 0, lx, ly, lz), coll)
    return name


def vigile_assis() -> str:
    """Pose statique du modèle Quaternius dans une animation assise.

    Le GLB reste un asset source : on fige son armature ici, puis on fusionne
    la pose sur la palette commune pour l'export du niveau. Aucun rig ni
    matériau externe ne part dans le runtime.
    """
    import bmesh
    import bpy
    from mathutils import Vector

    name = "mob_vigile_assis"
    coll, done = asset_coll(name)
    if done:
        return name

    glb = os.path.join(H.ROOT, "assets_src", "cc0_raw", "quaternius_man_in_suit", "man_in_suit.glb")
    objets_avant = set(bpy.data.objects)
    materiaux_avant = set(bpy.data.materials)
    images_avant = set(bpy.data.images)
    actions_avant = set(bpy.data.actions)
    scene = bpy.context.scene
    frame_avant, sous_image_avant = scene.frame_current, scene.frame_subframe

    bpy.ops.import_scene.gltf(filepath=glb)
    importes = [o for o in bpy.data.objects if o not in objets_avant]
    armature = next((o for o in importes if o.type == "ARMATURE"), None)
    corps = next((o for o in importes if o.type == "MESH" and o.find_armature() == armature), None)
    action = next((a for a in bpy.data.actions if a not in actions_avant and a.name.endswith("Man_Sitting")), None)
    if armature is None or corps is None or action is None:
        raise RuntimeError("Le modèle Quaternius doit contenir son armature et l'animation Man_Sitting")

    armature.animation_data_create()
    racine = armature.parent

    def actionner(action_source, frame):
        armature.animation_data.action = action_source
        if action_source.slots:
            armature.animation_data.action_slot = action_source.slots[0]
        for bone in armature.pose.bones:
            bone.location = (0, 0, 0)
            bone.rotation_quaternion = (1, 0, 0, 0)
            bone.rotation_euler = (0, 0, 0)
            bone.scale = (1, 1, 1)
        if racine is not None:
            racine.location = (0, 0, 0)
        scene.frame_set(frame)
        bpy.context.view_layer.update()

    # Quaternius livre le personnage à ~5 unités pour 1,8 m. On mesure la
    # pose debout du même rig, puis applique cette conversion à la pose assise.
    debout = next((a for a in bpy.data.actions if a not in actions_avant and a.name.endswith("Man_Standing")), None)
    if debout is None:
        debout = next(a for a in bpy.data.actions if a not in actions_avant and a.name.endswith("Man_Idle"))
    d0, d1 = debout.frame_range
    actionner(debout, round(d0 + (d1 - d0) * 0.5))
    depsgraph = bpy.context.evaluated_depsgraph_get()
    ref = corps.evaluated_get(depsgraph)
    points = [ref.matrix_world @ vert.co for vert in ref.data.vertices]
    facteur = 1.8 / max(max(p.z for p in points) - min(p.z for p in points), 1e-6)

    debut, fin = action.frame_range
    actionner(action, round(debut + (fin - debut) * 0.8))
    depsgraph = bpy.context.evaluated_depsgraph_get()
    corps_pose = corps.evaluated_get(depsgraph)
    pose = bpy.data.meshes.new_from_object(corps_pose, preserve_all_data_layers=True, depsgraph=depsgraph)
    pose.transform(corps_pose.matrix_world)

    couleurs = {
        "Shirt": "#444a54", "Pants": "#2f3541", "Skin": "#deb789",
        "Hair": "#111014", "Eyes": "#111014", "Details": "#babcbc",
        "TieTexture": "#f2efe6",
    }
    for mat in pose.materials:
        hexa = couleurs.get(mat.name)
        if hexa is None:
            continue
        srgb = [int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        rgb = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
        mat.diffuse_color = (*rgb, 1.0)
        bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if mat.use_nodes else None
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    H._repeindre_sur_palette(pose)

    bm = bmesh.new()
    bm.from_mesh(pose)
    bpy.data.meshes.remove(pose)
    bas = Vector(tuple(min(v.co[i] for v in bm.verts) for i in range(3)))
    for vert in bm.verts:
        vert.co = (vert.co - bas) * facteur
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.validate(verbose=False)
    objet = bpy.data.objects.new(name, mesh)
    mesh.materials.append(H.textured_material("palette"))
    coll.objects.link(objet)

    for objet_source in importes:
        bpy.data.objects.remove(objet_source, do_unlink=True)
    for mat in [m for m in bpy.data.materials if m not in materiaux_avant and m.users == 0]:
        bpy.data.materials.remove(mat)
    for image in [i for i in bpy.data.images if i not in images_avant and i.users == 0]:
        bpy.data.images.remove(image)
    for action_source in [a for a in bpy.data.actions if a not in actions_avant and a.users == 0]:
        bpy.data.actions.remove(action_source)
    scene.frame_set(frame_avant, subframe=sous_image_avant)
    return name


# --- Cafétéria ---------------------------------------------------------------

def comptoir_self(longueur: float = 12.0) -> str:
    """Comptoir de self : glissière à plateaux, bacs chauds, vitrine haute.

    Un des trois objets du plan sans équivalent CC0, monté en volumes simples.
    1,10 m de haut — donc franchissable d'un saut (1,10 m de saut, marge nulle
    mais suffisante) : c'est par lui que passe l'accès au secret 3.
    """
    name = f"mob_comptoir_self_{longueur:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr, ht = longueur, 1.5, 1.10

    H.box(f"{name}_socle", (0, 0.20, 0, lo, pr, ht - 0.10), "metal_bac_acier", coll, subdiv=0.8)
    H.box(f"{name}_plateau", (0, 0.18, ht - 0.10, lo, pr, ht), "metal_bac_acier", coll)
    # Bouts et dos rentrés d'un centimètre dans le socle : à fleur, ils se
    # battaient avec ses faces.
    H.box(f"{name}_plinthe", (0.01, 0.18, 0, lo - 0.01, pr - 0.01, 0.14),
          "trim_hypermarche", coll, uv="trim:plinthe")
    # Glissière à plateaux, en tube : le détail qui dit « self » et pas « bar ».
    H.boxes(f"{name}_glissiere", [
        ((0, 0.02, ht - 0.12, lo, 0.10, ht - 0.06), "world"),
        ((0, 0.12, ht - 0.12, lo, 0.20, ht - 0.06), "world"),
    ], "metal_bac_acier", coll)

    # Bacs chauds encastrés, et la vitrine qui les surplombe.
    bacs = []
    x = 0.50
    while x < lo - 1.00:
        bacs.append(((x, 0.45, ht - 0.08, x + 0.80, 1.25, ht - 0.02), "world"))
        x += 1.00
    H.boxes(f"{name}_bacs", bacs, "trim_hypermarche", coll)
    H.boxes(f"{name}_vitrine", [
        ((0.10, 0.30, ht + 0.55, lo - 0.10, 0.36, ht + 0.62), "world"),
        ((0.10, 0.30, ht, 0.18, 0.36, ht + 0.62), "world"),
        ((lo - 0.18, 0.30, ht, lo - 0.10, 0.36, ht + 0.62), "world"),
    ], "metal_bac_acier", coll)
    H.box(f"{name}_neon", (0.20, 0.31, ht + 0.48, lo - 0.20, 0.35, ht + 0.55),
          "trim_hypermarche", coll, uv="trim:neon")

    H.col_box(name[4:], (0, 0.18, 0, lo, pr, ht), coll)
    return name


def table_cafeteria(seed: int = 0) -> str:
    """Table de réfectoire et ses quatre chaises, légèrement de travers.

    2 × 2 m, les cotes du volume gris du blockout. Les chaises sont tournées au
    hasard : quatre chaises parfaitement rangées se lisent comme du mobilier de
    catalogue, pas comme une cafétéria qu'on vient de quitter.
    """
    name = f"mob_table_caf_{seed}"
    coll, done = asset_coll(name)
    if done:
        return name
    rng = random.Random(seed or 5)
    cx, cy, ht = 1.0, 1.0, 0.75

    H.box(f"{name}_plateau", (0.20, 0.20, ht - 0.05, 1.80, 1.80, ht),
          "bois_palette", coll, subdiv=0.8)
    H.box(f"{name}_pied", (0.86, 0.86, 0, 1.14, 1.14, ht - 0.05), "metal_bac_acier", coll)
    H.box(f"{name}_socle", (0.60, 0.60, 0, 1.40, 1.40, 0.05), "metal_bac_acier", coll)

    assises, dossiers = [], []
    for i, (dx, dy) in enumerate(((0.0, -0.72), (0.0, 0.72), (-0.72, 0.0), (0.72, 0.0))):
        if rng.random() < 0.15:                  # une chaise manquante
            continue
        j = rng.uniform(-0.09, 0.09)
        x, y = cx + dx + j, cy + dy + j
        assises.append(((x - 0.22, y - 0.22, 0.42, x + 0.22, y + 0.22, 0.47), "world"))
        # Dossier du côté opposé à la table.
        ox, oy = (0, -0.20) if dy < 0 else (0, 0.20) if dy > 0 else ((-0.20, 0) if dx < 0 else (0.20, 0))
        dossiers.append(((x + ox - 0.22 + (0.18 if ox > 0 else 0), y + oy - 0.22 + (0.18 if oy > 0 else 0),
                          0.47,
                          x + ox + 0.22 - (0.18 if ox < 0 else 0), y + oy + 0.22 - (0.18 if oy < 0 else 0),
                          0.92), "world"))
        for px, py in ((x - 0.19, y - 0.19), (x + 0.15, y - 0.19),
                       (x - 0.19, y + 0.15), (x + 0.15, y + 0.15)):
            assises.append(((px, py, 0, px + 0.04, py + 0.04, 0.42), "world"))
    H.boxes(f"{name}_chaises", assises, "metal_peint_rouge", coll)
    H.boxes(f"{name}_dossiers", dossiers, "metal_peint_rouge", coll)

    H.col_box(name[4:], (0.55, 0.55, 0, 1.45, 1.45, ht), coll)
    return name


def distributeur(facade: str) -> str:
    """Distributeur automatique : caisson, vitrine éclairée, monnayeur.

    Deux dans la cafétéria, et ce sont les seuls objets lumineux d'une pièce
    par ailleurs éteinte quand ses néons meurent.
    """
    name = f"mob_distributeur_{facade}"
    coll, done = asset_coll(name)
    if done:
        return name
    lo, pr, ht = 0.90, 0.75, 1.90
    H.box(f"{name}_caisson", (0, 0.06, 0, lo, pr, ht), "metal_peint_rouge", coll, subdiv=0.8)
    H.box(f"{name}_vitrine", (0.06, 0.02, 0.55, lo - 0.26, 0.06, ht - 0.16),
          "prd_etiquettes", coll, uv=f"label:{facade}", front="-y")
    H.box(f"{name}_monnayeur", (lo - 0.22, 0.02, 0.75, lo - 0.06, 0.06, 1.35),
          "metal_bac_acier", coll)
    H.box(f"{name}_trappe", (0.10, 0.02, 0.12, lo - 0.30, 0.06, 0.40),
          "trim_hypermarche", coll, uv="trim:joint_caoutchouc")
    H.col_box(name[4:], (0, 0, 0, lo, pr, ht), coll)
    return name


# --- Bureaux -----------------------------------------------------------------

def orienter_equipements_poste(plateau, fauteuil, pied, dos, ecran, clavier) -> bool:
    """Oriente écran et clavier vers le fauteuil, y compris sur un poste déjà posé."""
    def centre(obj):
        points = [obj.matrix_world @ v.co for v in obj.data.vertices]
        return Vector(tuple((min(p[i] for p in points)+max(p[i] for p in points))/2
                            for i in range(3)))

    pivot = centre(plateau)
    facade = centre(ecran)-centre(dos)
    vers_fauteuil = centre(fauteuil)-pivot
    facade.z = vers_fauteuil.z = 0
    if facade.dot(vers_fauteuil) >= 0:
        return False
    rotation = (Matrix.Translation(pivot) @ Matrix.Rotation(math.pi, 4, "Z")
                @ Matrix.Translation(-pivot))
    for obj in (pied, dos, ecran, clavier):
        if obj.data.users > 1:
            obj.data = obj.data.copy()
        obj.data.transform(obj.matrix_world.inverted() @ rotation @ obj.matrix_world)
        obj.data.update()
    return True


def poste_bureau(seed: int = 0) -> str:
    """Poste de travail : bureau, caisson, fauteuil, écran, paperasse.

    3 × 1,5 × 0,80 m, les cotes du volume gris du blockout. L'écran vient de
    l'atlas de l'électroménager — un moniteur et un téléviseur sont la même
    dalle à 640×360, et il aurait été absurde d'en dessiner un second jeu.
    """
    name = f"mob_poste_bureau_{seed}"
    coll, done = asset_coll(name)
    if done:
        parts = {obj.name.split(".")[0].removeprefix(name+"_"): obj for obj in coll.objects}
        orienter_equipements_poste(*(parts[key] for key in
                                    ("plateau", "fauteuil", "pied_ecran", "ecran_dos", "ecran", "clavier")))
        return name
    rng = random.Random(seed or 2)
    lo, pr, ht = 3.0, 1.5, 0.80

    plateau = H.box(f"{name}_plateau", (0, 0, ht - 0.05, lo, pr, ht), "bois_palette", coll, subdiv=0.8)
    H.box(f"{name}_caisson", (0.06, 0.10, 0, 0.70, pr - 0.10, ht - 0.05),
          "metal_bac_acier", coll)
    H.boxes(f"{name}_pieds", [
        ((lo - 0.16, 0.10, 0, lo - 0.06, 0.20, ht - 0.05), "world"),
        ((lo - 0.16, pr - 0.20, 0, lo - 0.06, pr - 0.10, ht - 0.05), "world"),
    ], "metal_bac_acier", coll)

    # Écran, clavier, corbeille à papier : ce qui distingue un bureau d'une table.
    pied = H.box(f"{name}_pied_ecran", (1.35, 0.90, ht, 1.65, 1.10, ht + 0.12),
          "metal_bac_acier", coll)
    dos = H.box(f"{name}_ecran_dos", (1.10, 0.92, ht + 0.12, 1.90, 1.02, ht + 0.62),
          "metal_bac_acier", coll)
    ecran = H.box(f"{name}_ecran", (1.13, 0.88, ht + 0.15, 1.87, 0.92, ht + 0.59),
          "prd_ecrans", coll, uv=f"label:{rng.choice(ECRANS)}", front="-y")
    clavier = H.box(f"{name}_clavier", (1.20, 0.30, ht, 1.80, 0.52, ht + 0.03),
          "trim_hypermarche", coll, uv="trim:joint_caoutchouc")
    # Piles de dossiers, en désordre.
    piles = []
    for i in range(rng.randint(2, 4)):
        x = 2.05 + rng.uniform(0.0, 0.55)
        y = 0.25 + rng.uniform(0.0, 0.75)
        piles.append(((x, y, ht, x + 0.30, y + 0.22, ht + rng.uniform(0.04, 0.16)), "world"))
    H.boxes(f"{name}_dossiers", piles, "carton", coll)

    # Fauteuil, tourné au hasard vers le bureau.
    a = rng.uniform(-0.25, 0.25)
    fx, fy = 1.50 + a, pr + 0.55
    # Ardoise unie sur le nuancier : en `trim_hypermarche` projeté monde, le
    # fauteuil prenait des rayures de chantier jaunes et noires.
    fauteuil = H.boxes(f"{name}_fauteuil", [
        ((fx - 0.28, fy - 0.28, 0.42, fx + 0.28, fy + 0.28, 0.50), "aplat:#2f3541"),
        ((fx - 0.28, fy + 0.16, 0.50, fx + 0.28, fy + 0.28, 1.02), "aplat:#2f3541"),
        ((fx - 0.06, fy - 0.06, 0.06, fx + 0.06, fy + 0.06, 0.42), "aplat:#444a54"),
        ((fx - 0.30, fy - 0.05, 0.04, fx + 0.30, fy + 0.05, 0.10), "aplat:#444a54"),
        ((fx - 0.05, fy - 0.30, 0.04, fx + 0.05, fy + 0.30, 0.10), "aplat:#444a54"),
    ], "palette", coll)

    orienter_equipements_poste(plateau, fauteuil, pied, dos, ecran, clavier)
    H.col_box(name[4:], (0, 0, 0, lo, pr, ht), coll)
    return name


def cloison_bureau(longueur: float = 12.0) -> str:
    """Cloison de bureau : plein en bas, vitré en haut.

    2 m de haut — au-dessus des 1,60 m des yeux, donc un vrai couvert. La
    partie « vitrée » est un cadre ajouré. Du vrai verre est possible (une
    `vitre_*`, voir `lib_helpers.textured_material("verre")`) : c'est ce que
    porte la cloison de l'étage des bureaux. Celle-ci reste ajourée, et un
    cadre à claire-voie se lit comme une verrière de cloison.
    """
    name = f"str_cloison_bureau_{longueur:g}m".replace(".", "_")
    coll, done = asset_coll(name)
    if done:
        return name
    lo, ep, ht = longueur, 0.25, 2.0
    H.box(f"{name}_plein", (0, 0, 0, lo, ep, 1.05), "mur_platre", coll, subdiv=0.7)
    H.box(f"{name}_plinthe", (0, -0.01, 0, lo, ep + 0.01, 0.12),
          "trim_hypermarche", coll, uv="trim:plinthe")
    cadre = [((0, 0.06, 1.05, lo, ep - 0.06, 1.18), "world"),
             ((0, 0.06, ht - 0.10, lo, ep - 0.06, ht), "world")]
    x = 0.0
    while x < lo - 0.08:
        cadre.append(((x, 0.06, 1.18, x + 0.08, ep - 0.06, ht - 0.10), "world"))
        x += 1.20
    H.boxes(f"{name}_cadre", cadre, "metal_bac_acier", coll)
    H.col_box(name[4:], (0, 0, 0, lo, ep, ht), coll)
    return name


def armoire_dossiers(seed: int = 0) -> str:
    """Armoire à dossiers, un tiroir parfois resté ouvert."""
    name = f"mob_armoire_dossiers_{seed}"
    coll, done = asset_coll(name)
    if done:
        return name
    rng = random.Random(seed or 4)
    lo, pr, ht = 0.90, 0.55, 1.35
    H.box(f"{name}_caisson", (0, 0, 0, lo, pr, ht), "metal_bac_acier", coll, subdiv=0.8)
    tiroirs, ouverts = [], []
    for i in range(4):
        z = 0.06 + i * 0.32
        if rng.random() < 0.25:
            ouverts.append(((0.05, -0.34, z, lo - 0.05, 0.0, z + 0.26), "world"))
            ouverts.append(((0.10, -0.30, z + 0.26, lo - 0.10, -0.04, z + 0.40), "world"))
        else:
            tiroirs.append(((0.05, -0.02, z, lo - 0.05, 0.0, z + 0.26), "world"))
    # Façades de tiroir en plâtre clair sur caisson d'acier. Elles prenaient la
    # bande de bordure `trim_hypermarche` en projection monde, donc au hasard :
    # des rayures de chantier jaunes et noires, et l'armoire se lisait comme une
    # caisse de chantier.
    H.boxes(f"{name}_tiroirs", tiroirs, "mur_platre", coll)
    if ouverts:
        H.boxes(f"{name}_ouverts", ouverts, "carton", coll)
    H.col_box(name[4:], (0, 0, 0, lo, pr, ht), coll)
    return name


def fontaine_eau() -> str:
    """Fontaine à bonbonne. Petite, mais c'est l'objet qui dit « bureaux »
    plus vite que n'importe quel meuble."""
    name = "deco_fontaine_eau"
    coll, done = asset_coll(name)
    if done:
        return name
    H.box(f"{name}_socle", (0, 0, 0, 0.36, 0.36, 1.05), "mur_platre", coll)
    H.cylinder(f"{name}_bonbonne", (0.18, 0.18), 0.16, 1.05, 1.55,
               "trim_hypermarche", coll, segments=8)
    H.box(f"{name}_robinet", (0.13, -0.06, 0.72, 0.23, 0.0, 0.82), "metal_bac_acier", coll)
    H.col_box(name[5:], (0, 0, 0, 0.36, 0.36, 1.55), coll)
    return name


def build_all() -> list[str]:
    """Construit tout le module. Idempotent, comme les autres bibliothèques."""
    names = [comptoir_self(12.0), cloison_bureau(12.0), fontaine_eau()]
    names += [table_cafeteria(s) for s in range(3)]
    names += [distributeur(f) for f in FACADES_DISTRIBUTEUR]
    names += [poste_bureau(s) for s in range(4)]
    names += [armoire_dossiers(s) for s in range(2)]
    names += [meuble(m) for m in MEUBLES]
    return names
