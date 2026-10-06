"""
Extension « Cassandre » : rend `tools/blender/cassandre.py` importable dans la
session ouverte (`import cassandre as C` depuis le MCP), et en fait un panneau
de la vue 3D (N › Cassandre).

Installée comme DÉPÔT LOCAL pointant sur `tools/blender/extension/` : Blender
lit ce dossier en place, rien à re-zipper. La logique reste dans
`cassandre.py` ; ce fichier n'est que le branchement à l'interface.
"""

import importlib
import sys
from pathlib import Path

import bpy

OUTILS = str(Path(__file__).resolve().parents[2])      # tools/blender


def _cassandre():
    """Le module À JOUR : le bouton « Relire » le purge, on le réimporte ici."""
    if OUTILS not in sys.path:
        sys.path.insert(0, OUTILS)
    return importlib.import_module("cassandre")


def _resume(commande: str, res: dict) -> str:
    """Une ligne pour la barre d'état et le panneau — le détail est dans le log."""
    if commande == "status":
        drapeaux = [k for k in ("dirty", "disk_newer_than_session",
                                "sources_newer_than_blend", "glb_older_than_blend")
                    if res.get(k)]
        return f"{res.get('objects')} objets" + (f" — {', '.join(drapeaux)}" if drapeaux else " — à jour")
    if commande == "check":
        audit = res.get("audit", {}).get("counts", {})
        defauts = ", ".join(f"{k} {v}" for k, v in audit.items() if v)
        return f"{res['validate']['verdict']}" + (f" | audit : {defauts}" if defauts else " | audit propre")
    if commande == "shot":
        return f"{res['png']} ({res['ko']} Ko)"
    ok = "OK" if res.get("ok") else "ÉCHEC"
    return f"{ok} en {res.get('secs')} s — {res.get('log')}"


COMMANDES = [
    ("status", "État", "Fraîcheur de la session face au disque et aux sources", "INFO"),
    ("build", "Construire", "Reconstruit le niveau choisi (copie de sécurité si modifiée)", "MOD_BUILD"),
    ("check", "Vérifier", "validate_level + audit_niveau, verdicts seuls", "CHECKMARK"),
    ("shot", "Vue joueur", "Rend la vue depuis spawn_player, FOV du jeu", "RENDER_STILL"),
    ("export", "Exporter", "Exporte le GLB du niveau choisi", "EXPORT"),
]


class CASSANDRE_OT_run(bpy.types.Operator):
    bl_idname = "cassandre.run"
    bl_label = "Commande Cassandre"
    bl_description = "Lance une commande de tools/blender/cassandre.py"

    commande: bpy.props.EnumProperty(items=[(cle, nom, aide) for cle, nom, aide, _ in COMMANDES])

    def execute(self, context):
        try:
            kwargs = {"niveau": context.window_manager.cassandre_niveau} if self.commande in {"status", "build", "check", "export"} else {}
            res = getattr(_cassandre(), self.commande)(**kwargs)
        except Exception as exc:  # noqa: BLE001 — affiché, pas avalé
            self.report({"ERROR"}, f"{self.commande} : {exc}")
            return {"CANCELLED"}
        ligne = _resume(self.commande, res)
        context.window_manager.cassandre_dernier = f"{self.commande} : {ligne}"
        echec = res.get("ok") is False
        self.report({"WARNING"} if echec else {"INFO"}, ligne)
        return {"FINISHED"}


class CASSANDRE_OT_reload(bpy.types.Operator):
    bl_idname = "cassandre.reload"
    bl_label = "Relire les scripts"
    bl_description = "Oublie les modules de tools/ chargés, pour relire le disque au prochain appel"

    def execute(self, context):
        res = _cassandre().reload()
        self.report({"INFO"}, f"{len(res['purges'])} modules oubliés")
        return {"FINISHED"}


class CASSANDRE_PT_panel(bpy.types.Panel):
    bl_label = "Cassandre"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Cassandre"

    def draw(self, context):
        self.layout.prop(context.window_manager, "cassandre_niveau", text="Niveau")
        col = self.layout.column(align=True)
        for cle, nom, _aide, icone in COMMANDES:
            col.operator("cassandre.run", text=nom, icon=icone).commande = cle
        self.layout.operator("cassandre.reload", icon="FILE_REFRESH")
        dernier = context.window_manager.cassandre_dernier
        if dernier:
            boite = self.layout.box()
            for morceau in dernier.split(" | "):
                boite.label(text=morceau)


CLASSES = (CASSANDRE_OT_run, CASSANDRE_OT_reload, CASSANDRE_PT_panel)


def register():
    if OUTILS not in sys.path:
        sys.path.insert(0, OUTILS)
    bpy.types.WindowManager.cassandre_niveau = bpy.props.EnumProperty(items=[
        ("hypermarche", "Magasin", "Niveau 1"), ("metro", "Métro", "Niveau 2 — atelier N0")])
    bpy.types.WindowManager.cassandre_dernier = bpy.props.StringProperty()
    for cls in CLASSES:
        bpy.utils.register_class(cls)


def unregister():
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)
    del bpy.types.WindowManager.cassandre_niveau
    del bpy.types.WindowManager.cassandre_dernier
    if OUTILS in sys.path:
        sys.path.remove(OUTILS)
