---
title: Abandon du plafond de lots de dessin
tags: [adr, rendu, niveau]
status: accepte
updated: 2026-10-03
---

# ADR 0039 — Abandon du plafond de lots de dessin

## Statut

Accepté. Remplace la ligne « Lots de dessin : 200 » du budget de
l'[ADR 0026](0026-visibilite-par-espace-et-pool-de-lampes.md). Le reste de cet
ADR (triangles, lampes, visibilité par espace) est inchangé.

## Contexte

Le plafond de 200 lots de dessin par image a été posé a priori au jalon N1 du
niveau v2, pour un « portable à GPU intégré » sur lequel rien n'a jamais été
mesuré. L'ADR 0026 a mesuré les triangles et les lampes, et a reconduit ce
plafond sans le mesurer. Le budget de triangles posé le même jour s'est révélé
trop prudent d'un facteur sept.

Le niveau livré dépasse ce plafond depuis longtemps : 206 lots au départ, 255
dans la galerie. Sur la machine de développement, le rendu de ces vues prend
entre 2 et 3 ms pour un budget d'image de 16,6 ms, à 120 images par seconde.
Le plafond bloquait pourtant un contrôle de gate et pesait sur chaque décision
de décor.

## Décision

Il n'y a plus de plafond de lots de dessin. `pnpm probe` continue de mesurer
les lots et les triangles par vue, comme indicateur ; il ne fait plus échouer
aucun contrôle. La constante du plan de masse et l'option `--strict` de la
sonde sont retirées.

Les leviers de fusion restent en place : ils existent, ils ne coûtent rien à
garder, et un lot reste un coût réel.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Garder 200 | chiffre sans mesure, déjà dépassé sans effet visible |
| Relever le plafond à 400 | un second chiffre arbitraire |
| Le remplacer par un seuil de temps de rendu | à reprendre si un problème se mesure ; inutile tant qu'il n'y en a pas |

## Conséquences

Poser un `prop_*`, un écran ou un meuble de plus n'a plus à se justifier contre
un compte de lots. Les ADR 0030, 0031 et 0032 citent ce plafond comme une
contrainte de leur époque : leurs choix de fusion restent valables, leur
urgence non.

Personne ne surveille plus ce coût par défaut. Le panneau de debug et
`pnpm probe` l'affichent toujours.

## Comment on saurait qu'on a eu tort

Si le jeu saccade sur une machine réelle et que le temps de rendu, et non la
simulation ou les lampes, en est la cause mesurée. Dans ce cas, fixer un seuil
en millisecondes sur cette machine, pas un compte de lots.
