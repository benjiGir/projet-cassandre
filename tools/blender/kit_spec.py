"""
Spécification du kit modulaire hypermarché — PROJET_CASSANDRE.

Données pures, aucune dépendance à `bpy`. Importable depuis un script Blender
(`build_kit.py`) comme depuis un script Python nu (vérification, doc, CI).

    python3 tools/blender/kit_spec.py          # imprime la table du kit

Repère Blender, Z vers le haut, 1 unité = 1 mètre. Origine à un coin au sol
pour chaque pièce (coordonnées locales positives, x∈[0,W] y∈[0,D] z∈[0,H]),
classes de pièce (SHELL/PROP/DETAIL) et leurs contraintes de grille, exceptions
d'origine (sol/plafond) : voir
docs/reference/conventions-nommage.md#classes-de-pièce-du-kit-modulaire-toolsblenderkit_specpy

Proxies de collision : `col_box_*` cuboid, `col_hull_*` convexHull,
`col_mesh_*` trimesh (aucun dans ce kit — c'est le but) — voir le skill
`collision-proxy-authoring`. Plusieurs `col_box_*` sur une même pièce =
compound (décomposition d'une forme concave, jamais un trimesh pour ça).

Subdivision (`SEG_TARGET`, skill `vertex-color-sector-lighting`) et densité de
texels (`UV_TILE`, skill `retro-texture-density`) sont des propriétés du kit,
pas des retouches après coup — voir les constantes ci-dessous.
"""

from __future__ import annotations

# --- Constantes de construction ---------------------------------------------

SEG_TARGET = 1.0        # pas de subdivision, en mètres
UV_TILE = 2.0           # mètres couverts par une tuile de texture (64 px/m à 128 px)
GRID_FINE = 0.25        # grille fine du projet
WALL_H = 5.0            # hauteur surface de vente
WALL_T = 0.25           # épaisseur de mur
SLAB_T = 0.25           # épaisseur dalle sol / plafond

# Matériaux : un par famille, partagés par tout le kit.
MAT_SHELL = "mat_kit_shell"
MAT_PROPS = "mat_kit_props"
MAT_STORAGE = "mat_kit_storage"
MAT_DETAIL = "mat_kit_detail"
MAT_EMIT = "mat_kit_emit"

MATERIALS = {
    # nom            : (base color RGB,           emission strength)
    MAT_SHELL:   ((0.74, 0.73, 0.70), 0.0),
    MAT_PROPS:   ((0.64, 0.68, 0.74), 0.0),
    MAT_STORAGE: ((0.72, 0.62, 0.46), 0.0),
    MAT_DETAIL:  ((0.55, 0.57, 0.60), 0.0),
    MAT_EMIT:    ((1.00, 0.96, 0.88), 8.0),
}


def box(x, y, z, sx, sy, sz, mat=None):
    """Une brique de géométrie : coin bas + dimensions, matériau optionnel."""
    return {"o": (x, y, z), "s": (sx, sy, sz), "mat": mat}


def _stairs_parts(steps=8, rise=0.25, run=0.25, width=2.0):
    """Escalier en empilement de boîtes pleines : chaque marche monte du sol.

    Les faces coïncidentes entre marches voisines sont internes au solide et
    invisibles de l'extérieur (backface culling) — c'est le prix payé pour
    n'avoir que des quads et zéro n-gon. Un profil extrudé donnerait des
    n-gons sur les deux capuchons.
    """
    return [box(i * run, 0.0, 0.0, run, width, (i + 1) * rise) for i in range(steps)]


def _railing_parts(length=2.0, height=1.0, depth=0.15):
    post = depth
    rail_t = 0.1
    parts = [
        box(0.0, 0.0, 0.0, post, depth, height),
        box(length - post, 0.0, 0.0, post, depth, height),
        box(0.0, 0.0, height - rail_t, length, depth, rail_t),          # main courante
        box(0.0, 0.0, height * 0.5 - rail_t / 2, length, depth, rail_t),  # lisse
    ]
    return parts


