"""C.art_direction_restrooms() : matières locales des sanitaires."""
import json
from pathlib import Path
import shutil
import sys

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tools.art_direction.store_restrooms import apply, write_report
import cassandre as C


def main():
    source = ROOT / "assets_src/blender/niveau_v2.blend"
    if Path(bpy.data.filepath).resolve() != source:
        raise ValueError("Ouvrir niveau_v2.blend avant cette retouche")
    backup = ROOT / "renders/_cassandre/niveau_v2_avant_sanitaires_da.blend"
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
    print("[store-restrooms-da] " + json.dumps({key: report[key] for key in
          ("murs", "plafond", "cabines", "metal")} | {"export": exported}))


if __name__ == "__main__":
    main()
