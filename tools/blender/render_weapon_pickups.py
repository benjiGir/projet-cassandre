"""
Icônes des armes au sol — PROJET_CASSANDRE.

    blender -b --factory-startup -P tools/blender/render_weapon_pickups.py

Retour de vérification en jeu (2026-09-25, `retro-render`) sur la première
passe de ce billboard : un dessin procédural par canvas ne montrait qu'un
petit trait — ni la forme, ni l'échelle réelle de l'arme. Consigne : une
image PRÉ-RENDUE depuis le VRAI modèle `world_*`
(`tools/blender/build_weapons.py::armes_au_sol`, le même que celui tenu en
main) — même principe que `render_enemy_sprites.py` pour les ennemis, réduit
à un seul angle fixe par arme (un billboard yaw-only n'a besoin que d'UNE
image, il pivote lui-même vers la caméra).

Caméra orthographique « de profil » : elle vise le long de l'axe de PLUS
PETITE extension de la boîte englobante de l'arme (l'épaisseur, l'arme étant
posée à plat) et ROULE de 45° autour de cet axe. Sans ce roulis, la caméra
cadrerait l'arme droite : très longue (0,7-0,85 m) et très basse (quelques
cm), un rectangle en lame de rasoir qui ne remplit JAMAIS un cadre carré ou
portrait, quelle que soit la taille du texte du billboard — exactement le
défaut signalé. À 45°, la diagonale de l'arme couvre une portion proche du
carré (même geste que Duke 3D/Doom, dont les icônes de ramassage montrent
l'arme en biais plutôt que droite). Le cadrage EXACT (pas une formule
approchée) est mesuré en projetant les 8 coins de la boîte englobante sur les
axes caméra (droite, haut) une fois le roulis appliqué.

Écrit :

    public/assets/sprites/weapon_pickups.png    atlas, un rectangle par arme
    public/assets/sprites/weapon_pickups.json   manifeste (rect pixel + aspect)

Le manifeste sert de RÉFÉRENCE pour resynchroniser les constantes de
`render/pickups.ts` (UV figés, aspect par arme) : l'atlas n'est chargé qu'en
image au runtime (le jeu ne fait pas de fetch JSON supplémentaire au
chargement d'un niveau, pour rester synchrone — voir la doc de tête de
`render/pickups.ts`), donc CE fichier JSON n'est pas lu par le jeu, seulement
par un humain/agent qui régénère l'atlas et recopie les nombres.

Code retour : 0 = atlas + manifeste écrits, 1 = échec.
"""

from __future__ import annotations

import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
import build_weapons as bw  # noqa: E402  (après sys.path, par nécessité)

# Densité : même raisonnement que `render_enemy_sprites.py` (96 px/m, lisible
# au corps à corps) — ces icônes sont vues d'aussi près, sinon plus.
PX_PER_M = 96
PAD_M = 0.02  # marge autour de la silhouette, en mètres, avant mise à l'échelle px
SUPERSAMPLE = 4
GUTTER = 2  # px transparents entre deux icônes de l'atlas, anti-bleeding en NearestFilter

ARMES = ("melee", "pistol", "shotgun")


def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg_value(args, flag, default):
    return args[args.index(flag) + 1] if flag in args else default


def cadrage_profil(ob: bpy.types.Object):
    """Centre MONDE, et base caméra (droite, haut, vue) roulée à 45° autour de
    l'axe de plus petite extension — voir la doc de tête. Retourne aussi la
    largeur/hauteur EXACTES du cadrage (mètres), mesurées par projection des 8
    coins de la boîte englobante sur (droite, haut)."""
    coins = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    centre = sum(coins, Vector()) / 8
    axes = [Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))]
    etendues = [max(c[i] for c in coins) - min(c[i] for c in coins) for i in range(3)]
    ordre = sorted(range(3), key=lambda i: etendues[i])  # croissant : [fine, moyenne, longue]
    up0, droite0 = axes[ordre[2]], axes[ordre[1]]  # nominal, avant roulis

    c45, s45 = math.cos(math.radians(45)), math.sin(math.radians(45))
    haut = (up0 * c45 + droite0 * s45).normalized()
    droite = (droite0 * c45 - up0 * s45).normalized()
    vue = droite.cross(haut).normalized()  # garantit une base orthonormée cohérente (poignée de main)

    us = [(c - centre).dot(droite) for c in coins]
    vs = [(c - centre).dot(haut) for c in coins]
    largeur = max(us) - min(us) + 2 * PAD_M
    hauteur = max(vs) - min(vs) + 2 * PAD_M
    return centre, droite, haut, vue, largeur, hauteur


def placer_camera(cam: bpy.types.Object, centre: Vector, droite: Vector, haut: Vector, vue: Vector, portee: float):
    cam.location = centre + vue * portee
    rot = Matrix((tuple(droite), tuple(haut), tuple(vue))).transposed().to_4x4()
    cam.matrix_world = Matrix.Translation(cam.location) @ rot


def configurer_scene() -> bpy.types.Object:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    # Les armes portent leur couleur en attribut de sommet "Col"
    # (`build_weapons.py::teindre`), pas en `diffuse_color` de matériau.
    scene.display.shading.color_type = "VERTEX"
    scene.display.shading.show_cavity = True
    scene.display.shading.show_specular_highlight = False
    scene.display.shading.cavity_type = "WORLD"
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.sensor_fit = "HORIZONTAL"  # `ortho_scale` fixe alors la LARGEUR monde, sans ambiguïté d'aspect
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


