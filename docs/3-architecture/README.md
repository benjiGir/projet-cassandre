---
title: Architecture
tags: [sommaire]
status: brouillon
updated: 2026-10-08
---

# Architecture

Comment le tout est découpé, et pourquoi.

À qui ça s'adresse : quiconque modifie le code, avant d'écrire la modification.

- [Vue d'ensemble](vue-d-ensemble.md) — les quatre blocs (moteur TS, overlay React, outillage Blender/Python, studio audio) et les assets qui les relient
- [Invariants](invariants.md) — les 11 invariants actifs (trois retirés), chacun avec sa raison, ce qui casse si on le viole, et son ADR
- [Carte des modules](carte-des-modules.md) — `src/core`, `physics`, `render`, `game`, `ui`, `app` : qui a le droit d'importer qui, graphe de dépendances
- [Boucle et temps](boucle-et-temps.md) — pas fixe, interpolation, hitstop, frontière synchrone Effect
- [Simulation et présentation](simulation-et-presentation.md) — ce qui se décide au pas fixe, ce qui se dessine au taux d'affichage, comment l'information passe de l'un à l'autre
- [Cycle de vie](cycle-de-vie.md) — boot, `PersistentEngine`/`GameSession`, reset, chargement asynchrone
- [Effect et XState](effect-et-xstate.md) — où et pourquoi, les deux modes d'exécution, les machines existantes
- [Flux de données](flux-de-donnees.md) — input → gameplay → état → store zustand → HUD
- [Pipelines de contenu](pipelines-de-contenu.md) — Blender → glTF → loader ; recettes → audio sprite ; générateurs de textures et de sprites
