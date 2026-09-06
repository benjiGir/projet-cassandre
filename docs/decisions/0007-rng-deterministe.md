---
title: RNG déterministe unique — DeterministicRandom
tags: [adr, core]
status: accepte
updated: 2026-09-05
---

# ADR 0007 — RNG déterministe unique

## Statut

Accepté. Invariant du projet (`CLAUDE.md` #12).

## Contexte

Le rejeu d'input déterministe (F9/F10, `core/inputRecorder.ts`) dépend
d'une source aléatoire strictement reproductible à graine égale.
`Math.random()` et le service `Random` par défaut d'Effect ne le sont pas.

Avant le nettoyage du 2026-09-05 (jalon M9, `PLAN_EFFECT_XSTATE.md` §11),
l'algorithme mulberry32 existait en trois copies indépendantes :
`src/core/random.ts`, `game/player/weapons.ts` (dispersion du pompe) et
`game/entities/enemyMachine.ts::createEnemyPrng`. Une copie dupliquée peut
diverger silencieusement d'un refactor à l'autre — le risque n'était pas
théorique : le jalon M6 avait déjà promis l'unification sans la livrer.

## Décision

Un seul générateur canonique, mulberry32, vit dans `src/core/random.ts`. Il
est exposé par le service Effect `DeterministicRandom`
(`forSeed(seed): () => number`), fourni via `DeterministicRandom.layer`
dans `GameLayer`. Tout code qui a besoin d'aléatoire déterministe obtient
son générateur via ce service — jamais une copie locale de l'algorithme.

`forSeed` est une FABRIQUE, pas un flux partagé : chaque appel retourne un
générateur indépendant. `weapons.ts` seed une instance unique pour la
dispersion du pompe ; `suitManager.ts`/`directorManager.ts` seedent une
instance PAR ENTITÉ à partir d'un compteur de spawn. Si `forSeed` renvoyait
un flux global partagé, la sortie de chaque appelant dépendrait de l'ordre
d'appel des autres, cassant le rejeu déterministe.

Le générateur retourné reste une fonction synchrone brute (pas un
`Effect`) : il est appelé plusieurs fois par pas fixe (jitter de visée par
ennemi, dispersion de tir), et l'envelopper dans un `Effect` à chaque appel
ajouterait un coût par appel pour aucun bénéfice. Passer par le service
Effect sert uniquement à obtenir le générateur (une fois), pas à
l'invoquer.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Copie locale de mulberry32 par module consommateur | c'était l'état de fait avant cette ADR — divergence constatée entre M6 (promis) et M9 (encore dupliqué) |
| `Math.random()` | non reproductible, casse le rejeu d'input |
| Service `Random` par défaut d'Effect | non-déterministe par conception, mêmes raisons |
| Un flux mulberry32 global partagé entre tous les appelants | l'ordre d'appel des différents systèmes deviendrait significatif, cassant le rejeu dès qu'un système change son nombre d'appels par pas fixe |

## Conséquences

- `mulberry32` n'existe plus qu'à un seul endroit du repo.
- Tout nouveau système ayant besoin d'aléatoire passe par
  `runGameplaySync(DeterministicRandom.useSync(...))` (voir skill
  `effect-xstate-cassandre`), jamais par une implémentation locale.
- Le service reste injectable en test (un double scripté peut remplacer
  mulberry32 sans toucher les appelants).

## Comment on saurait qu'on a eu tort

Si un test à valeurs de référence qui recalcule l'algorithme
indépendamment (`random.test.ts`, `suit.test.ts`, `director.test.ts`)
diverge après un refactor, ou si une seconde copie de mulberry32 réapparaît
ailleurs dans le repo.
