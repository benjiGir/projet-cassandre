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
for _atlas in ("trim_hypermarche", "sig_bandeaux", "sig_facade", "prd_surgeles"):
    TRIM.update(json.load(open(os.path.join(TEX_DIR, _atlas + ".json")))["bands"])
# Même principe que les bandes ci-dessus : les atlas d'étiquettes partagent un
# espace de noms, et c'est l'appelant qui choisit la texture. `prd_surgeles`
# porte les deux : des faces de produit ET deux bandes (le bandeau du rayon, le
# givre), pour que tout le rayon surgelés ne coûte qu'un matériau.
LABELS = {}
for _labels in ("prd_etiquettes", "prd_kiosque", "prd_ecrans", "prd_surgeles"):
    LABELS.update(json.load(open(os.path.join(TEX_DIR, _labels + ".json")))["labels"])
# Vantaux de porte (`tools/textures/generate_portes.py`) : une case entière par
# vantail, plus deux échantillons — `metal` pour la quincaillerie, `chant` pour
# les tranches. Voir `_uv_porte`.
PORTES_DESIGN = {}
for _portes in ("portes_verre", "portes", "portes_2"):
    for _nom, _meta in json.load(open(os.path.join(TEX_DIR, _portes + ".json")))["portes"].items():
        PORTES_DESIGN[_nom] = dict(_meta, atlas=_portes)
# Textures dont l'ALPHA est lu : le verre d'un vantail tient dans sa texture,
# pas dans un second matériau (un `door_*` doit rester un seul mesh à un seul
# matériau). La transparence est compatible avec l'invariant #5, qui porte sur
# le modèle d'éclairage : `toLambert` recopie `transparent`/`opacity`.
TEXTURES_ALPHA = frozenset({"portes_verre"})
# Le verre des `vitre_*` : un aplat de la palette à 30 % d'opacité. Un seul
# matériau pour TOUTES les vitres du niveau — le jeu les regroupe en un lot par
# cellule, et une teinte unique rend l'ordre de mélange indifférent.
VERRE_TEINTE = "#b5d2e8"
VERRE_OPACITE = 0.3
# Affiches de marques (`generate_affiches.py`) : un atlas de cases 5:8 et non
# de cases carrées, d'où un mapper à part, `uv="affiche:<nom>"`.
_AFF = json.load(open(os.path.join(TEX_DIR, "aff_affiches.json")))
AFFICHES = {nom: [c / _AFF["atlas_px"] for c in a["px"]] for nom, a in _AFF["affiches"].items()}


def textured_material(texture: str) -> bpy.types.Material:
    """Matériau à une texture. `texture="verre"` est le verre des vitres : la
    palette, lue en aplat (`uv="aplat:#b5d2e8"`), à `VERRE_OPACITE`. Une
    texture de `TEXTURES_ALPHA` voit son alpha branché : l'exporteur glTF écrit
    alors `alphaMode: BLEND`, que le loader du jeu respecte."""
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
    fichier = "palette" if texture == "verre" else texture
    tex.image = bpy.data.images.load(os.path.join(TEX_DIR, fichier + ".png"), check_existing=True)
    tex.interpolation = "Closest"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.nodes.active = tex
    if texture == "verre":
        bsdf.inputs["Alpha"].default_value = VERRE_OPACITE
    elif texture in TEXTURES_ALPHA:
        nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    if texture == "verre" or texture in TEXTURES_ALPHA:
        # Pour la vue de Blender seulement : l'export se décide sur le nœud Alpha.
        mat.surface_render_method = "BLENDED"
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


# Palette commune du projet (`tools/textures/build_palette.py`) : 64 aplats de
# 16 px dans une grille 8 × 8. Elle sert de NUANCIER — viser le centre d'un
# pavé donne une couleur plate sans inventer de texture.
PALETTE = json.load(open(os.path.join(TEX_DIR, "palette.json")))["colors"]


