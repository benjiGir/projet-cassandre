"""Carrosseries galbées, roues et finitions de vitrage des véhicules originaux."""
import math

from mathutils import Vector
from mathutils.geometry import tessellate_polygon


def contoured_body(builder, profile, width, color, top_edges, bevel_width, bevel_height):
    half = width / 2
    end = max(abs(y) for y, _ in profile)
    shoulder = {i for edge in top_edges for i in (edge, (edge + 1) % len(profile))}
    outline = [(y, z - bevel_height if i in shoulder else z)
               for i, (y, z) in enumerate(profile)]
    planar = [Vector((0, y, z)) for y, z in outline]
    indices = {tuple(point): i for i, point in enumerate(planar)}
    triangles = [[point if isinstance(point, int) else indices[tuple(point)] for point in tri]
                 for tri in tessellate_polygon([planar])]
    outer, inner = {}, {}
    for side in (-1, 1):
        outer[side], inner[side] = [], []
        for i, ((y, z), (_, side_z)) in enumerate(zip(profile, outline)):
            taper = .075 * (abs(y) / end) ** 6
            sill = .025 * max(0, (.38 - z) / .20)
            x = half - taper - sill
            outer[side].append((side * x, y, side_z))
            inner[side].append((side * (x - bevel_width if i in shoulder else x), y, z))
        for tri in triangles:
            face_indices = list(tri if side > 0 else reversed(tri))
            builder.face([outer[side][i] for i in face_indices], color)
            if not hasattr(builder, "custom_normals"):
                builder.custom_normals = {}
            builder.custom_normals[len(builder.faces) - 1] = [
                Vector((side, .45 * profile[i][0] ** 5 / end ** 6,
                        -.125 if profile[i][1] < .38 else 0)).normalized()
                for i in face_indices]
    for i in range(len(profile)):
        j = (i + 1) % len(profile)
        builder.face([inner[-1][i], inner[-1][j], inner[1][j], inner[1][i]], color)
        if i in shoulder or j in shoulder:
            builder.face([outer[1][i], inner[1][i], inner[1][j], outer[1][j]], color)
            builder.face([outer[-1][i], outer[-1][j], inner[-1][j], inner[-1][i]], color)


def wheels(builder, spec):
    radius = spec["wheel_radius"]
    segments = 16
    for y in (-spec["wheelbase"] / 2, spec["wheelbase"] / 2):
        depth = spec.get("rear_tire_width", spec["tire_width"]) if y < 0 else spec["tire_width"]
        for side in (-1, 1):
            x = side * (spec["body_width"] / 2 - .13)
            z = spec["wheel_z"]
            rings = []
            for offset, scale in ((-.5, .85), (-.35, .98), (.35, .98), (.5, .85)):
                rings.append([(x + offset * depth, y + radius * scale * math.cos(i * math.tau / segments),
                               z + radius * scale * math.sin(i * math.tau / segments)) for i in range(segments)])
            builder.face(list(reversed(rings[0])), "#282c2e")
            builder.face(rings[-1], "#282c2e")
            for band in range(3):
                for i in range(segments):
                    j = (i + 1) % segments
                    builder.face([rings[band][i], rings[band][j], rings[band + 1][j], rings[band + 1][i]],
                                 "#171c20" if band == 1 else "#303639")
            face_x = x + side * (depth / 2 + .004)
            builder.cylinder_x((face_x, y, z), radius * .66, .022, "#78868a", segments=segments)
            builder.cylinder_x((face_x + side * .015, y, z), radius * .54, .018, "#b6c0bb", segments=segments)
            for i in range(6):
                a = math.tau * i / 6
                points = [(face_x + side * .027, y + radius * r * math.cos(a + da),
                           z + radius * r * math.sin(a + da))
                          for r, da in ((.26, -.14), (.45, -.18), (.45, .18), (.26, .14))]
                builder.face(points if side > 0 else list(reversed(points)), "#263238")
            builder.cylinder_x((face_x + side * .033, y, z), radius * .19, .02, "#738084", segments=12)
            builder.arc_band(y, z, side * (spec["body_width"] / 2 + .008),
                             spec["arch_radius"], spec["arch_radius"] - .045,
                             spec["cladding"], segments=12)


def cabin_details(builder, cabin, width, dashboard_y):
    floor = cabin[0][1]
    x, y, z = -width * .23, dashboard_y - .18, floor + .19
    outer, inner = .135, .105
    for i in range(12):
        a, b = i * math.tau / 12, (i + 1) * math.tau / 12
        builder.face([(x + r * math.cos(angle), y, z + r * math.sin(angle))
                      for r, angle in ((outer, a), (outer, b), (inner, b), (inner, a))], "#232c30")
    builder.box((x, y, z), (.19, .026, .025), "#30393c")
    builder.box((x, dashboard_y - .126, floor + .14), (.29, .018, .10), "#1d282b")


def rear_window(builder, cabin, width, color):
    rear_top, rear_base = (Vector((0, y, z)) for y, z in cabin[2:])
    half = width / 2 - .025
    outward = Vector((0, -(rear_top.z - rear_base.z),
                      rear_top.y - rear_base.y)).normalized()

    def point(x, height):
        return rear_base.lerp(rear_top, height) + Vector((x, 0, 0)) + outward * .008

    outer = [point(-half, 0), point(half, 0), point(half, 1), point(-half, 1)]
    inner = [point(-half + .085, .13), point(half - .085, .13),
             point(half - .085, .85), point(-half + .085, .85)]
    for i in range(4):
        j = (i + 1) % 4
        builder.face([outer[i], outer[j], inner[j], inner[i]], color)
    builder.face(inner, "#ffffff", material_index=1)


