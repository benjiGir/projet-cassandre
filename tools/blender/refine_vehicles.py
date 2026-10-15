"""Reprise locale des voitures : comparaison, sources puis instances du niveau.

Via Cassandre : rework_vehicles etape=preview|assets|level niveau=hypermarche|metro
Les aperçus et copies de sécurité restent dans renders/vehicles/.
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/blender"))
sys.path.insert(0, str(ROOT))
from tools.art_direction.store_checkout import metric_uv
import cassandre as C
import propositions_extension_vehicules as E

OUT = ROOT / "renders/vehicles"
KINDS = tuple(E.PALETTES)
SOURCES = (ROOT / "assets_src/blender/propositions_voitures.blend",
           ROOT / "assets_src/blender/propositions_extension.blend")


def factory(kind, variant=None):
    make, initial, *swatches = E.PALETTES[kind]
    builder = E.cars.MeshBuilder()
    spec = make(builder)
    if variant:
        target = dict(swatches)[variant]
        source = E.cars.srgb(initial)
        builder.colors = [E.cars.srgb(target) if c == source else c for c in builder.colors]
    return builder, spec


def new_object(kind, collection, material, glass, variant=None):
    builder, spec = factory(kind, variant)
    obj = builder.build("refined_" + kind, collection, material, glass_material=glass)
    obj["type_vehicule"] = kind
    obj["triangles_estimees"] = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    return obj


def source_names():
    return {kind: ("proposition_" + kind if kind in KINDS[:4]
                   else "proposition_" + kind + "_" + E.PALETTES[kind][2][0]) for kind in KINDS}


def preview(kinds=KINDS):
    OUT.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    stage = bpy.data.collections.new("VEHICLE_REVIEW")
    scene.collection.children.link(stage)
    originals = {}
    for path, source_kinds in ((SOURCES[0], KINDS[:4]), (SOURCES[1], KINDS[4:])):
        selected = [kind for kind in source_kinds if kind in kinds]
        names = [source_names()[kind] for kind in selected]
        with bpy.data.libraries.load(str(path), link=False) as (_, loaded):
            loaded.objects = names
        for kind, obj in zip(selected, loaded.objects):
            stage.objects.link(obj)
            obj.location = (0, 0, 0)
            obj.hide_render = True
            originals[kind] = obj
    material = E.cars.vertex_material("MAT_VEHICULES_COL_V1")
    glass = E.cars.glass_material("MAT_VEHICULES_VERRE_V1")
    updated = {kind: new_object(kind, stage, material, glass) for kind in kinds}
    for obj in updated.values():
        obj.hide_render = True
    for obj in list(scene.objects):
        if obj.name not in stage.objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = 640, 360
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("VEHICLE_REVIEW_WORLD")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (.20, .24, .28, 1)
    bg.inputs["Strength"].default_value = .4
    floor = E.cars.MeshBuilder()
    floor.box((0, 0, -.08), (200, 200, .10), "#414b52")
    floor.build("review_floor", stage, material)
    for name, at, energy, size in (("key", (4, 5, 7), 650, 5),
                                   ("fill", (-4, 1, 4), 350, 5),
                                   ("rim", (0, -5, 5), 500, 4)):
        lamp = bpy.data.lights.new(name, "AREA")
        lamp.energy, lamp.size = energy, size
        obj = bpy.data.objects.new(name, lamp)
        stage.objects.link(obj)
        obj.location = at
        E.point_at(obj, (0, 0, .7))
    camera = bpy.data.objects.new("review_camera", bpy.data.cameras.new("review_camera"))
    stage.objects.link(camera)
    scene.camera = camera
    camera.data.lens = 46
    report, front, back = {}, [], []
    for kind in kinds:
        for objects, tag in ((originals, "before"), (updated, "after")):
            obj = objects[kind]
            obj.hide_render = False
            views = [("front", (4.7, 6.9, 2.9), front),
                     ("back", (4.7, -6.9, 2.9), back)]
            if tag == "after":
                views.extend([("side", (8.4, 0, 1.35), None),
                              ("rear", (0, -8.4, 1.5), None)])
            for view, position, rows in views:
                camera.location = position
                E.point_at(camera, (0, 0, .72))
                path = OUT / f"{kind}-{tag}-{view}.png"
                scene.render.filepath = str(path)
                bpy.ops.render.render(write_still=True)
                image = bpy.data.images.load(str(path), check_existing=False)
                if rows is not None:
                    rows.append(np.array(image.pixels[:]).reshape(360, 640, 4))
                bpy.data.images.remove(image)
            obj.hide_render = True
        report[kind] = {"before": sum(len(p.vertices) - 2 for p in originals[kind].data.polygons),
                        "after": updated[kind]["triangles_estimees"]}
    for name, cells in (("front", front), ("back", back)):
        pixels = np.concatenate([np.concatenate(cells[i:i + 2], axis=1)
                                 for i in reversed(range(0, len(cells), 2))], axis=0)
        image = bpy.data.images.new("comparison", width=1280, height=360 * len(kinds))
        image.pixels.foreach_set(pixels.astype(np.float32).ravel())
        image.filepath_raw = str(OUT / f"comparison-{name}.png")
        image.file_format = "PNG"
        image.save()
        bpy.data.images.remove(image)
    (OUT / "report.json").write_text(json.dumps(report, indent=2))
    return {"ok": True, "images": [str(OUT / f"comparison-{side}.png") for side in ("front", "back")],
            "triangles": report}


def assets(kinds=KINDS):
    OUT.mkdir(parents=True, exist_ok=True)
    report = {}
    for path in SOURCES:
        if path == SOURCES[0] and not any(kind in KINDS[:4] for kind in kinds):
            continue
        backup = OUT / (path.stem + "-before.blend")
        if not backup.exists():
            shutil.copy2(path, backup)
        before_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        bpy.ops.wm.open_mainfile(filepath=str(path))
        scene = bpy.context.scene
        changed = []
        for obj in list(scene.objects):
            kind = obj.get("type_vehicule")
            if kind not in kinds:
                continue
            variant = obj.get("variante_couleur")
            generated = new_object(kind, scene.collection, obj.data.materials[0], obj.data.materials[1], variant)
            old_mesh = obj.data
            obj.data = generated.data
            obj["triangles_estimees"] = generated["triangles_estimees"]
            bpy.data.objects.remove(generated, do_unlink=True)
            if old_mesh.users == 0:
                bpy.data.meshes.remove(old_mesh)
            if variant:
                target = ROOT / f"assets_src/blender/propositions_extension/variantes/{kind}_{variant}.glb"
            else:
                target = ROOT / f"assets_src/blender/propositions_voitures/{kind}.glb"
            E.export_one(scene, obj, str(target))
            if variant == E.PALETTES[kind][2][0] and kind in KINDS[4:]:
                E.export_one(scene, obj, str(ROOT / f"assets_src/blender/propositions_extension/{kind}.glb"))
            changed.append(obj.name)
        if hashlib.sha256(path.read_bytes()).hexdigest() != before_hash:
            raise RuntimeError("La source a changé pendant la reprise")
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(path))
        report[path.name] = changed
    return {"ok": True, "sources": report}


def coordinates(mesh):
    result = np.empty(len(mesh.vertices) * 3, dtype=np.float64)
    mesh.vertices.foreach_get("co", result)
    return result.reshape(-1, 3)


def bounds(mesh):
    points = coordinates(mesh)
    return points.min(axis=0), points.max(axis=0)


def fit_mesh(mesh, low, high):
    minimum, maximum = bounds(mesh)
    scale = (high - low) / (maximum - minimum)
    mesh.transform(Matrix.Translation(Vector(low)) @ Matrix.Diagonal((*scale, 1))
                   @ Matrix.Translation(-Vector(minimum)))


def placement(template, instance):
    source, target = coordinates(template.data), coordinates(instance.data)
    if source.shape != target.shape:
        raise RuntimeError(f"Topologie de placement différente : {instance.name}")
    affine, _, rank, _ = np.linalg.lstsq(np.column_stack((source, np.ones(len(source)))), target, rcond=None)
    error = np.max(np.abs(np.column_stack((source, np.ones(len(source)))) @ affine - target))
    if rank != 4 or error > .0001:
        raise RuntimeError(f"Pose non affine : {instance.name} ({error})")
    return Matrix(affine.T.tolist() + [[0, 0, 0, 1]])


def fingerprint(objects):
    digest = hashlib.sha256()
    for obj in sorted(objects, key=lambda item: item.name):
        digest.update(obj.name.encode())
        digest.update(np.array(obj.matrix_world).tobytes())
        if obj.type == "MESH":
            digest.update(coordinates(obj.data).tobytes())
    return digest.hexdigest()


def templates_for_store(kinds=KINDS):
    result = []
    for kind in kinds:
        for variant in (None, *(name for name, _ in E.PALETTES[kind][2:])):
            name = "veh_proposition_" + kind + ("_" + variant if variant else "")
            obj = bpy.data.objects.get(name)
            if obj:
                result.append((obj, kind, variant))
    return result


def split_mesh(source, material_index, material):
    polygons = [p for p in source.polygons if p.material_index == material_index]
    indices = sorted({v for p in polygons for v in p.vertices})
    mapping = {old: new for new, old in enumerate(indices)}
    mesh = bpy.data.meshes.new("refined_vehicle_part")
    mesh.from_pydata([source.vertices[i].co for i in indices], [],
                     [[mapping[v] for v in p.vertices] for p in polygons])
    mesh.materials.append(material)
    colors = mesh.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    source_colors = source.color_attributes["Col"]
    normals = []
    for new_poly, old_poly in zip(mesh.polygons, polygons):
        for new_loop, old_loop in zip(new_poly.loop_indices, old_poly.loop_indices):
            colors.data[new_loop].color = source_colors.data[old_loop].color
            normals.append(tuple(source.corner_normals[old_loop].vector))
    mesh.normals_split_custom_set(normals)
    mesh.color_attributes.active_color = colors
    return mesh


def level(niveau, inspect=False, kinds=KINDS):
    library = niveau == "library"
    source = ROOT / ("assets_src/library/lib_quartier_N3b.blend" if library else
                     "assets_src/blender/metro_blockout.blend" if niveau == "metro" else
                     "assets_src/blender/niveau_v2.blend")
    if Path(bpy.data.filepath).resolve() != source:
        raise ValueError(f"Ouvrir {source.name} avant la reprise")
    groups = []
    if niveau == "hypermarche":
        descriptors = templates_for_store(kinds)
        ordered = sorted(descriptors, key=lambda item: -len(item[0].name))
        instances = {obj: [] for obj, _, _ in descriptors}
        for obj in bpy.context.scene.objects:
            if obj.type != "MESH" or obj in instances:
                continue
            for template, _, _ in ordered:
                if obj.name.startswith(template.name + "_"):
                    instances[template].append((obj, placement(template, obj)))
                    break
        groups = [(kind, variant, [(template, None, instances[template])])
                  for template, kind, variant in descriptors]
    else:
        for kind in ("citadine", "berline"):
            if kind not in kinds:
                continue
            parts = []
            for index in (0, 1):
                name = f"kit_vehicule_{kind}_{index}"
                template = bpy.data.objects.get(name)
                if not template:
                    raise RuntimeError(f"Patron absent : {name}")
                copies = [(obj, placement(template, obj)) for obj in bpy.context.scene.objects
                          if obj.type == "MESH" and obj is not template
                          and obj.name.endswith("_" + name)]
                parts.append((template, index, copies))
            groups.append((kind, None, parts))
    targets = {obj for _, _, parts in groups for template, _, copies in parts
               for obj in (template, *(copy for copy, _ in copies))}
    untouched = [obj for obj in bpy.context.scene.objects if obj not in targets]
    before = fingerprint(untouched)
    count = sum(len(copies) for _, _, parts in groups for _, _, copies in parts)
    if not groups or (not library and count == 0):
        raise RuntimeError("Aucune voiture placée trouvée")
    if inspect:
        return {"ok": True, "niveau": niveau, "groups": len(groups), "placed_meshes": count,
                "templates": [template.name for _, _, parts in groups for template, _, _ in parts]}
    OUT.mkdir(parents=True, exist_ok=True)
    backup = OUT / (source.stem + "-before.blend")
    if not backup.exists():
        shutil.copy2(source, backup)
    original_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    for kind, variant, parts in groups:
        generated = new_object(kind, bpy.context.scene.collection, parts[0][0].data.materials[0],
                               parts[-1][0].data.materials[-1], variant)
        minimum = np.min([bounds(template.data)[0] for template, _, _ in parts], axis=0)
        maximum = np.max([bounds(template.data)[1] for template, _, _ in parts], axis=0)
        fit_mesh(generated.data, minimum, maximum)
        for template, index, copies in parts:
            mesh = (generated.data.copy() if index is None else
                    split_mesh(generated.data, index, template.data.materials[0]))
            for obj, transform in [(template, Matrix.Identity(4)), *copies]:
                old = obj.data
                obj.data = mesh.copy()
                obj.data.transform(transform)
                metric_uv(obj)
                obj["triangles_estimees"] = sum(len(p.vertices) - 2 for p in obj.data.polygons)
                if old.users == 0:
                    bpy.data.meshes.remove(old)
            bpy.data.meshes.remove(mesh)
        temporary = generated.data
        bpy.data.objects.remove(generated, do_unlink=True)
        bpy.data.meshes.remove(temporary)
    if before != fingerprint(untouched):
        raise RuntimeError("Le décor ou les collisions ont changé")
    if hashlib.sha256(source.read_bytes()).hexdigest() != original_hash:
        raise RuntimeError("La source a changé pendant la reprise")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    result = {"ok": True, "niveau": niveau, "placed_meshes": count,
              "other_objects_unchanged": True}
    if not library:
        result["export"] = C.export(out=ROOT / "public/assets/levels" / (source.stem + ".glb"), niveau=niveau)
        result["ok"] = result["export"].get("ok", False)
    return result


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    stage = args[0] if args else "preview"
    model = args[2] if len(args) > 2 else "all"
    if model != "all" and model not in KINDS:
        raise ValueError(f"Modèle inconnu : {model}")
    kinds = KINDS if model == "all" else (model,)
    if stage == "preview":
        result = preview(kinds)
    elif stage == "assets":
        result = assets(kinds)
    elif stage in ("inspect", "level"):
        result = level(args[1] if len(args) > 1 else "hypermarche", stage == "inspect", kinds)
    else:
        raise ValueError("Étape attendue : preview, assets, inspect ou level")
    print("[vehicle-refinement] " + json.dumps(result))


if __name__ == "__main__":
    main()
