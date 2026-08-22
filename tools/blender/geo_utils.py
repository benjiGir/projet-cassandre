"""
Fonctions bpy partagées — géométrie en boîtes, proxies de collision.

Utilisées par `build_kit.py` (génération du kit modulaire) ET `build_level.py`
(assemblage d'un niveau, pour les éléments sur-mesure comme la vitrine de la
Zone A). Extrait de `build_kit.py` pour éviter que les deux scripts fassent
dériver la même logique de construction — un bug corrigé ici (subdivision,
winding des faces, attribut de couleur) l'est pour tout le monde.

Aucune de ces fonctions ne connaît la notion de « pièce de kit » : elles
prennent des boîtes/dimensions nues. C'est `kit_spec.py` qui porte la
sémantique du kit et `level_spec.py` celle d'un niveau.

Requiert `bpy`/`bmesh` — non importable hors Blender (contrairement à
`kit_spec.py`, qui reste un module Python pur).
"""

from __future__ import annotations

import math

import bmesh
import bpy

SEG_TARGET_DEFAULT = 1.0   # pas de subdivision, en mètres — voir kit_spec.SEG_TARGET
UV_TILE_DEFAULT = 2.0      # mètres par tuile de texture — voir kit_spec.UV_TILE

# Pour chaque axe de normale et chaque côté, le couple d'axes dans le plan tel
# que u × v = normale sortante. Sans ça, une face sur deux part à l'envers et
# le backface culling de Three.js troue le mur.
_FACE_AXES = {
    (0, 1): (1, 2), (0, 0): (2, 1),
    (1, 1): (2, 0), (1, 0): (0, 2),
    (2, 1): (0, 1), (2, 0): (1, 0),
}


def add_grid_box(bm, uv_layer, origin, size, mat_index=0,
                  seg=SEG_TARGET_DEFAULT, uv_tile=UV_TILE_DEFAULT) -> None:
    """Ajoute une boîte dont chaque face est une grille de quads au pas `seg`.

    Les six faces sont construites en sommets INDÉPENDANTS (non soudés aux
    arêtes) — l'attribut de couleur est au domaine Point, un sommet soudé à
    l'angle partagerait une seule couleur entre plusieurs faces et
    l'éclairage baverait autour de l'arête.

    Le nombre de segments est un CEIL, pas un ROUND : la garantie recherchée
    est « aucune arête plus longue que `seg` ». Sur une cote inférieure à
    `seg` (ex. un petit prop), `max(1, ceil(...))` retombe naturellement sur
    une seule face — pas de subdivision inutile sur un objet déjà petit.
    """
    if min(size) <= 0.0:
        raise ValueError(f"boîte dégénérée {size}")

    for axis in (0, 1, 2):
        for side in (0, 1):
            u_ax, v_ax = _FACE_AXES[(axis, side)]
            lu, lv = size[u_ax], size[v_ax]
            nu = max(1, math.ceil(lu / seg - 1e-9))
            nv = max(1, math.ceil(lv / seg - 1e-9))
            fixed = origin[axis] + (size[axis] if side else 0.0)

            grid = []
            for i in range(nu + 1):
                col = []
                for j in range(nv + 1):
                    co = [0.0, 0.0, 0.0]
                    co[axis] = fixed
                    co[u_ax] = origin[u_ax] + lu * i / nu
                    co[v_ax] = origin[v_ax] + lv * j / nv
                    vert = bm.verts.new(co)
                    col.append((vert, (co[u_ax] / uv_tile, co[v_ax] / uv_tile)))
                grid.append(col)

            for i in range(nu):
                for j in range(nv):
                    corners = (grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1])
                    face = bm.faces.new([c[0] for c in corners])
                    face.material_index = mat_index
                    face.smooth = False
                    for loop, (_, uv) in zip(face.loops, corners):
                        loop[uv_layer].uv = uv


def build_multi_box_mesh(name: str, parts: list[dict], default_mat: str,
                          materials_lookup: dict, seg=SEG_TARGET_DEFAULT,
                          uv_tile=UV_TILE_DEFAULT) -> bpy.types.Object:
    """Objet rendu à partir d'une liste de boîtes (`kit_spec.box()`).

    `parts[i]["mat"]` prime sur `default_mat` quand renseigné — même règle
    que `kit_spec.KIT` (une pièce a un matériau par défaut, certaines de ses
    boîtes peuvent en déclarer un autre). Crée aussi l'attribut de couleur
    "Col" (Byte Color, domaine Point) prêt pour le bake — une propriété de
    construction, pas une retouche après coup (`vertex-color-sector-lighting`).
    """
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)

    used = []
    for part in parts:
        mat_name = part["mat"] or default_mat
        if mat_name not in used:
            used.append(mat_name)
    for mat_name in used:
        mesh.materials.append(materials_lookup[mat_name])

    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    for part in parts:
        mat_name = part["mat"] or default_mat
        add_grid_box(bm, uv_layer, part["o"], part["s"], mat_index=used.index(mat_name),
                     seg=seg, uv_tile=uv_tile)
    bm.to_mesh(mesh)
    bm.free()
    mesh.validate(verbose=False)
    mesh.update()

    col = mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
    col.data.foreach_set("color", [1.0] * (len(mesh.vertices) * 4))
    mesh.color_attributes.active_color_index = 0
    mesh.color_attributes.render_color_index = 0
    return obj


