---
title: export_vertex_color="ACTIVE" plutôt que export_colors
tags: [adr, pipeline, blender]
status: accepte
updated: 2026-09-06
---

# ADR 0021 — `export_vertex_color="ACTIVE"` plutôt que `export_colors`

## Statut

Accepté.

## Contexte

`blender-python-automation`/`blender-level-conventions` documentaient
l'export glTF avec `bpy.ops.export_scene.gltf(export_colors=True, ...)` — un
booléen. Sur Blender 5.1.2 (version du projet, voir `tools/blender/README.md`),
ce kwarg **n'existe plus** : l'exporteur glTF 5.x l'a remplacé par un ENUM
`export_vertex_color` à quatre valeurs (`MATERIAL` / `ACTIVE` / `NAME` /
`NONE`), défaut `MATERIAL`.

`MATERIAL` n'exporte les vertex colors QUE si le graphe de matériau les
référence explicitement via un nœud Color Attribute — ce n'est jamais le cas
des matériaux du kit hypermarché (Principled BSDF nu, couleur posée en dur,
voir `kit_spec.MATERIALS`). Avec le défaut, l'attribut `"Col"` bien réel dans
le `.blend` n'aurait silencieusement **pas** atteint `COLOR_0` du glTF : le
niveau aurait chargé sans aucune erreur, mais sans aucun éclairage de secteur
(ADR [0005](0005-eclairage-vertex-colors.md)).

Le piège s'est concrétisé au premier run réel de `export_level.py` en Blender
(2026-08-21, assemblage Zone A/B) — le script n'avait jusque-là tourné qu'en
théorie, jamais contre un vrai Blender 5.x.

## Décision

`export_level.py` appelle `export_vertex_color="ACTIVE"` : exporte l'attribut
de couleur ACTIF du mesh, quel que soit le matériau qui l'utilise.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Garder `export_colors=True` | n'existe plus sur Blender 5.x — `TypeError` à l'exécution, pas un échec silencieux, mais bloque tout export |
| Laisser `export_vertex_color` au défaut `MATERIAL` | silencieux : aucune erreur, aucun warning, juste `COLOR_0` absent ou vide — le pire mode d'échec possible pour ce projet |
| Ajouter un nœud Color Attribute à chaque matériau du kit pour que `MATERIAL` fonctionne | change les matériaux pour satisfaire un réglage d'export plutôt que l'inverse ; `ACTIVE` fait exactement ce qu'il faut sans y toucher |

## Conséquences

- Toute future pièce/matériau du kit n'a rien à faire de spécial pour que ses
  vertex colors s'exportent : `ACTIVE` ne dépend pas du graphe de matériau.
- Les skills `blender-python-automation`/`blender-level-conventions`
  documentent encore l'ancien exemple `export_colors=True` dans leurs
  extraits de code — écart de documentation connu, signalé à `director`,
  pas corrigé par cette tâche (hors périmètre `tools/blender/`).

## Comment on saurait qu'on a eu tort

Si un niveau exporté charge en jeu sans éclairage de secteur visible
(surfaces plates, `COLOR_0` absent au chargement) après un changement
touchant `export_level.py` ou une mise à jour de Blender — vérifier en
premier que `export_vertex_color` vaut toujours `"ACTIVE"` et que l'ENUM n'a
pas de nouveau changé de forme dans la version installée.
