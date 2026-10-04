"""Rencontres du niveau (lot B6 de PLAN_SUITE.md), posées localement via Cassandre.

    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- encounters
    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- encounters preview=/tmp/essai.blend

Trois rencontres, jouées par le script de niveau (ADR 0037,
`src/game/session/progression/levelEvents.ts`) :

- **l'arène de la réserve** : le joueur franchit une bande au milieu de la
  réserve, les quatre issues se ferment, deux vagues se réveillent, puis tout
  se rouvre. La sortie nord n'avait pas de porte : la recette y pose un rideau
  (`door_reserve_nord`), ouvert au chargement ;
- **la meute du parking souterrain** : deux Rampants au pied de l'escalier,
  puis la meute quand le joueur atteint la carte Or ;
- **le Vigile de l'escalier des bureaux** : réveillé avec la meute, il attend
  le joueur devant la porte Or.

Un groupe se pose à sa taille la plus dure : les difficultés plus basses n'en
réveillent qu'une part, les premiers par ordre de nom
(`progression/difficulty.ts`). La recette se rejoue sans dégât : elle retire
d'abord ce qu'elle pose.
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys
import tempfile

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/blender"))
import cassandre as C

SOURCE = ROOT / "assets_src/blender/niveau_v2.blend"
EXPORT = ROOT / "public/assets/levels/niveau_v2.glb"

# Cotes relevées sur le niveau du 2026-10-04. Réserve : x de -24 à 20, y de 96
# à 132, rayonnages à x = -14,5 et 4,3. Parking souterrain : z = -6, escalier
# piéton au nord-ouest (x de 38 à 46, y = 124), carte Or en (67 ; 117,5).

# Costards déjà posés, qui passent dans une vague de l'arène.
GROUPES_EXISTANTS = {
    "spawn_suit_rs3": "arene_1",
    "spawn_suit_rs4": "arene_1",
    "spawn_suit_rs7": "arene_1",
    "spawn_suit_rs5": "arene_2",
    "spawn_suit_rs6": "arene_2",
}

# Costards du parking que les Rampants remplacent : il n'en reste que deux, près de la carte Or.
RETIRES = ("spawn_suit_so1", "spawn_suit_so2", "spawn_suit_so4", "spawn_suit_so5")

# (nom, groupe, x, y, z du sol). L'ordre des noms dans un groupe décide de qui
# reste en difficulté basse.
SPAWNS = (
    # Arène, première vague : un Costard de plus, côté SAV.
    ("spawn_suit_rs8", "arene_1", 16.0, 118.0, 0.0),
    # Arène, seconde vague : deux Rampants dans le dos du joueur, aux angles sud.
    ("spawn_rampant_rs1", "arene_2", 17.0, 100.0, 0.0),
    ("spawn_rampant_rs2", "arene_2", -21.0, 101.0, 0.0),
    # Parking : deux éclaireurs qui arrivent du fond, côté sud.
    ("spawn_rampant_so1", "souterrain_eclaireurs", 33.0, 95.0, -6.0),
    ("spawn_rampant_so2", "souterrain_eclaireurs", 57.5, 94.5, -6.0),
    # Parking : la meute, des quatre côtés, quand la carte Or est atteinte.
    ("spawn_rampant_so3", "souterrain_meute", 76.5, 100.0, -6.0),
    ("spawn_rampant_so4", "souterrain_meute", 52.0, 121.5, -6.0),
    ("spawn_rampant_so5", "souterrain_meute", 32.0, 108.0, -6.0),
    ("spawn_rampant_so6", "souterrain_meute", 76.0, 107.0, -6.0),
    # Couloir du personnel : le Vigile, devant la porte Or.
    ("spawn_vigile_escalier", "escalier", 5.0, 137.25, 0.0),
)

# (nom, évènement, boîte (x0, y0, z0, x1, y1, z1)).
TRIGGERS = (
    # Une bande sur toute la largeur de la réserve : impossible d'aller au nord sans la franchir.
    ("trig_arene_reserve", "arene_reserve", (-23.5, 107.0, 0.0, 19.5, 110.0, 4.0)),
    ("trig_souterrain_descente", "souterrain_descente", (37.0, 119.5, -6.0, 47.0, 124.0, -3.0)),
    ("trig_souterrain_carte", "souterrain_carte", (62.0, 113.0, -6.0, 72.0, 121.0, -3.0)),
)

# Rideau du passage réserve → couloir du personnel : baie de x = 6 à 10, haute
# de 3,25 m, dans un mur de y = 131,75 à 132,25. Posé dans l'épaisseur du
# linteau (y de 131,75 à 132) : ouvert, il y disparaît entièrement.
RIDEAU = "door_reserve_nord"
RIDEAU_MODELE = "door_argent"
RIDEAU_CENTRE = (8.0, 131.875)
RIDEAU_HAUTEUR = 3.24
RIDEAU_COURSE = 3.2

CAPSULES = {"spawn_suit_": 0.4, "spawn_rampant_": 0.35, "spawn_vigile_": 0.5}
MARGE = 0.15
HAUTEUR_LIBRE = 1.9
MARCHE = 0.35


def _boite_monde(obj):
    pts = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    return [min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]


def _gene(x: float, y: float, sol: float, rayon: float):
    """Premier collider ou prop qui rencontre une capsule posée en (x, y, sol), ou None."""
    for obj in bpy.context.view_layer.objects:
        if obj.type != "MESH" or not obj.name.startswith(("col_", "prop_")):
            continue
        mini, maxi = _boite_monde(obj)
        if maxi[2] <= sol + MARCHE or mini[2] >= sol + HAUTEUR_LIBRE:
            continue
        if mini[0] - rayon < x < maxi[0] + rayon and mini[1] - rayon < y < maxi[1] + rayon:
            return obj.name
    return None


def retirer() -> None:
    noms = [RIDEAU, *(nom for nom, *_ in SPAWNS), *(nom for nom, *_ in TRIGGERS), *RETIRES]
    for nom in noms:
        ancien = bpy.data.objects.get(nom)
        if ancien:
            bpy.data.objects.remove(ancien, do_unlink=True)


def poser_spawns(logic) -> list[str]:
    for nom, groupe in GROUPES_EXISTANTS.items():
        bpy.data.objects[nom]["groupe"] = groupe
    encombres = []
    for nom, groupe, x, y, z in SPAWNS:
        rayon = next(r for prefixe, r in CAPSULES.items() if nom.startswith(prefixe)) + MARGE
        gene = _gene(x, y, z, rayon)
        if gene:
            encombres.append(f"{nom} ({x}, {y}) rencontre {gene}")
        obj = bpy.data.objects.new(nom, None)
        obj.empty_display_type = "PLAIN_AXES"
        obj.location = (x, y, z)
        obj["groupe"] = groupe
        logic.objects.link(obj)
    if encombres:
        raise RuntimeError("Points d'apparition encombrés : " + " ; ".join(encombres))
    return [nom for nom, *_ in SPAWNS]


def poser_triggers(logic) -> list[str]:
    for nom, evenement, (x0, y0, z0, x1, y1, z1) in TRIGGERS:
        mesh = bpy.data.meshes.new(nom)
        bm = bmesh.new()
        # Même boîte à 8 sommets que `refresh_story_triggers.py` : origine au coin bas, échelle 1.
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.translate(bm, vec=(0.5, 0.5, 0.5), verts=bm.verts)
        bmesh.ops.scale(bm, vec=(x1 - x0, y1 - y0, z1 - z0), verts=bm.verts)
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new(nom, mesh)
        obj.location = (x0, y0, z0)
        obj["evenement"] = evenement
        obj.display_type = "WIRE"
        logic.objects.link(obj)
    return [nom for nom, *_ in TRIGGERS]


def poser_rideau(props) -> str:
    """Le rideau de la porte Argent, étiré à la hauteur de la baie nord. Les UV
    suivent l'étirement : la tôle garde sa densité de texels."""
    modele = bpy.data.objects[RIDEAU_MODELE]
    mesh = modele.data.copy()
    mesh.name = RIDEAU
    hauteur = max(v.co.z for v in mesh.vertices) - min(v.co.z for v in mesh.vertices)
    facteur = RIDEAU_HAUTEUR / hauteur
    # Axe des UV qui suit la hauteur du rideau : celui qui varie le plus avec z.
    uv = mesh.uv_layers.active
    ecarts = [0.0, 0.0]
    if uv:
        for poly in mesh.polygons:
            for a, b in zip(poly.loop_indices, [*poly.loop_indices[1:], poly.loop_indices[0]]):
                dz = abs(mesh.vertices[mesh.loops[a].vertex_index].co.z - mesh.vertices[mesh.loops[b].vertex_index].co.z)
                if dz > 1e-4:
                    ecarts[0] += abs(uv.data[a].uv.x - uv.data[b].uv.x)
                    ecarts[1] += abs(uv.data[a].uv.y - uv.data[b].uv.y)
        axe = 0 if ecarts[0] > ecarts[1] else 1
        for donnee in uv.data:
            donnee.uv[axe] *= facteur
    for sommet in mesh.vertices:
        sommet.co.z *= facteur
    mesh.update()
    obj = bpy.data.objects.new(RIDEAU, mesh)
    # 1 cm au-dessus du sol, comme le modèle : rien n'affleure.
    obj.location = (RIDEAU_CENTRE[0], RIDEAU_CENTRE[1], 0.01 + RIDEAU_HAUTEUR / 2)
    obj["mouvement"] = "monte"
    obj["course"] = RIDEAU_COURSE
    obj["ouverte"] = True
    props.objects.link(obj)
    return obj.name


