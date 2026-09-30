"""Recette locale appelée par cassandre.compose_public(preview=...).

Source et export sauvegardés avant toute mutation. Le candidat reste isolé
quand --preview est fourni ; les gros meubles et les autres pièces sont conservés.
"""
from pathlib import Path
import hashlib
import shutil
import sys
import tempfile

import bpy

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"tools/blender"))
import cassandre as C
import lib_public_compositions as P

SOURCE=ROOT/"assets_src/blender/niveau_v2.blend"
EXPORT=ROOT/"public/assets/levels/niveau_v2.glb"
if Path(bpy.data.filepath).resolve()!=SOURCE:
    raise RuntimeError("Ouvrir niveau_v2.blend avant la mise à jour")
args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
preview=Path(args[args.index("--preview")+1]).resolve() if "--preview" in args else None
if preview in (SOURCE,EXPORT):raise RuntimeError("Le candidat doit être distinct de la source")
original_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
backup=Path(tempfile.mkdtemp(prefix="public-compositions-backup-"))
for path in (SOURCE,EXPORT):shutil.copy2(path,backup/path.name)
print(f"BACKUP={backup}",flush=True)
for obj in list(bpy.context.scene.objects):
    if obj.name.startswith(("comp_ga_","comp_ca_","comp_ry_","col_box_comp_ga_")):
        # Les produits recomposés doivent être recréables après le premier passage.
        if obj.name.startswith("comp_ry_") and obj.name.endswith("_produits"):
            continue
        mesh=obj.data if obj.type=="MESH" else None
        bpy.data.objects.remove(obj,do_unlink=True)
        if mesh and mesh.users==0:bpy.data.meshes.remove(mesh)
props,col_coll=(bpy.data.collections[name] for name in ("PROPS","COL"))
for zone,apply in (("galerie",lambda:P.galerie(props,col_coll)),("cafeteria",lambda:P.cafeteria(props)),("rayons",lambda:P.rayons(props))):
    print(f"PUBLIC_COMPOSITION={zone} {apply()}",flush=True)
if hashlib.sha256(SOURCE.read_bytes()).hexdigest()!=original_hash:
    raise RuntimeError("La source a changé pendant la mise à jour ; sauvegarde annulée")
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
if not preview:
    result=C.export(out=EXPORT)
    print("PUBLIC_EXPORT="+C.as_json(result),flush=True)
    if not result.get("ok"):raise RuntimeError("Export refusé ; consulter le log Cassandre")
