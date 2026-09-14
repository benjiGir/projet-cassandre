"""
Sprites 8 directions des ennemis — PROJET_CASSANDRE.

    blender -b --factory-startup -P tools/blender/render_enemy_sprites.py -- \\
        --personnage costard

Rend un personnage 3D rigué (le « Man in Suit » CC0 de Quaternius, voir
`assets_src/LICENCES_ASSETS.md`) depuis huit angles, frame par frame, et
l'assemble en atlas pixel : la méthode de Duke 3D et de Blood, où le sprite
est un rendu 3D réduit, pas un dessin. Écrit dans `public/assets/sprites/` :

    <personnage>.png        atlas 8 colonnes × N lignes, une peau
    <personnage>_<peau>.png peaux supplémentaires, même disposition
    <personnage>.json       manifeste lu par `src/render/enemySprites.ts`

Convention de direction, la même que `src/render/billboard.ts` : la colonne 0
montre l'ennemi DE FACE, la colonne 2 le montre de son flanc DROIT (il regarde
vers la droite de l'écran), la colonne 4 de dos.

Ce qui n'existe pas dans le modèle est construit ici : le pistolet (accroché à
l'os `Palm.R`), les lunettes noires, la visée et le tir (contraintes Damped
Track sur le bras droit par-dessus l'animation), l'éclair de tir (peint en
pixels sur l'image réduite, toujours franc), et la peau reptilienne du
Directeur.

Options :
    --personnage NOM    costard | directeur (défaut : costard)
    --out DIR           dossier de sortie (défaut : public/assets/sprites)
    --anims a,b         ne rend que ces animations (itération rapide) ; écrit
                        alors `<personnage>_apercu.png` au lieu de l'atlas
    --directions 0,2    ne rend que ces colonnes (même effet que --anims)

Code retour : 0 = atlas et manifeste écrits, 1 = échec.
"""

from __future__ import annotations

import json
import math
import os
import sys

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

SOURCE = "assets_src/cc0_raw/quaternius_man_in_suit/man_in_suit.glb"

COLUMNS = 8
# Une case couvre 2,5 × 2 m au gabarit du Costard (96 px/m) : un corps
# allongé à la fin de la mort fait ~2,3 m, il lui faut la largeur. 96 px/m et
# non 64 : au corps à corps (1,5 m), l'écran de 360 px affiche déjà ~150 px
# par mètre, et un atlas à 64 px/m s'y agrandissait 2,4 fois.
CELL_W, CELL_H = 240, 192
# Pixels transparents sous les pieds : la ligne des pieds est la référence
# d'ancrage vertical en jeu (`feetFromBottom` du manifeste).
PAD_BOTTOM = 4
# Rendu à 4× puis réduction par moyenne de blocs : un pixel franc par bloc,
# sans l'escalier aléatoire d'un rendu direct à la taille de la case.
SUPERSAMPLE = 4
COULEURS_PALETTE = 48

# Le modèle regarde vers -Y (Blender, Z en haut) ; sa droite est donc -X.
AVANT = Vector((0.0, -1.0, 0.0))
DROITE = Vector((-1.0, 0.0, 0.0))


def hex_rgba(h: str) -> tuple[float, float, float, float]:
    """Couleur sRGB `#rrggbb` -> `diffuse_color` (linéaire, ce que Workbench lit)."""
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (lin[0], lin[1], lin[2], 1.0)


