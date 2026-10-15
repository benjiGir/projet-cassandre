"""C.restore_store_lighting() : restituer uniquement l’éclairage sauvegardé."""
import json
from pathlib import Path
import re

import bpy
import cassandre as C

ROOT = Path(__file__).resolve().parents[2]


def main():
    source = ROOT / "assets_src/blender/niveau_v2.blend"
    backup = ROOT / "renders/_cassandre/niveau_v2_avant_eclairage.blend"
    report_path = ROOT / "renders/reviews/magasin-eclairage/deploiement.json"
    if Path(bpy.data.filepath).resolve() != source or not backup.exists():
        raise ValueError("Ouvrir le magasin et conserver sa copie avant éclairage")
    fixtures = set(json.loads(report_path.read_text())["luminaires"])
    destinations = {o.name: o for o in bpy.context.scene.objects
                    if o.name.startswith("light_") or o.name in fixtures}
    with bpy.data.libraries.load(str(backup), link=False) as (available, imported):
        names = tuple(name for name in available.objects if name in destinations)
        if set(names) != set(destinations):
            raise ValueError("La sauvegarde ne contient pas tous les objets à restaurer")
        imported.objects = list(names)
    lights = restored = 0
    for name, original in zip(names, imported.objects):
        obj = destinations[name]
        if name.startswith("light_"):
            obj.location = original.location.copy()
            obj.rotation_euler = original.rotation_euler.copy()
            obj.scale = original.scale.copy()
            for key in ("color", "intensity", "distance", "decay"):
                obj[key] = original[key]
            if "store_light_origin_z" in obj:
                del obj["store_light_origin_z"]
            lights += 1
        else:
            if obj.data.users > 1:
                obj.data = obj.data.copy()
            obj.data.materials.clear()
            for mat in original.data.materials:
                base = re.sub(r"\.\d+$", "", mat.name)
                obj.data.materials.append(bpy.data.materials.get(base) or mat)
            for polygon, before in zip(obj.data.polygons, original.data.polygons):
                polygon.material_index = before.material_index
            restored += 1
        bpy.data.objects.remove(original, do_unlink=True)
    for mat in list(bpy.data.materials):
        if mat.name.startswith("store_lampe_") and mat.users == 0:
            bpy.data.materials.remove(mat)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    exported = C.export(niveau="hypermarche")
    if not exported.get("ok"):
        raise RuntimeError(exported)
    result = {"lampes_restaurees": lights, "luminaires_restaures": restored, "export": exported}
    (report_path.parent / "restauration.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print("[store-lighting-restored] " + json.dumps(result))


if __name__ == "__main__":
    main()
