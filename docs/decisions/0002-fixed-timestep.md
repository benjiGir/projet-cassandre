---
title: Boucle à pas fixe 1/60 avec interpolation
tags: [adr, core]
status: accepte
updated: 2026-09-05
---

# ADR 0002 — Pas fixe 1/60

## Statut

Accepté. Invariant du projet.

## Contexte

Un pas variable rend la simulation dépendante du framerate. Toutes les valeurs
de tuning du déplacement seraient alors valables sur une seule machine.

## Décision

Accumulateur, pas fixe à `1/60`, delta clampé à `0.25 s`, interpolation du
rendu par `alpha`.

**La rotation caméra n'est pas interpolée** : elle est lue au taux d'affichage.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Pas variable | feel dépendant de la machine, tuning non transférable |
| Pas fixe sans interpolation | saccades visibles hors 60 Hz exact |
| Interpoler aussi la caméra | jusqu'à 16 ms de latence perçue à la visée |

## Conséquences

- Toute logique de gameplay vit dans le pas fixe
- Les effets temps-réel (shake, flash) tournent sur `frameTime`, séparément
- Le hitstop scale `dt`, il ne saute jamais de step physique
- Rapier étant déterministe cross-platform, le hash d'un `createSnapshot()`
  donne un test de non-régression quasi gratuit

## Comment on saurait qu'on a eu tort

Si le hash du snapshot dérive entre deux runs identiques : une source de
non-déterminisme s'est glissée dans le pas fixe.
