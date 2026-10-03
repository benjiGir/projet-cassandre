"""Briques partagées entre espaces : semis, néons, pose d'assets, fenêtres, cloisons.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

import bmesh
import bpy
from dataclasses import replace
from mathutils import Matrix

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_bureaux as B           # noqa: E402
import lib_rayons as L            # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.coque import SUBDIV_BAKE

SEED = 20260913                 # graine des semis déterministes du niveau


# --- Lampes ------------------------------------------------------------------


def lampe(coll, nom: str, position, color: str = "#dceeff",
          intensity: float = 6.0, distance: float = 12.0, decay: float = 2.0):
    """Empty `light_*` — `loader.ts` en fait un `THREE.PointLight`.

    Un empty plutôt qu'une vraie lampe Blender exportée en `KHR_lights_punctual` :
    la scène de bake a ses propres sources, et le watt de Blender ne se convertit
    pas en intensité three.js. L'empty porte exactement les paramètres de
    `PointLight`, lisibles tels quels.
    """
    obj = bpy.data.objects.new(nom, None)
    obj.location = position
    obj.empty_display_size = 0.3
    obj["color"] = color
    obj["intensity"] = intensity
    obj["distance"] = distance
    obj["decay"] = decay
    coll.objects.link(obj)
    return obj


def _emprise(asset: str) -> tuple[float, float, float]:
    """(lx, ly, lz) d'un asset de la bibliothèque, en local, collider exclu.
    Pour poser un modèle importé contre un mur sans deviner ses cotes."""
    objs = [o for o in bpy.data.collections[asset].objects if not o.name.startswith("col_")]
    pts = [v.co for o in objs for v in o.data.vertices]
    return tuple(max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3))


def semer(props, col_coll, prefixe: str, items) -> int:
    """Sème du mobilier Kenney repeint sur la palette (voir `lib_bureaux.meuble`).

    Tout le kit tient dans un seul matériau, donc ces objets ne coûtent aucun
    lot de dessin supplémentaire là où il y en a déjà un — c'est ce qui permet
    d'en mettre PARTOUT. `items` : (modèle, x, y, z, rotation en degrés).
    """
    for i, (modele, x, y, zz, rot) in enumerate(items):
        L.place(B.meuble(modele), (x, y, zz), rot, props, col_coll, f"{prefixe}{i}")
    return len(items)


def _cle(prefixe: str, x: float, y: float, suffixe: str = "") -> str:
    """Nom stable et lisible pour une rampe ou une lampe, à partir de ses cotes.
    Les coordonnées négatives deviennent `m` — un `-` dans un nom d'objet
    Blender traverse l'export mais rend les noms pénibles à lire en console."""
    return f"{prefixe}_{x:g}_{y:g}{suffixe}".replace(".", "_").replace("-", "m")


def _neons(space, props, logic, xs, ys, morts, prefixe: str, doubles=(),
           couleur: str = "#dceeff", intensite: float = 6.0,
           portee: float = 11.0, positions=None) -> tuple[int, int]:
    """Pose une grille de rampes de néons et les lampes de JEU correspondantes.

    Règle non négociable, héritée de la salle d'essai de N4 : **les rampes
    courent au-dessus des allées et des dégagements, jamais au-dessus d'un
    meuble**. C'est ce qui fait que les gondoles reçoivent la lumière de biais
    et que leurs tablettes basses restent dans l'ombre des hautes. Les `xs`/`ys`
    passés ici sont donc des cotes de circulation, pas une grille régulière.

    **Deux lampes** pour une rampe dont l'axe est dans `doubles`, une seule
    sinon : une lampe ponctuelle au milieu d'un tube de 4 m donne une flaque
    ronde là où il faut une traînée, mais un couloir n'a pas besoin des deux.

    Un tube `mort` ne porte AUCUNE lampe : c'est ce qui creuse les zones
    sombres. Il reste éclairé par ses voisins, comme un tube grillé.

    `positions` remplace la grille `xs` × `ys` par une liste explicite, quand
    les allées d'un espace ne forment pas une grille (l'électroménager).
    """
    ht = space.z + space.hauteur
    rampes = lampes = 0
    for x, y in positions or [(x, y) for x in xs for y in ys]:
        mort = (x, y) in morts
        L.place(L.neon(4.0, eteint=mort), (x, y, ht - 0.18), 90,
                props, props, _cle(f"{prefixe}_n", x, y))
        rampes += 1
        if mort:
            continue
        for k, dy in enumerate((1.0, 3.0) if x in doubles else (2.0,)):
            lampe(logic, "light_" + _cle(prefixe, x, y, f"_{k}"),
                  (x - 0.17, y + dy, ht - 0.65),
                  color=couleur, intensity=intensite, distance=portee)
            lampes += 1
    return rampes, lampes


