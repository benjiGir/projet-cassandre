"""
Validation d'un niveau PROJET_CASSANDRE avant export.

    blender -b level.blend -P tools/blender/validate_level.py
    blender -b level.blend -P tools/blender/validate_level.py -- --strict
    blender -b kit.blend   -P tools/blender/validate_level.py -- --kit

Options :
    --strict   les warnings deviennent bloquants (CI, pas itération)
    --kit      fichier de KIT et non de niveau : relâche les contrôles qui
               n'ont de sens que sur un niveau assemblé (spawn_player unique)

Code retour : 0 = conforme, 1 = erreurs bloquantes.

Vérifié sur Blender 5.1.2 (voir README).
"""

import re
import sys
from collections import Counter

import bpy
from mathutils import Vector

# --- Constantes projet -------------------------------------------------------
GRID = 0.25
MAX_TEXTURE = 128
# Exception décidée le 2026-09-15 : l'atlas des affiches de marques (`aff_*`)
# ne se répète pas sur un mur, il porte quinze affiches lisibles en UN seul
# matériau. Le découper en textures de 128 coûterait un lot de dessin par
# affiche. Voir docs/pipeline/harmonisation-assets.md#affiches-de-marques.
MAX_TEXTURE_AFFICHES = 512
TEXEL_DENSITY = 64.0          # px/m
MAX_STEP = 0.35               # autostep du character controller
MIN_CEILING = 2.0
MIN_PASSAGE = 1.0
MIN_PROXY_THICKNESS = 0.1
MAX_THIN_RATIO = 20.0
# Budget MESURÉ, pas supposé : 1,45 million de triangles dans le champ coûtent
# 4,94 ms GPU sur la machine de mesure, pour une image de 16,6 ms. Les 200 000
# posés a priori au jalon N1 étaient trop prudents d'un ordre de grandeur — ce
# sont les LAMPES qui font mur, pas les triangles.
# Voir docs/decisions/0026-visibilite-par-espace-et-pool-de-lampes.md
TRI_BUDGET = 1_500_000

# Collections sources, jamais exportées (voir `export_level.py`).
SOURCE_COLLECTIONS = {"_KIT", "_LIB"}

PREFIXES = (
    "col_box_", "col_hull_", "col_mesh_", "col_",
    "spawn_", "trig_", "door_", "use_", "secret_", "kit_", "prop_", "vitre_",
    "sanitaire_",
)

# Extras d'un `door_*` animé — doivent rester identiques à ce que lit
# src/game/level/doorSystem.ts (docs/reference/conventions-nommage.md#portes).
MOUVEMENTS_PORTE = ("descend", "monte", "battant", "coulisse")
CHARNIERES = ("min", "max")
SENS_PORTE = ("auto", "+", "-")
# `auto` : True (tout le monde) ou "ennemis" (les Costards seuls, le joueur
# l'ouvre à la main). `manuelle` : True (ouvrir et fermer) ou "fermer" (la
# porte coupe-feu : son bouton commande l'ouverture, la main la referme).
AUTO_PORTE = ("true", "1", "ennemis")
MANUELLE_PORTE = ("true", "1", "fermer")

# Cartes de fidélité (jalon N7) — doit rester identique à `LOYALTY_CARDS`
# dans src/game/player/loyaltyCards.ts.
LOYALTY_CARDS = ("argent", "or", "platine")

# Matières de props — doit rester identique à `PROP_MATERIALS` dans
# src/game/level/props.ts.
PROP_MATIERES = ("bois", "carton", "verre", "metal")

# Sortes de `sanitaire_*` — cuvette et urinoir, utilisables et cassables façon
# Duke Nukem 3D (2026-09-24). Doit rester identique à ce que lit le runtime
# côté loader (voir `docs/reference/conventions-nommage.md#sanitaires`).
SANITAIRE_SORTES = ("cuvette", "urinoir")

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def centre_monde(obj) -> Vector:
    """Centre de la boîte englobante de `obj` en espace MONDE."""
    coins = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return sum(coins, Vector((0.0, 0.0, 0.0))) / len(coins)


