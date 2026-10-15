---
title: Projectile du joueur — une fusée balayée au pas fixe, un souffle partagé
tags: [adr, gameplay, armes, physique]
status: accepte
updated: 2026-10-11
---

# ADR 0046 — Projectile du joueur : une fusée balayée au pas fixe, un souffle partagé

## Statut

Accepté. Étend l'[ADR 0041](0041-explosifs.md), dont il lève une limite
annoncée.

## Contexte

La quatrième arme est un pistolet de détresse : une fusée lente et visible, qui
éclate à l'impact et blesse autour d'elle. Les trois autres armes touchent le
pas où elles tirent — un rayon ou une forme, puis des `HitEvent` lus par les
ennemis et les objets cassables dans le même pas. Rien dans le jeu ne volait
encore entre le tir et l'impact.

L'ADR 0041 prévoyait le cas : « si d'autres objets doivent exploser autrement
(une grenade lancée…), la matière ne suffira plus et il faudra un vrai système
de souffle ». Le souffle existait, mais ne pouvait naître que d'un prop `gaz`.

Le vol d'une fusée décide de qui meurt : c'est de la simulation, donc du pas
fixe (invariants #1 et #11), et le rejeu d'input doit la reproduire (#12).

## Décision

**La fusée n'est pas un corps physique.** `FlareFlight`
(`src/game/player/weapons/flareFlight.ts`) tient une liste de positions et de
vitesses. À chaque pas fixe, chaque fusée lance un rayon sur le trajet qu'elle
va parcourir pendant ce pas, avec le filtre des tirs du joueur
(`COLLISION_GROUPS.PLAYER_SHOT`). Rien sur le trajet : elle avance. Un
obstacle : elle s'arrête au point touché et éclate. Elle éclate aussi en l'air
au bout de sa durée de vol.

**L'impact reprend le chemin des autres armes.** Ce que la fusée touche reçoit
un `HitEvent` d'arme `"flare"`, poussé dans la file de `WeaponSystem`. Les
ennemis, les props, les vitres, les sanitaires et les écrans le lisent sans
rien savoir du projectile : mêmes dégâts par table, même bouclier de Vigile,
même casse.

**Le souffle est celui des bonbonnes, détaché des props.** Une explosion a
maintenant une configuration (`BlastConfig` : rayon, dégâts, part du joueur,
impulsion) et un centre quelconque. `applyBlast` (vivants) et
`PropSystem.applyBlast` (mobilier, amorçage des bonbonnes) la prennent en
paramètre ; la bonbonne passe la sienne, la fusée la sienne, plus courte.

**Deux files pour une fusée éclatée**, comme pour une bonbonne : l'une lue par
l'affichage et vidée à chaque image, l'autre remise une seule fois au pas fixe
qui applique le souffle. Une image sans pas fixe ne perd pas un souffle.

**La fusée part des yeux, pas du canon.** Comme tout tir, son origine est la
position du joueur après son déplacement — jamais une pose de rendu. L'écart
avec le canon affiché est cosmétique : l'affichage fait partir la fusée du
bout du canon et la ramène sur sa vraie trajectoire en 0,14 s.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Un corps dynamique Rapier avec détection continue | Le résultat dépendrait du solveur et de l'ordre des contacts ; un rayon par pas donne le point, la normale et le collider, comme un tir |
| Tir instantané maquillé en fusée lente | La fusée vue ne serait pas celle qui touche : on raterait une cible qu'on voit atteinte, et l'arme n'aurait plus rien à anticiper |
| Vol simulé au taux d'affichage | Le rejeu dépendrait du nombre d'images par seconde (invariant #1) |
| Une forme balayée (boule) au lieu d'un rayon | Plus tolérante, mais les autres armes à distance visent déjà d'un rayon ; à reprendre si le playtest dit que la fusée « passe à côté » |
| Faire de la fusée un prop `gaz` lancé | Un prop se pousse, se casse et bloque le passage : trois comportements à désactiver pour n'en garder qu'un |
| Un souffle à part pour la fusée | Deux barèmes de dégâts de zone à tenir d'accord, et le bouclier du Vigile traité deux fois |

## Conséquences

Le rayon balaie le trajet du pas à venir : la fusée ne traverse pas un mur
mince, quelle que soit sa vitesse. Un obstacle qui *vient à elle* pendant le
pas (une porte qui se ferme, un train) n'est vu qu'au pas suivant ; à 34 m/s et
1/60 s, l'écart tient dans 57 cm.

Une fusée lancée ne lit plus la configuration : sa vitesse est fixée au tir.
Changer `flareSpeed` à chaud ne dévie pas celles qui volent.

Le centre du souffle est décollé de 15 cm de la surface touchée, le long de sa
normale. Sans cela, sa ligne de vue vers les cibles partirait de l'intérieur du
mur et ne toucherait personne.

Le joueur prend la moitié du souffle. C'est le prix de l'arme en couloir, et il
vaut pour toute fusée, la sienne comprise.

Les valeurs sont dans `weaponConfig` (`flare*`, `flareBlast`) ; ce sont des
valeurs de départ. Référence : [Valeurs des armes](../6-reference/valeurs-armes.md).

## Comment on saurait qu'on a eu tort

Si une seconde arme à projectile arrive (grenade qui rebondit, tir ennemi
visible), `FlareFlight` devra devenir un système de projectiles à part
entière, avec ses rebonds et ses propriétaires ; il n'a été écrit que pour une
fusée qui éclate au premier contact. Si le playtest montre des fusées qui
frôlent leur cible sans la toucher, passer du rayon à une forme balayée avant
de toucher aux dégâts.
