"""Recalage des spawns sur le sol réel.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

import math

import bpy
from mathutils import Vector

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import plan_de_masse as plan      # noqa: E402
import build_blockout as bo       # noqa: E402


# --- Recalage des spawns --------------------------------------------------------
#
# Les spawns viennent du plan de masse, dessiné AVANT l'habillage ; l'habillage
# pose ses meubles sans les regarder. Résultat au playtest du 2026-09-18 : « des
# Costards qui pop dans des props » — onze sur quarante-deux, dans un kiosque,
# une gondole, un distributeur, un rack, une caisse physique, et quatre DANS la
# plateforme de quai de la réserve (le plan les pose à z = 0, le quai est à 3 m).
#
# Chaque spawn est donc recalé après l'habillage, contre ce qui existe vraiment :
# posé sur le sol réellement sous lui (quai, rampe, sol de l'espace), puis, si sa
# capsule rencontre encore un collider ou un prop, déplacé à la case libre la
# plus proche de la grille de 0,25 m, sur le même niveau. Chaque déplacement est
# écrit dans le journal de construction : un spawn qui bouge de 3 m est une
# information de level design, pas un détail.

SPAWN_MARGE = 0.15          # jeu autour de la capsule
SPAWN_HAUTEUR = 1.9         # hauteur de capsule, arrondie au-dessus
SPAWN_MARCHE = 0.35         # `autostepMaxHeight` des ennemis (suitConfig.ts)
SPAWN_RECHERCHE = 4.0       # au-delà, c'est le plan qu'il faut corriger


def _solides() -> list:
    """(objet, min, max) de tout ce qui arrête un corps : colliders statiques et
    props. `view_layer` et non `scene` : la bibliothèque `_LIB`, exclue de la
    vue, n'en fait pas partie."""
    out = []
    for o in bpy.context.view_layer.objects:
        if o.type != "MESH" or not o.name.startswith(("col_", "prop_")):
            continue
        pts = [o.matrix_world @ Vector(v) for v in o.bound_box]
        mini = [min(p[i] for p in pts) for i in range(3)]
        maxi = [max(p[i] for p in pts) for i in range(3)]
        out.append((o, mini, maxi))
    return out


def _est_un_sol(o, mini, maxi) -> bool:
    """Un sol, une rampe, un quai : ce sur quoi l'on se tient, pas un obstacle."""
    return ("sol" in o.name or o.name.startswith("col_hull")
            or (maxi[0] - mini[0]) * (maxi[1] - mini[1]) >= 20.0)


def _sol_sous(solides, space, x: float, y: float) -> float:
    """Altitude de la surface praticable sous (x, y), sous le plafond de l'espace."""
    ref = bo._z_du_sol(space, x, y)
    meilleur = ref
    for o, mini, maxi in solides:
        if not (mini[0] < x < maxi[0] and mini[1] < y < maxi[1]):
            continue
        if not _est_un_sol(o, mini, maxi) or not (ref - 0.5 <= maxi[2] <= ref + space.hauteur - 0.5):
            continue
        dessus = maxi[2]
        if o.name.startswith("col_hull"):
            inv = o.matrix_world.inverted()
            ok, loc, _n, _i = o.ray_cast(inv @ Vector((x, y, maxi[2] + 1.0)),
                                         (inv.to_3x3() @ Vector((0, 0, -1))).normalized())
            if not ok:
                continue
            dessus = (o.matrix_world @ loc).z
        meilleur = max(meilleur, dessus)
    return meilleur


def _gene(solides, x: float, y: float, sol: float, r: float):
    """Premier solide qui gêne une capsule posée en (x, y, sol), ou None."""
    for o, mini, maxi in solides:
        if maxi[2] <= sol + SPAWN_MARCHE or mini[2] >= sol + SPAWN_HAUTEUR:
            continue
        if mini[0] - r < x < maxi[0] + r and mini[1] - r < y < maxi[1] + r:
            return o
    return None


def recaler_spawns() -> list[str]:
    solides = _solides()
    espaces = {}
    for space in plan.SPACES:
        for nom, *_ in space.spawns:
            espaces["spawn_director_" + nom if nom.startswith("director") else "spawn_" + nom] = space
    journal = []
    pas = plan.GRID
    for nom, space in espaces.items():
        spawn = bpy.data.objects.get(nom)
        if spawn is None:
            continue
        r = (0.45 if "director" in nom else 0.4) + SPAWN_MARGE
        x, y = spawn.location.x, spawn.location.y
        sol0 = _sol_sous(solides, space, x, y)
        gene = _gene(solides, x, y, sol0, r)
        if gene is None:
            if abs(sol0 - spawn.location.z) > 1e-3:
                journal.append(f"{nom} posé à z = {sol0:.2f} (au lieu de {spawn.location.z:.2f})")
            spawn.location.z = sol0
            continue
        marge = bo.EPAISSEUR_MUR + r
        n = int(SPAWN_RECHERCHE / pas)
        candidats = sorted(((i * pas, j * pas) for i in range(-n, n + 1) for j in range(-n, n + 1)),
                           key=lambda d: d[0] ** 2 + d[1] ** 2)
        trouve = None
        for dx, dy in candidats:
            if dx * dx + dy * dy > SPAWN_RECHERCHE ** 2:
                break
            cx, cy = x + dx, y + dy
            if not (space.x[0] + marge < cx < space.x[1] - marge and space.y[0] + marge < cy < space.y[1] - marge):
                continue
            sol = _sol_sous(solides, space, cx, cy)
            if abs(sol - sol0) > SPAWN_MARCHE or _gene(solides, cx, cy, sol, r) is not None:
                continue
            trouve = (cx, cy, sol)
            break
        if trouve is None:
            journal.append(f"{nom} ENCOMBRÉ ({gene.name}) et aucune place libre à moins de "
                           f"{SPAWN_RECHERCHE:g} m — à corriger dans le plan de masse")
            continue
        cx, cy, sol = trouve
        journal.append(f"{nom} déplacé de {math.hypot(cx - x, cy - y):.2f} m "
                       f"(sa capsule rencontrait {gene.name})")
        spawn.location = (cx, cy, sol)
    return journal
