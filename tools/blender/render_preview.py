"""
Vues de contrôle d'un niveau/kit — PROJET_CASSANDRE.

    blender -b assets_src/blender/zone_a_parking.blend \\
        -P tools/blender/render_preview.py -- --out renders/zone_a/

Produit quatre PNG dans `--out` (créé si besoin) :

    top.png          orthographique de dessus — layout, circulation, proportions
    silhouette.png   aplat noir sur fond blanc — lisibilité de la forme
    first_person.png perspective depuis spawn_player, yeux à 1.6 m
    three_quarter.png perspective trois-quarts — volume et composition

Moteur Workbench (pas Cycles) : rapide, et surtout capable d'afficher
directement l'attribut de couleur "Col" sans rigger de shader — c'est
l'équivalent bpy de « repasser le viewport en Solid -> Color: Attribute »
(vertex-color-sector-lighting). Cycles ignorerait "Col" ici : les matériaux du
kit sont des Principled BSDF à couleur posée en dur (voir export_level.py),
rien ne branche l'attribut dans le graphe.

Options :
    --out DIR         dossier de sortie (créé si besoin)
    --res-x / --res-y résolution (défaut 960x540 — plus lisible qu'640x360
                      pour une capture de contrôle, le jeu reste à 640x360)
    --spawn NAME      nom de l'empty à utiliser pour la vue première personne
                      (défaut : le premier "spawn_player"/"spawn_player.*"
                      trouvé ; sinon le centre de la scène, face -Y)

Code retour : 0 = quatre images écrites, 1 = échec (scène vide, etc).
"""

from __future__ import annotations

import math
import os
import re
import sys

import bpy
from mathutils import Vector, Euler

SKIP_PREFIXES = ("col_", "trig_", "secret_")
EXCLUDED_COLLECTIONS = {"_KIT", "_LIGHTS", "_BAKE_LIGHTS"}


def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg_value(args, flag, default):
    return args[args.index(flag) + 1] if flag in args else default


def base_name(name: str) -> str:
    return re.sub(r"\.\d{3}$", "", name)


def visible_render_meshes() -> list[bpy.types.Object]:
    """Géométrie réellement rendue en jeu : ni collider, ni volume logique,
    ni source du kit (`_KIT` exclue de l'export — voir export_level.py)."""
    excluded_roots = set()
    for coll in bpy.data.collections:
        if coll.name in EXCLUDED_COLLECTIONS:
            excluded_roots.add(coll.name)

    def in_excluded(obj: bpy.types.Object) -> bool:
        for coll in obj.users_collection:
            c = coll
            seen = set()
            while c is not None and c.name not in seen:
                seen.add(c.name)
                if c.name in excluded_roots:
                    return True
                # Remonter aux parents n'est pas trivial via l'API bpy
                # (pas de pointeur parent direct sur une Collection) ; les
                # scripts de ce projet ne nichent jamais _KIT/_LIGHTS sous
                # autre chose que la racine, donc un seul niveau suffit ici.
                break
        return False

    out = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        if obj.name.startswith(SKIP_PREFIXES):
            continue
        if in_excluded(obj):
            continue
        out.append(obj)
    return out


def scene_bounds(objects) -> tuple[Vector, Vector]:
    lo = Vector((math.inf, math.inf, math.inf))
    hi = Vector((-math.inf, -math.inf, -math.inf))
    for obj in objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            lo.x, lo.y, lo.z = min(lo.x, world.x), min(lo.y, world.y), min(lo.z, world.z)
            hi.x, hi.y, hi.z = max(hi.x, world.x), max(hi.y, world.y), max(hi.z, world.z)
    return lo, hi


def find_spawn(name_hint: str | None) -> bpy.types.Object | None:
    candidates = [o for o in bpy.context.scene.objects if base_name(o.name) == "spawn_player"]
    if name_hint:
        named = [o for o in bpy.context.scene.objects if o.name == name_hint]
        if named:
            return named[0]
    return candidates[0] if candidates else None