def _gondola_parts(length, depth, height, mat):
    """Gondole : socle plein, panneau dorsal central, trois tablettes.

    Le panneau dorsal est centré en Y, les tablettes couvrent la profondeur
    totale — c'est ce qui donne la silhouette « double face » d'une gondole
    sans dépasser de l'empreinte annoncée.
    """
    plinth_h = 0.15
    shelf_t = 0.06
    back_t = 0.25
    back_y = (depth - back_t) / 2.0
    parts = [
        box(0.0, 0.0, 0.0, length, depth, plinth_h, mat),
        box(0.0, back_y, plinth_h, length, back_t, height - plinth_h, mat),
    ]
    for z in (0.55, 1.05, 1.55):
        parts.append(box(0.0, 0.0, z, length, depth, shelf_t, mat))
    return parts


def _rack_parts(length=4.0, depth=1.2, height=6.0, mat=MAT_STORAGE):
    """Rack à palettes : deux échelles verticales + trois niveaux de lisses."""
    up = 0.1
    beam = 0.12
    parts = []
    for x in (0.0, length - up):
        parts.append(box(x, 0.0, 0.0, up, depth, height))
    for z in (1.8, 3.6, 5.4):
        parts.append(box(0.0, 0.0, z, length, up, beam))
        parts.append(box(0.0, depth - up, z, length, up, beam))
    for p in parts:
        p["mat"] = mat
    return parts


def _pallet_parts(length=1.2, depth=0.8, height=0.15):
    boards = []
    for y in (0.0, (depth - 0.1) / 2.0, depth - 0.1):
        boards.append(box(0.0, y, 0.0, length, 0.1, 0.10, MAT_STORAGE))
    boards.append(box(0.0, 0.0, 0.10, length, depth, 0.05, MAT_STORAGE))
    return boards


def _cart_parts(length=1.0, depth=0.6, height=1.0):
    """Caddie : châssis bas, panier ouvert à parois fines, barre de poussée.

    Le châssis part de z=0 : l'origine d'une pièce est un coin AU SOL, une
    géométrie qui flotte à 0.05 casse le posé sur grille.
    """
    w = 0.05
    basket_z = 0.5
    top = height
    return [
        box(0.05, 0.05, 0.0, length - 0.1, depth - 0.1, 0.15, MAT_DETAIL),    # châssis
        box(0.0, 0.0, basket_z, length, depth, w, MAT_PROPS),                 # fond
        box(0.0, 0.0, basket_z, w, depth, top - basket_z, MAT_PROPS),         # paroi -X
        box(length - w, 0.0, basket_z, w, depth, top - basket_z, MAT_PROPS),  # paroi +X
        box(0.0, 0.0, basket_z, length, w, top - basket_z, MAT_PROPS),        # paroi -Y
        box(0.0, depth - w, basket_z, length, w, top - basket_z, MAT_PROPS),  # paroi +Y
    ]


def _freezer_parts(length=2.0, depth=1.0, height=2.0):
    """Meuble surgelés : caisson + montants de portes en relief.

    Les montants occupent les 3 premiers centimètres de profondeur et le
    caisson est reculé d'autant : le relief se lit, mais l'empreinte reste
    exactement 2 × 1 et le proxy cuboid colle au rendu.
    """
    mull = 0.06
    relief = 0.03
    parts = [box(0.0, relief, 0.0, length, depth - relief, height, MAT_PROPS)]
    for x in (0.0, length / 2.0 - mull / 2.0, length - mull):
        parts.append(box(x, 0.0, 0.2, mull, relief, height - 0.4, MAT_DETAIL))
    return parts


