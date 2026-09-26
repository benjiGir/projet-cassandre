---
title: Travailler avec les agents
tags: [guide, agents]
status: brouillon
updated: 2026-09-26
---

# Travailler avec les agents

Les agents spécialisés du dépôt sont définis dans `.claude/agents/`. Le routage revient à `director`. Un agent accélère une tâche bornée ; le code, les règles du dépôt et les preuves restent à vérifier.

| Agent | Domaine |
|---|---|
| `core-loop` | boucle fixe, input, horloge, hitstop, monde Rapier et groupes de collision. |
| `director` | décompose les demandes larges et route vers les spécialistes ; n'écrit pas le gameplay. |
| `doc-keeper` | documentation, migration de commentaires et liens. |
| `entity-designer` | ennemis, machines à états, IA, télégraphie, spawn et mort. |
| `feel-tuner` | déplacement, armes, recul, caméra et sensation ; propose des variantes A/B. |
| `level-forge` | construction et validation visuelle du niveau dans Blender. |
| `level-pipeline` | loader glTF, colliders, triggers, interactifs et hot reload runtime. |
| `qa-evidence` | captures déterministes, console, budgets et preuves de validation. |
| `retro-render` | résolution interne, matériaux, sprites, effets et rendu. |
| `shell` | câblage React, HUD, menus, flux d'écrans et audio runtime. |
| `sound-forge` | synthèse, recettes, analyse et génération du sprite audio. |
| `ui-forge` | direction artistique et apparence de l'interface 2D. |

## Choisir une spécialité

- Une modification qui traverse plusieurs systèmes commence par une décomposition avec `director`.
- Pour l'apparence du HUD ou des menus, `ui-forge` est responsable du visuel ; `shell` prend le câblage et les interactions.
- Pour un nouveau comportement ennemi, `entity-designer` prend l'IA, et `level-pipeline` seulement si le chargement/runtime glTF change.
- Pour une modification Blender, `level-forge` possède les scripts de construction ; `level-pipeline` possède le runtime.
- `qa-evidence` reçoit l'état final à vérifier. C'est le seul agent habilité dans le projet à déclarer un travail ou une phase terminé.
- `doc-keeper` met la connaissance durable dans les pages adaptées, sans devenir propriétaire du gameplay.

## Skills

Les skills sont des procédures ou contrats ciblés dans `.claude/skills/`. Chargez-les avant une tâche lorsqu'ils couvrent le système : par exemple `fixed-timestep-loop` pour la boucle, `enemy-state-machine` pour l'IA, `gltf-level-conventions` pour le glTF, `react-hud-bridge` pour le pont HUD ou `visual-evidence-gates` pour une vérification visuelle. Le catalogue dans l'environnement peut proposer d'autres skills ; le dossier du dépôt indique ceux versionnés ici.

## Limites à compenser

- Un agent ne peut pas entendre. Pour le son, demandez mesures et fichiers de préécoute, puis écoutez vous-même au casque.
- Une capture ou une image rapportée doit être ouverte et regardée, pas simplement présumée correcte.
- Les agents ne peuvent pas valider le plaisir ou la lisibilité d'une mécanique à la place d'un playtest humain.
- Un build vert ne démontre pas que l'objet est visible, que le contrôleur ne bloque pas une porte ou que l'audio a le bon timbre.
- Une tâche doit nommer ses fichiers et frontières de responsabilité. Les agents partagent le dépôt : ils ne doivent pas annuler les changements d'un autre contributeur.

Pour choisir un point d'entrée technique avant de déléguer, utilisez [Où agir](ou-agir.md).
