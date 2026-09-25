"""
Audit du niveau construit — ce qu'on ne voit pas en le construisant sans y jouer.

    blender -b assets_src/blender/niveau_v2.blend -P tools/level_v2/audit_niveau.py
    blender -b assets_src/blender/niveau_v2.blend -P tools/level_v2/audit_niveau.py -- --pas 0.5 --csv audit.csv

Né d'un retour de playtest (2026-09-16) après la première traversée complète :
« trop d'éléments pas à leur place, en collision, des trous qui nous font
tomber dans le vide ». Trois défauts que la construction headless ne montre
jamais, et que trois mesures suffisent à trouver :

1. **Trous de sol** — un rayon vers le bas par case de grille, sur l'emprise
   de chaque espace du plan de masse. Aucun collider dessous, ou un collider
   bien plus bas que le sol de l'espace : le joueur tombe.
2. **Interpénétrations** — deux proxies de collision qui se traversent
   franchement. Un décor qui s'encastre dans un autre se voit tout de suite
   en jouant, jamais dans un compte d'objets.
3. **Objets flottants ou enfoncés** — un proxy dont la base est loin du sol
   sous lui : une caisse dans les airs, un meuble à moitié dans le carrelage.

Ce qui compte pour le JOUEUR, ce sont les `col_*` : eux seuls portent la
collision en jeu. L'audit ne regarde donc que ceux-là, jamais les meshes de
rendu — sauf pour dire, dans le rapport, à quel objet visible ils
appartiennent.

Sortie : un rapport trié par gravité, et un code retour non nul s'il reste
des trous de sol (le défaut qui casse une partie, les deux autres l'abîment).
"""

from __future__ import annotations

import csv
import os
import sys
from collections import defaultdict

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import plan_de_masse as plan          # noqa: E402

# Un joueur fait 0,8 m de large : une case de 0,5 m ne peut pas rater un trou
# qu'il traverserait. Coûte ~40 000 rayons sur le niveau entier, quelques
# secondes.
PAS_DEFAUT = 0.5
# Hauteur de tir du rayon au-dessus du sol nominal, et distance maximale
# sondée en dessous. Le départ est HAUT exprès : un rayon parti à hauteur de
# genou commence à l'intérieur du premier canapé venu, n'en voit que la face
# du dessous, et fait croire à un trou là où l'on marche très bien.
DEPART_AU_DESSUS = 2.2
PROFONDEUR_MAX = 1.5
# Bord ouvert : distance sondée au-delà de la limite d'un espace, et chute
# au-delà de laquelle ce n'est plus un dénivelé mais le vide.
DEBORD = 0.75
CHUTE_MORTELLE = 4.0
# Interpénétration : deux proxies qui se chevauchent de plus de ça sur LEURS
# TROIS AXES à la fois. En dessous, c'est un contact voulu (une étagère posée
# contre un mur, un pied sur une dalle).
CHEVAUCHEMENT_MIN = 0.12
# Objet flottant / enfoncé : écart toléré entre la base d'un proxy et le sol
# sous lui. La grille de construction est à 0,25 m.
ECART_SOL_MAX = 0.12


def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg_value(args, flag, default):
    return args[args.index(flag) + 1] if flag in args else default


# Collections SOURCES : la bibliothèque d'assets et le kit vivent à l'origine,
# tous empilés les uns dans les autres, et ne partent jamais à l'export (même
# règle que `export_level.py`/`validate_level.py`). Les compter, c'est
# rapporter 15 000 interpénétrations qui n'existent pas dans le niveau.
SOURCE_COLLECTIONS = {"_KIT", "_LIB"}


def objets_sources() -> set[str]:
    """Tous les objets sous `_LIB`/`_KIT`, sous-collections comprises : chaque
    asset y a la sienne, donc `users_collection` seul ne suffit pas."""
    noms: set[str] = set()
    for nom in SOURCE_COLLECTIONS:
        coll = bpy.data.collections.get(nom)
        if coll:
            noms.update(o.name for o in coll.all_objects)
    return noms


