"""Équipements et cabines des toilettes publiques.

see: docs/assets/sanitaires-assets.md
"""
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

import lib_helpers as H
from tools.metro.quartier.materials import png

STALL_X = (56.65, 58.95, 61.25)
STALL_WIDTH = 2.30
STALL_FRONT = 12.85
STALL_BACK = 15.75
DOOR_WIDTH = 1.30
PALETTE = "palette"


class Form:
    def __init__(self):
        self.vertices, self.faces, self.colors = [], [], []

    def face(self, points, color):
        start = len(self.vertices)
        self.vertices.extend(points)
        self.faces.append(tuple(range(start, len(self.vertices))))
        self.colors.append(color)

    def box(self, bounds, color):
        x0, y0, z0, x1, y1, z1 = bounds
        v = [(x,y,z) for x in (x0,x1) for y in (y0,y1) for z in (z0,z1)]
        for face in ((0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)):
            self.face([v[i] for i in face], color)

    def oval(self, center, rings, colors, axis="z", segments=24):
        cx, cy, cz = center
        points = []
        for a, b, depth in rings:
            if axis == "z":
                points.append([(cx+a*math.cos(t),cy+b*math.sin(t),cz+depth)
                               for t in (i*2*math.pi/segments for i in range(segments))])
            else:
                points.append([(cx+depth,cy+a*math.cos(t),cz+b*math.sin(t))
                               for t in (i*2*math.pi/segments for i in range(segments))])
        for row in range(len(points)-1):
            for i in range(segments):
                j = (i+1)%segments
                self.face([points[row][i],points[row][j],points[row+1][j],points[row+1][i]],
                          colors[min(row,len(colors)-1)])

    def tube(self, points, radius=.025, color="#a2a3a1", segments=8):
        for a, b in zip(points, points[1:]):
            a, b = Vector(a), Vector(b)
            direction = (b-a).normalized()
            tangent = direction.cross(Vector((0,0,1)))
            if tangent.length < .01:
                tangent = direction.cross(Vector((0,1,0)))
            tangent.normalize()
            bitangent = direction.cross(tangent).normalized()
            ring = [radius*(tangent*math.cos(i*2*math.pi/segments)+bitangent*math.sin(i*2*math.pi/segments))
                    for i in range(segments)]
            for i in range(segments):
                j = (i+1)%segments
                self.face([a+ring[i],a+ring[j],b+ring[j],b+ring[i]],color)
            self.face([a+v for v in reversed(ring)],color)
            self.face([b+v for v in ring],color)

    def finish(self, name, collection):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        mesh.materials.append(H.textured_material(PALETTE))
        uv = mesh.uv_layers.new(name="UVMap")
        for polygon, color in zip(mesh.polygons, self.colors):
            swatch = H.PALETTE.index(color)
            coord = (((swatch % 8)+.5)/8, 1-((swatch//8)+.5)/8)
            for loop in polygon.loop_indices:
                uv.data[loop].uv = coord
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        return obj


def toilet(name, x, y, props):
    g = Form()
    g.oval((x,y,0),[(.17,.22,0),(.21,.28,.08),(.17,.24,.29),(.28,.36,.40)],
           ["#a2a3a1","#f2efe6","#f2efe6"])
    g.oval((x,y,0),[(.28,.36,.40),(.34,.43,.46),(.34,.43,.50),(.24,.32,.50),
                   (.22,.28,.46),(.11,.15,.32),(.001,.001,.32)],
           ["#f2efe6","#a2a3a1","#f2efe6","#f2efe6","#a2a3a1","#605c58"])
    g.oval((x,y,0),[(.35,.445,.505),(.35,.445,.53),(.25,.325,.53),(.25,.325,.505)],
           ["#a2a3a1","#f2efe6","#f2efe6"])
    g.box((x-.27,y+.29,.51,x+.27,y+.48,.94),"#f2efe6")
    g.box((x-.285,y+.275,.94,x+.285,y+.50,.98),"#a2a3a1")
    g.box((x-.065,y+.355,.985,x+.065,y+.425,1.00),"#a2a3a1")
    obj = g.finish(name,props)
    obj["sorte"],obj["pv"] = "cuvette",50
    return obj


def basin(name, x, props):
    g = Form()
    g.oval((x,6.85,0),[(.001,.001,.68),(.26,.17,.69),(.60,.32,.83),(.72,.39,.91),
                       (.72,.39,.95),(.51,.27,.95),(.47,.24,.90),(.30,.15,.75),(.04,.04,.73)],
           ["#a2a3a1","#f2efe6","#f2efe6","#f2efe6","#f2efe6","#f2efe6","#a2a3a1","#a2a3a1"])
    g.oval((x,6.85,0),[(.04,.04,.735),(.001,.001,.735)],["#444a54"],segments=12)
    g.box((x-.66,6.30,.90,x+.66,6.45,1.02),"#f2efe6")
    return g.finish(name,props)


def urinal(name, y, props):
    g = Form()
    g.oval((63.75,y,.94),[(.001,.001,-.025),(.25,.40,-.025),(.27,.40,-.14),
                         (.245,.36,-.38),(.195,.30,-.38),(.16,.25,-.18),(.001,.001,-.12)],
           ["#a2a3a1","#f2efe6","#f2efe6","#f2efe6","#a2a3a1","#a2a3a1"],axis="x")
    g.oval((63.51,y,0),[(.001,.001,.53),(.17,.18,.54),(.24,.25,.72),(.24,.25,.77),
                       (.18,.19,.77),(.13,.13,.66),(.025,.025,.64)],
           ["#a2a3a1","#f2efe6","#f2efe6","#f2efe6","#a2a3a1","#a2a3a1"])
    g.oval((63.51,y,0),[(.025,.025,.645),(.001,.001,.645)],["#444a54"],segments=12)
    g.box((63.65,y-.04,1.37,63.73,y+.04,1.50),"#a2a3a1")
    obj = g.finish(name,props)
    obj["sorte"],obj["pv"] = "urinoir",50
    return obj


def door_material():
    root = Path(__file__).resolve().parents[2]
    a = np.full((128,128,3),(83,125,116),dtype=np.uint8)
    y,x = np.mgrid[:128,:128]
    noise = (x*37+y*17+x*y*3)%101
    a[(noise<2)&(x<96)] = (72,115,105)
    a[:,96:] = (168,177,170)
    a[64:96,96:] = (48,59,66)
    a[96:,96:] = (83,125,116)
    path = root / "assets_src/library/art_direction/textures/wc_porte.png"
    png(path,a)
    mat = H.textured_material("palette").copy()
    mat.name = "mat_wc_cabine"
    for node in mat.node_tree.nodes:
        if node.type == "TEX_IMAGE":
            node.image = bpy.data.images.load(str(path),check_existing=False)
            node.image.pack()
    return mat


def door(i, left, props, mat):
    x,y = left+.32,STALL_FRONT
    g = Form()
    g.box((x,y-.025,.15,x+DOOR_WIDTH,y+.025,2.15),"#237978")
    for z in (.45,1.75):
        g.box((x,y-.055,z,x+.055,y+.055,z+.18),"#a2a3a1")
    g.box((x+1.10,y-.055,.98,x+1.23,y+.055,1.22),"#a2a3a1")
    g.box((x+1.11,y-.10,1.08,x+1.23,y-.055,1.13),"#444a54")
    g.box((x+1.15,y-.057,1.17,x+1.20,y-.056,1.20),"#237978")
    obj = g.finish(f"door_wc_cabine_{i}",props)
    uv = obj.data.uv_layers.active
    for polygon,color in zip(obj.data.polygons,g.colors):
        for loop in polygon.loop_indices:
            v = obj.data.vertices[obj.data.loops[loop].vertex_index].co
            if color == "#237978":
                uv.data[loop].uv = (.015+.70*max(0,min(1,(v.x-x)/DOOR_WIDTH)),.02+.96*max(0,min(1,(v.z-.15)/2)))
            else:
                uv.data[loop].uv = (.875,.40 if color=="#444a54" else .75)
    obj.data.materials[0] = mat
    for key,value in {"mouvement":"battant","charniere":"min","angle":90,"sens":"+",
                      "ouverte":True,"manuelle":True,"referme":False,"duree":.35}.items():
        obj[key] = value
    return obj


def mirror(name, x, props):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x-.68,6.335,1.22),(x+.68,6.335,1.22),(x+.68,6.335,2.35),(x-.68,6.335,2.35)],[],[(3,2,1,0)])
    mesh.update()
    mesh.materials.append(H.textured_material("palette"))
    uv = mesh.uv_layers.new(name="UVMap")
    swatch = H.PALETTE.index("#a2a3a1")
    for loop in uv.data:
        loop.uv = (((swatch % 8)+.5)/8, 1-((swatch//8)+.5)/8)
    obj = bpy.data.objects.new(name,mesh)
    props.objects.link(obj)
    obj["miroir"] = True


def build(props, col):
    panels, feet, trim, pipes, taps, frames = Form(),Form(),Form(),Form(),Form(),Form()
    mat = door_material()
    for i,left in enumerate(STALL_X):
        if i == 0:
            panels.box((left,STALL_FRONT,.15,left+.05,STALL_BACK,2.20),"#237978")
        right = 63.70 if i == 2 else left+STALL_WIDTH-.05
        panels.box((right,STALL_FRONT,.15,right+.05,STALL_BACK,2.20),"#237978")
        H.col_box(f"wc_cloison{i}",(right-.035,STALL_FRONT,0,right+.085,STALL_BACK,2.20),col)
        if i==0:
            H.col_box("wc_cloison_ouest",(left-.035,STALL_FRONT,0,left+.085,STALL_BACK,2.20),col)
        for a,b in ((left,left+.30),(left+.32+DOOR_WIDTH+.02,right+.05)):
            panels.box((a,STALL_FRONT-.03,.15,b,STALL_FRONT+.03,2.20),"#237978")
            H.col_box(f"wc_facade{i}_{a:g}",(a,STALL_FRONT-.06,0,b,STALL_FRONT+.06,2.20),col)
        for x in (left+.08,right-.04):
            feet.box((x-.025,STALL_FRONT-.06,0,x+.025,STALL_FRONT+.06,.24),"#a2a3a1")
        door(i,left,props,mat)
        toilet(f"sanitaire_cuvette{i}",left+1.08,15.12,props)
        holder = Form()
        holder.box((right-.08,14.5,.68,right+.02,14.62,.80),"#a2a3a1")
        holder.tube([(right-.22,14.56,.80),(right-.10,14.56,.80)],radius=.09,color="#f2efe6",segments=12)
        holder.tube([(right-.225,14.56,.80),(right-.22,14.56,.80)],radius=.024,color="#605c58",segments=12)
        holder.finish(f"wc_papier{i}",props)
    panels.finish("wc_cloisons",props)
    feet.finish("wc_pieds",props)
    trim.box((STALL_X[0],STALL_FRONT-.045,2.20,63.60,STALL_FRONT+.045,2.26),"#a2a3a1")
    trim.finish("wc_lisse",props)
    for i,x in enumerate((57.70,59.40)):
        basin(f"wc_lavabo{i}",x,props)
        H.col_box(f"wc_lavabo{i}",(x-.72,6.30,.68,x+.72,7.24,1.02),col)
        pipes.tube([(x,6.85,.72),(x,6.85,.48),(x,6.70,.40),(x,6.48,.46),(x,6.30,.46)],radius=.035)
        taps.tube([(x,6.48,.97),(x,6.48,1.16),(x,6.54,1.22),(x,6.74,1.22),(x,6.80,1.18)],radius=.035)
        taps.box((x-.04,6.44,1.17,x+.04,6.57,1.22),"#a2a3a1")
        mirror(f"wc_miroir{i}",x,props)
        for bounds in ((x-.72,6.28,1.18,x+.72,6.32,1.23),(x-.72,6.28,2.34,x+.72,6.32,2.39),
                       (x-.72,6.28,1.18,x-.675,6.32,2.39),(x+.675,6.28,1.18,x+.72,6.32,2.39)):
            frames.box(bounds,"#a2a3a1")
    frames.finish("wc_cadres_miroirs",props)
    taps.finish("wc_robinets",props)
    for i,y in enumerate((9.5,11.0)):
        urinal(f"sanitaire_urinoir{i}",y,props)
        pipes.tube([(63.68,y,1.32),(63.68,y,1.55)],radius=.025)
    pipes.finish("wc_tuyaux",props)
    H.box("wc_urinoir_separation",(63.12,10.23,.45,63.75,10.28,1.48),"palette",props,uv="aplat:#237978")
    H.box("wc_seche_mains",(60.65,6.30,1.12,61.20,6.50,1.48),"metal_bac_acier",props)
    H.box("wc_seche_mains_sortie",(60.71,6.51,1.13,61.14,6.53,1.19),"palette",props,uv="aplat:#444a54")
    H.box("wc_plaque_chasse",(57.66,15.70,1.20,57.88,15.74,1.35),"metal_bac_acier",props)
    bin_form = Form()
    bin_form.oval((61.65,6.80,0),[(.20,.20,0),(.22,.22,.55),(.24,.24,.59),(.13,.13,.62)],
                  ["#a2a3a1","#444a54","#444a54"],segments=12)
    bin_form.finish("wc_poubelle",props)
    H.col_box("wc_poubelle",(61.43,6.58,0,61.87,7.02,.62),col)
    return {"cabines":3,"dimensions_cabine_min":[2.20,2.87],"passage_portes":1.30,
            "lavabos":2,"dimensions_lavabo":[1.44,.94],"miroirs":2,"sanitaires":5}
