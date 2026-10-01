"""Migration locale de la réserve et des coulisses, exécutée par Cassandre."""
from pathlib import Path
import json
import sys
import hashlib
import re
import shutil
import tempfile

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/blender"))
sys.path.insert(0, str(ROOT / "tools/level_v2"))
import cassandre as C

SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"
OUT = ROOT / "renders/coulisses-refonte"
REBUILT = {"reserve", "souterrain", "pc_secu", "vestiaires", "sav", "c_bu", "c_so_bu", "gaine"}
SHELL_IDS = REBUILT | {"fournil", "c_short_w", "c_rs_so"}


def bounds(obj):
    points = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return [round(min(p[i] for p in points), 3) for i in range(3)] + [round(max(p[i] for p in points), 3) for i in range(3)]


def inspect():
    OUT.mkdir(parents=True, exist_ok=True)
    objects = []
    for obj in bpy.context.scene.objects:
        if any(c.name.startswith("_LIB") for c in obj.users_collection):
            continue
        box = bounds(obj) if obj.type == "MESH" else [*obj.location, *obj.location]
        if box[4] < 90 or box[1] > 154:
            continue
        objects.append({"name": obj.name, "box": box, "type": obj.type,
                        "collections": [c.name for c in obj.users_collection],
                        "extras": {k: str(v) for k, v in obj.items()}})
    (OUT / "inspection.json").write_text(json.dumps(objects, ensure_ascii=False, indent=2) + "\n")
    print("BACKSTAGE_INSPECT=" + C.as_json({"objects": len(objects), "report": str(OUT / "inspection.json")}))


