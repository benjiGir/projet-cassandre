"""Quatre secrets du métro ; pose locale rejouable et construction complète."""
import json
from pathlib import Path
import sys

import bpy
import bmesh
from mathutils import Vector
from mathutils import Matrix
import math

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'tools/blender'))
import cassandre as C
from tools.blender import geo_utils
from tools.metro.quartier.authoring import Author
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install
from tools.metro.blockout.control_panels import create as control_panel

PREFIX = 'n7_metro_secret'
REWARDS = (
    ('quartier_soin', (9.3, 17.15, 0), 'soin', 25),
    ('quartier_ammo', (9.3, 18.85, 0), 'munitions', 24),
    ('archives_ammo', (86.6, 260.3, -15.55), 'munitions', 36),
    ('archives_fusees', (86.6, 262, -15.55), 'fusees', 4),
    ('toit_soin', (39.25, 369.5, -13.88), 'soin', 25),
    ('toit_cartouches', (39.75, 369.5, -13.88), 'cartouches', 16),
    ('entretien_soin', (127, 342.5, -22), 'soin', 50),
    ('entretien_cartouches', (129, 343.75, -22), 'cartouches', 12),
)


class ExistingAuthor(Author):
    def __init__(self):
        self.placed, self.serial = [], 0
        for name, collection in (('shell', 'SHELL'), ('props', 'PROPS'), ('col', 'COL'),
                                 ('logic', 'LOGIC'), ('lights', 'LIGHTS')):
            setattr(self, name, bpy.data.collections[collection])
        self.mats = {m.name.removeprefix('quartier_'): m for m in bpy.data.materials if m.name.startswith('quartier_')}


def materials(a):
    result = a.mats.copy()
    for name, replacement in {'acier': 'da_acier', 'ivoire': 'da_ivoire_peint',
                              'beton': 'da_beton', 'sol': 'da_sol', 'bois': 'da_bois',
                              'enduit': 'da_exterior_enduit', 'brique': 'da_exterior_brique',
                              'ardoise': 'da_exterior_ardoise', 'petrole': 'da_petrole'}.items():
        if replacement in bpy.data.materials: result[name] = bpy.data.materials[replacement]
    return result


def piece(a, suffix):
    return Piece(PREFIX + '_' + suffix, materials(a), 'cache facultative du métro')


def light(a, name, at, color, intensity, distance):
    before = set(bpy.context.scene.objects)
    a.point(name,at,color,intensity,distance)
    for obj in set(bpy.context.scene.objects)-before: tag(obj)


def tag(obj):
    obj['metro_secret_asset'] = True
    return obj


def finish(a, p, stage=None):
    install(a, p, (0, 0, 0))
    for obj in a.props.objects:
        if obj.get('kit') == p.name:
            tag(obj)
            if stage: obj.parent = stage
    for obj in a.col.objects:
        if obj.get('kit') == p.name: tag(obj)


def zone(a, name, origin, size):
    obj = geo_utils.build_proxy_object('secret_metro_' + name, 'box', origin, size)
    a.logic.objects.link(obj)
    obj['secret_id'] = name
    tag(obj)
    return obj


def door(a, p, name, movement='monte', course=2.8, hinge='min'):
    objects = list(p.collection.objects)
    bm = bmesh.new()
    material = objects[0].data.materials[0]
    for obj in objects:
        if obj.type != 'MESH' or obj.name.startswith('col_'): continue
        bm.from_mesh(obj.data)
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data); bm.free()
    data.materials.append(material)
    center = Vector(tuple(sum(v.co[i] for v in data.vertices) / len(data.vertices) for i in range(3)))
    data.transform(Matrix.Translation(-center))
    obj = bpy.data.objects.new(name, data)
    a.logic.objects.link(obj); obj.location = center
    obj['mouvement'], obj['course'], obj['referme'], obj['duree'] = movement, course, False, .7
    obj['charniere'] = hinge
    obj['angle'] = 90
    tag(obj)
    for old in objects: bpy.data.objects.remove(old, do_unlink=True)
    bpy.data.collections.remove(p.collection)
    return obj


