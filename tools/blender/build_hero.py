"""Héros original articulé, dérivé du portrait et de la palette du viewmodel.

Recette : blender -b --factory-startup -P tools/blender/cassandre_cli.py -- hero_model
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "renders/hero"
PARTS = []


def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = 1
    return mat


def mesh(name, vertices, faces, mat, bone):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.data.uv_layers.new(name="Visage")
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(vertices))), 1, "REPLACE")
    PARTS.append(obj)
    return obj


def rings(name, profiles, mat, bone, sides=12):
    vertices = []
    for center, rx, ry in profiles:
        vertices.extend((center[0] + math.sin(i * math.tau / sides) * rx,
                         center[1] - math.cos(i * math.tau / sides) * ry,
                         center[2]) for i in range(sides))
    faces = [tuple(reversed(range(sides)))]
    for ring in range(len(profiles) - 1):
        for i in range(sides):
            a, b = ring * sides + i, ring * sides + (i + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(range(len(vertices) - sides, len(vertices))))
    return mesh(name, vertices, faces, mat, bone)


def ellipsoid(name, center, scale, mat, bone, sides=10, levels=6):
    profiles = []
    for j in range(levels + 1):
        angle = math.pi * j / levels
        radius = max(.02, math.sin(angle))
        profiles.append(((center[0], center[1], center[2] - math.cos(angle) * scale[2]),
                         scale[0] * radius, scale[1] * radius))
    return rings(name, profiles, mat, bone, sides)


def strip(name, points, radius, mat, bone, sides=6):
    vertices = []
    for j, point in enumerate(points):
        axis = Vector(points[min(j + 1, len(points) - 1)]) - Vector(points[max(j - 1, 0)])
        axis.normalize()
        right = axis.cross(Vector((0, 1, 0)))
        if right.length < .01:
            right = axis.cross(Vector((1, 0, 0)))
        right.normalize()
        up = axis.cross(right)
        for i in range(sides):
            vertices.append(Vector(point) + radius * (right * math.cos(i * math.tau / sides)
                                                      + up * math.sin(i * math.tau / sides)))
    faces = [tuple(reversed(range(sides)))]
    for j in range(len(points) - 1):
        for i in range(sides):
            a, b = j * sides + i, j * sides + (i + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(range(len(vertices) - sides, len(vertices))))
    return mesh(name, vertices, faces, mat, bone)


def hair_lock(points, radii, mat):
    vertices = []
    sides = 7
    for j, point in enumerate(points):
        axis = (Vector(points[min(j + 1, len(points) - 1)]) - Vector(points[max(0, j - 1)])).normalized()
        right = axis.cross(Vector((0, 1, 0))).normalized()
        up = axis.cross(right)
        for i in range(sides):
            angle = i * math.tau / sides
            vertices.append(Vector(point) + right * math.cos(angle) * radii[j]
                            + up * math.sin(angle) * radii[j] * .55)
    faces = [tuple(reversed(range(sides)))]
    for j in range(len(points) - 1):
        for i in range(sides):
            a, b = j * sides + i, j * sides + (i + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(range(len(vertices) - sides, len(vertices))))
    obj = mesh("Meche_sculptee", vertices, faces, mat, "head")
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def face_material():
    source = bpy.data.images.load(str(ROOT / "public/assets/ui/hero-ambient.png"))
    pixels = list(source.pixels)
    width, height = source.size
    face = bpy.data.images.new("hero_face", width=128, height=160, alpha=False)
    result = []
    for y in range(160):
        sy = height - 1 - (218 - int(y * 153 / 159))
        for x in range(128):
            sx = 77 + int(x * 127 / 127)
            index = (sy * width + sx) * 4
            result.extend(pixels[index:index + 3] + [1])
    face.pixels = result
    face.filepath_raw = str(ROOT / "assets_src/blender/hero_face.png")
    face.file_format = "PNG"
    face.save()
    face.pack()
    mat = material("Visage_du_portrait", (1, 1, 1))
    texture = mat.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image = face
    texture.interpolation = "Closest"
    mat.node_tree.links.new(texture.outputs["Color"], mat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
    return mat


def build_body():
    kaki = material("Sweat_kaki", (.069, .102, .033))
    dark = material("Bords_du_sweat", (.044, .064, .025))
    seam = material("Coutures_kaki", (.135, .163, .079))
    rust = material("Tee_shirt_rouille", (.24, .069, .033))
    skin = material("Peau_viewmodel", (.578, .323, .188))
    hair = material("Cheveux_bruns", (.073, .033, .015))
    hair_light = material("Meches_brunes", (.118, .058, .027))
    pants = material("Pantalon_viewmodel", (.05, .069, .056))
    pants_light = material("Poches_et_coutures", (.069, .091, .069))
    leather = material("Bottines_cuir", (.32, .145, .055))
    sole = material("Semelles", (.018, .021, .018))
    lace = material("Lacets_et_cordons", (.65, .59, .43))
    rings("Bassin", [((0, 0, .86), .18, .115), ((0, 0, .98), .205, .125),
                    ((0, 0, 1.06), .19, .115)], pants, "hips")
    rings("Sweat", [((0, 0, .99), .202, .132), ((0, 0, 1.07), .216, .145),
                   ((0, .008, 1.25), .238, .14), ((0, .009, 1.40), .26, .128),
                   ((0, 0, 1.47), .20, .11)], kaki, "spine")
    rings("Bord_taille", [((0, 0, 1.0), .207, .138), ((0, 0, 1.04), .209, .138)], dark, "spine")
    mesh("Tee_shirt", [(-.085, -.106, 1.47), (.085, -.106, 1.47),
                       (.057, -.144, 1.31), (-.057, -.144, 1.31)], [(0, 3, 2, 1)], rust, "spine")
    # Capuche rabattue : un anneau ouvert devant, avec un intérieur distinct.
    for side in (-1, 1):
        ellipsoid("Capuche", (side * .115, .024, 1.45), (.092, .13, .073), kaki, "spine")
        strip("Bord_capuche", [(side * .076, -.099, 1.47), (side * .155, -.095, 1.46),
                               (side * .19, -.018, 1.435), (side * .13, .123, 1.43)], .018, dark, "spine")
        strip("Cordon", [(side * .092, -.128, 1.43), (side * .103, -.153, 1.35),
                         (side * .094, -.154, 1.30)], .006, lace, "spine")
        strip("Zip", [(side * .022, -.143, 1.06), (side * .025, -.147, 1.29),
                      (side * .075, -.115, 1.45)], .004, seam, "spine")
        mesh("Poche_kangourou", [(side * .05, -.149, 1.09), (side * .173, -.105, 1.09),
                                (side * .15, -.117, 1.21), (side * .062, -.149, 1.22)],
             [(0, 1, 2, 3)] if side == 1 else [(3, 2, 1, 0)], dark, "spine")
        x = side * .112
        suffix = "R" if side == -1 else "L"
        thigh, shin, foot = f"thigh_{suffix}", f"shin_{suffix}", f"foot_{suffix}"
        rings("Cuisse", [((x, 0, .98), .117, .114), ((x, .005, .74), .104, .099),
                         ((x, -.008, .53), .082, .083)], pants, thigh)
        rings("Jambe", [((x, -.008, .54), .083, .084), ((x, .017, .40), .082, .077),
                        ((x, .015, .21), .069, .067), ((x, .01, .14), .065, .064)], pants, shin)
        mesh("Poche_cargo", [(x + side * .108, -.067, .81), (x + side * .108, .065, .81),
                            (x + side * .097, .063, .68), (x + side * .097, -.065, .68)],
             [(0, 3, 2, 1)] if side == -1 else [(0, 1, 2, 3)], pants_light, thigh)
        ellipsoid("Bottine_semelle", (x, -.047, .036), (.087, .175, .029), sole, foot, 12, 4)
        ellipsoid("Bottine_cuir", (x, -.06, .098), (.080, .163, .061), leather, foot, 12, 5)
        rings("Bottine_tige", [((x, .007, .09), .073, .076), ((x, .01, .21), .066, .067)], leather, foot)
        rings("Bottine_col", [((x, .01, .195), .073, .074), ((x, .01, .22), .071, .072)], sole, foot)
        for j in range(4):
            strip("Lacet", [(x - .033, -.09 + j * .017, .142 + j * .014),
                            (x + .032, -.073 + j * .017, .157 + j * .014)], .0035, lace, foot, 5)
        arm, forearm, hand = f"upper_arm_{suffix}", f"forearm_{suffix}", f"hand_{suffix}"
        ax = side * .28
        rings("Manche_haut", [((ax, 0, 1.46), .035, .035), ((ax, 0, 1.425), .076, .09),
                              ((ax, 0, 1.34), .085, .087), ((ax, 0, 1.23), .077, .081),
                              ((ax, 0, 1.115), .071, .075)], kaki, arm)
        rings("Manche_bas", [((ax, 0, 1.12), .073, .074), ((ax, -.005, .99), .073, .069),
                             ((ax, -.008, .855), .054, .055)], kaki, forearm)
        rings("Poignet", [((ax, -.008, .87), .056, .056), ((ax, -.008, .83), .05, .051)], dark, forearm)
        ellipsoid("Main", (ax, -.012, .786), (.045, .035, .061), skin, hand, 8, 4)
        for j in range(4):
            ellipsoid("Doigt", (ax - .031 + j * .021, -.029, .743), (.011, .023, .022), skin, hand, 6, 3)
        ellipsoid("Pouce", (ax - side * .047, -.019, .791), (.019, .029, .034), skin, hand, 6, 3)
    rings("Cou", [((0, 0, 1.43), .064, .066), ((0, 0, 1.55), .072, .074)], skin, "head")
    head = rings("Tete", [((0, -.008, 1.505), .061, .072), ((0, -.012, 1.54), .086, .089),
                          ((0, -.005, 1.59), .109, .10), ((0, .004, 1.65), .115, .106),
                          ((0, .006, 1.72), .109, .104), ((0, .012, 1.765), .092, .093),
                          ((0, .014, 1.79), .058, .071)], skin, "head", 16)
    head.data.materials.append(face_material())
    uv = head.data.uv_layers.active
    for polygon in head.data.polygons:
        center = sum((head.data.vertices[i].co for i in polygon.vertices), Vector()) / len(polygon.vertices)
        if center.y < -.044 and len(polygon.vertices) == 4:
            polygon.material_index = 1
        for loop in polygon.loop_indices:
            point = head.data.vertices[head.data.loops[loop].vertex_index].co
            uv.data[loop].uv = (min(.99, max(.01, .5 + point.x / .217)),
                                min(.99, max(.01, (point.z - 1.505) / .25)))
    mesh("Nez", [(-.018, -.104, 1.655), (.018, -.104, 1.655), (0, -.145, 1.603),
                 (-.022, -.108, 1.596), (.022, -.108, 1.596)],
         [(0, 3, 2), (0, 2, 1), (1, 2, 4), (3, 4, 2)], skin, "head")
    for side in (-1, 1):
        ellipsoid("Oreille", (side * .118, .0, 1.637), (.027, .023, .052), skin, "head", 8, 4)
        ellipsoid("Interieur_oreille", (side * .133, -.014, 1.637), (.011, .011, .029), rust, "head", 6, 4)
    ellipsoid("Cheveux_base", (0, .02, 1.765), (.122, .112, .063), hair, "head", 14, 5)
    for j in range(15):
        angle = j * 2.39996
        cx, cy = math.sin(angle) * .095, math.cos(angle) * .082
        height = 1.818 + .014 * (j % 4)
        dx, dy = math.cos(angle + .7), math.sin(angle + .7)
        hair_lock([(cx * .65, cy * .6, 1.755), (cx, cy, 1.797),
                   (cx + dx * .04, cy + dy * .025, height),
                   (cx + dx * .075, cy + dy * .045, height - .015)],
                  [.032, .029, .018, .0015], hair_light if j % 3 == 0 else hair)
    for side, z in [(-1, 1.731), (1, 1.756)]:
        strip("Meche_front", [(side * .09, -.053, 1.79), (side * .048, -.104, z + .016),
                              (side * .04, -.113, z)], .015, hair, "head", 7)


def rig_body():
    armature = bpy.data.armatures.new("HeroSkeleton")
    rig = bpy.data.objects.new("HeroRig", armature)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    specs = [("hips", (0, 0, .95), (0, 0, 1.08), None),
             ("spine", (0, 0, 1.08), (0, 0, 1.45), "hips"),
             ("head", (0, 0, 1.45), (0, 0, 1.73), "spine")]
    for side, suffix in [(-1, "R"), (1, "L")]:
        x, ax = side * .112, side * .28
        specs += [(f"thigh_{suffix}", (x, 0, .95), (x, 0, .53), "hips"),
                  (f"shin_{suffix}", (x, 0, .53), (x, 0, .19), f"thigh_{suffix}"),
                  (f"foot_{suffix}", (x, 0, .19), (x, 0, .08), f"shin_{suffix}"),
                  (f"upper_arm_{suffix}", (ax, 0, 1.40), (ax, 0, 1.115), "spine"),
                  (f"forearm_{suffix}", (ax, 0, 1.115), (ax, 0, .84), f"upper_arm_{suffix}"),
                  (f"hand_{suffix}", (ax, 0, .84), (ax, 0, .755), f"forearm_{suffix}")]
    for name, head, tail, parent in specs:
        bone = armature.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        if parent:
            bone.parent = armature.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in PARTS:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    bpy.ops.object.join()
    body = bpy.context.object
    body.name = "HeroBody"
    body.parent = rig
    modifier = body.modifiers.new("Articulation", "ARMATURE")
    modifier.object = rig
    return rig, body


def pose(rig, values):
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
        x, y, z = (math.radians(v) for v in values.get(bone.name, (0, 0, 0)))
        bone.rotation_quaternion = (Quaternion((1, 0, 0), x) @ Quaternion((0, 1, 0), y)
                                    @ Quaternion((0, 0, 1), z))
        bone.location = (0, 0, 0)


def animate(rig):
    rig.animation_data_create()
    fps = 30
    base = {bone.name: (0, 0, 0) for bone in rig.pose.bones}
    stances = {
        "none": {"upper_arm_R": (-8, 0, -5), "upper_arm_L": (-8, 0, 5),
                 "forearm_R": (-12, 0, 0), "forearm_L": (-12, 0, 0)},
        "melee": {"upper_arm_R": (-25, 0, -8), "forearm_R": (-65, 0, 0),
                  "upper_arm_L": (-10, 0, 7), "forearm_L": (-15, 0, 0)},
        "pistol": {"upper_arm_R": (-52, 0, -50), "forearm_R": (-42, 0, 0),
                   "upper_arm_L": (-52, 0, 48), "forearm_L": (-42, 0, 0)},
        "shotgun": {"upper_arm_R": (-38, 0, -45), "forearm_R": (-63, 0, 0),
                    "upper_arm_L": (-70, 0, 40), "forearm_L": (-28, 0, 0)},
        "flare": {"upper_arm_R": (-60, 0, -7), "forearm_R": (-32, 0, 0),
                  "upper_arm_L": (-12, 0, 5), "forearm_L": (-18, 0, 0)},
    }
    clips = []

    def clip(name, duration, sample, bones):
        action = bpy.data.actions.new(name)
        rig.animation_data.action = action
        for frame in range(round(duration * fps) + 1):
            t = frame / fps
            pose(rig, sample(t))
            for bone_name in bones:
                rig.pose.bones[bone_name].keyframe_insert("rotation_quaternion", frame=frame)
        slot = rig.animation_data.action_slot
        track = rig.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 0, action)
        strip.action_slot = slot
        track.mute = True
        clips.append(name)

    def locomotion(t, mode):
        values = dict(base)
        phase = t * math.tau / (.8 if mode == "walk" else .55 if mode == "run" else 3)
        angle = math.sin(phase) * (28 if mode == "walk" else 42)
        if mode in ("walk", "run"):
            for suffix, sign in [("R", 1), ("L", -1)]:
                values[f"thigh_{suffix}"] = (angle * sign, 0, 0)
                values[f"shin_{suffix}"] = (max(0, -angle * sign) * 1.25, 0, 0)
                values[f"foot_{suffix}"] = (-max(0, -angle * sign) * .45, 0, 0)
                values[f"upper_arm_{suffix}"] = (-8 - angle * sign * .55, 0, -5 * sign)
                values[f"forearm_{suffix}"] = (-35 if mode == "run" else -12, 0, 0)
            values["spine"] = (5 if mode == "run" else 1, 0, math.sin(phase) * 2)
        elif mode == "jump":
            values.update({"thigh_R": (-24, 0, -4), "thigh_L": (12, 0, 5),
                           "shin_R": (38, 0, 0), "shin_L": (28, 0, 0), "spine": (5, 0, 0)})
        else:
            values["spine"] = (math.sin(phase) * .7, 0, math.sin(phase) * .35)
        return values

    legs = ["hips", "spine", "head", "thigh_R", "thigh_L", "shin_R", "shin_L", "foot_R", "foot_L"]
    arms = [f"{part}_{side}" for side in ("R", "L") for part in ("upper_arm", "forearm", "hand")]
    for name, duration in [("idle", 3), ("walk", .8), ("run", .55), ("jump", 1)]:
        clip(name, duration, lambda t, mode=name: locomotion(t, mode), legs + arms)
    for weapon, values in stances.items():
        clip(f"hold_{weapon}", 1, lambda t, values=values: values, arms)
    def kick(t):
        extension = max(0, math.sin(min(1, t / .48) * math.pi))
        return {"thigh_R": (-95 * extension, 0, -4 * extension), "shin_R": (10 * extension, 0, 0),
                "foot_R": (12 * extension, 0, 0)}
    clip("kick", .5, kick, ["thigh_R", "shin_R", "foot_R"])
    for weapon, duration in [("melee", .35), ("pistol", .22), ("shotgun", .6), ("flare", .28)]:
        def fire(t, weapon=weapon, duration=duration):
            values = dict(stances[weapon])
            pulse = max(0, math.sin(min(1, t / duration) * math.pi))
            if weapon == "melee":
                values["upper_arm_R"] = (-25 - 55 * pulse, 0, -8 + 52 * pulse)
                values["forearm_R"] = (-65 + 40 * pulse, 0, 0)
            else:
                pitch, y, z = values["forearm_R"]
                values["forearm_R"] = (pitch - 13 * pulse, y, z)
                if weapon == "shotgun":
                    pitch, y, z = values["forearm_L"]
                    values["forearm_L"] = (pitch - 24 * max(0, math.sin((t - .2) * math.pi / .28)), y, z)
            return values
        clip(f"fire_{weapon}", duration, fire, arms)
    rig.animation_data.action = None
    pose(rig, stances["none"])
    return clips


def render_views(rig):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world.color = (.16, .16, .16)
    scene.view_settings.view_transform = "Standard"
    scene.render.film_transparent = True
    camera_data = bpy.data.cameras.new("Preview")
    camera = bpy.data.objects.new("Preview", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    for name, location, power, size in [("Key", (-3, -4, 4), 300, 4), ("Fill", (3, -2, 2), 140, 3),
                                         ("Rim", (1, 3, 3), 240, 3)]:
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.shape, data.size = power, "DISK", size
        light = bpy.data.objects.new(name, data)
        light.location = location
        light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(light)
    for name, location, target, ortho in [
        ("front", (0, -4, 1.1), (0, 0, .96), 2.1),
        ("three-quarter", (2.8, -4, 1.8), (0, 0, .99), 2.1),
        ("back", (2, 4, 1.8), (0, 0, .99), 2.1),
        ("face", (.40, -1.6, 1.75), (0, 0, 1.66), .6),
    ]:
        camera_data.type = "ORTHO"
        camera_data.ortho_scale = ortho
        camera.location = location
        camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(OUT / f"{name}.png")
        bpy.ops.render.render(write_still=True)
    camera_data.ortho_scale = 2.1
    camera.location = (0, -4, 1.1)
    camera.rotation_euler = (Vector((0, 0, .96)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.film_transparent = False
    shading = scene.display.shading
    shading.light, shading.color_type = "FLAT", "SINGLE"
    shading.single_color = (0, 0, 0)
    shading.background_type = "VIEWPORT"
    shading.background_color = (1, 1, 1)
    shading.show_shadows = False
    scene.render.filepath = str(OUT / "silhouette.png")
    bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    OUT.mkdir(parents=True, exist_ok=True)
    build_body()
    rig, body = rig_body()
    clips = animate(rig)
    bpy.context.scene.render.fps = 30
    bpy.context.scene.frame_set(0)
    blend = ROOT / "assets_src/blender/hero.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    body.select_set(True)
    output = ROOT / "public/assets/characters/hero.glb"
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", use_selection=True,
                              export_extras=True, export_yup=True, export_animations=True,
                              export_animation_mode="NLA_TRACKS", export_force_sampling=True,
                              export_apply=False)
    render_views(rig)
    triangles = sum(len(p.vertices) - 2 for p in body.data.polygons)
    print("[hero] " + json.dumps({"blend": str(blend), "glb": str(output), "triangles": triangles,
                                 "bones": len(rig.data.bones), "clips": clips, "renders": str(OUT)}))


if __name__ == "__main__":
    main()
