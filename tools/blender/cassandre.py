"""
Commandes Blender du projet, en un appel — PROJET_CASSANDRE.

Le même module sert trois usages, pour qu'aucune recette ne vive en double :

- depuis le MCP Blender, en une ligne :
      import cassandre as C; result = C.status()
- en ligne de commande, headless (sous-agents compris) :
      blender -b niveau.blend -P tools/blender/cassandre_cli.py -- check
- depuis le panneau « Cassandre » de la vue 3D (extension
  `tools/blender/extension/cassandre/`).

Chaque commande renvoie un dict COMPACT, sérialisable en JSON : verdicts,
comptes, premières erreurs — jamais un log brut. Le log complet part dans
`renders/_cassandre/<commande>.log` quand on veut creuser.

Les scripts du pipeline (`build_niveau.py`, `validate_level.py`,
`audit_niveau.py`, `export_level.py`) ne sont pas réécrits : ils sont lancés
tels quels par `run()`, qui absorbe ce qui casse sous le MCP (`sys.exit`
refusé, modules périmés en cache, `sys.argv` attendu).
"""

from __future__ import annotations

import contextlib
import fnmatch
import io
import json
import math
import os
import re
import runpy
import sys
import time
import traceback
from pathlib import Path

import bpy
from mathutils import Euler, Vector

if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
import provenance  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
TOOLS = REPO / "tools"
BLEND_V2 = REPO / "assets_src/blender/niveau_v2.blend"
GLB_V2 = REPO / "public/assets/levels/niveau_v2.glb"
OUT_DIR = REPO / "renders/_cassandre"      # /renders/ est gitignoré

BUILD = TOOLS / "level_v2/build_niveau.py"
VALIDATE = TOOLS / "blender/validate_level.py"
AUDIT = TOOLS / "level_v2/audit_niveau.py"
EXPORT = TOOLS / "blender/export_level.py"

GAME_LENS = 13.2        # 107° horizontal, comme `render_ingame.py`
EYE_HEIGHT = 1.6
SHOT_CAM = "_cassandre_cam"
# Ce que le joueur ne voit jamais : proxies de collision, volumes logiques.
INVISIBLES = ("col_", "trig_", "secret_", "cam_", "spawn_")


# --- Exécution des scripts du pipeline ----------------------------------------

def reload() -> dict:
    """Oublie tous les modules chargés depuis `tools/` — y compris celui-ci.

    Le prochain `import cassandre` relit le disque. À appeler après avoir
    modifié un `lib_*.py` : `runpy` relit le script lancé, pas ses imports.
    """
    purges = [name for name, mod in list(sys.modules.items())
              if _sous_tools(getattr(mod, "__file__", None))]
    for name in purges:
        del sys.modules[name]
    return {"purges": sorted(purges)}


def _sous_tools(fichier: str | None) -> bool:
    if not fichier:
        return False
    try:
        return Path(fichier).resolve().is_relative_to(TOOLS)
    except (OSError, ValueError):
        return False


def run(script: str | Path, *args: str, keep: str | None = None, tail: int = 40) -> dict:
    """Lance un script du dépôt comme `blender -P script -- args`.

    `keep` : ne rend que les lignes qui commencent par ce préfixe (`"[niveau]"`).
    Sinon, les `tail` dernières lignes. Le log complet est écrit sur disque.
    """
    script = Path(script)
    if not script.is_absolute():
        script = REPO / script
    # Les imports des scripts (`lib_*`, `plan_de_masse`...) doivent être relus
    # à chaque lancement, sinon on exécute la version d'il y a une heure. On
    # ne purge pas ce module-ci : on est en train de l'exécuter.
    for name, mod in list(sys.modules.items()):
        if name not in (__name__, "__main__", "provenance") and _sous_tools(getattr(mod, "__file__", None)):
            del sys.modules[name]

    argv, sortie, code, debut = sys.argv, io.StringIO(), 0, time.time()
    sys.argv = ["blender", "--", *args]
    try:
        with contextlib.redirect_stdout(sortie), contextlib.redirect_stderr(sortie):
            try:
                runpy.run_path(str(script), run_name="__main__")
            except SystemExit as exc:
                code = exc.code if isinstance(exc.code, int) else (0 if exc.code is None else 1)
            except RuntimeError as exc:
                # Le bac à sable du MCP refuse `sys.exit` par un RuntimeError :
                # le verdict est déjà dans la sortie, on ne sait juste pas le code.
                if "sys.exit" not in str(exc):
                    raise
                code = None
    except Exception:  # noqa: BLE001 — un script cassé est un résultat, pas un crash de l'outil
        sortie.write(traceback.format_exc())
        code = -1
    finally:
        sys.argv = argv

    texte = sortie.getvalue()
    log = _ecrire_log(script.stem, texte)
    lignes = texte.splitlines()
    if code == -1:
        extrait = lignes[-15:]
    elif keep:
        extrait = [ligne for ligne in lignes if ligne.startswith(keep)]
    else:
        extrait = lignes[-tail:]
    return {"code": code, "secs": round(time.time() - debut, 1), "lines": extrait, "log": log}


def _ecrire_log(nom: str, texte: str) -> str:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    chemin = OUT_DIR / f"{nom}.log"
    chemin.write_text(texte)
    return str(chemin.relative_to(REPO))


# --- État de la session ---------------------------------------------------------

