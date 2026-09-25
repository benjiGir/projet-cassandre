"""
Blockout gris du niveau v2 — jalon N8 de `PLAN_NIVEAU_V2.md`.

    blender -b --factory-startup -P tools/level_v2/build_blockout.py -- \\
        --out assets_src/blender/blockout_v2.blend

Puis la chaîne habituelle :

    blender -b assets_src/blender/blockout_v2.blend -P tools/blender/validate_level.py -- --strict
    blender -b assets_src/blender/blockout_v2.blend -P tools/blender/export_level.py -- \\
        --out public/assets/levels/blockout_v2.glb

**Ne construit rien qu'il invente.** Les cotes, les ouvertures, les spawns et
les repères de gameplay viennent tous de `plan_de_masse.py`, le plan validé du
jalon N6 : ce fichier ne fait que leur donner une épaisseur. Une cote qui
bouge là-bas bouge ici, sans retouche.

Pourquoi des boîtes grises et non le kit modulaire (`kit_spec.py`) : un
blockout se juge sur la circulation et les volumes, pas sur la matière —
invariant #9, « boîtes blanches » tant que le gameplay n'est pas validé. Le
kit impose en plus un pavage par modules de 4/2/1 m, qui n'apporte rien ici et
laisserait des restes sur des pièces de 42 × 36 m.

Trois règles de construction, toutes nées de pièges déjà payés :

1. **Aucun linteau SOLIDE au-dessus d'un passage.** Le bake du graphe de
   navigation tire un rayon vers le bas et prend le PREMIER collider : un
   linteau solide ferait croire à un sol à 3 m. Les ouvertures montent donc
   jusqu'au plafond dans la coque. `build_niveau.poser_linteaux` referme
   ensuite l'écart entre deux plafonds de hauteurs différentes par un linteau
   RENDU SEULEMENT, sans collider — exactement comme un plafond.
2. **Aucun plafond.** Pour la même raison, et parce qu'un blockout se regarde
   de haut.
3. **Les murs sont posés À L'INTÉRIEUR de l'emprise de leur espace.** Deux
   voisins partagent une ligne de façade ; des murs centrés dessus se
   recouvriraient, et deux faces coïncidentes donnent un bake noir (piège
   déjà documenté sur `kit_crate` et la dalle de la Zone B).
"""

from __future__ import annotations

import math
import os
import re
import sys

import bmesh
import bpy

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
sys.path.insert(0, os.path.join(os.path.dirname(ICI), "blender"))

import geo_utils                      # noqa: E402
import plan_de_masse as plan          # noqa: E402

# --- Cotes de construction ---------------------------------------------------

EPAISSEUR_MUR = 0.25
EPAISSEUR_SOL = 0.25
# Un sommet par mètre : le seuil de `validate_level.py` pour qu'un bake par
# sommet ait de quoi s'accrocher. Le blockout ne sera pas baké (il tourne en
# éclairage temps réel), mais une géométrie qui ne PEUT pas l'être est une
# dette qu'on paierait à l'habillage — et les triangles ne coûtent presque
# rien (ADR 0026).
SEG = 1.0
HAUTEUR_PORTE = 2.5
LARGEUR_PORTE = 4.0

# Matériaux du blockout : quatre gris qui se distinguent en niveaux de gris,
# pas en teinte — le rendu du jeu est sombre et à faible résolution.
MATERIAUX = {
    "sol": (0.38, 0.38, 0.40, 1.0),
    "mur": (0.58, 0.58, 0.60, 1.0),
    "volume": (0.30, 0.31, 0.34, 1.0),   # gondoles, racks, comptoirs, voitures
    "repere": (0.72, 0.55, 0.20, 1.0),   # objets interactifs, portes, secrets
}


def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg_value(args: list[str], flag: str, default):
    return args[args.index(flag) + 1] if flag in args else default


def creer_materiaux() -> dict:
    lookup = {}
    for nom, couleur in MATERIAUX.items():
        mat = bpy.data.materials.new(f"mat_blockout_{nom}")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = couleur
            bsdf.inputs["Roughness"].default_value = 1.0
        mat.diffuse_color = couleur
        lookup[nom] = mat
    return lookup


# --- Briques -----------------------------------------------------------------


