"""Vues reproductibles des compositions via Cassandre, sans sauver la scène.

    blender -b /tmp/public.blend -P tools/blender/render_public_compositions.py
    blender -b niveau_v2.blend -P tools/blender/render_public_compositions.py -- --before
"""
from pathlib import Path
import shutil
import sys

sys.path.insert(0,str(Path(__file__).resolve().parent))
import cassandre as C

OUT=Path(__file__).resolve().parents[2]/"docs/assets/agencement-etape-5-2026-09-30"
OUT.mkdir(exist_ok=True)
before="--before" in sys.argv
views=(
    ("galerie_presse",(-23,2.8,20)),
    ("galerie_reparation",(9.0,4.0,0)),
    ("cafeteria_repas",(38.75,8.2,0)),
    ("cafeteria_pause",(44,13.0,0)),
    ("rayons_cola",(-39.875,48.85,0)),
    ("rayons_reassort",(-32.35,59.6,0)),
    ("galerie_dessus","dessus:galerie"),
    ("cafeteria_dessus","dessus:cafeteria"),
    ("rayons_dessus","dessus:rayons"),
)
for name,view in views:
    if before and name.endswith("dessus"):continue
    name+= "_avant" if before else ""
    result=C.shot(view,mode="solid",nom="compositions_"+name)
    shutil.copy2(result["png"],OUT/(name+".png"))
    print("PUBLIC_SHOT="+C.as_json(result),flush=True)
if not before:
    for tag,object_name,motif in (
        ("presse","comp_ga_presse_support","comp_ga_presse*"),
        ("repas","comp_ca_repas_plateau","comp_ca_repas*"),
    ):
        for mode in ("solid","silhouette"):
            name=tag+"_"+mode
            result=C.shot(object_name,mode=mode,taille=(640,640),isoler=motif,nom="compositions_"+name)
            shutil.copy2(result["png"],OUT/(name+".png"))
            print("PUBLIC_SHOT="+C.as_json(result),flush=True)
