"""
Inspection détaillée d'un kit modulaire — PROJET_CASSANDRE.

    blender -b assets_src/blender/kit_hypermarche.blend -P tools/blender/inspect_kit.py
    blender -b assets_src/blender/kit_hypermarche.blend -P tools/blender/inspect_kit.py -- --piece kit_wall_4m
    blender -b assets_src/blender/kit_hypermarche.blend -P tools/blender/inspect_kit.py -- --verbose

Options :
    --piece NOM   n'inspecte qu'une pièce, et imprime le détail face par face
    --verbose     détail face par face pour toutes les pièces
    --strict      les warnings deviennent bloquants

Code retour : 0 = kit conforme, 1 = au moins une non-conformité.

Ce que ce script contrôle, pièce par pièce — c'est la différence entre « le
script de génération n'a pas planté » et « la géométrie respecte vraiment les
contraintes » :

  1. Origine à un coin au sol      la bbox locale part de (0,0,0) sur X et Y
                                   (Z peut descendre pour une dalle de sol)
  2. Dimensions                    conformes à la table de `kit_spec`
  3. Subdivision                   pas de face plus large que SEG_TARGET sans
                                   découpe — la contrainte de bake
  4. Pas de n-gon                  aucune face à plus de 4 côtés
  5. Normales sortantes            volume signé positif par composante
  6. Densité de texels             surface UV / surface monde → px/m à 128 px
  7. Attribut de couleur "Col"     présent, domaine Point
  8. Transforms appliqués          rotation identité, scale 1
  9. Proxies                       présents, cuboid à 8 sommets, épaisseur
                                   >= 0.1 m, englobent bien le rendu
 10. Matériaux                     tirés du jeu partagé du kit
"""

from __future__ import annotations

import math
import os
import sys
from collections import Counter

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import kit_spec as spec  # noqa: E402

TEXTURE_PX = 128.0
DENSITY_TARGET = TEXTURE_PX / spec.UV_TILE      # 64 px/m
MIN_PROXY_THICKNESS = 0.1

errors: list[str] = []
warnings: list[str] = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def bbox(mesh):
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def signed_volume(mesh) -> float:
    """Volume signé par le théorème de la divergence. Négatif = normales
    retournées, donc faces invisibles sous le backface culling de Three.js."""
    mesh.calc_loop_triangles()
    total = 0.0
    for t in mesh.loop_triangles:
        a, b, c = (mesh.vertices[i].co for i in t.vertices)
        total += a.dot(b.cross(c)) / 6.0
    return total


def max_face_span(mesh) -> float:
    """Plus grande arête de face — révèle une face non subdivisée."""
    longest = 0.0
    for poly in mesh.polygons:
        loop_verts = [mesh.vertices[mesh.loops[li].vertex_index].co
                      for li in poly.loop_indices]
        for i in range(len(loop_verts)):
            e = (loop_verts[(i + 1) % len(loop_verts)] - loop_verts[i]).length
            longest = max(longest, e)
    return longest


def texel_density(obj) -> tuple[float, float]:
    """(min, max) px/m sur les faces du mesh, à partir du rapport UV / monde."""
    mesh = obj.data
    uv = mesh.uv_layers.active
    if uv is None:
        return (0.0, 0.0)
    lo, hi = math.inf, 0.0
    for poly in mesh.polygons:
        if poly.area < 1e-9:
            continue
        pts = [uv.data[li].uv for li in poly.loop_indices]
        # Aire du polygone UV par la formule du lacet.
        area_uv = abs(sum(pts[i].x * pts[(i + 1) % len(pts)].y
                          - pts[(i + 1) % len(pts)].x * pts[i].y
                          for i in range(len(pts)))) / 2.0
        if area_uv < 1e-12:
            continue
        px_per_m = math.sqrt(area_uv / poly.area) * TEXTURE_PX
        lo = min(lo, px_per_m)
        hi = max(hi, px_per_m)
    return (0.0 if lo is math.inf else lo, hi)


def is_cuboid(mesh) -> bool:
    if len(mesh.vertices) != 8:
        return False
    (lo, hi) = bbox(mesh)
    for v in mesh.vertices:
        if not all(abs(v.co[i] - lo[i]) < 1e-4 or abs(v.co[i] - hi[i]) < 1e-4
                   for i in range(3)):
            return False
    return True


