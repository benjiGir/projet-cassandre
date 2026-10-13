"""Mesure les rectangles et ancrages d'une planche peinte, sans retoucher ses pixels."""

from pathlib import Path
from statistics import median

from PIL import Image


def frame_bounds(alpha, left, top, right, bottom, ignore_edge_fragments):
    box = alpha.crop((left, top, right, bottom)).getbbox()
    if box is None or not ignore_edge_fragments:
        return box
    pixels = alpha.load()
    remaining = {(x, y) for y in range(top, bottom) for x in range(left, right) if pixels[x, y] > 0}
    components = []
    while remaining:
        first = remaining.pop()
        pending = [first]
        size = 0
        x0, y0 = first
        x1, y1 = first
        while pending:
            x, y = pending.pop()
            size += 1
            x0, y0, x1, y1 = min(x0, x), min(y0, y), max(x1, x), max(y1, y)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)):
                neighbor = (x + dx, y + dy)
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    pending.append(neighbor)
        components.append((size, (x0, y0, x1 + 1, y1 + 1)))
    largest = max(size for size, _ in components)
    # Les minces fragments d'une case voisine ne déterminent pas le rectangle.
    kept = [bounds for size, bounds in components
            if size >= largest * .05 or (bounds[0] > left and bounds[2] < right)]
    return (min(bounds[0] for bounds in kept) - left, min(bounds[1] for bounds in kept) - top,
            max(bounds[2] for bounds in kept) - left, max(bounds[3] for bounds in kept) - top)


def describe_sheet(path: Path, rows: int, resting_height: float, corpse_row: int,
                   fixed_rest_anchor: bool = False, ignore_edge_fragments: bool = False):
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    pixels = alpha.load()
    bands = []
    start = None
    for y in range(height):
        occupied = sum(pixels[x, y] > 0 for x in range(width)) >= 4
        if occupied and start is None:
            start = y
        if not occupied and start is not None:
            if bands and start - bands[-1][1] < 4 and (y - start < 10 or bands[-1][1] - bands[-1][0] < 10):
                bands[-1][1] = y
            else:
                bands.append([start, y])
            start = None
    if start is not None:
        bands.append([start, height])
    if len(bands) != rows:
        raise ValueError(f"{path.name} : {len(bands)} lignes détectées, {rows} attendues")
    frames = []
    rest_anchors = []
    for row_index, (top, bottom) in enumerate(bands):
        row = []
        for column in range(8):
            left, right = round(column * width / 8), round((column + 1) * width / 8)
            box = frame_bounds(alpha, left, top, right, bottom, ignore_edge_fragments)
            if box is None:
                raise ValueError(f"{path.name} : case vide {row_index}/{column}")
            x0, y0, x1, y1 = box
            x, y = max(left, left + x0 - 1), max(0, top + y0 - 1)
            w, h = min(right, left + x1 + 1) - x, min(height, top + y1 + 1) - y
            if row_index < corpse_row:
                if fixed_rest_anchor and row_index > 0:
                    anchor = max(0, min(w, rest_anchors[column] - x))
                else:
                    head_bottom = top + y0 + max(1, round((y1 - y0) * .14))
                    head = [x_pixel for y_pixel in range(top + y0, head_bottom)
                            for x_pixel in range(left + x0, left + x1)
                            if pixels[x_pixel, y_pixel] > 0]
                    anchor = median(head) - x
                    if row_index == 0:
                        rest_anchors.append(anchor + x)
            else:
                anchor = w * .5
            row.append({"x": x, "y": y, "width": w, "height": h,
                        "anchorX": round(anchor, 2), "feetFromBottom": y + h - (top + y1)})
        frames.append(row)
    density = median(frame["height"] - 2 for frame in frames[0]) / resting_height
    return {"width": width, "height": height, "pixelsPerMeter": round(density, 5), "frames": frames}
