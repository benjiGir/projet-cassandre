"""Bornes de perks (lot B1 de PLAN_SUITE.md), posées localement via Cassandre.

    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- perk_kiosks
    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- perk_kiosks preview=/tmp/essai.blend

Une borne est un `use_*` VISIBLE qui porte `perk` (un identifiant de
`src/game/player/perks.ts`) et `prix` (euros). Le même petit terminal partout,
pour qu'il se reconnaisse d'un coup d'œil, accroché à du mobilier déjà en
place. La recette se rejoue sans dégât : elle retire d'abord les bornes
qu'elle pose.
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys
import tempfile

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/blender"))
import cassandre as C
import lib_helpers as H

SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"

# (nom, perk, prix en euros, centre de la face ARRIÈRE (x, y, z), côté vers
# lequel la borne regarde). Prix croissants le long du parcours ; ce sont des
# valeurs de départ, que le lot B7 règle. Cotes relevées sur le niveau du
# 2026-10-03.
BORNES = (
    # Galerie : debout sur le comptoir du kiosque « Desimlock », au coin de
    # l'allée centrale, face à l'entrée.
    ("use_borne_galerie", "perche", 5, (4.62, 6.16, 1.31), "-y"),
    # Réserve : sur le montant sud du premier rack à droite en entrant par le sas Argent.
    ("use_borne_reserve", "premium", 20, (4.22, 100.0, 1.35), "-y"),
    # Couloir du personnel : sur le monnayeur du distributeur de café.
    ("use_borne_personnel", "boisson", 50, (18.16, 132.98, 1.20), "+y"),
    # Bureaux, salle de pause : sur le monnayeur du distributeur de chips.
    ("use_borne_bureaux", "gilet", 100, (7.02, 159.66, 5.20), "-x"),
)

# Le terminal, dans son repère : `u` le long de la façade, `d` vers le joueur
# (0 = la surface d'accroche), `z` autour du centre. Rien n'affleure : chaque
# pièce dépasse la précédente d'au moins 1 cm.
BOITIER, ACCENT, ECRAN, CLAVIER, BOUTON = "#2f3541", "#c2307a", "#f2c230", "#111014", "#2e9e44"
PIECES = (
    # (u0, u1, d0, d1, z0, z1, couleur de palette)
    (-0.15, 0.15, 0.00, 0.09, -0.25, 0.25, BOITIER),
    # Fronton et son bandeau : la couleur qui signe une borne, lisible de loin.
    (-0.20, 0.20, 0.00, 0.11, 0.25, 0.43, ACCENT),
    (-0.14, 0.14, 0.11, 0.12, 0.30, 0.38, ECRAN),
    (-0.11, 0.11, 0.09, 0.10, 0.03, 0.21, ECRAN),
    (-0.11, 0.04, 0.09, 0.10, -0.19, -0.03, CLAVIER),
    (0.06, 0.11, 0.09, 0.11, -0.14, -0.08, BOUTON),
)

# Vers le joueur : (axe de `u`, axe de `d`) en monde.
REPERES = {
    "-y": (Vector((1, 0, 0)), Vector((0, -1, 0))),
    "+y": (Vector((-1, 0, 0)), Vector((0, 1, 0))),
    "-x": (Vector((0, -1, 0)), Vector((-1, 0, 0))),
    "+x": (Vector((0, 1, 0)), Vector((1, 0, 0))),
}


def _pieces_monde(centre, face: str):
    u, d = REPERES[face]
    c = Vector(centre)
    for u0, u1, d0, d1, z0, z1, couleur in PIECES:
        a = c + u * u0 + d * d0 + Vector((0, 0, z0))
        b = c + u * u1 + d * d1 + Vector((0, 0, z1))
        bornes = tuple(min(a[i], b[i]) for i in range(3)) + tuple(max(a[i], b[i]) for i in range(3))
        yield bornes, f"aplat:{couleur}", face


def _centrer_origine(obj) -> None:
    """Origine au centre du volume : la portée d'usage se mesure depuis elle."""
    coins = [Vector(c) for c in obj.bound_box]
    centre = sum(coins, Vector()) / 8
    for sommet in obj.data.vertices:
        sommet.co -= centre
    obj.location = centre


def poser(coll) -> list[dict]:
    for nom, *_ in BORNES:
        ancien = bpy.data.objects.get(nom)
        if ancien:
            bpy.data.objects.remove(ancien, do_unlink=True)
    poses = []
    for nom, perk, prix, centre, face in BORNES:
        obj = H.boxes(nom, list(_pieces_monde(centre, face)), "palette", coll, subdiv=1e9)
        _centrer_origine(obj)
        obj["perk"] = perk
        obj["prix"] = prix
        poses.append({"name": nom, "perk": perk, "prix": prix, "pos": [round(v, 2) for v in obj.location]})
    return poses


def main():
    if Path(bpy.data.filepath).resolve() != SOURCE:
        raise RuntimeError("Ouvrir niveau_v2.blend pour poser ses bornes")
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    preview = Path(args[args.index("--preview") + 1]).resolve() if "--preview" in args else None
    if preview and (preview in (SOURCE, EXPORT) or preview.with_suffix(".glb") in (SOURCE, EXPORT)):
        raise RuntimeError("L'aperçu doit être distinct du niveau livré")
    hashes = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in (SOURCE, EXPORT)}
    backup = Path(tempfile.mkdtemp(prefix="perk-kiosks-backup-"))
    for path in (SOURCE, EXPORT):
        shutil.copy2(path, backup / path.name)
    print("KIOSKS_BACKUP=" + str(backup), flush=True)

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
    print("KIOSKS_EXPORT=" + C.as_json(result), flush=True)
    if not result.get("ok"):
        raise RuntimeError("Export refusé ; sauvegarde disponible dans " + str(backup))
    report = {"bornes": poses, "backup": str(backup), "preview": str(preview) if preview else None}
    print("KIOSKS_RESULT=" + json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