def base_name(name: str) -> str:
    """Retire le suffixe .001 ajouté par Blender aux doublons."""
    return re.sub(r"\.\d{3}$", "", name)


# --- 1. Unités ---------------------------------------------------------------
def check_units() -> None:
    u = bpy.context.scene.unit_settings
    if u.system != "METRIC":
        err(f"Unit system = {u.system}, attendu METRIC")
    if abs(u.scale_length - 1.0) > 1e-6:
        err(f"Unit scale = {u.scale_length}, attendu 1.0 (1 unité = 1 mètre)")


# --- 2. Transforms et grille -------------------------------------------------
def check_transforms(meshes) -> None:
    for o in meshes:
        s = o.scale
        if any(abs(c - 1.0) > 1e-4 for c in s):
            err(f"{o.name}: scale non appliqué {tuple(round(c, 3) for c in s)}")

        # Un vantail a son origine au CENTRE de sa boîte (le loader y pose son
        # corps, ADR 0012) : elle dépend de ses dimensions, pas de la grille.
        if base_name(o.name).startswith("door_"):
            continue
        loc = o.location
        off = [c for c in loc if abs(c / GRID - round(c / GRID)) > 1e-3]
        if off:
            warn(f"{o.name}: hors grille {GRID} m — {tuple(round(c, 3) for c in loc)}")


