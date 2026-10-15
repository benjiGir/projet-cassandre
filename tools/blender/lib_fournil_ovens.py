"""Fours à soles et rôtissoire du fournil.

see: docs/4-technique/fours-fournil.md
"""
import math

import bpy
import lib_helpers as H


class Assembly:
    def __init__(self, name, props):
        self.name, self.props = name, props
        self.parts = {key: [] for key in ("inox", "noir", "sole", "chauffe", "pain")}
        self.windows, self.loaves = [], []

    def box(self, key, bounds):
        colors = {"inox": "#babcbc", "noir": "#444a54", "sole": "#deb789",
                  "chauffe": "#e8741c", "pain": "#b8612e"}
        self.parts[key].append((bounds, "aplat:" + colors[key]))

    def frame(self, x0, x1, y, z0, z1, width=.045):
        for bounds in ((x0,y,z0,x1,y+.06,z0+width), (x0,y,z1-width,x1,y+.06,z1),
                       (x0,y,z0,x0+width,y+.06,z1), (x1-width,y,z0,x1,y+.06,z1)):
            self.box("noir", bounds)
        self.windows.append(((x0+width,y+.023,z0+width,x1-width,y+.033,z1-width),
                             "aplat:"+H.VERRE_TEINTE))

    def finish(self):
        objects = []
        for key, parts in self.parts.items():
            if not parts:
                continue
            obj = H.boxes(self.name+"_"+key, parts, "palette", self.props)
            family = {"inox": "atelier_inox", "noir": "atelier_noir"}.get(key)
            mat = bpy.data.materials.get("da_"+family) if family else None
            if mat:
                from tools.art_direction.store_checkout import metric_uv
                metric_uv(obj)
                obj.data.materials[0] = mat
            objects.append(obj)
        if self.windows:
            glass = H.boxes("vitre_"+self.name, self.windows, "verre", self.props)
            glass["solide"] = False
            objects.append(glass)
        if self.loaves:
            objects.append(food_mesh(self.name+"_cuisson", self.loaves, self.props))
        return objects


