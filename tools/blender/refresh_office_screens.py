"""Correction locale des postes de bureau, via Cassandre.

    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- orient_office_screens
"""
from pathlib import Path
import hashlib
import json
import math
import re
import shutil
import sys
import tempfile

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/"tools/blender"))
import cassandre as C
import lib_bureaux as B

SOURCE = ROOT/"assets_src/blender/niveau_v2.blend"
EXPORT = ROOT/"public/assets/levels/niveau_v2.glb"
OUT = ROOT/"docs/assets/bureaux-ecrans-2026-09-30"
PARTS = ("plateau", "fauteuil", "pied_ecran", "ecran_dos", "ecran", "clavier")
PATTERN = re.compile(r"^(mob_poste_bureau_\d+)_(pied_ecran|ecran_dos|ecran|clavier|plateau|fauteuil)(.*)$")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def centre(obj):
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return Vector(tuple((min(p[i] for p in points)+max(p[i] for p in points))/2
                        for i in range(3)))


def capture(groups, tag):
    poses = []
    for key, parts in sorted(groups.items()):
        if key[1] not in ("_di_bureau", "_et_sec_poste", "_et_cpt_ps0", "_et_cpt_ps1", "_et_rh_ps"):
            continue
        seat, screen = centre(parts["fauteuil"]), centre(parts["ecran"])
        direction = screen-seat
        poses.append((seat.x, seat.y, math.degrees(math.atan2(-direction.x, direction.y))))
    result = C.sheet(poses, cols=3, taille=(640,360), nom="office_screens_"+tag)
    shutil.copy2(result["png"], OUT/(tag+".png"))
    print("OFFICE_SHOT="+C.as_json(result), flush=True)


if Path(bpy.data.filepath).resolve() != SOURCE:
    raise RuntimeError("Ouvrir niveau_v2.blend avant la correction")
args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
preview = Path(args[args.index("--preview")+1]).resolve() if "--preview" in args else None
if preview in (SOURCE, EXPORT):
    raise RuntimeError("La prévisualisation doit être distincte du niveau livré")
initial_hashes = {path: digest(path) for path in (SOURCE, EXPORT)}
backup = Path(tempfile.mkdtemp(prefix="office-screens-backup-"))
for path in (SOURCE, EXPORT):
    shutil.copy2(path, backup/path.name)
print(f"BACKUP={backup}", flush=True)
OUT.mkdir(parents=True, exist_ok=True)
groups = {}
for obj in bpy.context.scene.objects:
    match = PATTERN.match(obj.name)
    if match and obj.type == "MESH":
        asset, part, suffix = match.groups()
        groups.setdefault((asset, suffix), {})[part] = obj
if not groups or any(set(parts) != set(PARTS) for parts in groups.values()):
    raise RuntimeError("Postes incomplets ; correction annulée")
capture(groups, "avant")
changed = []
for key, parts in sorted(groups.items()):
    if B.orienter_equipements_poste(*(parts[name] for name in PARTS)):
        changed.append("".join(key))
capture(groups, "corrige")
if any(digest(path) != original for path, original in initial_hashes.items()):
    raise RuntimeError("Le niveau livré a changé pendant la correction ; sauvegarde annulée")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
if not preview:
    result = C.export(out=EXPORT)
    print("OFFICE_EXPORT="+C.as_json(result), flush=True)
    if not result.get("ok"):
        raise RuntimeError("Export refusé ; sauvegarde disponible dans "+str(backup))
report = {"modified_posts": changed, "backup": str(backup), "preview": str(preview) if preview else None}
(OUT/"modifications.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n")
print("OFFICE_RESULT="+C.as_json(report), flush=True)
