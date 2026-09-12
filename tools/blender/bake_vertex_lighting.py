"""
Bake d'éclairage en vertex colors — PROJET_CASSANDRE.

    blender -b assets_src/blender/kit_hypermarche.blend \
        -P tools/blender/bake_vertex_lighting.py -- --save

    blender -b assets_src/blender/zone_c.blend \
        -P tools/blender/bake_vertex_lighting.py -- --out assets_src/blender/zone_c_baked.blend

Options :
    --save          réécrit le .blend D'ENTRÉE (destructif, explicite)
    --out PATH      écrit ailleurs (non destructif, préféré en CI)
    --samples N     samples Cycles (défaut 128, chiffre de vertex-color-sector-lighting)
    --type TYPE     combined (défaut) | diffuse
    --dry-run       prépare les attributs, ne bake pas — sert à vérifier la sélection
    --strict        code retour 1 dès qu'UN mesh ressort entièrement noir
    --keep-proxies  NE masque PAS les proxies aux rayons Cycles (reproduit le
                    bug historique, sert uniquement à re-mesurer la régression)
    --pass P        both (défaut) | direct | indirect. `indirect` ne cuit que la
                    lumière rebondie : c'est le montage hybride, où le direct est
                    rendu en temps réel et où la couleur de sommet ne sert plus
                    que de masque d'ombrage.
    --bounces N     rebonds diffus de Cycles (défaut 4, celui de Blender).
                    Baisser à 1 durcit l'éclairage : une salle blanche renvoie
                    énormément, et le rendu physiquement juste écrase justement
                    les ombres qu'un éclairage de néons devrait creuser.
    --domain D      point (défaut) | corner. CORNER donne une couleur PAR FACE au
                    lieu d'une par sommet : c'est ce qui fait qu'une arête se
                    voit. Voir `ensure_color_attribute`.
    --ambient A     plancher d'éclairage appliqué après le bake, 0 à 1 (défaut 0,
                    donc sans effet sur les niveaux existants) — voir
                    `apply_ambient` : indispensable dans une salle close, où
                    aucune lumière d'environnement n'entre
    --emissive-marker NOM
                    après le bake, remet à pleine lumière tout objet dont le nom
                    contient NOM (défaut `_neon`) — une source n'est pas éclairée
                    par elle-même et ressortirait noire, voir `force_full_light`

Sans --save ni --out, le bake tourne et le rapport sort, mais RIEN n'est écrit.
Un script ne modifie pas son fichier d'entrée sans qu'on le lui demande.

Code retour : 0 = bake fait et plausible, 1 = échec ou bake inexploitable.

Procédure ("Col", Point, Byte Color, Cycles 128 samples, Combined ->
Active Color Attribute), piège des proxies-occultants, méthodologie de
diagnostic d'un mesh noir, lecture du rapport de luminance : voir
docs/pipeline/niveau-blender.md#bake-déclairage-vertex-colors
"""

from __future__ import annotations

import os
import statistics
import sys

import bpy

DEFAULT_SAMPLES = 128

# Ni cibles de bake, ni occultants : ces objets n'existent pas pour la lumière.
# `col_*` double la géométrie rendue, `trig_*`/`secret_*` sont des volumes
# logiques jamais rendus en jeu — aucun des trois ne doit projeter d'ombre.
SKIP_PREFIXES = ("col_", "trig_", "secret_")

# Luminance Rec. 709 — la même pondération que l'œil, pas une moyenne RGB.
LUMA = (0.2126, 0.7152, 0.0722)

# Un BYTE_COLOR quantifie à 1/255 : en dessous d'un demi-pas, c'est noir.
BLACK_EPS = 0.5 / 255.0


def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg_value(args, flag, default):
    return args[args.index(flag) + 1] if flag in args else default


def bakeable_objects():
    """Meshes à baker : tout ce qui est rendu, donc ni collider ni volume logique."""
    out = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        if obj.name.startswith(SKIP_PREFIXES):
            continue
        if not obj.visible_get():
            continue
        out.append(obj)
    return out


