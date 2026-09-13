"""Outils communs aux sessions Blender MCP du niveau v2 : matériaux texturés, boîtes à UV 64 px/m, tranches de trim sheet, faces d'étiquettes, proxies de collision.

Dans une session MCP : __file__ = "<chemin absolu de ce fichier>"; exec(open(__file__).read())
"""

import json
import os

import bmesh
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TEX_DIR = os.path.join(ROOT, "assets_src", "textures")
# Les bandes des trois atlas partagent un espace de noms : le mapper n'a besoin
# que de (y, hauteur), et c'est l'appelant qui choisit la texture. Trois atlas
# et non un seul parce que chacun est PLEIN — huit bandes de 16 px occupent
# exactement les 128 px d'une texture.
TRIM = {}
for _atlas in ("trim_hypermarche", "sig_bandeaux", "sig_facade"):
    TRIM.update(json.load(open(os.path.join(TEX_DIR, _atlas + ".json")))["bands"])
LABELS = json.load(open(os.path.join(TEX_DIR, "prd_etiquettes.json")))["labels"]


def textured_material(texture: str) -> bpy.types.Material:
    name = f"mat_{texture}"
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    # Nœuds cherchés par type : une interface Blender en français traduit aussi leurs noms.
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 1.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(TEX_DIR, texture + ".png"), check_existing=True)
    tex.interpolation = "Closest"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.nodes.active = tex
    return mat


def collection(name: str, parent: bpy.types.Collection | None = None) -> bpy.types.Collection:
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(coll)
    return coll


def _box_bmesh(x0, y0, z0, x1, y1, z1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y = y0 if v.co.y < 0 else y1
        v.co.z = z0 if v.co.z < 0 else z1
    bm.normal_update()
    return bm


def _uv_world(face, uv):
    n = face.normal
    axis = max(range(3), key=lambda i: abs(n[i]))
    for loop in face.loops:
        c = loop.vert.co
        u, v = [(c.y, c.z), (c.x, c.z), (c.x, c.y)][axis]
        loop[uv].uv = (u / 2.0, v / 2.0)


def _uv_trim(band: str, bounds):
    y, h = TRIM[band]["y"], TRIM[band]["height"]
    v_top, v_bot = 1 - y / 128, 1 - (y + h) / 128
    x0, y0, z0, x1, y1, z1 = bounds

    def fn(face, uv):
        n = face.normal
        along_x = abs(n.y) >= abs(n.x)
        # Une bande de trim porte du texte : sur la face opposée, U doit décroître,
        # sinon le bandeau se lit en miroir (« ЯƎPYH »). Vu depuis +y, l'axe +x part
        # vers la gauche ; vu depuis -x, c'est +y qui part vers la gauche.
        flip = (n.y > 0) if along_x else (n.x < 0)
        for loop in face.loops:
            c = loop.vert.co
            u = (c.x if along_x else c.y) / 2.0
            t = (c.z - z0) / max(z1 - z0, 1e-6)
            loop[uv].uv = (-u if flip else u, v_bot + t * (v_top - v_bot))
    return fn


def _uv_enseigne(band: str, bounds):
    """Comme `_uv_trim`, mais le motif est calé sur le PANNEAU et non sur le monde.

    `_uv_trim` mappe U depuis la coordonnée MONDE : c'est ce qu'il faut pour une
    plinthe, qui doit se poursuivre sans raccord d'une boîte à la suivante. Pour
    une enseigne, c'est un piège — le mot tombe où il veut selon l'endroit où
    l'objet est posé, et une enseigne coupée en deux se lit comme un bug de
    texture, pas comme du carrelage.

    Ici U va de 0 à N motifs entiers sur la largeur du panneau, N étant le
    nombre de répétitions le plus proche de sa taille réelle. Un panneau montre
    donc toujours des mots entiers, où qu'il soit posé.
    """
    meta = TRIM[band]
    y, h = meta["y"], meta["height"]
    pas = meta.get("pas", 128)
    v_top, v_bot = 1 - y / 128, 1 - (y + h) / 128
    x0, y0, z0, x1, y1, z1 = bounds

    def fn(face, uv):
        n = face.normal
        along_x = abs(n.y) >= abs(n.x)
        flip = (n.y > 0) if along_x else (n.x < 0)
        a0, a1 = (x0, x1) if along_x else (y0, y1)
        # Densité nominale : 64 px/m, donc un motif de `pas` px occupe pas/64 m.
        motifs = max(1, round((a1 - a0) / (pas / 64.0)))
        for loop in face.loops:
            c = loop.vert.co
            s = ((c.x if along_x else c.y) - a0) / max(a1 - a0, 1e-6)
            u = s * motifs * pas / 128.0
            t = (c.z - z0) / max(z1 - z0, 1e-6)
            loop[uv].uv = (1 - u if flip else u, v_bot + t * (v_top - v_bot))
    return fn


def _uv_label(label: str, bounds, front_axis: str = "-y"):
    cx, cy = LABELS[label]["cell"]
    u0, u1 = cx / 4, (cx + 1) / 4
    v_top, v_bot = 1 - cy / 4, 1 - (cy + 1) / 4
    x0, y0, z0, x1, y1, z1 = bounds

    def fn(face, uv):
        n = face.normal
        is_front = {"-y": n.y < -0.5, "+y": n.y > 0.5, "-x": n.x < -0.5, "+x": n.x > 0.5}[front_axis]
        for loop in face.loops:
            c = loop.vert.co
            if is_front:
                s = (c.x - x0) / (x1 - x0) if front_axis in ("-y", "+y") else (c.y - y0) / (y1 - y0)
                if front_axis in ("+y", "-x"):
                    s = 1 - s
                t = (c.z - z0) / (z1 - z0)
                loop[uv].uv = (u0 + s * (u1 - u0), v_bot + t * (v_top - v_bot))
            else:
                # Les autres faces prennent la couleur de fond, lue près du coin haut-gauche de la case.
                loop[uv].uv = (u0 + 0.01, v_top - 0.01)
    return fn


def subdivide(bm, target: float, passes: int = 6) -> None:
    """Coupe les arêtes plus longues que `target`, jusqu'à ce qu'il n'en reste plus.

    L'éclairage est baké PAR SOMMET : un mur de 16 m qui n'a que huit sommets
    ne peut porter aucun dégradé, et ses huit coins sont justement les points
    que la géométrie voisine vient sceller — le bake le rend alors entièrement
    noir. Il lui faut des sommets à l'intérieur de sa surface.

    Seules les arêtes trop longues sont coupées : une boîte de produit de 20 cm
    reste intacte, un panneau de 4 m se découpe en grille.
    """
    for _ in range(passes):
        edges = [e for e in bm.edges if e.calc_length() > target * 1.5]
        if not edges:
            break
        bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=True)
    bm.normal_update()


