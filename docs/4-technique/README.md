---
title: Technique
tags: [sommaire]
status: brouillon
updated: 2026-10-06
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
- [Campagne](campagne.md) — équipement d’arrivée, menu Continuer, reprise et bornes de consommables.
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
- [Outillage pour plusieurs niveaux](outillage-multi-niveaux.md) — profils magasin/métro, sorties protégées, manifestes et reconstruction.
- [Studio audio](studio-audio.md) — synthèse procédurale, recettes, mesures, sprite
- [Générateurs](generateurs.md) — générateurs de textures et de sprites
- [Tests et qualité](tests-et-qualite.md) — Vitest, typecheck, build, contrôles des docs et validations de contenu
- [Debug](debug.md) — console `cassandre`, panneau de debug, touches, harnais A/B
- [Prototype des trains](prototype-trains.md) — salle d’essai T1 du métro, horaires, aiguillage, arrêt et contacts mortels ; principe accepté, réglages fins à confirmer.
- [Prototype du voyage à bord](prototype-voyage-rame.md) — salle d’essai T4, rame fixe, tunnel défilant, portes et embuscade.

- [Pièce pilote du métro](pilote-metro.md) — assemblage N4, matériaux et ambiances par niveau.
- [Place pilote du quartier](pilote-quartier.md) — N4b, accès de service, retour par la grille publique et ambiances discrètes.
- [Trains dans le pipeline](trains-metro.md) — modèle Blender, commandes, volumes balayés et zones de sécurité.

- [Métro complet — blockout N5](blockout-metro.md) — parcours, objectifs, trains et voyage jusqu’au hall.
- [Rencontres du métro](rencontres-metro.md) — première implantation N7, déclencheurs, vagues à bord et ressources.
