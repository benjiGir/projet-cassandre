"""Refonte locale des huit distributeurs, avec aperçu et export Cassandre."""
from pathlib import Path
import fnmatch
import hashlib
import json
import shutil
import sys
import tempfile

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/blender"))
import cassandre as C
import lib_bureaux as B
import lib_distributeurs as D

SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"
STATIC = (
    ("ca_dist0", "soda_5g_cola", "-x"),
    ("ca_dist1", "chips_illumi", "-x"),
    ("ca_dist2", "cafe_reveille", "-x"),
    ("cbu_dist", "cafe_reveille", "+y"),
    ("et_pause_dist", "chips_illumi", "-x"),
)
DYNAMIC = (
    ("prop_ca_distributeur", "soda_5g_cola", "-y"),
    ("prop_csr_distributeur", "chips_illumi", "+y"),
    ("prop_csw_distributeur", "soda_5g_cola", "-x"),
)


def bounds(obj):
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return tuple(min(p[i] for p in points) for i in range(3)) + tuple(max(p[i] for p in points) for i in range(3))


def remove(obj):
    data = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if data.users == 0:
        bpy.data.meshes.remove(data)


def rework_scene():
    created, report = [], []
    for suffix, facade, front in STATIC:
        collider = bpy.data.objects[f"col_box_distributeur_{facade}_{suffix}"]
        extent = bounds(collider)
        old = [obj for obj in bpy.context.scene.objects
               if obj.type == "MESH" and obj.name.startswith("mob_distributeur_")
               and fnmatch.fnmatchcase(obj.name, f"*_{suffix}")]
        if len(old) not in (1, 4):
            raise RuntimeError(f"{suffix}: composants inattendus ({len(old)})")
        collections = list(old[0].users_collection)
        for obj in old:
            remove(obj)
        obj = D.fit(D.machine(f"mob_distributeur_{facade}_{suffix}", facade, collections[0]), extent, front)
        for collection in collections[1:]:
            collection.objects.link(obj)
        created.append(obj)
        report.append(dict(name=obj.name, facade=facade, bounds=extent, breakable=False))
    for name, facade, front in DYNAMIC:
        old = bpy.data.objects[name]
        extent, extras = bounds(old), dict(old.items())
        collections = list(old.users_collection)
        remove(old)
        obj = D.fit(D.machine(name, facade, collections[0]), extent, front)
        for key, value in extras.items():
            obj[key] = value
        for collection in collections[1:]:
            collection.objects.link(obj)
        if max(abs(a - b) for a, b in zip(bounds(obj), extent)) > 1e-5:
            raise RuntimeError(f"{name}: l'encombrement du prop a changé")
        created.append(obj)
        report.append(dict(name=name, facade=facade, bounds=extent, breakable=True, contenu=extras["contenu"]))
    # Les props mobiles gardent l'éclairage dynamique ; seul le décor reçoit Col.
    for obj in created:
        if obj.name.startswith("prop_"):
            continue
        colors = obj.data.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
        obj.data.color_attributes.active_color = colors
        obj.data.color_attributes.render_color_index = 0
        for datum in colors.data:
            datum.color = (.7, .7, .7, 1)
    for facade in D.FACADES:
        collection = bpy.data.collections.get(f"mob_distributeur_{facade}")
        if collection:
            for obj in list(collection.objects):
                remove(obj)
            bpy.data.collections.remove(collection)
        B.distributeur(facade)
    # Le fronton des sponsors reste sous la marque de la machine.
    for name, height in (("use_borne_personnel", 1.14), ("use_borne_bureaux", 5.14)):
        bpy.data.objects[name].location.z = height
    library = bpy.context.view_layer.layer_collection.children.get("_LIB")
    if library:
        library.exclude = True
    bpy.context.view_layer.update()
    return report


def main():
    if Path(bpy.data.filepath).resolve() != SOURCE:
        raise RuntimeError("Ouvrir niveau_v2.blend avant la refonte des distributeurs")
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    preview = Path(args[args.index("--preview") + 1]).resolve() if "--preview" in args else None
    if preview and (preview in (SOURCE, EXPORT) or preview.with_suffix(".glb") in (SOURCE, EXPORT)):
        raise RuntimeError("L'aperçu doit être distinct du niveau livré")
    hashes = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in (SOURCE, EXPORT)}
    backup = Path(tempfile.mkdtemp(prefix="vending-backup-"))
    for path in (SOURCE, EXPORT):
        shutil.copy2(path, backup / path.name)
    machines = rework_scene()
    captures = C.sheet([(52.1, 3.45, 270), (18.45, 135.5, 180), (4.5, 160, 270), (35.45, 9.5, 0)],
                       taille=(640, 360), nom="distributeurs_niveau")
    if any(hashlib.sha256(path.read_bytes()).hexdigest() != value for path, value in hashes.items()):
        raise RuntimeError("Le niveau a changé pendant la préparation ; sauvegarde annulée")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
    export = C.export(out=preview.with_suffix(".glb") if preview else EXPORT)
    print("VENDING_EXPORT=" + C.as_json(export), flush=True)
    if not export.get("ok"):
        raise RuntimeError("Export refusé ; sauvegarde disponible dans " + str(backup))
    print("VENDING_RESULT=" + json.dumps(dict(machines=machines, capture=captures.get("png"),
                                              backup=str(backup), preview=str(preview) if preview else None),
                                       ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
