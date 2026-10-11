"""C.art_direction_workshops() : textures du fournil, du labo et du SAV."""
import json
from pathlib import Path
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
        fournil = 7.9 <= center.x <= 20.1 and 139.8 <= center.y <= 156.2
        labo = -60.2 <= center.x <= -43.8 and 83.8 <= center.y <= 98.2
        sav = 19.8 <= center.x <= 30.2 and 111.8 <= center.y <= 132.2
        if not (fournil or labo or sav):
            continue
        objects.append({"nom": obj.name, "matieres": [slot.material.name if slot.material else ""
                        for slot in obj.material_slots], "centre": [round(value, 2) for value in center]})
    path = ROOT / "docs/assets/ateliers-da/inventaire.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"objets": sorted(objects, key=lambda item: item["nom"])},
                               ensure_ascii=False, indent=2) + "\n")
    return {"objets": len(objects), "inventaire": str(path.relative_to(ROOT))}


def main(inspect=False):
    source = ROOT / "assets_src/blender/niveau_v2.blend"
    if Path(bpy.data.filepath).resolve() != source:
        raise ValueError("Ouvrir niveau_v2.blend avant cette retouche")
    if inspect:
        print("[store-workshops-da] " + json.dumps(inventory()))
        return
    from tools.art_direction.store_workshops import apply, write_report
    backup = ROOT / "renders/_cassandre/niveau_v2_avant_ateliers_da.blend"
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
    print("[store-workshops-da] " + json.dumps({key: report[key] for key in
          ("sols", "murs", "plafonds", "mobilier")} | {"export": exported}))


if __name__ == "__main__":
    main(inspect="--inspect" in sys.argv)