# --- 3. Nommage --------------------------------------------------------------
def check_naming(objects, kit_mode: bool = False) -> None:
    spawns = [o for o in objects if base_name(o.name) == "spawn_player"]
    if kit_mode:
        # Un fichier de kit ne contient aucune logique de niveau : pas de
        # spawn, pas de trigger. Exiger un spawn_player ici n'aurait aucun sens.
        if spawns:
            warn(f"{len(spawns)} spawn_player dans un fichier de KIT — le kit "
                 "n'est pas un niveau, la logique se pose à l'assemblage")
    elif len(spawns) == 0:
        err("Aucun spawn_player dans la scène")
    elif len(spawns) > 1:
        err(f"{len(spawns)} spawn_player — il en faut exactement un")

    for o in objects:
        n = base_name(o.name)
        if n.startswith("trig_") and o.type == "MESH":
            if len(o.data.vertices) != 8:
                err(f"{o.name}: trigger non-box ({len(o.data.vertices)} sommets)")
        if n.startswith("use_") and not {"target", "card", "soin", "munitions"} & set(o.keys()):
            # "target" — PAS "use_target" : c'est la custom property que
            # `loader.ts::buildUseObject` lit réellement (`extras.target`,
            # voir gltf-level-conventions). Le nom précédent ne correspondait
            # à rien côté runtime ; corrigé pour que ce warning ait un sens
            # sur un futur `use_*` qui référence vraiment une cible.
            # Exception "card" : une carte de fidélité à ramasser se suffit à
            # elle-même, il n'y a rien à cibler (jalon N7, même règle que
            # `loader.ts::buildUseObjectEffect`). Idem pour "soin", une trousse.
            warn(f"{o.name}: interactif sans custom property 'target'")
        # Cartes de fidélité (jalon N7) : une valeur mal tapée rendrait la
        # porte ouverte à tous, ou la carte introuvable. Côté jeu c'est un
        # avertissement bruyant ; ici c'est une ERREUR, parce qu'on peut
        # encore corriger le .blend avant l'export.
        for cle in ("card", "requires"):
            if n.startswith("use_") and cle in o.keys():
                valeur = str(o[cle]).strip().lower()
                if valeur not in LOYALTY_CARDS:
                    err(f"{o.name}: '{cle}' = '{o[cle]}' n'est pas une carte "
                        f"({', '.join(LOYALTY_CARDS)})")
        for cle, unite in (("soin", "PV"), ("munitions", "munitions")):
            if n.startswith("use_") and cle in o.keys():
                try:
                    quantite = float(o[cle])
                except (TypeError, ValueError):
                    quantite = 0.0
                if not quantite > 0:
                    err(f"{o.name}: '{cle}' = '{o[cle]}' n'est pas un nombre de {unite} > 0")
        if n.startswith("use_") and "requires" in o.keys() and "target" not in o.keys():
            warn(f"{o.name}: 'requires' sans 'target' — aucune porte à ouvrir")
        if n.startswith("secret_") and "secret_id" not in o.keys():
            warn(f"{o.name}: secret sans 'secret_id'")

        # --- door_* : une valeur mal tapée ferait une porte qui glisse dans
        # le sol au lieu de pivoter, sans rien dire.
        if n.startswith("door_"):
            for cle, permis in (("mouvement", MOUVEMENTS_PORTE), ("charniere", CHARNIERES),
                                ("sens", SENS_PORTE), ("auto", AUTO_PORTE), ("manuelle", MANUELLE_PORTE)):
                if cle in o.keys() and str(o[cle]).strip().lower() not in permis:
                    err(f"{o.name}: '{cle}' = '{o[cle]}' n'est pas une valeur connue ({', '.join(permis)})")
            for cle in ("angle", "course", "duree", "portee", "delai"):
                if cle in o.keys():
                    try:
                        valeur = float(o[cle])
                    except (TypeError, ValueError):
                        valeur = 0.0
                    if not valeur > 0:
                        err(f"{o.name}: '{cle}' = '{o[cle]}' n'est pas un nombre > 0")
            if o.type == "MESH" and len(o.data.materials) > 1:
                err(f"{o.name}: {len(o.data.materials)} matériaux — un vantail n'en a qu'UN "
                    "(deux primitives glTF, et le loader ne voit plus une porte)")

        # --- vitre_* : du verre. `pv` absent = incassable.
        if n.startswith("vitre_") and o.type == "MESH":
            if "pv" in o.keys():
                try:
                    pv = float(o["pv"])
                except (TypeError, ValueError):
                    pv = 0.0
                if not pv > 0:
                    err(f"{o.name}: 'pv' = '{o['pv']}' n'est pas un nombre > 0")
            if "pv" in o.keys() and "solide" in o.keys() and not o["solide"]:
                err(f"{o.name}: cassable ('pv') mais sans collider ('solide' faux) — aucun tir ne la trouvera")

        # --- prop_* : mobilier physique (corps dynamique Rapier).
        if n.startswith("prop_") and o.type == "MESH":
            # Le collider est un CUBOID déduit de la bounding box, comme pour
            # `col_box_*`. Une forme qui n'est pas une boîte ne sera pas
            # refusée par le loader — elle sera silencieusement approximée par
            # sa boîte englobante, ce qui se voit en jeu et pas dans le .blend.
            if len(o.data.vertices) != 8:
                warn(f"{o.name}: prop non-box ({len(o.data.vertices)} sommets) — "
                     "le collider sera sa boîte englobante")
            if "matiere" in o.keys():
                valeur = str(o["matiere"]).strip().lower()
                if valeur not in PROP_MATIERES:
                    err(f"{o.name}: 'matiere' = '{o['matiere']}' n'est pas une matière "
                        f"({', '.join(PROP_MATIERES)})")
            for cle in ("masse", "pv"):
                if cle in o.keys():
                    try:
                        quantite = float(o[cle])
                    except (TypeError, ValueError):
                        quantite = 0.0
                    if not quantite > 0:
                        err(f"{o.name}: '{cle}' = '{o[cle]}' n'est pas un nombre > 0")
            # Un prop porte SON PROPRE collider dynamique : lui en poser un
            # `col_*` jumeau par-dessus le fige dans le décor, exactement
            # l'inverse de ce qu'on voulait, et sans aucune erreur visible.
            #
            # Le test porte sur le CENTRE DE LA BOÎTE ENGLOBANTE, pas sur
            # l'origine de l'objet : dans ce pipeline la géométrie est écrite
            # en coordonnées monde et toutes les origines valent (0, 0, 0) —
            # les comparer déclarerait tous les objets superposés.
            empreinte = centre_monde(o)
            for autre in objects:
                if autre is o or autre.type != "MESH":
                    continue
                if not base_name(autre.name).startswith("col_"):
                    continue
                if (centre_monde(autre) - empreinte).length < 0.05:
                    err(f"{o.name}: un collider statique ({autre.name}) est posé au même "
                        "endroit — un prop physique n'en veut pas")

        # --- sanitaire_* : cuvette ou urinoir, utilisable et cassable façon
        # Duke Nukem 3D (2026-09-24). UN mesh, UN matériau — comme un vantail,
        # deux matériaux feraient deux primitives glTF et le loader ne
        # reconnaîtrait plus un seul objet. Le loader lui construit lui-même
        # un collider FIXE sur sa bbox monde (même logique qu'un `prop_*`,
        # sauf qu'il ne bouge jamais) : jamais de `col_*` jumeau.
        if n.startswith("sanitaire_") and o.type == "MESH":
            sorte = str(o.get("sorte", "")).strip().lower()
            if sorte not in SANITAIRE_SORTES:
                err(f"{o.name}: 'sorte' = '{o.get('sorte')!r}' n'est pas 'cuvette' ou 'urinoir' "
                    f"({', '.join(SANITAIRE_SORTES)})")
            if "pv" in o.keys():
                try:
                    pv = float(o["pv"])
                except (TypeError, ValueError):
                    pv = 0.0
                if not pv > 0:
                    err(f"{o.name}: 'pv' = '{o['pv']}' n'est pas un nombre > 0")
            if len(o.data.materials) > 1:
                err(f"{o.name}: {len(o.data.materials)} matériaux — un sanitaire n'en a qu'UN "
                    "(deux primitives glTF, et le loader ne voit plus un seul objet)")
            # Compter les SLOTS ne suffit pas : un mesh issu d'un import repeint
            # (Kenney Furniture Kit, `lib_helpers._repeindre_sur_palette`) peut
            # n'avoir qu'UN matériau et pourtant garder des `material_index` de
            # 0/1/2 sur ses polygones, résidus des matériaux D'ORIGINE avant
            # fusion. Invisible ici et dans Blender (l'affichage retombe sur le
            # slot 0), mais l'exportateur glTF regroupe les primitives par cet
            # index BRUT avant résolution — trouvé sur `mob_k_toilet` le
            # 2026-09-24, trois `material_index` distincts pour un seul
            # matériau, donc trois primitives glTF et un `THREE.Group` côté
            # loader plutôt qu'un `THREE.Mesh`.
            indices = {p.material_index for p in o.data.polygons}
            if len(indices) > 1:
                err(f"{o.name}: {len(indices)} valeurs de 'material_index' sur les polygones "
                    f"({sorted(indices)}) — un seul matériau Blender ne suffit pas, l'exporteur "
                    "glTF regroupe les primitives par cet index brut (voir "
                    "lib_helpers._repeindre_sur_palette)")
            empreinte = centre_monde(o)
            for autre in objects:
                if autre is o or autre.type != "MESH":
                    continue
                if not base_name(autre.name).startswith("col_"):
                    continue
                if (centre_monde(autre) - empreinte).length < 0.05:
                    err(f"{o.name}: un collider statique ({autre.name}) est posé au même "
                        "endroit — un sanitaire n'en veut pas, le loader construit le sien")