def make_camera(name: str) -> bpy.types.Object:
    cam_data = bpy.data.cameras.new(name)
    cam_obj = bpy.data.objects.new(name, cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    return cam_obj


def point_camera(cam_obj: bpy.types.Object, location: Vector, target: Vector) -> None:
    cam_obj.location = location
    direction = (target - location)
    if direction.length < 1e-6:
        direction = Vector((0.0, 1.0, 0.0))
    # Blender caméra : regarde par défaut le long de -Z locale, "haut" = +Y locale.
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_common(scene, res_x: int, res_y: int) -> None:
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.display.shading.show_shadows = False
    scene.display.shading.show_cavity = False
    # Un contour distinct par objet est la seule vraie source de lisibilité
    # de forme sous éclairage FLAT (aucune ombre, aucun dégradé de normale) :
    # sans lui, une vue de dessus orthographique perd tout relief entre
    # deux surfaces d'une luminosité de vertex color proche (ex. un dessus
    # de caisse contre le sol voisin) et devient un aplat illisible —
    # constaté en pratique (Zone B, première passe).
    scene.display.shading.show_object_outline = True
    scene.display.shading.object_outline_color = (0.05, 0.05, 0.06)


def render_vertex_view(scene, out_path: str, cam_obj: bpy.types.Object) -> None:
    scene.camera = cam_obj
    scene.display.shading.light = "FLAT"
    scene.display.shading.color_type = "VERTEX"
    scene.world.color = (0.5, 0.52, 0.56)
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)


def render_silhouette_view(scene, out_path: str, cam_obj: bpy.types.Object) -> None:
    scene.camera = cam_obj
    scene.display.shading.light = "FLAT"
    scene.display.shading.color_type = "SINGLE"
    scene.display.shading.single_color = (0.0, 0.0, 0.0)
    scene.world.color = (1.0, 1.0, 1.0)
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)


