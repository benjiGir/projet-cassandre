"""Ajoute le pied au modèle des armes sans reconstruire les armes existantes."""
from pathlib import Path
import hashlib
import json
import shutil
import sys
import tempfile

import bpy

from build_weapons import rendre_vues, exporter
from weapons.kick import construire_coup_de_pied

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets_src/blender/armes.blend"
EXPORT = ROOT / "public/assets/weapons/armes.glb"


def main():
    if Path(bpy.data.filepath).resolve() != SOURCE:
        raise RuntimeError("Ouvrir armes.blend avant d'ajouter le coup de pied")
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    preview = Path(args[args.index("--preview") + 1]).resolve() if "--preview" in args else None
    if preview and (preview in (SOURCE, EXPORT) or preview.with_suffix(".glb") in (SOURCE, EXPORT)):
        raise RuntimeError("L'aperçu doit être distinct des armes livrées")
    hashes = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in (SOURCE, EXPORT)}
    backup = Path(tempfile.mkdtemp(prefix="weapon-kick-backup-"))
    for path in (SOURCE, EXPORT):
        shutil.copy2(path, backup / path.name)
    old = bpy.data.objects.get("vm_kick")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    kick = construire_coup_de_pied()
    for collection in list(kick.users_collection):
        collection.objects.unlink(kick)
    bpy.data.collections["VUE_SUBJECTIVE"].objects.link(kick)
    for obj in bpy.context.scene.objects:
        obj.hide_set(False)
    captures = ROOT / "renders/coup_de_pied"
    rendre_vues(bpy.context.scene, {"extension": {"vm_kick"}}, str(captures))
    weapons = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.name.startswith(("vm_", "world_"))]
    if len(weapons) != 8:
        raise RuntimeError(f"Attendu 8 meshes d'armes avec le pied : {len(weapons)}")
    if any(hashlib.sha256(path.read_bytes()).hexdigest() != value for path, value in hashes.items()):
        raise RuntimeError("Les armes ont changé pendant la préparation")
    for obj in weapons:
        obj.hide_render = False
    exporter(str(preview.with_suffix(".glb") if preview else EXPORT), weapons)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
    kick.data.calc_loop_triangles()
    print("KICK_RESULT=" + json.dumps(dict(mesh=kick.name, triangles=len(kick.data.loop_triangles),
                                           capture=str(captures / "extension.png"), backup=str(backup))), flush=True)


if __name__ == "__main__":
    main()