def status() -> dict:
    """Où en est la session : fichier, fraîcheur face au disque et aux sources."""
    fichier = bpy.data.filepath
    objets = bpy.data.objects
    etat = {
        "file": _rel(fichier) if fichier else None,
        "dirty": bpy.data.is_dirty,
        "objects": len(objets),
        "meshes": sum(1 for o in objets if o.type == "MESH"),
        "leftover_cams": [o.name for o in objets if o.name.startswith(SHOT_CAM)],
    }
    if fichier and os.path.exists(fichier):
        # La session peut être PLUS VIEILLE que son fichier : un build headless
        # réécrit le .blend sans que le Blender ouvert le relise.
        etat["disk_newer_than_session"] = os.path.getmtime(fichier) > _ouvert_a()
    sources = max(p.stat().st_mtime for d in ("level_v2", "blender")
                  for p in (TOOLS / d).rglob("*.py"))
    if BLEND_V2.exists():
        blend = BLEND_V2.stat().st_mtime
        etat["v2_blend_age_min"] = round((time.time() - blend) / 60)
        etat["v2_sources_newer_than_blend"] = sources > blend
        if GLB_V2.exists():
            etat["v2_glb_older_than_blend"] = GLB_V2.stat().st_mtime < blend
    return etat


def _rel(chemin: str) -> str:
    try:
        return str(Path(chemin).resolve().relative_to(REPO))
    except ValueError:
        return chemin


# « Quand la session a lu son fichier » : posé par `load_post` (voir en bas),
# rangé dans `driver_namespace` pour survivre à `reload()`. Faute de mieux au
# premier import, l'instant de cet import.
_CLE_OUVERTURE = "cassandre_ouvert_a"


def _ouvert_a() -> float:
    return bpy.app.driver_namespace.setdefault(_CLE_OUVERTURE, time.time())


def _sauver_si_sale(raison: str) -> str | None:
    """Copie de sécurité AVANT une commande qui remplace la scène."""
    if not bpy.data.is_dirty:
        return None
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    copie = OUT_DIR / f"avant_{raison}_{time.strftime('%Y%m%d_%H%M%S')}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(copie), copy=True)
    return _rel(str(copie))


# --- Pipeline du niveau v2 ------------------------------------------------------

def build(out: str | Path = BLEND_V2, detail: bool = False) -> dict:
    """Reconstruit le niveau v2 DANS la session (≈ 20 s) et l'enregistre sous `out`.

    Une session modifiée non sauvegardée est d'abord copiée dans
    `renders/_cassandre/` : le build vide la scène. Sans `detail`, les lignes
    par espace habillé et par spawn recalé sont résumées en un compte.
    """
    copie = _sauver_si_sale("build")
    out = Path(out).resolve()
    with provenance.enregistrer(TOOLS) as journal:
        res = run(BUILD, "--out", str(out), keep="[niveau]")
    if res["code"] in (0, None):
        res["provenance"] = journal.ecrire(_fichier_provenance(out), str(out))
    lignes = [ligne.removeprefix("[niveau] ") for ligne in res["lines"]
              if not ligne.startswith("[niveau] ---")]
    if not detail:
        habilles = [ligne for ligne in lignes if ligne.startswith("HABILLÉ ")]
        recales = [ligne for ligne in lignes if ligne.startswith("spawn recalé")]
        lignes = [ligne for ligne in lignes if ligne not in habilles and ligne not in recales]
        lignes.insert(0, f"{len(habilles)} espaces habillés, {len(recales)} spawns recalés")
    res["lines"] = lignes
    if copie:
        res["backup"] = copie
    res["ok"] = res["code"] in (0, None)
    return res


def _fichier_provenance(blend: str | Path) -> Path:
    return OUT_DIR / f"provenance_{Path(blend).stem}.json"


def where(cible=None, pres: tuple | None = None, rayon: float = 2.0, limit: int = 8) -> dict:
    """Quelle ligne de quel script a posé cet objet — relevé par le dernier `build()`.

    `cible` : un nom d'objet, un motif `fnmatch` (`"gondole_*"`), ou None avec
    `pres=(x, y[, z])` pour les objets visibles les plus proches du point.
    Rend pour chacun le `site` à ouvrir (hors helpers génériques) et la `pile`.
    """
    fichier = _fichier_provenance(bpy.data.filepath or BLEND_V2)
    if not fichier.exists():
        return {"error": f"pas de relevé {_rel(str(fichier))} — lancer C.build() d'abord"}
    releve = json.loads(fichier.read_text())
    res = {}
    if bpy.data.filepath and os.path.getmtime(bpy.data.filepath) > releve["built"] + 5:
        res["warning"] = "le .blend a été réécrit après le relevé (autre outil ?) : lignes peut-être décalées"

    if pres is not None:
        # Distance à la BOÎTE englobante, pas à l'origine : les boîtes du
        # projet sont bâties en coordonnées monde, origine en (0, 0, 0).
        point = list(pres)
        candidats = []
        for obj in bpy.context.scene.objects:
            if obj.type != "MESH" or obj.name.startswith(INVISIBLES):
                continue
            coins = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
            d2 = 0.0
            for axe, v in enumerate(point):
                bas, haut = min(c[axe] for c in coins), max(c[axe] for c in coins)
                d2 += max(bas - v, 0.0, v - haut) ** 2
            if d2 <= rayon * rayon:
                taille = (max(c.x for c in coins) - min(c.x for c in coins)) * (max(c.y for c in coins) - min(c.y for c in coins))
                candidats.append((round(d2, 3), taille, obj.name))
        # À égalité (point DANS plusieurs boîtes), le plus petit objet d'abord :
        # le sol et les murs englobent tout.
        noms = [nom for _d, _t, nom in sorted(candidats)]
    elif cible and any(c in cible for c in "*?["):
        noms = sorted(n for n in releve["objects"] if fnmatch.fnmatchcase(n, cible))
    else:
        noms = [cible]

    trouves = []
    for nom in noms[:limit]:
        entree = releve["objects"].get(nom)
        if entree is None:
            trouves.append({"name": nom, "site": None, "note": "absent du relevé (opérateur, ou posé hors build)"})
            continue
        trouve = {"name": nom, "site": provenance.site(entree["pile"]), "pile": entree["pile"]}
        # Une instance posée par `place()` : remonter les copies de patron
        # jusqu'à l'endroit où l'asset lui-même est défini.
        patrons, courant = [], entree
        while courant.get("patron") in releve["objects"] and len(patrons) < 4:
            patrons.append(courant["patron"])
            courant = releve["objects"][courant["patron"]]
        if patrons:
            trouve["patron"] = patrons[-1]
            trouve["patron_site"] = provenance.site(courant["pile"])
        trouves.append(trouve)
    res.update({"total": len(noms), "objects": trouves})
    return res


