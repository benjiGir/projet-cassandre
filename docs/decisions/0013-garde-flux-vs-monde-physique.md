---
title: Deux gardes distinctes — état de flux vs existence du monde physique
tags: [adr, core, loop]
status: accepte
updated: 2026-09-05
---

# ADR 0013 — Deux gardes distinctes — état de flux vs existence du monde physique

## Statut

Accepté.

## Contexte

Plusieurs callbacks du pas fixe/de la frame d'affichage (`game/loop/*.ts`)
doivent parfois s'abstenir d'agir, mais pas pour la même raison :

- `updateGameplay`/`updateFx` ignorent le CONTENU du gameplay (déplacement,
  tir, dégâts, interactions, FX) dès que
  `engine.flowActor.getSnapshot().value !== "playing"` — y compris pendant
  les états `dead`/`levelComplete`. Le monde Rapier reste alors parfaitement
  vivant : seul le contenu du pas est ignoré, la boucle continue de tourner
  (invariant #1, voir [Fin de partie pendant le pas
  fixe](../systems/boucle-de-jeu.md#fin-de-partie-pendant-le-pas-fixe)).
- `stepPhysics`, et le harnais d'enregistrement/rejeu F9/F10 dans `updateFx`,
  se gardent au contraire par `isPhysicsSessionLive(engine)` — un test sur
  l'EXISTENCE du monde Rapier lui-même. Nécessaire parce que
  `returnToMenu()` (jalon M8) appelle `.free()` sur la session physique
  avant d'en recréer une : pendant cette fenêtre transitoire, un appel à
  `world.step()` ou à `session.player.spawn(...)` (qui touche
  `body.setTranslation`) planterait sur un handle WASM déjà libéré.

Ces deux conditions ne sont PAS interchangeables : `flowActor !== "playing"`
est vrai pendant `dead`/`levelComplete`, alors que le monde physique y est
encore parfaitement valide (il n'est libéré qu'au moment de la transition
vers `returnToMenu()`, pas pendant `dead`/`levelComplete` eux-mêmes).

## Décision

Garder deux gardes distinctes, une par préoccupation, plutôt qu'une garde
unique appliquée partout.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Une seule garde `flowActor` partout | ne protège pas la fenêtre `returnToMenu()` : le risque réel est l'existence du monde Rapier, pas l'état de flux |
| Une seule garde `isPhysicsSessionLive` partout | figerait `updateGameplay`/`updateFx` sur le mauvais critère — `dead`/`levelComplete` doivent laisser le monde visuellement vivant (invariant #1), fusionner romprait cette continuité |

## Conséquences

Deux fonctions à connaître et à ne pas confondre. Un futur callback ajouté
au pas fixe ou à la frame d'affichage doit se demander explicitement
laquelle des deux préoccupations s'applique (gameplay à ignorer, ou monde
physique potentiellement absent) — parfois les deux.

## Comment on saurait qu'on a eu tort

Un crash sur accès à un monde Rapier déjà libéré pendant une transition de
reset (`returnToMenu`) signalerait qu'un appel physique manque sa garde
`isPhysicsSessionLive`. À l'inverse, un pas fixe qui se fige totalement (au
lieu de rester visuellement vivant) sur l'écran de mort/fin de niveau
signalerait qu'un appel gameplay a été gardé par erreur avec
`isPhysicsSessionLive` plutôt que `flowActor`.
