"""C.rework_restrooms() : cabines et équipements, lampes conservées."""
import fnmatch
import json
from pathlib import Path
import shutil
import sys

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
sys.path.insert(0,str(ROOT / "tools/blender"))
import cassandre as C
import lib_restrooms as R
from tools.art_direction.store_restrooms import apply


def main():
    source = ROOT / "assets_src/blender/niveau_v2.blend"
    if Path(bpy.data.filepath).resolve() != source:
        raise ValueError("Ouvrir niveau_v2.blend avant de reprendre les sanitaires")
    backup = ROOT / "renders/_cassandre/niveau_v2_avant_sanitaires_assets.blend"
    if not backup.exists():
        shutil.copy2(source,backup)
    original = set(bpy.context.scene.objects)
    patterns = ("wc_*","door_wc_cabine_*","col_box_wc*","mob_k_*_wc_*","sanitaire_cuvette*","sanitaire_urinoir*")
    removed = []
    for obj in list(bpy.context.scene.objects):
        if any(fnmatch.fnmatchcase(obj.name,p) for p in patterns):
            removed.append(obj.name)
            bpy.data.objects.remove(obj,do_unlink=True)
    report = R.build(bpy.data.collections["PROPS"],bpy.data.collections["COL"])
    for obj in set(bpy.context.scene.objects)-original:
        if obj.type != "MESH" or obj.name.startswith("col_"):
            continue
        colors = obj.data.color_attributes.new(name="Col",type="FLOAT_COLOR",domain="CORNER")
        obj.data.color_attributes.active_color = colors
        obj.data.color_attributes.render_color_index = 0
        ceramic = obj.name.startswith(("sanitaire_", "wc_lavabo", "wc_papier"))
        shade = 1.0 if ceramic else .85
        for item in colors.data:
            item.color = (shade,shade,shade,1)
    bpy.context.view_layer.update()
    report.update(retire=removed,matieres=apply())
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    report["export"] = C.export(niveau="hypermarche")
    if not report["export"].get("ok"):
        raise RuntimeError(report["export"])
    path = ROOT / "renders/reviews/sanitaires-assets/deploiement.json"
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    print("[restroom-assets] "+json.dumps({k:v for k,v in report.items() if k not in ("retire","matieres")}))


if __name__ == "__main__":
    main()
