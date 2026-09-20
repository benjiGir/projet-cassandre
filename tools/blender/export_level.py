"""
Export glTF conforme au contrat runtime.

    blender -b level.blend -P tools/blender/export_level.py -- --out public/levels/hyper.glb

N'appelle PAS `validate_level.py` lui-même — exporte directement. La chaîne
documentée (`tools/blender/README.md`) exécute la validation comme étape
SÉPARÉE, avant cet appel : c'est cet ordre manuel qui protège l'export, pas
ce script.

PREMIER RUN RÉEL EN BLENDER 5.1.2 (2026-08-21, assemblage Zone A/B) : le
kwarg `export_colors` documenté par `blender-level-conventions`/
`blender-python-automation` n'existe plus — l'exporteur glTF 5.x a remplacé
le booléen par un ENUM `export_vertex_color` (MATERIAL/ACTIVE/NAME/NONE,
défaut MATERIAL). `MATERIAL` n'exporte les vertex colors QUE si le graphe de
matériau les référence explicitement via un nœud Color Attribute — ce n'est
JAMAIS le cas des matériaux du kit (Principled BSDF nu, couleur posée en dur,
voir `kit_spec.MATERIALS`). Sans ce fix, l'attribut "Col" bien réel dans le
`.blend` n'aurait silencieusement PAS atteint `COLOR_0` du glTF. `ACTIVE`
exporte l'attribut de couleur actif du mesh quel que soit le matériau —
c'est ce que veut ce projet (`vertex-color-sector-lighting`).

Décision actée : voir docs/decisions/0021-export-vertex-color-enum.md
"""

import json
import os
import struct
import sys

import bpy

# Collections SOURCES : le kit modulaire et la bibliothèque du niveau v2. On
# n'exporte que les copies posées en niveau, jamais les originaux.
EXCLUDED_COLLECTIONS = {"_KIT", "_LIB"}


def get_args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def parse_out(args: list[str]) -> str:
    if "--out" in args:
        return args[args.index("--out") + 1]
    return "//export/level.glb"


def hide_excluded() -> list[str]:
    """Exclut les collections sources du kit — on n'exporte que les instances."""
    hidden = []
    vl = bpy.context.view_layer
    for lc in vl.layer_collection.children:
        if lc.name in EXCLUDED_COLLECTIONS and not lc.exclude:
            lc.exclude = True
            hidden.append(lc.name)
    return hidden


def noms_du_view_layer() -> set[str]:
    """Objets que `use_visible=True` est censé exporter : ceux du view layer,
    donc jamais ceux d'une collection exclue."""
    return {o.name for o in bpy.context.view_layer.objects}


def noms_des_collections_sources() -> set[str]:
    """Noms de base des objets vivant dans `_KIT`/`_LIB`, sous-collections
    comprises. Lus dans `bpy.data`, donc valides même si la collection a été
    dés-exclue du view layer."""
    noms: set[str] = set()

    def descendre(coll) -> None:
        for o in coll.objects:
            noms.add(o.name.split(".")[0])
        for enfant in coll.children:
            descendre(enfant)

    for nom in EXCLUDED_COLLECTIONS:
        coll = bpy.data.collections.get(nom)
        if coll:
            descendre(coll)
    return noms


def noms_du_glb(path: str) -> list[str]:
    """Noms des noeuds du `.glb` qu'on vient d'écrire (chunk JSON seul)."""
    data = open(path, "rb").read()
    length = struct.unpack("<III", data[:12])[2]
    off = 12
    while off < length:
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        if ctype == 0x4E4F534A:  # 'JSON'
            return [n.get("name", "") for n in json.loads(data[off + 8:off + 8 + clen]).get("nodes", [])]
        off += 8 + clen
    return []


def verifier_contenu(out: str) -> None:
    """Refuse en bloc un export qui embarque autre chose que le niveau.

    Pourquoi cette garde existe : le 2026-09-18, un `.glb` livré au jeu
    contenait TOUTE la bibliothèque `_LIB` — 1 153 noeuds de trop, 47 Mo au
    lieu de 29, et un tas d'assets empilés à l'origine du monde. Le `.blend`,
    lui, était parfaitement sain (`_LIB` exclue). Le cas se produit dès que
    l'export ne passe PAS par ce script — typiquement un File > Export glTF
    depuis l'interface, qui n'a pas `use_visible=True` coché par défaut et
    sort alors les collections exclues du view layer.

    Un `.glb` faux ne lève aucune erreur en jeu : il se charge, et on croit
    que c'est le niveau. D'où une vérification a posteriori, sur le fichier
    réellement écrit, plutôt qu'une confiance dans les options passées.
    """
    attendus = {a.split(".")[0] for a in noms_du_view_layer()}
    sources = noms_des_collections_sources()
    exportes = [n for n in noms_du_glb(out) if n]
    # `export_apply=True` peut renommer un noeud en le dédupliquant : on
    # compare sur le nom de base, jamais sur l'égalité stricte.
    #
    # DEUX tests, parce qu'il y a deux façons de se tromper : exporter hors du
    # view layer (l'interface de Blender), ou avoir dés-exclu `_LIB` avant
    # d'exporter (auquel cas elle EST dans le view layer, et le premier test
    # ne verrait rien).
    intrus = sorted({n for n in exportes if n.split(".")[0] not in attendus})
    fuites = sorted({n for n in exportes if n.split(".")[0] in sources})
    if not intrus and not fuites:
        print(f"[export] contenu vérifié : {len(attendus)} objets du view layer, "
              f"aucun intrus, aucune fuite de _KIT/_LIB")
        return
    intrus = intrus or fuites
    apercu = ", ".join(intrus[:8])
    raise SystemExit(
        f"[export] ÉCHEC : {len(intrus)} noeuds exportés n'appartiennent pas au view layer "
        f"({apercu}{'...' if len(intrus) > 8 else ''}).\n"
        f"[export] Une collection SOURCE (_KIT / _LIB) est probablement partie dans l'export. "
        f"Ré-exporter AVEC ce script, jamais par File > Export de l'interface."
    )


def main() -> None:
    args = get_args()
    out = bpy.path.abspath(parse_out(args))
    os.makedirs(os.path.dirname(out), exist_ok=True)

    hidden = hide_excluded()
    if hidden:
        print(f"[export] collections exclues : {', '.join(hidden)}")

    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        use_visible=True,
        export_extras=True,          # custom properties -> mesh.userData
        export_apply=True,           # applique les modificateurs
        export_vertex_color="ACTIVE",  # attribut actif -> COLOR_0, peu importe le matériau (voir doc de tête)
        export_normals=True,
        export_tangents=False,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_draco_mesh_compression_enable=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
    )

    size = os.path.getsize(out) / 1024
    print(f"[export] {out}  ({size:.0f} Ko)")
    verifier_contenu(out)


if __name__ == "__main__":
    main()