_AUDIT_TITRE = re.compile(r"^\[audit\] (?P<titre>[A-ZÉÈÀ][^—]+?) — (?P<n>\d+)")


def compose_public(preview: str | None = None) -> dict:
    """Six compositions locales de galerie/cafétéria/rayons, source sauvegardée."""
    args = ("--preview", str(Path(preview).resolve())) if preview else ()
    result = run("tools/blender/refresh_public_compositions.py", *args, tail=12)
    result["ok"] = result["code"] == 0
    return result


def direction_covers() -> dict:
    """Candidat isolé : deux meubles bas, vues avant/après et hauteur de tir."""
    result = run("tools/blender/preview_director_covers.py", tail=12)
    result["ok"] = result["code"] == 0
    return result


def orient_office_screens(preview: str | None = None) -> dict:
    """Écran et clavier face au fauteuil ; mise à jour locale sauvegardée."""
    args = ("--preview", str(Path(preview).resolve())) if preview else ()
    result = run("tools/blender/refresh_office_screens.py", *args, tail=8)
    result["ok"] = result["code"] == 0
    return result


def rework_checkouts(preview: str | None = None, inspect: bool = False) -> dict:
    """Six travées numérotées ; aperçu isolé ou mise à jour locale du niveau."""
    args = ["--inspect"] if inspect else []
    if preview:
        args.extend(("--preview", str(Path(preview).resolve())))
    result = run("tools/blender/refresh_checkouts.py", *args, tail=12)
    result["ok"] = result["code"] == 0
    return result


def rework_accesses(preview: str | None = None) -> dict:
    """Commandes lisibles et local technique caché par un distributeur coulissant."""
    args = ("--preview", str(Path(preview).resolve())) if preview else ()
    result = run("tools/blender/refresh_door_controls.py", *args, tail=8)
    result["ok"] = result["code"] == 0
    return result


def rework_backstage(preview: str | None = None, inspect: bool = False) -> dict:
    """Réserve, locaux du personnel et quête de la carte Or au parking."""
    args = ["--inspect"] if inspect else []
    if preview:
        args.extend(("--preview", str(Path(preview).resolve())))
    result = run("tools/blender/refresh_backstage.py", *args, tail=15)
    result["ok"] = result["code"] == 0
    return result


def repair_backstage(preview: str | None = None) -> dict:
    """Rétablit le sas Argent, les rideaux du compacteur et les raccords de signalétique."""
    args = ("--preview", str(Path(preview).resolve())) if preview else ()
    result = run("tools/blender/repair_backstage.py", *args, tail=12)
    result["ok"] = result["code"] == 0
    return result


def story_triggers(preview: str | None = None) -> dict:
    """Pose les `trig_*` du script de niveau (ADR 0037) ; aperçu isolé ou niveau livré."""
    args = ("--preview", str(Path(preview).resolve())) if preview else ()
    result = run("tools/blender/refresh_story_triggers.py", *args, tail=8)
    result["ok"] = result["code"] == 0
    return result


def perk_kiosks(preview: str | None = None) -> dict:
    """Pose les bornes de perks (`use_*` portant `perk` et `prix`) ; aperçu isolé ou niveau livré."""
    args = ("--preview", str(Path(preview).resolve())) if preview else ()
    result = run("tools/blender/refresh_perk_kiosks.py", *args, tail=8)
    result["ok"] = result["code"] == 0
    return result


def gas_props(preview: str | None = None) -> dict:
    """Pose les bonbonnes de gaz explosives (`prop_*` de matière `gaz`) ; aperçu isolé ou niveau livré."""
    args = ("--preview", str(Path(preview).resolve())) if preview else ()
    result = run("tools/blender/refresh_gas_props.py", *args, tail=8)
    result["ok"] = result["code"] == 0
    return result


