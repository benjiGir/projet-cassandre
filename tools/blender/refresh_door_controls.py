"""Refonte locale des commandes de porte et du secret de la cafétéria.

    cassandre_cli.py -- rework_accesses preview=/tmp/acces.blend
"""
from pathlib import Path
import fnmatch
import hashlib
import json
import shutil
import sys
import tempfile

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/blender"))
sys.path.insert(0, str(ROOT / "tools/level_v2"))
import cassandre as C
import lib_helpers as H
import lib_door_controls as DC
import build_blockout as bo
import plan_de_masse as plan
from espaces import coque, portes, annexes

SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"


def remove(patterns):
    for obj in list(bpy.context.scene.objects):
        if any(fnmatch.fnmatchcase(obj.name, pattern) for pattern in patterns):
            bpy.data.objects.remove(obj, do_unlink=True)


def rework_scene():
    props, logic, col, shell = [bpy.data.collections[n] for n in ("PROPS", "LOGIC", "COL", "SHELL")]
    original = set(bpy.context.scene.objects)
    controls = []
    for name, front in (("use_door_argent", "-y"), ("use_door_or", "-y"),
                        ("use_door_exit", "-y"), ("use_coupe_feu", "+x"),
                        ("use_chambre_froide_secours", "-x")):
        old = bpy.data.objects[name]
        center, extras = tuple(old.location), dict(old.items())
        collections = list(old.users_collection)
        bpy.data.objects.remove(old, do_unlink=True)
        obj = DC.control(name, center, front, collections[0], card=extras.get("requires"),
                         target=extras["target"], message=extras.get("message"))
        for collection in collections[1:]:
            collection.objects.link(obj)
        controls.append(name)
    remove(("cf_bouton_secours", "cf_bouton_legende", "door_secret_vmc", "use_grille_vmc",
            "*ca_dist_vmc*", "*caisse_acces_secret3*", "ca_bouche_cadre", "ca_secret_traces",
            "mur_cafeteria_*", "col_box_mur_cafeteria_*", "*parapet_cafeteria*",
            "*mur_secret3*", "*sol_secret3", "plafond_secret3", "linteau_secret3_cafeteria",
            "linteau_cafeteria_secret3", "imposte_cafeteria_secret3", "imposte_secret3_cafeteria",
            "vmc_*", "col_box_vmc_*", "light_vmc_couvee"))
    spaces = {s.id: s for s in plan.ALL}
    cafeteria, secret = spaces["cafeteria"], spaces["secret3"]
    openings = bo.ouvertures_effectives()
    grey = {name: H.textured_material("mur_platre") for name in bo.MATERIAUX}
    cache = {}
    for space in (cafeteria, secret):
        materials = coque.materiaux_espace(space, grey, cache)
        bo.murs_espace(space, openings, materials, shell, col)
    materials = coque.materiaux_espace(secret, grey, cache)
    bo.boite("sol_secret3", (35, 20, -.25), (6, 4, .25), "sol", materials, shell, col)
    coque.plafond(secret, shell)
    opening = next(o for o in openings if frozenset({o.a, o.b}) == frozenset({"cafeteria", "secret3"}))
    portes.poser_linteaux([opening], grey, cache, shell)
    annexes.habiller_vmc(secret, grey, props, col, logic)
    vending = DC.secret_vending(props, logic)
    bpy.data.objects["use_soin_secret3_1"].location.z = .25
    bpy.data.objects["secret_3_aeration"].location.z = 1.5
    # Uniquement les meshes remplacés : les couleurs cuites du reste du niveau restent intactes.
    for obj in set(bpy.context.scene.objects) - original:
        if obj.type != "MESH" or obj.name.startswith(("col_", "secret_")):
            continue
        for attribute in list(obj.data.color_attributes):
            obj.data.color_attributes.remove(attribute)
        colors = obj.data.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
        obj.data.color_attributes.active_color = colors
        obj.data.color_attributes.render_color_index = 0
        for datum in colors.data:
            datum.color = (.7, .7, .7, 1)
    bpy.context.view_layer.update()
    return {"controls": controls, "secret": vending.name, "clearance": [1.5, 2.25]}


def captures():
    door = bpy.data.objects["door_secret_vmc"]
    closed = C.shot((38, 15, 0), nom="cafeteria_secret_ferme")
    initial_x = door.location.x
    try:
        door.location.x += 1.8
        bpy.context.view_layer.update()
        opened = C.shot((36.5, 17, 0), nom="cafeteria_secret_ouvert")
    finally:
        door.location.x = initial_x
        bpy.context.view_layer.update()
    controls = C.sheet([(2.5, 93.75, 0), (6.5, 137.75, 0), (-35.5, 163.75, 0), (-41.75, 86.5, 90)],
                       taille=(480, 360), nom="commandes_portes")
    return {"closed": closed["png"], "open": opened["png"], "controls": controls["png"]}


def main():
    if Path(bpy.data.filepath).resolve() != SOURCE:
        raise RuntimeError("Ouvrir niveau_v2.blend avant la refonte des accès")
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    preview = Path(args[args.index("--preview") + 1]).resolve() if "--preview" in args else None
    if preview and (preview in (SOURCE, EXPORT) or preview.with_suffix(".glb") in (SOURCE, EXPORT)):
        raise RuntimeError("L'aperçu doit être distinct du niveau livré")
    hashes = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in (SOURCE, EXPORT)}
    backup = Path(tempfile.mkdtemp(prefix="door-controls-backup-"))
    for path in (SOURCE, EXPORT):
        shutil.copy2(path, backup / path.name)
    report = rework_scene()
    library = bpy.context.view_layer.layer_collection.children.get("_LIB")
    if library:
        library.exclude = True
    report["captures"] = captures()
    if any(hashlib.sha256(path.read_bytes()).hexdigest() != value for path, value in hashes.items()):
        raise RuntimeError("Le niveau a changé pendant la préparation ; sauvegarde annulée")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
    export = C.export(out=preview.with_suffix(".glb") if preview else EXPORT)
    print("ACCESS_EXPORT=" + C.as_json(export), flush=True)
    if not export.get("ok"):
        raise RuntimeError("Export refusé ; sauvegarde disponible dans " + str(backup))
    report.update(backup=str(backup), preview=str(preview) if preview else None)
    print("ACCESS_RESULT=" + json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