def button(a, name, at, angle, target, caption):
    before = set(bpy.context.scene.objects)
    body = control_panel(a, 'use_n7_metro_' + name, at, angle, caption, target, variant='switch')
    for obj in set(bpy.context.scene.objects) - before: tag(obj)
    return body


def cut_wall(name, origin, size):
    proxy = bpy.data.objects.get(name)
    if proxy is None: raise ValueError('Mur absent : ' + name)
    if proxy.get('metro_secret_opening') == 3: return
    target = []
    lo, hi = bounds(proxy)
    # Les murs sont parfois fusionnés par matière. La découpe vise aussi le lot visible.
    for obj in bpy.data.collections['PROPS'].objects:
        if obj.type != 'MESH' or obj.get('kit') != proxy.get('kit'): continue
        mn, mx = bounds(obj)
        if all(mx[i] >= lo[i] and mn[i] <= hi[i] for i in range(3)): target.append(obj)
    cutter = bpy.data.objects.new('secret_cutter', geo_utils.build_box_mesh('secret_cutter', origin, size))
    bpy.context.scene.collection.objects.link(cutter)
    bm = bmesh.new()
    bm.from_mesh(cutter.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(cutter.data); bm.free()
    for obj in target:
        if obj.get('metro_secret_opening') == 3: continue
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data); bm.free()
        modifier = obj.modifiers.new('ouverture_cache', 'BOOLEAN')
        modifier.operation, modifier.solver, modifier.object = 'DIFFERENCE', 'EXACT', cutter
        modifier.use_self = True
        modifier.use_hole_tolerant = True
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj['metro_secret_opening'] = 3
    bpy.data.objects.remove(cutter, do_unlink=True)
    # Un hull concave reboucherait l'ouverture dans Rapier. Quatre boîtes
    # indépendantes conservent les jambages, le linteau et le soubassement.
    x, y, z = lo
    width = hi[0]-x
    opening_y, opening_z = origin[1], origin[2]
    end_y, end_z = opening_y+size[1], opening_z+size[2]
    frames = (
        ((x,y,z),(width,opening_y-y,hi[2]-z)),
        ((x,end_y,z),(width,hi[1]-end_y,hi[2]-z)),
        ((x,opening_y,z),(width,size[1],opening_z-z)),
        ((x,opening_y,end_z),(width,size[1],hi[2]-end_z)),
    )
    for i, (at, dimensions) in enumerate(frames):
        data = geo_utils.build_box_mesh(name+'_cadre_'+str(i), at, dimensions)
        if i == 0:
            proxy.data = data
            proxy['metro_secret_opening'] = 3
        else:
            obj = bpy.data.objects.new('col_box_'+name.removeprefix('col_hull_')+'_secret_'+str(i),data)
            bpy.data.collections['COL'].objects.link(obj)
            obj['kit'] = proxy.get('kit', '')
            obj['metro_secret_opening'] = 3


def shop(a):
    for name in ('kit_rdc_29_001', 'col_box_kit_rdc_29_001', 'kit_rdc_29_004', 'kit_rdc_29_quartier_ardoise'):
        obj = bpy.data.objects.get(name)
        if obj: bpy.data.objects.remove(obj, do_unlink=True)
    p = piece(a, 'atelier')
    for y in (16, 19.6): p.box((8, y, 0), (.5, .4, 3.5), 'enduit', True)
    p.box((8, 16.4, 2.75), (.5, 3.2, .75), 'enduit', True)
    p.box((8, 16.4, -.2), (2, 3.2, .2), 'sol', True)
    for y in (16.2, 19.6): p.box((8.5, y, 0), (1.5, .2, 2.75), 'beton', True)
    p.box((8.5, 16.4, 2.75), (1.5, 3.2, .15), 'beton', True)
    for y in (16.4, 19.48): p.box((7.86, y, .05), (.17, .12, 2.72), 'acier')
    p.box((9.62, 17.35, .78), (.35, 1.3, .12), 'bois', True)
    for y in (17.42, 18.48): p.box((9.7, y, 0), (.18, .12, .8), 'acier', True)
    p.box((9.84, 17.45, 1.08), (.08, 1.1, 1), 'petrole')
    for y in (17.7, 18.05, 18.4): p.beam((9.77, y, 1.3), (9.77, y+.07, 1.68), .04, 'acier')
    p.box((8.75, 16.8, 2.48), (.8, 1.5, .1), 'acier')
    p.box((8.9, 16.93, 2.45), (.55, 1.24, .025), 'lampe')
    finish(a, p)
    leaf = piece(a, 'rideau')
    leaf.box((7.95, 16.4, .06), (.09, 3.2, 2.69), 'acier')
    for i in range(21): leaf.box((7.91, 16.43, .12+i*.12), (.045, 3.14, .035), 'acier')
    leaf.box((7.88, 16.4, .06), (.12, 3.2, .08), 'acier')
    shutter = door(a, leaf, 'door_n7_metro_atelier', course=2.85)
    button(a, 'atelier', (7.82, 19.79, 1.12), -math.pi/2, shutter.name, 'ATELIER')
    zone(a, 'atelier', (8.7, 16.6, .15), (1.1, 2.8, 2.5))
    light(a,'n7_metro_atelier',(9.1,17.6,2.35),'#e5b878',7,6)


