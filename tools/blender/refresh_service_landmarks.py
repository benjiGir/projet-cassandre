"""Ajouter les deux repères du couloir coupe-feu, sans reconstruire la map.

    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/refresh_service_landmarks.py -- --preview /tmp/service.blend
    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/refresh_service_landmarks.py

Sauvegarde source et export. --preview écrit un candidat isolé ; sinon la
source est enregistrée puis exportée avec les garde-fous habituels.
"""
from pathlib import Path
import hashlib
import shutil
import sys
import tempfile

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/blender"))
import lib_service_landmarks as S
import cassandre as pipeline

SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"
if Path(bpy.data.filepath).resolve() != SOURCE:
    raise RuntimeError("Ouvrir niveau_v2.blend avant la mise à jour")
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
preview = Path(args[args.index("--preview") + 1]).resolve() if "--preview" in args else None
if preview in (SOURCE, EXPORT):
    raise RuntimeError("Le candidat doit rester distinct de la source")
original_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
backup = Path(tempfile.mkdtemp(prefix="service-landmarks-backup-"))
for path in (SOURCE, EXPORT):
    shutil.copy2(path, backup / path.name)
print(f"BACKUP={backup}", flush=True)
for obj in list(bpy.context.scene.objects):
    if obj.name.startswith(("csw_rep_", "col_box_csw_rep_")) or "_csw_rep_" in obj.name:
        mesh = obj.data if obj.type == "MESH" else None
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh and mesh.users == 0:
            bpy.data.meshes.remove(mesh)
S.regrouper_existants()
result = S.installer(bpy.data.collections["PROPS"], bpy.data.collections["COL"])
print(f"SERVICE_LANDMARKS={result}", flush=True)
if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != original_hash:
    raise RuntimeError("La source a changé pendant la mise à jour ; sauvegarde annulée")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
if not preview:
    result = pipeline.export(out=EXPORT)
    print("SERVICE_EXPORT=" + pipeline.as_json(result), flush=True)
    if not result.get("ok"):
        raise RuntimeError("L'export du couloir a échoué ; voir le log cassandre")