# --- Poser un meuble d'après ses VRAIES cotes -------------------------------
#
# Tous les assets de la bibliothèque, kits CC0 compris, regardent le −y local.
# Deviner la rotation d'après un voisin a déjà coûté des téléviseurs tournés
# vers le mur (électroménager, N9) : `poser` prend l'emprise VOULUE au sol (coin
# minimal) et le côté vers lequel la façade doit regarder, et calcule seul
# l'origine et la rotation depuis les cotes réelles de l'asset.

_ROTATION_FACE = {"-y": 0, "+x": 90, "+y": 180, "-x": 270}


def poser(asset: str, x_min: float, y_min: float, z: float, face: str, props, col_coll,
          suffixe: str) -> tuple[float, float, float, float]:
    """Pose `asset` pour que son emprise commence à (x_min, y_min) et que sa
    façade regarde `face`. Retourne l'emprise monde (x0, y0, x1, y1)."""
    lx, ly, _ = _emprise(asset)
    rot = _ROTATION_FACE[face]
    if face in ("-y", "+y"):
        w, d = lx, ly
    else:
        w, d = ly, lx
    origine = {"-y": (x_min, y_min), "+y": (x_min + lx, y_min + ly),
               "+x": (x_min + ly, y_min), "-x": (x_min, y_min + lx)}[face]
    L.place(asset, (origine[0], origine[1], z), rot, props, col_coll, suffixe)
    return (x_min, y_min, x_min + w, y_min + d)


def vraie_fenetre(nom: str, espace: str, bornes, props) -> None:
    """Perce une VRAIE fenêtre dans un mur de coque : on voit la ville au loin
    (le ciel de `render/environment/ciel.ts`), plus un aplat bleu nuit.

    Seul le RENDU du mur est percé : son collider reste plein, donc la vitre
    n'a pas besoin du sien (`solide: false`) et reste incassable — casser une
    fenêtre sur le vide pour trouver un mur invisible derrière serait pire que
    de ne rien casser. Ne percer que des murs qui donnent sur l'EXTÉRIEUR du
    bâtiment : les toits n'existent pas, un plafond ne se voit que d'en dessous.

    `bornes` : le trou, en monde, à travers toute l'épaisseur du mur.
    """
    hx0, hy0, hz0, hx1, hy1, hz1 = bornes
    le_long_x = (hx1 - hx0) > (hy1 - hy0)
    # Les murs viennent d'être créés : sans cette mise à jour, leur
    # `matrix_world` vaut encore l'identité.
    bpy.context.view_layer.update()
    murs = []
    for o in list(bpy.data.collections["SHELL"].objects):
        if not o.name.startswith(f"mur_{espace}_"):
            continue
        pts = [o.matrix_world @ v.co for v in o.data.vertices]
        w = tuple(min(p[i] for p in pts) for i in range(3)) + tuple(max(p[i] for p in pts) for i in range(3))
        if w[0] <= hx0 + 1e-6 and w[3] >= hx1 - 1e-6 and w[1] <= hy0 + 1e-6 and w[4] >= hy1 - 1e-6 \
                and w[2] <= hz0 + 1e-6 and w[5] >= hz1 - 1e-6:
            murs.append((o, w))
    if len(murs) != 1:
        raise RuntimeError(f"{nom} : {len(murs)} murs de {espace} contiennent le trou {bornes}")
    mur, (wx0, wy0, wz0, wx1, wy1, wz1) = murs[0]
    materiau = mur.data.materials[0]
    nom_mur = mur.name
    bpy.data.objects.remove(mur, do_unlink=True)
    coll = bpy.data.collections["SHELL"]
    mats = {"mur": materiau}
    if le_long_x:
        morceaux = [((wx0, wy0, wz0), (wx1 - wx0, wy1 - wy0, hz0 - wz0)),
                    ((wx0, wy0, hz1), (wx1 - wx0, wy1 - wy0, wz1 - hz1)),
                    ((wx0, wy0, hz0), (hx0 - wx0, wy1 - wy0, hz1 - hz0)),
                    ((hx1, wy0, hz0), (wx1 - hx1, wy1 - wy0, hz1 - hz0))]
    else:
        morceaux = [((wx0, wy0, wz0), (wx1 - wx0, wy1 - wy0, hz0 - wz0)),
                    ((wx0, wy0, hz1), (wx1 - wx0, wy1 - wy0, wz1 - hz1)),
                    ((wx0, wy0, hz0), (wx1 - wx0, hy0 - wy0, hz1 - hz0)),
                    ((wx0, hy1, hz0), (wx1 - wx0, wy1 - hy1, hz1 - hz0))]
    for i, (origine, taille) in enumerate(morceaux):
        bo.boite(f"{nom_mur}_{nom}{i}", origine, taille, "mur", mats, coll, None, avec_collider=False)
    # Dormant alu sur le pourtour du trou, la vitre au milieu de l'épaisseur,
    # une tablette côté intérieur.
    e = 0.05
    if le_long_x:
        cadre = [(hx0, wy0, hz0, hx1, wy1, hz0 + e), (hx0, wy0, hz1 - e, hx1, wy1, hz1),
                 (hx0, wy0, hz0, hx0 + e, wy1, hz1), (hx1 - e, wy0, hz0, hx1, wy1, hz1),
                 ((hx0 + hx1) / 2 - 0.025, wy0 + 0.1, hz0, (hx0 + hx1) / 2 + 0.025, wy1 - 0.1, hz1)]
        milieu = (wy0 + wy1) / 2
        vitre = (hx0 + e, milieu - 0.01, hz0 + e, hx1 - e, milieu + 0.01, hz1 - e)
    else:
        cadre = [(wx0, hy0, hz0, wx1, hy1, hz0 + e), (wx0, hy0, hz1 - e, wx1, hy1, hz1),
                 (wx0, hy0, hz0, wx1, hy0 + e, hz1), (wx0, hy1 - e, hz0, wx1, hy1, hz1),
                 (wx0 + 0.1, (hy0 + hy1) / 2 - 0.025, hz0, wx1 - 0.1, (hy0 + hy1) / 2 + 0.025, hz1)]
        milieu = (wx0 + wx1) / 2
        vitre = (milieu - 0.01, hy0 + e, hz0 + e, milieu + 0.01, hy1 - e, hz1 - e)
    H.boxes(f"{nom}_cadre", [(b, "world") for b in cadre], "metal_bac_acier", props)
    v = H.box(f"vitre_{nom}", vitre, "verre", props, uv=f"aplat:{H.VERRE_TEINTE}")
    v["solide"] = False
    # Le mur supprimé resterait sinon dans la liste des objets de la vue.
    bpy.context.view_layer.update()