_SOURCES: set[str] = set()


def est_source(o: bpy.types.Object) -> bool:
    return o.name in _SOURCES


# Un `prop_*` n'a pas de `col_*` : c'est `loader.ts` qui lui construit un
# collider dynamique depuis sa boîte englobante. Il porte donc bien de la
# collision en jeu, et il est sujet aux MÊMES défauts que le reste — une caisse
# posée dans un rack ou en l'air. Pire, même : un prop encastré ne reste pas
# encastré, il est violemment éjecté au premier pas de simulation.
#
# `sanitaire_*` (2026-09-24) suit la même règle, en statique : le loader lui
# construit un collider FIXE depuis sa boîte englobante, sans `col_*` jumeau.
# Ne pas le compter ici le rendrait invisible à `interpenetrations`/
# `spawns_encombres` — un Costard pourrait apparaître dans une cuvette sans
# que l'audit le voie.
PREFIXES_PHYSIQUES = ("col_", "prop_", "sanitaire_")


def porte_collision(nom: str) -> bool:
    return nom.startswith(PREFIXES_PHYSIQUES)


def colliders() -> list[bpy.types.Object]:
    return [o for o in bpy.context.scene.objects
            if o.type == "MESH" and porte_collision(o.name) and not est_source(o)]


def aabb(o: bpy.types.Object) -> tuple[Vector, Vector]:
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def isoler_colliders() -> dict[str, bool]:
    """Cache tout ce qui n'est pas un collider posé dans le niveau :
    `scene.ray_cast` ne doit voir que ce qui porte la collision en jeu.

    Retourne l'état d'origine, que `main()` RESTAURE. Sans restauration,
    l'audit est sans effet en headless (le fichier n'est jamais sauvegardé),
    mais lancé dans une session Blender ouverte (via le MCP), il laissait tout
    le décor désactivé : l'export qui suivait (`use_visible=True`) n'en
    écrivait plus rien — 722 Ko de `.glb` au lieu de 30 Mo (2026-09-18)."""
    etat = {}
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            etat[o.name] = o.hide_viewport
            o.hide_viewport = not (porte_collision(o.name) and not est_source(o))
    bpy.context.view_layer.update()
    return etat


def restaurer_visibilite(etat: dict[str, bool]) -> None:
    for nom, cache in etat.items():
        o = bpy.data.objects.get(nom)
        if o is not None:
            o.hide_viewport = cache
    bpy.context.view_layer.update()


def sol_sous(dg, x: float, y: float, z_depart: float, z_min: float):
    """Première surface ORIENTÉE VERS LE HAUT sous (x, y), en traversant tout
    ce qui se présente. Un simple `ray_cast` ne suffit pas : il retourne aussi
    bien le dessous d'une dalle ou le flanc d'un mur, et un rayon parti à
    l'intérieur d'un volume plein ne retourne rien du tout.
    """
    z = z_depart
    for _ in range(12):
        ok, loc, normal, _i, _obj, _m = bpy.context.scene.ray_cast(
            dg, Vector((x, y, z)), Vector((0, 0, -1)), distance=z - z_min)
        if not ok:
            return None
        if normal.z > 0.5:
            return loc.z
        z = loc.z - 0.001     # on continue sous la face traversée
        if z <= z_min:
            return None
    return None


def occupe(point: Vector, boites) -> bool:
    """Le point est-il dans un volume plein (mur, pilier, meuble) ? Une case
    occupée n'est pas un trou : le joueur ne peut pas y être."""
    return any(mini.x <= point.x <= maxi.x and mini.y <= point.y <= maxi.y and mini.z <= point.z <= maxi.z
               for _o, mini, maxi in boites)


