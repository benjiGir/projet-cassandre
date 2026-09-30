"""Install route signs only, preserving the existing level scene.

    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/refresh_level_wayfinding.py

Backs up .blend/.glb, then updates the source and guarded runtime export.
"""
from pathlib import Path
import hashlib
import runpy
import shutil
import sys
import tempfile
import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/blender"))
import lib_wayfinding as W
SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"
if Path(bpy.data.filepath).resolve() != SOURCE:
    raise RuntimeError("Ouvrir niveau_v2.blend avant la mise à jour")
original_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
backup = Path(tempfile.mkdtemp(prefix="level-wayfinding-backup-"))
for path in (SOURCE, EXPORT):
    shutil.copy2(path, backup / path.name)
print(f"BACKUP={backup}", flush=True)
for obj in list(bpy.context.scene.objects):
    if obj.name.startswith("sig_parcours_") and "_nav_" in obj.name:
        mesh = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
for coll in list(bpy.data.collections):
    if coll.name.startswith("sig_parcours_"):
        for obj in list(coll.objects):
            mesh = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        bpy.data.collections.remove(coll, do_unlink=True)
props = bpy.data.collections["PROPS"]
for zone in ("hub", "souterrain", "c_bu"):
    meshes = W.installer(zone, props)
    print(f"WAYFINDING={zone} meshes={len(meshes)}", flush=True)
if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != original_hash:
    raise RuntimeError("Le niveau a changé pendant la mise à jour ; sauvegarde annulée")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
script = ROOT / "tools/blender/export_level.py"
sys.argv = [str(script), "--", "--out", str(EXPORT)]
runpy.run_path(str(script), run_name="__main__")
