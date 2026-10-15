"""Pose locale des Contrôleurs, contrôles d'appui puis export par Cassandre."""
import json
from pathlib import Path
import sys
from types import SimpleNamespace

import bpy

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'tools/blender'))
import cassandre as C
from tools.metro.blockout import encounters

BLEND = ROOT / 'assets_src/blender/metro_blockout.blend'


def main():
    if Path(bpy.data.filepath).resolve() != BLEND.resolve():
        raise ValueError('Ouvrir assets_src/blender/metro_blockout.blend')
    collection = bpy.data.collections['LOGIC']
    for obj in list(bpy.data.objects):
        if obj.name.startswith(('spawn_controleur_', 'spawn_chef_brigade_')):
            bpy.data.objects.remove(obj, do_unlink=True)
    spawns = []
    for group, (kind, points) in encounters.GROUPS.items():
        if kind not in ('controleur', 'chef_brigade'):
            continue
        for index, (x, y, z) in enumerate(points, 1):
            z = encounters.P.galerie_z(x, y) if z is None else z
            obj = bpy.data.objects.new(f'spawn_{kind}_{group}_{index:02d}', None)
            collection.objects.link(obj)
            obj.location = (x, y, z + .02)
            obj['groupe'] = group
            spawns.append({'nom': obj.name, 'groupe': group, 'espece': kind, 'pieds': list(obj.location)})
    readings = encounters.inspect_positions(SimpleNamespace(col=bpy.data.collections['COL']), spawns)
    report_path = ROOT / 'renders/reviews/blockout-metro/rencontres.json'
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    report['controleurs'] = spawns
    report['controleurs_implantation'] = readings
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    result = C.export(out=ROOT / 'public/assets/levels/metro_blockout.glb', niveau='metro')
    print('[metro-controleurs] ' + json.dumps({'marqueurs': len(spawns), 'export': result.get('ok'),
                                              'lignes': result.get('lines', [])[-5:]}, ensure_ascii=False))
    return 0 if result.get('ok') else 1


if __name__ == '__main__':
    sys.exit(main())
