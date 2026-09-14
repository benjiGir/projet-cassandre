"""
Armes du joueur en vue subjective — PROJET_CASSANDRE.

    blender -b --factory-startup -P tools/blender/build_weapons.py

Construit le pied-de-biche et le fusil à pompe par code, y pose les avant-bras
du « Man in Long Sleeves » CC0 de Quaternius (voir
`assets_src/LICENCES_ASSETS.md`), et exporte `public/assets/weapons/armes.glb` :

    vm_crowbar        pied-de-biche + avant-bras droit
    vm_shotgun        pompe (carcasse, canon) + avant-bras droit
      vm_shotgun_pump   fût mobile + avant-bras gauche (glisse au pompage)
    world_crowbar     pied-de-biche seul, à poser au sol
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
}

# Placement des armes dans le repère de l'œil (mètres, X droite, Y devant,
# Z haut) : le point où se referme la main droite. C'est ICI qu'on règle la
# place de l'arme à l'écran.
PRISE_PDB = (0.27, 0.40, -0.26)
AXE_PDB = (-0.15, 0.90, 0.60)          # la barre pointe devant, le col s'arrête sous le réticule
PRISE_POMPE = (0.21, 0.30, -0.25)
AXE_CANON = (-0.06, 1.0, 0.07)         # presque droit devant : on voit le flanc gauche

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
    vm_shotgun["prise"] = vers_gltf(PRISE_POMPE)
    vm_shotgun["bout_canon"] = vers_gltf(vers_oeil @ (arme @ Vector((0, 0.66, 0.118))))
    vm_pump["axe_glissiere"] = vers_gltf(Vector(AXE_CANON).normalized())

    return vm_crowbar, vm_shotgun, vm_pump


def armes_au_sol():
    """Mêmes armes, sans bras, posées à plat : origine au centre, longueur
    le long de +Y, dessous à Z = 0."""
    pdb = construire_pied_de_biche()
    placer(pdb, Matrix.Rotation(math.radians(90), 4, "Y") @ Matrix.Translation((0, -0.1, 0)))
    carcasse, fut = construire_pompe()
    pompe = fusionner("world_shotgun", [carcasse, fut])
    placer(pompe, Matrix.Rotation(math.radians(90), 4, "Y") @ Matrix.Translation((0, -0.25, -0.05)))
    pdb.name = pdb.data.name = "world_crowbar"
    for ob in (pdb, pompe):
        zmin = min(v.co.z for v in ob.data.vertices)
        ob.data.transform(Matrix.Translation((0, 0, -zmin)))
    return pdb, pompe


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
            print(f"[armes] {o.name}: {len(xs)} sommets, boîte {mn} -> {mx}")
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
    vm_crowbar, vm_shotgun, vm_pump = assembler(scene, arm, mesh, oeil)

    # Le héros n'a plus rien à faire dans la scène : seuls ses bras figés restent.
    for o in list(scene.objects):
        if o.type in {"ARMATURE", "EMPTY"} or o is mesh:
            bpy.data.objects.remove(o)
    world_crowbar, world_shotgun = armes_au_sol()

    rendre_vues(scene, {
        "pied_de_biche": {"vm_crowbar"},
        "pompe": {"vm_shotgun", "vm_shotgun_pump"},
    }, renders)
    if "--debug" in args:
        rendre_debug(scene, {"pied_de_biche": {"vm_crowbar"}, "pompe": {"vm_shotgun", "vm_shotgun_pump"}}, renders)
    exporter(out, [vm_crowbar, vm_shotgun, vm_pump, world_crowbar, world_shotgun])
    return 0


if __name__ == "__main__":
    sys.exit(main())
