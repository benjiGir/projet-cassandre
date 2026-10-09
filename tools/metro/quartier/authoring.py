"""Assemblage N4b depuis les collections N3b ; pose et contrats glTF."""
import bpy
from mathutils import Matrix, Vector

from tools.blender import geo_utils
from tools.metro.quartier.geometry import Piece


class Author:
    def __init__(self, root):
        self.placed = []
        self.serial = 0
        scene = bpy.context.scene
        geo = geo_utils.make_collection("GEO", scene.collection)
        self.shell = geo_utils.make_collection("SHELL", geo)
        self.props = geo_utils.make_collection("PROPS", geo)
        self.col = geo_utils.make_collection("COL", scene.collection)
        self.logic = geo_utils.make_collection("LOGIC", scene.collection)
        self.lights = geo_utils.make_collection("LIGHTS", scene.collection)
        sources = geo_utils.make_collection("_LIB", scene.collection)
        with bpy.data.libraries.load(str(root / "assets_src/library/lib_quartier_N3b.blend"), link=False) as (available, loaded):
            loaded.collections = [name for name in available.collections if name.startswith("kit_quartier_")]
        self.assets = {c.name.removeprefix("kit_quartier_"): c for c in loaded.collections}
        for collection in self.assets.values():
            sources.children.link(collection)
        self.mats = {m.name.removeprefix("quartier_"): m for m in bpy.data.materials if m.name.startswith("quartier_")}
        bpy.context.view_layer.layer_collection.children["_LIB"].exclude = True

    def place(self, name, origin, angle=0, collision=True, omit=None):
        self.serial += 1
        transform = Matrix.Translation(Vector(origin)) @ Matrix.Rotation(angle, 4, "Z")
        result = []
        for original in self.assets[name].objects:
            proxy = original.name.startswith("col_")
            if proxy and not collision or omit and omit(original):
                continue
            obj = original.copy()
            obj.data = original.data.copy()
            prefix = "col_hull_" if original.name.startswith("col_hull_") else "col_box_" if proxy else "kit_"
            obj.name = f"{prefix}quartier_{self.serial}_{original.name}"
            obj.data.transform(transform @ original.matrix_world)
            obj.matrix_world = Matrix.Identity(4)
            (self.col if proxy else self.props).objects.link(obj)
            result.append(obj)
        self.placed.append({"asset": name, "origin": list(origin), "angle": angle})
        return result

    def box(self, name, origin, size, material="enduit", collision=True):
        obj = geo_utils.build_multi_box_mesh("kit_quartier_" + name,
            [{"o": origin, "s": size, "mat": None}], material, self.mats, seg=1)
        self.shell.objects.link(obj)
        if collision:
            self.col.objects.link(geo_utils.build_proxy_object("col_box_quartier_" + name, "box", origin, size))
        return obj

    def letters(self, text, at, size=.25, material="ivoire", angle=0):
        p = Piece("texte_" + str(len(self.placed)), self.mats, "inscription N4b")
        obj = p.text(text, at, size, material)
        obj["inscription"] = text
        obj.data.transform(Matrix.Translation(Vector(at)) @ Matrix.Rotation(angle, 4, "Z") @ Matrix.Translation(-Vector(at)))
        p.collection.objects.unlink(obj)
        self.props.objects.link(obj)
        bpy.data.collections.remove(p.collection)
        self.placed.append({"text": text})
        return obj

    def door(self, objects, name, movement="monte", course=3, manual=False):
        panels = []
        for obj in objects:
            if obj.name.startswith("col_"):
                bpy.data.objects.remove(obj, do_unlink=True)
                continue
            panels.append(obj)
        if not panels:
            raise ValueError(f"Porte sans panneau : {name}")
        for i, obj in enumerate(panels):
            obj.name = name if i == 0 else f"{name}_{i}"
            obj["groupe"] = name
            obj["mouvement"], obj["course"], obj["duree"] = movement, course, .7
            obj["referme"], obj["manuelle"] = False, manual
        return panels[0]

    def command(self, name, at, target, message):
        obj = self.box(name, (at[0] - .18, at[1] - .06, at[2] - .22), (.36, .12, .44), "petrole", False)
        center = Vector(at)
        obj.data.transform(Matrix.Translation(-center))
        obj.location = center
        obj.name = name
        obj["target"], obj["message"] = target, message
        self.box(name + "_voyant", (at[0] - .1, at[1] - .1, at[2] - .1), (.2, .04, .2), "lampe", False)
        return obj

    def point(self, name, at, color="#efc38d", intensity=8, distance=12):
        marker = bpy.data.objects.new("light_quartier_" + name, None)
        self.logic.objects.link(marker)
        marker.location = at
        marker["color"], marker["intensity"], marker["distance"], marker["decay"] = color, intensity, distance, 2
        data = bpy.data.lights.new("apercu_" + name, "POINT")
        data.energy, data.color = intensity * 20, tuple(int(color[k:k + 2], 16) / 255 for k in (1, 3, 5))
        obj = bpy.data.objects.new(data.name, data)
        obj.location = at
        self.lights.objects.link(obj)
