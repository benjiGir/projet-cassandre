"""
Niveau v2 habillé — jalon N9 de `PLAN_NIVEAU_V2.md`.

    blender -b --factory-startup -P tools/level_v2/build_niveau.py -- \\
        --out assets_src/blender/niveau_v2.blend

Puis la chaîne habituelle :

    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/validate_level.py -- --strict
    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/export_level.py -- \\
        --out public/assets/levels/niveau_v2.glb

**La structure ne se rejoue pas, elle se réutilise.** Ce fichier importe
`build_blockout` et lui emprunte sa coque : sols, murs percés par les
ouvertures du plan, portes, `use_*`, secrets, spawns. Le blockout a été joué et
validé par l'utilisateur au jalon N8 ; toute cote redessinée ici serait une
occasion de le contredire. Ce qui change, et rien d'autre :

1. **Les matériaux de la coque**, gris au blockout, texturés ici — un
   dictionnaire par espace, passé aux MÊMES fonctions. `geo_utils` et
   `lib_helpers` partagent la densité du projet (128 px pour 2 m, soit
   64 px/m), donc les deux familles de géométrie s'accordent sans réglage.
2. **Les plafonds**, absents du blockout. Ils n'ont JAMAIS de collider : le
   bake du graphe de navigation tire un rayon vers le bas et prend le premier
   collider rencontré, un plafond solide ferait donc croire à un sol en
   altitude. Le parking extérieur n'en a pas — il est dehors.
3. **Les lampes.** Chaque espace porte les siennes (`light_*`, lues par
   `loader.ts`). Le niveau tourne en `lighting: "hybride"` : pas de soleil,
   pas de bake pour l'instant, juste les lampes du niveau et 0,18 d'ambiante.
4. **Le contenu d'un espace habillé**, pris dans la bibliothèque du jalon N4
   (`lib_rayons.py`) au lieu des boîtes grises.

**Un espace non encore habillé garde ses volumes gris**, et ça se voit : c'est
le but. Le niveau reste jouable de bout en bout à chaque lot, et ce qui est
gris est ce qui reste à faire. `HABILLAGE` est le registre qui décide.

Les lampes ne sont pas comptées : `LightPool` (`src/render/lightPool.ts`) n'en
allume que 48 à la fois, les plus proches du joueur. Poser plus de lampes que
le budget est le régime NORMAL de ce niveau, pas un dépassement.

**Où est quoi** (découpé le 2026-10-01, blocs déplacés à l'identique) : ce
fichier ne garde que l'orchestration — `HABILLAGE` (le registre) et `main()`.
Chaque espace a son module dans `espaces/` (`rayons.py`, `hub.py`, `sav.py`…),
les briques partagées sont dans `espaces/commun.py`, la coque (matériaux, sols,
plafonds) dans `espaces/coque.py`, les portes animées dans `espaces/portes.py`.
Pour savoir quelle ligne a posé un objet : `C.where(objet)` (`cassandre.py`).
"""

from __future__ import annotations

import os
import sys

import bpy

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
sys.path.insert(0, os.path.join(os.path.dirname(ICI), "blender"))