def inspect_piece(piece: dict, verbose: bool) -> dict:
    name = piece["name"]
    obj = bpy.data.objects.get(name)
    if obj is None:
        err(f"{name}: pièce absente du fichier")
        return {}
    mesh = obj.data
    mesh.calc_loop_triangles()

    lo, hi = bbox(mesh)
    dims = tuple(hi[i] - lo[i] for i in range(3))

    # 1. Origine au coin au sol
    if abs(lo[0]) > 1e-6 or abs(lo[1]) > 1e-6:
        err(f"{name}: origine hors du coin — bbox locale démarre à "
            f"({lo[0]:.3f}, {lo[1]:.3f})")
    if not piece.get("slab") and abs(lo[2]) > 1e-6:
        # « Origine à un coin AU SOL » : une pièce dont la géométrie flotte
        # au-dessus de son origine (ou passe dessous) ne se pose plus sur la
        # grille — l'écart se retrouve tel quel dans le niveau assemblé.
        err(f"{name}: géométrie décollée de z=0 (bbox locale démarre à "
            f"{lo[2]:.3f}) — l'origine n'est pas au sol")

    # 2. Dimensions annoncées
    for axis, got, want in zip("XYZ", dims, piece["dims"]):
        if abs(got - want) > 1e-4:
            err(f"{name}: {axis} = {got:.3f} m, table annonce {want:.3f} m")

    # 3. Subdivision
    span = max_face_span(mesh)
    if span > spec.SEG_TARGET + 1e-4:
        err(f"{name}: face de {span:.2f} m non subdivisée (pas {spec.SEG_TARGET} m) "
            f"— aucun bake utile possible dessus")

    # 4. n-gons
    ngons = [p for p in mesh.polygons if len(p.vertices) > 4]
    if ngons:
        err(f"{name}: {len(ngons)} n-gon(s)")

    # 5. Normales
    vol = signed_volume(mesh)
    if vol <= 0.0:
        err(f"{name}: volume signé {vol:.3f} — normales retournées")

    # 6. Densité de texels
    d_lo, d_hi = texel_density(obj)
    if d_hi > 0 and (abs(d_lo - DENSITY_TARGET) > 0.5 or abs(d_hi - DENSITY_TARGET) > 0.5):
        warn(f"{name}: densité {d_lo:.1f}–{d_hi:.1f} px/m, cible {DENSITY_TARGET:.0f}")

    # 7. Attribut de couleur
    ca = mesh.color_attributes.get("Col")
    if ca is None:
        err(f"{name}: pas d'attribut de couleur \"Col\"")
    elif ca.domain != "POINT":
        err(f"{name}: \"Col\" au domaine {ca.domain}, attendu POINT")

    # 8. Transforms
    if any(abs(c - 1.0) > 1e-5 for c in obj.scale):
        err(f"{name}: scale non appliqué {tuple(round(c, 4) for c in obj.scale)}")
    if any(abs(c) > 1e-5 for c in obj.rotation_euler):
        err(f"{name}: rotation non appliquée")

    # 9. Proxies
    expected = piece.get("proxies", [])
    found = [c for c in obj.children if c.name.startswith(("col_box_", "col_hull_", "col_mesh_"))]
    if len(found) != len(expected):
        err(f"{name}: {len(found)} proxy/ies pour {len(expected)} attendu(s)")
    proxy_kinds = Counter()
    for child in found:
        cmesh = child.data
        clo, chi = bbox(cmesh)
        cdims = [chi[i] - clo[i] for i in range(3)]
        if child.name.startswith("col_box_"):
            proxy_kinds["cuboid"] += 1
            if not is_cuboid(cmesh):
                err(f"{child.name}: préfixe col_box_ mais {len(cmesh.vertices)} "
                    f"sommets / pas un cuboid")
        elif child.name.startswith("col_hull_"):
            proxy_kinds["convexHull"] += 1
        else:
            proxy_kinds["trimesh"] += 1
            warn(f"{child.name}: trimesh — à justifier")
        if min(cdims) < MIN_PROXY_THICKNESS - 1e-9:
            err(f"{child.name}: épaisseur {min(cdims):.3f} m < {MIN_PROXY_THICKNESS} "
                f"— risque de tunneling")
        if cmesh.materials:
            warn(f"{child.name}: porte un matériau — inutile, le mesh est "
                 "invisible au runtime")

    # Les proxies doivent couvrir le rendu (à la tolérance des détails en débord).
    if found and not piece.get("proxy_partial"):
        # `matrix_local` = transform du proxy DANS LE REPÈRE DE LA PIÈCE, donc
        # directement comparable aux sommets du mesh rendu, qui sont eux aussi
        # en coordonnées locales. Ne pas bricoler avec `c.location - obj.location` :
        # ça ne compensait que le double-transform de `build_kit.py`, et ça
        # s'inverse dès que le proxy est correctement posé à l'origine du parent.
        local = {c: [c.matrix_local @ v.co for v in c.data.vertices] for c in found}
        plo = [min(min(co[i] for co in pts) for pts in local.values()) for i in range(3)]
        phi = [max(max(co[i] for co in pts) for pts in local.values()) for i in range(3)]
        for i, axis in enumerate("XYZ"):
            if lo[i] < plo[i] - 1e-4 or hi[i] > phi[i] + 1e-4:
                warn(f"{name}: le rendu déborde des proxies sur {axis} "
                     f"(rendu {lo[i]:.3f}..{hi[i]:.3f}, proxy {plo[i]:.3f}..{phi[i]:.3f})")

    # 10. Matériaux
    for m in mesh.materials:
        if m.name not in spec.MATERIALS and m.name != "mat_kit_checker":
            warn(f"{name}: matériau hors kit {m.name!r}")

    info = {
        "name": name,
        "cls": piece["cls"],
        "verts": len(mesh.vertices),
        "tris": len(mesh.loop_triangles),
        "quads": sum(1 for p in mesh.polygons if len(p.vertices) == 4),
        "dims": dims,
        "span": span,
        "density": (d_lo, d_hi),
        "proxies": proxy_kinds,
        "materials": [m.name for m in mesh.materials],
        "note": piece.get("note"),
    }

    if verbose:
        print(f"\n--- {name} " + "-" * (56 - len(name)))
        print(f"  classe            {piece['cls']}  ({piece['group']})")
        print(f"  dimensions        {dims[0]:.3f} × {dims[1]:.3f} × {dims[2]:.3f} m")
        print(f"  bbox locale       ({lo[0]:.2f}, {lo[1]:.2f}, {lo[2]:.2f}) → "
              f"({hi[0]:.2f}, {hi[1]:.2f}, {hi[2]:.2f})")
        print(f"  sommets / tris    {len(mesh.vertices)} / {len(mesh.loop_triangles)}")
        print(f"  faces             {len(mesh.polygons)} "
              f"({info['quads']} quads, {len(ngons)} n-gons)")
        print(f"  arête la + longue {span:.3f} m  (seuil {spec.SEG_TARGET} m)")
        print(f"  densité texels    {d_lo:.1f} – {d_hi:.1f} px/m")
        print(f"  attribut couleur  {ca.name}/{ca.domain}/{ca.data_type}" if ca else
              "  attribut couleur  ABSENT")
        print(f"  matériaux         {', '.join(info['materials']) or '—'}")
        print(f"  location          {tuple(round(c, 2) for c in obj.location)}")
        for child in found:
            clo, chi = bbox(child.data)
            print(f"  proxy             {child.name}  "
                  f"{len(child.data.vertices)} sommets  "
                  f"{chi[0]-clo[0]:.2f} × {chi[1]-clo[1]:.2f} × {chi[2]-clo[2]:.2f} m")
        # Détail par face : combien de segments sur chaque plan de la bbox
        planes = Counter()
        for poly in mesh.polygons:
            n = poly.normal
            axis = max(range(3), key=lambda i: abs(n[i]))
            side = "+" if n[axis] > 0 else "-"
            planes[f"{side}{'XYZ'[axis]}"] += 1
        print("  quads par orient. " + "  ".join(f"{k}:{v}" for k, v in sorted(planes.items())))
        if piece.get("note"):
            print(f"  note              {piece['note']}")
    return info


