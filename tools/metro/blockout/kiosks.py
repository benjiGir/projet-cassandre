"""Six bornes de sponsor du métro, communes à la pose locale et au build."""
from dataclasses import dataclass
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'tools/blender'))
import cassandre as C
from tools.metro.blockout.control_panels import enclosure
from tools.metro.blockout.secrets import ExistingAuthor, materials
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


@dataclass(frozen=True)
class Kiosk:
    name: str
    perk: str
    price: int
    brand: str
    position: tuple
    angle: float
    accent: str


KIOSKS = (
    Kiosk('billetterie', 'perche', 10, 'TITANE', (-17.74, 98, -5), math.pi/2, 'acier'),
    Kiosk('quai', 'vpn', 20, 'FARADAY', (-8.88, 153, -13), math.pi/2, 'petrole'),
    Kiosk('agents', 'aimant', 25, 'MAGNETIPS', (80.75, 258.42, -15.55), math.pi, 'rouge'),
    Kiosk('depot', 'premium', 35, 'VERITE+', (51.16, 325.5, -18), -math.pi/2, 'petrole'),
    Kiosk('machinerie', 'boisson', 55, 'ZONE 51', (114, 326.16, -22), math.pi, 'ambre'),
    Kiosk('embarquement', 'gilet', 85, 'ALU-TACTIQUE', (51.16, 358.5, -18), -math.pi/2, 'acier'),
)
TAG = 'metro_kiosk_asset'


def icon(p, perk):
    y = -.5
    if perk == 'boisson':
        p.cylinder((-.11, -.45, .12), .115, .42, 'ambre', sides=12)
        for z in (-.09, .33): p.cylinder((-.11, -.45, z), .12, .035, 'acier', sides=12)
        p.text('51', (-.11, -.572, .06), .12, 'nuit')
    elif perk == 'perche':
        p.beam((-.23, y, -.14), (-.06, y, .3), .06, 'acier')
        p.beam((-.06, y, .3), (.015, y, .26), .06, 'ivoire')
        p.beam((-.23, y, -.14), (-.15, y, -.18), .06, 'ivoire')
    elif perk == 'aimant':
        p.box((-.29, y, -.12), (.11, .028, .4), 'rouge')
        p.box((.01, y, -.12), (.11, .028, .4), 'rouge')
        p.box((-.29, y, -.15), (.41, .028, .12), 'rouge')
        for x in (-.29, .01): p.box((x, y-.006, .23), (.11, .04, .09), 'ivoire')
    elif perk == 'gilet':
        outline = ((-.32,-.12),(.12,-.12),(.12,.22),(.02,.34),(-.04,.19),(-.16,.19),(-.22,.34),(-.32,.22))
        p.mesh([(x,y,z) for x,z in outline], [tuple(range(8))], 'ivoire')
        p.box((-.124, y-.01, -.1), (.04, .022, .3), 'acier')
        for x in (-.28, -.04): p.box((x,y-.012,-.02),(.13,.025,.095),'petrole')
    else:
        outline = ((-.3,-.02),(-.11,-.2),(.08,-.02),(.08,.27),(-.11,.36),(-.3,.27))
        p.mesh([(x,y,z) for x,z in outline], [tuple(range(6))], 'petrole' if perk=='vpn' else 'ambre')
        if perk == 'vpn':
            p.box((-.23,y-.015,.055),(.24,.025,.12),'ivoire')
            p.cylinder((-.11,y-.034,.20),.07,.024,'ivoire','Y',12)
        else:
            p.text('+',(-.11,y-.02,.025),.27,'nuit')