import geo_utils                  # noqa: E402
import lib_bureaux as B           # noqa: E402
import lib_electro as E           # noqa: E402
import lib_facade as F            # noqa: E402
import lib_reserve as R           # noqa: E402
import lib_rayons as L            # noqa: E402
import lib_compacteur as C        # noqa: E402
import plan_de_masse as plan      # noqa: E402
import build_blockout as bo       # noqa: E402
from espaces.annexes import (
    habiller_c_short_ramp,
    habiller_c_short_w,
    habiller_compacteur,
    habiller_labo,
    habiller_planque,
    habiller_vmc,
)  # noqa: E402
from espaces.cafeteria import (
    habiller_cafeteria,
)  # noqa: E402
from espaces.caisses import (
    habiller_caisses,
)  # noqa: E402
from espaces.chambre_froide import (
    habiller_chambre_froide,
)  # noqa: E402
from espaces.coque import (
    PLAFOND_SUR_MESURE,
    SOL_COMMUN,
    SOL_INVITE,
    SOL_SUR_MESURE,
    materiaux_espace,
    plafond,
    sol_commun,
)  # noqa: E402
from espaces.eclairage import (
    eclairage_couloir,
    eclairage_par_defaut,
)  # noqa: E402
from espaces.electro import (
    habiller_electro,
)  # noqa: E402
from espaces.etage import (
    ET_PORTES,
    habiller_couloir_direction,
    habiller_direction,
    habiller_escalier,
    habiller_etage,
)  # noqa: E402
from espaces.fournil import (
    habiller_fournil,
)  # noqa: E402
from espaces.galerie import (
    habiller_galerie,
)  # noqa: E402
from espaces.hub import (
    habiller_hub,
)  # noqa: E402
from espaces.labo_boucherie import (
    habiller_labo_boucherie,
)  # noqa: E402
from espaces.parking import (
    habiller_parking,
)  # noqa: E402
from espaces.pc_secu import (
    habiller_pc_secu,
    poser_cameras_pc_secu,
)  # noqa: E402
from espaces.portes import (
    poser_linteaux,
    poser_portes_animees,
)  # noqa: E402
from espaces.props import (
    poser_props_physiques,
)  # noqa: E402
from espaces.rayons import (
    habiller_rayons,
)  # noqa: E402
from espaces.reserve import (
    habiller_reserve,
)  # noqa: E402
from espaces.sav import (
    habiller_sav,
)  # noqa: E402
from espaces.souterrain import (
    habiller_souterrain,
)  # noqa: E402
from espaces.spawns import (
    recaler_spawns,
)  # noqa: E402
from espaces.toilettes import (
    habiller_toilettes,
)  # noqa: E402
from espaces.vestiaires import (
    habiller_vestiaires,
)  # noqa: E402


# Repères que l'habillage pose lui-même, en vrai objet : le blockout ne doit donc
# plus poser leur silhouette grise. `use_toilet` en faisait partie jusqu'au
# 2026-09-24 (le cube flottant devenait la plaque de chasse d'eau de
# `habiller_toilettes`) ; le repère « toilettes » est désormais du genre
# "rien" dans `REGLES_REPERES` (plus aucun `use_*` à sauter), donc plus rien à
# lister ici pour lui.
SIGNATURES_HABILLEES = frozenset({"sig_machine_a_pinces", "sig_photomaton"})


HABILLAGE = {
    "rayons": habiller_rayons,
    "caisses": habiller_caisses,
    "galerie": habiller_galerie,
    "hub": habiller_hub,
    "electro": habiller_electro,
    "reserve": habiller_reserve,
    "souterrain": habiller_souterrain,
    "parking_ext": habiller_parking,
    "cafeteria": habiller_cafeteria,
    "bureaux": habiller_etage,
    "direction": habiller_direction,
    "c_escalier": habiller_escalier,
    "c_bu": habiller_couloir_direction,
    "secret1": habiller_labo,
    "secret3": habiller_vmc,
    "toilettes": habiller_toilettes,
    # Les coulisses, v2 (2026-09-26) : v1 rejetée par l'utilisateur (« posé au
    # pif, aucun plaisir à explorer »). Le PC sécurité a servi de pilote ; les
    # vestiaires sont la première salle construite depuis le board. Le fournil,
    # le SAV, le compacteur et la planque sont habillés ; la gaine reste grise.
    "vestiaires": habiller_vestiaires,
    "fournil": habiller_fournil,
    "labo": habiller_labo_boucherie,
    "chambre_froide": habiller_chambre_froide,
    "sav": habiller_sav,
    "pc_secu": habiller_pc_secu,
    "compacteur": habiller_compacteur,
    "secret4": habiller_planque,
    "c_short_ramp": habiller_c_short_ramp,
    "c_short_w": habiller_c_short_w,
}


# --- Assemblage --------------------------------------------------------------