# Matériaux du modèle : `Shirt` est la veste, `TieTexture` le plastron de
# chemise (malgré son nom), `Hair` cheveux et barbe.
#
# Lisibilité à 640×360 : à 11 m un Costard ne fait que 38 px de haut. Ce qui
# se lit alors, ce sont des VALEURS (clair contre sombre) et des masses, pas
# des détails — d'où une veste gris ardoise plutôt que noire (un noir se
# confond avec toute ombre du niveau), un plastron blanc franc, un visage assez
# clair pour que les lunettes s'y découpent, et des membres épaissis.
PERSONNAGES = {
    "costard": {
        "hauteur": 1.80,
        "ppm": 96,
        "lunettes": True,
        "cravate": "#c8202c",
        "peaux": {
            "humain": {"Shirt": "#44475a", "Pants": "#383a4a", "TieTexture": "#f4f4f0", "Skin": "#c79468"},
        },
    },
    "directeur": {
        # Capsule du Directeur : 2,1 m (voir `DIRECTOR_SPRITE_HEIGHT`).
        "hauteur": 2.05,
        "ppm": 84,
        "lunettes": False,
        "cravate": "#e0a810",
        "peaux": {
            "humain": {"Shirt": "#c4bca0", "Pants": "#aea88e", "TieTexture": "#f4f4f0", "Hair": "#e6e6e6", "Skin": "#c79468"},
            "revele": {
                "Shirt": "#c4bca0", "Pants": "#aea88e", "TieTexture": "#f4f4f0",
                "Skin": "#58a03a", "Hair": "#2f6420",
                "_crete": True,
            },
        },
    },
}

# Silhouette : épaisseur ajoutée le long des normales avant tout rendu, et tête
# agrandie autour de la base du crâne. Le modèle Quaternius est élancé : ses
# avant-bras ne couvrent pas un pixel à 12 m, et c'est la tête (lunettes,
# visage) qui dit « Costard » avant tout le reste — les ennemis de Doom et de
# Duke 3D ont tous une tête trop grosse pour la même raison.
EPAISSEUR_M = 0.018
ECHELLE_TETE = 1.22

# Lignes de l'atlas, dans l'ordre. `visee` : influence des contraintes du bras
# droit par frame (0 = animation d'origine, 1 = bras tendu vers l'avant).
ANIMATIONS = [
    {"nom": "idle", "action": "Man_Idle", "frames": [0, 50], "fps": 1.5},
    {"nom": "alert", "action": "Man_Idle", "frames": [0, 0], "visee": [0.4, 0.75]},
    {"nom": "chase", "action": "Man_Run", "frames": [0, 3.5, 7, 10.5, 14, 17.5], "metersPerCycle": 2.8},
    {"nom": "aim", "action": "Man_Idle", "frames": [0], "visee": [1.0]},
    {"nom": "fire", "action": "Man_Idle", "frames": [0], "visee": [1.0], "recul": True, "eclair": True, "duration": 0.12},
    {"nom": "stagger", "action": "Man_Death", "frames": [4, 8]},
    {"nom": "death", "action": "Man_Death", "frames": [12, 20, 26, 29, 32, 50], "recentrer": True},
]


def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg_value(args, flag, default):
    return args[args.index(flag) + 1] if flag in args else default


# --- Scène -----------------------------------------------------------------


def importer_modele():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SOURCE)
    scene = bpy.context.scene
    arm = next(o for o in scene.objects if o.type == "ARMATURE")
    # Le .glb traîne une `Icosphere` hors du rig : seul le mesh skinné compte.
    for o in list(scene.objects):
        if o.type == "MESH" and o.parent is not arm:
            bpy.data.objects.remove(o)
    mesh = next(o for o in scene.objects if o.type == "MESH")
    racine = arm.parent
    if arm.animation_data is None:
        arm.animation_data_create()
    epaissir(arm, mesh)
    return scene, arm, mesh, racine