def _checkout_parts(length=3.0, depth=1.0, height=1.1):
    """Caisse : caisson, tapis en creux, borne de scan."""
    body_h = 0.9
    return [
        box(0.0, 0.0, 0.0, length, depth, body_h, MAT_PROPS),
        box(0.4, 0.1, body_h, length - 0.9, depth - 0.2, 0.05, MAT_DETAIL),   # tapis
        box(length - 0.5, 0.25, body_h, 0.4, 0.4, height - body_h, MAT_DETAIL),  # borne
    ]


def _crate_parts(side=1.0):
    """Caisse : cube plein, SANS tasseaux d'angle — des tasseaux au ras du
    cube bakaient entièrement noir (faces coïncidentes, auto-occultation).
    see: docs/pipeline/niveau-blender.md#diagnostic-dun-mesh-entièrement-noir
    """
    return [box(0.0, 0.0, 0.0, side, side, side, MAT_STORAGE)]


def _wall_opening_parts(width, jamb, open_w, open_h, height=WALL_H, thick=WALL_T):
    """Panneau mural percé d'une ouverture centrée, décomposé en 3 boîtes.

    Retourne (parts, proxies) — la même décomposition sert de compound de
    collision, donc le proxy colle exactement au rendu, jambage par jambage.
    """
    right_x = jamb + open_w
    parts = [
        box(0.0, 0.0, 0.0, jamb, thick, height, MAT_SHELL),
        box(right_x, 0.0, 0.0, width - right_x, thick, height, MAT_SHELL),
        box(jamb, 0.0, open_h, open_w, thick, height - open_h, MAT_SHELL),
    ]
    proxies = [
        ("box", "l", (0.0, 0.0, 0.0), (jamb, thick, height)),
        ("box", "r", (right_x, 0.0, 0.0), (width - right_x, thick, height)),
        ("box", "top", (jamb, 0.0, open_h), (open_w, thick, height - open_h)),
    ]
    return parts, proxies


_DOOR_PARTS, _DOOR_PROXIES = _wall_opening_parts(2.0, 0.25, 1.5, 2.5)
_DOCK_PARTS, _DOCK_PROXIES = _wall_opening_parts(4.0, 0.5, 3.0, 4.0)


# --- Table du kit ------------------------------------------------------------
#
# Chaque entrée :
#   name     nom de la pièce (= nom du mesh, de la collection, préfixe des proxies)
#   cls      SHELL | PROP | DETAIL
#   group    SHELL | PROPS | STORAGE | DETAIL — famille, sert au rangement
#   dims     empreinte annoncée (W, D, H) telle qu'elle figure dans le skill
#   mat      matériau par défaut des parts qui n'en déclarent pas
#   parts    boîtes de géométrie rendue
#   proxies  ("box"|"hull_ramp", suffixe, origine, dimensions)
#   props    custom properties -> glTF extras
#   note     justification, affichée par inspect_kit.py