def main() -> None:
    args = bo.get_args()
    out = os.path.abspath(bpy.path.abspath(
        bo.arg_value(args, "--out", "assets_src/blender/niveau_v2.blend")))

    geo_utils.wipe_scene()
    geo_utils.configure_scene()
    L.build_all()
    F.build_all()
    E.build_all()
    R.build_all()
    B.build_all()

    root = bpy.context.scene.collection
    geo = geo_utils.make_collection("GEO", root)
    shell = geo_utils.make_collection("SHELL", geo)
    props = geo_utils.make_collection("PROPS", geo)
    geo_utils.make_collection("DETAIL", geo)
    col_coll = geo_utils.make_collection("COL", root)
    logic_coll = geo_utils.make_collection("LOGIC", root)

    gris = bo.creer_materiaux()
    cache: dict = {}
    ouvertures = bo.ouvertures_effectives()

    sols = murs = plafonds = vols = lampes = physiques = 0
    habilles = []
    for space in plan.ALL:
        materiaux = materiaux_espace(space, gris, cache)
        habillage = HABILLAGE.get(space.id)

        if space.rampe:
            sens, z0, z1 = space.rampe
            bo.pente(f"sol_{space.id}", space.x, space.y, z0, z1, sens, materiaux, shell, col_coll)
        elif space.id in SOL_COMMUN:
            sol_commun(space, materiaux, shell, col_coll)
        elif space.id not in SOL_SUR_MESURE and space.id not in SOL_INVITE:
            bo.boite(f"sol_{space.id}",
                     (space.x[0], space.y[0], space.z - bo.EPAISSEUR_SOL),
                     (space.largeur, space.profondeur, bo.EPAISSEUR_SOL),
                     "sol", materiaux, shell, col_coll)
        sols += 1
        murs += bo.murs_espace(space, ouvertures, materiaux, shell, col_coll)
        if plafond(space, shell):
            plafonds += 1

        if habillage is None and space.couloir:
            lampes += eclairage_couloir(space, props, logic_coll)
        elif habillage is None:
            vols += bo.volumes(space, materiaux, props, col_coll)
            lampes += eclairage_par_defaut(space, logic_coll)
        else:
            compte = habillage(space, materiaux, props, col_coll, logic_coll)
            lampes += compte["lampes"]
            if space.id in PLAFOND_SUR_MESURE:
                plafonds += 1
            habilles.append((space.id, compte))

        # Après l'habillage : le mobilier physique se pose par-dessus le décor
        # de l'espace, jamais à sa place.
        physiques += poser_props_physiques(space, props)

    portes = poser_portes_animees(ouvertures, props, col_coll, logic_coll) + len(ET_PORTES)
    linteaux = poser_linteaux(ouvertures, gris, cache, shell)
    # Palier derrière la porte de sortie : sans lui, franchir la sortie est une
    # chute d'un pas fixe avant l'écran de fin (trouvé par `audit_niveau.py`).
    bo.poser_palier_sortie(materiaux_espace(plan.SPACES[-1], gris, cache), shell, col_coll)
    reperes = bo.poser_reperes(gris, props, col_coll, logic_coll, sauter=SIGNATURES_HABILLEES)
    C.actualiser_pizza(next(s for s in plan.SPACES if s.id == "secret4"), logic_coll)
    costards, directeurs = bo.poser_spawns(logic_coll)
    cams = poser_cameras_pc_secu(props, logic_coll)
    recales = recaler_spawns()

    # La bibliothèque est un dépôt de patrons, jamais du décor : exclue de la
    # vue, elle ne part pas à l'export (même discipline qu'à la salle d'essai).
    lib_layer = bpy.context.view_layer.layer_collection.children.get(L.LIB_NAME)
    if lib_layer:
        lib_layer.exclude = True

    bpy.ops.wm.save_as_mainfile(filepath=out)

    print("\n[niveau] " + "-" * 54)
    print(f"[niveau] {sols} sols, {murs} morceaux de mur, {plafonds} plafonds, {vols} volumes gris")
    print(f"[niveau] {linteaux} linteaux et impostes (rendus seulement, sans collider)")
    for espace, compte in habilles:
        detail = ", ".join(f"{v} {k}" for k, v in compte.items())
        print(f"[niveau] HABILLÉ {espace} : {detail}")
    restants = [s.id for s in plan.ALL if s.id not in HABILLAGE and not s.couloir]
    print(f"[niveau] encore en gris : {', '.join(restants)}")
    print(f"[niveau] {lampes} light_* (le pool n'en allume que 48, voir ADR 0026)")
    print(f"[niveau] {physiques} prop_* physiques (autant de lots de dessin qu'il y en a de VISIBLES)")
    print(f"[niveau] {portes} portes, {reperes['use']} use_*, {reperes['secret']} secrets, "
          f"{reperes['signature']} emplacements signature, {reperes['nourriture']} repères nourriture")
    print(f"[niveau] {costards} spawn_suit_*, {directeurs} spawn_director_*, {reperes['spawn']} spawn_player")
    print(f"[niveau] {cams} cam_* (console pc_secu)")
    for ligne in recales:
        print(f"[niveau] spawn recalé : {ligne}")
    print(f"[niveau] écrit : {out}")


if __name__ == "__main__":
    main()