def food_mesh(name, volumes, props):
    vertices, faces = [], []
    for center, scale in volumes:
        offset = len(vertices)
        for row in range(3):
            latitude = -.25*math.pi + row*math.pi/4
            for i in range(8):
                angle = i*math.pi/4
                vertices.append((center[0]+scale[0]*math.cos(latitude)*math.cos(angle),
                                 center[1]+scale[1]*math.cos(latitude)*math.sin(angle),
                                 center[2]+scale[2]*math.sin(latitude)))
        for row in range(2):
            for i in range(8):
                j = (i+1)%8
                faces.append(tuple(offset+k for k in (row*8+i,row*8+j,(row+1)*8+j,(row+1)*8+i)))
        bottom, top = len(vertices), len(vertices)+1
        vertices.extend([(center[0],center[1],center[2]-scale[2]),
                         (center[0],center[1],center[2]+scale[2])])
        for i in range(8):
            j = (i+1)%8
            faces.append((bottom,offset+j,offset+i))
            faces.append((top,offset+16+i,offset+16+j))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.materials.append(H.textured_material("palette"))
    uv = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        color = "#deb789" if polygon.normal.z > .45 else "#b8612e"
        swatch = H.PALETTE.index(color)
        coord = ((swatch%8+.5)/8,1-(swatch//8+.5)/8)
        for loop in polygon.loop_indices:
            uv.data[loop].uv = coord
    obj = bpy.data.objects.new(name, mesh)
    props.objects.link(obj)
    return obj


def hood(name, x0, x1, props):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x0,153.86,2.65),(x1,153.86,2.65),(x1,155.70,2.65),(x0,155.70,2.65),
                     (x0+.12,154.15,2.95),(x1-.12,154.15,2.95),
                     (x1-.12,155.70,2.95),(x0+.12,155.70,2.95)], [],
                    [(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)])
    mesh.update()
    mesh.materials.append(bpy.data.materials.get("da_atelier_inox") or H.textured_material("palette"))
    obj = bpy.data.objects.new(name, mesh)
    props.objects.link(obj)
    if mesh.materials[0].name.startswith("da_"):
        from tools.art_direction.store_checkout import metric_uv
        metric_uv(obj)
    else:
        uv = mesh.uv_layers.new(name="UVMap")
        swatch = H.PALETTE.index("#babcbc")
        for loop in uv.data:
            loop.uv = ((swatch%8+.5)/8,1-(swatch//8+.5)/8)
    return obj


def deck_ovens(props, col):
    g = Assembly("fournil_four", props)
    y, back = 154.18, 155.70
    hoods = []
    for bank, x0 in enumerate((11.0, 14.02)):
        x1 = x0+2.82
        g.box("inox", (x0,y,.12,x1,back,.55))
        g.box("noir", (x0+.08,y-.012,.19,x1-.08,y+.015,.27))
        for side in (x0, x1-.12):
            g.box("inox", (side,y,.55,side+.12,back,2.62))
        g.box("noir", (x0+.12,back-.10,.55,x1-.12,back,2.62))
        g.box("inox", (x0+.12,y,2.51,x1-.12,back,2.62))
        g.box("inox", (x1-.46,y-.02,.55,x1-.12,y+.14,2.51))
        g.box("noir", (x1-.43,y-.035,.72,x1-.15,y-.02,2.38))
        for tier in range(4):
            bottom = .62+tier*.46
            left, right = x0+.14, x1-.49
            g.box("sole", (left,y+.09,bottom,right,back-.10,bottom+.045))
            g.box("noir", (left,y+.09,bottom+.36,right,back-.10,bottom+.41))
            g.box("inox", (left,y-.05,bottom-.07,right,y+.11,bottom))
            mid = (left+right)/2
            for a,b in ((left,mid-.022),(mid+.022,right)):
                g.frame(a,b,y-.075,bottom+.045,bottom+.36)
                g.box("inox", (a+.10,y-.17,bottom+.05,b-.10,y-.13,bottom+.085))
                for hx in (a+.10,b-.14):
                    g.box("noir", (hx,y-.13,bottom+.05,hx+.04,y-.07,bottom+.085))
            g.box("chauffe", (left+.08,y+.32,bottom+.31,right-.08,y+.35,bottom+.335))
            for no in range(3 if bank==0 else 2):
                g.loaves.append(((left+.32+no*.52,y+.48,bottom+.12),(.14,.30,.075)))
            cx = x1-.29
            g.box("chauffe", (cx-.09,y-.05,bottom+.22,cx+.08,y-.034,bottom+.28))
            g.box("inox", (cx-.055,y-.09,bottom+.08,cx+.055,y-.05,bottom+.16))
        for v in range(5):
            g.box("noir", (x0+.28+v*.40,153.89,2.70,x0+.51+v*.40,153.905,2.74))
        hoods.append(hood(f"fournil_four_{bank+1}_hotte",x0-.06,x1+.06,props))
        g.box("inox", (x0+1.10,155.05,2.95,x0+1.55,155.55,4.48))
        H.col_box(f"fournil_four_{bank+1}",(x0,154.00,0,x1,back,2.65),col)
    return g.finish()+hoods


def rotisserie(props, col):
    g = Assembly("fournil_rotissoire", props)
    x0,x1,y,back = 17.15,19.10,154.62,155.70
    g.box("inox", (x0,y,.16,x1,back,.54))
    g.box("noir", (x0+.08,y-.018,.29,x1-.08,y,.40))
    for side in (x0,x1-.12):
        g.box("inox", (side,y,.54,side+.12,back,1.98))
    g.box("noir", (x0+.12,back-.09,.54,x1-.12,back,1.86))
    g.box("inox", (x0,y,1.86,x1,back,1.98))
    g.box("noir", (x0+.12,y+.10,.54,x1-.12,back-.09,.60))
    left,right = x0+.14,x1-.35
    mid = (left+right)/2
    for a,b in ((left,mid-.025),(mid+.025,right)):
        g.frame(a,b,y-.085,.61,1.83,width=.055)
    for a in (mid-.095,mid+.05):
        g.box("inox", (a,y-.16,.94,a+.045,y-.12,1.43))
        for z in (.94,1.38):
            g.box("noir", (a,y-.12,z,a+.045,y-.085,z+.045))
    g.box("noir", (x1-.30,y-.025,.63,x1-.13,y,1.83))
    for row,z in enumerate((.83,1.20,1.57)):
        g.box("inox", (left,y+.40,z,right,y+.435,z+.025))
        g.box("chauffe", (left+.05,y+.69,z+.10,right-.05,y+.71,z+.125))
        for no in range(3 if row!=1 else 2):
            g.loaves.append(((left+.24+no*.40,y+.42,z+.025),(.15,.16,.12)))
    for z in (.79,1.20,1.61):
        g.box("inox", (x1-.25,y-.08,z,x1-.17,y-.026,z+.085))
    g.box("chauffe", (x1-.26,y-.044,1.73,x1-.16,y-.026,1.78))
    H.col_box("fournil_rotissoire",(x0,y-.16,0,x1,back,1.98),col)
    return g.finish()


def build(props, col):
    objects = deck_ovens(props,col)+rotisserie(props,col)
    for obj in objects:
        colors = obj.data.color_attributes.new(name="Col",type="FLOAT_COLOR",domain="CORNER")
        obj.data.color_attributes.active_color = colors
        obj.data.color_attributes.render_color_index = 0
        for item in colors.data:
            item.color = (.9,.9,.9,1)
    return {"objets": [obj.name for obj in objects], "modules": 2, "etages": 4,
            "vitres": 18, "rotissoires": 1}
