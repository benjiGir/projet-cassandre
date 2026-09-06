---
title: Rampe linéaire plutôt qu'approche exponentielle pour le lissage de vue
tags: [adr, joueur, feel]
status: accepte
updated: 2026-09-05
---

# ADR 0015 — Rampe linéaire plutôt qu'approche exponentielle pour le lissage de vue

## Statut

Accepté.

## Contexte

Plusieurs grandeurs de vue (`bobIntensity`, `runFactor`, `landingDip` dans
`controller.ts` ; le recul du viewmodel dans `weapons.ts`) doivent
atteindre une cible progressivement plutôt que par un saut net — sinon le
head bob s'éteint sec au décollage, ou le kick de recul disparaît d'un
coup. Le choix naturel pour ce genre de lissage est une approche
exponentielle (`current += (target - current) * rate * dt`).

Mesuré sur une version antérieure de ce code utilisant cette approche
exponentielle : après un arrêt net, l'enveloppe du bob mettait **1.78 s** à
atteindre zéro, et l'enfoncement de réception **2.18 s** — une exponentielle
n'atteint jamais exactement sa cible, elle s'en approche indéfiniment.
Conséquences concrètes :

- la caméra dérive d'un poil de flottant à chaque frame pendant tout ce
  temps, `updateProjectionMatrix` est rappelée indéfiniment ;
- deux captures déterministes ne rendent pas le même pixel, puisque le
  moment exact où la valeur devient « suffisamment proche de zéro » dépend
  du nombre de pas fixes écoulés, pas d'un seuil garanti.

## Décision

`approach(current, target, responseTime, dt, range)` (`controller.ts`,
exportée) avance `current` vers `target` à **vitesse constante** :
`range` unités parcourues en `responseTime` secondes, où `range` est
l'amplitude totale de la grandeur (1 pour une enveloppe 0..1,
`landingDipMax` pour un enfoncement). Une rampe linéaire atteint sa cible
**exactement**, à un pas fixe connu d'avance.

Cette même fonction est réutilisée telle quelle par `weapons.ts` pour la
récupération de recul du viewmodel (même contrat : `dt` de gameplay, jamais
d'horloge murale) — décision explicite de ne pas dupliquer une seconde
implémentation qui pourrait diverger d'un refactor à l'autre.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Approche exponentielle (`lerp` par taux) | n'atteint jamais exactement zéro (mesuré : 1.78 s bob / 2.18 s réception) ; dérive de caméra en fin de convergence ; casse la reproductibilité pixel-exacte d'une capture déterministe |
| Une seconde fonction de rampe dédiée à `weapons.ts` | risque de divergence silencieuse entre les deux implémentations au fil des refactors, pour un contrat identique |

## Conséquences

- Le paramètre `responseTime` veut dire ce qu'il dit : `bobResponseTime = 0.12`
  éteint le bob en 0.12 s, pas « 63 % en 0.12 s puis une traîne d'une
  seconde » — c'est ce qu'un humain qui tune attend en lisant le nom.
- Perte assumée : le « coude » de fin de convergence d'une exponentielle
  disparaît. Invisible en pratique, ces grandeurs étant des enveloppes qui
  multiplient une sinusoïde déjà continue.
- Toute nouvelle grandeur de vue lissée dans le temps (pas dérivée d'une
  distance parcourue) doit passer par `approach()`, jamais par une
  décroissance exponentielle codée en dur.

## Comment on saurait qu'on a eu tort

Si un futur besoin de lissage exige explicitement une décroissance qui
ralentit en approchant de la cible (plutôt qu'une vitesse constante) — par
exemple une caméra qui doit sembler « amortie » plutôt que « mécanique ».
Aucun cas de ce type identifié à ce jour.