def main():
    if Path(bpy.data.filepath).resolve() != SOURCE:
        raise RuntimeError("Ouvrir niveau_v2.blend pour migrer ses coulisses")
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--inspect" in args:
        inspect()
        return
    if (bpy.context.scene.get("backstage_route") == "parking_or_v1"
            or bpy.data.objects.get("sol_c_rs_so") is None):
        raise RuntimeError("Cette source porte déjà la nouvelle implantation")
    preview = Path(args[args.index("--preview") + 1]).resolve() if "--preview" in args else None
    if preview in (SOURCE, EXPORT):
        raise RuntimeError("L'aperçu doit être distinct du niveau livré")
    hashes = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in (SOURCE, EXPORT)}
    backup = Path(tempfile.mkdtemp(prefix="backstage-backup-"))
    for path in (SOURCE, EXPORT):
        shutil.copy2(path, backup / path.name)
    print(f"BACKUP={backup}", flush=True)
    report = migrate()
    library = bpy.context.view_layer.layer_collection.children.get("_LIB")
    if library:
        library.exclude = True
    bpy.context.view_layer.update()
    from espaces.spawns import recaler_spawns
    report["spawns"] = recaler_spawns(REBUILT)
    bpy.context.scene["backstage_route"] = "parking_or_v1"
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = C.sheet(["dessus:reserve", (8, 125, 0), "dessus:sav", "dessus:c_bu",
                     (42, 124.5, 0), (66, 115, 0), "dessus:pc_secu", "dessus:vestiaires"],
                    cols=2, taille=(640, 360), nom="coulisses_candidat")
    shutil.copy2(sheet["png"], OUT / "candidat.png")
    for mode in ("solid", "silhouette"):
        C.shot("veh_proposition_berline_bleu_acier_so_direction", mode=mode,
               isoler="veh_proposition_berline_bleu_acier_so_direction", plafonds=False,
               nom="coulisses_voiture_" + mode)
    print("BACKSTAGE_SHOT=" + C.as_json(sheet), flush=True)
    if any(hashlib.sha256(p.read_bytes()).hexdigest() != old for p, old in hashes.items()):
        raise RuntimeError("La source a changé pendant la préparation ; sauvegarde annulée")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
    result = C.export(out=preview.with_suffix(".glb") if preview else EXPORT)
    print("BACKSTAGE_EXPORT=" + C.as_json(result), flush=True)
    if not result.get("ok"):
        raise RuntimeError("Export refusé ; sauvegarde disponible dans " + str(backup))
    report.update({"backup": str(backup), "preview": str(preview) if preview else None})
    (OUT / "modifications.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print("BACKSTAGE_RESULT=" + C.as_json(report), flush=True)


def migrate():
    import plan_de_masse as plan
    import build_blockout as bo
    from build_niveau import HABILLAGE, SIGNATURES_HABILLEES
    from espaces.coque import materiaux_espace, plafond
    from espaces.eclairage import eclairage_couloir
    from espaces.portes import poser_linteaux, poser_portes_animees
    from espaces.props import poser_props_physiques
    from espaces.pc_secu import poser_cameras_pc_secu
    shell, props, col, logic = (bpy.data.collections[n] for n in ("SHELL", "PROPS", "COL", "LOGIC"))
    affected_doors = {
        "door_pc_entree_g", "door_pc_entree_d", "door_pc_poste_g", "door_pc_poste_d",
        "col_box_pc_entree_linteau", "door_vestiaires_entree_g", "door_vestiaires_entree_d",
        "door_vestiaires_fournil_g", "door_vestiaires_fournil_d", "door_fournil_couloir_g", "door_fournil_couloir_d",
        "vitre_pc_gaine", "vitre_fournil_gaine", "door_sav_couloir", "door_douches_g", "door_douches_d",
        "use_carte_or", "use_pc_secu", "use_pointeuse", "use_sav_sonnette",
    }
    area = "|".join(sorted(SHELL_IDS, key=len, reverse=True))
    shell_pattern = re.compile(r"^(?:col_(?:box|hull)_)?(?:sol_|mur_|plafond_|parapet_)(?:" + area + r")(?:_|$)")
    furniture = re.compile(r"(?:^|_)(?:rs_|so_|ps_|vs_|sav_|cbu_|c_bu_n_|c_so_bu_n_|c_rs_so_n_)")
    removed = []
    for obj in list(bpy.context.scene.objects):
        if not any(obj in c.objects.values() for c in (shell, props, col, logic)):
            continue
        name = obj.name
        pickup = any(name.startswith(f"use_{kind}_{sid}_") for sid in REBUILT
                     for kind in ("soin", "munitions", "nourriture"))
        physical = any(name.startswith("prop_" + sid) for sid in REBUILT)
        lintel = name.startswith(("linteau_", "imposte_")) and any(sid in name for sid in SHELL_IDS)
        old_sign = any(tag in name for tag in ("nav_so_", "nav_personnel_", "nav_escalier_", "csw_rep_cadre_sav",
                                               "csw_rep_nom_sav", "csw_rep_enseigne_sav_"))
        mobilier = (furniture.search(name) and "c_hb_rs" not in name
                    and not name.startswith(("mur_", "sol_", "plafond_", "parapet_",
                                             "col_box_mur_", "col_box_sol_", "col_hull_sol_")))
        remove = (shell_pattern.search(name) or mobilier or pickup or physical or lintel or old_sign
                  or name in affected_doors or name.startswith(("plateforme_rs", "rampe_plateforme_rs",
                      "col_box_plateforme_rs", "col_hull_rampe_plateforme_rs", "fx_douche_", "use_douche_",
                      "light_c_bu_", "light_c_so_bu_", "light_c_rs_so_")))
        if remove:
            removed.append(name)
            bpy.data.objects.remove(obj, do_unlink=True)
    gris, cache = bo.creer_materiaux(), {}
    openings = bo.ouvertures_effectives()
    added = {}
    for space in plan.ALL:
        if space.id not in SHELL_IDS:
            continue
        materials = materiaux_espace(space, gris, cache)
        if space.rampe:
            sense, start, end = space.rampe
            bo.pente("sol_" + space.id, space.x, space.y, start, end, sense, materials, shell, col)
        else:
            bo.boite("sol_" + space.id, (space.x[0], space.y[0], space.z - bo.EPAISSEUR_SOL),
                     (space.largeur, space.profondeur, bo.EPAISSEUR_SOL), "sol", materials, shell, col)
        bo.murs_espace(space, openings, materials, shell, col)
        plafond(space, shell)
        if space.id in REBUILT:
            author = HABILLAGE.get(space.id)
            added[space.id] = author(space, materials, props, col, logic) if author else {
                "lampes": eclairage_couloir(space, props, logic)}
            poser_props_physiques(space, props)
    relevant = [o for o in openings if {o.a, o.b} & SHELL_IDS]
    poser_linteaux(relevant, gris, cache, shell)
    door_pairs = [frozenset(pair) for pair in (("c_bu", "pc_secu"), ("c_bu", "vestiaires"),
                  ("c_bu", "fournil"), ("pc_secu", "gaine"), ("fournil", "gaine"),
                  ("reserve", "sav"), ("sav", "c_bu"),
                  ("compacteur", "reserve"), ("compacteur", "c_short_w"))]
    poser_portes_animees([o for o in openings if frozenset({o.a, o.b}) in door_pairs], props, col, logic)
    bo.poser_reperes(gris, props, col, logic, sauter=SIGNATURES_HABILLEES, ids=REBUILT)
    for space in plan.SPACES:
        if space.id not in REBUILT:
            continue
        for name, x, y, _ in space.spawns:
            obj = bpy.data.objects.get("spawn_" + name)
            if obj is None:
                obj = bo.empty("spawn_" + name, (x, y, space.z), logic)
            obj.location = (x, y, space.z)
    for obj in list(logic.objects):
        if obj.name.startswith("cam_"):
            bpy.data.objects.remove(obj, do_unlink=True)
    poser_cameras_pc_secu(props, logic)
    return {"removed": len(removed), "rooms": added}


if __name__ == "__main__":
    main()
