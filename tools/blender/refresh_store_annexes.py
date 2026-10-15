"""C.art_direction_annexes() : planque du vigile et gaine de ventilation."""
import json
from pathlib import Path
import shutil
import sys

import bpy
from collections import Counter
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
import cassandre as C


def inventory():
    objects = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith("col_") or not obj.visible_get():
            continue
        center = sum((obj.matrix_world @ Vector(corner) for corner in obj.bound_box),Vector())/8
        if not (-36.2 <= center.x <= -27.8 and 127.8 <= center.y <= 132.2
                or 19.8 <= center.x <= 32.2 and 151.8 <= center.y <= 154.2):
            continue
        colors = Counter()
        if obj.data.uv_layers.active and any(slot.material and slot.material.name == "mat_palette" for slot in obj.material_slots):
            import lib_helpers as H
            for poly in obj.data.polygons:
                if obj.material_slots[poly.material_index].material.name != "mat_palette":
                    continue
                u,v = obj.data.uv_layers.active.data[poly.loop_indices[0]].uv
                swatch = min(7,max(0,int(u*8)))+8*min(7,max(0,7-int(v*8)))
                colors[H.PALETTE[swatch]] += round(poly.area,4)
        objects.append({"couleurs":dict(colors),"nom":obj.name,"matieres":[slot.material.name if slot.material else ""
                        for slot in obj.material_slots],"centre":[round(v,2) for v in center]})
    path = ROOT/"renders/reviews/annexes-da/inventaire.json"
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps({"objets":sorted(objects,key=lambda obj:obj["nom"])},
                               ensure_ascii=False,indent=2)+"\n")
    return {"objets":len(objects),"inventaire":str(path.relative_to(ROOT))}


def main(inspect=False):
    source = ROOT/"assets_src/blender/niveau_v2.blend"
    if Path(bpy.data.filepath).resolve() != source:
        raise ValueError("Ouvrir niveau_v2.blend avant la passe des annexes")
    if inspect:
        print("[store-annexes-da] "+json.dumps(inventory()))
        return
    from tools.art_direction.store_annexes import apply, write_report
    backup = ROOT/"renders/_cassandre/niveau_v2_avant_annexes_da.blend"
    backup.parent.mkdir(parents=True,exist_ok=True)
    if not backup.exists():
        shutil.copy2(source,backup)
    report = apply()
    write_report(report)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    exported = C.export(niveau="hypermarche")
    if not exported.get("ok"):
        raise RuntimeError(exported)
    print("[store-annexes-da] "+json.dumps({key:report[key] for key in
          ("sols","murs","plafonds","mobilier")} | {"export":exported}))


if __name__ == "__main__":
    main(inspect="--inspect" in sys.argv)