def boite(nom: str, origine, taille, materiau: str, materiaux, coll, col_coll,
          avec_collider: bool = True) -> None:
    """Une boîte rendue, et son proxy `col_box_*` co-localisé."""
    if min(taille) <= 1e-6:
        return
    parts = [{"o": (0.0, 0.0, 0.0), "s": tuple(taille), "mat": materiau}]
    obj = geo_utils.build_multi_box_mesh(nom, parts, materiau, materiaux, seg=SEG, uv_tile=2.0)
    obj.location = origine
    coll.objects.link(obj)

    if avec_collider:
        proxy = geo_utils.build_proxy_object(f"col_box_{nom}", "box", (0.0, 0.0, 0.0), tuple(taille))
        proxy.location = origine
        col_coll.objects.link(proxy)


def _solide_incline(nom_mesh: str, x, y, axe: str, dessus, dessous,
                    subdiviser: bool = False) -> bpy.types.Mesh:
    """Prisme à quatre coins dont le dessus et le dessous suivent chacun une
    fonction (x, y) → z. Sert au sol d'une rampe (dessous plat) comme à son
    plafond (dessous et dessus parallèles à la pente).

    Porte des UV, projetées comme partout ailleurs à 2 m par répétition — sauf
    sur les faces en pente, où V suit la LONGUEUR de la pente et non sa
    projection au sol : à 37°, la texture s'étirerait sinon d'un quart. Sans
    aucune UV, un matériau texturé s'échantillonne en un seul texel et la
    rampe sortait en gris uni, entre deux espaces texturés.
    """
    x0, x1 = x
    y0, y1 = y
    coins = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    longueur = (x1 - x0) if axe == "+x" else (y1 - y0)
    etirement = math.hypot(1.0, (dessus(x1, y1) - dessus(x0, y0)) / longueur)

    mesh = bpy.data.meshes.new(nom_mesh)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    bas = [bm.verts.new((px, py, dessous(px, py))) for px, py in coins]
    haut = [bm.verts.new((px, py, dessus(px, py))) for px, py in coins]
    bm.faces.new(bas[::-1])
    bm.faces.new(haut)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((bas[i], bas[j], haut[j], haut[i]))
    bm.normal_update()
    for f in bm.faces:
        f.smooth = False
        n = f.normal
        for loop in f.loops:
            c = loop.vert.co
            if abs(n.z) > max(abs(n.x), abs(n.y)):
                u, v = ((c.y, (c.x - x0) * etirement) if axe == "+x"
                        else (c.x, (c.y - y0) * etirement))
            elif abs(n.x) >= abs(n.y):
                u, v = c.y, c.z
            else:
                u, v = c.x, c.z
            loop[uv].uv = (u / 2.0, v / 2.0)
    if subdiviser:
        cuts = max(1, int(max(x1 - x0, y1 - y0) / SEG))
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=cuts, use_grid_fill=True)
    bm.to_mesh(mesh)
    bm.free()
    mesh.validate(verbose=False)
    mesh.update()
    return mesh


def _niveau_pente(x, y, z_debut: float, z_fin: float, axe: str):
    x0, x1 = x
    y0, y1 = y

    def hauteur(px: float, py: float) -> float:
        t = ((px - x0) / (x1 - x0)) if axe == "+x" else ((py - y0) / (y1 - y0))
        return z_debut + (z_fin - z_debut) * t
    return hauteur


def pente(nom: str, x, y, z_debut: float, z_fin: float, axe: str,
          materiaux, coll, col_coll) -> None:
    """Sol incliné : un solide à fond plat et dessus en pente.

    Convexe par construction, donc son collider est un `col_hull_*` — le
    loader sait les lire, et une rampe en trimesh coûterait pour rien.
    """
    hauteur = _niveau_pente(x, y, z_debut, z_fin, axe)
    z_bas = min(z_debut, z_fin) - EPAISSEUR_SOL

    def plat(px: float, py: float) -> float:
        return z_bas

    mesh = _solide_incline(nom, x, y, axe, hauteur, plat, subdiviser=True)
    mesh.materials.append(materiaux["sol"])
    obj = bpy.data.objects.new(nom, mesh)
    col = mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
    col.data.foreach_set("color", [1.0] * (len(mesh.vertices) * 4))
    coll.objects.link(obj)

    proxy = bpy.data.objects.new(f"col_hull_{nom}", _solide_incline(f"col_hull_{nom}", x, y, axe, hauteur, plat))
    proxy.display_type = "WIRE"
    proxy.show_wire = True
    col_coll.objects.link(proxy)


