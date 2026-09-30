"""Vues de contrôle du couloir par le pipeline de rendu Cassandre.

    blender -b /tmp/service.blend -P tools/blender/render_service_landmarks.py

Écrit les preuves documentaires, sans enregistrer la session de rendu.
"""
from pathlib import Path
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cassandre as C

OUT = Path(__file__).resolve().parents[2] / "docs/assets/agencement-etape-4-2026-09-30"
OUT.mkdir(exist_ok=True)
before = "--before" in sys.argv
for name, view in (
    ("approche_sud", (-40.5, 99, 0)),
    ("approche_nord", (-40, 129, 180)),
    ("maintenance", (-40, 111, 210)),
    ("sav", (-40, 122.8, 153)),
    ("couloir_dessus", "dessus:c_short_w"),
):
    if before and not name.startswith("approche_"):
        continue
    result = C.shot(view, mode="material", nom="service_" + name)
    shutil.copy2(result["png"], OUT / (name + ("_avant" if before else "") + ".png"))
    print("SERVICE_SHOT=" + C.as_json(result), flush=True)
