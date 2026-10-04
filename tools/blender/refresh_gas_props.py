"""Bonbonnes de gaz explosives (lot B3 de PLAN_SUITE.md), posées localement via Cassandre.

    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- gas_props
    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- gas_props preview=/tmp/essai.blend

Une bonbonne est un `prop_*` de matière `gaz` : poussable comme les autres, et
sa casse est une explosion (`src/game/level/props/props.ts`). Elles sont
posées là où un combat a lieu, sur le chemin obligé, à portée de souffle d'un
point d'apparition de Costard — et seulement à partir des caisses, où le
joueur trouve le pistolet : avant, il n'a que le pied-de-biche. La recette se
rejoue sans dégât : elle retire d'abord les bonbonnes qu'elle pose.
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
import lib_helpers as H

SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"

# (nom, x, y, z du sol). Cotes relevées sur le niveau du 2026-10-03, chaque
# point vérifié libre de décor et posé sur la grille de 0,25 m. Deux ou trois bonbonnes à moins de 5 m l'une
# de l'autre font une réaction en chaîne (hub, réserve).
BONBONNES = (
    # Caisses : devant le passage vers l'allée centrale, près de cs3 et cs4.
    ("prop_gaz_caisses_1", -7.5, 42.0, 0.0),
    ("prop_gaz_caisses_2", 9.5, 42.0, 0.0),
    # Allée centrale : une paire, près de hb1.
    ("prop_gaz_hub_1", 2.0, 79.5, 0.0),
    ("prop_gaz_hub_2", 0.5, 81.0, 0.0),
    # Rayons : sur le chemin de la carte Argent, près de ry3.
    ("prop_gaz_rayons_1", -45.5, 63.5, 0.0),
    # Réserve, le plus gros combat : un trio entre rs3 et rs4, et une près de rs1 et de rs2.
    ("prop_gaz_reserve_1", 1.0, 119.0, 0.0),
    ("prop_gaz_reserve_2", 2.5, 119.5, 0.0),
    ("prop_gaz_reserve_3", 1.5, 120.75, 0.0),
    ("prop_gaz_reserve_4", -18.0, 108.75, 0.0),
    ("prop_gaz_reserve_5", 13.5, 111.0, 0.0),
    # Parking souterrain : près de so1, so2, et de so3 qui garde la carte Or.
    ("prop_gaz_souterrain_1", 43.5, 101.5, -6.0),
    ("prop_gaz_souterrain_2", 55.5, 105.5, -6.0),
    ("prop_gaz_souterrain_3", 64.5, 111.5, -6.0),
    # Bureaux : dans le couloir, près de bu2.
    ("prop_gaz_bureaux_1", -31.5, 149.0, 4.0),
    # Électroménager (détour) : près de el1.
    ("prop_gaz_electro_1", 19.0, 54.5, 0.0),
)

MASSE, PV = 18.0, 20.0

# La bonbonne : (rayon, z bas, z haut, couleur de palette). Rouge à bandeau
# jaune : le code couleur d'un objet qui explose, lisible à 640×360.
ROUGE, JAUNE, SOMBRE = "#d8231f", "#f2c230", "#222222"
PIECES = (
    (0.17, 0.00, 0.60, ROUGE),
    (0.18, 0.34, 0.44, JAUNE),   # bandeau, 1 cm devant la tôle : rien n'affleure
    (0.10, 0.60, 0.70, SOMBRE),  # collerette
    (0.04, 0.70, 0.76, SOMBRE),  # robinet
)
SEGMENTS = 8


def bonbonne(nom: str, x: float, y: float, z: float, coll) -> bpy.types.Object:
    """Un seul mesh, un seul matériau (`palette`), origine au sol au centre du fût."""
    bm = bmesh.new()
    layer = bm.loops.layers.uv.new("UVMap")
    for rayon, z0, z1, couleur in PIECES:
        piece = bmesh.new()
        bmesh.ops.create_cone(piece, cap_ends=True, cap_tris=False, segments=SEGMENTS,
                              radius1=rayon, radius2=rayon, depth=z1 - z0)
        bmesh.ops.translate(piece, verts=piece.verts, vec=(0.0, 0.0, (z0 + z1) / 2))
        piece.normal_update()
        piece_layer = piece.loops.layers.uv.new("UVMap")
        peindre = H._uv_aplat(couleur)
        for face in piece.faces:
            peindre(face, piece_layer)
        tmp = bpy.data.meshes.new("_tmp")
        piece.to_mesh(tmp)
        piece.free()
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    mesh = bpy.data.meshes.new(nom)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(nom, mesh)
    obj.data.materials.append(H.textured_material("palette"))
    obj.location = (x, y, z)
    obj["masse"] = MASSE
    obj["pv"] = PV
    obj["matiere"] = "gaz"
    coll.objects.link(obj)
    return obj


def poser(coll) -> list[str]:
    for nom, *_ in BONBONNES:
        ancien = bpy.data.objects.get(nom)
        if ancien:
            bpy.data.objects.remove(ancien, do_unlink=True)
    return [bonbonne(nom, x, y, z, coll).name for nom, x, y, z in BONBONNES]


def main():
    if Path(bpy.data.filepath).resolve() != SOURCE:
        raise RuntimeError("Ouvrir niveau_v2.blend pour poser ses bonbonnes")
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    preview = Path(args[args.index("--preview") + 1]).resolve() if "--preview" in args else None
    if preview and (preview in (SOURCE, EXPORT) or preview.with_suffix(".glb") in (SOURCE, EXPORT)):
        raise RuntimeError("L'aperçu doit être distinct du niveau livré")
    hashes = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in (SOURCE, EXPORT)}
    backup = Path(tempfile.mkdtemp(prefix="gas-props-backup-"))
    for path in (SOURCE, EXPORT):
        shutil.copy2(path, backup / path.name)
    print("GAS_BACKUP=" + str(backup), flush=True)

    poses = poser(bpy.data.collections["PROPS"])
    library = bpy.context.view_layer.layer_collection.children.get("_LIB")
    if library:
        library.exclude = True
    bpy.context.view_layer.update()

    if any(hashlib.sha256(p.read_bytes()).hexdigest() != old for p, old in hashes.items()):
        raise RuntimeError("La source a changé pendant la préparation ; sauvegarde annulée")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
    result = C.export(out=preview.with_suffix(".glb") if preview else EXPORT)
    print("GAS_EXPORT=" + C.as_json(result), flush=True)
    if not result.get("ok"):
        raise RuntimeError("Export refusé ; sauvegarde disponible dans " + str(backup))
    report = {"bonbonnes": poses, "backup": str(backup), "preview": str(preview) if preview else None}
    print("GAS_RESULT=" + json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
