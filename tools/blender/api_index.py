"""
Index des fonctions des outils Blender, lu dans le code à la demande — sans
Blender, sans exécuter les modules, donc jamais désynchronisé.

    python3 tools/blender/api_index.py                  # modules et leur rôle
    python3 tools/blender/api_index.py lib_rayons       # fonctions d'un module
    python3 tools/blender/api_index.py --grep gondole   # partout, par nom ou doc
    python3 tools/blender/api_index.py lib_rayons --all # y compris les _privées

Une ligne par fonction : `fichier:ligne  nom(signature) — 1re ligne de doc`.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1]
DOSSIERS = (TOOLS / "blender", TOOLS / "level_v2", TOOLS / "level_v2" / "espaces")
EXCLUS = ("propositions_", "refresh_")        # scripts jetables, pas une API


def modules() -> dict[str, Path]:
    return {p.stem: p for d in DOSSIERS for p in sorted(d.glob("*.py"))
            if not p.stem.startswith(EXCLUS)}


def _premiere_ligne(noeud) -> str:
    doc = ast.get_docstring(noeud) or ""
    return doc.strip().splitlines()[0] if doc.strip() else ""


def _signature(f: ast.FunctionDef) -> str:
    args = ast.unparse(f.args)
    if len(args) > 90:
        args = args[:87] + "..."
    return f"{f.name}({args})"


def fonctions(chemin: Path, privees: bool = False) -> list[str]:
    arbre = ast.parse(chemin.read_text())
    rel = chemin.relative_to(TOOLS)
    lignes = []
    for noeud in arbre.body:
        if isinstance(noeud, (ast.FunctionDef, ast.ClassDef)):
            if noeud.name.startswith("_") and not privees:
                continue
            tete = _signature(noeud) if isinstance(noeud, ast.FunctionDef) else f"class {noeud.name}"
            doc = _premiere_ligne(noeud)
            lignes.append(f"{rel}:{noeud.lineno}  {tete}" + (f" — {doc}" if doc else ""))
    return lignes


def main(args: list[str]) -> int:
    privees = "--all" in args
    args = [a for a in args if a != "--all"]
    mods = modules()
    if not args:
        for nom, chemin in mods.items():
            arbre = ast.parse(chemin.read_text())
            n = sum(isinstance(x, ast.FunctionDef) and not x.name.startswith("_") for x in arbre.body)
            doc = _premiere_ligne(arbre)
            print(f"{chemin.relative_to(TOOLS)} ({n} fn) — {doc}")
        return 0
    if args[0] == "--grep":
        motif = args[1].lower()
        for chemin in mods.values():
            for ligne in fonctions(chemin, privees=True):
                if motif in ligne.lower():
                    print(ligne)
        return 0
    for nom in args:
        if nom not in mods:
            print(f"module inconnu : {nom}")
            return 1
        print("\n".join(fonctions(mods[nom], privees)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
