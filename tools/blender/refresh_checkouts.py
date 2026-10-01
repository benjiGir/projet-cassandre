"""Mise à jour locale de la zone des caisses, appelée par Cassandre.

    cassandre_cli.py -- rework_checkouts preview=/tmp/caisses.blend
    cassandre_cli.py -- rework_checkouts inspect=true
"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import sys
import tempfile

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/blender"))
import cassandre as C

SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"
OUT = ROOT / "renders/caisses-refonte"


def bounds(obj):
    points = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return [round(min(p[i] for p in points), 3) for i in range(3)] + [round(max(p[i] for p in points), 3) for i in range(3)]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect():
    objects = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        box = bounds(obj)
        if not (-26 <= (box[0] + box[3]) / 2 <= 26 and 20 <= (box[1] + box[4]) / 2 <= 44):
            continue
        if not (re.search(r"_cs\d$|_cs_|^use_|^prop_caisses|^ck_|^col_box_ck_", obj.name) or "caisse" in obj.name):
            continue
        colors = obj.data.color_attributes.active_color
        sample = list(colors.data[0].color) if colors and len(colors.data) else None
        objects.append({"name": obj.name, "bounds": box, "materials": [m.name for m in obj.data.materials if m], "color": sample})
    report = {"objects": objects, "spawns": [{"name": o.name, "pos": list(o.location)} for o in bpy.context.scene.objects if o.name.startswith("spawn_suit_cs")]}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "inspection.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print("CHECKOUT_INSPECT=" + C.as_json({"objects": len(objects), "spawns": report["spawns"], "report": str(OUT / "inspection.json")}), flush=True)


def main():
    if Path(bpy.data.filepath).resolve() != SOURCE:
        raise RuntimeError("Ouvrir niveau_v2.blend avant de retravailler les caisses")
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--inspect" in args:
        inspect()
        return
    from lib_checkouts import rework_scene
    preview = Path(args[args.index("--preview") + 1]).resolve() if "--preview" in args else None
    if preview in (SOURCE, EXPORT):
        raise RuntimeError("Le candidat doit être distinct du niveau livré")
    hashes = {p: digest(p) for p in (SOURCE, EXPORT)}
    backup = Path(tempfile.mkdtemp(prefix="checkout-rework-backup-"))
    for path in (SOURCE, EXPORT):
        shutil.copy2(path, backup / path.name)
    print(f"BACKUP={backup}", flush=True)
    report = rework_scene()
    library = bpy.context.view_layer.layer_collection.children.get("_LIB")
    if library:
        library.exclude = True
    OUT.mkdir(parents=True, exist_ok=True)
    views = ["dessus:caisses", (0, 24, 0), (-18, 27, 330), (0, 41, 180)]
    sheet = C.sheet(views, cols=2, taille=(640, 360), nom="caisses_candidat")
    shutil.copy2(sheet["png"], OUT / "candidat.png")
    print("CHECKOUT_SHOT=" + C.as_json(sheet), flush=True)
    if any(digest(p) != old for p, old in hashes.items()):
        raise RuntimeError("La source a changé pendant la préparation ; sauvegarde annulée")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
    if not preview:
        result = C.export(out=EXPORT)
        print("CHECKOUT_EXPORT=" + C.as_json(result), flush=True)
        if not result.get("ok"):
            raise RuntimeError("Export refusé ; sauvegarde disponible dans " + str(backup))
    report.update({"backup": str(backup), "preview": str(preview) if preview else None})
    (OUT / "modifications.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print("CHECKOUT_RESULT=" + C.as_json(report), flush=True)


if __name__ == "__main__":
    main()
