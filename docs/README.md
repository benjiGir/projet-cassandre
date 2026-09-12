---
title: Documentation PROJET_CASSANDRE
tags: [index]
status: stable
updated: 2026-09-05
---

# PROJET_CASSANDRE

Boomer shooter rétro en Three.js. Un youtubeur complotiste à 200 abonnés avait
raison sur toute la ligne.

Tout document du projet est atteignable depuis cette page en deux sauts
maximum. Un document non listé ici est un orphelin — `check_docs_links.py` les
signale.

## Conception

- [Plan du prototype](game/plan-prototype.md) — phases, critères, rollback
- [Univers et factions](game/univers.md)
- [Le niveau : hypermarché](game/niveau-hypermarche.md)
- [Niveau v2 — plan de masse coté](game/niveau-v2-plan-de-masse.md) — proposition du jalon N6, en attente de validation

## Systèmes

- [Boucle de jeu](systems/boucle-de-jeu.md) — pas fixe, interpolation, hitstop
- [Session de partie](systems/session.md) — GameEngine/GameSession, boot, reset
- [Physique et collisions](systems/physique.md)
- [Joueur — déplacement et vue](systems/joueur.md) — controller Rapier, head bob, FOV
- [Armes du joueur](systems/armes.md) — pied-de-biche, pompe, hitstop/shake, harnais A/B
- [Rendu rétro](systems/rendu.md) — 640×360, Lambert, sprites
- [Entités et IA](systems/entites.md)
- [Pathfinding](systems/pathfinding.md)
- [HUD et interface](systems/hud.md) — composition React, écrans, flux d'écran
- [HUD et audio](systems/hud-audio.md)
- [Outils de debug](systems/debug.md) — console `window.cassandre`, harnais A/B, preuve de déterminisme

## Décisions

- [Index des ADR](decisions/README.md)

## Pipeline

- [Niveau : Blender vers glTF](pipeline/niveau-blender.md)
- [Textures](pipeline/textures.md)
- [Assets et références](pipeline/assets.md)
- [Board de références — hypermarché](assets/board-hypermarche.md) — fiche de spec du niveau v2
- [Harmonisation des assets du niveau v2](pipeline/harmonisation-assets.md) — palette, textures, import des packs CC0

## Référence

- [Valeurs de déplacement](reference/valeurs-deplacement.md)
- [Valeurs des ennemis](reference/valeurs-ennemis.md)
- [Conventions de nommage](reference/conventions-nommage.md)
- [Contrôles et bindings](reference/controles.md)
- [Three.js + Rapier](reference/threejs-rapier.md) — guide de terrain vérifié

## Conventions de cette documentation

Liens relatifs standard uniquement — **pas de wikilinks**, ils ne survivent pas
à un import Notion. Un sujet par fichier, deux niveaux de dossier maximum.
Voir le skill `docs-structure`.
