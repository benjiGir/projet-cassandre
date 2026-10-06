"""Choix du niveau pour Cassandre ; utilisable hors Blender.

see: docs/4-technique/outillage-multi-niveaux.md#sélection-du-niveau
"""
from __future__ import annotations

import importlib.util
import sys
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType

REPO = Path(__file__).resolve().parents[2]
SCENE_LEVEL_KEY = "cassandre_niveau"


@dataclass(frozen=True)
class LevelProfile:
    id: str
    source_dir: Path
    builder: Path
    plan: Path
    blend: Path
    glb: Path
    manifest: Path
    pc_secu_audit: bool = False


PROFILES = {
    "hypermarche": LevelProfile("hypermarche", REPO / "tools/level_v2",
        REPO / "tools/level_v2/build_niveau.py", REPO / "tools/level_v2/plan_de_masse.py",
        REPO / "assets_src/blender/niveau_v2.blend", REPO / "public/assets/levels/niveau_v2.glb",
        REPO / "public/assets/levels/niveau_v2.espaces.json", pc_secu_audit=True),
    "metro": LevelProfile("metro", REPO / "tools/metro",
        REPO / "tools/metro/build_metro.py", REPO / "tools/metro/plan_de_masse.py",
        REPO / "assets_src/blender/metro.blend", REPO / "public/assets/levels/metro.glb",
        REPO / "public/assets/levels/metro.espaces.json"),
}


def resolve_level(niveau: str | None = None, *, scene_id: str | None = None,
                  filepath: str = "") -> LevelProfile:
    selected = niveau or scene_id
    if selected:
        if selected not in PROFILES:
            raise ValueError(f"niveau inconnu : {selected!r} — choix : {', '.join(PROFILES)}")
        return PROFILES[selected]
    stem = Path(filepath).stem
    if stem == "metro":
        return PROFILES["metro"]
    return PROFILES["hypermarche"]


def scene_level(niveau: str | None, scene_id: str | None, filepath: str) -> LevelProfile:
    detected = resolve_level(scene_id=scene_id, filepath=filepath)
    if niveau and (scene_id or Path(filepath).stem in {"metro", "niveau_v2"}) and niveau != detected.id:
        raise ValueError(f"scène {detected.id}, commande {niveau} : ouvrir ou construire le bon niveau")
    return resolve_level(niveau, scene_id=scene_id, filepath=filepath)


def output_path(profile: LevelProfile, out: str | Path | None, kind: str) -> Path:
    path = Path(out).resolve() if out is not None else getattr(profile, kind)
    for other in PROFILES.values():
        protected = (other.blend, other.glb, other.manifest)
        if other.id != profile.id and path in protected:
            raise ValueError(f"sortie réservée au niveau {other.id} : {path.relative_to(REPO)}")
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def load_plan(profile: LevelProfile) -> ModuleType:
    name = f"_cassandre_plan_{profile.id}"
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, profile.plan)
    if spec is None or spec.loader is None:
        raise ImportError(f"plan introuvable : {profile.plan}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    try:
        spec.loader.exec_module(module)
    except BaseException:
        sys.modules.pop(name, None)
        raise
    return module