def z_attendu(space, x: float, y: float) -> float:
    """Altitude nominale du sol en (x, y) — interpolée le long d'une rampe."""
    if not space.rampe:
        return space.z
    axe, z0, z1 = space.rampe
    if axe == "+x":
        t = (x - space.x[0]) / max(space.largeur, 1e-6)
    else:
        t = (y - space.y[0]) / max(space.profondeur, 1e-6)
    return z0 + (z1 - z0) * min(1.0, max(0.0, t))


def trous_de_sol(pas: float, boites):
    """Cases praticables sans sol sous elles, groupées par espace.

    Toute l'emprise est sondée, bords compris : c'est aux JOINTURES entre deux
    espaces que se cachent les trous. Une case prise dans un volume plein
    (mur, pilier, gondole) est écartée — le joueur ne peut pas s'y tenir.
    """
    dg = bpy.context.evaluated_depsgraph_get()
    trous = defaultdict(list)
    for space in plan.ALL:
        x = space.x[0] + pas / 2
        while x < space.x[1]:
            y = space.y[0] + pas / 2
            while y < space.y[1]:
                z = z_attendu(space, x, y)
                if occupe(Vector((x, y, z + 0.9)), boites):
                    y += pas
                    continue
                sol = sol_sous(dg, x, y, z + DEPART_AU_DESSUS, z - PROFONDEUR_MAX)
                if sol is None:
                    trous[space.id].append((x, y, None))
                elif z - sol > PROFONDEUR_MAX - 0.001:
                    trous[space.id].append((x, y, round(sol, 2)))
                y += pas
            x += pas
    return trous


def bords_ouverts(pas: float, boites):
    """Endroits où l'on sort d'un espace par le côté et où il n'y a RIEN.

    Le vrai « trou qui fait tomber dans le vide » n'est presque jamais dans le
    sol : c'est un bord sans mur ni garde-corps, ouvert sur une zone qui n'est
    le sol de personne. On longe donc le périmètre de chaque espace, et on
    regarde juste au-delà : s'il n'y a pas de mur à hauteur d'homme ET pas de
    sol à moins de `CHUTE_MORTELLE` en dessous, on peut y tomber.
    """
    dg = bpy.context.evaluated_depsgraph_get()
    risques = defaultdict(list)
    for space in plan.ALL:
        bords = []
        x = space.x[0] + pas / 2
        while x < space.x[1]:
            bords.append((x, space.y[0] - DEBORD, x, space.y[0] + DEBORD))
            bords.append((x, space.y[1] + DEBORD, x, space.y[1] - DEBORD))
            x += pas
        y = space.y[0] + pas / 2
        while y < space.y[1]:
            bords.append((space.x[0] - DEBORD, y, space.x[0] + DEBORD, y))
            bords.append((space.x[1] + DEBORD, y, space.x[1] - DEBORD, y))
            y += pas
        for bx, by, ix, iy in bords:
            z = z_attendu(space, ix, iy)
            # Dedans : y a-t-il seulement un sol d'où partir ?
            if sol_sous(dg, ix, iy, z + DEPART_AU_DESSUS, z - PROFONDEUR_MAX) is None:
                continue
            # Un mur à hauteur d'homme sur le bord ferme la question.
            if occupe(Vector((bx, by, z + 0.9)), boites) or occupe(Vector(((bx + ix) / 2, (by + iy) / 2, z + 0.9)), boites):
                continue
            dehors = sol_sous(dg, bx, by, z + DEPART_AU_DESSUS, z - CHUTE_MORTELLE)
            if dehors is None:
                risques[space.id].append((round(bx, 2), round(by, 2)))
    return risques


# Coque du niveau : sols, murs, plafonds, rampes, quai. Deux de ces pièces se
# recouvrent par construction (un mur pose sur la dalle, sur son épaisseur) —
# les rapporter noie les vrais défauts, qui concernent toujours du DÉCOR.
MOTS_STRUCTURE = ("sol_", "mur_", "plafond_", "rampe", "plateforme", "parapet")