def epaissir(arm, mesh):
    """Membres épaissis et tête agrandie, sur la géométrie AU REPOS : la
    déformation du squelette s'applique ensuite, donc toutes les poses en
    héritent. Voir `EPAISSEUR_M` et `ECHELLE_TETE`."""
    bpy.context.view_layer.update()
    vers_monde = mesh.matrix_world
    vers_local = vers_monde.inverted()
    hauteur_modele = max((vers_monde @ v.co).z for v in mesh.data.vertices) - min(
        (vers_monde @ v.co).z for v in mesh.data.vertices)
    # L'épaisseur est en mètres ; le modèle mesure ~1,8 m au gabarit du Costard.
    decalage_monde = EPAISSEUR_M * hauteur_modele / 1.8

    groupes = {g.index: g.name for g in mesh.vertex_groups}
    base_tete = arm.matrix_world @ arm.data.bones["Head"].head_local
    for v in mesh.data.vertices:
        monde = vers_monde @ v.co
        normale = (vers_monde.to_3x3() @ v.normal).normalized()
        monde = monde + normale * decalage_monde
        dominant = max(v.groups, key=lambda g: g.weight, default=None)
        if dominant is not None and groupes.get(dominant.group) == "Head":
            monde = base_tete + (monde - base_tete) * ECHELLE_TETE
        v.co = vers_local @ monde
    mesh.data.update()


def poser(scene, arm, action: str, frame: float):
    # Les actions n'animent pas toutes les mêmes os (`Man_Idle` : 15 canaux,
    # `Man_Run` : 22) : un os absent de la nouvelle action garderait la pose de
    # la précédente — un pied de course traîne alors sous la visée.
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    arm.animation_data.action = bpy.data.actions["HumanArmature|" + action]
    scene.frame_set(int(math.floor(frame)), subframe=frame - math.floor(frame))


def bbox_monde(mesh) -> tuple[Vector, Vector]:
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    co = np.empty(len(ev.data.vertices) * 3)
    ev.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    mw = np.array(ev.matrix_world)
    pts = co @ mw[:3, :3].T + mw[:3, 3]
    return Vector(pts.min(axis=0)), Vector(pts.max(axis=0))


