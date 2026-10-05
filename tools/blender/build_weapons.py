"""
Armes du joueur en vue subjective — PROJET_CASSANDRE.

    blender -b --factory-startup -P tools/blender/build_weapons.py

Construit les trois armes et leurs mains, y pose les avant-bras
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
    --blend FICHIER    scène Blender éditable (facultatif)

Code retour : 0 = export écrit, 1 = échec.
"""

from __future__ import annotations

import math
import os
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from weapons.config import PALETTE, BOUT_CANON_PISTOLET, BOUT_CANON_POMPE, CENTRE_FUT
from weapons.geometry import srgb_lineaire, nouveau_mesh, teindre, pave, tube, balayage, fusionner
from weapons.pistol import construire_pistolet
from weapons.shotgun import construire_pompe
from weapons.hands import construire_main

SOURCE = "assets_src/cc0_raw/quaternius_man_long_sleeves/man_long_sleeves.glb"
# Gabarit des BRAS, pas du héros : à 1,80 m, un bras de 56 cm ne peut pas tenir
# le fût d'une pompe posée dans le champ. Tous les viewmodels trichent ainsi,
# et des mains plus grandes se lisent mieux à 640×360.
GABARIT_BRAS = 2.20

# Champ de vision vertical et proportions du jeu (`moveConfig.fovBase`, 640×360).
FOV_VERTICAL_DEG = 75
RENDU_W, RENDU_H = 640, 360


# Placement des armes dans le repère de l'œil (mètres, X droite, Y devant,
# Z haut) : le point où se referme la main droite. C'est ICI qu'on règle la
# place de l'arme à l'écran.
PRISE_PDB = (0.27, 0.40, -0.26)
AXE_PDB = (-0.15, 0.90, 0.60)          # la barre pointe devant, le col s'arrête sous le réticule
PRISE_POMPE = (0.21, 0.30, -0.25)
AXE_CANON = (-0.06, 1.0, 0.07)         # presque droit devant : on voit le flanc gauche
# Board de références (docs/journal/playtests-2026-09.md, section 3.3) : la
# culasse descend d'environ 3,4 cm à prise égale par rapport à l'ancien
# modèle (dessus à +0,085 contre +0,119) — la prise recule et descend pour
# garder le bout du canon au même endroit à l'écran.
PRISE_PISTOLET = (0.16, 0.30, -0.20)
AXE_PISTOLET = (-0.07, 1.0, 0.10)      # plus relevé que le pompe : une arme de poing se tient haut
# Un vrai pistolet (22 cm) tenu à bout de bras ne couvre presque rien de
# l'écran : agrandi comme les bras le sont déjà (`GABARIT_BRAS`), il retrouve
# le poids visuel du pompe. Le modèle au sol, lui, garde sa vraie taille.
ECHELLE_PISTOLET_VM = 1.25