def build_box_mesh(name: str, origin, size) -> bpy.types.Mesh:
    """Mesh cuboid nu, exactement 8 sommets — proxy `col_box_*`."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    ox, oy, oz = origin
    sx, sy, sz = size
    v = [bm.verts.new((ox + sx * i, oy + sy * j, oz + sz * k))
         for i in (0, 1) for j in (0, 1) for k in (0, 1)]
    idx = lambda i, j, k: v[i * 4 + j * 2 + k]  # noqa: E731
    quads = [
        (idx(0, 0, 0), idx(0, 1, 0), idx(0, 1, 1), idx(0, 0, 1)),   # -X
        (idx(1, 0, 0), idx(1, 0, 1), idx(1, 1, 1), idx(1, 1, 0)),   # +X
        (idx(0, 0, 0), idx(0, 0, 1), idx(1, 0, 1), idx(1, 0, 0)),   # -Y
        (idx(0, 1, 0), idx(1, 1, 0), idx(1, 1, 1), idx(0, 1, 1)),   # +Y
        (idx(0, 0, 0), idx(1, 0, 0), idx(1, 1, 0), idx(0, 1, 0)),   # -Z
        (idx(0, 0, 1), idx(0, 1, 1), idx(1, 1, 1), idx(1, 0, 1)),   # +Z
    ]
    for q in quads:
        bm.faces.new(q).smooth = False
    bm.to_mesh(mesh)
    bm.free()
    mesh.validate(verbose=False)
    mesh.update()
    return mesh


def build_hull_ramp_mesh(name: str, origin, size) -> bpy.types.Mesh:
    """Prisme triangulaire montant en +X sur toute la profondeur Y — proxy
    `col_hull_*` d'un escalier (rampe convexe, pas les marches)."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    ox, oy, oz = origin
    sx, sy, sz = size
    a = bm.verts.new((ox, oy, oz))
    b = bm.verts.new((ox + sx, oy, oz))
    c = bm.verts.new((ox + sx, oy, oz + sz))
    d = bm.verts.new((ox, oy + sy, oz))
    e = bm.verts.new((ox + sx, oy + sy, oz))
    f = bm.verts.new((ox + sx, oy + sy, oz + sz))
    for face in ((a, c, b), (d, e, f), (a, b, e, d), (b, c, f, e), (a, d, f, c)):
        bm.faces.new(face).smooth = False
    bm.to_mesh(mesh)
    bm.free()
    mesh.validate(verbose=False)
    mesh.update()
    return mesh


def build_proxy_object(name: str, kind: str, origin, size) -> bpy.types.Object:
    """Objet proxy complet (mesh + réglages d'affichage), prêt à être lié à
    une collection. `kind` : "box" -> cuboid 8 sommets, "hull_ramp" -> prisme."""
    if kind == "box":
        mesh = build_box_mesh(name, origin, size)
    elif kind == "hull_ramp":
        mesh = build_hull_ramp_mesh(name, origin, size)
    else:
        raise ValueError(f"type de proxy inconnu : {kind!r}")

    obj = bpy.data.objects.new(name, mesh)
    obj.display_type = "WIRE"
    obj.show_wire = True
    obj.color = (1.0, 0.25, 0.1, 1.0)
    return obj


def configure_scene() -> None:
    """Unités SI et moteur de rendu — `blender-level-conventions`. Partagé
    entre le kit et un niveau : les deux ont besoin des mêmes réglages Cycles
    pour que le bake soit reproductible (128 samples, seed fixe)."""
    scene = bpy.context.scene
    u = scene.unit_settings
    u.system = "METRIC"
    u.scale_length = 1.0
    u.length_unit = "METERS"

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 128
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.seed = 0

    scene.render.bake.target = "VERTEX_COLORS"
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = True

    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"


def make_collection(name: str, parent: bpy.types.Collection) -> bpy.types.Collection:
    coll = bpy.data.collections.new(name)
    parent.children.link(coll)
    return coll


def wipe_scene() -> None:
    """Table rase : --factory-startup livre un cube, une caméra et une lampe."""
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)