def _uv_aplat(couleur: str):
    """Mappe TOUTE la géométrie sur un seul pavé de `palette.png`.

    Pourquoi ça existe : le pipeline ne connaît que des matériaux texturés, et
    certaines surfaces ne veulent AUCUN motif. Une carrosserie de voiture
    texturée en plâtre taché ne se lit pas comme une voiture sale, elle se lit
    comme un matelas (constaté en rendu). La palette du projet est déjà un
    nuancier harmonisé : on s'en sert comme tel.

    Utilisation : `texture="palette"`, `uv="aplat:#rrggbb"`. La couleur doit
    exister dans `palette.json` — une faute de frappe doit casser bruyamment,
    pas retomber sur un gris au hasard.
    """
    try:
        i = PALETTE.index(couleur.lower())
    except ValueError as exc:
        raise ValueError(f"couleur absente de la palette : {couleur}") from exc
    # Centre du pavé : à mi-chemin des 16 px, donc jamais sur un bord où le
    # filtrage irait chercher la couleur voisine.
    u = ((i % 8) + 0.5) / 8.0
    v = 1.0 - ((i // 8) + 0.5) / 8.0

    def fn(face, uv):
        for loop in face.loops:
            loop[uv].uv = (u, v)
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
    return _uv_case(cx / 4, (cx + 1) / 4, 1 - (cy + 1) / 4, 1 - cy / 4, bounds, front_axis)


def _uv_affiche(nom: str, bounds, front_axis: str = "-y"):
    x, y, w, h = AFFICHES[nom]
    return _uv_case(x, x + w, 1 - (y + h), 1 - y, bounds, front_axis)


def _uv_case(u0, u1, v_bot, v_top, bounds, front_axis: str):
    """Une case d'atlas sur la face avant d'une boîte, le fond de case ailleurs."""
    x0, y0, z0, x1, y1, z1 = bounds

    def fn(face, uv):
        n = face.normal
        is_front = {"-y": n.y < -0.5, "+y": n.y > 0.5,
                    "-x": n.x < -0.5, "+x": n.x > 0.5,
                    # `+z` sert aux objets POSÉS À PLAT dont la face utile est
                    # le dessus : une pile de journaux sur un comptoir se
                    # regarde d'en haut, pas de face.
                    "+z": n.z > 0.5}[front_axis]
        for loop in face.loops:
            c = loop.vert.co
            if is_front:
                if front_axis == "+z":
                    s = (c.x - x0) / (x1 - x0)
                    t = 1 - (c.y - y0) / (y1 - y0)
                else:
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


def _uv_porte(nom: str, bounds):
    """Un vantail : sa case entière sur les deux grandes faces, la couleur de
    `chant` sur les tranches.

    La grande face est celle dont la normale suit l'axe le plus MINCE de la
    boîte (l'épaisseur du vantail). Vue de derrière, la case est retournée en
    largeur : une plaque « DIRECTION » se lit à l'endroit des deux côtés, comme
    une vraie plaque vissée sur chaque face.
    """
    meta = PORTES_DESIGN[nom]
    x, y, w, h = meta["px"]
    cx, cy = meta["chant"]
    a = 128.0
    u0, u1, v_bot, v_top = x / a, (x + w) / a, 1 - (y + h) / a, 1 - y / a
    chant = ((cx + 0.5) / a, 1 - (cy + 0.5) / a)
    x0, y0, z0, x1, y1, z1 = bounds
    mince_x = (x1 - x0) < (y1 - y0)

    def fn(face, uv):
        n = face.normal
        grande = abs(n.x) > 0.5 if mince_x else abs(n.y) > 0.5
        for loop in face.loops:
            c = loop.vert.co
            if not grande:
                loop[uv].uv = chant
                continue
            s = (c.y - y0) / (y1 - y0) if mince_x else (c.x - x0) / (x1 - x0)
            # Face « arrière » : +x pour un vantail mince en x, -y sinon — même
            # convention que `_uv_case` (vu depuis +x, +y part vers la gauche).
            if (mince_x and n.x < 0) or (not mince_x and n.y > 0):
                s = 1 - s
            t = (c.z - z0) / max(z1 - z0, 1e-6)
            loop[uv].uv = (u0 + s * (u1 - u0), v_bot + t * (v_top - v_bot))
    return fn


def _uv_quincaillerie(nom: str):
    """Toute la géométrie au centre du pavé `metal` du vantail : la poignée
    d'une porte partage ainsi le matériau de son vantail."""
    meta = PORTES_DESIGN[nom]
    x, y, w, h = meta["metal"]
    u, v = (x + w / 2) / 128.0, 1 - (y + h / 2) / 128.0

    def fn(face, uv):
        for loop in face.loops:
            loop[uv].uv = (u, v)
    return fn


def _mapper(uv: str, bounds, front: str):
    if uv == "world":
        return _uv_world
    if uv.startswith("trim:"):
        return _uv_trim(uv[5:], bounds)
    if uv.startswith("enseigne:"):
        return _uv_enseigne(uv[9:], bounds)
    if uv.startswith("aplat:"):
        return _uv_aplat(uv[6:])
    if uv.startswith("label:"):
        return _uv_label(uv[6:], bounds, front)
    if uv.startswith("affiche:"):
        return _uv_affiche(uv[8:], bounds, front)
    if uv.startswith("porte:"):
        return _uv_porte(uv[6:], bounds)
    if uv.startswith("quincaillerie:"):
        return _uv_quincaillerie(uv[14:])
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


def _couleur_materiau(mat) -> tuple[float, float, float]:
    """Couleur de base d'un matériau importé, en linéaire.

    L'importateur glTF écrit `baseColorFactor` à la fois dans le nœud
    Principled et dans `diffuse_color` ; on lit le nœud en premier, qui est la
    valeur qui compte au rendu, et on retombe sur l'autre pour un matériau sans
    nœuds.
    """
    if mat is None:
        return (0.8, 0.8, 0.8)
    if mat.use_nodes:
        for n in mat.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                return tuple(n.inputs["Base Color"].default_value)[:3]
    return tuple(mat.diffuse_color)[:3]


def _uv_palette_la_plus_proche(rgb) -> tuple[float, float]:
    """UV du pavé de `palette.png` le plus proche d'une couleur donnée.

    Comparaison en sRGB après conversion depuis le linéaire de Blender, et
    distance euclidienne simple : le nuancier ne compte que 64 teintes bien
    séparées, une métrique perceptuelle n'y changerait rien de visible.
    """
    def vers_srgb(c: float) -> float:
        return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    cible = [vers_srgb(max(0.0, min(1.0, c))) * 255.0 for c in rgb]
    meilleur, meilleure_d = 0, None
    for i, h in enumerate(PALETTE):
        p = [int(h[k:k + 2], 16) for k in (1, 3, 5)]
        d = sum((p[k] - cible[k]) ** 2 for k in range(3))
        if meilleure_d is None or d < meilleure_d:
            meilleur, meilleure_d = i, d
    return (((meilleur % 8) + 0.5) / 8.0, 1.0 - ((meilleur // 8) + 0.5) / 8.0)


def _repeindre_sur_palette(mesh) -> None:
    """Remplace les UV d'un mesh par des pointages sur `palette.png`, une teinte
    par matériau source.

    Pourquoi : certains kits (le Kenney Furniture Kit, 140 modèles) n'ont AUCUNE
    texture — leurs matériaux sont des couleurs plates nommées `wood`, `metal`,
    `metalDark`. Tel quel, chaque modèle importerait trois ou quatre matériaux,
    et le budget du niveau v2 se compte en lots de dessin. En reportant chaque
    couleur sur le nuancier commun, TOUT le kit tient dans un seul matériau et
    se fond en un lot — et il passe au passage sous la charte de couleurs du
    projet, ce qu'un import brut n'aurait pas fait.

    Remettre `poly.material_index` à 0 n'est pas cosmétique. Trouvé le
    2026-09-24 en construisant les `sanitaire_*` : sans ça, chaque polygone
    garde l'index de son matériau D'ORIGINE (0/1/2 pour bois/métal/métal
    sombre), alors que `import_kit` ne pose plus qu'UN SEUL matériau sur
    l'objet fusionné. Invisible dans Blender (les index hors plage retombent
    sur le slot 0 à l'affichage) et invisible à `validate_level.py` (qui ne
    compte que `len(o.data.materials)`, où il n'y a bien qu'UN matériau) — mais
    l'exportateur glTF, lui, regroupe les primitives par cet index BRUT avant
    résolution : trois valeurs d'index, trois primitives, MÊME MATÉRIAU. Trois
    primitives, c'est un `THREE.Group` pour le loader (`GLTFLoader.loadMesh`,
    `meshes.length === 1` sinon `Group`), jamais un `THREE.Mesh` — silencieux
    tant qu'aucun préfixe n'exige un mesh (tout le mobilier `mob_k_*`), révélé
    dès qu'un `sanitaire_*` en a besoin. Corrige tout le kit d'un coup.
    """
    uv = mesh.uv_layers.get("UVMap") or mesh.uv_layers.new(name="UVMap")
    coords = [_uv_palette_la_plus_proche(_couleur_materiau(m)) for m in mesh.materials] or [(0.5, 0.5)]
    for poly in mesh.polygons:
        u, v = coords[min(poly.material_index, len(coords) - 1)]
        for li in poly.loop_indices:
            uv.data[li].uv = (u, v)
        poly.material_index = 0


def import_kit(name: str, glb_path: str, atlas: str, coll: bpy.types.Collection,
               longueur: float | None = None, hauteur: float | None = None,
               axe_long: int = 0, dimensions=None,
               repeindre: bool = False) -> bpy.types.Object:
    """Importe un `.glb` d'un kit Kenney, le fusionne en UN mesh et le rebascule
    sur notre atlas requantifié.

    Trois choses qui n'ont l'air de rien et qui sont tout le travail :

    1. **Fusion à la main plutôt que `object.join`.** L'opérateur dépend de la
       sélection et de l'objet actif, or l'import glTF pose un empty racine
       porteur de la conversion Y-up → Z-up. On lit chaque matrice monde AVANT
       de rien supprimer.
    2. **Le matériau du pack est jeté.** Il pointe sur un atlas 512 px, ce qui
       viole le plafond de 128 px de `validate_level.py` ; on ne garde que la
       version requantifiée sur la palette du projet
       (`tools/textures/make_kenney_atlas.py`). Les UV, elles, sont conservées
       telles quelles : les deux atlas ont la même disposition.
    3. **Origine ramenée au coin bas**, la convention de toute la bibliothèque —
       sans quoi `lib_rayons.place` poserait l'objet de travers.

    `repeindre` traite le cas des kits SANS texture, dont les matériaux ne sont
    que des couleurs nommées : chaque teinte est reportée sur le nuancier commun
    (`palette.png`), et tout le kit tient alors dans un seul matériau. Voir
    `_repeindre_sur_palette`.

    L'échelle se donne par `longueur` (le long de `axe_long`), par `hauteur`, ou
    par `dimensions` — un triplet (x, y, z) qui met chaque axe à sa cote,
    INDÉPENDAMMENT des autres.

    Pourquoi cette troisième voie existe, et pourquoi elle n'est pas un aveu de
    paresse : les kits Kenney sont modélisés à des proportions de jouet. Une
    berline mise à 4,40 m de long sort à 2,59 m de large et **2,24 m de haut** —
    plus haute qu'un homme. Posée à côté d'un Costard d'1,80 m, elle transforme
    le parking en circuit de petites voitures. Remettre chaque axe à sa cote
    réelle écrase un peu la silhouette, mais personne n'a l'original sous les
    yeux pour comparer : ce qu'on voit, c'est une voiture à la bonne taille.
    """
    before_obj = set(bpy.data.objects)
    before_img = set(bpy.data.images)
    before_mat = set(bpy.data.materials)
    bpy.ops.import_scene.gltf(filepath=glb_path)
    nouveaux = [o for o in bpy.data.objects if o not in before_obj]

    bpy.context.view_layer.update()
    bm = bmesh.new()
    for obj in nouveaux:
        if obj.type == "MESH":
            tmp = obj.data.copy()
            tmp.transform(obj.matrix_world)
            if repeindre:
                # AVANT la fusion : après, l'association face → matériau source
                # est perdue, et c'est elle qui porte toute la couleur du modèle.
                _repeindre_sur_palette(tmp)
            bm.from_mesh(tmp)
            bpy.data.meshes.remove(tmp)
    for obj in nouveaux:
        bpy.data.objects.remove(obj, do_unlink=True)
    for mat in [m for m in bpy.data.materials if m not in before_mat]:
        bpy.data.materials.remove(mat)
    for img in [i for i in bpy.data.images if i not in before_img and i.users == 0]:
        bpy.data.images.remove(img)

    lo = [min(v.co[i] for v in bm.verts) for i in range(3)]
    hi = [max(v.co[i] for v in bm.verts) for i in range(3)]
    if dimensions is not None:
        facteurs = tuple(dimensions[i] / max(hi[i] - lo[i], 1e-6) for i in range(3))
    else:
        if longueur is not None:
            k = longueur / max(hi[axe_long] - lo[axe_long], 1e-6)
        elif hauteur is not None:
            k = hauteur / max(hi[2] - lo[2], 1e-6)
        else:
            k = 1.0
        facteurs = (k, k, k)
    for v in bm.verts:
        v.co = tuple((v.co[i] - lo[i]) * facteurs[i] for i in range(3))

    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.validate(verbose=False)
    obj = bpy.data.objects.new(name, me)
    obj.data.materials.append(textured_material(atlas))
    coll.objects.link(obj)
    return obj


def kit_bounds(obj: bpy.types.Object) -> tuple[float, float, float]:
    """Encombrement d'un objet importé, en mètres — l'origine étant au coin bas,
    c'est aussi sa boîte. Sert à poser un `col_box` à la bonne taille sans
    recopier des cotes lues à la main dans le pack."""
    co = [v.co for v in obj.data.vertices]
    return tuple(max(c[i] for c in co) for i in range(3))


# Matières de props — doit rester identique à `PROP_MATERIALS` dans
# src/game/level/props.ts, et à `PROP_MATIERES` dans validate_level.py.
PROP_MATIERES = ("bois", "carton", "verre", "metal")


def prop(name: str, bounds, texture: str, coll: bpy.types.Collection,
         uv: str = "world", masse: float | None = None, pv: float | None = None,
         matiere: str | None = None, **kw) -> bpy.types.Object:
    """Mobilier PHYSIQUE `prop_<name>` : poussable, et cassable si `pv` est donné.

    Trois différences avec `box`, toutes les trois nécessaires :

    1. **Pas de subdivision.** Un prop BOUGE, donc il ne peut porter aucune
       couleur d'éclairage cuite (elle serait juste dans la pose de départ).
       Lui donner des sommets intérieurs ne servirait qu'à payer des triangles.
       Il garde donc ses huit sommets, et `validate_level.py` s'en assure.
    2. **Pas de `col_box` jumeau.** Le prop porte son propre collider
       dynamique, construit par `loader.ts` depuis sa boîte englobante. Lui
       poser un collider statique par-dessus le figerait dans le décor.
    3. **Des custom properties** : `masse` (kg), `pv` (absent = indestructible),
       `matiere` (son de casse et couleur des débris).

    ATTENTION AU BUDGET : un prop ne rejoint jamais un lot de décor fusionné,
    il se dessine seul. Chaque prop posé est un lot de dessin de plus, sur un
    budget mesuré à 200 pour tout le niveau.
    see: docs/reference/conventions-nommage.md#props-physiques
    """
    if matiere is not None and matiere not in PROP_MATIERES:
        raise ValueError(f"{name}: matiere '{matiere}' inconnue ({', '.join(PROP_MATIERES)})")
    # `subdiv` énorme : `subdivide` ne coupe que les arêtes plus longues que
    # 1,5 × la cible, donc aucune ici — la boîte garde ses huit sommets.
    obj = box(f"prop_{name}", bounds, texture, coll, uv=uv, subdiv=1e9,
              front=kw.get("front", "-y"))
    if masse is not None:
        obj["masse"] = float(masse)
    if pv is not None:
        obj["pv"] = float(pv)
    if matiere is not None:
        obj["matiere"] = matiere
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