def est_structure(nom: str) -> bool:
    return any(mot in nom for mot in MOTS_STRUCTURE)


def interpenetrations(boites):
    """Paires de proxies qui se traversent sur les trois axes à la fois.

    Les paires structure × structure sont écartées : voir `MOTS_STRUCTURE`.
    """
    boites = list(boites)
    # Tri par X : on ne compare que ce qui peut se chevaucher.
    boites.sort(key=lambda b: b[1].x)
    trouve = []
    for i, (oa, mina, maxa) in enumerate(boites):
        for ob, minb, maxb in boites[i + 1:]:
            if minb.x >= maxa.x - CHEVAUCHEMENT_MIN:
                break
            dx = min(maxa.x, maxb.x) - max(mina.x, minb.x)
            dy = min(maxa.y, maxb.y) - max(mina.y, minb.y)
            dz = min(maxa.z, maxb.z) - max(mina.z, minb.z)
            if min(dx, dy, dz) <= CHEVAUCHEMENT_MIN:
                continue
            if est_structure(oa.name) and est_structure(ob.name):
                continue
            # Un `col_hull_*` est un volume convexe : sa boîte englobante
            # déborde largement de la géométrie réelle (une rampe remplit sa
            # boîte à moitié). La comparer à autre chose ne prouve rien.
            if oa.name.startswith("col_hull_") or ob.name.startswith("col_hull_"):
                continue
            # Un sol ou un plafond traversé sur son épaisseur seulement est un
            # contact, pas une faute : c'est ainsi que se posent les murs.
            trouve.append((min(dx, dy, dz), oa.name, ob.name, (round(dx, 2), round(dy, 2), round(dz, 2))))
    trouve.sort(reverse=True)
    return trouve


def hors_sol(cols):
    """Proxies dont la base est loin du sol qui se trouve sous eux."""
    dg = bpy.context.evaluated_depsgraph_get()
    ecarts = []
    for o in cols:
        mini, maxi = aabb(o)
        # Un sol, un mur ou un plafond n'a pas à « poser » sur quoi que ce soit.
        # `urinoir` non plus : un `sanitaire_urinoir*` est mural par nature, sa
        # bbox commence à 0,55 m du sol — le signaler « flottant » serait un
        # faux positif systématique, pas un défaut de placement.
        if any(mot in o.name for mot in ("sol", "mur", "plafond", "rampe", "quai", "mezzanine", "urinoir")):
            continue
        if maxi.z - mini.z > 3.0:          # pilier, rack, portique : posés autrement
            continue
        centre = Vector(((mini.x + maxi.x) / 2, (mini.y + maxi.y) / 2, mini.z + 0.05))
        o.hide_viewport = True             # ne pas se toucher soi-même
        bpy.context.view_layer.update()
        ok, loc, _n, _i, _obj, _m = bpy.context.scene.ray_cast(dg, centre, Vector((0, 0, -1)), distance=4.0)
        o.hide_viewport = False
        if not ok:
            continue
        ecart = mini.z - loc.z
        if abs(ecart) > ECART_SOL_MAX:
            ecarts.append((abs(ecart), round(ecart, 2), o.name))
    ecarts.sort(reverse=True)
    return ecarts


def spawns_encombres(boites) -> list[tuple[str, str]]:
    """Spawns d'ennemi ou de joueur dont la capsule rencontre un collider ou un
    prop à leur altitude : l'ennemi y apparaît DANS le meuble et en est éjecté
    (« des Costards qui pop dans des props », playtest du 2026-09-18).
    `build_niveau.recaler_spawns` les déplace ; ce contrôle vérifie qu'il y a
    réussi, et le dira le jour où il n'y réussira plus."""
    trouves = []
    for o in bpy.context.scene.objects:
        if not o.name.startswith("spawn_"):
            continue
        p = o.matrix_world.translation
        r = 0.45 if "director" in o.name else 0.4
        for b, mini, maxi in boites:
            if maxi.z <= p.z + 0.35 or mini.z >= p.z + 1.9:
                continue
            if mini.x - r < p.x < maxi.x + r and mini.y - r < p.y < maxi.y + r:
                trouves.append((o.name, b.name))
                break
    return trouves