def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg_value(args, flag, default):
    return args[args.index(flag) + 1] if flag in args else default



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

    def poser(self, prise: Matrix, coude: Vector, recul_poignet: float = 0.075,
              decalage_paume: float = 0.035, poignet: Vector | None = None):
        """`prise` : repère de la main (axes du modèle) centré sur l'objet saisi.
        `poignet` donne une cible explicite pour le raccord d'une main originale.
        Sinon le poignet recule le long des doigts et sort vers le dos de la main."""
        y = Vector(prise.col[1][:3])
        z = Vector(prise.col[2][:3])
        centre = Vector(prise.col[3][:3])
        self.cible.location = poignet if poignet is not None else centre - y * recul_poignet + z * decalage_paume
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
    """Copie figée des manches ; la peau source est remplacée par les mains originales."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    me.transform(mesh.matrix_world)

    groupes = {g.index: g.name for g in mesh.vertex_groups}
    garder = {f"LowerArm.{c}" for c in cotes}
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
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if matieres[f.material_index] == "Skin"], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(me)
    bm.free()
    me.materials.clear()
    for p in me.polygons:
        p.use_smooth = False

    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    rgba = srgb_lineaire(PALETTE["manche"])
    for p in me.polygons:
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
    main_pdb = repere(prise_pdb, -axe_pdb, oeil.avant)
    prise_main = repere(prise_pdb, oeil.droite, axe_pdb.cross(oeil.droite)) @ Matrix.Rotation(math.radians(65), 4, "Z")
    droit.poser(main_pdb, coude=oeil.monde((0.55, 0.15, -0.43)),
                poignet=prise_main @ Vector((0.033, -0.077, -0.018)))
    droit.fermer_poing(95, 35)
    bpy.context.view_layer.update()
    print("[armes] pied-de-biche,", droit.ecart())
    bras_pdb = extraire_avant_bras(scene, mesh, ("R",), "bras_pdb")
    poignet = arm.matrix_world @ arm.pose.bones["Palm.R"].head
    main = construire_main(prise_main, poignet, "crowbar", "main_pdb")
    vm_crowbar = fusionner("vm_crowbar", [pdb, bras_pdb, main])
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
    prise_main_pist = arme_pist @ Matrix.Scale(ECHELLE_PISTOLET_VM, 4)
    droit.poser(main_pist, coude=oeil.monde((0.43, -0.05, -0.40)),
                poignet=prise_main_pist @ Vector((0.032, -0.078, -0.025)))
    droit.fermer_poing(100, 30)
    bpy.context.view_layer.update()
    print("[armes] pistolet,", droit.ecart())
    bras_pist = extraire_avant_bras(scene, mesh, ("R",), "bras_pistolet")
    poignet = arm.matrix_world @ arm.pose.bones["Palm.R"].head
    main = construire_main(prise_main_pist, poignet, "pistol", "main_pistolet")
    vm_pistol = fusionner("vm_pistol", [pistolet, bras_pist, main])
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
    centre_fut = Vector(arme @ Vector(CENTRE_FUT))
    main_fut = repere(centre_fut - haut_arme * 0.02, axe_canon, droite_arme)
    gauche.poser(main_fut, coude=oeil.monde((-0.25, 0.25, -0.75)), recul_poignet=0.085, decalage_paume=0.04)
    gauche.fermer_poing(85, 20)
    bpy.context.view_layer.update()
    print("[armes] pompe,", droit.ecart())
    print("[armes] pompe,", gauche.ecart())
    bras_droit = extraire_avant_bras(scene, mesh, ("R",), "bras_pompe_d")
    bras_gauche = extraire_avant_bras(scene, mesh, ("L",), "bras_pompe_g")
    poignet_d = arm.matrix_world @ arm.pose.bones["Palm.R"].head
    poignet_g = arm.matrix_world @ arm.pose.bones["Palm.L"].head
    main_d = construire_main(arme, poignet_d, "shotgun", "main_pompe_d")
    main_g = construire_main(arme @ Matrix.Translation(CENTRE_FUT), poignet_g, "support", "main_pompe_g")
    vm_shotgun = fusionner("vm_shotgun", [carcasse, bras_droit, main_d])
    placer(vm_shotgun, vers_oeil)
    vm_pump = fusionner("vm_shotgun_pump", [fut, bras_gauche, main_g])
    placer(vm_pump, vers_oeil)

    # Tout ce que le jeu doit savoir de la géométrie voyage dans les extras,
    # en repère glTF : rien à deviner ni à recopier en TypeScript.
    vm_pump.parent = vm_shotgun
    # Surtout pas `pivot` : `GLTFLoader` (three r185) réserve cet extra pour
    # `Object3D.pivot` et l'efface de tout nœud qui a des enfants.
    vm_crowbar["prise"] = vers_gltf(PRISE_PDB)
    vm_pistol["prise"] = vers_gltf(PRISE_PISTOLET)
    vm_pistol["axe_canon"] = vers_gltf(Vector(AXE_PISTOLET).normalized())
    vm_pistol["bout_canon"] = vers_gltf(
        vers_oeil @ (arme_pist @ (Matrix.Scale(ECHELLE_PISTOLET_VM, 4) @ Vector(BOUT_CANON_PISTOLET))))
    vm_shotgun["prise"] = vers_gltf(PRISE_POMPE)
    vm_shotgun["bout_canon"] = vers_gltf(vers_oeil @ (arme @ Vector(BOUT_CANON_POMPE)))
    vm_pump["axe_glissiere"] = vers_gltf(Vector(AXE_CANON).normalized())

    return vm_crowbar, vm_pistol, vm_shotgun, vm_pump


def armes_au_sol():
    """Mêmes armes, sans bras, posées à plat : origine au centre, longueur
    le long de +Y, dessous à Z = 0."""
    pdb = construire_pied_de_biche()
    placer(pdb, Matrix.Rotation(math.radians(90), 4, "Y") @ Matrix.Translation((0, -0.1, 0)))
    pistolet = construire_pistolet(vue_subjective=False)
    pistolet.name = pistolet.data.name = "world_pistol"
    placer(pistolet, Matrix.Rotation(math.radians(90), 4, "Y"))
    carcasse, fut = construire_pompe()
    pompe = fusionner("world_shotgun", [carcasse, fut])
    placer(pompe, Matrix.Rotation(math.radians(90), 4, "Y"))
    pdb.name = pdb.data.name = "world_crowbar"
    for ob in (pdb, pistolet, pompe):
        coins = [v.co for v in ob.data.vertices]
        centre = Vector([(min(c[i] for c in coins) + max(c[i] for c in coins)) / 2 for i in range(3)])
        zmin = min(c.z for c in coins)
        ob.data.transform(Matrix.Translation((-centre.x, -centre.y, -zmin)))
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
        points = [o.matrix_world @ v.co for o in scene.objects
                  if o.name in visibles for v in o.data.vertices]
        bas = Vector([min(p[i] for p in points) for i in range(3)])
        haut = Vector([max(p[i] for p in points) for i in range(3)])
        centre = (bas + haut) / 2
        taille = haut - bas
        for vue, (echelle, m) in vues.items():
            if vue == "cote":
                m.translation = (3, centre.y, centre.z)
                echelle = max(taille.y, taille.z * RENDU_W / RENDU_H) * 1.12
            else:
                m.translation = (centre.x, centre.y, 3)
                echelle = max(taille.x, taille.y * RENDU_W / RENDU_H) * 1.12
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


def sauver_source(scene, chemin):
    for nom, prefixe in (("VUE_SUBJECTIVE", "vm_"), ("RAMASSAGES", "world_")):
        collection = bpy.data.collections.new(nom)
        scene.collection.children.link(collection)
        for ob in list(scene.objects):
            if not ob.name.startswith(prefixe):
                continue
            for ancienne in list(ob.users_collection):
                ancienne.objects.unlink(ob)
            collection.objects.link(ob)
            ob.hide_render = ob.name != "vm_pistol"
            ob.hide_set(ob.name != "vm_pistol")
    scene.camera = bpy.data.objects.get("oeil")
    os.makedirs(os.path.dirname(os.path.abspath(chemin)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(chemin))
    print(f"[armes] source {chemin}")


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
    if "--blend" in args:
        sauver_source(scene, arg_value(args, "--blend", "assets_src/blender/armes.blend"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
