---
title: Explosifs — une matière de prop, un souffle dans le pas fixe
tags: [adr, gameplay, physique, niveau]
status: accepte
updated: 2026-10-04
---

# ADR 0041 — Explosifs : une matière de prop, un souffle dans le pas fixe

## Statut

Accepté. Étend l'[ADR 0030](0030-props-dynamiques.md).

## Contexte

Le combat se résumait à un seul type de rencontre. Le niveau avait déjà des
props physiques, poussables et cassables, avec une matière qui décide du son
et des débris. Un objet qui explose devait s'y poser sans nouveau système à
apprendre pour celui qui construit le niveau.

Le souffle blesse le joueur et tue des ennemis : c'est de la simulation, donc
du pas fixe (invariants #1 et #11), et son résultat doit être le même à
chaque rejeu (#12).

## Décision

Un explosif est un `prop_*` de matière `gaz`. Sa casse est une explosion.

Le souffle se résout en deux temps, dans le pas fixe :

- `PropSystem` pousse les props voisins et **amorce** les autres bonbonnes
  qu'il atteint ;
- la session applique les dégâts au joueur et aux ennemis
  (`src/game/session/player/explosions.ts`).

Une bonbonne amorcée explose après un délai compté en **pas fixes**, pas en
secondes : la réaction en chaîne est la même à chaque rejeu.

Les dégâts décroissent avec la distance, et un mur arrête le souffle : seul ce
qui a une ligne dégagée vers le centre est touché. Le joueur ne prend qu'une
part des dégâts. Un ennemi assez proche du centre éclate, comme sous un coup
de pompe à bout portant.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Un préfixe `explosif_*` et son propre système | un second mobilier physique à maintenir, alors que seule la casse diffère |
| Réaction en chaîne immédiate | cinq bonbonnes sautent dans le même pas : on ne lit rien, et le joueur ne comprend pas ce qui l'a tué |
| Délai de chaîne en secondes de temps réel | le résultat dépendrait du taux d'affichage |
| Souffle qui traverse les murs | une bonbonne derrière une cloison tuerait sans avoir été vue |
| Projectiles et éclats simulés | hors de proportion pour un prototype ; un rayon et une ligne de vue suffisent |

## Conséquences

Les explosifs se posent là où un combat a lieu, sur le chemin obligé : le
joueur doit les rencontrer (`tools/blender/refresh_gas_props.py`).

Le bouclier du Vigile n'arrête pas un souffle. C'est voulu : l'explosif est
l'autre réponse à cet ennemi, avec le contournement.

Une explosion compte comme une casse pour le direct, et ses kills comme des
kills ordinaires.

Le rayon, les dégâts et le délai de chaîne sont dans `explosionConfig`
(`src/game/level/props/propConfig.ts`).

## Comment on saurait qu'on a eu tort

Si une chaîne de bonbonnes tue régulièrement le joueur sans qu'il ait vu la
première sauter, le délai ou le placement sont à revoir avant le principe. Si
d'autres objets doivent exploser autrement (une grenade lancée, un baril qui
roule), la matière ne suffira plus et il faudra un vrai système de souffle.