def cylindre_aplat(nom: str, centre, rayon: float, z0: float, z1: float, couleur: str, coll,
                   segments: int = 8):
    """Cylindre d'UNE couleur du nuancier : `H.cylinder` projette ses UV comme une
    boîte, ce qui sur `palette.png` donnerait un arc-en-ciel. Ses UV sont donc
    ramenées sur le pavé de la couleur voulue — un matériau de plus : aucun."""
    obj = H.cylinder(nom, centre, rayon, z0, z1, "palette", coll, segments=segments)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    couche = bm.loops.layers.uv.active
    teinte = H._uv_aplat(couleur)
    for face in bm.faces:
        teinte(face, couche)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def _fournil_mesh_aplat(nom: str, bm, couleur: str, coll):
    """Finalise un petit mesh de fournil à couleur uniforme de palette."""
    bm.normal_update()
    uv = bm.loops.layers.uv.new("UVMap")
    mapper = H._uv_aplat(couleur)
    for face in bm.faces:
        mapper(face, uv)
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(nom, me)
    obj.data.materials.append(H.textured_material("palette"))
    coll.objects.link(obj)
    return obj


def blobs_fournil(nom: str, volumes, couleur: str, coll):
    """Volumes bouffis très simples pour rendre la pâte lisible à distance."""
    bm = bmesh.new()
    for centre, echelle in volumes:
        resultat = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=6, radius=1.0)
        for v in resultat["verts"]:
            v.co = (centre[0] + v.co.x * echelle[0],
                    centre[1] + v.co.y * echelle[1],
                    centre[2] + v.co.z * echelle[2])
    return _fournil_mesh_aplat(nom, bm, couleur, coll)


def cloison_pleine(nom: str, bornes, props, col_coll, texture: str = "mur_platre") -> None:
    """Cloison de bureau jusqu'au plafond, avec son collider. Une cloison
    d'étage est un mur : on ne la franchit que par sa porte."""
    H.box(nom, bornes, texture, props, subdiv=SUBDIV_BAKE)
    H.col_box(nom, bornes, col_coll)


def habiller_dans_repere(space, reference_x, recipe, gris, props, col_coll, logic):
    """Déplace une composition fixe avec ses colliders et origines d'usage."""
    collections = (props, col_coll, logic)
    avant = {o for c in collections for o in c.objects}
    reference = replace(space, x=reference_x)
    result = recipe(reference, gris, props, col_coll, logic)
    bpy.context.view_layer.update()
    matrice = Matrix.Translation((space.x[0] - reference_x[0], 0, 0))
    poses = {o: o.matrix_world.copy() for c in collections for o in c.objects if o not in avant}
    for obj, pose in poses.items():
        obj.matrix_world = matrice @ pose
    return result
