---
title: Contrats des ennemis et de leurs machines
tags: [gameplay, ennemis, xstate, code]
status: brouillon
updated: 2026-10-15
---

# Contrats des ennemis et de leurs machines

## État et horloges

Costard et Directeur encapsulent la même machine XState. Leurs configurations
restent séparées pour permettre un tuning différent. Le contrat `Entity` reste
minimal ; il n’introduit pas d’ECS. L’identifiant vient d’un compteur monotone,
la graine RNG d’un compteur de spawn local au manager. Les graines de Costard
et de Directeur diffèrent ; un stride impair évite des séquences identiques.

`stateTimer` mesure seulement la durée de l’état. `attackCooldownRemaining` et
`timeSinceLastSeen` traversent les transitions et ne doivent pas être remis à
zéro comme lui. Le temps du jeu inclut le hitstop. Les durées ne passent pas par
`after` ni une minuterie murale. Le cooldown après attaque est indépendant de la
télégraphie, qui laisse au joueur une fenêtre visible d’au moins 0,2 s.
Les champs pending sont remis à zéro au début du tick puis lus par le manager.
Les horloges d’animation et la distance parcourue fournissent une vue sans décider
la simulation. Les cadavres gardent leur pose ; le corps vivant est retiré,
puis un volume bas et destructible prend le relais après la chute.

Les renforts d'embuscade attendent 0,7 s avant leur premier tick d'IA.
`SuitManager` avance ce délai au pas fixe, même lorsqu'un impact interrompt
le tick normal. Ils restent touchables pendant leur matérialisation TSL ;
une mort annule immédiatement l'effet. Les ennemis présents au chargement
n'ont pas ce délai. Voir [Matérialisation des embuscades](notes-code-rendu.md#matérialisation-des-embuscades).

## Déplacement et combat

Un KCC partagé par manager résout les capsules une par une. Les scratches sont
propres à l’entité et réutilisés ; un lecteur ne doit pas retenir leur valeur.
Le recul kinématique est une vélocité intégrée, pas une impulsion Rapier sans
effet. Le KCC applique les impulsions aux props dynamiques selon la masse.

La perception et l’évitement interrogent uniquement WORLD : props et autres
ennemis n’occultent pas la vue. L’ordre des trois rayons d’évitement est avant,
gauche, droite. Le pathfinding est demandé si le chemin est épuisé ou si la cible
a bougé de 1,5 m ; un waypoint est atteint à 0,6 m. L’échec revient à l’évitement
local. Le jitter utilise le PRNG de l’entité et une base stable près de la verticale.

La ligne de vue est revérifiée après télégraphie : se mettre à couvert permet
d’annuler le tir. Une attaque effective qui rate le joueur peut casser une vitre
ou un sanitaire rencontré par le rayon. Le port minimal de casse garde la machine
indépendante des classes concrètes ; la première cible qui reconnaît le collider
consomme l’impact. L’origine de tir est l’œil réel de l’ennemi, la cible celui du
joueur au pas fixe, jamais une caméra interpolée.

## Dégâts et événements

Les managers agrègent les impacts nouveaux par collider. Chaque manager a son
curseur et partage la même file d’impacts d’armes ; ce curseur se remet à zéro
uniquement lors de la vidange après présentation. Tous les plombs reçus pendant
un pas fixe produisent un seul événement de blessure ou mort par ennemi.
Un ennemi qui entre en stagger ne reçoit pas aussi un tick normal dans ce
même pas. Un Contrôleur dont la charge résiste à une balle reçoit ses dégâts
et son flash, puis poursuit son tick : les balles ne ralentissent pas son élan.

Le collider est retiré de la map avant que sa référence ne disparaisse. Les
événements possèdent leurs positions/directions. Les Costards gardent une mort
en gibs si au moins un impact de pompe est suffisamment proche. Les tableaux de
managers conservent vivants, morts et cadavres, pour le rendu et le récap.

La révélation du Directeur est latched : elle reste après le seuil, même s’il
meurt au même coup. `justRevealed` ne vaut vrai qu’une fois. L’atlas révélé ou sa
teinte sont choisis par la présentation. La carte Platine apparaît aux pieds,
avec un délai de 0,6 s pour qu’un kill à bout portant ne la consomme pas avant
qu’elle ait été vue. Le ramassage est par proximité, sans touche E.