def encounters(preview: str | None = None) -> dict:
    """Pose les rencontres du lot B6 (rideau nord de la réserve, groupes d'ennemis, déclencheurs) ; aperçu isolé ou niveau livré."""
    args = ("--preview", str(Path(preview).resolve())) if preview else ()
    result = run("tools/blender/refresh_encounters.py", *args, tail=8)
    result["ok"] = result["code"] == 0
    return result


def store_sign(preview: str | None = None) -> dict:
    """Enseigne lumineuse Hyper Varan sur la façade ; pose locale rejouable."""
    args = ("--preview", str(Path(preview).resolve())) if preview else ()
    result = run("tools/blender/refresh_store_sign.py", *args, tail=8)
    result["ok"] = result["code"] == 0
    return result


def check(strict: bool = False, audit: bool = True, details: int = 8) -> dict:
    """Contrat (`validate_level`) + ce qui ne se voit qu'en jouant (`audit_niveau`)."""
    args = ["--strict"] if strict else []
    val = run(VALIDATE, *args, tail=400)
    lignes = [ligne.strip() for ligne in val["lines"]]
    verdict = next((ligne for ligne in lignes if ligne.startswith("VERDICT")), None)
    res = {
        "validate": {
            "verdict": verdict or f"introuvable (code {val['code']}, voir {val['log']})",
            "errors": [ligne.removeprefix("ERROR  ") for ligne in lignes if ligne.startswith("ERROR")][:details],
            "warnings": [ligne.removeprefix("WARN   ") for ligne in lignes if ligne.startswith("WARN")][:details],
        },
    }
    if val["code"] == -1:
        res["validate"]["crash"] = val["lines"]
    if audit:
        aud = run(AUDIT, keep="[audit]")
        comptes, detail, courant = {}, {}, None
        for ligne in aud["lines"]:
            m = _AUDIT_TITRE.match(ligne)
            if m:
                courant = m["titre"].strip().lower()
                comptes[courant] = int(m["n"])
            elif courant and ligne.startswith("[audit]   ") and comptes.get(courant):
                detail.setdefault(courant, [])
                if len(detail[courant]) < details:
                    detail[courant].append(" ".join(ligne.split()[1:]))
        res["audit"] = {"counts": comptes, "details": detail, "log": aud["log"]}
        if aud["code"] == -1:
            res["audit"]["crash"] = aud["lines"]
    return res


def export(out: str | Path = GLB_V2) -> dict:
    """Exporte le `.glb` par `export_level.py` (le seul export fiable, voir README).

    Le jeu en dev recharge le niveau tout seul : il sonde le fichier (ADR 0011).
    """
    _supprimer_cam()
    res = run(EXPORT, "--out", str(Path(out).resolve()), keep="[export]")
    res["verified"] = any("contenu vérifié" in ligne for ligne in res["lines"])
    res["ok"] = res["code"] in (0, None) and res["verified"]
    return res


# --- Regarder ------------------------------------------------------------------

def shot(vue="spawn", mode: str = "solid", taille=(640, 360), nom: str | None = None,
         sol: float | None = None, plafonds: bool | None = None,
         isoler: str | None = None, ajuster: bool = False) -> dict:
    """Rend une image et renvoie le chemin du PNG — sans rien laisser dans la scène.

    `vue` :
      - `"spawn"`           : depuis `spawn_player`, à hauteur d'yeux, FOV du jeu ;
      - `"joueur"`          : la dernière `cassandre.pose()` tapée dans le jeu ;
      - `(x, y, cap)`       : à hauteur d'yeux, cap en degrés (0 = +Y, 90 = −X,
                              même convention que `render_ingame.py`). L'altitude
                              du sol vient de l'espace du plan de masse qui
                              contient (x, y), ou de `sol` ;
      - `"dessus:<espace>"` : vue de dessus orthographique d'un espace du plan
                              de masse, plafonds masqués ;
      - un nom d'objet      : vue trois-quarts cadrée sur lui.
    `mode` : `"solid"` (Workbench texturé), `"material"` (EEVEE), ou
    `"silhouette"` (aplat noir sur blanc). `isoler` ne montre que les meshes
    dont le nom correspond au motif fnmatch, par exemple `"comp_ga_presse*"`.
    """
    scene = bpy.context.scene
    cam = _nouvelle_cam(scene)
    cadrage = _cadrer(cam, vue, sol)
    if plafonds is None:
        plafonds = cadrage["type"] != "dessus"
    if cadrage["type"] == "dessus":
        # Le cadre épouse l'espace : un couloir de 12 × 48 m dans du 16:9 ne
        # remplit qu'une bande. Le plus grand côté garde la taille demandée.
        largeur, profondeur = cadrage["x"][1] - cadrage["x"][0], cadrage["y"][1] - cadrage["y"][0]
        # `ajuster` : tenir DANS `taille` (une case de planche), sinon le plus
        # grand côté prend la taille demandée et le cadre peut la dépasser.
        echelle = (min(taille[0] / largeur, taille[1] / profondeur) if ajuster
                   else max(taille) / max(largeur, profondeur))
        taille = (round(largeur * echelle), round(profondeur * echelle))
    masques = _masquer(scene, plafonds)
    if isoler:
        for obj in scene.objects:
            if obj.type == "MESH" and not obj.hide_render and not fnmatch.fnmatch(obj.name, isoler):
                masques.append((obj, False))
                obj.hide_render = True
    restaurer = _regler_rendu(scene, mode, taille, cam)
    try:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        png = OUT_DIR / f"{nom or _nom_de_vue(vue)}.png"
        scene.render.filepath = str(png)
        bpy.ops.render.render(write_still=True)
    finally:
        restaurer()
        for obj, etat in masques:
            obj.hide_render = etat
        _supprimer_cam()
    return {"png": str(png), "ko": round(png.stat().st_size / 1024), **cadrage}


