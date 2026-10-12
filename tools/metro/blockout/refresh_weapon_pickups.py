"""Pose locale rejouable : pistolet de détresse et boîtes de fusées de N5.

    blender -b assets_src/blender/metro_blockout.blend -P tools/metro/blockout/refresh_weapon_pickups.py

Pose sur le `.blend` livré ce que `encounters.py` décrit (`WEAPONS`, entrées
`fusees` de `PICKUPS`), sans reconstruire tout le parcours : une reconstruction
complète (`C.metro_blockout()`) redonne le même résultat. Contrôle les appuis
et dégagements comme la construction, met `rencontres.json` à jour, puis
enregistre et exporte.

Code retour : 0 = posé et exporté, 1 = position refusée ou export en échec.
"""
import json
from pathlib import Path
import sys
from types import SimpleNamespace

import bpy

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools/blender"))
import cassandre as C
from tools.metro.blockout import encounters

BLEND = ROOT / "assets_src/blender/metro_blockout.blend"
GLB = ROOT / "public/assets/levels/metro_blockout.glb"
REPORT = ROOT / "renders/reviews/blockout-metro/rencontres.json"
# Un ramassage existant sert de gabarit : même boîte, même matière, même collection.
TEMPLATE = "use_metro_cartouches_depot"


def place(name, at, properties):
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    template = bpy.data.objects[TEMPLATE]
    obj = template.copy()
    obj.data = template.data.copy()
    for key in list(obj.keys()):
        del obj[key]
    for collection in template.users_collection:
        collection.objects.link(obj)
    x, y, z = at
    obj.location = (x, y, z + .16)
    obj.name = name
    for key, value in properties.items():
        obj[key] = value
    return obj


def main() -> int:
    if Path(bpy.data.filepath).resolve() != BLEND.resolve():
        print("[metro-armes] ouvrir assets_src/blender/metro_blockout.blend")
        return 1
    wanted = [("use_metro_" + name, at, {prop: amount}) for name, at, prop, amount in encounters.PICKUPS if prop == "fusees"]
    wanted += [(name, at, {}) for name, at in encounters.weapon_positions()]
    for name, at, properties in wanted:
        place(name, at, properties)
    bpy.context.view_layer.update()

    # Même contrôle que la construction ; il relit aussi les ramassages déjà posés.
    try:
        readings = encounters.inspect_positions(SimpleNamespace(col=bpy.data.collections["COL"]), [])
    except ValueError as error:
        print("[metro-armes] " + str(error).replace("\n", " | "))
        return 1

    report = json.loads(REPORT.read_text()) if REPORT.exists() else {"implantation": []}
    measured = {reading["nom"] for reading in readings}
    report["implantation"] = [r for r in report["implantation"] if r["nom"] not in measured] + readings
    report["ramassages"] = [{"nom": name, "pieds": at, "propriete": prop, "quantite": amount}
                            for name, at, prop, amount in encounters.PICKUPS]
    report["armes"] = [{"nom": name, "pieds": at} for name, at in encounters.weapon_positions()]
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")

    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    result = C.export(out=GLB, niveau="metro")
    print("[metro-armes] " + json.dumps({"poses": [name for name, _, _ in wanted], "export": result.get("ok"),
                                         "lignes": result.get("lines", [])[-4:]}, ensure_ascii=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