def check_sanitaires(objects) -> Counter:
    """Compte les `sanitaire_*` par sorte, pour le résumé du rapport. Les
    ERREURS elles-mêmes sont levées dans `check_naming`, qui a déjà la boucle
    et le contexte (`objects` complet, pour détecter un `col_*` jumeau)."""
    kinds: Counter = Counter()
    for o in objects:
        n = base_name(o.name)
        if n.startswith("sanitaire_") and o.type == "MESH":
            sorte = str(o.get("sorte", "?")).strip().lower()
            kinds[sorte if sorte in SANITAIRE_SORTES else "?"] += 1
    return kinds


# --- 4. Colliders ------------------------------------------------------------
def is_cuboid(obj) -> bool:
    m = obj.data
    if len(m.vertices) != 8:
        return False
    xs = [v.co.x for v in m.vertices]
    ys = [v.co.y for v in m.vertices]
    zs = [v.co.z for v in m.vertices]
    lo = Vector((min(xs), min(ys), min(zs)))
    hi = Vector((max(xs), max(ys), max(zs)))
    for v in m.vertices:
        on = all(
            abs(v.co[i] - lo[i]) < 1e-4 or abs(v.co[i] - hi[i]) < 1e-4
            for i in range(3)
        )
        if not on:
            return False
    return True