KIT = [
    # ---------------------------------------------------------------- COQUE --
    dict(name="kit_wall_4m", cls="SHELL", group="SHELL", dims=(4.0, WALL_T, WALL_H),
         mat=MAT_SHELL, parts=[box(0, 0, 0, 4.0, WALL_T, WALL_H)],
         proxies=[("box", "", (0, 0, 0), (4.0, WALL_T, WALL_H))]),
    dict(name="kit_wall_2m", cls="SHELL", group="SHELL", dims=(2.0, WALL_T, WALL_H),
         mat=MAT_SHELL, parts=[box(0, 0, 0, 2.0, WALL_T, WALL_H)],
         proxies=[("box", "", (0, 0, 0), (2.0, WALL_T, WALL_H))]),
    dict(name="kit_wall_1m", cls="SHELL", group="SHELL", dims=(1.0, WALL_T, WALL_H),
         mat=MAT_SHELL, parts=[box(0, 0, 0, 1.0, WALL_T, WALL_H)],
         proxies=[("box", "", (0, 0, 0), (1.0, WALL_T, WALL_H))],
         note="pièce de raccord : referme un tronçon impair sans casser la grille"),

    dict(name="kit_corner_out", cls="SHELL", group="SHELL", dims=(WALL_T, WALL_T, WALL_H),
         mat=MAT_SHELL, parts=[box(0, 0, 0, WALL_T, WALL_T, WALL_H)],
         proxies=[("box", "", (0, 0, 0), (WALL_T, WALL_T, WALL_H))],
         note="bouche le vide 0.25 × 0.25 d'un angle sortant entre deux murs à 90°"),

    dict(name="kit_corner_in", cls="SHELL", group="SHELL", dims=(1.0, 1.0, WALL_H),
         mat=MAT_SHELL,
         parts=[box(0, 0, 0, 1.0, WALL_T, WALL_H),
                box(0, WALL_T, 0, WALL_T, 1.0 - WALL_T, WALL_H)],
         proxies=[("box", "a", (0, 0, 0), (1.0, WALL_T, WALL_H)),
                  ("box", "b", (0, WALL_T, 0), (WALL_T, 1.0 - WALL_T, WALL_H))],
         note="angle rentrant en L, empreinte 1×1 — concave, donc COMPOUND de "
              "deux cuboids et non un trimesh"),

    dict(name="kit_door_2m", cls="SHELL", group="SHELL", dims=(2.0, WALL_T, WALL_H),
         mat=MAT_SHELL, parts=_DOOR_PARTS, proxies=_DOOR_PROXIES,
         note="ouverture 1.5 × 2.5 centrée — compound de 3 cuboids "
              "(2 jambages + linteau)"),

    dict(name="kit_door_leaf", cls="PROP", group="SHELL", dims=(1.5, 0.15, 2.5),
         mat=MAT_SHELL, parts=[box(0, 0, 0, 1.5, 0.15, 2.5)],
         proxies=[],
         props={"kit_rename_to": "door_*"},
         note="AJOUT hors liste du skill : le vantail qui remplit kit_door_2m. "
              "Aucun proxy — à renommer door_* en niveau, le loader lui crée "
              "un cuboid dynamique depuis sa bounding box (loader.ts buildDoor)"),

    dict(name="kit_floor_4x4", cls="SHELL", group="SHELL", dims=(4.0, 4.0, SLAB_T),
         slab=True, mat=MAT_SHELL, parts=[box(0, 0, -SLAB_T, 4.0, 4.0, SLAB_T)],
         proxies=[("box", "", (0, 0, -SLAB_T), (4.0, 4.0, SLAB_T))],
         note="origine au coin de la SURFACE DE MARCHE : la dalle descend "
              "sous z=0, poser à z=0 fait marcher le joueur à z=0"),

    dict(name="kit_ceiling_4x4", cls="SHELL", group="SHELL", dims=(4.0, 4.0, SLAB_T),
         slab=True, mat=MAT_SHELL, parts=[box(0, 0, 0, 4.0, 4.0, SLAB_T)],
         proxies=[("box", "", (0, 0, 0), (4.0, 4.0, SLAB_T))],
         note="origine au coin de la SOUS-FACE : poser à z=5 donne 5 m libres"),

    dict(name="kit_pillar", cls="SHELL", group="SHELL", dims=(0.5, 0.5, WALL_H),
         mat=MAT_SHELL, parts=[box(0, 0, 0, 0.5, 0.5, WALL_H)],
         proxies=[("box", "", (0, 0, 0), (0.5, 0.5, WALL_H))]),

    dict(name="kit_stairs_2m", cls="SHELL", group="SHELL", dims=(2.0, 2.0, 2.0),
         mat=MAT_SHELL, parts=_stairs_parts(),
         proxies=[("hull_ramp", "", (0, 0, 0), (2.0, 2.0, 2.0))],
         note="8 marches de 0.25 (< autostep 0.35) sur 2 m de course = 45°, "
              "sous la pente max 50°. Proxy = RAMPE convexe, pas les marches "
              "(collision-proxy-authoring) : supprime les accrochages"),

    dict(name="kit_railing_2m", cls="PROP", group="SHELL", dims=(2.0, 0.15, 1.0),
         mat=MAT_DETAIL, parts=_railing_parts(),
         proxies=[("box", "", (0, 0, 0), (2.0, 0.15, 1.0))],
         note="proxy plein volontairement : une rambarde doit bloquer, pas "
              "laisser passer entre les lisses"),

    # ---------------------------------------------------- MOBILIER DE VENTE --
    dict(name="kit_gondola_4m", cls="PROP", group="PROPS", dims=(4.0, 1.25, 2.0),
         mat=MAT_PROPS, parts=_gondola_parts(4.0, 1.25, 2.0, MAT_PROPS),
         proxies=[("box", "", (0, 0, 0), (4.0, 1.25, 2.0))],
         note="1.25 de profondeur, allée de 3 m entre deux gondoles. Sommet à "
              "2.0 m > hauteur des yeux 1.6 m : bloque réellement la vue"),

    dict(name="kit_gondola_end", cls="PROP", group="PROPS", dims=(1.25, 1.25, 2.0),
         mat=MAT_PROPS, parts=_gondola_parts(1.25, 1.25, 2.0, MAT_PROPS),
         proxies=[("box", "", (0, 0, 0), (1.25, 1.25, 2.0))],
         note="tête de gondole, ferme une allée"),

    dict(name="kit_checkout", cls="PROP", group="PROPS", dims=(3.0, 1.0, 1.1),
         mat=MAT_PROPS, parts=_checkout_parts(),
         proxies=[("box", "", (0, 0, 0), (3.0, 1.0, 1.1))],
         note="1.1 m de haut, SOUS la hauteur des yeux 1.6 m — ne bloque "
              "aucun hitscan, c'est un obstacle de déplacement, pas un couvert"),

    dict(name="kit_freezer_2m", cls="PROP", group="PROPS", dims=(2.0, 1.0, 2.0),
         mat=MAT_PROPS, parts=_freezer_parts(),
         proxies=[("box", "", (0, 0, 0), (2.0, 1.0, 2.0))]),

    dict(name="kit_cart", cls="PROP", group="PROPS", dims=(1.0, 0.6, 1.0),
         mat=MAT_PROPS, parts=_cart_parts(),
         proxies=[("box", "", (0, 0, 0), (1.0, 0.6, 1.0))],
         props={"dynamic": 1, "mass": 12.0},
         note="DYNAMIQUE : extras dynamic/mass posés pour un loader qui ne les "
              "lit pas encore (voir README, travail restant level-pipeline)"),

    # ------------------------------------------------------- RÉSERVE / QUAI --
    dict(name="kit_rack_4m", cls="PROP", group="STORAGE", dims=(4.0, 1.2, 6.0),
         mat=MAT_STORAGE, parts=_rack_parts(),
         proxies=[("box", "", (0, 0, 0), (4.0, 1.2, 6.0))],
         note="proxy = boîte englobante pleine (collision-proxy-authoring : "
              "« une étagère avec des articles → une boîte englobante »)"),

    dict(name="kit_pallet", cls="PROP", group="STORAGE", dims=(1.2, 0.8, 0.15),
         mat=MAT_STORAGE, parts=_pallet_parts(),
         proxies=[("box", "", (0, 0, 0), (1.2, 0.8, 0.15))],
         note="0.15 d'épaisseur : au-dessus du minimum 0.1 anti-tunneling, et "
              "sous l'autostep 0.35 donc franchissable sans saut"),

    dict(name="kit_crate", cls="PROP", group="STORAGE", dims=(1.0, 1.0, 1.0),
         mat=MAT_STORAGE, parts=_crate_parts(),
         proxies=[("box", "", (0, 0, 0), (1.0, 1.0, 1.0))],
         props={"dynamic": 1, "mass": 25.0},
         note="DYNAMIQUE. 1 m de haut : rebord franchissable (saut 1.1 m)"),

    dict(name="kit_dock_door", cls="SHELL", group="STORAGE", dims=(4.0, WALL_T, WALL_H),
         mat=MAT_SHELL, parts=_DOCK_PARTS, proxies=_DOCK_PROXIES,
         note="ouverture de quai 3 × 4 dans un panneau de 4 m — compound de "
              "3 cuboids"),

    # -------------------------------------------------- ÉCLAIRAGE / DÉTAIL --
    dict(name="kit_ceiling_light", cls="DETAIL", group="DETAIL", dims=(2.0, 0.3, 0.15),
         mat=MAT_DETAIL,
         parts=[box(0, 0, 0.03, 2.0, 0.3, 0.12, MAT_DETAIL),
                box(0.05, 0.025, 0.0, 1.9, 0.25, 0.03, MAT_EMIT)],
         proxies=[],
         note="origine au coin BAS comme toute pièce du kit : se pose à "
              "z = plafond − 0.15 (soit 4.85 sous une dalle à 5). Aucun proxy "
              "— DETAIL non collidable. Le panneau bas est émissif et éclaire "
              "réellement pendant le bake"),

    dict(name="kit_vent", cls="DETAIL", group="DETAIL", dims=(1.0, 0.1, 0.5),
         mat=MAT_DETAIL,
         parts=([box(0, 0, 0, 1.0, 0.06, 0.5, MAT_DETAIL)]
                + [box(0.05, 0.06, 0.06 + i * 0.11, 0.9, 0.04, 0.06, MAT_DETAIL)
                   for i in range(4)]),
         proxies=[],
         note="grille murale, 4 lames. DETAIL non collidable"),

    dict(name="kit_sign_aisle", cls="DETAIL", group="DETAIL", dims=(1.0, 0.06, 0.5),
         mat=MAT_DETAIL,
         parts=[box(0, 0, 0, 1.0, 0.06, 0.4, MAT_PROPS),
                box(0.45, 0.0, 0.4, 0.1, 0.06, 0.1, MAT_DETAIL)],
         proxies=[],
         props={"kit_note": "numero d'allee a poser en texture ou en extras"},
         note="panneau d'allée + patte de suspente. DETAIL non collidable"),

    dict(name="kit_camera", cls="DETAIL", group="DETAIL", dims=(0.5, 0.2, 0.25),
         mat=MAT_DETAIL,
         parts=[box(0.1, 0.0, 0.0, 0.3, 0.2, 0.15, MAT_DETAIL),      # corps
                box(0.0, 0.05, 0.15, 0.1, 0.1, 0.1, MAT_DETAIL),     # patte murale
                box(0.4, 0.075, 0.05, 0.1, 0.05, 0.05, MAT_PROPS)],  # objectif
         proxies=[],
         note="caméra de surveillance, patte en haut : se pose à "
              "z = hauteur de fixation − 0.25. DETAIL non collidable"),
]