def boite(nom: str, taille: Vector, couleur: str) -> bpy.types.Object:
    """Pavé centré sur l'origine, dans son propre matériau."""
    me = bpy.data.meshes.new(nom)
    sx, sy, sz = (taille.x / 2, taille.y / 2, taille.z / 2)
    verts = [(x, y, z) for x in (-sx, sx) for y in (-sy, sy) for z in (-sz, sz)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    me.from_pydata(verts, [], faces)
    mat = bpy.data.materials.new(nom)
    mat.diffuse_color = hex_rgba(couleur)
    me.materials.append(mat)
    ob = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def fusionner(nom: str, pieces: list[bpy.types.Object]) -> bpy.types.Object:
    # L'import glTF laisse tout le personnage sélectionné : sans ce
    # désélectionner, `join` avale le mesh skinné dans le pistolet.
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for p in pieces:
        p.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    pieces[0].name = nom
    return pieces[0]


def accrocher(ob, arm, os_nom: str, monde: Matrix):
    """Parente `ob` à un os en gardant la transformation monde voulue."""
    ob.parent = arm
    ob.parent_type = "BONE"
    ob.parent_bone = os_nom
    bpy.context.view_layer.update()
    ob.matrix_world = monde


def repere_os(arm, os_nom: str) -> tuple[Vector, Vector, Vector, Vector]:
    """Origine et axes X, Y, Z normalisés d'un os posé, en monde."""
    pb = arm.pose.bones[os_nom]
    m = arm.matrix_world @ pb.matrix
    axes = [Vector(m.col[i][:3]).normalized() for i in range(3)]
    return Vector(m.col[3][:3]), axes[0], axes[1], axes[2]


def matrice(origine: Vector, x: Vector, y: Vector, z: Vector) -> Matrix:
    m = Matrix.Identity(4)
    for i, v in enumerate((x, y, z)):
        m.col[i][:3] = v
    m.col[3][:3] = origine
    return m


def installer_visee(scene, arm, k: float):
    """Contraintes Damped Track des deux bras vers une cible devant la poitrine.

    L'influence est pilotée par frame (`visee`) : 0 laisse l'animation
    d'origine, 1 tend les bras. Chaque os suit la cible sur son axe Y, qui va
    de l'articulation à la suivante.

    Prise à DEUX mains, sur l'axe du corps : vu de face, un bras seul tendu
    vers la caméra se raccourcit jusqu'à disparaître, et la télégraphie du tir
    devient illisible dans la direction qui compte le plus. Les deux manches
    qui convergent devant la chemise blanche, elles, se lisent à 40 px.
    """
    epaule = arm.matrix_world @ arm.pose.bones["UpperArm.R"].head
    cible = bpy.data.objects.new("cible_visee", None)
    scene.collection.objects.link(cible)
    # Les bras mesurent ~0,6 m : une cible à 1,2 m sur l'axe du corps fait se
    # rejoindre les mains devant le sternum.
    cible.location = Vector((0, epaule.y, epaule.z)) + AVANT * (1.2 * k) - Vector((0, 0, 0.10 * k))
    contraintes = []
    for os_nom in ("UpperArm.R", "LowerArm.R", "Palm.R", "UpperArm.L", "LowerArm.L", "Palm.L"):
        c = arm.pose.bones[os_nom].constraints.new("DAMPED_TRACK")
        c.target = cible
        c.track_axis = "TRACK_Y"
        c.influence = 0.0
        contraintes.append(c)
    return cible, contraintes


def construire_pistolet(scene, arm, k: float, contraintes) -> bpy.types.Object:
    """Pistolet exagéré (×1,6 : 13 px de long à 64 px/m, sinon illisible).

    Construit bras tendu, dans le repère de `Palm.R` : Y le long de la main
    (donc du canon), X vers le bas une fois le bras levé.
    """
    for c in contraintes:
        c.influence = 1.0
    poser(scene, arm, "Man_Idle", 0)
    bpy.context.view_layer.update()
    o, x, y, z = repere_os(arm, "Palm.R")

    e = 1.6 * k
    metal = "#4a4a52"
    canon = boite("pistolet", Vector((0.035, 0.20, 0.032)) * e, metal)
    canon.location = Vector((-0.05, 0.08, 0)) * e
    crosse = boite("crosse", Vector((0.09, 0.035, 0.030)) * e, "#2b2b30")
    crosse.location = Vector((0.0, 0.0, 0)) * e
    bpy.context.view_layer.update()
    for p in (canon, crosse):
        p.data.transform(Matrix.Translation(p.location))
        p.location = (0, 0, 0)
    pistolet = fusionner("pistolet", [canon, crosse])

    bout = bpy.data.objects.new("bout_canon", None)
    scene.collection.objects.link(bout)
    bout.parent = pistolet
    bout.location = Vector((-0.05, 0.19, 0)) * e

    # Crosse dans la paume, un peu vers les doigts.
    origine = o + y * (0.10 * k)
    accrocher(pistolet, arm, "Palm.R", matrice(origine, x, y, z))
    for c in contraintes:
        c.influence = 0.0
    return pistolet


def surface_avant(scene, x: float, z: float, k: float) -> float | None:
    """Coordonnée Y de la première surface touchée en tirant de face vers le
    personnage, à la hauteur `z` et au décalage latéral `x`."""
    dg = bpy.context.evaluated_depsgraph_get()
    ok, point, *_ = scene.ray_cast(dg, Vector((x, -3 * k, z)), -AVANT)
    return point.y if ok else None


def points_materiau(mesh, nom: str) -> list[Vector]:
    """Sommets déformés (pose courante), en monde, des faces d'un matériau."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    index = [m.name for m in ev.data.materials].index(nom)
    ids = {vi for p in ev.data.polygons if p.material_index == index for vi in p.vertices}
    return [ev.matrix_world @ ev.data.vertices[i].co for i in ids]


def construire_lunettes(scene, arm, mesh, k: float):
    """Barre noire posée DEVANT les yeux du modèle, trouvés par leur matériau
    (`Eyes`) : la tête est agrandie par `epaissir`, une hauteur en fraction du
    corps tomberait sur le front."""
    poser(scene, arm, "Man_Idle", 0)
    bpy.context.view_layer.update()
    # `Eyes` sert aussi à la ceinture et aux boutons : seuls comptent ceux de la tête.
    base_crane = (arm.matrix_world @ arm.pose.bones["Head"].head).z
    yeux = [p for p in points_materiau(mesh, "Eyes") if p.z > base_crane]
    centre = sum(yeux, Vector()) / len(yeux)
    # Le plus en avant des deux yeux et du visage qui les entoure, pour que la
    # barre ne s'enfonce nulle part.
    faces = [surface_avant(scene, centre.x + dx * k, centre.z + dz * k, k)
             for dx in (-0.05, 0.0, 0.05) for dz in (-0.015, 0.015)]
    avant = min(f for f in faces if f is not None)
    # Plus larges que nature : deux pixels de haut à 10 m, sinon elles disparaissent.
    lunettes = boite("lunettes", Vector((0.19, 0.035, 0.05)) * k, "#050507")
    accrocher(lunettes, arm, "Head", Matrix.Translation(Vector((centre.x, avant - 0.012 * k, centre.z))))


def construire_cravate(scene, arm, k: float, couleur: str):
    """La cravate du modèle est peinte sur toute la chemise : on en pose une vraie,
    du col au milieu du ventre."""
    poser(scene, arm, "Man_Idle", 0)
    bpy.context.view_layer.update()
    # Sous le menton : plus haut, le rayon touche la barbe, qui avance le haut
    # de la cravate et la décolle du torse de profil.
    haut_z = (arm.matrix_world @ arm.pose.bones["Neck"].head).z - 0.08 * k
    bas_z = haut_z - 0.32 * k
    dg = bpy.context.evaluated_depsgraph_get()

    def buste(z):
        """Surface AVANT du plastron ou de la veste à cette hauteur, `None`
        ailleurs : un rayon qui touche la barbe dirait mal où est la cravate, et
        le modèle a un jour au milieu de la veste par lequel il atteint le dos
        (y > 0, le modèle regarde vers -Y)."""
        ok, point, _, face, obj, _ = scene.ray_cast(dg, Vector((0, -3 * k, z)), -AVANT)
        if not ok or obj.type != "MESH" or not obj.data.materials or point.y > -0.05 * k:
            return None
        nom = obj.data.materials[obj.data.polygons[face].material_index].name
        return point.y if nom in ("TieTexture", "Shirt") else None

    # Verticale, posée devant le point le plus avancé du buste : le jour de la
    # veste empêche d'échantillonner le ventre, et une cravate inclinée entre
    # deux points mal mesurés part en biais de profil.
    avant = min(y for y in (buste(bas_z + (haut_z - bas_z) * i / 8) for i in range(9)) if y is not None)
    longueur = haut_z - bas_z
    cravate = boite("cravate", Vector((0.085 * k, 0.02 * k, longueur)), couleur)
    centre = Vector((0, avant - 0.012 * k, (haut_z + bas_z) / 2))
    axe_x, axe_y, axe_z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    accrocher(cravate, arm, "Torso", matrice(centre, axe_x, axe_y, axe_z))


def construire_crete(scene, arm, k: float):
    """Trois pointes sur le crâne : ce qui fait « reptilien » à 120 px."""
    poser(scene, arm, "Man_Idle", 0)
    bpy.context.view_layer.update()
    o, *_ = repere_os(arm, "Head")
    _, haut = bbox_monde(next(ob for ob in scene.objects if ob.type == "MESH" and ob.parent is arm))
    for i, (dy, h) in enumerate(((-0.07, 0.13), (0.02, 0.17), (0.11, 0.12))):
        me = bpy.data.meshes.new(f"pointe{i}")
        r = 0.045 * k
        verts = [(-r, -r, 0), (r, -r, 0), (r, r, 0), (-r, r, 0), (0, 0, h * k)]
        me.from_pydata(verts, [], [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (3, 2, 1, 0)])
        mat = bpy.data.materials.new(f"pointe{i}")
        mat.diffuse_color = hex_rgba("#6fb33f")
        me.materials.append(mat)
        ob = bpy.data.objects.new(f"pointe{i}", me)
        scene.collection.objects.link(ob)
        accrocher(ob, arm, "Head", Matrix.Translation(Vector((o.x, o.y + dy * k, haut.z - 0.03 * k))))


def appliquer_peau(mesh, peau: dict):
    originales = PEAU_ORIGINALE
    for mat in mesh.data.materials:
        mat.diffuse_color = hex_rgba(peau[mat.name]) if mat.name in peau else originales[mat.name]


PEAU_ORIGINALE: dict = {}


# --- Rendu -----------------------------------------------------------------


def configurer_rendu(scene, k: float, ppm: int):
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_cavity = True
    # Pas de reflet : sur une face tournée vers la caméra (les lunettes vues de
    # face), il blanchit un noir en gris et efface le détail qui identifie.
    scene.display.shading.show_specular_highlight = False
    scene.display.shading.cavity_type = "WORLD"
    scene.render.film_transparent = True
    scene.render.resolution_x = CELL_W * SUPERSAMPLE
    scene.render.resolution_y = CELL_H * SUPERSAMPLE
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    # L'échelle ortho couvre la plus grande dimension de l'image : la largeur.
    cam_data.ortho_scale = CELL_W / ppm * k
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


def placer_camera(cam, direction: int, k: float, ppm: int):
    """Colonne `direction` : caméra tournée de `direction × 45°` depuis la
    face de l'ennemi, vers sa droite (convention de `billboard.ts`)."""
    a = direction * math.pi / 4
    vers_cam = AVANT * math.cos(a) + DROITE * math.sin(a)
    # Centre vertical de la case, pieds posés à PAD_BOTTOM pixels du bas.
    centre_z = (CELL_H / 2 - PAD_BOTTOM) / ppm * k
    cible = Vector((0, 0, centre_z))
    cam.location = cible + vers_cam * (20 * k)
    cam.rotation_euler = (cible - cam.location).to_track_quat("-Z", "Y").to_euler()


def rendre_case(scene, chemin: str) -> np.ndarray:
    """Rend, relit et réduit à la taille d'une case : RGBA 0-1, haut en premier."""
    scene.render.filepath = chemin
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(chemin)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    px = px.reshape(h, w, 4)[::-1]
    s = SUPERSAMPLE
    blocs = px.reshape(CELL_H, s, CELL_W, s, 4)
    alpha = blocs[..., 3]
    somme_a = alpha.sum(axis=(1, 3))
    rgb = (blocs[..., :3] * alpha[..., None]).sum(axis=(1, 3)) / np.maximum(somme_a[..., None], 1e-6)
    opaque = (somme_a / (s * s)) >= 0.5
    case = np.zeros((CELL_H, CELL_W, 4), dtype=np.float32)
    case[..., :3] = rgb
    case[..., 3] = opaque
    return case


# Éclair de tir, peint APRÈS la quantification : il ne couvre que quelques
# dizaines de pixels de l'atlas, les k-moyennes le fondraient dans un gris.
# 13 px : il porte le message « on te tire dessus », il doit se lire à 10 m.
ECLAIR = [
    "......o......",
    ".o....o....o.",
    "..o...y...o..",
    "...o.yyy.o...",
    "....yyWyy....",
    "...yyWWWyy...",
    "ooyyWWWWWyyoo",
    "...yyWWWyy...",
    "....yyWyy....",
    "...o.yyy.o...",
    "..o...y...o..",
    ".o....o....o.",
    "......o......",
]


def peindre_eclair(case: np.ndarray, px: int, py: int):
    couleurs = {"o": (1.0, 0.55, 0.1), "y": (1.0, 0.9, 0.3), "W": (1.0, 1.0, 0.85)}
    for j, ligne in enumerate(ECLAIR):
        for i, c in enumerate(ligne):
            if c == ".":
                continue
            x, y = px + i - len(ligne) // 2, py + j - len(ECLAIR) // 2
            if 0 <= x < CELL_W and 0 <= y < CELL_H:
                case[y, x, :3] = couleurs[c]
                case[y, x, 3] = 1.0


def quantifier(atlas: np.ndarray, n: int) -> np.ndarray:
    """k-moyennes sur les pixels opaques : une palette par atlas, stable d'une
    frame à l'autre (une palette par frame ferait scintiller les aplats)."""
    opaque = atlas[..., 3] > 0.5
    pixels = atlas[opaque][:, :3]
    rng = np.random.default_rng(0)
    echantillon = pixels[rng.choice(len(pixels), size=min(len(pixels), 60000), replace=False)]
    centres = echantillon[rng.choice(len(echantillon), size=n, replace=False)]
    for _ in range(20):
        d = ((echantillon[:, None, :] - centres[None]) ** 2).sum(-1)
        lab = d.argmin(1)
        for c in range(n):
            membres = echantillon[lab == c]
            if len(membres):
                centres[c] = membres.mean(0)
    sortie = atlas.copy()
    idx = np.empty(len(pixels), dtype=np.int64)
    for debut in range(0, len(pixels), 50000):
        bloc = pixels[debut:debut + 50000]
        idx[debut:debut + 50000] = ((bloc[:, None, :] - centres[None]) ** 2).sum(-1).argmin(1)
    sortie[opaque, :3] = centres[idx]
    return sortie


def ecrire_png(tableau: np.ndarray, chemin: str):
    h, w, _ = tableau.shape
    img = bpy.data.images.new(os.path.basename(chemin), w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(tableau[::-1]).astype(np.float32).ravel())
    img.filepath_raw = chemin
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def main() -> int:
    args = get_args()
    nom = arg_value(args, "--personnage", "costard")
    out = arg_value(args, "--out", "public/assets/sprites")
    filtre_anims = arg_value(args, "--anims", None)
    filtre_dirs = arg_value(args, "--directions", None)
    apercu = filtre_anims is not None or filtre_dirs is not None
    perso = PERSONNAGES[nom]
    os.makedirs(out, exist_ok=True)
    tmp = os.path.join(bpy.app.tempdir or "/tmp", f"sprite_{nom}.png")

    scene, arm, mesh, racine = importer_modele()
    for mat in mesh.data.materials:
        PEAU_ORIGINALE[mat.name] = tuple(mat.diffuse_color)
    poser(scene, arm, "Man_Idle", 0)
    bas, haut = bbox_monde(mesh)
    k = (haut.z - bas.z) / perso["hauteur"]  # unités du modèle par mètre
    ppm = perso["ppm"]

    cible, contraintes = installer_visee(scene, arm, k)
    cible_repos = cible.location.copy()
    construire_pistolet(scene, arm, k, contraintes)
    bout = bpy.data.objects["bout_canon"]
    construire_cravate(scene, arm, k, perso["cravate"])
    if perso["lunettes"]:
        construire_lunettes(scene, arm, mesh, k)
    # Toutes les pièces s'accrochent AVANT le premier rendu, rig au repos :
    # accrochée après, une pièce hérite de la dernière pose rendue (le corps
    # allongé de la mort) et flotte à côté du crâne.
    if any(peau.get("_crete") for peau in perso["peaux"].values()):
        construire_crete(scene, arm, k)
    cam = configurer_rendu(scene, k, ppm)

    anims = [a for a in ANIMATIONS if not filtre_anims or a["nom"] in filtre_anims.split(",")]
    dirs = [int(d) for d in filtre_dirs.split(",")] if filtre_dirs else list(range(COLUMNS))
    lignes = sum(len(a["frames"]) for a in anims)

    manifeste_anims = {}
    ligne = 0
    for a in anims:
        entree = {"row": ligne, "frames": len(a["frames"])}
        for cle in ("fps", "metersPerCycle", "duration"):
            if cle in a:
                entree[cle] = a[cle]
        manifeste_anims[a["nom"]] = entree
        ligne += len(a["frames"])

    atlases = {}
    for peau_nom, peau in perso["peaux"].items():
        appliquer_peau(mesh, peau)
        for o in scene.objects:
            if o.name.startswith("pointe"):
                o.hide_render = not peau.get("_crete", False)

        atlas = np.zeros((lignes * CELL_H, len(dirs) * CELL_W, 4), dtype=np.float32)
        eclairs = []
        ligne = 0
        for a in anims:
            reference_y = None
            for i, frame in enumerate(a["frames"]):
                influence = a.get("visee", [0.0] * len(a["frames"]))[i]
                for c in contraintes:
                    c.influence = influence
                cible.location = cible_repos + (Vector((0, 0, 0.12 * k)) if a.get("recul") else Vector())
                racine.location = (0, 0, 0)
                poser(scene, arm, a["action"], frame)
                if a.get("recentrer"):
                    # Le plongeon avance le corps de ~2 m : on le ramène au-dessus
                    # de la capsule, le long de l'axe avant seulement.
                    b0, b1 = bbox_monde(mesh)
                    milieu = (b0.y + b1.y) / 2
                    if reference_y is None:
                        poser(scene, arm, a["action"], 0)
                        r0, r1 = bbox_monde(mesh)
                        reference_y = (r0.y + r1.y) / 2
                        poser(scene, arm, a["action"], frame)
                    racine.location = (0, -(milieu - reference_y), 0)
                bpy.context.view_layer.update()
                for col, d in enumerate(dirs):
                    placer_camera(cam, d, k, ppm)
                    bpy.context.view_layer.update()
                    case = rendre_case(scene, tmp)
                    if a.get("eclair"):
                        sx, sy, profondeur = world_to_camera_view(scene, cam, bout.matrix_world.translation)
                        _, _, prof_corps = world_to_camera_view(scene, cam, Vector((0, 0, 1.3 * k)))
                        px_x, px_y = int(sx * CELL_W), int((1 - sy) * CELL_H)
                        # Visible si le canon est devant le corps, ou s'il
                        # dépasse de la silhouette (vu de trois quarts dos).
                        dehors = not (0 <= px_x < CELL_W and 0 <= px_y < CELL_H) or case[px_y, px_x, 3] < 0.5
                        if profondeur < prof_corps or dehors:
                            eclairs.append((ligne, col, px_x, px_y))
                    atlas[ligne * CELL_H:(ligne + 1) * CELL_H, col * CELL_W:(col + 1) * CELL_W] = case
                print(f"[sprites] {nom}/{peau_nom} {a['nom']} frame {i + 1}/{len(a['frames'])}", flush=True)
                ligne += 1

        atlas = quantifier(atlas, COULEURS_PALETTE)
        for ligne_e, col_e, px_x, px_y in eclairs:
            peindre_eclair(atlas[ligne_e * CELL_H:(ligne_e + 1) * CELL_H, col_e * CELL_W:(col_e + 1) * CELL_W], px_x, px_y)
        suffixe = "" if peau_nom == "humain" else f"_{peau_nom}"
        fichier = f"{nom}{suffixe}_apercu.png" if apercu else f"{nom}{suffixe}.png"
        ecrire_png(atlas, os.path.join(out, fichier))
        atlases[peau_nom] = fichier
        print(f"[sprites] écrit {os.path.join(out, fichier)} ({atlas.shape[1]}×{atlas.shape[0]})")

    if apercu:
        return 0

    manifeste = {
        "personnage": nom,
        "source": SOURCE,
        "cellWidth": CELL_W,
        "cellHeight": CELL_H,
        "columns": COLUMNS,
        "rows": lignes,
        "pixelsPerMeter": ppm,
        "feetFromBottom": PAD_BOTTOM,
        "atlases": atlases,
        "animations": manifeste_anims,
    }
    with open(os.path.join(out, f"{nom}.json"), "w", encoding="utf-8") as f:
        json.dump(manifeste, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"[sprites] écrit {os.path.join(out, nom + '.json')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
