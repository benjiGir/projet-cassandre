"""
Provenance des objets d'un build : quelle ligne de quel script a posé chaque
objet dans la scène — pour aller droit aux 40 lignes à modifier au lieu de
relire `build_niveau.py`.

Rien n'est écrit sur les objets eux-mêmes : une propriété personnalisée
partirait dans le `.glb` (`export_extras=True`). Le relevé vit dans un
fichier annexe, `renders/_cassandre/provenance_<blend>.json`.

Mécanique : `sys.monitoring` (Python 3.12+) observe les appels pendant le
build et ne garde que `CollectionObjects.link` — tout autre site d'appel est
désactivé dès son premier passage, le surcoût est donc négligeable. Les scripts
du pipeline n'ont pas à coopérer. Angle mort : un objet créé par un opérateur
(`bpy.ops.mesh.primitive_*`) est lié par Blender, sans appel Python à `link`.
"""

from __future__ import annotations

import contextlib
import json
import sys
import time
from pathlib import Path

M = sys.monitoring
LINK = "<bpy_func CollectionObjects.link()>"
PROFONDEUR = 6
# Helpers génériques : ils créent tout, donc ne disent rien de l'endroit à
# modifier. Le « site » retenu est le premier cadre hors de ces fichiers et de
# ces fonctions de pose.
GENERIQUES = {"lib_helpers.py", "geo_utils.py"}
POSES = {"place", "semer", "_clone_base"}
# Cadres sans information : l'outillage lui-même et les corps de module.
OUTILLAGE = {"cassandre.py", "cassandre_cli.py", "provenance.py"}


class Journal:
    def __init__(self, racine: Path):
        self.racine = racine
        self.liens: list[tuple[object, list[str], str | None]] = []

    def _pile(self, cadre) -> list[str]:
        pile = []
        while cadre is not None and len(pile) < PROFONDEUR:
            fichier = Path(cadre.f_code.co_filename)
            if (fichier.is_relative_to(self.racine) and fichier.name not in OUTILLAGE
                    and cadre.f_code.co_name != "<module>"):
                pile.append(f"{fichier.relative_to(self.racine)}:{cadre.f_lineno} {cadre.f_code.co_name}")
            cadre = cadre.f_back
        return pile

    def ecrire(self, chemin: Path, blend: str) -> int:
        objets = {}
        for obj, pile, patron in self.liens:
            try:
                nom = obj.name
            except ReferenceError:      # supprimé plus tard dans le build
                continue
            # Le DERNIER lien l'emporte.
            objets[nom] = {"pile": pile, "patron": patron} if patron else {"pile": pile}
        chemin.parent.mkdir(parents=True, exist_ok=True)
        chemin.write_text(json.dumps({"blend": blend, "built": time.time(), "objects": objets},
                                     ensure_ascii=False))
        return len(objets)


@contextlib.contextmanager
def enregistrer(racine: Path):
    """Relève chaque `collection.objects.link(obj)` fait sous ce bloc."""
    journal = Journal(racine.resolve())
    outil = next(i for i in (4, 3) if M.get_tool(i) is None)

    import bpy  # noqa: PLC0415 — le reste du module n'en a pas besoin
    # `repr()` d'un appelable quelconque exécute du code arbitraire (et casse
    # sur un objet à moitié construit) : on ne le demande qu'aux fonctions RNA.
    bpy_func = type(bpy.context.scene.collection.objects.link)

    def appel(_code, _offset, fonction, arg0):
        if type(fonction) is not bpy_func or repr(fonction) != LINK:
            return M.DISABLE
        cadre = sys._getframe(1)
        patron = None
        if cadre.f_code.co_name in POSES:
            # `place()`/`_clone_base()` copient un patron de la bibliothèque :
            # il est dans leur variable locale `obj` au moment du lien.
            source = cadre.f_locals.get("obj")
            if source is not None and source is not arg0:
                patron = getattr(source, "name", None)
        journal.liens.append((arg0, journal._pile(cadre), patron))
        return None

    M.use_tool_id(outil, "cassandre-provenance")
    # Réarme les sites désactivés par un relevé précédent.
    M.restart_events()
    M.register_callback(outil, M.events.CALL, appel)
    M.set_events(outil, M.events.CALL)
    try:
        yield journal
    finally:
        M.set_events(outil, 0)
        M.register_callback(outil, M.events.CALL, None)
        M.free_tool_id(outil)


def site(pile: list[str]) -> str | None:
    """Le cadre à ouvrir : le plus profond hors des helpers génériques."""
    def specifique(cadre: str) -> bool:
        lieu, fonction = cadre.split(" ", 1)
        return Path(lieu.split(":")[0]).name not in GENERIQUES and fonction not in POSES
    return next((c for c in pile if specifique(c)), pile[0] if pile else None)