def archives(a):
    cut_wall('col_hull_kit_n5_local_agents_part_0_004', (83.75, 260.2, -15.55), (.75, 2.0, 2.6))
    p = piece(a, 'archives')
    p.box((84, 259.4, -15.8), (4.5, 3.8, .25), 'sol', True)
    p.box((84.2, 259.2, -15.55), (4.5, .2, 3.5), 'beton', True)
    p.box((84.2, 263.2, -15.55), (4.5, .2, 3.5), 'beton', True)
    p.box((88.5, 259.4, -15.55), (.2, 3.8, 3.5), 'beton', True)
    p.box((84, 259.4, -12.05), (4.7, 3.8, .2), 'beton', True)
    for y in (259.4, 262.2): p.box((84, y, -15.55), (.2, .8, 3.5), 'beton', True)
    for z in (-15.2, -14.45, -13.7):
        p.box((87.75, 259.9, z), (.6, 2.8, .08), 'bois')
        for y in (260, 260.9, 261.8): p.box((87.8, y, z+.08), (.42, .66, .45), 'bois')
    p.proxy((87.75, 259.9, -15.55), (.6, 2.8, 2.4))
    p.box((88.32, 260.2, -13.1), (.12, 2.2, .48), 'petrole')
    obj = p.text('SANG-FROID', (88.28, 261.3, -12.98), .18, 'ivoire')
    obj.data.transform(Matrix.Translation(Vector((88.28,261.3,-12.98))) @ Matrix.Rotation(-math.pi/2,4,'Z') @ Matrix.Translation(Vector((-88.28,-261.3,12.98))))
    p.box((85.3, 260.5, -12.42), (1.9, .2, .1), 'acier')
    p.box((85.42, 260.48, -12.45), (1.66, .22, .025), 'lampe')
    finish(a, p)
    facade = piece(a, 'armoire_mobile')
    facade.box((83.5, 260.15, -15.55), (.5, 2.1, 2.55), 'acier')
    for y in (260.18, 261.2, 262.18): facade.box((83.45, y, -15.43), (.055, .035, 2.28), 'acier')
    for y in (260.9, 261.9): facade.box((83.36, y, -14.5), (.1, .04, .25), 'acier')
    for z in (-15.5, -13.09): facade.box((83.42, 260.15, z), (.08, 2.1, .05), 'acier')
    cabinet = door(a, facade, 'door_n7_metro_archives', 'battant')
    cabinet['sens'] = '+'
    button(a, 'casier', (79.91, 263.61, -14.3), 0, cabinet.name, 'SF')
    zone(a, 'sang_froid', (84.7, 259.65, -15.4), (2.6, 3.2, 2.75))
    light(a,'n7_metro_archives',(86.2,261.2,-12.8),'#c6d6c2',8,7)


