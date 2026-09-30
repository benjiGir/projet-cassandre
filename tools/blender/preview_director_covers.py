"""Essai de l'étape 6 : candidat séparé, aucune écriture dans le niveau livré.

    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- direction_covers
"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import sys

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/blender"))
import cassandre as C
import lib_helpers as H

SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"
OUT = ROOT / "docs/assets/agencement-etape-6-2026-09-30"
CANDIDATE = ROOT / "renders/_cassandre/direction_covers.blend"
COVERS = (
    ("ouest", (-42.5, 153.0, 4.0, -40.1, 153.75, 5.2)),
    ("est", (-34.4, 155.0, 4.0, -32.0, 155.75, 5.2)),
)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def config_height(path):
    text = path.read_text()
    match = re.search(r"eyeHeight:\s*([0-9.]+)\s*,", text)
    if not match:
        raise RuntimeError(f"Hauteur des yeux introuvable : {path}")
    return float(match.group(1))


def meuble(name, bounds, props, col_coll):
    x, y, z, x1, y1, z1 = bounds
    parts = [
        ((x, y, z, x1, y1, z+.08), "aplat:#2f3541"),
        ((x, y+.035, z+.08, x1, y1, z1-.065), "aplat:#605c58"),
        ((x-.025, y-.025, z1-.065, x1+.025, y1+.025, z1), "aplat:#d98330"),
    ]
    for column in range(3):
        left = x+.035+column*.8
        for row in range(3):
            bottom = z+.105+row*.34
            parts.extend((
                ((left, y, bottom, left+.73, y+.03, bottom+.305), "aplat:#919292"),
                ((left+.23, y-.02, bottom+.21, left+.50, y, bottom+.235), "aplat:#2f3541"),
                ((left+.28, y-.008, bottom+.08, left+.45, y-.003, bottom+.14), "aplat:#b5d2e8"),
            ))
    H.boxes("di_essai_archives_"+name, parts, "palette", props, subdiv=.75)
    H.col_box("di_essai_archives_"+name, (x-.025,y-.025,z,x1+.025,y1+.025,z1), col_coll)


def views(tag):
    for name, pose in (
        ("entree", (-31.3, 152.25, 46)),
        ("ouest", (-41.3, 151.8, -18)),
        ("est", (-33.2, 153.8, 28)),
        ("dessus", "dessus:direction"),
    ):
        result = C.shot(pose, nom=f"direction_{name}_{tag}")
        shutil.copy2(result["png"], OUT/f"{name}_{tag}.png")
        print("DIRECTION_SHOT="+C.as_json(result), flush=True)


if Path(bpy.data.filepath).resolve() != SOURCE:
    raise RuntimeError("Ouvrir la source niveau_v2.blend avant l'essai")
hashes = {str(path): digest(path) for path in (SOURCE, EXPORT)}
OUT.mkdir(parents=True, exist_ok=True)
CANDIDATE.parent.mkdir(parents=True, exist_ok=True)
views("avant")
props, col_coll = (bpy.data.collections[name] for name in ("PROPS", "COL"))
for name, bounds in COVERS:
    meuble(name, bounds, props, col_coll)
views("candidat")
isolated = C.shot("di_essai_archives_ouest", mode="silhouette", taille=(640, 640),
                  isoler="di_essai_archives_ouest", nom="direction_archives_silhouette")
shutil.copy2(isolated["png"], OUT/"archives_silhouette.png")
player_eye = config_height(ROOT/"src/game/player/moveConfig.ts")
boss_eye = config_height(ROOT/"src/game/entities/directorConfig.ts")
report = {
    "candidate": str(CANDIDATE.relative_to(ROOT)),
    "source_hashes": hashes,
    "floor_z": 4.0,
    "player_eye_height": player_eye,
    "director_eye_height": boss_eye,
    "cover_height": 1.2,
    "min_eye_ray_clearance": round(min(player_eye,boss_eye)-1.2, 3),
    "central_gap": round(-34.425-(-40.075), 3),
    "new_meshes": 2,
    "new_cuboid_proxies": 2,
    "covers": [{"name": name,"bounds": bounds} for name,bounds in COVERS],
    "combat_playtest": "non réalisé ; étude géométrique uniquement",
    "decision": "ne pas intégrer : les meubles ne coupent pas le segment de visée nominal",
}
if report["min_eye_ray_clearance"] <= 0:
    raise RuntimeError("Les hauteurs de tir ont changé ; revoir le diagnostic")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(CANDIDATE))
for path, expected in hashes.items():
    if digest(Path(path)) != expected:
        raise RuntimeError(f"Le niveau livré a changé pendant l'essai : {path}")
report["delivered_level_unchanged"] = True
(OUT/"mesures.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n")
print("DIRECTION_CANDIDATE="+C.as_json(report), flush=True)
