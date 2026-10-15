"""C.rework_fournil_ovens() : remplacement local des appareils de cuisson."""
import json
from pathlib import Path
import shutil
import sys

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
sys.path.insert(0,str(ROOT/"tools/blender"))
import cassandre as C
import lib_fournil_ovens as ovens


def remove_legacy_components(obj):
    """Les anciens fours partagent leurs meshes avec les tables et chariots."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    pending, removed = set(bm.verts), []
    while pending:
        seed = pending.pop()
        group, stack = {seed}, [seed]
        while stack:
            for edge in stack.pop().link_edges:
                for vertex in edge.verts:
                    if vertex in pending:
                        pending.remove(vertex)
                        group.add(vertex)
                        stack.append(vertex)
        points = [obj.matrix_world @ vertex.co for vertex in group]
        if all(10.99 <= p.x <= 19.11 and 154.29 <= p.y <= 155.76 and .14 <= p.z <= 3.56 for p in points):
            removed.extend(group)
    count = len(removed)
    bmesh.ops.delete(bm,geom=removed,context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return count


def main():
    source = ROOT/"assets_src/blender/niveau_v2.blend"
    if Path(bpy.data.filepath).resolve() != source:
        raise ValueError("Ouvrir niveau_v2.blend avant cette retouche")
    backup = ROOT/"renders/_cassandre/niveau_v2_avant_fours.blend"
    backup.parent.mkdir(parents=True,exist_ok=True)
    if not backup.exists():
        shutil.copy2(source,backup)
    removed = {}
    for name in ("fournil_babcbc","fournil_444a54","fournil_e8741c","fournil_b8612e"):
        obj = bpy.data.objects.get(name)
        if obj:
            removed[name] = remove_legacy_components(obj)
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(("fournil_four_","fournil_rotissoire_","vitre_fournil_four",
                                "vitre_fournil_rotissoire","col_box_fournil_four",
                                "col_box_fournil_rotissoire")):
            bpy.data.objects.remove(obj,do_unlink=True)
    report = ovens.build(bpy.data.collections["PROPS"],bpy.data.collections["COL"])
    report["sommets_anciens_retires"] = removed
    bpy.context.view_layer.update()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    report["export"] = C.export(niveau="hypermarche")
    if not report["export"].get("ok"):
        raise RuntimeError(report["export"])
    path = ROOT/"renders/reviews/fours-fournil/deploiement.json"
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    print("[fournil-ovens] "+json.dumps(report))


if __name__ == "__main__":
    main()
