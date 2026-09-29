"""Reposition only the exterior shelter's three carts in the existing level.

Run in Blender with assets_src/blender/niveau_v2.blend open.
"""
from pathlib import Path
import hashlib
import re
import runpy
import shutil
import sys
import tempfile

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/level_v2"))
import build_niveau as B

SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"
if Path(bpy.data.filepath).resolve() != SOURCE:
    raise RuntimeError("Ouvrir la source niveau_v2.blend avant la mise à jour")
original_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
backup = Path(tempfile.mkdtemp(prefix="parking-caddies-backup-"))
for path in (SOURCE, EXPORT):
    shutil.copy2(path, backup / path.name)
print(f"BACKUP={backup}")

pattern = re.compile(r"_pk_cd[0-2](?:\.\d+)?$")
old = [obj for obj in bpy.context.scene.objects
       if obj.type == "MESH" and pattern.search(obj.name)]
if len(old) != 12:
    raise RuntimeError(f"Attendu 12 meshes pour les trois caddies : {len(old)}")
for obj in old:
    mesh = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)
space = next(space for space in B.plan.SPACES if space.id == "parking_ext")
placed = B.placer_caddies_parking(space, bpy.data.collections["PROPS"],
                                  bpy.data.collections["COL"])
for obj in placed:
    if not obj.name.startswith("col_box_"):
        continue
    lo = tuple(min(v.co[i] for v in obj.data.vertices) for i in range(3))
    hi = tuple(max(v.co[i] for v in obj.data.vertices) for i in range(3))
    if not (B.PK_ABRI[0] + 0.16 < lo[0] < hi[0] < B.PK_ABRI[0] + 5.84
            and B.PK_ABRI[1] + 0.16 < lo[1] < hi[1] < B.PK_ABRI[1] + 1.96):
        raise RuntimeError(f"Caddie hors de la file ou dans le rail : {obj.name}")
    print(f"CART={obj.name} BOUNDS={lo},{hi}")
if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != original_hash:
    raise RuntimeError("Le niveau a changé pendant la mise à jour ; sauvegarde annulée")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
export_script = ROOT / "tools/blender/export_level.py"
sys.argv = [str(export_script), "--", "--out", str(EXPORT)]
runpy.run_path(str(export_script), run_name="__main__")
