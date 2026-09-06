---
title: React en overlay DOM, jamais dans la boucle
tags: [adr, ui]
status: accepte
updated: 2026-09-05
---

# ADR 0003 — React hors de la boucle

## Statut

Accepté. Invariant du projet.

## Contexte

Le HUD doit être rapide à écrire, et React est la stack familière. Mais un
`setState` par frame consomme le budget de performance avant que le jeu
existe.

## Décision

Le game loop écrit dans un store zustand. Le HUD s'abonne avec des sélecteurs
fins, throttlés à **10 Hz maximum**. Aucun import React sous `src/core/` ou
`src/physics/`.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| React Three Fiber | voir [ADR 0001](0001-moteur-threejs.md) |
| HUD en canvas 2D | perd le confort React pour un gain nul à cette échelle |
| État de jeu dans React | perte du déterminisme, HMR qui casse la session |

## Conséquences

- Écriture conditionnelle : ne publier que si la valeur change réellement
- Le canvas n'est jamais monté par React (remount = perte du contexte WebGL)
- Le panneau de debug est l'exception tolérée, à 30 Hz, absent du build de prod

## Comment on saurait qu'on a eu tort

Si un profiling React sur 30 s de jeu montre un composant HUD au-delà de
10 re-renders par seconde.