def dilater(px: np.ndarray, iterations: int) -> np.ndarray:
    """Grossit la silhouette opaque de `iterations` pixels (4-voisins), en
    propageant la couleur du voisin opaque le plus proche dans les pixels
    transparents gagnés. Nécessaire : le pied-de-biche (2,4 cm de section) vu
    de profil reste un trait fin quel que soit l'angle de caméra — le
    problème n'est pas le cadrage (déjà carré, § `cadrage_profil`) mais
    l'épaisseur RÉELLE de l'objet. Grossir la silhouette avant la réduction
    supersamplée est la même famille de geste qu'un contour d'icône dessiné à
    la main : un trait plus gras, un bord toujours franc (pas de flou, juste
    plus de pixels opaques), donc dans le registre build-engine-look."""
    if iterations <= 0:
        return px
    alpha = px[..., 3].copy()
    rgb = px[..., :3].copy()
    for _ in range(iterations):
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            voisin_a = np.roll(np.roll(alpha, dy, axis=0), dx, axis=1)
            voisin_rgb = np.roll(np.roll(rgb, dy, axis=0), dx, axis=1)
            gagne = (alpha <= 0.5) & (voisin_a > 0.5)
            alpha = np.where(gagne, voisin_a, alpha)
            rgb = np.where(gagne[..., None], voisin_rgb, rgb)
    out = px.copy()
    out[..., :3] = rgb
    out[..., 3] = alpha
    return out


# Grossit la silhouette de ~1,8 cm de chaque côté (mesuré en pixels
# supersamplés) : un pied-de-biche de 2,4 cm de section double presque
# d'épaisseur apparente, lisible en icône sans devenir une tache informe.
DILATE_ITERATIONS = round(0.018 * PX_PER_M * SUPERSAMPLE)


def rendre_icone(scene, cam, centre, droite, haut, vue, largeur, hauteur, chemin: str) -> np.ndarray:
    portee = max(largeur, hauteur) * 4  # loin, sans effet sur une caméra ortho — évite tout clipping near/far
    placer_camera(cam, centre, droite, haut, vue, portee)
    cam.data.ortho_scale = largeur
    cam.data.clip_start = portee * 0.1
    cam.data.clip_end = portee * 2

    w = max(1, round(largeur * PX_PER_M))
    h = max(1, round(hauteur * PX_PER_M))
    scene.render.resolution_x = w * SUPERSAMPLE
    scene.render.resolution_y = h * SUPERSAMPLE
    scene.render.filepath = chemin
    bpy.ops.render.render(write_still=True)

    img = bpy.data.images.load(chemin)
    iw, ih = img.size
    px = np.empty(iw * ih * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    px = px.reshape(ih, iw, 4)[::-1]
    px = dilater(px, DILATE_ITERATIONS)

    s = SUPERSAMPLE
    blocs = px.reshape(h, s, w, s, 4)
    alpha = blocs[..., 3]
    somme_a = alpha.sum(axis=(1, 3))
    rgb = (blocs[..., :3] * alpha[..., None]).sum(axis=(1, 3)) / np.maximum(somme_a[..., None], 1e-6)
    opaque = (somme_a / (s * s)) >= 0.5
    case = np.zeros((h, w, 4), dtype=np.float32)
    case[..., :3] = rgb
    case[..., 3] = opaque
    return case


def composer_atlas(cases: dict[str, np.ndarray]) -> tuple[np.ndarray, dict[str, dict]]:
    hauteur_totale = max(c.shape[0] for c in cases.values())
    largeur_totale = sum(c.shape[1] for c in cases.values()) + GUTTER * (len(cases) - 1)
    atlas = np.zeros((hauteur_totale, largeur_totale, 4), dtype=np.float32)
    manifeste: dict[str, dict] = {}
    x = 0
    for nom in ARMES:
        case = cases[nom]
        h, w, _ = case.shape
        atlas[0:h, x:x + w] = case
        manifeste[nom] = {"x": x, "y": 0, "width": w, "height": h, "aspect": w / h}
        x += w + GUTTER
    return atlas, {"atlasWidth": largeur_totale, "atlasHeight": hauteur_totale, "icons": manifeste}


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
    out_png = arg_value(args, "--out", "public/assets/sprites/weapon_pickups.png")
    out_json = os.path.splitext(out_png)[0] + ".json"
    tmp = out_png + ".case.png"

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    cam = configurer_scene()

    pdb, pistolet, pompe = bw.armes_au_sol()
    objets = {"melee": pdb, "pistol": pistolet, "shotgun": pompe}

    cases: dict[str, np.ndarray] = {}
    for nom, ob in objets.items():
        centre, droite, haut, vue, largeur, hauteur = cadrage_profil(ob)
        for autre_nom, autre_ob in objets.items():
            if autre_ob is not ob:
                autre_ob.hide_render = True
        cases[nom] = rendre_icone(scene, cam, centre, droite, haut, vue, largeur, hauteur, tmp)
        for autre_ob in objets.values():
            autre_ob.hide_render = False
        print(f"[armes] icône {nom} : {cases[nom].shape[1]}×{cases[nom].shape[0]} px "
              f"(cadrage {largeur:.3f}×{hauteur:.3f} m)")

    if os.path.exists(tmp):
        os.remove(tmp)

    atlas, manifeste = composer_atlas(cases)
    os.makedirs(os.path.dirname(out_png) or ".", exist_ok=True)
    ecrire_png(atlas, out_png)
    with open(out_json, "w") as f:
        json.dump(manifeste, f, indent=2)
    print(f"[armes] écrit {out_png} ({manifeste['atlasWidth']}×{manifeste['atlasHeight']} px)")
    print(f"[armes] écrit {out_json}")
    print("[armes] manifeste :", json.dumps(manifeste, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