def rooftop(a):
    p = piece(a, 'toit_acces')
    for i in range(17):
        y = 357.75+i*.5
        top = -18+(i+1)*.25
        p.box((35.35, y, top-.12), (1.35, .5, .12), 'acier', True)
        p.box((35.35, y, top-.02), (1.35, .045, .02), 'ivoire')
        for x in (35.37, 36.63):
            p.box((x, y, top-.35), (.06, .5, .37), 'acier')
    for x in (35.32, 36.68):
        p.beam((x, 357.75, -18), (x, 366.25, -13.75), .14, 'acier')
        p.beam((x, 357.75, -17), (x, 366.25, -12.75), .055, 'acier')
        for i in range(5):
            y=358+i*2
            z=-18+(y-357.75)*.5
            p.beam((x,y,z),(x,y,z+1.08),.045,'acier')
        for y in (361.75, 366.25):
            top = -18+(y-357.75)*.5
            p.box((x-.07,y-.08,-18),(.14,.16,top+18),'acier',True)
            p.box((x-.15,y-.17,-18),(.3,.34,.06),'acier')
    p.box((35.35, 366.25, -13.75), (1.35, .75, .12), 'acier', True)
    p.box((34.78, 367, -13.73), (2.8, 2.6, .12), 'acier', True)
    p.box((37.3, 367.1, -14.0), (1.0, 2.4, .12), 'acier', True)
    p.box((38.25, 366.4, -14.0), (2.5, 5.4, .12), 'acier', True)
    # Une housse et un coffre se distinguent du matériel de toiture ordinaire.
    p.box((38.7, 370.15, -13.88), (1.3, .8, .36), 'petrole', True)
    p.box((38.68, 370.13, -13.52), (1.34, .84, .07), 'acier')
    for start,end in (((34.85,367),(34.85,369.6)),((34.85,369.6),(37.5,369.6)),
                      ((41.25,366.4),(41.25,371.8)),((37.55,371.8),(41.25,371.8))):
        x0,y0=start; x1,y1=end
        p.proxy((min(x0,x1)-.06,min(y0,y1)-.06,-13.88),
                (max(.12,abs(x1-x0)+.12),max(.12,abs(y1-y0)+.12),1.4))
        for h in (.25,.75,1.35): p.beam((x0,y0,-13.88+h),(x1,y1,-13.88+h),.045,'acier')
        for x,y in (start,end): p.beam((x,y,-13.88),(x,y,-12.48),.055,'acier')
    finish(a, p, bpy.data.objects.get('stage_voyage_depart'))
    zone(a, 'toit', (34.78, 366.25, -13.75), (6.67, 5.55, 2.5))


def maintenance(a):
    p = piece(a, 'grille_entretien')
    for y in (342.1, 344.3): p.box((119.65,y,-22),(.12,.09,2.7),'acier')
    for z in (-21.95,-20.9,-19.38): p.box((119.65,342.1,z),(.12,2.29,.08),'acier')
    for i in range(11): p.box((119.65,342.2+i*.19,-21.9),(.09,.035,2.55),'acier')
    gate = door(a,p,'door_n7_metro_entretien','battant',hinge='min')
    gate['sens']='+'
    button(a,'entretien',(119.25,344.67,-20.8),-math.pi/2,gate.name,'LOCAL')
    zone(a,'entretien',(125.2,340.7,-21.85),(5.5,4.25,2.85))


def rewards(a):
    for suffix, (x,y,z), key, amount in REWARDS:
        p = piece(a,'pickup_'+suffix)
        obj=p.box((x-.15,y-.13,z+.07),(.3,.26,.18),'petrole')
        p.collection.objects.unlink(obj); a.logic.objects.link(obj)
        center=Vector((x,y,z+.16)); obj.data.transform(Matrix.Translation(-center)); obj.location=center
        obj.name='use_n7_metro_'+suffix; obj[key]=amount; tag(obj)
        bpy.data.collections.remove(p.collection)


def build(a):
    for obj in list(bpy.context.scene.objects):
        if obj.get('metro_secret_asset'): bpy.data.objects.remove(obj,do_unlink=True)
    shop(a); archives(a); rooftop(a); maintenance(a); rewards(a)
    bpy.context.view_layer.update()


