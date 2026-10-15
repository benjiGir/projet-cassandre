"""
Boîtes des espaces du plan de masse, dans le repère du JEU.

    python3 tools/level_v2/espaces_jeu.py           # écrit le manifeste du niveau
    python3 tools/level_v2/espaces_jeu.py --check   # échoue si le manifeste livré est périmé

Le plan de masse (`plan_de_masse.py`) est en repère Blender : X est, Y nord,
Z haut. Le jeu est en repère glTF : X est, Y haut, Z = −Y Blender. Cette
conversion sert deux consommateurs, qui doivent rester d'accord : les
ambiances de zone (`tools/audio/ia_ambiances.py`) et les répliques de lieu du
héros (`src/game/level/navigation/levelSpaces.ts`).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "blender"))
from level_spaces import boite as boite_niveau, manifeste as manifeste_niveau
import plan_de_masse as P

RACINE = Path(__file__).resolve().parents[2]
MANIFESTE = RACINE / "public/assets/levels/niveau_v2.espaces.json"

# Le joueur est repéré par le centre de sa capsule, et un saut le fait
# dépasser le plafond d'un conduit bas : un mètre de marge en hauteur.
MARGE_HAUTEUR = 1.0


def boite(espace: P.Space) -> dict:
    """Boîte de l'espace en repère du jeu, du sol au plafond, marge en hauteur comprise."""
    return boite_niveau(espace)


def manifeste() -> dict:
    return manifeste_niveau(P)


def rendu() -> str:
    return json.dumps(manifeste(), ensure_ascii=False, indent=1) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("--check", action="store_true", help="compare au manifeste livré, sans l'écrire")
    args = parser.parse_args()

    if args.check:
        if not MANIFESTE.exists() or MANIFESTE.read_text() != rendu():
            print(f"périmé : {MANIFESTE.relative_to(RACINE)} — relancer tools/level_v2/espaces_jeu.py")
            return 1
        print(f"à jour : {MANIFESTE.relative_to(RACINE)}")
        return 0

    MANIFESTE.write_text(rendu())
    print(f"écrit : {MANIFESTE.relative_to(RACINE)} ({len(P.ALL)} espaces)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