def terminal(a, spec):
    p = Piece('n7_borne_metro_'+spec.name, materials(a),
              'distributeur de sponsor : socle, boîtier biseauté, vitrine et commande ; face -Y')
    at = Vector(spec.position) + Vector((0,0,1.15))
    body = enclosure(p, .96, 1.84, .44)
    p.collection.objects.unlink(body)
    a.logic.objects.link(body)
    body.name = 'use_borne_metro_'+spec.name
    anchor = Vector(tuple(round(v/.25)*.25 for v in at))
    body.data.transform(Matrix.Translation(Matrix.Rotation(-spec.angle,3,'Z') @ (at-anchor)))
    body.location, body.rotation_euler.z = anchor, spec.angle
    body['perk'], body['prix'], body[TAG] = spec.perk, spec.price, True
    p.box((-.49,-.42,-1.15),(.98,.5,.16),'acier')
    p.box((-.44,-.40,-.99),(.88,.43,.07),'nuit')
    p.box((-.40,-.457,-.81),(.8,.025,1.50),'nuit')
    p.box((-.41,-.475,.62),(.82,.025,.22),spec.accent)
    p.text(spec.brand,(0,-.501,.69),min(.115,.8/max(len(spec.brand),1)*1.5),'nuit')
    p.box((-.34,-.477,-.25),(.50,.025,.81),'ivoire')
    p.box((-.305,-.482,-.205),(.43,.025,.73),'nuit')
    icon(p,spec.perk)
    p.text('SPONSOR',(-.10,-.511,.43),.067,'ivoire')
    p.box((.205,-.48,.23),(.14,.03,.26),'acier')
    p.box((.22,-.498,.385),(.11,.015,.04),'nuit')
    p.text('E',(.28,-.516,.255),.1,'ivoire')
    p.cylinder((.28,-.508,.035),.095,.045,'acier','Y',12)
    p.cylinder((.28,-.54,.035),.069,.035,'petrole','Y',12)
    p.box((.215,-.485,-.18),(.13,.025,.055),'ambre')
    p.box((-.32,-.483,-.61),(.64,.02,.21),'acier')
    p.box((-.28,-.51,-.54),(.56,.025,.12),'nuit')
    p.box((-.31,-.56,-.63),(.62,.13,.045),'acier')
    for x in (-.31,.25): p.box((x,-.56,-.61),(.06,.12,.14),'acier')
    for z in (-.81,-.73): p.box((-.23,-.486,z),(.46,.018,.025),'acier')
    p.box((-.41,-.62,.91),(.82,.23,.08),'acier')
    p.box((-.34,-.61,.90),(.68,.14,.018),'lampe')
    p.proxy((-.49,-.45,-1.15),(.98,.52,2.22))
    install(a,p,at,spec.angle)
    for collection in (a.props,a.col):
        for obj in collection.objects:
            if obj.get('kit') == p.name: obj[TAG] = True
    before = set(bpy.context.scene.objects)
    normal = Vector((math.sin(spec.angle),-math.cos(spec.angle),0))
    a.point('n7_borne_metro_'+spec.name, Vector(spec.position)+normal*.74+Vector((0,0,2.05)),
            '#e9d1a2',3,4)
    for obj in set(bpy.context.scene.objects)-before: obj[TAG] = True
    return body


def build(a):
    for obj in list(bpy.context.scene.objects):
        if obj.get(TAG): bpy.data.objects.remove(obj,do_unlink=True)
    for spec in KIOSKS: terminal(a,spec)
    bpy.context.view_layer.update()


def standing_pose(spec, distance=1.65):
    normal = Vector((math.sin(spec.angle),-math.cos(spec.angle),0))
    at = Vector(spec.position) + normal * distance
    cap = math.degrees(spec.angle) % 360
    return (at.x,at.y,at.z,cap)


def check_placements(a):
    vertices,faces,owners = [],[],[]
    for obj in a.col.objects:
        if obj.type != 'MESH': continue
        offset = len(vertices)
        vertices.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        faces.extend(tuple(offset+i for i in face.vertices) for face in obj.data.polygons)
        owners.extend(obj.name for face in obj.data.polygons)
    tree = BVHTree.FromPolygons(vertices,faces)
    readings = []
    for spec in KIOSKS:
        x,y,z,_ = standing_pose(spec)
        hit,_,_,_ = tree.ray_cast(Vector((x,y,z+.3)),Vector((0,0,-1)),.6)
        nearest = min((tree.find_nearest(Vector((x,y,z+h))) for h in (.5,1,1.6)),key=lambda hit:hit[3])
        if hit is None or abs(hit.z-z)>.06 or nearest[3]<.405:
            raise ValueError(f'Borne {spec.name} : sol {None if hit is None else hit.z}, dégagement {nearest[3]:.3f}, obstacle {owners[nearest[2]]}')
        body = bpy.data.objects['use_borne_metro_'+spec.name]
        reach = (body.location-Vector((x,y,z+1.6))).length
        if reach>2: raise ValueError('Borne hors de portée : '+spec.name)
        readings.append({'borne':spec.name,'perk':spec.perk,'prix':spec.price,
                         'sol':round(hit.z,3),'degagement':round(nearest[3],3),'portee':round(reach,3)})
    return readings


def main():
    path = Path(bpy.data.filepath).resolve()
    if path != ROOT/'assets_src/blender/metro_blockout.blend':
        raise ValueError('Ouvrir le métro livré')
    a = ExistingAuthor()
    build(a)
    placements = check_placements(a)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    exported = C.export(out=ROOT/'public/assets/levels/metro_blockout.glb',niveau='metro')
    if not exported.get('ok'): raise ValueError(exported.get('lines'))
    print('[metro-kiosks] '+json.dumps({'bornes':placements,'export':True}))
    if '--sans-apercus' not in sys.argv:
        print('[metro-kiosks] '+json.dumps(C.sheet([standing_pose(spec,2.5) for spec in KIOSKS],
                                                 cols=2,taille=(640,360),mode='material',nom='metro_bornes',voyage='depart')))


if __name__ == '__main__':
    main()
