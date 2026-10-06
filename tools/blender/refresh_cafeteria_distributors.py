"""Reposition only the cafeteria's three east-wall vending machines in the existing level.

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
from espaces import cafeteria as CA

SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"
if Path(bpy.data.filepath).resolve() != SOURCE:
    raise RuntimeError("Ouvrir la source niveau_v2.blend avant la mise à jour")
original_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
backup = Path(tempfile.mkdtemp(prefix="cafeteria-distributors-backup-"))
for path in (SOURCE, EXPORT):
    shutil.copy2(path, backup / path.name)
print(f"BACKUP={backup}")

pattern = re.compile(r"_ca_dist[0-2](?:\.\d+)?$")
old = [obj for obj in bpy.context.scene.objects
       if obj.type == "MESH" and pattern.search(obj.name)]
if len(old) not in (6, 15):
    raise RuntimeError(f"Attendu trois machines et leurs colliders (6 ou 15 meshes) : {len(old)}")
for obj in old:
    mesh = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)
space = next(space for space in B.plan.SPACES if space.id == "cafeteria")
placed = CA.placer_distributeurs_cafeteria(space, bpy.data.collections["PROPS"],
                                  bpy.data.collections["COL"])
for obj in placed:
    if not obj.name.startswith("col_box_"):
        continue
    lo = tuple(min(v.co[i] for v in obj.data.vertices) for i in range(3))
    hi = tuple(max(v.co[i] for v in obj.data.vertices) for i in range(3))
    back_x = space.x[1] - B.bo.EPAISSEUR_MUR - 0.05
    if not (abs(hi[0] - back_x) < 1e-4
            and abs(lo[0] - (back_x - 0.75)) < 1e-4
            and space.y[0] + 2.0 - 1e-4 <= lo[1] < hi[1] <= space.y[0] + 4.90 + 1e-4):
        raise RuntimeError(f"Distributeur mal aligné au mur : {obj.name}")
    print(f"DISTRIBUTOR={obj.name} BOUNDS={lo},{hi}")
if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != original_hash:
    raise RuntimeError("Le niveau a changé pendant la mise à jour ; sauvegarde annulée")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
export_script = ROOT / "tools/blender/export_level.py"
sys.argv = [str(export_script), "--", "--out", str(EXPORT)]
runpy.run_path(str(export_script), run_name="__main__")
