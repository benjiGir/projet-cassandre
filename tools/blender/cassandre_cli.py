"""
Les commandes de `cassandre.py` en ligne de commande, pour le headless et les
sous-agents qui n'ont pas le MCP Blender.

    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- status
    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- check strict=true
    blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- shot 'vue=[12,30,90]' nom=hub
    blender -b --factory-startup -P tools/blender/cassandre_cli.py -- build

Arguments `cle=valeur`, la valeur lue en JSON quand elle en est (`true`, `3`,
`[1,2]`), en texte sinon. Imprime UNE ligne `[cassandre] {...}` en JSON ;
code de sortie 1 si la commande rend `ok: false` ou un code non nul.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cassandre  # noqa: E402

COMMANDES = {"status", "build", "check", "shot", "export", "find", "where", "budget", "compose_public", "direction_covers", "orient_office_screens", "rework_checkouts", "rework_backstage", "repair_backstage", "story_triggers", "perk_kiosks", "gas_props", "sheet"}


def _valeur(texte: str):
    try:
        return json.loads(texte)
    except json.JSONDecodeError:
        return texte


def main() -> int:
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if not args or args[0] not in COMMANDES:
        print(f"[cassandre] usage : -- <{'|'.join(sorted(COMMANDES))}> [cle=valeur ...]")
        return 2
    kwargs = {}
    for arg in args[1:]:
        cle, _, valeur = arg.partition("=")
        kwargs[cle] = _valeur(valeur)
    res = getattr(cassandre, args[0])(**kwargs)
    print("[cassandre] " + cassandre.as_json(res))
    echec = res.get("ok") is False or res.get("code") not in (None, 0)
    return 1 if echec else 0


if __name__ == "__main__":
    sys.exit(main())
