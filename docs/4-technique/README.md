---
title: Technique
tags: [sommaire]
status: brouillon
updated: 2026-09-26
---

# Technique

Un système par page, décrit de l'intérieur : fichiers, contrats de données, pièges, comment vérifier.

À qui ça s'adresse : qui travaille sur le code, la partie la plus consultée au quotidien.

- [Physique](physique.md) — monde Rapier, groupes de collision, character controller
- [Joueur](joueur.md) — déplacement, vue, ramassages
- [Armes](armes.md) — pied-de-biche, pompe, pistolet : implémentation
- [Ennemis et IA](ennemis-et-ia.md) — machine à états partagée Costard/Directeur
- [Pathfinding](pathfinding.md) — graphe de navigation 2.5D, évitement local
- [Session et score](session-et-score.md) — comptage au pas fixe, barème, récap
- [Rejeu et déterminisme](rejeu-et-determinisme.md) — RNG déterministe, rejeu d'input F9/F10
- [Chargement de niveau](chargement-de-niveau.md) — loader, conventions glTF, fusion du décor, hot reload
- [Systèmes de niveau](systemes-de-niveau.md) — portes, props, vitres, sanitaires, interactifs
- [Rendu](rendu.md) — résolution interne, matériaux, pipeline de rendu
- [Sprites et viewmodel](sprites-et-viewmodel.md) — sprites 8 directions, armes en vue subjective
- [Éclairage](eclairage.md) — éclairage hybride, bake vertex colors, pool de lampes
- [Budget de rendu](budget-de-rendu.md) — lots de dessin, fusion par cellule, ce qui coûte
- [Interface React](interface-react.md) — store, machine de flux, structure `src/ui/`
- [Audio runtime](audio-runtime.md) — sprite Howler, `SFX_TABLE`, ambiances positionnelles
- [Outillage Blender](outillage-blender.md) — scripts headless, session live, validation, export
- [Studio audio](studio-audio.md) — synthèse procédurale, recettes, mesures, sprite
- [Générateurs](generateurs.md) — générateurs de textures et de sprites
- [Tests et qualité](tests-et-qualite.md) — Vitest, typecheck, build, contrôles des docs et validations de contenu
- [Debug](debug.md) — console `cassandre`, panneau de debug, touches, harnais A/B
