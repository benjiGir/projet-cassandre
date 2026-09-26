---
title: Valeurs des ennemis
tags: [reference, ennemis]
status: brouillon
updated: 2026-09-26
---

# Valeurs des ennemis

Valeurs initiales de `src/game/entities/suitConfig.ts` et `src/game/entities/directorConfig.ts`. Le système utilise une seule machine d'états partagée. Les différences de paramètres distinguent le Costard du Directeur.

## Locomotion et perception

| Paramètre | Costard | Directeur | Unité |
|---|---:|---:|---|
| Points de vie | 50 | 300 | PV |
| Rayon de capsule | 0,4 | 0,45 | m |
| Demi-hauteur de capsule | 0,5 | 0,6 | m |
| Hauteur des yeux | 1,6 | 1,8 | m |
| Masse | 75 | 110 | kg |
| Distance de vision | 22 | 22 | m |
| Perte de contact avant retour au repos | 5 | 5 | s |
| Vitesse de poursuite | 3,6 | 3,2 | m/s |
| Vitesse de rotation | 8 | 6 | rad/s |
| Rayon d'évitement | 1,4 | 1,6 | m |
| Angle des rayons latéraux | 30 | 30 | degrés |
| Hauteur de marche | 0,35 | 0,35 | m |
| Recollement au sol | 0,4 | 0,4 | m |
| Pente grimpable / glissade | 50 / 55 | 50 / 55 | degrés |

## Combat

| Paramètre | Costard | Directeur | Unité |
|---|---:|---:|---|
| Durée d'alerte | 0,45 | 0,45 | s |
| Télégraphie d'attaque | 0,35 | 0,4 | s |
| Délai minimum entre les attaques | 1,7 | 2,2 | s |
| Portée d'attaque | 16 | 14 | m |
| Dégâts | 6 | 10 | PV |
| Écart de visée aléatoire borné | ±2,5 | ±2 | degrés |
| Durée de recul après impact | 0,4 | 0,45 | s |
| Durée d'une image de mort | 0,12 | 0,15 | s |
| Vitesse initiale du recul reçu | 4,5 | 3 | m/s |
| Temps de décroissance du recul | 0,3 | 0,3 | s |
| Impulsion verticale du recul | 1,5 | 1 | m/s |

Le télégraphe d'attaque reste au moins assez long pour une réaction humaine. Le bruit de visée de chaque ennemi utilise le RNG déterministe. Les valeurs ne font pas appel à `Math.random()`.

## Directeurs

Le Directeur est révélé quand ses PV passent sous 50 % de son maximum. À sa mort, il lâche la carte Platine. Son attaque fait davantage de dégâts et sa télégraphie est plus longue que celle du Costard.

Le rayon de ramassage de la carte est de 1,5 m avec un délai de 0,6 s après sa création. La caméra secoue pendant 0,25 s lors de la révélation, avec une amplitude de 0,12 m.

## Variantes exposées au harnais

Le harnais console propose trois variantes de recul et de flash du Costard :

| Variante | Vitesse recul | Impulsion verticale | Durée flash |
|---|---:|---:|---:|
| A | 2 | 0,6 | 0,12 s |
| B (valeur par défaut) | 4,5 | 1,5 | 0,25 s |
| C | 8 | 3 | 0,45 s |

Les configs mutables et variantes sont exposées par `window.cassandre` en développement. Voir [Ennemis et IA](../4-technique/ennemis-et-ia.md).
