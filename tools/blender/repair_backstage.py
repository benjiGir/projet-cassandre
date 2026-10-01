"""Réparations locales après retour joueur sur les coulisses réimplantées."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import sys
import tempfile

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/blender"))
sys.path.insert(0, str(ROOT / "tools/level_v2"))
import cassandre as C

SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"
OUT = ROOT / "renders/coulisses-corrections"


def repair():
    import build_blockout as bo
    import plan_de_masse as plan
    import lib_backstage_route as signs
    import lib_wayfinding as wayfinding
    from espaces.coque import materiaux_espace
    from espaces.eclairage import eclairage_couloir
    from espaces.portes import poser_linteaux, poser_portes_animees

    shell, props, col, logic = (bpy.data.collections[n] for n in ("SHELL", "PROPS", "COL", "LOGIC"))
    openings = bo.ouvertures_effectives()
    pairs = {frozenset(p) for p in (("compacteur", "reserve"), ("compacteur", "c_short_w"),
                                   ("reserve", "c_bu"))}
    selected = [o for o in openings if frozenset({o.a, o.b}) in pairs]
    headers = {f"imposte_{o.a}_{o.b}" for o in selected}
    headers.update(f"linteau_{a}_{b}" for o in selected for a, b in ((o.a, o.b), (o.b, o.a)))
    sas_walls = re.compile(r"^(?:col_box_)?mur_c_hb_rs_")
    removed = []
    for obj in list(bpy.context.scene.objects):
        if any(c.name.startswith("_LIB") for c in obj.users_collection):
            continue
        name = obj.name
        if (sas_walls.match(name) or "c_hb_rs_n_" in name or name.startswith("light_c_hb_rs_")
                or name in headers or name.startswith(("door_compacteur_", "compacteur_service_",
                    "compacteur_reserve_", "rear_sign_", "rear_direction_cadre"))
                or "_nav_so_" in name or "_nav_personnel_" in name or "_nav_escalier_" in name
                or name == "co_quai_cadre"):
            removed.append(name)
            bpy.data.objects.remove(obj, do_unlink=True)
    gris, cache = bo.creer_materiaux(), {}
    sas = next(s for s in plan.ALL if s.id == "c_hb_rs")
    bo.murs_espace(sas, openings, materiaux_espace(sas, gris, cache), shell, col)
    lamps = eclairage_couloir(sas, props, logic)
    poser_linteaux(selected, gris, cache, shell)
    poser_portes_animees([o for o in selected if "compacteur" in (o.a, o.b)], props, col, logic)
    for zone in ("reserve", "c_bu", "pc_secu", "souterrain"):
        signs.installer(zone, props)
    for zone in ("c_bu", "souterrain"):
        wayfinding.installer(zone, props)
    bpy.context.scene["backstage_repairs"] = "sas_compacteur_signs_v1"
    return {"removed": len(removed), "sas_lamps": lamps,
            "doors": ["door_compacteur_service", "door_compacteur_reserve"]}


def main():
    if Path(bpy.data.filepath).resolve() != SOURCE:
        raise RuntimeError("Ouvrir niveau_v2.blend pour réparer ses coulisses")
    if bpy.context.scene.get("backstage_route") != "parking_or_v1":
        raise RuntimeError("La réparation vise la nouvelle implantation des coulisses")
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    preview = Path(args[args.index("--preview") + 1]).resolve() if "--preview" in args else None
    if preview and (preview in (SOURCE, EXPORT) or preview.with_suffix(".glb") in (SOURCE, EXPORT)):
        raise RuntimeError("L'aperçu doit être distinct du niveau livré")
    hashes = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in (SOURCE, EXPORT)}
    backup = Path(tempfile.mkdtemp(prefix="backstage-repairs-backup-"))
    for path in (SOURCE, EXPORT):
        shutil.copy2(path, backup / path.name)
    print("REPAIRS_BACKUP=" + str(backup), flush=True)
    report = repair()
    library = bpy.context.view_layer.layer_collection.children.get("_LIB")
    if library:
        library.exclude = True
    bpy.context.view_layer.update()
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = C.sheet(["dessus:c_hb_rs", (0, 94, 90), "dessus:compacteur", (-30, 116, 270),
                     (-32, 122, 90), (8, 127, 0)], cols=2, taille=(640, 360),
                    nom="coulisses_reparations")
    shutil.copy2(sheet["png"], OUT / "blender.png")
    print("REPAIRS_SHOT=" + C.as_json(sheet), flush=True)
    if any(hashlib.sha256(p.read_bytes()).hexdigest() != old for p, old in hashes.items()):
        raise RuntimeError("La source a changé pendant la préparation ; sauvegarde annulée")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
    result = C.export(out=preview.with_suffix(".glb") if preview else EXPORT)
    print("REPAIRS_EXPORT=" + C.as_json(result), flush=True)
    if not result.get("ok"):
        raise RuntimeError("Export refusé ; sauvegarde disponible dans " + str(backup))
    report.update({"backup": str(backup), "preview": str(preview) if preview else None})
    (OUT / "modifications.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print("REPAIRS_RESULT=" + C.as_json(report), flush=True)


if __name__ == "__main__":
    main()