def sheet(vues, cols: int = 2, taille=(400, 225), mode: str = "solid", nom: str = "planche") -> dict:
    """Plusieurs vues en UNE image : un seul `Read` au lieu d'un par vue.

    `vues` : liste de ce que `shot` accepte (`"spawn"`, `(x, y, cap)`,
    `"dessus:<espace>"`, un nom d'objet…). Rangées de gauche à droite puis de
    haut en bas ; `cells` dit quelle case est quelle vue. Une vue de dessus a
    le cadre de son espace : elle est posée en haut à gauche de sa case.
    """
    import numpy as np  # noqa: PLC0415 — fourni par Blender, inutile ailleurs

    cases, meta = [], []
    for i, vue in enumerate(vues):
        vue = tuple(vue) if isinstance(vue, list) else vue
        res = shot(vue, mode=mode, taille=taille, nom=f"_{nom}_{i}", ajuster=True)
        png = Path(res["png"])
        img = bpy.data.images.load(str(png))
        try:
            w, h = img.size
            px = np.empty(w * h * 4, dtype=np.float32)
            img.pixels.foreach_get(px)
            cases.append(px.reshape(h, w, 4))
        finally:
            bpy.data.images.remove(img)
            png.unlink()
        meta.append({"i": i, "vue": vue if isinstance(vue, str) else list(vue),
                     **{k: res[k] for k in ("pos", "cap", "espace", "objet") if k in res}})

    lignes = math.ceil(len(cases) / cols)
    cw, ch = max(c.shape[1] for c in cases), max(c.shape[0] for c in cases)
    ecart = 4
    W, H = cols * cw + (cols - 1) * ecart, lignes * ch + (lignes - 1) * ecart
    planche = np.full((H, W, 4), (0.02, 0.02, 0.02, 1.0), dtype=np.float32)
    for i, case in enumerate(cases):
        r, c = divmod(i, cols)
        # Les pixels de Blender sont rangés du BAS vers le haut : la première
        # rangée d'images est donc en haut de `planche` = à la fin du tableau.
        y0 = H - (r + 1) * ch - r * ecart
        planche[y0 + (ch - case.shape[0]):y0 + ch, c * (cw + ecart):c * (cw + ecart) + case.shape[1]] = case

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    chemin = OUT_DIR / f"{nom}.png"
    sortie = bpy.data.images.new(f"_{nom}", W, H, alpha=False)
    try:
        sortie.pixels.foreach_set(planche.ravel())
        sortie.filepath_raw = str(chemin)
        sortie.file_format = "PNG"
        sortie.save()
    finally:
        bpy.data.images.remove(sortie)
    return {"png": str(chemin), "ko": round(chemin.stat().st_size / 1024), "size": [W, H], "cols": cols, "cells": meta}


def _nom_de_vue(vue) -> str:
    if isinstance(vue, str):
        return "vue_" + re.sub(r"[^a-zA-Z0-9_-]", "_", vue)
    return "vue_" + "_".join(f"{v:g}" for v in vue)


def _nouvelle_cam(scene):
    _supprimer_cam()
    data = bpy.data.cameras.new(SHOT_CAM)
    data.clip_start, data.clip_end = 0.05, 400.0
    cam = bpy.data.objects.new(SHOT_CAM, data)
    scene.collection.objects.link(cam)
    return cam


def _supprimer_cam() -> None:
    """La caméra de rendu ne doit JAMAIS partir à l'export ni à l'enregistrement."""
    for obj in [o for o in bpy.data.objects if o.name.startswith(SHOT_CAM)]:
        data = obj.data
        bpy.data.objects.remove(obj)
        if data and data.users == 0:
            bpy.data.cameras.remove(data)


POSE_JEU = OUT_DIR / "pose.json"


def _pose_joueur(vue, sol) -> dict | None:
    """Pose « à hauteur d'yeux » d'une vue, ou None si la vue n'en est pas une.

    `"spawn"`, `"joueur"` (la dernière `cassandre.pose()` du jeu) ou `(x, y, cap)`.
    """
    if vue == "spawn":
        spawn = bpy.data.objects.get("spawn_player")
        if spawn is None:
            raise ValueError("pas de spawn_player dans la scène")
        p = spawn.matrix_world.translation
        # Le jeu prend le +Y local de l'empty comme « avant » (loader.ts, yaw).
        cap = math.degrees(spawn.matrix_world.to_euler().z)
        return {"x": p.x, "y": p.y, "z": p.z, "eye": p.z + EYE_HEIGHT, "cap": cap, "pitch": 0.0}
    if vue == "joueur":
        if not POSE_JEU.exists():
            raise ValueError("pas de pose : taper cassandre.pose() dans la console du jeu (serveur de dev)")
        pose = json.loads(POSE_JEU.read_text())
        pose["age_s"] = round(time.time() - pose.pop("t", time.time()))
        return pose
    if isinstance(vue, (tuple, list)):
        x, y, cap = vue
        if sol is None:
            espace = _espace_en(x, y)
            sol = espace.z if espace else 0.0
        return {"x": x, "y": y, "z": sol, "eye": sol + EYE_HEIGHT, "cap": cap, "pitch": 0.0}
    return None