# --- Vérifications de cohérence de la table (pas de bpy requis) --------------

def check_spec():
    """Contrôle la table contre ses propres règles. Retourne (erreurs, warnings)."""
    errors, warnings = [], []
    seen = set()
    for p in KIT:
        n = p["name"]
        if n in seen:
            errors.append(f"{n}: nom en double dans la table")
        seen.add(n)
        if not n.startswith("kit_"):
            errors.append(f"{n}: préfixe kit_ manquant")
        if not p["parts"]:
            errors.append(f"{n}: aucune géométrie")

        w, d, h = p["dims"]
        if p["cls"] == "SHELL":
            # Sous-modules admis : l'épaisseur de mur et la section de pilier
            # sont des largeurs de coque légitimes sous le mètre.
            sub_modules = (WALL_T, 0.5)
            on_module = abs(w - round(w)) < 1e-6 or any(abs(w - s) < 1e-6 for s in sub_modules)
            if not on_module:
                errors.append(f"{n}: SHELL, empreinte X {w} ni multiple de 1 m ni sous-module {sub_modules}")
            # Une dalle est horizontale : son «H» est une ÉPAISSEUR (0.25 =
            # épaisseur de mur du projet), pas une hauteur d'empilement. La
            # règle des 0.5 m ne s'y applique pas.
            if not p.get("slab") and abs(h / 0.5 - round(h / 0.5)) > 1e-6:
                errors.append(f"{n}: SHELL, hauteur {h} non multiple de 0.5 m")
        # Aucun contrôle de grille sur les PROP : leurs dimensions viennent
        # littéralement de `modular-kit-design` (palette 1.2 × 0.8, caisse à
        # 1.1 de haut, gondole profonde de 1.25) et sortent de la grille 0.25
        # par conception. C'est leur PLACEMENT qui doit tomber sur la grille,
        # et c'est validate_level.py qui le contrôle, sur le fichier de niveau.

        for kind, suffix, o, s in p.get("proxies", []):
            if min(s) < 0.1:
                errors.append(f"{n}: proxy {suffix or '(seul)'} épaisseur {min(s)} < 0.1 m")
            if kind not in ("box", "hull_ramp"):
                errors.append(f"{n}: type de proxy inconnu {kind!r}")
        if p["cls"] != "DETAIL" and not p.get("proxies"):
            if n != "kit_door_leaf":
                errors.append(f"{n}: pièce collidable sans proxy")
    return errors, warnings