def tri_aspect_ratio(mesh) -> float:
    """Ratio d'élongation max des triangles — les fins déstabilisent Rapier."""
    worst = 0.0
    mesh.calc_loop_triangles()
    for t in mesh.loop_triangles:
        p = [mesh.vertices[i].co for i in t.vertices]
        e = [(p[1] - p[0]).length, (p[2] - p[1]).length, (p[0] - p[2]).length]
        lo = min(e)
        if lo > 1e-6:
            worst = max(worst, max(e) / lo)
    return worst


def check_colliders(meshes) -> Counter:
    kinds: Counter = Counter()

    for o in meshes:
        n = base_name(o.name)
        if not n.startswith("col_"):
            continue

        if len(o.data.vertices) == 0:
            err(f"{o.name}: collider sans géométrie")
            continue

        if n.startswith("col_box_") or is_cuboid(o):
            kinds["cuboid"] += 1
        elif n.startswith("col_hull_"):
            kinds["convexHull"] += 1
        else:
            kinds["trimesh"] += 1
            ratio = tri_aspect_ratio(o.data)
            if ratio > MAX_THIN_RATIO:
                err(f"{o.name}: triangles fins (ratio {ratio:.1f}) — instabilité Rapier")
            if len(o.data.polygons) > 5000:
                warn(f"{o.name}: trimesh à {len(o.data.polygons)} faces — proxy plus simple ?")

        dims = o.dimensions
        if min(dims) < MIN_PROXY_THICKNESS:
            err(f"{o.name}: épaisseur {min(dims):.3f} m < {MIN_PROXY_THICKNESS} — risque de tunneling")

    if kinds["trimesh"] and kinds.total() and kinds["trimesh"] / kinds.total() > 0.15:
        warn(
            f"{kinds['trimesh']}/{kinds.total()} colliders en trimesh — "
            "la géométrie de collision dérive vers celle de rendu"
        )
    return kinds


# --- 5. Textures -------------------------------------------------------------
def project_images():
    """Images du projet, hors datablocks internes de Blender.

    `Render Result` et `Viewer Node` existent dans tout .blend, font 256×256 ou
    plus, et n'ont rien à voir avec les textures du niveau — les compter faisait
    échouer la validation sur un fichier parfaitement propre.
    """
    return [
        img for img in bpy.data.images
        if img.type not in {"RENDER_RESULT", "COMPOSITING"} and img.size[0] != 0
    ]


def check_textures() -> None:
    for img in project_images():
        w, h = img.size
        plafond = MAX_TEXTURE_AFFICHES if img.name.startswith("aff_") else MAX_TEXTURE
        if w > plafond or h > plafond:
            err(f"{img.name}: {w}×{h} — plafond {plafond}×{plafond}")
        if w != h:
            warn(f"{img.name}: non carrée ({w}×{h}) — incompatible array texture")


