"""Replace only parking vehicles and the reserve truck in the existing level.

Run with Blender on assets_src/blender/niveau_v2.blend. Keeps the rest of the
scene intact; backs up source/export and refuses to overwrite a changed source.
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
backup = Path(tempfile.mkdtemp(prefix="parking-vehicles-backup-"))
for path in (SOURCE, EXPORT):
    shutil.copy2(path, backup / path.name)
print(f"BACKUP={backup}")

props = bpy.data.collections["PROPS"]
colliders = bpy.data.collections["COL"]
spaces = {space.id: space for space in B.plan.SPACES}
pattern = re.compile(r"_(?:pk_au\w*|so_au\d+|rs_camion)(?:\.\d+)?$")
old = [obj for obj in bpy.context.scene.objects
       if obj.type == "MESH" and pattern.search(obj.name)
       and obj.name.startswith(("veh_", "col_box_"))]
if not any("rs_camion" in obj.name for obj in old):
    raise RuntimeError("Camion de réserve absent ; mise à jour annulée")
for obj in old:
    mesh = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)

kinds = {row[0] for row in B.PK_VEHICULES} | set(B.SO_VEHICULES) | {"camion"}
for kind in kinds:
    template = bpy.data.collections.get(f"veh_proposition_{kind}")
    if template is None:
        continue
    for obj in list(template.objects):
        mesh = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    bpy.data.collections.remove(template, do_unlink=True)

outside = B.placer_voitures_exterieur(spaces["parking_ext"], props, colliders)
underground = B.placer_voitures_souterrain(spaces["souterrain"], props, colliders)
B.placer_camion_reserve(spaces["reserve"], props, colliders)
print(f"VEHICLES exterior={outside} underground={underground} truck=1 images={len(bpy.data.images)}")
if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != original_hash:
    raise RuntimeError("Le niveau a changé pendant la mise à jour ; sauvegarde annulée")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
export_script = ROOT / "tools/blender/export_level.py"
sys.argv = [str(export_script), "--", "--out", str(EXPORT)]
runpy.run_path(str(export_script), run_name="__main__")
