"""Habiller uniquement le compacteur et la planque du niveau existant.

    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/refresh_compacteur_planque.py -- --preview /tmp/compacteur.blend
    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/refresh_compacteur_planque.py

Sauvegarde les fichiers d'origine. Le candidat reste séparé avec --preview ;
sinon la source est enregistrée et l'export du jeu est vérifié.
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
    raise RuntimeError("Ouvrir niveau_v2.blend avant la mise à jour")
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
preview = Path(args[args.index("--preview") + 1]).resolve() if "--preview" in args else None
if preview in (SOURCE, EXPORT):
    raise RuntimeError("Le candidat doit avoir un chemin distinct de la source")
original_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
backup = Path(tempfile.mkdtemp(prefix="compacteur-planque-backup-"))
for path in (SOURCE, EXPORT):
    shutil.copy2(path, backup / path.name)
print(f"BACKUP={backup}", flush=True)

grey = re.compile(r"^(?:col_box_)?(?:balle_carton_co[0-2]|bouton_compacteur_co)$")
placed = re.compile(r"_(?:co_transpalette|s4_(?:canape|table|frigo|lampe|radio|boisson[0-2]))(?:\.\d+)?$")
old = [obj for obj in bpy.context.scene.objects
       if (grey.match(obj.name) or placed.search(obj.name)
           or obj.name.startswith(("co_", "s4_", "col_box_co_", "col_box_s4_",
                                   "prop_co_", "ecran_s4_", "light_co_", "light_s4_"))
           or obj.name in ("light_compacteur_0_0", "light_secret4_0_0"))]
for obj in old:
    mesh = obj.data if obj.type == "MESH" else None
    bpy.data.objects.remove(obj, do_unlink=True)
    if mesh and mesh.users == 0:
        bpy.data.meshes.remove(mesh)
print(f"REMOVED={len(old)}", flush=True)

props, colliders, logic = (bpy.data.collections[name] for name in ("PROPS", "COL", "LOGIC"))
for zone in ("compacteur", "secret4"):
    space = next(s for s in B.plan.SPACES if s.id == zone)
    result = B.HABILLAGE[zone](space, {}, props, colliders, logic)
    print(f"DRESSING={zone} {result}", flush=True)
B.C.actualiser_pizza(next(s for s in B.plan.SPACES if s.id == "secret4"), logic)

if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != original_hash:
    raise RuntimeError("Le niveau a changé pendant la mise à jour ; sauvegarde annulée")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
if preview:
    print(f"DRESSING_PREVIEW={preview}", flush=True)
else:
    script = ROOT / "tools/blender/export_level.py"
    sys.argv = [str(script), "--", "--out", str(EXPORT)]
    runpy.run_path(str(script), run_name="__main__")
