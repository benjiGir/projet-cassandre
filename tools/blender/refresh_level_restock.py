"""Regroup existing boxes and cones without rebuilding the level.

    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/refresh_level_restock.py
    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/refresh_level_restock.py -- --preview /tmp/restock.blend

The preview writes a separate candidate. The default backs up the source and
runtime, saves the source and performs the guarded export. Only mesh positions
change; materials, UVs, vertex colors and gameplay properties are retained.
"""
from pathlib import Path
import hashlib
import math
import re
import runpy
import shutil
import sys
import tempfile

import bpy
from mathutils import Vector

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
backup = Path(tempfile.mkdtemp(prefix="level-restock-backup-"))
for path in (SOURCE, EXPORT):
    shutil.copy2(path, backup / path.name)
print(f"BACKUP={backup}", flush=True)


def bounds(obj):
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return (Vector(tuple(min(p[i] for p in points) for i in range(3))),
            Vector(tuple(max(p[i] for p in points) for i in range(3))))


def move(obj, delta):
    if obj.data.users > 1:
        obj.data = obj.data.copy()
    local_delta = obj.matrix_world.inverted().to_3x3() @ delta
    for vertex in obj.data.vertices:
        vertex.co += local_delta
    obj.data.update()
    print(f"RESTOCK={obj.name} delta={tuple(round(v, 3) for v in delta)}", flush=True)


moves = []
for zone in ("parking_ext", "caisses", "electro"):
    space = next(s for s in B.plan.SPACES if s.id == zone)
    for i, entry in enumerate(B.PROPS_PHYSIQUES[zone]):
        x, y, model, *stack = entry
        size = B.MODELES_PROPS[model][0]
        for floor in range(stack[0] if stack else 1):
            name = f"prop_{zone}{i}_{floor}"
            obj = bpy.data.objects.get(name)
            if obj is None or obj.type != "MESH":
                raise RuntimeError(f"Prop attendu absent : {name}")
            lo, hi = bounds(obj)
            if any(abs(hi[k] - lo[k] - size[k]) > .001 for k in range(3)):
                raise RuntimeError(f"Dimensions inattendues : {name}")
            target = Vector((x, y, space.z + (floor + .5) * size[2]))
            moves.append((obj, target - (lo + hi) / 2))

for i, (x, y, model) in enumerate(B.PK_ACCESSOIRES[:3]):
    if model != "cone":
        raise RuntimeError("Les trois accessoires attendus sont des cônes")
    objects = [o for o in bpy.context.scene.objects
               if re.search(rf"_pk_acc{i}(?:\.\d+)?$", o.name)]
    if len(objects) != 2:
        raise RuntimeError(f"Attendu un cône et son proxy : {i}, {len(objects)} meshes")
    proxy = next(o for o in objects if o.name.startswith("col_box_"))
    lo, hi = bounds(proxy)
    a = math.radians(i * 43)
    target = Vector((x + .2 * (math.cos(a) - math.sin(a)),
                     y + .2 * (math.sin(a) + math.cos(a)), .35))
    delta = target - (lo + hi) / 2
    moves.extend((obj, delta) for obj in objects)

for obj, delta in moves:
    move(obj, delta)
bpy.context.view_layer.update()

colliders = [(o, bounds(o)) for o in bpy.context.scene.objects
             if o.type == "MESH" and o.name.startswith(("col_", "prop_"))]
for obj, _ in moves:
    if not obj.name.startswith(("prop_", "col_")):
        continue
    lo, hi = bounds(obj)
    for other, (other_lo, other_hi) in colliders:
        if other == obj:
            continue
        overlap = [min(hi[k], other_hi[k]) - max(lo[k], other_lo[k]) for k in range(3)]
        if all(v > .02 for v in overlap):
            raise RuntimeError(f"Chevauchement après déplacement : {obj.name}, {other.name}")

if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != original_hash:
    raise RuntimeError("Le niveau a changé pendant la mise à jour ; sauvegarde annulée")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
if preview:
    print(f"RESTOCK_PREVIEW={preview}", flush=True)
else:
    script = ROOT / "tools/blender/export_level.py"
    sys.argv = [str(script), "--", "--out", str(EXPORT)]
    runpy.run_path(str(script), run_name="__main__")