def dalle_inclinee(nom: str, x, y, z_debut: float, z_fin: float, axe: str,
                   epaisseur: float, materiau, coll) -> bpy.types.Object:
    """Plafond d'une rampe : une dalle parallèle à la pente, RENDUE SEULEMENT.

    Aucun collider, pour la même raison qu'un plafond plat (le bake de
    navigation prendrait son dessous pour un sol). `z_debut`/`z_fin` sont les
    cotes de la sous-face aux deux bouts."""
    dessous = _niveau_pente(x, y, z_debut, z_fin, axe)

    def dessus(px: float, py: float) -> float:
        return dessous(px, py) + epaisseur

    mesh = _solide_incline(nom, x, y, axe, dessus, dessous, subdiviser=True)
    mesh.materials.append(materiau)
    obj = bpy.data.objects.new(nom, mesh)
    # PAS d'attribut `Col` : les plafonds plats (`lib_helpers.box`) n'en portent
    # pas, et la fusion au chargement groupe par jeu d'attributs — une dalle
    # inclinée qui en porterait un resterait seule dans son lot de dessin.
    coll.objects.link(obj)
    return obj


def _segments_restants(debut: float, fin: float, trous: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Le complément des trous sur [debut, fin] — les morceaux de mur à poser."""
    restants = []
    curseur = debut
    for t0, t1 in sorted(trous):
        if t0 > curseur + 1e-6:
            restants.append((curseur, min(t0, fin)))
        curseur = max(curseur, t1)
    if curseur < fin - 1e-6:
        restants.append((curseur, fin))
    return [(a, b) for a, b in restants if b - a > 1e-6]


def murs_espace(space, ouvertures, materiaux, coll, col_coll) -> int:
    """Les quatre façades, percées là où le plan déclare une ouverture."""
    x0, x1 = space.x
    y0, y1 = space.y
    t = EPAISSEUR_MUR
    z = space.z if not space.rampe else min(space.rampe[1], space.rampe[2])
    h = space.hauteur + (abs(space.rampe[2] - space.rampe[1]) if space.rampe else 0.0)
    poses = 0

    # Trous par façade, lus dans les ouvertures qui concernent cet espace.
    trous = {"S": [], "N": [], "O": [], "E": []}
    for o in ouvertures:
        if space.id not in (o.a, o.b):
            continue
        if o.axe == "y":
            if abs(o.at - y0) < 1e-6:
                trous["S"].append(o.span)
            elif abs(o.at - y1) < 1e-6:
                trous["N"].append(o.span)
        else:
            if abs(o.at - x0) < 1e-6:
                trous["O"].append(o.span)
            elif abs(o.at - x1) < 1e-6:
                trous["E"].append(o.span)

    for a, b in _segments_restants(x0, x1, trous["S"]):
        boite(f"mur_{space.id}_s{poses}", (a, y0, z), (b - a, t, h), "mur", materiaux, coll, col_coll)
        poses += 1
    for a, b in _segments_restants(x0, x1, trous["N"]):
        boite(f"mur_{space.id}_n{poses}", (a, y1 - t, z), (b - a, t, h), "mur", materiaux, coll, col_coll)
        poses += 1

    # Façades est/ouest rognées de l'épaisseur des deux autres : deux boîtes
    # qui se recouvrent donneraient des faces coïncidentes, donc un bake noir.
    # Mais seulement là où la façade nord ou sud tient l'angle : une ouverture
    # qui court jusqu'au bout de la sienne (un couloir ouvert de bout en bout)
    # ne pose rien dans l'angle, et le rognage y laissait un carré vide de la
    # hauteur du mur, ouvert sur le vide — une fente de 25 cm à chaque angle de
    # sas, de couloir et d'escalier (18 angles vides, trouvés au lancer de
    # rayons le 2026-09-23). Le mur descend alors jusqu'à l'angle.
    def angle_tenu(face: str, x_angle: float) -> bool:
        return not any(a < x_angle + t - 1e-6 and b > x_angle - t + 1e-6 for a, b in trous[face])

    for face, x_mur, x_angle in (("O", x0, x0), ("E", x1 - t, x1)):
        debut = y0 + t if angle_tenu("S", x_angle) else y0
        fin = y1 - t if angle_tenu("N", x_angle) else y1
        for a, b in _segments_restants(debut, fin, trous[face]):
            boite(f"mur_{space.id}_{face.lower()}{poses}", (x_mur, a, z), (t, b - a, h), "mur",
                  materiaux, coll, col_coll)
            poses += 1
    poses += _parapets(space, ouvertures, materiaux, coll, col_coll)
    return poses


def _parapets(space, ouvertures, materiaux, coll, col_coll) -> int:
    """Mur d'allège côté BAS d'un passage à sens unique.

    Une ouverture entre deux sols décalés de plus d'un saut ne se franchit que
    vers le bas — le plan le sait (`Opening.sens_unique`). Mais la façade est
    percée sur TOUTE sa hauteur des deux côtés : depuis le bas, on sort donc du
    niveau de plain-pied, dans une zone qui n'est le sol de personne, et on
    tombe sans fin. Le côté haut garde son ouverture (c'est par là qu'on saute),
    le côté bas reçoit un mur jusqu'au niveau du sol d'en face.

    Trouvé par `audit_niveau.py` après la première traversée complète jouée
    (2026-09-16) : au nord des rayons, sous le couloir de service.
    """
    x0, x1 = space.x
    y0, y1 = space.y
    t = EPAISSEUR_MUR
    poses = 0
    for o in ouvertures:
        if space.id not in (o.a, o.b) or not o.sens_unique:
            continue
        z_ici = o.z_a if o.a == space.id else o.z_b
        z_face = o.z_b if o.a == space.id else o.z_a
        if z_face <= z_ici:
            continue                      # côté HAUT : c'est de là qu'on saute
        haut = z_face - z_ici
        a, b = o.span
        nom = f"parapet_{space.id}_{poses}"
        if o.axe == "y":
            ya = y0 if abs(o.at - y0) < 1e-6 else y1 - t
            boite(nom, (a, ya, z_ici), (b - a, t, haut), "mur", materiaux, coll, col_coll)
        else:
            xa = x0 if abs(o.at - x0) < 1e-6 else x1 - t
            boite(nom, (xa, a, z_ici), (t, b - a, haut), "mur", materiaux, coll, col_coll)
        poses += 1
    return poses


def boite_centree(nom: str, centre, taille, materiau: str, materiaux, coll,
                  col_coll=None, extras: dict | None = None) -> bpy.types.Object:
    """Boîte dont l'ORIGINE est au centre — obligatoire pour un `door_*` et un
    `use_*` : le loader lit `mesh.getWorldPosition()` pour le premier et pose
    le corps Rapier sur la translation BRUTE pour le second (piège déjà payé
    sur `door_e_exit`, voir CLAUDE.md)."""
    sx, sy, sz = taille
    parts = [{"o": (-sx / 2.0, -sy / 2.0, -sz / 2.0), "s": (sx, sy, sz), "mat": materiau}]
    obj = geo_utils.build_multi_box_mesh(nom, parts, materiau, materiaux, seg=SEG, uv_tile=2.0)
    obj.location = centre
    coll.objects.link(obj)
    for cle, valeur in (extras or {}).items():
        obj[cle] = valeur
    if col_coll is not None:
        proxy = geo_utils.build_proxy_object(f"col_box_{nom}", "box",
                                             (-sx / 2.0, -sy / 2.0, -sz / 2.0), (sx, sy, sz))
        proxy.location = centre
        col_coll.objects.link(proxy)
    return obj


def empty(nom: str, position, coll) -> bpy.types.Object:
    obj = bpy.data.objects.new(nom, None)
    obj.location = position
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.5
    coll.objects.link(obj)
    return obj


# --- Volumes gris, espace par espace -----------------------------------------
#
# Ce que chaque pièce contiendra un jour, réduit à sa silhouette : ce qui
# coupe une ligne de vue, ce qui se contourne, ce sur quoi on grimpe. Rien
# ici ne prétend ressembler à quoi que ce soit.


def volumes(space, materiaux, coll, col_coll) -> int:
    x0, x1 = space.x
    y0, y1 = space.y
    z = space.z
    poses = 0

    def poser(nom, origine, taille):
        nonlocal poses
        boite(nom, origine, taille, "volume", materiaux, coll, col_coll)
        poses += 1

    if space.id == "parking_ext":
        # Voitures en épi : des obstacles bas (1,5 m < 1,6 m des yeux), donc
        # du couvert visuel seulement — c'est voulu, le parking est le
        # tutoriel, pas un combat.
        for i in range(6):
            poser(f"voiture_pk{i}", (x0 + 4 + i * 7, y0 + 6, z), (4.0, 2.0, 1.5))
            poser(f"voiture_pk{i + 6}", (x0 + 4 + i * 7, y1 - 12, z), (4.0, 2.0, 1.5))
        poser("abri_caddies", (x1 - 10, y0 + 16, z), (6.0, 4.0, 2.5))

    elif space.id == "galerie":
        # Kiosques au milieu de la galerie : les premiers vrais couverts du
        # niveau (3 m > hauteur des yeux), et le premier usage de l'embuscade
        # par occlusion (ADR 0025).
        for i in range(4):
            poser(f"kiosque_ga{i}", (x0 + 6 + i * 14, y0 + 6, z), (6.0, 4.0, 3.0))

    elif space.id == "cafeteria":
        poser("comptoir_self", (x0 + 3, y0 + 3, z), (12.0, 1.5, 1.1))
        poser("frigo_caf", (x1 - 3, y1 - 4, z), (2.0, 1.0, 2.0))
        for i in range(6):
            poser(f"table_caf{i}", (x0 + 4 + (i % 3) * 5, y0 + 9 + (i // 3) * 5, z), (2.0, 2.0, 0.8))

    elif space.id == "caisses":
        # Ligne de caisses en travers, trouées de 2,5 m. 1,10 m : sous la
        # hauteur des yeux, donc aucun hitscan ne s'y arrête (écart connu
        # depuis la Zone B, assumé — c'est un obstacle de déplacement).
        for i in range(8):
            poser(f"caisse_cs{i}", (x0 + 2 + i * 6.5, y0 + 12, z), (4.0, 1.5, 1.1))

    elif space.id == "hub":
        poser("estrade_micro", (-2.0, 66.0, z), (4.0, 4.0, 0.5))

    elif space.id == "rayons":
        # Cinq rangées coupées par deux allées transversales (y≈60, y≈72) :
        # c'est là que se posent les embuscades, jamais dans l'allée que le
        # joueur regarde.
        for i in range(5):
            gx = x0 + 4 + i * 7.5
            for j, (ya, yb) in enumerate(((y0 + 2, 58.0), (62.0, 70.0), (74.0, y1 - 2))):
                poser(f"gondole_ry{i}_{j}", (gx, ya, z), (1.25, yb - ya, 2.0))
        poser("caisse_acces_secret", (x0 + 2.5, y0 + 3, z), (1.0, 1.0, 1.0))

    elif space.id == "electro":
        poser("mur_ecrans", (x0 + 4, y0 + 1, z), (14.0, 1.0, 3.0))
        for i in range(4):
            poser(f"cabine_el{i}", (x0 + 6 + (i % 2) * 16, y0 + 10 + (i // 2) * 12, z), (5.0, 5.0, 2.5))
        poser("carton_acces_or", (x1 - 6, y1 - 6, z), (1.0, 1.0, 1.0))

    elif space.id == "reserve":
        # Racks de 6 m : le vrai couvert du niveau, un Costard posté derrière
        # reste `idle` (ADR 0025).
        for i in range(2):
            rx = x0 + 8 + i * 20
            poser(f"rack_rs{i}a", (rx, y0 + 4, z), (1.5, 14.0, 6.0))
            poser(f"rack_rs{i}b", (rx, y0 + 22, z), (1.5, 10.0, 6.0))
        # Plateforme nord, PLEINE : une mezzanine sur pilotis mettrait deux
        # sols praticables dans la même colonne (contrainte du pathfinding
        # 2.5D). Un quai surélevé donne la même verticalité sans le défaut.
        poser("plateforme_rs", (x0, y1 - 9, z), (x1 - x0, 8.75, 3.0))
        pente("rampe_plateforme_rs", (x0 + 16, x0 + 28), (y1 - 17, y1 - 9),
              z, z + 3.0, "+y", materiaux, coll, col_coll)
        poses += 1

    elif space.id == "souterrain":
        # Piliers tous les 8 m : la ligne de vue y est coupée en permanence,
        # c'est la seule zone où l'occlusion fait tout le travail.
        nx = int((x1 - x0 - 8) // 8)
        ny = int((y1 - y0 - 8) // 8)
        for i in range(nx + 1):
            for j in range(ny + 1):
                poser(f"pilier_so{i}_{j}", (x0 + 6 + i * 8, y0 + 6 + j * 8, z), (1.0, 1.0, space.hauteur))
        for i in range(4):
            poser(f"voiture_so{i}", (x0 + 10 + i * 12, y1 - 8, z), (4.0, 2.0, 1.5))

    elif space.id == "bureaux":
        for i in range(4):
            poser(f"bureau_bu{i}", (x0 + 4 + (i % 2) * 12, y0 + 5 + (i // 2) * 9, z), (3.0, 1.5, 0.8))
        poser("cloison_bu", (x0 + 2, y0 + 14, z), (12.0, 0.25, 2.0))

    return poses


# --- Gameplay ----------------------------------------------------------------
#
# Les portes à carte rétrécissent leur ouverture : un passage de 12 m ne se
# ferme pas avec un vantail. Nom du `door_*`, carte exigée, largeur.
PORTES = {
    # Le rideau métallique du quai : 4 m, la largeur d'un transpalette chargé.
    frozenset({"c_hb_rs", "reserve"}): ("door_argent", "argent", LARGEUR_PORTE),
    # En bas de l'escalier de l'étage, et non plus à l'entrée d'une salle au
    # rez-de-chaussée : c'est l'étage entier que la carte Or ouvre. Une porte
    # double de service (2 × 1 m) : un vantail de 4 m pour un escalier se
    # lisait comme une porte de hangar.
    frozenset({"c_bu", "c_escalier"}): ("door_or", "or", 2.0),
}

# La sortie ne relie aucun espace : c'est l'issue de secours du bureau du
# Directeur, dans son mur NORD, à l'étage — vers l'extérieur, qui n'est pas
# modélisé. Déclarée à la main pour cette raison.
OUVERTURE_SORTIE = plan.Opening("direction", "_dehors", "y", 166.0, (-38.0, -36.0), 4.0, 4.0)
# Petit palier DERRIÈRE la sortie, à l'altitude de l'étage. La partie se termine
# au franchissement (`estPorteDeSortie`, `game/session/doors.ts`), mais il
# s'écoule un pas fixe entre le franchissement et l'écran de fin : sans sol, ce
# pas-là est une chute.
PALIER_SORTIE = ((-40.0, 166.0), (6.0, 3.0))


def ouvertures_effectives() -> list:
    """Les ouvertures du plan, rétrécies là où une porte doit pouvoir les
    fermer, plus la sortie."""
    effectives = []
    for o in plan.openings():
        porte = PORTES.get(frozenset({o.a, o.b}))
        if porte:
            milieu = (o.span[0] + o.span[1]) / 2.0
            largeur = porte[2]
            o = plan.Opening(o.a, o.b, o.axe, o.at,
                             (milieu - largeur / 2.0, milieu + largeur / 2.0),
                             o.z_a, o.z_b)
        effectives.append(o)
    effectives.append(OUVERTURE_SORTIE)
    return effectives


def poser_palier_sortie(materiaux, coll, col_coll) -> None:
    (px, py), (largeur, profondeur) = PALIER_SORTIE
    z = OUVERTURE_SORTIE.z
    boite("sol_sortie", (px, py, z - EPAISSEUR_SOL), (largeur, profondeur, EPAISSEUR_SOL),
          "sol", materiaux, coll, col_coll)
    # Trois murets : on sort du magasin, on ne part pas en promenade.
    boite("mur_sortie_n", (px, py + profondeur - EPAISSEUR_MUR, z),
          (largeur, EPAISSEUR_MUR, 3.0), "mur", materiaux, coll, col_coll)
    boite("mur_sortie_o", (px, py, z), (EPAISSEUR_MUR, profondeur, 3.0), "mur", materiaux, coll, col_coll)
    boite("mur_sortie_e", (px + largeur - EPAISSEUR_MUR, py, z),
          (EPAISSEUR_MUR, profondeur, 3.0), "mur", materiaux, coll, col_coll)


def poser_portes(ouvertures, materiaux, geo_coll, logic_coll) -> int:
    """Un vantail par porte à carte, plus la sortie — et le `use_*` qui la
    commande, à portée (2 m) de qui se présente devant."""
    poses = 0
    a_poser = [(o, *PORTES[frozenset({o.a, o.b})][:2]) for o in ouvertures
               if frozenset({o.a, o.b}) in PORTES]
    a_poser.append((OUVERTURE_SORTIE, "door_exit", "platine"))

    for o, nom_porte, carte in a_poser:
        largeur = o.span[1] - o.span[0]
        milieu = (o.span[0] + o.span[1]) / 2.0
        z_centre = o.z + HAUTEUR_PORTE / 2.0
        if o.axe == "y":
            centre = (milieu, o.at, z_centre)
            taille = (largeur, 0.2, HAUTEUR_PORTE)
            place_use = (milieu + largeur / 2.0 + 1.0, o.at - 1.0, o.z + 1.25)
        else:
            centre = (o.at, milieu, z_centre)
            taille = (0.2, largeur, HAUTEUR_PORTE)
            place_use = (o.at - 1.0, milieu + largeur / 2.0 + 1.0, o.z + 1.25)

        boite_centree(nom_porte, centre, taille, "repere", materiaux, geo_coll)
        boite_centree(f"use_{nom_porte}", place_use, (0.6, 0.6, 0.6), "repere", materiaux,
                      logic_coll, extras={"target": nom_porte, "requires": carte})
        poses += 1
    return poses


# Ce que chaque repère du plan de masse devient une fois construit. La table
# est exhaustive : un repère qui ne correspond à aucune règle fait échouer la
# construction, plutôt que de disparaître en silence.
REGLES_REPERES = [
    ("départ", "spawn", None),
    ("pied-de-biche", "use", "use_crowbar"),
    ("fusil à pompe", "use", "use_shotgun"),
    ("pistolet", "use", "use_pistol"),
    ("boîte de munitions", "munitions", None),   # quantité lue dans le libellé, comme une trousse
    ("micro d'annonces", "use", "use_pa_mic"),
    # Jusqu'au 2026-09-24 : `use_toilet`, un `use_*` généré ici (toujours sauté,
    # déjà dans `SIGNATURES_HABILLEES`) que `habiller_toilettes` remplaçait par
    # le vrai objet. Depuis : les cuvettes/urinoirs sont des `sanitaire_*`
    # utilisables directement (façon Duke), et la plaque de chasse n'est plus
    # qu'un décor (`wc_plaque_chasse`) — plus rien à poser depuis le plan.
    ("toilettes", "rien", None),
    ("trousse de soin", "soin", None),    # PV lus dans le libellé : « trousse de soin +25 »
    ("carte Argent", "carte", "argent"),
    ("carte Or", "carte", "or"),
    ("carte Platine", "rien", None),      # lâchée par le Directeur, rien à poser
    ("machine à pinces", "signature", "sig_machine_a_pinces"),
    ("photomaton", "signature", "sig_photomaton"),
    ("mur d'écrans", "rien", None),       # déjà posé en volume gris
    ("secret 1", "secret", "secret_1_photomaton"),
    ("secret 2", "secret", "secret_2_gondoles"),
    ("secret 3", "secret", "secret_3_aeration"),
    ("porte Argent", "rien", None),       # posée depuis les ouvertures
    ("porte Or", "rien", None),
    ("porte coupe-feu", "rien", None),    # posée par l'habillage, qui porte aussi son bouton
    ("SORTIE", "rien", None),
]


def _z_du_sol(space, x: float, y: float) -> float:
    """Altitude du sol sous (x, y) — interpolée dans une rampe. Sans ça, un
    repère posé dans la montée de service se retrouvait 1,5 m sous la pente
    (trouvé par `audit_niveau.py`)."""
    if not space.rampe:
        return space.z
    axe, z0, z1 = space.rampe
    t = ((x - space.x[0]) / max(space.largeur, 1e-6) if axe == "+x"
         else (y - space.y[0]) / max(space.profondeur, 1e-6))
    return z0 + (z1 - z0) * min(1.0, max(0.0, t))


def poser_reperes(materiaux, geo_coll, col_coll, logic_coll,
                  sauter: frozenset = frozenset()) -> dict:
    """Pose les repères de gameplay déclarés par le plan.

    `sauter` liste des `cible` de `REGLES_REPERES` à NE PAS poser — l'habillage
    (`build_niveau.py`) s'en sert pour remplacer une silhouette grise par le
    vrai objet, sans dupliquer la lecture du plan ni toucher au reste.
    """
    comptes = {"spawn": 0, "use": 0, "secret": 0, "signature": 0}
    for space in plan.ALL:
        compteurs: dict[str, int] = {}
        for label, rx, ry, nature, *altitude in space.reperes:
            regle = next((r for r in REGLES_REPERES if r[0] in label), None)
            if regle is None:
                raise SystemExit(f"[blockout] repère sans règle de construction : {label!r} ({space.id})")
            _, genre, cible = regle
            # Altitude facultative : un repère posé SUR un meuble (le campement
            # du secret 2, sur le toit des gondoles), pas sur le sol.
            z = _z_du_sol(space, rx, ry) + (altitude[0] if altitude else 0.0)

            if genre == "rien" or (cible is not None and cible in sauter):
                continue
            if genre == "spawn":
                empty("spawn_player", (rx, ry, z), logic_coll)
                comptes["spawn"] += 1
            elif genre == "use":
                boite_centree(cible, (rx, ry, z + 0.5), (0.5, 0.5, 0.5), "repere",
                              materiaux, logic_coll)
                comptes["use"] += 1
            elif genre == "carte":
                boite_centree(f"use_carte_{cible}", (rx, ry, z + 1.0), (0.4, 0.05, 0.6),
                              "repere", materiaux, logic_coll, extras={"card": cible})
                comptes["use"] += 1
            elif genre in ("soin", "munitions"):
                quantite = re.search(r"\+(\d+)", label)
                if quantite is None:
                    raise SystemExit(f"[blockout] ramassage sans quantité dans son libellé : {label!r} ({space.id})")
                compteurs[genre] = compteurs.get(genre, 0) + 1
                # Repère seulement : le jeu remplace la boîte par le vrai modèle,
                # posé sur le sol réellement sous elle (`render/pickups.ts`).
                boite_centree(f"use_{genre}_{space.id}_{compteurs[genre]}", (rx, ry, z + 0.25), (0.5, 0.5, 0.5),
                              "repere", materiaux, logic_coll, extras={genre: int(quantite.group(1))})
                comptes["use"] += 1
            elif genre == "secret":
                # Volume logique : rendu invisible par le loader, jamais un collider.
                boite_centree(cible, (rx, ry, z + 1.5), (3.0, 3.0, 3.0), "repere",
                              materiaux, logic_coll, extras={"secret_id": cible})
                comptes["secret"] += 1
            elif genre == "signature":
                # Emplacement réservé d'un objet « signature Duke » : sa
                # silhouette, pas son mécanisme (hors scope, reliquat Phase 5).
                boite(cible, (rx - 0.75, ry - 0.75, z), (1.5, 1.5, 2.0), "repere",
                      materiaux, geo_coll, col_coll)
                comptes["signature"] += 1
    return comptes


def poser_spawns(logic_coll) -> tuple[int, int]:
    costards = directeurs = 0
    for space in plan.SPACES:
        for nom, sx, sy, _couvert in space.spawns:
            if nom.startswith("director"):
                empty(f"spawn_director_{nom}", (sx, sy, space.z), logic_coll)
                directeurs += 1
            else:
                empty(f"spawn_{nom}", (sx, sy, space.z), logic_coll)
                costards += 1
    return costards, directeurs


# --- Assemblage --------------------------------------------------------------


def main() -> None:
    args = get_args()
    out = os.path.abspath(bpy.path.abspath(
        arg_value(args, "--out", "assets_src/blender/blockout_v2.blend")))

    geo_utils.wipe_scene()
    geo_utils.configure_scene()

    root = bpy.context.scene.collection
    geo = geo_utils.make_collection("GEO", root)
    shell = geo_utils.make_collection("SHELL", geo)
    props = geo_utils.make_collection("PROPS", geo)
    geo_utils.make_collection("DETAIL", geo)
    col_coll = geo_utils.make_collection("COL", root)
    logic_coll = geo_utils.make_collection("LOGIC", root)

    materiaux = creer_materiaux()
    ouvertures = ouvertures_effectives()

    sols = murs = vols = 0
    for space in plan.ALL:
        if space.rampe:
            sens, z0, z1 = space.rampe
            pente(f"sol_{space.id}", space.x, space.y, z0, z1, sens, materiaux, shell, col_coll)
        else:
            boite(f"sol_{space.id}", (space.x[0], space.y[0], space.z - EPAISSEUR_SOL),
                  (space.largeur, space.profondeur, EPAISSEUR_SOL), "sol", materiaux, shell, col_coll)
        sols += 1
        murs += murs_espace(space, ouvertures, materiaux, shell, col_coll)
        vols += volumes(space, materiaux, props, col_coll)

    portes = poser_portes(ouvertures, materiaux, shell, logic_coll)
    poser_palier_sortie(materiaux, shell, col_coll)
    reperes = poser_reperes(materiaux, props, col_coll, logic_coll)
    costards, directeurs = poser_spawns(logic_coll)

    bpy.ops.wm.save_as_mainfile(filepath=out)

    print("\n[blockout] " + "-" * 52)
    print(f"[blockout] {sols} sols, {murs} morceaux de mur, {vols} volumes gris")
    print(f"[blockout] {portes} portes, {reperes['use']} use_*, {reperes['secret']} secrets, "
          f"{reperes['signature']} emplacements signature")
    print(f"[blockout] {costards} spawn_suit_*, {directeurs} spawn_director_*, {reperes['spawn']} spawn_player")
    print(f"[blockout] écrit : {out}")


if __name__ == "__main__":
    main()
