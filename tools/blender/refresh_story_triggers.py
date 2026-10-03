"""Volumes déclencheurs du script de niveau (ADR 0037), posés localement via Cassandre.

    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- story_triggers
    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- story_triggers preview=/tmp/essai.blend

Chaque `trig_*` est une boîte de la collection LOGIC, invisible en jeu, qui
porte `evenement` (un scénario de `src/game/session/progression/levelEvents.ts`)
ou `replique` (une réplique de lieu de `heroLines.ts`). La recette se rejoue
sans dégât : elle retire d'abord les `trig_*` qu'elle pose.
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys
import tempfile

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/blender"))
import cassandre as C

SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"

# (nom, propriété, valeur, boîte Blender (x0, y0, z0, x1, y1, z1)).
# Cotes relevées sur le niveau du 2026-10-03 : cloisons de l'étage à
# x = -21, -12 et -3, portes des bureaux à y = 154,5, plateforme de quai à
# z = 3, armoires surgelées contre le mur ouest des rayons.
TRIGGERS = (
    ("trig_annonce_caisses", "evenement", "annonce_caisses", (-6.0, 16.0, 0.0, 6.0, 20.0, 3.0)),
    ("trig_ecrans_sav", "evenement", "ecrans_sav", (21.0, 113.0, 0.0, 29.0, 131.0, 3.0)),
    ("trig_livraison_quai", "evenement", "livraison_quai", (-17.0, 121.0, 3.0, -6.0, 131.25, 6.0)),
    ("trig_interphone_direction", "evenement", "interphone_direction", (1.0, 150.25, 4.0, 8.0, 154.25, 6.75)),
    ("trig_lieu_surgeles", "replique", "surgeles", (-52.0, 69.0, 0.0, -47.0, 83.0, 2.0)),
    ("trig_lieu_bureau_securite", "replique", "bureau_securite", (-29.5, 155.25, 4.0, -21.5, 165.5, 6.75)),
    ("trig_lieu_comptabilite", "replique", "comptabilite", (-20.5, 155.25, 4.0, -12.5, 165.5, 6.75)),
    ("trig_lieu_ressources_humaines", "replique", "ressources_humaines", (-11.5, 155.25, 4.0, -3.5, 165.5, 6.75)),
    ("trig_lieu_salle_pause", "replique", "salle_pause", (-2.25, 155.25, 4.0, 7.5, 165.5, 6.75)),
)


def poser(logic) -> list[str]:
    for nom, *_ in TRIGGERS:
        ancien = bpy.data.objects.get(nom)
        if ancien:
            bpy.data.objects.remove(ancien, do_unlink=True)
    for nom, cle, valeur, (x0, y0, z0, x1, y1, z1) in TRIGGERS:
        mesh = bpy.data.meshes.new(nom)
        bm = bmesh.new()
        # Une boîte à 8 sommets, ce qu'exigent le validateur et le loader pour
        # un `trig_*`. Origine au coin bas, sur la grille de 0,25 m, et cotes
        # dans le maillage : l'échelle de l'objet reste à 1.
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.translate(bm, vec=(0.5, 0.5, 0.5), verts=bm.verts)
        bmesh.ops.scale(bm, vec=(x1 - x0, y1 - y0, z1 - z0), verts=bm.verts)
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new(nom, mesh)
        obj.location = (x0, y0, z0)
        obj[cle] = valeur
        obj.display_type = "WIRE"
        logic.objects.link(obj)
    return [nom for nom, *_ in TRIGGERS]


def main():
    if Path(bpy.data.filepath).resolve() != SOURCE:
        raise RuntimeError("Ouvrir niveau_v2.blend pour poser ses déclencheurs")
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    preview = Path(args[args.index("--preview") + 1]).resolve() if "--preview" in args else None
    if preview and (preview in (SOURCE, EXPORT) or preview.with_suffix(".glb") in (SOURCE, EXPORT)):
        raise RuntimeError("L'aperçu doit être distinct du niveau livré")
    hashes = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in (SOURCE, EXPORT)}
    backup = Path(tempfile.mkdtemp(prefix="story-triggers-backup-"))
    for path in (SOURCE, EXPORT):
        shutil.copy2(path, backup / path.name)
    print("TRIGGERS_BACKUP=" + str(backup), flush=True)

    poses = poser(bpy.data.collections["LOGIC"])
    library = bpy.context.view_layer.layer_collection.children.get("_LIB")
    if library:
        library.exclude = True
    bpy.context.view_layer.update()

    if any(hashlib.sha256(p.read_bytes()).hexdigest() != old for p, old in hashes.items()):
        raise RuntimeError("La source a changé pendant la préparation ; sauvegarde annulée")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
    result = C.export(out=preview.with_suffix(".glb") if preview else EXPORT)
    print("TRIGGERS_EXPORT=" + C.as_json(result), flush=True)
    if not result.get("ok"):
        raise RuntimeError("Export refusé ; sauvegarde disponible dans " + str(backup))
    report = {"triggers": poses, "backup": str(backup), "preview": str(preview) if preview else None}
    print("TRIGGERS_RESULT=" + json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
