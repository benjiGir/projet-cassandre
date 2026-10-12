"""C.art_direction_reserve() : matières locales de la réserve."""
import json
from pathlib import Path
import re
import shutil
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
import cassandre as C


def inventory():
    objects = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith("col_") or not obj.visible_get():
            continue
        points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        center = sum(points, Vector()) / 8
        if not (-24.1 <= center.x <= 20.1 and 95.7 <= center.y <= 132.1 and -.3 <= center.z <= 8.3):
            continue
        objects.append({"nom": obj.name,
                        "matieres": [slot.material.name if slot.material else "" for slot in obj.material_slots],
                        "centre": [round(value, 2) for value in center]})
    report = {"objets": sorted(objects, key=lambda item: item["nom"])}
    path = ROOT / "renders/reviews/reserve-da/inventaire.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    names = sorted({re.sub(r"\.\d+$", "", mat) for obj in objects for mat in obj["matieres"]})
    return {"objets": len(objects), "matieres": names, "inventaire": str(path.relative_to(ROOT))}


def main(inspect=False):
    source = ROOT / "assets_src/blender/niveau_v2.blend"
    if Path(bpy.data.filepath).resolve() != source:
        raise ValueError("Ouvrir niveau_v2.blend avant cette retouche")
    if inspect:
        print("[store-reserve-da] " + json.dumps(inventory()))
        return
    from tools.art_direction.store_reserve import apply, write_report
    backup = ROOT / "renders/_cassandre/niveau_v2_avant_reserve_da.blend"
    backup.parent.mkdir(parents=True, exist_ok=True)
    if not backup.exists():
        shutil.copy2(source, backup)
    report = apply()
    write_report(report)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    exported = C.export(niveau="hypermarche")
    if not exported.get("ok"):
        raise RuntimeError(exported)
    print("[store-reserve-da] " + json.dumps({key: report[key] for key in
          ("sols", "murs", "plafond", "mobilier")} | {"export": exported}))


if __name__ == "__main__":
    main(inspect="--inspect" in sys.argv)