def seat_ceiling(cabin, y):
    front_base, front_top, rear_top, rear_base = cabin
    ceiling = front_top[1] - .16
    if y < rear_top[0]:
        ceiling = min(ceiling, rear_base[1] + (y - rear_base[0]) *
                      (rear_top[1] - rear_base[1]) / (rear_top[0] - rear_base[0]) - .14)
    if y > front_top[0]:
        ceiling = min(ceiling, front_base[1] + (front_base[0] - y) *
                      (front_top[1] - front_base[1]) / (front_base[0] - front_top[0]) - .14)
    return ceiling


def rear_quarter_frames(builder, cabin):
    color = builder.colors[builder.cabin_color_face]
    for side in (-1, 1):
        panes = [[Vector(builder.vertices[i]) for i in face]
                 for index, face in enumerate(builder.faces)
                 if builder.material_indices[index] == 1 and
                 all(side * builder.vertices[i][0] > .1 for i in face)]
        if not panes:
            continue
        points = min(panes, key=lambda pane: sum(p.y for p in pane) / len(pane))
        x = points[0].x
        bottom_y = points[0].y
        floor = cabin[3][1] + (bottom_y - cabin[3][0]) * (cabin[0][1] - cabin[3][1]) / (cabin[0][0] - cabin[3][0])
        outer = [Vector((x, bottom_y, floor)), Vector((x, points[1].y, cabin[1][1])),
                 Vector((x, *cabin[2])), Vector((x, *cabin[3]))]
        for i in range(4):
            j = (i + 1) % 4
            face = [outer[i], outer[j], points[j], points[i]]
            normal = (face[1] - face[0]).cross(face[2] - face[0])
            builder.face(face if normal.x * side >= 0 else list(reversed(face)), "#ffffff")
            builder.colors[-1] = color


def suv_rear_lamps(builder, spec):
    def patch(x, width, bottom, top, color, offset):
        def surface(z):
            return -spec["length"] / 2 + .04 * (z - .47) / (spec["top_rear"] - .08 - .47) - offset
        builder.face([(x - width / 2, surface(bottom), bottom),
                      (x + width / 2, surface(bottom), bottom),
                      (x + width / 2, surface(top), top),
                      (x - width / 2, surface(top), top)], color)

    for side in (-1, 1):
        x = side * (spec["body_width"] / 2 - .23)
        patch(x, .27, .62, 1.09, "#29302d", .008)
        for bottom, top, color in ((.65, .79, "#a83934"), (.805, .875, "#c8ceba"),
                                   (.89, .96, "#c38b38"), (.975, 1.06, "#b54436")):
            patch(x, .215, bottom, top, color, .014)
    patch(0, .90, .90, .915, "#414d3d", .008)
    patch(0, .20, .94, .97, "#252d28", .012)


def finish_glazing(builder):
    cabin = getattr(builder, "cabin", None)
    if not cabin or getattr(builder, "glazing_finished", False):
        return
    builder.glazing_finished = True
    rear_quarter_frames(builder, cabin)
    base, top = cabin[0][1], cabin[1][1]
    center = Vector((0, (cabin[0][0] + cabin[3][0]) / 2, (base + top) / 2))
    for i, (x, y, z) in enumerate(builder.vertices):
        amount = max(0, min(1, (z - base) / (top - base)))
        builder.vertices[i] = (x * (1 - .085 * amount), y, z)
    panes = [(i, face) for i, face in enumerate(builder.faces) if builder.material_indices[i] == 1]
    for index, face in panes:
        points = [Vector(builder.vertices[i]) for i in face]
        normal = (points[1] - points[0]).cross(points[2] - points[0]).normalized()
        midpoint = sum(points, Vector()) / len(points)
        if normal.dot(midpoint - center) < 0:
            normal.negate()
            builder.faces[index] = tuple(reversed(face))
        outside = [p + normal * .003 for p in points]
        inside = [midpoint + (p - midpoint) * .94 + normal * .003 for p in points]
        for i in range(len(points)):
            j = (i + 1) % len(points)
            builder.face([outside[i], outside[j], inside[j], inside[i]], "#283438")
        if len(points) != 4:
            continue

        def pane(u, v):
            return points[0].lerp(points[1], u).lerp(points[3].lerp(points[2], u), v) + normal * .005

        if normal.y > -.5:
            builder.face([pane(.16, .14), pane(.20, .14), pane(.37, .87), pane(.32, .87)], "#81979d")
        if abs(normal.y) > .5 and normal.y > 0:
            for u in (.30, .71):
                builder.face([pane(u - .15, .10), pane(u - .15, .13),
                              pane(u + .11, .32), pane(u + .12, .29)], "#243135")


def round_nose_lamp(builder, spec, x, z, radius, color, surface, offset):
    points = []
    for i in range(16):
        a = i * math.tau / 16
        px, pz = x + radius * math.cos(a), z + radius * math.sin(a)
        points.append((px, surface(spec, pz, offset), pz))
    builder.face(list(reversed(points)), color)
