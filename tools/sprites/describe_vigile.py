"""Mesure le Vigile peint et recopie ses quatre carnations intactes vers le runtime.

Usage : python3 tools/sprites/describe_vigile.py
"""

import json
from pathlib import Path
import shutil

from describe_painted import describe_sheet

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets_src/vigile_sprites"
OUTPUT = ROOT / "public/assets/sprites"
SKINS = {"humain": "vigile.png", "clair": "vigile_clair.png",
         "mate": "vigile_mate.png", "fonce": "vigile_fonce.png"}


def main():
    layouts = {skin: describe_sheet(SOURCE / filename, rows=10, resting_height=2,
                                    corpse_row=8, fixed_rest_anchor=True, ignore_edge_fragments=True)
               for skin, filename in SKINS.items()}
    data = {"personnage": "vigile", "source": "assets_src/vigile_sprites/generation.json",
            "cellWidth": 128, "cellHeight": 154, "columns": 8, "rows": 10,
            "pixelsPerMeter": layouts["humain"]["pixelsPerMeter"], "feetFromBottom": 0,
            "atlases": SKINS, "layouts": layouts,
            "animations": {
                "idle": {"row": 0, "frames": 1},
                "alert": {"row": 1, "frames": 1},
                "chase": {"row": 2, "frames": 2, "metersPerCycle": 1.7},
                "aim": {"row": 4, "frames": 1},
                "fire": {"row": 5, "frames": 1, "duration": .2},
                "stagger": {"row": 6, "frames": 1},
                "death": {"row": 7, "frames": 3}}}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for filename in SKINS.values():
        shutil.copy2(SOURCE / filename, OUTPUT / filename)
    (OUTPUT / "vigile.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print("Vigile : 80 cases par carnation, hauteur au repos 2 m ; PNG copiés sans retouche.")


if __name__ == "__main__":
    main()