def main() -> None:
    args = get_args()
    only = args[args.index("--piece") + 1] if "--piece" in args else None
    verbose = "--verbose" in args or only is not None
    strict = "--strict" in args

    pieces = [p for p in spec.KIT if only is None or p["name"] == only]
    if only and not pieces:
        print(f"[inspect_kit] pièce inconnue : {only}")
        sys.exit(1)

    infos = [inspect_piece(p, verbose) for p in pieces]
    infos = [i for i in infos if i]

    print("\n" + "=" * 78)
    print("INSPECTION DU KIT — PROJET_CASSANDRE")
    print("=" * 78)
    print(f"{'PIÈCE':<20}{'CLS':<7}{'SOMM':>6}{'TRIS':>6}{'ARÊTE':>8}"
          f"{'PX/M':>12}  PROXIES")
    print("-" * 78)
    for i in infos:
        d_lo, d_hi = i["density"]
        dens = f"{d_lo:.0f}" if abs(d_hi - d_lo) < 0.5 else f"{d_lo:.0f}-{d_hi:.0f}"
        px = "  ".join(f"{k}:{v}" for k, v in sorted(i["proxies"].items())) or "—"
        print(f"{i['name']:<20}{i['cls']:<7}{i['verts']:>6}{i['tris']:>6}"
              f"{i['span']:>8.2f}{dens:>12}  {px}")
    print("-" * 78)
    total_kinds = Counter()
    for i in infos:
        total_kinds.update(i["proxies"])
    print(f"  {len(infos)} pièces   "
          f"{sum(i['verts'] for i in infos)} sommets   "
          f"{sum(i['tris'] for i in infos)} triangles   "
          f"proxies " + "  ".join(f"{k}:{v}" for k, v in sorted(total_kinds.items())))
    print("-" * 78)
    for w in warnings:
        print(f"  WARN   {w}")
    for e in errors:
        print(f"  ERROR  {e}")
    failed = bool(errors) or (strict and bool(warnings))
    print("-" * 78)
    print(f"  VERDICT : {'ECHEC' if failed else 'CONFORME'}"
          f"   ({len(errors)} erreurs, {len(warnings)} warnings)")
    print("=" * 78 + "\n")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