## Cadavres destructibles

`src/game/entities/shared/enemyCorpses.ts` maintient une réserve de 64 corps par
manager. À la fin de l’animation de mort, un cuboid fixe apparaît au sol :
appartenance `ENEMY`, filtre `PLAYER_SHOT` uniquement. Les coups et projectiles
le touchent comme de la chair ; joueur, ennemis et débris le traversent.
Le bouclier d’un Vigile mort ne protège plus son corps.

`src/game/entities/shared/corpseConfig.ts` règle sa résistance (60 PV), sa
hauteur (0,56 m) et sa largeur suivant le gabarit de l’ennemi. Au réglage
courant, il faut trois coups de pied-de-biche, quatre balles de pistolet ou
deux gerbes complètes de pompe. Le perk Perche applique son multiplicateur.
Les impacts font saigner le corps ; un souffle peut aussi épuiser sa résistance.

L’éclatement retire immédiatement le collider et passe `hasRemains` à `false`.
La présentation masque le sprite et consomme `corpseBurstEvents` une seule fois :
flaque, giclées, morceaux projetés vers le haut et son de démembrement existant.
Cette file est séparée des morts : aucun kill, don, réplique de mort ou nouvelle
carte. Frapper un cadavre ne compte pas comme toucher un ennemi vivant dans la
précision du récapitulatif. Les cadavres du Directeur utilisent le même système,
sans toucher à sa révélation ni à sa carte déjà lâchée.

Une bonbonne porte `gibOnKill: true` dans `explosionConfig` : toute mort
causée par son souffle démembre immédiatement, dans tout son rayon. Le souffle
garde ses dégâts décroissants et son arrêt par les murs. Le Directeur suit
aussi cette règle si le souffle lui retire ses derniers PV ; révélation,
carte et comptage de la mort restent uniques. Une fusée garde son propre
seuil de démembrement de 1,4 m pour les ennemis ordinaires.

La réserve reprend les corps les plus anciens lorsqu’elle est pleine : collider
et sprite disparaissent ensemble. Un ennemi déjà démembré à sa mort ne crée
jamais de cadavre touchable. Le niveau suivant libère le monde physique et les
sprites ; les morceaux et taches restent dans les pools cosmétiques existants.

## Compatibilité de debug

Les setters d’état existent pour les harnais. `forceEnemyState` reconstruit un
snapshot avec `resolveState` et `getPersistedSnapshot`, puis remplace
l’acteur via `createActor` avec ce snapshot. L’ancien acteur est arrêté.
Le contexte et ses références sont conservés en mémoire, sans sérialisation JSON.
L'état est persisté seul, sur un contexte vide, puis le contexte vivant est rattaché : `getPersistedSnapshot` copie le contexte en profondeur sans garde contre les cycles, et le monde Rapier qu'il référence ferait déborder la pile.
Cette restauration ne joue pas les actions d’entrée et ne constitue pas une transition de jeu.
Les variantes flash/recul sont lues à chaud dans les configurations partagées.

## Modules de responsabilité

`enemyMachine.ts` garde le graphe et les décisions par état. `enemyPerception`
porte les rayons de visibilité, `enemyNavigation` les chemins et l’évitement,
`enemyPhysics` le KCC et le knockback, `enemyCombat` la résolution du tir.
L’ordre d’appel et les scratches restent ceux de l’orchestrateur.

## Charge et projection

`enemyCharge.ts` porte les décisions de charge de la machine partagée.
`attack` devient l'anticipation immobile, suivie de `charge`, puis `recover`.
La direction est figée au début d'`attack`. Chaque charge ne touche qu'une
fois ; le chef redémarre une anticipation après récupération, en visant à
nouveau. Une interruption ou une mort annule cet enchaînement.

L'événement de coup transporte une projection et sa durée. Le pas fixe
appelle `PlayerController.applyPush` ; une vitesse distincte de celle des
commandes décroît linéairement, intégrée par trapèzes avant le KCC. Une
collision au mur arrête cette vitesse, un respawn la remet à zéro.
Les [rencontres](../4-technique/rencontres-metro.md#contrôleurs-et-chef-de-brigade)
décrivent appuis, voies, stats et réglages.
