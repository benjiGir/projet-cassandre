---
title: Collision ennemi-ennemi activée
tags: [adr, physique]
status: accepte
updated: 2026-09-05
---

# ADR 0008 — Collision ennemi-ennemi activée

## Statut

Accepté.

## Contexte

Signalé après une partie réelle (2026-08-23) : « il y a 2 billboard qui sont
à moitié transparent et qui shake » près du joueur mort.

Cause trouvée en relisant `COLLISION_GROUPS.ENEMY`
(`src/physics/world.ts`) : le groupe `ENEMY` ne s'incluait pas lui-même dans
son propre filtre. Les ennemis ne se bloquaient donc jamais entre eux — les
trois rayons d'évitement local de `computeAvoidedDirection` (`suit.ts`/
`director.ts`) ne testent que `WORLD`, jamais les autres ennemis. Plusieurs
Costards/le Directeur convergeant sur le même point (typiquement le joueur
mort) pouvaient donc interpénétrer entièrement leurs capsules. Leurs
billboards, toujours face caméra, se retrouvaient alors à une profondeur
quasi identique vue de la caméra → z-fighting franc (le « shake » et la
transparence à moitié rapportés).

## Décision

`ENEMY` s'inclut désormais dans son propre filtre
(`COLLISION_GROUPS.ENEMY`). Le `KinematicCharacterController` partagé par
`SuitManager`/`DirectorManager` gère déjà la réponse de collision pour
n'importe quel handle autre que soi-même (`(other) => other.handle !==
collider.handle`) — élargir ce masque a suffi, aucun autre code à toucher.

Vérifié directement (deux Directeurs de test spawnés à 5 cm l'un de
l'autre, ciblant le même point fixe, `directorManager.update()` +
`physics.step()` appelés manuellement en boucle) : sans le fix, la distance
entre les deux reste exactement 0 sur 300 pas ; avec, une vraie réponse de
collision s'engage (pic à 0.25 m) puis oscille proche de 0 en régime établi.
Ce test vise volontairement un pire cas artificiel (deux ennemis sans
conscience l'un de l'autre convergeant sur un point fixe) — un joueur réel
est une cible mobile, approchée sous des angles différents.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Correctif cosmétique (offset aléatoire des billboards proches) | traite le symptôme visuel, laisse les capsules s'interpénétrer — pas de vraie séparation physique |
| Ne rien faire / reporter | le bug est visible en jeu dès que 2+ ennemis convergent, pas un cas limite rare |

## Conséquences

- Les ennemis groupés se bousculent désormais entre eux au lieu de se
  traverser silencieusement — changement de feel pour toutes les zones où
  plusieurs Costards peuvent se masser (B/C/D), pas seulement la Zone E où
  le bug a été repéré.
- Aucun changement côté joueur : `COLLISION_GROUPS.PLAYER` n'est pas
  modifié par cette décision.

## Comment on saurait qu'on a eu tort

Si la collision ennemi-ennemi produit un comportement exploitable (des
ennemis qui se poussent hors d'une zone de jeu prévue) ou un coût de
narrow-phase mesurable avec beaucoup d'ennemis groupés, reconsidérer —
possiblement en gardant la collision mais en l'excluant des cas à très
courte portée seulement.