def main() -> None:
    args = get_args()
    out_dir = arg_value(args, "--out", "renders/")
    out_dir = os.path.abspath(bpy.path.abspath(out_dir))
    res_x = int(arg_value(args, "--res-x", "960"))
    res_y = int(arg_value(args, "--res-y", "540"))
    spawn_hint = arg_value(args, "--spawn", None)

    objects = visible_render_meshes()
    if not objects:
        print("[render_preview] aucune géométrie rendue trouvée — scène vide ?")
        sys.exit(1)

    lo, hi = scene_bounds(objects)
    center = (lo + hi) / 2.0
    size = hi - lo
    diag_xy = math.hypot(size.x, size.y)
    height = size.z

    os.makedirs(out_dir, exist_ok=True)
    scene = bpy.context.scene
    setup_common(scene, res_x, res_y)

    # `col_*`/`trig_*`/`secret_*` sont des OCCULTANTS, pas seulement des
    # non-cibles — même diagnostic que `bake_vertex_lighting.py::
    # hide_occluders`, mais pour une raison différente ici : ce ne sont pas
    # des rayons Cycles qui les traversent, c'est le rendu WORKBENCH lui-même
    # qui, pour un proxy en `display_type='WIRE'` exactement coïncident avec
    # sa pièce rendue, peut occulter entièrement cette pièce vue depuis un
    # angle proche de la verticale (constaté : `kit_checkout` invisible en vue
    # de dessus tant que `col_box_checkout` restait visible au rendu, alors
    # que `col_box_wall_4m` ne posait pas ce problème vu de biais en première
    # personne — l'angle de vue est le facteur qui déclenche le symptôme,
    # pas la pièce). Masqués pour LES QUATRE vues (pas seulement le dessus) :
    # aucune des quatre n'a de raison de montrer un collider.
    occluder_hidden = []
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and obj.name.startswith(SKIP_PREFIXES):
            occluder_hidden.append((obj, obj.hide_render))
            obj.hide_render = True

    # --- 1. Orthographique de dessus ---------------------------------------
    # `kit_ceiling_4x4` (zones B/C/E, voir build_level.py::build_ceiling) est
    # un plafond plein : une caméra au-dessus verrait sa face du dessus et
    # rien du plan intérieur, ce qui viderait cette vue de tout son intérêt
    # (layout/circulation). Masqué le temps de CETTE vue seulement, restauré
    # juste après — même principe que `bake_vertex_lighting.py::
    # hide_occluders`, appliqué ici au rendu plutôt qu'au bake.
    ceiling_hidden = []
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and base_name(obj.name) == "kit_ceiling_4x4":
            ceiling_hidden.append((obj, obj.hide_render))
            obj.hide_render = True

    top_cam = make_camera("_preview_top")
    top_cam.data.type = "ORTHO"
    # `ortho_scale` fixe la DIMENSION LA PLUS LARGE du capteur (sensor_fit
    # AUTO) — sur une image 16:9, ça veut dire la largeur, et la hauteur
    # réellement visible vaut ortho_scale * res_y/res_x. Un simple
    # `max(size.x, size.y)` sous-évalue donc la hauteur visible dès que
    # res_x > res_y (constaté : la profondeur d'une zone tronquée en haut/bas
    # sur la première passe de la Zone B, checkouts hors cadre). Calculé
    # pour que LES DEUX dimensions du plan tiennent, quel que soit le ratio
    # largeur/profondeur de la zone.
    aspect = res_x / res_y
    top_cam.data.ortho_scale = max(size.x, size.y * aspect) * 1.08
    top_cam.data.clip_end = max(height, 10.0) * 4.0 + 50.0
    point_camera(top_cam, Vector((center.x, center.y, hi.z + 20.0)), center)
    render_vertex_view(scene, os.path.join(out_dir, "top.png"), top_cam)

    for obj, was_hidden in ceiling_hidden:
        obj.hide_render = was_hidden

    # --- 2. Silhouette (aplat noir sur fond blanc) --------------------------
    # Même angle que la vue trois-quarts : c'est la forme en volume qu'on
    # veut juger, pas le plan.
    dist = diag_xy * 0.9 + 5.0
    sil_cam = make_camera("_preview_silhouette")
    sil_cam.data.type = "PERSP"
    sil_cam.data.lens = 35.0
    sil_cam.data.clip_end = dist * 4.0 + 100.0
    sil_pos = Vector((center.x - dist * 0.6, center.y - dist * 0.6, hi.z + height * 0.6 + 3.0))
    point_camera(sil_cam, sil_pos, Vector((center.x, center.y, lo.z + height * 0.3)))
    render_silhouette_view(scene, os.path.join(out_dir, "silhouette.png"), sil_cam)

    # --- 3. Première personne, yeux à 1.6 m ---------------------------------
    spawn = find_spawn(spawn_hint)
    fp_cam = make_camera("_preview_first_person")
    fp_cam.data.type = "PERSP"
    fp_cam.data.lens = 32.0
    fp_cam.data.clip_start = 0.05
    fp_cam.data.clip_end = max(diag_xy, 50.0) * 2.0
    if spawn is not None:
        eye = spawn.matrix_world.translation + Vector((0.0, 0.0, 1.6))
        forward = spawn.matrix_world.to_quaternion() @ Vector((0.0, 1.0, 0.0))
        if forward.length < 1e-6:
            forward = Vector((0.0, 1.0, 0.0))
    else:
        eye = Vector((center.x, lo.y + 1.0, lo.z + 1.6))
        forward = Vector((0.0, 1.0, 0.0))
    point_camera(fp_cam, eye, eye + forward)
    render_vertex_view(scene, os.path.join(out_dir, "first_person.png"), fp_cam)

    # --- 4. Trois-quarts perspective -----------------------------------------
    tq_cam = make_camera("_preview_three_quarter")
    tq_cam.data.type = "PERSP"
    tq_cam.data.lens = 28.0
    tq_cam.data.clip_end = dist * 4.0 + 100.0
    tq_pos = Vector((center.x + dist * 0.7, center.y - dist * 0.7, hi.z + height * 0.9 + 4.0))
    point_camera(tq_cam, tq_pos, Vector((center.x, center.y, lo.z + height * 0.35)))
    render_vertex_view(scene, os.path.join(out_dir, "three_quarter.png"), tq_cam)

    for obj, was_hidden in occluder_hidden:
        obj.hide_render = was_hidden

    print(f"[render_preview] 4 images écrites dans {out_dir}")
    print(f"[render_preview] bounds monde : {tuple(round(c,2) for c in lo)} -> {tuple(round(c,2) for c in hi)}")
    print(f"[render_preview] spawn utilisé pour first_person : {spawn.name if spawn else '(aucun, fallback)'}")
    sys.exit(0)


if __name__ == "__main__":
    main()
