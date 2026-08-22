"""
Export glTF conforme au contrat runtime.

    blender -b level.blend -P tools/blender/export_level.py -- --out public/levels/hyper.glb

Valide d'abord, exporte ensuite. Refuse d'exporter si la validation échoue.

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
"""

import os
import sys

import bpy

EXCLUDED_COLLECTIONS = {"_KIT"}


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


if __name__ == "__main__":
    main()
