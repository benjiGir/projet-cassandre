"""Manifestes d'espaces pour les niveaux déclarés dans level_profiles.

    python3 tools/blender/level_spaces.py --niveau metro --out renders/metro_n0/metro.espaces.json

see: docs/4-technique/outillage-multi-niveaux.md#manifestes-et-audit
"""
from __future__ import annotations
import argparse
import json
import sys

from level_profiles import PROFILES, load_plan, output_path

MARGE_HAUTEUR = 1.0


def boite(espace) -> dict:
    sols = (espace.rampe[1], espace.rampe[2]) if espace.rampe else (espace.z, espace.z)
    return {"x": list(espace.x),
            "y": [min(sols) - MARGE_HAUTEUR, max(sols) + espace.hauteur + MARGE_HAUTEUR],
            "z": [-espace.y[1], -espace.y[0]]}


def manifeste(plan) -> dict:
    return {"espaces": [{"id": espace.id, **boite(espace)} for espace in plan.ALL]}


def rendu(plan) -> str:
    return json.dumps(manifeste(plan), ensure_ascii=False, indent=1) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("--niveau", choices=PROFILES, default="hypermarche")
    parser.add_argument("--out")
    parser.add_argument("--check", action="store_true")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None
    args = parser.parse_args(argv)
    profile = PROFILES[args.niveau]
    out = output_path(profile, args.out, "manifest")
    plan = load_plan(profile)
    text = rendu(plan)
    if args.check:
        current = out.exists() and out.read_text() == text
        print(f"{'à jour' if current else 'périmé'} : {out}")
        return 0 if current else 1
    out.write_text(text)
    print(f"écrit : {out} ({len(plan.ALL)} espaces)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
