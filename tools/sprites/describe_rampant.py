"""Mesure le Rampant peint et recopie son atlas intact vers le runtime.

Usage : python3 tools/sprites/describe_rampant.py
"""

import json
from pathlib import Path
import shutil

from describe_painted import describe_sheet

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets_src/rampant_sprites/rampant.png"
OUTPUT = ROOT / "public/assets/sprites"


def main():
    layout = describe_sheet(SOURCE, rows=12, resting_height=1.2, corpse_row=9, fixed_rest_anchor=True)
    data = {"personnage": "rampant", "source": "assets_src/rampant_sprites/generation.json",
            "cellWidth": 128, "cellHeight": 128, "columns": 8, "rows": 12,
            "pixelsPerMeter": layout["pixelsPerMeter"], "feetFromBottom": 0,
            "atlases": {"humain": "rampant.png"}, "layouts": {"humain": layout},
            "animations": {
                "idle": {"row": 0, "frames": 1},
                "alert": {"row": 1, "frames": 1},
                "chase": {"row": 2, "frames": 4, "sequence": [2, 3, 4, 3], "metersPerCycle": 2.4},
                "aim": {"row": 5, "frames": 1},
                "fire": {"row": 6, "frames": 1, "duration": .18},
                "stagger": {"row": 7, "frames": 1},
                "death": {"row": 8, "frames": 4}}}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE, OUTPUT / "rampant.png")
    (OUTPUT / "rampant.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print("Rampant : 96 cases, hauteur au repos 1,2 m ; PNG copié sans retouche.")


if __name__ == "__main__":
    main()