def ensure_color_attribute(obj, domain: str = "POINT") -> str:
    """Crée/active l'attribut "Col" — Byte Color, sur le domaine demandé.

    **POINT ou CORNER change tout ce qu'un bake peut exprimer.** Sur le domaine
    POINT il y a UNE couleur par sommet, partagée par toutes les faces qui s'y
    rejoignent : les huit sommets d'une boîte sont communs à trois faces
    chacun, donc le dessus et le flanc d'un carton sous un néon reçoivent
    forcément la même valeur. Aucune arête ne se détache, et la salle entière
    paraît éclairée à plat même quand le bake, lui, porte du contraste.

    Sur le domaine CORNER, chaque face a ses propres valeurs : une face
    tournée vers le plafond s'éclaire, son flanc reste sombre, et l'arête
    entre les deux se voit. C'est le relief qu'un éclairage temps réel donnerait
    par le produit N·L — sauf qu'ici il est cuit, donc gratuit.

    Le coût est à l'export : l'exporteur glTF dédouble les sommets dont les
    coins diffèrent, exactement comme il le fait déjà pour les UV et les
    normales. Plus de sommets dans le `.glb`, aucun surcoût de rendu.
    """
    mesh = obj.data
    ca = mesh.color_attributes.get("Col")
    if ca is not None and (ca.domain != domain or ca.data_type != "BYTE_COLOR"):
        mesh.color_attributes.remove(ca)
        ca = None
    if ca is None:
        ca = mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain=domain)
    index = list(mesh.color_attributes).index(ca)
    mesh.color_attributes.active_color_index = index
    mesh.color_attributes.render_color_index = index
    return ca.name


def ensure_material(obj, fallback) -> None:
    """Cycles refuse de baker un objet sans matériau — filet de sécurité."""
    if not obj.data.materials:
        obj.data.materials.append(fallback)


def hide_occluders(scene):
    """Masque les proxies aux rayons Cycles. Retourne de quoi tout restaurer.

    Un proxy est coïncident avec la pièce qu'il double : visible au rendu, il la
    scelle et le bake sort noir sans le moindre message d'erreur. Le retirer des
    cibles ne le retire pas des rayons — c'est exactement le piège.
    """
    saved = []
    for obj in scene.objects:
        if obj.type != "MESH" or not obj.name.startswith(SKIP_PREFIXES):
            continue
        saved.append((obj, obj.hide_render))
        obj.hide_render = True
    return saved


def restore_occluders(saved) -> None:
    """Toujours appelée depuis un `finally` : un --save ne doit jamais figer
    des proxies masqués dans le .blend."""
    for obj, hide_render in saved:
        obj.hide_render = hide_render


def count_coincident_faces(mesh, tol=1e-4, cap=4000):
    """Nombre de paires de faces COPLANAIRES ET SUPERPOSÉES dans un mesh.

    Deux faces au même endroit sur le même plan, c'est du z-fighting garanti au
    rendu — et, pendant le bake, le point d'ombrage se retrouve pris entre deux
    surfaces à distance nulle et ne reçoit plus rien. C'est le défaut qui rend
    `kit_crate` entièrement noir alors que ses faces extérieures pointent bien
    vers l'extérieur (mesuré : décoller les tasseaux de 0.01 suffit à rallumer
    les 24 sommets de la boîte).
    """
    groups = {}
    for poly in mesh.polygons:
        nrm = poly.normal
        if nrm.length < 1e-9:
            continue
        # Normale SIGNÉE, volontairement. Deux boîtes accolées partagent une
        # face dos à dos (normales opposées) : c'est une cloison intérieure,
        # c'est la construction normale d'une pièce multi-boîtes et ça ne gêne
        # ni le rendu ni le bake. Ce qu'on traque, ce sont deux faces qui
        # regardent DANS LE MÊME SENS au même endroit — là il y a bien deux
        # surfaces pour un seul plan visible.
        key = (round(nrm.x, 3), round(nrm.y, 3), round(nrm.z, 3),
               round(nrm.dot(poly.center), 3))
        groups.setdefault(key, []).append(poly)

    pairs = 0
    for polys in groups.values():
        if len(polys) < 2 or len(polys) > 200:
            continue
        boxes = []
        for poly in polys:
            co = [mesh.vertices[i].co for i in poly.vertices]
            boxes.append(tuple(min(c[k] for c in co) for k in range(3))
                         + tuple(max(c[k] for c in co) for k in range(3)))
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                # Une des trois étendues est plate (les faces sont coplanaires) :
                # on exige un vrai recouvrement sur deux axes, et pas de
                # séparation sur le troisième.
                ov = [min(a[k + 3], b[k + 3]) - max(a[k], b[k]) for k in range(3)]
                if sum(1 for o in ov if o > tol) >= 2 and all(o > -tol for o in ov):
                    pairs += 1
                    if pairs >= cap:
                        return pairs
    return pairs