def _mapper(uv: str, bounds, front: str):
    if uv == "world":
        return _uv_world
    if uv.startswith("trim:"):
        return _uv_trim(uv[5:], bounds)
    if uv.startswith("enseigne:"):
        return _uv_enseigne(uv[9:], bounds)
    if uv.startswith("label:"):
        return _uv_label(uv[6:], bounds, front)
    raise ValueError(uv)


def boxes(name: str, parts, texture: str, coll: bpy.types.Collection,
          subdiv: float = 0.75) -> bpy.types.Object:
    """Plusieurs boîtes en UN SEUL mesh, donc un seul objet par matériau.

    `parts` : liste de `(bounds, uv)` ou `(bounds, uv, front)`. Regrouper ainsi
    évite qu'une gondole coûte vingt objets ; la fusion au chargement (ADR
    0023) regroupe ensuite d'une gondole à l'autre.

    `subdiv` est la longueur d'arête maximale — voir `subdivide`, sans quoi le
    bake d'éclairage n'a aucun sommet où déposer un dégradé.
    """
    bm = bmesh.new()
    layer = bm.loops.layers.uv.new("UVMap")
    for part in parts:
        bounds, uv = part[0], part[1]
        piece = _box_bmesh(*bounds)
        subdivide(piece, subdiv)
        piece_layer = piece.loops.layers.uv.new("UVMap")
        mapper = _mapper(uv, bounds, part[2] if len(part) > 2 else "-y")
        for face in piece.faces:
            mapper(face, piece_layer)
        me_tmp = bpy.data.meshes.new("_tmp")
        piece.to_mesh(me_tmp)
        piece.free()
        bm.from_mesh(me_tmp)
        bpy.data.meshes.remove(me_tmp)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.data.materials.append(textured_material(texture))
    coll.objects.link(obj)
    return obj


def box(name: str, bounds, texture: str, coll: bpy.types.Collection, uv: str = "world", **kw) -> bpy.types.Object:
    """bounds = (x0, y0, z0, x1, y1, z1) en mètres, monde. uv : "world", "trim:<bande>" ou "label:<étiquette>"."""
    return boxes(name, [(bounds, uv, kw.get("front", "-y"))], texture, coll,
                 subdiv=kw.get("subdiv", 0.75))


def cylinder(name: str, center, radius: float, z0: float, z1: float, texture: str,
             coll: bpy.types.Collection, segments: int = 8) -> bpy.types.Object:
    """Cylindre à faible nombre de côtés, UV projetées comme une boîte (64 px/m)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=z1 - z0)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(center[0], center[1], (z0 + z1) / 2))
    bm.normal_update()
    layer = bm.loops.layers.uv.new("UVMap")
    for face in bm.faces:
        _uv_world(face, layer)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.data.materials.append(textured_material(texture))
    coll.objects.link(obj)
    return obj


def col_box(name: str, bounds, coll: bpy.types.Collection) -> bpy.types.Object:
    """Proxy de collision cuboid invisible `col_box_<name>` (voir `collision-proxy-authoring`)."""
    bm = _box_bmesh(*bounds)
    me = bpy.data.meshes.new(f"col_box_{name}")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(f"col_box_{name}", me)
    obj.display_type = "WIRE"
    obj.hide_render = True
    coll.objects.link(obj)
    return obj


def area_light(name: str, location, size: float, energy: float, coll: bpy.types.Collection,
               size_y: float | None = None, color=(1.0, 1.0, 1.0)) -> bpy.types.Object:
    """Source rectangulaire. `size_y` en fait un TUBE plutôt qu'un carré.

    La forme de la source décide de la dureté de l'ombre : un carré de 3 m
    éclaire une salle de partout et n'y projette presque rien, alors qu'un tube
    de 4 m sur 0,3 donne une vraie chute de lumière en travers de l'allée —
    c'est-à-dire le relief qu'on attend d'un plafond de néons.
    """
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.color = color
    if size_y is None:
        data.size = size
    else:
        data.shape = "RECTANGLE"
        data.size = size
        data.size_y = size_y
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    coll.objects.link(obj)
    return obj
