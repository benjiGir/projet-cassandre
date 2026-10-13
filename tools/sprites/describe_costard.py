"""Mesure les sprites peints du Costard sans retoucher les originaux.

Usage : python3 tools/sprites/describe_costard.py
"""

import json
from pathlib import Path
import shutil
from describe_painted import describe_sheet

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets_src/costard_sprites"
OUTPUT = ROOT / "public/assets/sprites"
SKINS = {"humain": "costard.png", "clair": "costard_clair.png",
         "mate": "costard_mate.png", "fonce": "costard_fonce.png"}


def describe(path):
    return describe_sheet(path, rows=12, resting_height=1.8, corpse_row=10)


def main():
    layouts = {skin: describe(SOURCE / filename) for skin, filename in SKINS.items()}
    data = {"personnage": "costard", "source": "assets_src/costard_sprites/generation.json",
            "cellWidth": 128, "cellHeight": 128, "columns": 8, "rows": 12,
            "pixelsPerMeter": layouts["humain"]["pixelsPerMeter"], "feetFromBottom": 0,
            "atlases": SKINS, "layouts": layouts,
            "animations": {
                "idle": {"row": 0, "frames": 1},
                "alert": {"row": 1, "frames": 1},
                "chase": {"row": 2, "frames": 4, "sequence": [2, 3, 4, 3], "metersPerCycle": 2.8},
                "aim": {"row": 5, "frames": 1},
                "fire": {"row": 6, "frames": 1, "duration": .12},
                "stagger": {"row": 7, "frames": 1},
                "death": {"row": 8, "frames": 4}}}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for filename in SKINS.values():
        shutil.copy2(SOURCE / filename, OUTPUT / filename)
    (OUTPUT / "costard.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print("Costard : 96 cases par peau, quatre peaux ; PNG copiés sans retouche.")


if __name__ == "__main__":
    main()
