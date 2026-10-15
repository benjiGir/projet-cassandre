"""Distribution électrique et descente, après le premier établi.

see: docs/4-technique/blockout-metro.md#galeries-de-service
"""
from mathutils import Vector

from tools.metro.blockout import layout as P
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


def tube(p,a,b,radius,material='ivoire'):
    a,b=Vector(a),Vector(b)
    center=(a+b)/2
    obj=p.cylinder((0,0,0),radius,(b-a).length,material,'Z',10)
    rotation=(b-a).to_track_quat('Z','Y').to_matrix()
    for vertex in obj.data.vertices:
        vertex.co=rotation @ vertex.co+center


def prepare_materials(a):
    material=a.mats['petrole'].copy()
    material.name='metro_distribution_peinture_ivoire'
    material.diffuse_color=a.mats['ivoire'].diffuse_color
    material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=material.diffuse_color
    a.mats['armoire_ivoire']=material


def distribution(p,z):
    x,y=43.25,218.008
    p.proxy((x,y,z),(1.3,.34,1.99))
    p.box((x,y,z),(1.3,.28,.12),'acier')
    p.box((x,y+.018,z+.12),(1.3,.26,1.83),'acier')
    p.box((x-.025,y+.005,z+1.95),(1.35,.30,.04),'acier')
    for dx,width in ((.035,.87),(.935,.33)):
        p.box((x+dx,y+.282,z+.17),(width,.023,1.72),'armoire_ivoire')
    for high in (.35,1.65):
        p.cylinder((x+.065,y+.308,z+high),.028,.12,'acier','Z',10)
    p.box((x+.80,y+.308,z+.91),(.035,.028,.24),'acier')
    p.box((x+.785,y+.338,z+.96),(.065,.027,.14),'nuit')
    p.box((x+.235,y+.308,z+1.35),(.36,.026,.24),'acier')
    p.box((x+.27,y+.337,z+1.39),(.29,.013,.15),'nuit')
    for i in range(3):
        p.box((x+.30+i*.08,y+.352,z+1.435),(.047,.008,.03),'petrole')
    p.box((x+.22,y+.308,z+.82),(.40,.02,.30),'acier')
    for i in range(3):
        p.box((x+.25+i*.115,y+.331,z+.86),(.085,.018,.21),'ivoire')
        p.box((x+.268+i*.115,y+.352,z+.955),(.05,.028,.055),'nuit')
    for i in range(6):
        p.box((x+.995,y+.31,z+.42+i*.075),(.21,.025,.026),'acier')
    p.mesh([(x+.345,y+.33,z+.39),(x+.535,y+.33,z+.39),
            (x+.44,y+.33,z+.565)],[(0,1,2)],'ambre')
    p.mesh([(x+.448,y+.337,z+.53),(x+.415,y+.337,z+.465),
            (x+.45,y+.337,z+.465),(x+.435,y+.337,z+.41),
            (x+.478,y+.337,z+.484),(x+.446,y+.337,z+.484)],
           [(0,1,2,3,4,5)],'nuit')
    p.beam((43.9,220.35,z+2.81),(43.9,218.16,z+2.81),.09,'acier')
    p.box((43.82,218.008,z+2.72),(.16,.055,.18),'acier')
    p.beam((43.9,218.16,z+2.81),(43.9,218.16,z+1.99),.075,'acier')
    for yy in (218.32,219.45,220.25):
        p.beam((43.9,yy,z+2.87),(43.9,yy,z+3.015),.035,'acier')
    for high in (2.15,2.62):
        p.beam((43.9,218.012,z+high),(43.9,218.16,z+high),.03,'acier')


def descending_rail(p):
    x=64.80
    points=[(x,y,P.galerie_z(x,y)+1.03) for y in (221.5,222,240,241.5)]
    for a,b in zip(points,points[1:]):
        tube(p,a,b,.027)
    for y in (221.5,241.5):
        z=P.galerie_z(x,y)+1.03
        tube(p,(x,y,z),(64.985,y,z),.027)
    for y in (221.8,225.5,229.5,233.5,237.5,241.2):
        z=P.galerie_z(x,y)+.96
        p.box((64.958,y-.065,z-.085),(.035,.13,.17),'acier')
        tube(p,(64.975,y,z),(64.80,y,z),.018,'acier')
        tube(p,(64.80,y,z),(64.80,y,z+.07),.018,'acier')


def plinth(p,x0,x1,y0,y1):
    vertices=[]
    for high in (.015,.195):
        vertices += [(x,y,P.galerie_z(x,y)+high)
                     for x,y in ((x0,y0),(x1,y0),(x1,y1),(x0,y1))]
    p.mesh(vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),
                     (1,2,6,5),(2,3,7,6),(3,0,4,7)],'ardoise')


def build(a):
    prepare_materials(a)
    p=Piece('n5_galerie_distribution',a.mats,
            'armoire raccordée au chemin de câbles ; main courante suivant la pente ; allée 2,15 m minimum')
    distribution(p,P.galerie_z(43.9,219.25))
    descending_rail(p)
    for y in (218.008,220.468):
        plinth(p,26.78,62.5,y,y+.024)
    for x in (62.508,64.968):
        for y0,y1 in ((220.53,222),(222,240),(240,242)):
            plinth(p,x,x+.024,y0,y1)
    install(a,p,(0,0,0))