def diagnose_black(obj, depsgraph, scene, samples=64):
    """Nomme la cause d'un mesh entièrement noir, au lieu de la laisser chercher.

    Trois causes possibles, trois corrections différentes — les confondre coûte
    des heures :
      - un AUTRE objet scelle la pièce      → c'est lui qu'il faut masquer
      - le mesh se scelle lui-même          → c'est le mesh qu'il faut corriger
      - la pièce est exposée et noire       → là seulement, regarder les lampes

    Le tir part du centre des FACES, pas des sommets : un sommet est sur une
    arête ou un coin, ses rayons s'échappent presque toujours et le verdict est
    faux (constaté).
    """
    mesh = obj.data
    polys = mesh.polygons
    if not polys:
        return "mesh sans face"

    mw = obj.matrix_world
    rot = mw.to_3x3().inverted().transposed()
    step = max(1, len(polys) // samples)

    self_hit = other = clear = 0
    culprits = {}
    for i in range(0, len(polys), step):
        poly = polys[i]
        nrm = rot @ poly.normal
        if nrm.length < 1e-9:
            continue
        nrm.normalize()
        origin = (mw @ poly.center) + nrm * 1e-4
        hit, _loc, _n, _idx, hit_obj, _m = scene.ray_cast(depsgraph, origin, nrm, distance=100.0)
        if not hit:
            clear += 1
        elif hit_obj is None or hit_obj.original == obj:
            self_hit += 1
        else:
            other += 1
            name = hit_obj.original.name
            culprits[name] = culprits.get(name, 0) + 1

    total = self_hit + other + clear
    if total == 0:
        return "aucune normale exploitable"

    if other > total * 0.5:
        top = sorted(culprits.items(), key=lambda kv: -kv[1])[:2]
        who = ", ".join(f"{k} (x{v})" for k, v in top)
        return f"OCCULTÉ PAR UN AUTRE OBJET → {who} ; cet objet doit être masqué du bake"

    coincident = count_coincident_faces(mesh)
    if coincident:
        return (f"FACES COÏNCIDENTES → {coincident} paire(s) coplanaires superposées "
                f"(z-fighting au rendu, auto-occultation au bake) ; corriger le mesh")

    if self_hit > total * 0.5:
        sealed = 100.0 * self_hit / total
        return (f"VOLUME FERMÉ → {sealed:.0f} % des faces regardent vers l'intérieur ; "
                f"géométrie jamais vue en jeu, à supprimer plutôt qu'à éclairer")

    return "EXPOSÉ mais noir → chercher du côté des lampes / du monde"


def apply_ambient(targets, ambient: float) -> None:
    """Remonte le plancher d'éclairage : `c' = a + (1 - a) · c`.

    Une salle de vente est une boîte close : aucune lumière d'environnement n'y
    entre, et tout ce qu'une rampe n'atteint pas directement (dessous de
    tablette, flanc de gondole, recoin) tombe au noir. Monter la puissance des
    lampes ne corrige pas ça — ça écrête les surfaces déjà exposées sans
    éclairer les autres (mesuré : ×2 sur les lampes ne donne que +50 % de
    luminance moyenne).

    C'est le terme d'ambiant global des moteurs de l'époque : il remappe
    l'intervalle au lieu de décaler puis saturer, donc il ne crée aucun
    écrêtage et conserve intégralement le dégradé du bake.
    """
    if ambient <= 0.0:
        return
    for obj in targets:
        ca = obj.data.color_attributes.get("Col")
        if ca is None or len(ca.data) == 0:
            continue
        buf = [0.0] * (len(ca.data) * 4)
        ca.data.foreach_get("color", buf)
        for i in range(0, len(buf), 4):
            for k in range(3):
                buf[i + k] = ambient + (1.0 - ambient) * buf[i + k]
        ca.data.foreach_set("color", buf)


def force_full_light(targets, marker: str) -> list[str]:
    """Remet à blanc la couleur de sommet des objets marqués (défaut : `_neon`).

    Une surface qui ÉMET la lumière n'en reçoit pas : le tube d'une rampe de
    néons ressort noir d'un bake de lumière seule, alors que c'est justement
    l'objet le plus lumineux de la salle. En jeu, la couleur de sommet multiplie
    la texture (`vertex-color-sector-lighting`) : la remettre à 1 rend au tube
    sa texture pleine, ce qui est exactement l'effet voulu — la lueur d'un néon
    dans un jeu Build est peinte, pas simulée.

    Convention de nommage, au même titre que `col_*` : un objet dont le nom
    contient `_neon` est une source, pas une surface éclairée.
    """
    touched = []
    for obj in targets:
        if marker not in obj.name:
            continue
        ca = obj.data.color_attributes.get("Col")
        if ca is None or len(ca.data) == 0:
            continue
        ca.data.foreach_set("color", [1.0] * (len(ca.data) * 4))
        touched.append(obj.name)
    return touched


def read_stats(obj):
    mesh = obj.data
    ca = mesh.color_attributes.get("Col")
    if ca is None or len(ca.data) == 0:
        return None
    buf = [0.0] * (len(ca.data) * 4)
    ca.data.foreach_get("color", buf)
    lum = [buf[i] * LUMA[0] + buf[i + 1] * LUMA[1] + buf[i + 2] * LUMA[2]
           for i in range(0, len(buf), 4)]
    return {
        "n": len(lum),
        "min": min(lum),
        "max": max(lum),
        "mean": statistics.fmean(lum),
        "std": statistics.pstdev(lum) if len(lum) > 1 else 0.0,
        "clipped": sum(1 for v in lum if v >= 0.999),
        "black": sum(1 for v in lum if v < BLACK_EPS),
    }


def main() -> None:
    args = get_args()
    samples = int(arg_value(args, "--samples", str(DEFAULT_SAMPLES)))
    bake_type = arg_value(args, "--type", "combined").lower()
    out = arg_value(args, "--out", None)
    save_inplace = "--save" in args
    dry_run = "--dry-run" in args
    strict = "--strict" in args
    keep_proxies = "--keep-proxies" in args
    emissive_marker = arg_value(args, "--emissive-marker", "_neon")
    ambient = float(arg_value(args, "--ambient", "0"))
    passes = arg_value(args, "--pass", "both").lower()
    if passes not in ("both", "direct", "indirect"):
        print(f"[bake] passe inconnue : {passes}")
        sys.exit(1)
    bounces = int(arg_value(args, "--bounces", "4"))
    domain = arg_value(args, "--domain", "point").upper()
    if domain not in ("POINT", "CORNER"):
        print(f"[bake] domaine inconnu : {domain}")
        sys.exit(1)

    if bake_type not in ("combined", "diffuse"):
        print(f"[bake] type inconnu : {bake_type}")
        sys.exit(1)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = False
    # Le rebond diffus est ce qui décide du contraste global : à 4 rebonds, un
    # sol et un plafond blancs se renvoient la lumière jusqu'à effacer toute
    # ombre. Un éclairage de jeu Build est plus dur que la réalité.
    scene.cycles.diffuse_bounces = bounces
    scene.cycles.max_bounces = max(bounces, 1)
    scene.cycles.seed = 0
    scene.render.bake.target = "VERTEX_COLORS"
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = (bake_type == "combined")

    targets = bakeable_objects()
    if not targets:
        print("[bake] aucun mesh à baker")
        sys.exit(1)

    lights = [o for o in scene.objects if o.type == "LIGHT" and o.visible_get()]
    emissive = [m.name for m in bpy.data.materials
                if m.use_nodes and any(
                    n.type == "BSDF_PRINCIPLED"
                    and "Emission Strength" in n.inputs
                    and n.inputs["Emission Strength"].default_value > 0.0
                    for n in m.node_tree.nodes)]

    fallback = bpy.data.materials.get("mat_kit_shell") or bpy.data.materials.new("mat_bake_fallback")
    for obj in targets:
        ensure_color_attribute(obj, domain)
        ensure_material(obj, fallback)

    print(f"[bake] {len(targets)} meshes, {len(lights)} lampes, "
          f"{len(emissive)} matériau(x) émissif(s), {samples} samples, "
          f"type={bake_type}/{passes}, domaine={domain.lower()}, rebonds={bounces}")

    if not lights and not emissive:
        print("[bake] ERREUR : ni lampe ni matériau émissif — le bake sortirait noir")
        sys.exit(1)

    if dry_run:
        print("[bake] --dry-run : attributs préparés, aucun bake exécuté")
        sys.exit(0)

    view_layer = bpy.context.view_layer
    for obj in scene.objects:
        obj.select_set(False)
    for obj in targets:
        obj.select_set(True)
    view_layer.objects.active = targets[0]

    kwargs = dict(target="VERTEX_COLORS", use_clear=True)
    if bake_type == "combined":
        kwargs["type"] = "COMBINED"
    else:
        kwargs["type"] = "DIFFUSE"
        kwargs["pass_filter"] = {"DIRECT", "INDIRECT"} if passes == "both" else {passes.upper()}

    if keep_proxies:
        hidden = []
        print("[bake] --keep-proxies : proxies laissés VISIBLES aux rayons "
              "(reproduction du bug, ne pas utiliser en production)")
    else:
        hidden = hide_occluders(scene)
        print(f"[bake] {len(hidden)} proxy(s) col_*/trig_*/secret_* masqué(s) des "
              f"rayons Cycles le temps du bake (état restauré ensuite)")

    try:
        result = bpy.ops.object.bake(**kwargs)
        if "FINISHED" not in result:
            print(f"[bake] ERREUR : l'opérateur a retourné {result}")
            sys.exit(1)
    finally:
        restore_occluders(hidden)

    apply_ambient(targets, ambient)
    if ambient > 0.0:
        print(f"[bake] plancher d'éclairage {ambient:.2f} appliqué (remap, sans écrêtage)")

    lit = force_full_light(targets, emissive_marker)
    if lit:
        print(f"[bake] {len(lit)} source(s) « {emissive_marker} » remise(s) à pleine "
              f"lumière après le bake")

    # --- Rapport ------------------------------------------------------------
    rows, black, flat = [], [], []
    for obj in targets:
        st = read_stats(obj)
        if st is None:
            continue
        rows.append((obj, st))
        if st["black"] == st["n"] or st["mean"] < 0.005:
            black.append(obj)
        if st["std"] < 0.002:
            flat.append(obj.name)

    print("\n" + "=" * 82)
    print(f"BAKE VERTEX COLORS — {bake_type.upper()} / {samples} samples")
    print("=" * 82)
    print(f"{'MESH':<24}{'SOMM':>6}{'MIN':>8}{'MOY':>8}{'MAX':>8}{'ÉCART':>8}"
          f"{'ÉCRÊTÉ':>9}{'NOIRS':>9}")
    print("-" * 82)
    for obj, st in rows:
        share = f"{st['black']}/{st['n']}"
        print(f"{obj.name:<24}{st['n']:>6}{st['min']:>8.3f}{st['mean']:>8.3f}"
              f"{st['max']:>8.3f}{st['std']:>8.3f}{st['clipped']:>9}{share:>9}")
    print("-" * 82)
    all_lum = [st["mean"] for _, st in rows]
    total_clip = sum(st["clipped"] for _, st in rows)
    print(f"  {len(rows)} meshes   luminance moyenne globale {statistics.fmean(all_lum):.3f}   "
          f"sommets écrêtés {total_clip}")
    if black:
        depsgraph = bpy.context.evaluated_depsgraph_get()
        print(f"  WARN   {len(black)} mesh(es) entièrement noirs :")
        for obj in black:
            print(f"           {obj.name:<22} {diagnose_black(obj, depsgraph, scene)}")
    if flat:
        print(f"  WARN   {len(flat)} mesh(es) à dégradé plat : {flat[:6]}")
    if not black and not flat:
        print("  OK     aucun mesh noir, aucun dégradé plat")
    print("=" * 82 + "\n")

    if out:
        out = os.path.abspath(bpy.path.abspath(out))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=out)
        print(f"[bake] écrit : {out}")
    elif save_inplace:
        bpy.ops.wm.save_mainfile()
        print(f"[bake] fichier d'entrée réécrit : {bpy.data.filepath}")
    else:
        print("[bake] ni --save ni --out : rien n'a été écrit sur le disque")

    # Par défaut on n'échoue que si TOUT est noir — le bake est alors
    # inexploitable. `--strict` échoue dès qu'une seule pièce l'est : un mesh
    # rendu entièrement noir est un défaut, pas une nuance d'ambiance.
    if strict:
        sys.exit(1 if black else 0)
    sys.exit(1 if len(black) == len(rows) else 0)


if __name__ == "__main__":
    main()
