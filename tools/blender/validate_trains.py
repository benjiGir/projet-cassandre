"""Contrat d'export des trains. Les contrôles de visibilité restent dans le loader.

see: docs/4-technique/trains-metro.md#contrat-blender
"""
import math


def check_trains(objects, err):
    names = {obj.name: obj for obj in objects}
    definitions = [obj for obj in objects if obj.name.startswith("voie_")]
    markers = ("train_modele_", "rail_", "signal_train_", "nav_voie_", "traversee_train_", "refuge_train_")
    if not definitions:
        if any(obj.name.startswith(markers) or "train" in obj for obj in objects):
            err("Marqueurs de trains sans voie déclarée")
        return
    lanes, timings = {}, {}
    for obj in definitions:
        lane, route = obj.get("voie"), obj.get("trajet")
        if not isinstance(lane, str) or not lane or not isinstance(route, str) or not route:
            err(f"{obj.name}: voie / trajet doivent être des chaînes non vides")
            continue
        if route in lanes.setdefault(lane, set()):
            err(f"{obj.name}: trajet répété {lane}/{route}")
        lanes[lane].add(route)
        raw = obj.get("points", "")
        point_names = [n.strip() for n in raw.split(",")] if isinstance(raw, str) else []
        if len(point_names) < 2 or len(set(point_names)) != len(point_names):
            err(f"{obj.name}: points incomplets ou répétés")
        points = []
        for name in point_names:
            if not name.startswith("rail_") or name not in names:
                err(f"{obj.name}: point absent {name}")
            else:
                points.append(names[name].matrix_world.translation)
        length = 0
        for a, b in zip(points, points[1:]):
            delta = b - a
            flat = math.hypot(delta.x, delta.y)
            if flat < .01 or abs(delta.z) > flat * .6:
                err(f"{obj.name}: segment nul, vertical ou pente excessive")
            length += delta.length
        for key in ("debut_visible", "fin_visible", "premier"):
            value = obj.get(key, 10 if key == "premier" else None)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                err(f"{obj.name}: {key} doit être un nombre fini positif ou nul")
        start, end = obj.get("debut_visible"), obj.get("fin_visible")
        if isinstance(start, (int, float)) and isinstance(end, (int, float)) and not (start < end <= length):
            err(f"{obj.name}: intervalle visible hors trajet")
        active = obj.get("active", True)
        if not isinstance(active, bool):
            err(f"{obj.name}: active doit être un booléen")
        timing = (obj.get("premier", 10), active)
        if lane in timings and timings[lane] != timing:
            err(f"{obj.name}: horaire incohérent entre trajets")
        timings[lane] = timing
    models = [obj for obj in objects if obj.name.startswith("train_modele_")]
    if len(models) != 1:
        err("Un seul train_modele_* est requis")
    elif any(child.name.startswith("col_") for child in models[0].children_recursive):
        err("train_modele_* ne doit pas porter de collider statique")
    for obj in objects:
        if obj.name.startswith(("signal_train_", "nav_voie_", "traversee_train_", "refuge_train_")) or "train" in obj:
            lane = obj.get("voie")
            if lane not in lanes:
                err(f"{obj.name}: voie inconnue {lane}")
            if obj.name.startswith(("nav_voie_", "traversee_train_", "refuge_train_")) and (obj.type != "MESH" or len(obj.data.vertices) != 8):
                err(f"{obj.name}: volume de voie non-box")
            if "train" in obj:
                if not obj.name.startswith("use_") or obj["train"] not in {"stop", "switch"}:
                    err(f"{obj.name}: commande de train invalide")
                route = obj.get("trajet")
                if route is not None and route not in lanes.get(lane, set()):
                    err(f"{obj.name}: trajet d'aiguillage inconnu {route}")
    for lane in lanes:
        for prefix in ("signal_train_", "nav_voie_", "refuge_train_"):
            if not any(obj.name.startswith(prefix) and obj.get("voie") == lane for obj in objects):
                err(f"Voie {lane}: aucun {prefix}")