def _cadrer(cam, vue, sol) -> dict:
    pose = _pose_joueur(vue, sol)
    if pose is not None:
        return _cadrer_joueur(cam, pose) | {"type": "joueur"}
    if isinstance(vue, str) and vue.startswith("dessus:"):
        return _cadrer_dessus(cam, vue.split(":", 1)[1])
    obj = bpy.data.objects.get(vue)
    if obj is None:
        raise ValueError(f"objet introuvable : {vue}")
    return _cadrer_objet(cam, obj)


def _cadrer_joueur(cam, pose: dict) -> dict:
    cam.data.lens = GAME_LENS
    cam.location = (pose["x"], pose["y"], pose["eye"])
    cam.rotation_euler = Euler((math.radians(90.0 + pose["pitch"]), 0.0, math.radians(pose["cap"])), "XYZ")
    x, y, z, cap = (round(pose[k], 2) for k in ("x", "y", "z", "cap"))
    res = {"pos": [x, y, z], "cap": cap,
           # À coller dans la console du jeu pour voir la même chose en vrai.
           "tp": f"cassandre.tp({x:g}, {y:g}, {z:g}, {cap:g})"}
    if "age_s" in pose:
        res["pose_age_s"] = pose["age_s"]
    return res


def _cadrer_dessus(cam, espace_id: str) -> dict:
    espace = next((s for s in _plan().ALL if s.id == espace_id), None)
    if espace is None:
        ids = sorted(s.id for s in _plan().ALL)
        raise ValueError(f"espace inconnu : {espace_id} — connus : {', '.join(ids)}")
    cx, cy = sum(espace.x) / 2, sum(espace.y) / 2
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = max(espace.x[1] - espace.x[0], espace.y[1] - espace.y[0]) * 1.08
    cam.location = (cx, cy, espace.z + 60.0)
    cam.rotation_euler = (0.0, 0.0, 0.0)
    return {"type": "dessus", "espace": espace_id,
            "x": list(espace.x), "y": list(espace.y), "z": espace.z}


def _cadrer_objet(cam, obj) -> dict:
    coins = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    centre = sum(coins, Vector()) / 8
    rayon = max((c - centre).length for c in coins)
    direction = Vector((-1.0, -1.0, 0.7)).normalized()
    cam.data.lens = 24.0
    cam.location = centre + direction * max(rayon * 2.6, 2.5)
    cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    return {"type": "objet", "objet": obj.name, "centre": [round(v, 2) for v in centre]}


def _plan():
    dossier = str(TOOLS / "level_v2")
    if dossier not in sys.path:
        sys.path.insert(0, dossier)
    import plan_de_masse  # noqa: PLC0415 — propre au niveau v2, chargé à la demande
    return plan_de_masse


def _espace_en(x: float, y: float):
    try:
        plan = _plan()
    except ImportError:
        return None
    for espace in plan.ALL:
        if espace.x[0] <= x <= espace.x[1] and espace.y[0] <= y <= espace.y[1]:
            return espace
    return None


def _masquer(scene, plafonds: bool) -> list:
    masques = []
    for obj in scene.objects:
        cacher = obj.name.startswith(INVISIBLES) or (not plafonds and obj.name.startswith("plafond"))
        if cacher and not obj.hide_render:
            masques.append((obj, obj.hide_render))
            obj.hide_render = True
    return masques