# --- 6. Vertex colors --------------------------------------------------------
def check_vertex_colors(meshes) -> None:
    missing = [
        o.name for o in meshes
        if not base_name(o.name).startswith(("col_", "trig_"))
        and len(o.data.color_attributes) == 0
    ]
    if missing:
        warn(f"{len(missing)} mesh(es) sans vertex colors (bake manquant) : {missing[:5]}")

    # Un mur en 2 triangles ne peut pas recevoir de bake utile
    for o in meshes:
        n = base_name(o.name)
        if n.startswith(("col_", "trig_")):
            continue
        area = sum(p.area for p in o.data.polygons)
        verts = len(o.data.vertices)
        if area > 4.0 and verts < area:      # < 1 sommet par m²
            warn(f"{o.name}: {verts} sommets pour {area:.1f} m² — subdivision insuffisante pour le bake")


# --- 7. Budget ---------------------------------------------------------------
def check_budget(meshes) -> int:
    total = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        total += len(o.data.loop_triangles)
    if total > TRI_BUDGET:
        err(f"{total} triangles — budget {TRI_BUDGET}")
    return total


# --- 8. Matériaux ------------------------------------------------------------
def check_materials() -> None:
    """Seuil relevé de 8 à 24 : depuis l'ADR 0023, le décor statique est fusionné
    PAR MATÉRIAU au chargement, donc un matériau vaut un lot de dessin pour tout
    le niveau, et non plus un par objet. Viser le matériau unique n'a plus de
    sens ; ce qui compte est de rester loin du budget de 200 lots."""
    n = len(bpy.data.materials)
    if n > 24:
        warn(f"{n} matériaux — autant de lots de dessin après fusion (ADR 0023), "
             f"budget 200")


# --- Rapport -----------------------------------------------------------------
def main() -> None:
    strict = "--strict" in sys.argv
    kit_mode = "--kit" in sys.argv

    # Les collections SOURCES (kit, bibliothèque v2) ne partent pas en jeu :
    # leurs originaux ne sont ni bakés ni exportés, les valider ferait du bruit.
    # La bibliothèque range un asset par SOUS-collection : il faut descendre
    # l'arbre, pas seulement regarder le nom de la collection directe.
    sources = set()
    for name in SOURCE_COLLECTIONS:
        root = bpy.data.collections.get(name)
        if root is None:
            continue
        stack = [root]
        while stack:
            coll = stack.pop()
            sources.add(coll)
            stack.extend(coll.children)
    objects = [o for o in bpy.context.scene.objects
               if not any(c in sources for c in o.users_collection)]
    meshes = [o for o in objects if o.type == "MESH"]

    check_units()
    check_transforms(meshes)
    check_naming(objects, kit_mode)
    kinds = check_colliders(meshes)
    sanitaires = check_sanitaires(objects)
    check_textures()
    check_vertex_colors(meshes)
    tris = check_budget(meshes)
    check_materials()

    print("\n" + "=" * 62)
    print("VALIDATION — PROJET_CASSANDRE" + ("  [mode KIT]" if kit_mode else ""))
    print("=" * 62)
    print(f"  Objets            {len(objects)}  ({len(meshes)} meshes)")
    print(f"  Triangles         {tris} / {TRI_BUDGET}")
    print(f"  Matériaux         {len(bpy.data.materials)}")
    print(f"  Textures          {len(project_images())}")
    print("  Colliders         " + (
        "  ".join(f"{k}:{v}" for k, v in sorted(kinds.items())) or "aucun"
    ))
    if sanitaires:
        print("  Sanitaires        " + "  ".join(f"{k}:{v}" for k, v in sorted(sanitaires.items())))
    print("-" * 62)

    for w in warnings:
        print(f"  WARN   {w}")
    for e in errors:
        print(f"  ERROR  {e}")

    print("-" * 62)
    failed = bool(errors) or (strict and bool(warnings))
    print(f"  VERDICT : {'ECHEC' if failed else 'CONFORME'}"
          f"   ({len(errors)} erreurs, {len(warnings)} warnings)")
    print("=" * 62 + "\n")

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
