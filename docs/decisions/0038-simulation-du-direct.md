---
title: Simulation du direct — audience, dons et chat dans le pas fixe
tags: [adr, gameplay, hud, histoire]
status: accepte
updated: 2026-10-03
---

# ADR 0038 — Simulation du direct : audience, dons et chat dans le pas fixe

## Statut

Accepté. Étend l'[ADR 0033](0033-rng-presentation-et-portee-du-rejeu.md), dont
il reprend le flux RNG dédié aux « vues ».

## Contexte

Le HUD affichait un compteur de spectateurs qui montait à chaque kill, sans
autre effet. La v1.1 en fait un fil de l'histoire : un chat qui réagit, des
abonnés, des dons, et un donateur mystère. La v1.2 dépensera ces dons à des
bornes, ce qui en fera une ressource de jeu.

Trois contraintes : un don qui s'achète plus tard est un état de partie, donc
décidé dans le pas fixe ; les textes ne peuvent pas être générés en jeu
(invariant #12, et le plugin TypeSafe est écarté) ; le HUD ne lit que le
store, à 10 Hz au plus (invariant #2).

## Décision

Le direct est une **simulation de session**, dans `src/game/session/stream/`.

- `streamSim.ts` est pur : un état, des règles nommées (`streamConfig`) et un
  générateur injecté. Il ne connaît ni le store ni la session.
- `streamFeed.ts` fait le lien : il reçoit les évènements notables du jeu
  (`streamEvent`), avance la simulation une fois par pas fixe
  (`updateStreamFeed`) et publie dans le store.
- `streamTexts.ts` porte tous les textes, écrits à l'avance.

Un seul flux RNG, `session.streamRandom`, sert l'audience, les dons et le
chat. Il n'est partagé avec rien d'autre : ni armes, ni ennemis, ni effets.

Le chat et les dons sont des états de simulation, pas de présentation : le
portefeuille en dépend, et le même enchaînement d'actions doit rendre le même
direct. Seules les durées d'affichage d'une alerte passent par un minuteur,
comme les messages du HUD.

Le donateur mystère ne dépend d'aucun tirage : ses dons sont liés à des étapes
de progression, vérifiées à chaque pas.

L'audience remplace le gain par kill : un évènement notable la fait monter
selon son poids, et l'ennui la fait redescendre vers une part de son pic. Les
abonnés découlent des spectateurs gagnés.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Faire vivre le chat côté React, sur une horloge d'affichage | le portefeuille dépendrait du taux d'affichage, et un état de jeu vivrait dans React |
| Générer les messages avec un modèle | appel réseau asynchrone et non déterministe ; écarté pour tout le jeu |
| Tirer les messages dans le flux des répliques du héros | un message de chat de plus décalerait les répliques occasionnelles |
| Publier le chat à chaque image | le store serait écrit 60 fois par seconde pour un texte qui change toutes les deux à quatre secondes |
| Lier le score de fin de partie à l'audience | les records existants changeraient de sens ; les deux restent séparés |

## Conséquences

Chaque système qui veut faire réagir le direct appelle `streamEvent` avec une
sorte d'évènement ; les règles se règlent dans `streamConfig`, sans toucher
aux appelants.

Le chat porte du texte que le joueur peut ne pas lire : il ne donne jamais une
information nécessaire, et une option le masque. Les dons, eux, restent
affichés : ils alimenteront la cagnotte.

Ajouter un tirage au flux du direct change la suite des dons d'une partie
donnée : c'est attendu, et sans effet sur le rejeu d'input, qui ne restaure pas
les flux RNG.

## Comment on saurait qu'on a eu tort

Si la boutique de la v1.2 demande de prévoir ou de rejouer exactement une
série de dons, le flux unique devra être scindé entre l'argent et le texte. Si
le chat fatigue en playtest, c'est d'abord son rythme et la part des messages
d'ennui qu'il faudra régler, avant de remettre en cause sa place dans la
simulation.