def _regler_rendu(scene, mode: str, taille, cam):
    """Règle le rendu et renvoie la fonction qui remet tout comme avant."""
    r, shading = scene.render, scene.display.shading
    avant = {
        "engine": r.engine, "rx": r.resolution_x, "ry": r.resolution_y,
        "pct": r.resolution_percentage, "path": r.filepath,
        "fmt": r.image_settings.file_format, "camera": scene.camera,
        "light": shading.light, "color": shading.color_type,
        "view": scene.view_settings.view_transform,
        "single": tuple(shading.single_color), "background_type": shading.background_type,
        "background": tuple(shading.background_color), "shadows": shading.show_shadows,
        "transparent": r.film_transparent,
        "world_color": tuple(scene.world.color) if scene.world else None,
    }
    if mode == "material":
        moteurs = r.bl_rna.properties["engine"].enum_items.keys()
        r.engine = next(e for e in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE") if e in moteurs)
    else:
        r.engine = "BLENDER_WORKBENCH"
        shading.light = "STUDIO"
        shading.color_type = "TEXTURE"
        if mode == "silhouette":
            r.film_transparent = False
            shading.light = "FLAT"
            shading.color_type = "SINGLE"
            shading.single_color = (0, 0, 0)
            shading.background_type = "WORLD"
            shading.background_color = (1, 1, 1)
            if scene.world:
                scene.world.color = (1, 1, 1)
            shading.show_shadows = False
    r.resolution_x, r.resolution_y = taille
    r.resolution_percentage = 100
    r.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    scene.camera = cam

    def restaurer():
        r.engine = avant["engine"]
        r.resolution_x, r.resolution_y = avant["rx"], avant["ry"]
        r.resolution_percentage = avant["pct"]
        r.filepath = avant["path"]
        r.image_settings.file_format = avant["fmt"]
        scene.camera = avant["camera"]
        shading.light, shading.color_type = avant["light"], avant["color"]
        shading.single_color = avant["single"]
        shading.background_type, shading.background_color = avant["background_type"], avant["background"]
        shading.show_shadows = avant["shadows"]
        r.film_transparent = avant["transparent"]
        if scene.world and avant["world_color"] is not None:
            scene.world.color = avant["world_color"]
        scene.view_settings.view_transform = avant["view"]
    return restaurer


# --- Budget de lots de dessin ---------------------------------------------------

DECOR_CELL_SIZE = 48.0          # `src/game/level/loading/mergeStaticDecor.ts`
DRAW_CALL_BUDGET = 200
GAME_FAR = 130.0                # `session/gameEngine.ts`, PerspectiveCamera
DEMI_FOV_V = math.radians(75.0 / 2)
DEMI_FOV_H = math.atan(math.tan(DEMI_FOV_V) * 640 / 360)
# Ce qui ne se dessine jamais en jeu (le loader les masque) ou n'est pas un mesh rendu.
NON_RENDUS = ("col_", "trig_", "secret_", "spawn_", "cam_", "light_")
# Fusions dédiées, par matériau à l'échelle du NIVEAU (`level.stats()` :
# `vitreBatchCount`, `ecranBatchCount`, `sanitaireBatchCount`), comme les portes.
FUSIONS_DEDIEES = ("vitre_", "sanitaire_", "ecran_", "door_")
# Un lot chacun, mais éteints au-delà d'une portée (mètres, depuis l'œil) :
# `props.ts` PROP_RENDER_DISTANCE_SQ, `render/environment/useObjectCulling.ts`.
SOLOS = {"prop_": 36.0, "use_": 48.0, "fx_douche_": None}


def _cle_materiau(mat) -> str:
    """Ce qui distingue deux matériaux après `toLambert` : texture, couleur, émission, alpha."""
    if mat is None:
        return "-"
    image, couleur, emission, alpha = None, None, None, 1.0
    if mat.node_tree:
        for noeud in mat.node_tree.nodes:
            if noeud.type == "TEX_IMAGE" and noeud.image and image is None:
                image = noeud.image.name
            elif noeud.type == "BSDF_PRINCIPLED":
                couleur = tuple(round(c, 3) for c in noeud.inputs["Base Color"].default_value[:3])
                alpha = noeud.inputs["Alpha"].default_value
                force = noeud.inputs["Emission Strength"].default_value
                if force > 0:
                    emission = (tuple(round(c, 3) for c in noeud.inputs["Emission Color"].default_value[:3]), round(force, 2))
    return f"{image or mat.name}|{couleur}|{emission}|{alpha < 1.0}"


def _lots() -> list[dict]:
    """Les lots de dessin du niveau tels que le loader les formera (ESTIMATION).

    Reprend les clés de `mergeStaticDecor.ts` : matériau + cellule de 48 m du
    CENTRE de la boîte, en repère three (x, z, −y). Le jeu d'attributs n'y est
    pas : mesuré le 2026-09-30, le compter donne 256 lots de décor pour 236 en
    jeu, l'ignorer 232.
    """
    groupes: dict[tuple, dict] = {}
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.visible_get() or obj.name.startswith(NON_RENDUS + (SHOT_CAM,)):
            continue
        coins = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        bas = Vector((min(c.x for c in coins), min(c.y for c in coins), min(c.z for c in coins)))
        haut = Vector((max(c.x for c in coins), max(c.y for c in coins), max(c.z for c in coins)))
        centre = (bas + haut) / 2
        cellule = tuple(math.floor(v / DECOR_CELL_SIZE) for v in (centre.x, centre.z, -centre.y))
        # Un mesh multi-matériau devient une primitive glTF par matériau.
        materiaux = {slot.material for slot in obj.material_slots} or {None}
        for mat in materiaux:
            cle_mat = _cle_materiau(mat)
            prefixe = obj.name.split("_", 1)[0] + "_"
            if obj.name.startswith(tuple(SOLOS)):
                cle, sorte = ("solo", obj.name, cle_mat), prefixe
            elif obj.name.startswith(FUSIONS_DEDIEES):
                cle, sorte = (prefixe, cle_mat), prefixe
            else:
                cle, sorte = ("decor", cle_mat, cellule), "decor"
            g = groupes.setdefault(cle, {"sorte": sorte, "mat": cle_mat.split("|")[0],
                                         "portee": SOLOS.get(prefixe) if cle[0] == "solo" else None,
                                         "cellule": cellule, "bas": bas.copy(), "haut": haut.copy(), "n": 0})
            g["n"] += 1
            for i in range(3):
                g["bas"][i] = min(g["bas"][i], bas[i])
                g["haut"][i] = max(g["haut"][i], haut[i])
    return list(groupes.values())


def _dans_le_champ(lot: dict, oeil: Vector, f: Vector, r: Vector, u: Vector) -> bool:
    """Test sphère englobante / pyramide de vue, comme le frustum culling de three."""
    centre = (lot["bas"] + lot["haut"]) / 2
    rayon = (lot["haut"] - lot["bas"]).length / 2
    d = centre - oeil
    if lot["portee"] is not None and d.length > lot["portee"]:
        return False
    sh, ch = math.sin(DEMI_FOV_H), math.cos(DEMI_FOV_H)
    sv, cv = math.sin(DEMI_FOV_V), math.cos(DEMI_FOV_V)
    for normale in (f * sh - r * ch, f * sh + r * ch, f * sv - u * cv, f * sv + u * cv):
        if d.dot(normale) < -rayon:
            return False
    return d.dot(f) <= GAME_FAR + rayon


def budget(vue=None, cellule_de: tuple | None = None, sol: float | None = None, top: int = 6) -> dict:
    """Lots de dessin du DÉCOR DU NIVEAU — estimation de ce que le loader formera.

    - sans argument : total et cellules les plus chargées ;
    - `vue` (`"spawn"`, `"joueur"`, `(x, y, cap)`) : lots dans le champ, au FOV
      et à la portée du jeu (un indicateur, sans plafond : ADR 0039) ;
    - `cellule_de=(x, y[, z])` : les matériaux déjà présents dans la cellule de
      48 m de ce point. En réutiliser un coûte 0 lot ; un nouveau en coûte 1.
    Hors estimation : ciel, arme en main, ennemis, pickups. La mesure qui fait
    foi reste `cassandre.renderBench(3).drawCalls` en jeu.
    """
    lots = _lots()
    res: dict = {"total": len(lots)}
    if cellule_de is not None:
        x, y = cellule_de[0], cellule_de[1]
        z = cellule_de[2] if len(cellule_de) > 2 else 1.0
        cellule = tuple(math.floor(v / DECOR_CELL_SIZE) for v in (x, z, -y))
        ici = [l for l in lots if l["cellule"] == cellule and l["sorte"] == "decor"]
        res.update({"cellule": list(cellule), "lots_decor": len(ici),
                    "materiaux": sorted({l["mat"] for l in ici})})
        return res
    if vue is not None:
        pose = _pose_joueur(vue, sol)
        if pose is None:
            raise ValueError("budget(vue=…) : 'spawn', 'joueur' ou (x, y, cap)")
        rot = Euler((math.radians(90.0 + pose["pitch"]), 0.0, math.radians(pose["cap"])), "XYZ").to_matrix()
        f, u, r = rot @ Vector((0, 0, -1)), rot @ Vector((0, 1, 0)), rot @ Vector((1, 0, 0))
        oeil = Vector((pose["x"], pose["y"], pose["eye"]))
        vus = [l for l in lots if _dans_le_champ(l, oeil, f, r, u)]
        par_sorte: dict[str, int] = {}
        par_cellule: dict[str, int] = {}
        for l in vus:
            par_sorte[l["sorte"]] = par_sorte.get(l["sorte"], 0) + 1
            cle = "/".join(map(str, l["cellule"]))
            par_cellule[cle] = par_cellule.get(cle, 0) + 1
        res.update({"vus": len(vus), "budget": DRAW_CALL_BUDGET,
                    "par_sorte": par_sorte,
                    "cellules": dict(sorted(par_cellule.items(), key=lambda kv: -kv[1])[:top]),
                    "pos": [round(pose[k], 2) for k in ("x", "y", "z")], "cap": round(pose["cap"], 1),
                    # Calibré le 2026-09-30 sur quatre vues du niveau v2 : de −12 %
                    # (vues denses) à +5 %. Près du budget, mesurer en jeu.
                    "precision": "-12 % .. +5 %, hors ennemis/arme/ciel",
                    "mesure": (f"cassandre.tp({pose['x']:g}, {pose['y']:g}, {pose['z']:g}, {pose['cap']:g}); "
                               "puis cassandre.renderBench(3).drawCalls")})
        return res
    par_cellule: dict[str, int] = {}
    for l in lots:
        cle = "/".join(map(str, l["cellule"]))
        par_cellule[cle] = par_cellule.get(cle, 0) + 1
    res["cellules"] = dict(sorted(par_cellule.items(), key=lambda kv: -kv[1])[:top])
    return res


# --- Chercher ------------------------------------------------------------------

def find(motif: str = "*", pres: tuple | None = None, rayon: float = 3.0, limit: int = 30) -> dict:
    """Objets dont le nom correspond au motif (`fnmatch`), éventuellement près de (x, y[, z]).

    Rend nom, position et dimensions arrondies — de quoi viser sans lister la scène.
    """
    trouves = []
    for obj in bpy.data.objects:
        if not fnmatch.fnmatchcase(obj.name, motif):
            continue
        p = obj.matrix_world.translation
        if pres is not None:
            cible = Vector((*pres, p.z) if len(pres) == 2 else pres)
            if (p - cible).length > rayon:
                continue
        trouves.append(obj)
    trouves.sort(key=lambda o: o.name)
    return {
        "total": len(trouves),
        "objects": [{"name": o.name, "pos": [round(v, 2) for v in o.matrix_world.translation],
                     "dims": [round(v, 2) for v in o.dimensions]} for o in trouves[:limit]],
    }


# --- Tenir l'instant d'ouverture à jour ---------------------------------------------------

def _marquer_ouverture(*_args) -> None:
    bpy.app.driver_namespace[_CLE_OUVERTURE] = time.time()


def _installer_handler() -> None:
    # Un seul handler, même après `reload()` : on retire ceux des chargements
    # précédents de ce module avant d'ajouter le nôtre.
    handlers = bpy.app.handlers.load_post
    for h in [h for h in handlers if getattr(h, "__name__", "") == "_marquer_ouverture"]:
        handlers.remove(h)
    handlers.append(_marquer_ouverture)


_installer_handler()


def as_json(res: dict) -> str:
    return json.dumps(res, ensure_ascii=False, default=str)