def proxy_mesh_name(piece_name: str, kind: str, suffix: str) -> str:
    """Nom du mesh-datablock d'un proxy — même règle que `build_kit.py`
    (single source of truth, réutilisée par `build_level.py` pour retrouver
    quels proxies appartiennent à une pièce quand il faut les instancier
    dans un niveau)."""
    prefix = "col_box_" if kind == "box" else "col_hull_"
    base = piece_name[len("kit_"):]
    return f"{prefix}{base}" + (f"_{suffix}" if suffix else "")


def proxy_names_for(piece: dict) -> list[str]:
    """Noms des mesh-datablocks de proxy d'une pièce, dans l'ordre de la
    table `KIT`."""
    return [proxy_mesh_name(piece["name"], kind, suffix)
            for kind, suffix, _origin, _size in piece.get("proxies", [])]


def find_piece(name: str) -> dict:
    for p in KIT:
        if p["name"] == name:
            return p
    raise KeyError(f"pièce de kit inconnue : {name!r}")


def _fmt(v):
    return f"{v:g}"


if __name__ == "__main__":
    import sys
    errs, warns = check_spec()
    print(f"{'PIÈCE':<20} {'CLASSE':<7} {'DIMENSIONS':<20} {'PARTS':>5} {'PROXIES':>8}")
    print("-" * 66)
    for p in KIT:
        w, d, h = p["dims"]
        kinds = ",".join(sorted({k for k, _, _, _ in p.get("proxies", [])})) or "—"
        print(f"{p['name']:<20} {p['cls']:<7} "
              f"{_fmt(w) + ' × ' + _fmt(d) + ' × ' + _fmt(h):<20} "
              f"{len(p['parts']):>5} {str(len(p.get('proxies', []))) + ' ' + kinds:>8}")
    print("-" * 66)
    print(f"{len(KIT)} pièces, {sum(len(p['parts']) for p in KIT)} boîtes, "
          f"{sum(len(p.get('proxies', [])) for p in KIT)} proxies")
    for w_ in warns:
        print(f"  WARN   {w_}")
    for e in errs:
        print(f"  ERROR  {e}")
    sys.exit(1 if errs else 0)
