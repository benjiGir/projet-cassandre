---
title: RNG de présentation séparé et portée du rejeu F9/F10
tags: [adr, core, rendu]
status: accepte
updated: 2026-09-25
---

# ADR 0033 — RNG de présentation séparé et portée du rejeu F9/F10

## Statut

Accepté. Précise l'[ADR 0007](0007-rng-deterministe.md) sans remplacer son générateur canonique.

## Contexte

Le nombre d'images rendues entre deux pas fixes varie. Un tirage cosmétique
partagé avec la simulation rendrait donc les armes, ennemis ou gains de vues
dépendants du taux d'affichage. À l'inverse, `Math.random()` dans les FX et
l'audio contredit l'invariant #12. F9/F10 ne restaure que la pose/vitesse du
joueur et les inputs : ni l'état complet du monde, ni les flux RNG, ni les
timers et ressources du combat ne sont capturés.

## Décision

Tous les flux viennent de `DeterministicRandom`, avec des graines et des
propriétaires distincts. Les gains de vues sont tirés dans le pas fixe par un
flux propre à `GameSession`. `FxSystem` et l'audio possèdent chacun un flux
cosmétique réinitialisé au boot de session ; ils ne peuvent avancer aucun RNG
de simulation. La suite visuelle est reproductible à séquence de frames égale,
mais n'est pas une preuve pixel-perfect indépendante du framerate.

F9/F10 est un harnais d'input pour comparer le déplacement et ses réglages.
Il n'est **pas** une preuve de déterminisme global du combat ou du niveau.
Une telle preuve exigerait une session initiale versionnée et un hash d'état
par pas fixe.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Un RNG commun au jeu et au rendu | La fréquence d'affichage avancerait le flux de simulation. |
| `Math.random()` pour les seuls FX | Contredit l'invariant et empêche la reproduction d'une séquence visuelle. |
| Annoncer F9/F10 comme rejeu complet | L'enregistrement ne contient pas assez d'état pour tenir cette promesse. |

## Conséquences

Un changement du nombre de particules ou de lectures audio ne modifie plus
les décisions de jeu. Les captures visuelles doivent fixer aussi le calendrier
des images. Les tests F9/F10 ne doivent comparer que le mouvement tant qu'un
snapshot complet n'existe pas.

## Comment on saurait qu'on a eu tort

Si des vues, dégâts ou chemins changent quand on ne modifie que le nombre de
frames rendues, un flux cosmétique a franchi la frontière. Si le harnais doit
certifier le combat complet, cette décision doit être remplacée par un contrat
de snapshot/version/hash explicite.
