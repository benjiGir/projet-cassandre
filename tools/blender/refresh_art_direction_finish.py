"""C.art_direction_finish() : matières restantes du magasin et du quartier."""
from collections import Counter
import json
from pathlib import Path
import shutil
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
import cassandre as C


def inventory(level):
    objects, totals = [], Counter()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.visible_get() or obj.name.startswith(C.INVISIBLES):
            continue
        points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        mats = [slot.material.name if slot.material else "" for slot in obj.material_slots]
        for mat in mats:
            totals[mat] += 1
        colors = Counter()
        if obj.data.uv_layers.active and "mat_palette" in mats:
            import lib_helpers as H
            for poly in obj.data.polygons:
                if mats[poly.material_index] != "mat_palette":
                    continue
                u,v = obj.data.uv_layers.active.data[poly.loop_indices[0]].uv
                swatch = min(7,max(0,int(u*8)))+8*min(7,max(0,7-int(v*8)))
                colors[H.PALETTE[swatch]] += round(poly.area,4)
        objects.append({"nom":obj.name,"matieres":mats,"couleurs":dict(colors),
                        "attributs_couleur":[attr.name for attr in obj.data.color_attributes],
                        "couleur_active":obj.data.color_attributes.active_color.name if obj.data.color_attributes.active_color else None,
                        "kit":obj.get("kit",""),"parent":obj.parent.name if obj.parent else "",
                        "bornes":[[round(min(v[i] for v in points),3) for i in range(3)],
                                  [round(max(v[i] for v in points),3) for i in range(3)]]})
    path = ROOT/f"docs/assets/finition-da/inventaire-{level}.json"
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps({"objets":sorted(objects,key=lambda obj:obj["nom"]),
                               "matieres":dict(totals.most_common())},ensure_ascii=False,indent=2)+"\n")
    return {"objets":len(objects),"inventaire":str(path.relative_to(ROOT))}


def main():
    level = "metro" if "--metro" in sys.argv else "magasin"
    source = ROOT/("assets_src/blender/metro_blockout.blend" if level == "metro"
                   else "assets_src/blender/niveau_v2.blend")
    if Path(bpy.data.filepath).resolve() != source:
        raise ValueError(f"Ouvrir {source.name} pour cette passe")
    if "--inspect" in sys.argv:
        print("[art-direction-finish] "+json.dumps(inventory(level)))
        return
    if level == "metro":
        from tools.art_direction.metro_exteriors import apply, write_report
    else:
        from tools.art_direction.store_finish import apply, write_report
    backup = ROOT/f"renders/_cassandre/{source.stem}_avant_finition_da.blend"
    backup.parent.mkdir(parents=True,exist_ok=True)
    if not backup.exists():
        shutil.copy2(source,backup)
    report = apply()
    write_report(report)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    target = ROOT/("public/assets/levels/metro_blockout.glb" if level == "metro"
                   else "public/assets/levels/niveau_v2.glb")
    exported = C.export(out=target,niveau="metro" if level == "metro" else "hypermarche")
    if not exported.get("ok"):
        raise RuntimeError(exported)
    print("[art-direction-finish] "+json.dumps({key:report[key] for key in ("zone","objets_modifies")} | {"export":exported}))


if __name__ == "__main__":
    main()
