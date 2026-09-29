"""Build two original low-poly motorcycles without changing the open Blender file.

Run in Blender's Python Console:
    p = '/absolute/path/tools/blender/propositions_motos.py'
    exec(compile(open(p).read(), p, 'exec'), {'__file__': p})
"""

from __future__ import annotations

import math
import os

import bpy
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets_src", "blender", "propositions_motos")
BLEND = os.path.join(ROOT, "assets_src", "blender", "propositions_motos.blend")
SHEET = os.path.join(OUT, "planche_motos.png")
CROSS = os.path.join(OUT, "motocross.png")
CUSTOM = os.path.join(OUT, "custom.png")
SILHOUETTES = os.path.join(OUT, "silhouettes_motos.png")


def color(hex_value):
    raw = hex_value.lstrip("#")
    channels = [int(raw[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
              for v in channels]
    return (*linear, 1.0)


class Builder:
    def __init__(self):
        self.vertices = []
        self.faces = []
        self.colors = []

    def face(self, points, swatch):
        first = len(self.vertices)
        self.vertices.extend(tuple(point) for point in points)
        self.faces.append(tuple(range(first, first + len(points))))
        self.colors.append(color(swatch))

    def box(self, center, size, swatch):
        cx, cy, cz = center
        hx, hy, hz = (v / 2 for v in size)
        vertices = [(cx-hx,cy-hy,cz-hz),(cx+hx,cy-hy,cz-hz),
                    (cx+hx,cy+hy,cz-hz),(cx-hx,cy+hy,cz-hz),
                    (cx-hx,cy-hy,cz+hz),(cx+hx,cy-hy,cz+hz),
                    (cx+hx,cy+hy,cz+hz),(cx-hx,cy+hy,cz+hz)]
        for indices in ((0,3,2,1),(4,5,6,7),(0,1,5,4),
                        (1,2,6,5),(2,3,7,6),(3,0,4,7)):
            self.face([vertices[i] for i in indices], swatch)

    def prism(self, profile, width, swatch, x=0):
        half = width / 2
        self.face([(x+half,y,z) for y,z in profile], swatch)
        self.face([(x-half,y,z) for y,z in reversed(profile)], swatch)
        for index, (y0,z0) in enumerate(profile):
            y1,z1 = profile[(index+1) % len(profile)]
            self.face([(x-half,y0,z0),(x-half,y1,z1),
                       (x+half,y1,z1),(x+half,y0,z0)], swatch)

    def tube(self, a, b, radius, swatch, segments=6):
        a, b = Vector(a), Vector(b)
        axis = (b-a).normalized()
        helper = Vector((1,0,0)) if abs(axis.x) < 0.88 else Vector((0,0,1))
        u = axis.cross(helper).normalized()
        v = axis.cross(u).normalized()
        start = [a + radius*(u*math.cos(math.tau*i/segments)
                            + v*math.sin(math.tau*i/segments))
                 for i in range(segments)]
        end = [b + radius*(u*math.cos(math.tau*i/segments)
                          + v*math.sin(math.tau*i/segments))
               for i in range(segments)]
        self.face(start[::-1], swatch)
        self.face(end, swatch)
        for i in range(segments):
            j = (i+1) % segments
            self.face((start[i],start[j],end[j],end[i]), swatch)

    def wheel(self, y, z, radius, width, rim_color, knobby=False):
        segments = 14
        inner = radius * (0.71 if knobby else 0.68)
        half = width / 2
        for i in range(segments):
            a, b = math.tau*i/segments, math.tau*(i+1)/segments
            ca, sa, cb, sb = math.cos(a),math.sin(a),math.cos(b),math.sin(b)
            for side in (-1,1):
                x = side*half
                self.face([(x,y+radius*ca,z+radius*sa),
                           (x,y+radius*cb,z+radius*sb),
                           (x,y+inner*cb,z+inner*sb),
                           (x,y+inner*ca,z+inner*sa)], "#202123")
                rim_x = x + side*0.003
                self.face([(rim_x,y+inner*ca,z+inner*sa),
                           (rim_x,y+inner*cb,z+inner*sb),
                           (rim_x,y+inner*0.78*cb,z+inner*0.78*sb),
                           (rim_x,y+inner*0.78*ca,z+inner*0.78*sa)], rim_color)
            self.face([(-half,y+radius*ca,z+radius*sa),
                       (-half,y+radius*cb,z+radius*sb),
                       (half,y+radius*cb,z+radius*sb),
                       (half,y+radius*ca,z+radius*sa)], "#282a2a")
            if knobby and i % 2 == 0:
                mid = (a+b)/2
                self.tube((-half*1.18,y+(radius+0.014)*math.cos(mid),
                           z+(radius+0.014)*math.sin(mid)),
                          (half*1.18,y+(radius+0.014)*math.cos(mid),
                           z+(radius+0.014)*math.sin(mid)),
                          0.023,"#252626",5)
        for side in (-1,1):
            x = side*(half+0.006)
            for i in range(10):
                a = math.tau*i/10
                self.tube((x,y,z),
                          (x,y+inner*0.78*math.cos(a),z+inner*0.78*math.sin(a)),
                          0.009, rim_color, 5)
        self.tube((-half-0.014,y,z),(half+0.014,y,z),0.056,
                  "#a8a9a0" if knobby else "#c3beb2",8)

    def arc(self, y, z, radius, start_angle, end_angle, width, thickness, swatch):
        segments = 10
        for i in range(segments):
            a = start_angle+(end_angle-start_angle)*i/segments
            b = start_angle+(end_angle-start_angle)*(i+1)/segments
            profile = [(y+(radius+thickness)*math.cos(a),
                        z+(radius+thickness)*math.sin(a)),
                       (y+(radius+thickness)*math.cos(b),
                        z+(radius+thickness)*math.sin(b)),
                       (y+radius*math.cos(b),z+radius*math.sin(b)),
                       (y+radius*math.cos(a),z+radius*math.sin(a))]
            self.prism(profile,width,swatch)

    def cylinder_y(self, center, radius, depth, swatch, segments=10):
        x,y,z = center
        front = [(x+radius*math.cos(math.tau*i/segments),y+depth/2,
                  z+radius*math.sin(math.tau*i/segments)) for i in range(segments)]
        back = [(px,y-depth/2,pz) for px,_,pz in front]
        self.face(front,swatch)
        self.face(back[::-1],swatch)
        for i in range(segments):
            j=(i+1)%segments
            self.face((front[i],back[i],back[j],front[j]),swatch)

    def build(self, name, collection, material, location):
        mesh=bpy.data.meshes.new(f"{name}_mesh")
        mesh.from_pydata(self.vertices,[],self.faces)
        mesh.materials.append(material)
        mesh.update()
        attribute=mesh.color_attributes.new(name="Col",type="FLOAT_COLOR",domain="CORNER")
        mesh.color_attributes.active_color=attribute
        for polygon in mesh.polygons:
            for loop in polygon.loop_indices:
                attribute.data[loop].color=self.colors[polygon.index]
        obj=bpy.data.objects.new(name,mesh)
        collection.objects.link(obj)
        obj.location=location
        obj.select_set(False)
        return obj


def material(name):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    mat.use_backface_culling=False
    shader=mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value=0.73
    node=mat.node_tree.nodes.new("ShaderNodeVertexColor")
    node.layer_name="Col"
    mat.node_tree.links.new(node.outputs["Color"],shader.inputs["Base Color"])
    return mat


def plain(name, swatch):
    mat=bpy.data.materials.new(name)
    mat.diffuse_color=color(swatch)
    mat.use_nodes=True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=color(swatch)
    return mat


def motocross(b):
    front,rear=0.74,-0.74
    b.wheel(front,0.35,0.35,0.075,"#b7b9b1",True)
    b.wheel(rear,0.32,0.32,0.12,"#b7b9b1",True)
    for side in (-1,1):
        x=side*0.10
        b.tube((x,front,0.35),(x,0.43,1.11),0.024,"#b9b9ac")
        b.tube((x,0.45,1.04),(x,-0.27,0.76),0.027,"#a5a8a2")
        b.tube((x,-0.27,0.76),(x,rear,0.32),0.025,"#888e87")
        b.tube((x,rear,0.32),(x,-0.06,0.48),0.026,"#7a827c")
        b.tube((x,-0.06,0.48),(x,0.45,1.04),0.024,"#888e87")
        b.tube((x,-0.06,0.48),(x,-0.27,0.76),0.021,"#888e87")
    b.prism([(0.15,0.43),(0.17,0.57),(0.03,0.65),(-0.18,0.61),
             (-0.20,0.47)],0.28,"#4e5656")
    for side in (-1,1):
        x=side*0.184
        b.box((x,-0.02,0.56),(0.035,0.25,0.15),"#7d8582")
        for z in (0.50,0.56,0.62):
            b.box((x+side*0.018,-0.02,z),(0.055,0.26,0.015),"#a5aaa1")
    b.prism([(0.37,0.85),(0.28,1.00),(-0.11,0.99),(-0.32,0.84)],
            0.30,"#ca6338")
    for side in (-1,1):
        x=side*0.16
        b.prism([(0.35,0.87),(0.21,1.02),(0.00,0.99),(-0.15,0.79)],
                0.028,"#f1ead6",x=x)
        b.prism([(-0.29,0.77),(-0.11,0.89),(-0.55,0.86),(-0.73,0.69)],
                0.024,"#f0e8d3",x=x)
    b.prism([(0.18,1.00),(-0.39,1.00),(-0.68,0.94),(-0.57,0.88),
             (-0.05,0.91)],0.22,"#282c2c")
    b.prism([(-0.40,0.93),(-0.82,0.89),(-1.04,0.79),(-0.94,0.77),
             (-0.48,0.85)],0.17,"#ca6338")
    b.prism([(0.54,0.83),(1.03,0.89),(1.07,0.83),(0.60,0.77)],
            0.17,"#ca6338")
    b.box((0,0.56,1.07),(0.27,0.045,0.22),"#f0e9d6")
    b.box((0,0.584,1.05),(0.19,0.012,0.052),"#303534")
    b.tube((-0.10,0.45,1.15),(0.10,0.45,1.15),0.025,"#aeb2a8")
    b.tube((-0.10,0.45,1.15),(-0.40,0.47,1.25),0.017,"#9da49e")
    b.tube((0.10,0.45,1.15),(0.40,0.47,1.25),0.017,"#9da49e")
    for side in (-1,1):
        b.tube((side*0.34,0.47,1.25),(side*0.43,0.48,1.25),
               0.025,"#282d2c")
    b.tube((0.19,-0.08,0.62),(0.22,-0.42,0.79),0.023,"#939b94")
    b.tube((0.22,-0.42,0.79),(0.22,-0.76,0.83),0.043,"#666d68")
    b.box((0.20,-0.70,0.85),(0.10,0.29,0.10),"#555d58")
    b.tube((-0.20,-0.20,0.43),(0.20,-0.20,0.43),0.016,"#a4a9a1")
    return {"kind":"motocross","dimensions_m":[2.18,0.86,1.28],
            "wheelbase_m":1.48,"style":"motocross haute, pneus à crampons"}


def custom(b):
    front,rear=0.815,-0.815
    b.wheel(front,0.33,0.33,0.10,"#b8b8ad")
    b.wheel(rear,0.31,0.31,0.17,"#b8b8ad")
    for side in (-1,1):
        x=side*0.12
        b.tube((x,front,0.33),(x,0.52,0.91),0.030,"#b5b2aa")
        b.tube((x,0.51,0.88),(x,-0.23,0.69),0.030,"#333639")
        b.tube((x,-0.23,0.69),(x,rear,0.31),0.032,"#35383b")
        b.tube((x,rear,0.31),(x,-0.06,0.38),0.032,"#303337")
        b.tube((x,-0.06,0.38),(x,0.51,0.88),0.028,"#35383b")
    b.prism([(0.20,0.30),(0.16,0.46),(-0.15,0.48),(-0.25,0.35)],
            0.36,"#26292b")
    for direction in (-1,1):
        ytop=direction*0.15
        b.tube((0,-0.04,0.42),(0,ytop,0.72),0.105,"#3a3e40",8)
        for i in range(5):
            t=(i+1)/6
            y=-0.04+(ytop+0.04)*t
            z=0.42+(0.72-0.42)*t
            b.box((0,y,z),(0.34,0.075,0.022),"#a8a8a0")
    for side in (-1,1):
        b.tube((side*0.22,-0.03,0.42),(side*0.25,-0.06,0.42),
               0.12,"#b2b2a8",10)
        b.tube((side*0.24,0.03,0.49),(side*0.28,-0.54,0.38),
               0.030,"#a0a29c")
        b.tube((side*0.28,-0.54,0.38),(side*0.28,-1.08,0.38),
               0.043,"#b8b8af")
        b.tube((side*0.24,-0.06,0.42),(side*0.29,-0.56,0.29),
               0.025,"#8c8f89")
        b.tube((side*0.29,-0.56,0.29),(side*0.29,-1.02,0.29),
               0.034,"#aeb0a8")
    b.prism([(0.39,0.76),(0.27,0.91),(-0.05,0.89),(-0.34,0.72),
             (-0.14,0.68)],0.42,"#783e42")
    for side in (-1,1):
        b.prism([(0.23,0.88),(-0.06,0.86),(-0.23,0.73),(-0.06,0.74)],
                0.012,"#c7b795",x=side*0.217)
    b.prism([(-0.29,0.72),(-0.55,0.69),(-0.70,0.62),(-0.51,0.61),
             (-0.21,0.65)],0.32,"#252729")
    b.prism([(-0.58,0.57),(-0.94,0.57),(-1.16,0.46),(-1.08,0.42),
             (-0.72,0.51)],0.24,"#783e42")
    b.arc(rear,0.31,0.34,0.32,2.64,0.22,0.035,"#783e42")
    b.arc(front,0.33,0.36,0.55,2.56,0.15,0.025,"#783e42")
    b.cylinder_y((0,0.66,0.89),0.14,0.085,"#bfbdb2")
    b.cylinder_y((0,0.713,0.89),0.105,0.012,"#eee8ca")
    b.tube((-0.12,0.48,0.97),(0.12,0.48,0.97),0.030,"#a7a9a2")
    for side in (-1,1):
        b.tube((side*0.12,0.48,0.97),(side*0.32,0.43,1.13),
               0.020,"#b6b9ad")
        b.tube((side*0.32,0.43,1.13),(side*0.45,0.43,1.14),
               0.021,"#b6b9ad")
        b.tube((side*0.39,0.43,1.14),(side*0.46,0.43,1.14),
               0.027,"#282a2c")
        b.tube((side*0.23,-0.34,0.38),(side*0.39,-0.40,0.37),
               0.022,"#b0b2a9")
    b.box((0,-1.08,0.51),(0.13,0.04,0.08),"#a7453e")
    return {"kind":"custom","dimensions_m":[2.32,0.92,1.16],
            "wheelbase_m":1.63,"style":"custom basse, moteur en V et doubles échappements"}


def aim(obj, target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()


def text_object(name, label, location, size, mat, coll):
    curve=bpy.data.curves.new(name,"FONT")
    curve.body=label
    curve.size=size
    obj=bpy.data.objects.new(name,curve)
    coll.objects.link(obj)
    obj.location=location
    curve.materials.append(mat)
    return obj


def run():
    os.makedirs(OUT,exist_ok=True)
    window=bpy.context.window
    original_scene=window.scene if window else bpy.context.scene
    original_active=bpy.context.view_layer.objects.active
    original_selected=list(bpy.context.selected_objects)
    scene=None
    created_collections=[]
    created_materials=[]
    created_worlds=[]
    result=""
    try:
        scene=bpy.data.scenes.new("PROPOSITIONS_MOTOS")
        scene.unit_settings.system="METRIC"
        scene.unit_settings.scale_length=1.0
        scene.render.engine="BLENDER_EEVEE"
        scene.render.resolution_x=2200
        scene.render.resolution_y=1100
        scene.render.resolution_percentage=100
        scene.render.image_settings.file_format="PNG"
        scene.view_settings.view_transform="Standard"
        scene.view_settings.look="Medium High Contrast"
        scene.world=bpy.data.worlds.new("MONDE_PROPOSITIONS_MOTOS")
        created_worlds.append(scene.world)
        scene.world.use_nodes=True
        background=scene.world.node_tree.nodes.get("Background")
        background.inputs["Color"].default_value=color("#989e9e")
        background.inputs["Strength"].default_value=0.45
        vehicles=bpy.data.collections.new("MOTOS_MODELES_ORIGINAUX")
        studio=bpy.data.collections.new("PRESENTATION_MOTOS")
        created_collections.extend((vehicles,studio))
        scene.collection.children.link(vehicles)
        scene.collection.children.link(studio)
        bike_mat=material("MAT_MOTOS_COL_V1")
        floor_mat=plain("MAT_SOL_MOTOS","#424749")
        line_mat=plain("MAT_LIGNES_MOTOS","#bab9ae")
        title_mat=plain("MAT_LABEL_MOTOS","#ece8d9")
        dark_mat=plain("MAT_SILHOUETTE_MOTOS","#101112")
        created_materials.extend((bike_mat,floor_mat,line_mat,title_mat,dark_mat))
        bike_objects=[]
        for name,factory,x_pos in (("proposition_motocross",motocross,2.15),
                                   ("proposition_custom",custom,-2.15)):
            builder=Builder()
            info=factory(builder)
            obj=builder.build(name,vehicles,bike_mat,(x_pos,0,0))
            obj["type_vehicule"]=info["kind"]
            obj["dimensions_m"]=info["dimensions_m"]
            obj["empattement_m"]=info["wheelbase_m"]
            obj["style"]=info["style"]
            obj["triangles_estimees"]=sum(len(p.vertices)-2 for p in obj.data.polygons)
            obj["orientation"]="avant vers +Y Blender"
            bike_objects.append(obj)
        ground_builder=Builder()
        ground_builder.box((0,0,-0.16),(9.0,7.0,0.30),"#424749")
        ground=ground_builder.build("sol_presentation_motos",studio,floor_mat,(0,0,0))
        ground.data.color_attributes.remove(ground.data.color_attributes["Col"])
        line_builder=Builder()
        for x in (-4.0,0.0,4.0):
            line_builder.box((x,0,-0.005),(0.035,3.5,0.01),"#bab9ae")
        lines=line_builder.build("lignes_presentation_motos",studio,line_mat,(0,0,0))
        lines.data.color_attributes.remove(lines.data.color_attributes["Col"])
        for label,dimensions,x in (("MOTOCROSS","2,18 × 0,86 × 1,28 m",2.15),
                                    ("CUSTOM","2,32 × 0,92 × 1,16 m",-2.15)):
            title=text_object(f"titre_{label.lower()}",label,(x+0.58,2.12,0.008),
                              0.25,title_mat,studio)
            cotes=text_object(f"cotes_{label.lower()}",dimensions,
                              (x+0.58,1.84,0.008),0.12,title_mat,studio)
            title.rotation_euler.z=math.pi
            cotes.rotation_euler.z=math.pi
        cam_data=bpy.data.cameras.new("CAMERA_MOTOS")
        camera=bpy.data.objects.new("CAMERA_MOTOS",cam_data)
        studio.objects.link(camera)
        scene.camera=camera
        cam_data.type="ORTHO"
        cam_data.ortho_scale=7.7
        camera.location=(6.0,5.0,3.5)
        aim(camera,(0,0,0.60))
        for name,location,power,scale,swatch in (
                ("CLE",(2,5,7),1800,6,"#fff1dc"),
                ("REBOND",(-5,1,4),1100,5,"#cbdae1"),
                ("ARRIERE",(1,-5,5),1000,5,"#d9c6b0")):
            data=bpy.data.lights.new(f"MOTOS_{name}","AREA")
            data.energy=power
            data.shape="DISK"
            data.size=scale
            data.color=tuple(int(swatch[i:i+2],16)/255 for i in (1,3,5))
            lamp=bpy.data.objects.new(f"MOTOS_{name}",data)
            studio.objects.link(lamp)
            lamp.location=location
            aim(lamp,(0,0,0.5))
        if window:
            window.scene=scene
        bpy.context.view_layer.update()
        scene.render.filepath=SHEET
        bpy.ops.render.render(write_still=True)

        def closeup(obj,path,cam_pos,target,scale):
            previous={item:item.hide_render for item in scene.objects}
            old_position=obj.location.copy()
            old_camera=(camera.location.copy(),camera.rotation_euler.copy(),cam_data.ortho_scale)
            old_render=(scene.render.resolution_x,scene.render.resolution_y,scene.render.filepath)
            for other in bike_objects:
                if other!=obj:
                    other.hide_render=True
            for item in studio.objects:
                if item.type=="FONT" or item==lines:
                    item.hide_render=True
            obj.location=(0,0,0)
            camera.location=cam_pos
            aim(camera,target)
            cam_data.ortho_scale=scale
            scene.render.resolution_x=1400
            scene.render.resolution_y=1000
            scene.render.filepath=path
            bpy.context.view_layer.update()
            bpy.ops.render.render(write_still=True)
            for item,was_hidden in previous.items():
                item.hide_render=was_hidden
            obj.location=old_position
            camera.location,camera.rotation_euler,cam_data.ortho_scale=old_camera
            scene.render.resolution_x,scene.render.resolution_y,scene.render.filepath=old_render

        closeup(bike_objects[0],CROSS,(4.0,2.8,2.2),(0,0,0.62),3.2)
        closeup(bike_objects[1],CUSTOM,(4.0,2.8,2.2),(0,0,0.57),3.2)

        previous=(camera.location.copy(),camera.rotation_euler.copy(),cam_data.ortho_scale,
                  scene.render.resolution_x,scene.render.resolution_y,scene.render.filepath)
        visibility={item:item.hide_render for item in studio.objects}
        for item in studio.objects:
            if item!=camera:
                item.hide_render=True
        background.inputs["Color"].default_value=color("#fafaf6")
        background.inputs["Strength"].default_value=1.0
        for obj in bike_objects:
            obj.rotation_euler.z=-math.pi/2
            obj.data.materials[0]=dark_mat
        camera.location=(0,8,1.8)
        aim(camera,(0,0,0.63))
        cam_data.ortho_scale=7.5
        scene.render.resolution_x=2200
        scene.render.resolution_y=600
        scene.render.filepath=SILHOUETTES
        bpy.context.view_layer.update()
        bpy.ops.render.render(write_still=True)
        for obj in bike_objects:
            obj.rotation_euler.z=0
            obj.data.materials[0]=bike_mat
        for item,was_hidden in visibility.items():
            item.hide_render=was_hidden
        camera.location,camera.rotation_euler,cam_data.ortho_scale=previous[:3]
        scene.render.resolution_x,scene.render.resolution_y,scene.render.filepath=previous[3:]
        background.inputs["Color"].default_value=color("#989e9e")
        background.inputs["Strength"].default_value=0.45
        bpy.data.libraries.write(BLEND,{scene},compress=True)

        for obj in bike_objects:
            old_position=obj.location.copy()
            obj.location=(0,0,0)
            for item in scene.objects:
                item.select_set(item==obj)
            bpy.context.view_layer.objects.active=obj
            path=os.path.join(OUT,f"{obj['type_vehicule']}.glb")
            bpy.ops.export_scene.gltf(filepath=path,export_format="GLB",
                use_selection=True,export_apply=True,export_extras=True,
                export_vertex_color="ACTIVE",export_normals=True,
                export_tangents=False,export_yup=True,
                export_materials="EXPORT",export_animations=False,
                export_skins=False,export_draco_mesh_compression_enable=False)
            obj.location=old_position
        result=(f"MOTOS_OK\nBLEND={BLEND}\nPLANCHE={SHEET}\n"
                f"MOTOCROSS={CROSS}\nCUSTOM={CUSTOM}\n"
                +"\n".join(f"{obj['type_vehicule']}={obj['triangles_estimees']} triangles"
                           for obj in bike_objects))
    finally:
        if window:
            window.scene=original_scene
        if scene:
            for obj in list(scene.objects):
                data=obj.data
                group={"MESH":bpy.data.meshes,"FONT":bpy.data.curves,
                       "CAMERA":bpy.data.cameras,"LIGHT":bpy.data.lights}.get(obj.type)
                bpy.data.objects.remove(obj,do_unlink=True)
                if data and group is not None and data.users==0:
                    group.remove(data)
            bpy.data.scenes.remove(scene,do_unlink=True)
        for group in created_collections:
            if group.name in bpy.data.collections and group.users==0:
                bpy.data.collections.remove(group)
        for mat in created_materials:
            if mat.name in bpy.data.materials and mat.users==0:
                bpy.data.materials.remove(mat)
        for world in created_worlds:
            if world.name in bpy.data.worlds and world.users==0:
                bpy.data.worlds.remove(world)
        if original_active and original_active.name in bpy.context.view_layer.objects:
            bpy.context.view_layer.objects.active=original_active
        for obj in original_selected:
            if obj.name in bpy.context.view_layer.objects:
                obj.select_set(True)
        print(result)


if __name__ == "__main__":
    run()
