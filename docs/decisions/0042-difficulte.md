---
title: Difficulté — trois niveaux posés sur la partie, records séparés
tags: [adr, gameplay, session]
status: accepte
updated: 2026-10-04
---

# ADR 0042 — Difficulté : trois niveaux posés sur la partie, records séparés

## Statut

Accepté.

## Contexte

Le jeu n'avait qu'un réglage, calé pour une première partie. La v1.2 ajoute
trois niveaux de difficulté, choisis au lancement. Ils devaient régler les
ennemis, la taille des groupes que le script de niveau réveille, et la
générosité des dons.

Deux règles existaient déjà et s'appliquent ici : un réglage de partie ne
modifie jamais une configuration globale (ADR 0040), et un tirage ne sort
jamais de son flux déterministe (invariant #12).

## Décision

La difficulté est **lue une fois à la construction de la partie**, puis portée
par la session. « Rejouer » garde la même ; on n'en change qu'en repassant par
le menu.

Elle agit par copie, jamais par mutation :

- les PV et les dégâts des ennemis sont multipliés sur une **copie** de la
  configuration de chaque espèce ;
- un groupe d'ennemis se pose dans Blender **à sa taille la plus dure** ; les
  niveaux plus bas n'en réveillent qu'une part, les premiers par ordre de nom ;
- la probabilité de don des spectateurs est multipliée. Le donateur mystère
  n'est pas touché : ses dons appartiennent à l'histoire.

Les records sont tenus **par niveau et par difficulté**. Seul un niveau
terminé en inscrit un.

Les règles sont dans `src/game/session/progression/difficulty.ts`.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Multiplier `suitConfig` en place | la partie suivante partirait d'une valeur déjà multipliée, et le harnais de réglage perdrait sa référence |
| Changer de difficulté en cours de partie | un record ne dirait plus dans quelles conditions il a été fait |
| Ajouter des ennemis en difficulté haute, en dupliquant des points d'apparition | deux capsules au même endroit s'éjectent l'une l'autre ; le niveau doit décider de chaque place |
| Une propriété `difficulte` sur chaque point d'apparition | un réglage de plus par objet dans Blender, pour le même résultat qu'un ordre de nom |
| Un seul record, toutes difficultés confondues | un score fait en « Client » effacerait celui d'un « Lanceur d'alerte » |

## Conséquences

Celui qui pose une rencontre la dessine pour la difficulté la plus haute et
nomme ses points dans l'ordre où ils doivent disparaître.

En difficulté haute, un Costard a plus de PV qu'un coup de pompe à bout
portant n'en retire : il n'éclate plus du premier coup. C'est un effet assumé
du multiplicateur, à juger en jouant.

Un enregistrement d'input (F9/F10) ne porte pas la difficulté. Rejoué dans une
autre, il diverge.

## Comment on saurait qu'on a eu tort

Si les trois niveaux ne se distinguent en jeu que par la durée des combats, il
faudra régler autre chose que des multiplicateurs : la vitesse, la précision
ou la composition des groupes. Si les joueurs veulent comparer leurs scores
entre difficultés, les records séparés devront céder la place à un score
pondéré.