def main():
    if Path(bpy.data.filepath).resolve() != SOURCE:
        raise RuntimeError("Ouvrir niveau_v2.blend pour poser ses rencontres")
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    preview = Path(args[args.index("--preview") + 1]).resolve() if "--preview" in args else None
    if preview and (preview in (SOURCE, EXPORT) or preview.with_suffix(".glb") in (SOURCE, EXPORT)):
        raise RuntimeError("L'aperçu doit être distinct du niveau livré")
    hashes = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in (SOURCE, EXPORT)}
    backup = Path(tempfile.mkdtemp(prefix="encounters-backup-"))
    for path in (SOURCE, EXPORT):
        shutil.copy2(path, backup / path.name)
    print("ENCOUNTERS_BACKUP=" + str(backup), flush=True)

    library = bpy.context.view_layer.layer_collection.children.get("_LIB")
    if library:
        library.exclude = True
    retirer()
    bpy.context.view_layer.update()
    logic = bpy.data.collections["LOGIC"]
    report = {
        "spawns": poser_spawns(logic),
        "groupes": sorted(set(GROUPES_EXISTANTS.values()) | {groupe for _, groupe, *_ in SPAWNS}),
        "triggers": poser_triggers(logic),
        "rideau": poser_rideau(bpy.data.collections["PROPS"]),
        "retires": list(RETIRES),
    }
    bpy.context.view_layer.update()

    if any(hashlib.sha256(p.read_bytes()).hexdigest() != old for p, old in hashes.items()):
        raise RuntimeError("La source a changé pendant la préparation ; sauvegarde annulée")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(preview or SOURCE))
    result = C.export(out=preview.with_suffix(".glb") if preview else EXPORT)
    print("ENCOUNTERS_EXPORT=" + C.as_json(result), flush=True)
    if not result.get("ok"):
        raise RuntimeError("Export refusé ; sauvegarde disponible dans " + str(backup))
    report |= {"backup": str(backup), "preview": str(preview) if preview else None}
    print("ENCOUNTERS_RESULT=" + json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