def main() -> int:
    args = get_args()
    pas = float(arg_value(args, "--pas", str(PAS_DEFAUT)))
    csv_path = arg_value(args, "--csv", None)

    global _SOURCES
    _SOURCES = objets_sources()
    cols = colliders()
    etat = isoler_colliders()
    try:
        boites = [(o, *aabb(o)) for o in cols]
        trous = trous_de_sol(pas, boites)
        bords = bords_ouverts(pas, boites)
        penetrations = interpenetrations(boites)
        ecarts = hors_sol(cols)
        encombres = spawns_encombres(boites)
    finally:
        restaurer_visibilite(etat)

    print("\n[audit] " + "=" * 60)
    print(f"[audit] {len(cols)} proxies de collision, grille de sondage {pas} m")

    total_trous = sum(len(v) for v in trous.values())
    print(f"\n[audit] TROUS DE SOL — {total_trous} cases sans sol praticable")
    for space_id, cases in sorted(trous.items(), key=lambda kv: -len(kv[1])):
        xs = [c[0] for c in cases]
        ys = [c[1] for c in cases]
        vide = sum(1 for c in cases if c[2] is None)
        print(f"[audit]   {space_id:14s} {len(cases):4d} cases  "
              f"x {min(xs):7.1f}..{max(xs):7.1f}  y {min(ys):7.1f}..{max(ys):7.1f}  "
              f"({vide} sans aucun collider)")

    total_bords = sum(len(v) for v in bords.values())
    print(f"\n[audit] BORDS OUVERTS SUR LE VIDE — {total_bords} points de chute")
    for space_id, points in sorted(bords.items(), key=lambda kv: -len(kv[1])):
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        print(f"[audit]   {space_id:14s} {len(points):4d} points  "
              f"x {min(xs):7.1f}..{max(xs):7.1f}  y {min(ys):7.1f}..{max(ys):7.1f}")

    print(f"\n[audit] INTERPÉNÉTRATIONS — {len(penetrations)} paires")
    for profondeur, a, b, dims in penetrations[:15]:
        print(f"[audit]   {profondeur:5.2f} m  {a}  ×  {b}  (dx,dy,dz = {dims})")

    print(f"\n[audit] OBJETS FLOTTANTS OU ENFONCÉS — {len(ecarts)}")
    for _abs_ecart, ecart, nom in ecarts[:15]:
        etat = "flotte" if ecart > 0 else "enfoncé"
        print(f"[audit]   {ecart:+5.2f} m  {etat:8s} {nom}")

    print(f"\n[audit] SPAWNS ENCOMBRÉS — {len(encombres)}")
    for nom, gene in encombres:
        print(f"[audit]   {nom}  dans  {gene}")

    if csv_path:
        with open(csv_path, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["type", "espace_ou_objet", "detail", "x", "y", "z"])
            for space_id, cases in trous.items():
                for x, y, z in cases:
                    w.writerow(["trou", space_id, "sans collider" if z is None else "sol trop bas", x, y, z])
            for space_id, points in bords.items():
                for bx, by in points:
                    w.writerow(["bord_ouvert", space_id, "chute", bx, by, ""])
            for profondeur, a, b, _dims in penetrations:
                w.writerow(["interpenetration", a, b, round(profondeur, 3), "", ""])
            for _abs_ecart, ecart, nom in ecarts:
                w.writerow(["hors_sol", nom, ecart, "", "", ""])
        print(f"\n[audit] détail écrit : {csv_path}")

    print("[audit] " + "=" * 60)
    return 1 if total_trous or total_bords else 0


if __name__ == "__main__":
    sys.exit(main())
