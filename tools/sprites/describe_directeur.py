"""Mesure les deux formes peintes du Directeur, sans retoucher les originaux.

Usage : python3 tools/sprites/describe_directeur.py
"""

import json
from pathlib import Path
import shutil

from describe_painted import describe_sheet

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets_src/directeur_sprites"
OUTPUT = ROOT / "public/assets/sprites"
FORMS = {"humain": "directeur.png", "revele": "directeur_revele.png"}


def main():
    layouts = {form: describe_sheet(SOURCE / filename, rows=10, resting_height=2.05,
                                    corpse_row=8, fixed_rest_anchor=True,
                                    ignore_edge_fragments=True, isolated_sprites=True)
               for form, filename in FORMS.items()}
    data = {"personnage": "directeur", "source": "assets_src/directeur_sprites/generation.json",
            "cellWidth": 128, "cellHeight": 154, "columns": 8, "rows": 10,
            "pixelsPerMeter": layouts["humain"]["pixelsPerMeter"], "feetFromBottom": 0,
            "atlases": FORMS, "layouts": layouts,
            "animations": {
                "idle": {"row": 0, "frames": 1},
                "alert": {"row": 1, "frames": 1},
                "chase": {"row": 2, "frames": 2, "metersPerCycle": 2.8},
                "aim": {"row": 4, "frames": 1},
                "fire": {"row": 5, "frames": 1, "duration": .12},
                "stagger": {"row": 6, "frames": 1},
                "death": {"row": 7, "frames": 3}}}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for filename in FORMS.values():
        shutil.copy2(SOURCE / filename, OUTPUT / filename)
    (OUTPUT / "directeur.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print("Directeur : 80 cases par forme, hauteur au repos 2,05 m ; PNG copiés sans retouche.")


if __name__ == "__main__":
    main()
