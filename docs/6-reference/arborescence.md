---
title: Arborescence du dépôt
tags: [reference, structure]
status: brouillon
updated: 2026-10-02
---

# Arborescence du dépôt

Vue des dossiers suivis utiles au développement. Les fichiers générés et les caches ne sont pas une source de vérité.

| Dossier | Rôle |
|---|---|
| `src/app/` | Démarrage du menu, acteur de flux, contrats de navigation et transitions vers une session. |
| `src/core/` | Horloge, boucle, input, audio, rejeu et RNG déterministe. |
| `src/game/devtools/` | Console et harnais de développement, retirés du build de production. |
| `src/game/entities/` | Entités, comportements et configurations des ennemis. |
| `src/game/level/` | Chargement glTF, interactions, portes, props, vitres, sanitaires et navigation. |
| `src/game/loop/` | Mise à jour de gameplay et présentation à chaque pas/frame. |
| `src/game/player/` | Contrôleur, armes et données du joueur. |
| `src/game/session/` | Création, reset, progression et fin d'une session. |
| `src/physics/` | Monde Rapier et raycasts. |
| `src/render/` | Renderer rétro, sprites, effets, éclairage et armes en vue subjective. |
| `src/ui/` | Overlay React, écrans, HUD et panneau de réglage en développement. |
| `test/core/` | Tests de la boucle, de l'input, du temps et de l'audio. |
| `test/game/` | Tests du joueur, des ennemis, du niveau et des sessions. |
| `test/physics/` | Tests de physique et de raycast. |
| `test/render/` | Tests des modules de rendu. |
| `test/ui/` | Tests des fonctions UI et du flux d'écrans. |
| `tools/audio/` | Recettes, rendu, analyse, écoute et empaquetage des sons. |
| `tools/blender/` | Kit, niveaux historiques, bake, rendu, validation et export glTF. |
| `tools/docs/` | Vérification des liens, audit des commentaires et remappage d'ancres. |
| `tools/level_v2/` | Construction, plan de masse et audit du niveau v2. |
| `tools/refs/` | Extraction de palettes à partir de références. |
| `tools/textures/` | Génération des textures du jeu. |
| `assets_src/blender/` | Sources Blender éditables ; jamais chargées en jeu. |
| `assets_src/library/` | Bibliothèque Blender des assets de niveau v2. |
| `assets_src/textures/` | Sources et manifestes des textures générées. |
| `assets_src/cc0_raw/` | Enregistrements sources ignorés par Git ; licences consignées dans `assets_src/LICENCES_ASSETS.md`. |
| `public/assets/levels/` | Niveaux glTF lus par le runtime. |
| `public/assets/audio/` | Sprites sonores et ambiances exportés. |
| `public/assets/sprites/` | Atlas ennemis et ramassages. |
| `public/assets/weapons/` | Modèles d'armes en vue subjective et au sol. |
| `docs/1-introduction/` à `docs/6-reference/` | Documentation structurée par besoin de lecture. |
| `docs/decisions/` | Décisions d'architecture (ADR). |
| `docs/journal/` | Historique des chantiers et des playtests. |
| `docs/archive/` | Ancienne documentation conservée après la phase I. |
| `.claude/agents/` | Définitions des agents spécialisés du dépôt. |
| `.claude/skills/` | Instructions spécialisées chargeables par les agents. |
| `.agents/skills/` | Copie des skills disponibles dans l'environnement de travail. |

## Règle de placement

Le code runtime vit dans `src/`. Les sources d'assets restent dans `assets_src/` ; le jeu ne lit que `public/assets/`. Les scripts de contenu vivent dans `tools/`. La documentation active vit dans les six dossiers numérotés.

Pour trouver un dossier par intention, utilisez aussi [Où agir](../5-guides/ou-agir.md).