def check_accesses(a):
    from mathutils.bvhtree import BVHTree
    vertices, faces, owners = [], [], []
    for obj in a.col.objects:
        if obj.type != 'MESH': continue
        offset = len(vertices)
        vertices.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        faces.extend(tuple(offset+i for i in face.vertices) for face in obj.data.polygons)
        owners.extend(obj.name for face in obj.data.polygons)
    tree = BVHTree.FromPolygons(vertices, faces)
    poses = (
        ('atelier', (9.05, 18, 0)), ('seuil_archives', (84.1, 261.2, -15.55)),
        ('archives', (86, 261.2, -15.55)), ('escalier_bas', (36, 358, -17.75)),
        ('escalier_haut', (36, 366, -13.75)), ('palier', (36, 366.65, -13.63)),
        ('marquise', (36, 368, -13.61)), ('toit', (38.8, 368.8, -13.88)),
        ('couloir_entretien', (122, 343, -22)), ('entretien', (127, 342.5, -22)),
    )
    readings = []
    for name, (x, y, z) in poses:
        hit, _, _, _ = tree.ray_cast(Vector((x, y, z+.3)), Vector((0, 0, -1)), .6)
        nearest = min((tree.find_nearest(Vector((x, y, z+h))) for h in (1, 1.6)), key=lambda hit: hit[3])
        clearance = nearest[3]
        if hit is None or abs(hit.z-z) > .06 or clearance < .405:
            raise ValueError(f'Accès {name} : sol {None if hit is None else hit.z}, dégagement {clearance:.3f}, obstacle {owners[nearest[2]]}')
        readings.append({'nom': name, 'sol': round(hit.z, 3), 'degagement': round(clearance, 3)})
    for suffix, (x, y, z), _, _ in REWARDS:
        hit, _, _, _ = tree.ray_cast(Vector((x, y, z+.3)), Vector((0, 0, -1)), .6)
        if hit is None or abs(hit.z-z) > .06: raise ValueError('Ramassage sans appui : ' + suffix)
    return readings


def main():
    if '--inspect' in sys.argv:
        inspect(); return
    path=Path(bpy.data.filepath).resolve()
    if path != ROOT/'assets_src/blender/metro_blockout.blend': raise ValueError('Ouvrir le métro livré')
    author = ExistingAuthor()
    build(author)
    accesses = check_accesses(author)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    exported=C.export(out=ROOT/'public/assets/levels/metro_blockout.glb',niveau='metro')
    print('[metro-secrets] '+json.dumps({'secrets':4,'recompenses':len(REWARDS),'acces':accesses,'export':exported.get('ok')}))
    if not exported.get('ok'): raise ValueError(exported.get('lines'))
    if '--sans-apercus' not in sys.argv:
        for name,view in (('atelier',(6.8,18,0,270)),('archives',(86,261,-15.55,270)),
                          ('toit',(34,354,-18,0)),('entretien',(116.5,343,-22,270))):
            print('[metro-secrets] '+json.dumps(C.shot(view,mode='material',nom='metro_secret_'+name)))


def bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return [tuple(min(v[i] for v in corners) for i in range(3)),
            tuple(max(v[i] for v in corners) for i in range(3))]


def inspect():
    regions = {'atelier': ((7, 15, -.1), (11, 21, 3.5)),
               'agents': ((70, 258, -16), (85, 265, -12)),
               'depot': ((34, 354, -19), (42, 373, -11)),
               'entretien': ((118, 341, -23), (133, 345, -18))}
    result = {}
    for name, (lo, hi) in regions.items():
        items = []
        for obj in bpy.context.scene.objects:
            if obj.type != 'MESH': continue
            mn, mx = bounds(obj)
            if all(mx[i] > lo[i] and mn[i] < hi[i] for i in range(3)):
                if obj.name.startswith('col_') or obj.get('kit', '').startswith('rdc_'):
                    items.append({'nom': obj.name, 'kit': obj.get('kit'),
                                  'bounds': [[round(v, 3) for v in p] for p in (mn, mx)],
                                  'materiaux': [m.name for m in obj.data.materials if m]})
        result[name] = items
    path = ROOT / 'renders/metro-secrets/inspection.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print('[metro-secrets] ' + json.dumps({'inspection': str(path.relative_to(ROOT)),
                                          'objets': {k: len(v) for k, v in result.items()},
                                          'materiaux': [m.name for m in bpy.data.materials if 'da_' in m.name][:25]}))


if __name__ == '__main__':
    main()
