---
title: Curseur explicite d'événements multi-pas-fixe, jamais inféré
tags: [adr, entites]
status: accepte
updated: 2026-09-05
---

# ADR 0010 — Curseur explicite d'événements multi-pas-fixe, jamais inféré

## Statut

Accepté.

## Contexte

`SuitManager`/`DirectorManager` traduisent les sorties de `Suit.update()`/
`Director.update()` en files d'événements (`alertEvents`, `hurtEvents`,
`deathEvents`...) accumulées **par frame d'affichage** — même contrat que
`WeaponSystem.fireEvents`/`hitEvents` (`game/player/weapons.ts`) : lecture
non destructive, plusieurs lecteurs, vidées une seule fois par frame via
`clearFrameEvents()`.

`weapons.hitEvents` lui-même suit cette même règle et s'accumule sur
**plusieurs pas fixes** d'une même frame d'affichage avant d'être vidé.
Chaque manager (`SuitManager`, `DirectorManager`) doit donc lire
`hitEvents` sans jamais retraiter un impact déjà vu — sans quoi un
rattrapage à 2 pas fixes sur une même frame (30 Hz d'affichage) traiterait
deux fois les impacts du premier pas.

Une première version inférait le début d'une nouvelle frame en comparant
`hitEvents.length` à `hitCursor` (« si la longueur n'a pas grandi depuis le
dernier appel, une nouvelle frame a dû commencer »). Ce raisonnement semble
correct mais est faux : si deux frames de tir consécutives produisent un
compte d'impacts égal ou croissant sans qu'une frame vide ne s'intercale
entre les deux, la comparaison ne détecte rien et des impacts sont perdus
silencieusement. Repro trouvé via `qa-evidence` (Phase 3) : 8 pellets frame
A → `cursor` à 8 → `clearFrameEvents()` → 8 pellets frame B → aucun des 8
n'est retraité, car `8 < 8` est faux.

## Décision

`hitCursor` n'est **jamais** inféré. Chaque manager lit exclusivement
`hitEvents[cursor, length)` à chaque appel et avance `cursor` à `length`
(`consumeNewHits`). Le curseur ne retombe à 0 qu'à un seul endroit :
`clearFrameEvents()`, appelé une fois par frame d'affichage, après tous les
pas fixes de cette frame et avant le premier pas fixe de la suivante — la
seule frontière sans ambiguïté de « nouvelle frame ».

`SuitManager` et `DirectorManager` lisent le **même** tableau `hitEvents`
(partagé avec `weapons.ts`), chacun avec son propre `hitCursor` et sa propre
map `colliderTo*` — deux lecteurs indépendants du même flux, comme les
lecteurs multiples de `fireEvents`/`hitEvents` déjà en place dans `main.ts`
(rendu, fx, audio, store).

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Inférer la nouvelle frame par comparaison de longueur | c'est le bug décrit ci-dessus — silencieux, non détecté par simple relecture du code |
| Vider `hitEvents` à chaque pas fixe plutôt qu'à chaque frame | casserait le contrat partagé avec `weapons.ts`/les autres lecteurs (rendu, fx, audio), qui dépendent tous de la même fenêtre « une frame d'affichage » |

## Conséquences

- Toute nouvelle file d'événements par-frame dans ce module doit suivre le
  même schéma (curseur explicite, remise à zéro uniquement dans
  `clearFrameEvents`) — ne pas réintroduire une heuristique de longueur pour
  « faire plus simple ».
- Deux managers lisant le même tableau source imposent de dupliquer un peu
  d'état (`hitCursor`, `colliderTo*`) plutôt que de le mutualiser — accepté
  comme coût raisonnable pour garder chaque manager indépendant.

## Comment on saurait qu'on a eu tort

Si un troisième lecteur de `hitEvents` doit un jour être ajouté et que la
duplication de `hitCursor`/`colliderTo*` par lecteur devient un vrai
fardeau de maintenance, envisager de centraliser la distribution des
impacts (par exemple un répartiteur unique qui pousse chaque `HitEvent` vers
le bon manager au moment du tir, plutôt que chaque manager qui rejoue tout
le tableau).
