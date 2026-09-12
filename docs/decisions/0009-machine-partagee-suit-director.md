---
title: Machine XState partagée entre Costard et Directeur
tags: [adr, entites, xstate]
status: accepte
updated: 2026-09-05
---

# ADR 0009 — Machine XState partagée entre Costard et Directeur

## Statut

Accepté. Jalon M5 de `PLAN_EFFECT_XSTATE.md` (§7).

## Contexte

Avant ce jalon, `suit.ts` et `director.ts` portaient chacun leur propre copie
**texto-identique** de la logique de décision : `runIdle`/`runAlert`/
`runChase`/`runAttack`/`resolveAttack`/`computeAvoidedDirection`/
`applyAimJitter`/`updateKnockback`/`integratePhysics`, la table de transition
d'états, et les timers associés. Le Directeur (2ᵉ type d'ennemi du jeu,
`PLAN_PROTO_BOOMER_SHOOTER.md`, boss unique de la Zone E) a été créé en
dupliquant `Suit` plutôt qu'en le réutilisant — cohérent avec l'invariant #8
(pas d'ECS/abstraction avant 12 types d'ennemis) au moment où il n'y avait
qu'un seul type, mais la duplication texto-identique de la logique de
*décision* (pas seulement de la config) devenait un coût de maintenance réel
dès le deuxième type : tout correctif ou tuning du combat devait être
répliqué à la main dans les deux fichiers, avec le risque qu'ils divergent en
silence.

## Décision

Une seule machine XState (`enemyMachine.ts`) porte désormais toute la logique
indépendante du gabarit visuel/Rapier exact de l'entité : table de
transition, durées, perception (ligne de vue), évitement local, suivi de
chemin, jitter de visée, knockback, intégration physique.

`Suit`/`Director` deviennent de fins wrappers qui possèdent seulement ce qui
n'a **pas** de sens à partager :

- le corps/collider Rapier (construits via des fabriques partagées —
  `createEnemyBody`, `configureEnemyCharacterController` — mais l'instance
  elle-même est propre à chaque entité) ;
- la config (`SuitConfig`/`DirectorConfig` — objets **distincts**,
  volontairement, voir `docs/reference/valeurs-ennemis.md`) ;
- le PRNG dérivé de la graine de l'instance (`createEnemyPrng`, une par
  entité, jamais partagé) ;
- l'acteur XState lui-même (un par entité, jamais partagé) ;
- pour `Director` seulement, `revealed`/`justRevealed` et le badge
  (`DroppedCard`, `DirectorBadge` jusqu'au jalon N7) — restés **hors** de la machine partagée sur demande
  explicite de la tâche : un champ de contexte annexe porté par la classe
  `Director`, pas une région d'état parallèle de `enemyMachine`.

Discipline conservée à l'identique de l'avant-jalon : `suit.ts`/`director.ts`
n'importent rien de `render/`, `core/audio.ts` ni `game/state.ts` (pureté du
cœur de simulation) ; tout tourne au pas fixe avec le `dt` de gameplay reçu
en paramètre, jamais d'horloge murale ; le `KinematicCharacterController` est
une seule instance partagée par tous les Costards (respectivement tous les
Directeurs), possédée par `SuitManager`/`DirectorManager`.

Voir [Entités et IA](../systems/entites.md) pour le détail de fonctionnement
de la machine partagée (frontière exacte, pièges internes).

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Garder deux copies dupliquées, accepter la dérive | déjà la source du problème — chaque correctif de combat doit être répliqué à la main, silencieusement divergent au fil du temps |
| `Director extends Suit` (héritage) | romprait dès que l'un des deux types bouge pour une raison propre à lui seul — même risque déjà documenté pour `SuitConfig` vis-à-vis de `MoveConfig` |
| Introduire un ECS générique pour partager le comportement | interdit par l'invariant #8 avant 12 types d'ennemis — un ECS pour 2 types serait une abstraction prématurée |

## Conséquences

- Un seul endroit à corriger/tuner pour tout comportement de combat partagé.
- `Suit`/`Director` restent deux classes distinctes avec des configs
  distinctes : aucune confusion possible entre les deux jeux de valeurs.
- Deux champs de `EnemyMachineContext` (`attackCooldownRemaining`,
  `timeSinceLastSeen`) ne suivent pas la convention `stateTimer` du reste de
  la machine — documenté dans `docs/systems/entites.md`, pas une
  incohérence involontaire.
- Le filet de test de caractérisation (`suit.test.ts`/`director.test.ts`,
  écrit contre le code pré-refactor) continue d'assigner directement
  `suit.state = "chase"` / `suit.stateTimer = 1.23` : `forceEnemyState`
  (`enemyMachine.ts`) reproduit cette commodité via une API interne non
  documentée de `xstate` (`Actor["_snapshot"]`), jamais utilisée par le
  chemin de production. Risque assumé : si `xstate` renomme ce champ dans une
  future version, seule cette fonction doit être revue.

## Comment on saurait qu'on a eu tort

Si un 3ᵉ type d'ennemi doit un jour dévier fortement de la table de
transition partagée (pas seulement de sa config), reconsidérer : soit la
machine partagée gagne un paramètre de plus, soit c'est le signal qu'il faut
un second graphe XState plutôt que de complexifier celui-ci pour accommoder
un comportement structurellement différent.
