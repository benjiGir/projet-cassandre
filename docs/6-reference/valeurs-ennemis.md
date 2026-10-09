---
title: Valeurs des ennemis
tags: [reference, ennemis]
status: brouillon
updated: 2026-10-08
---

# Valeurs des ennemis

Valeurs initiales de `src/game/entities/suit/suitConfig.ts`, `src/game/entities/rampant/rampantConfig.ts`, `src/game/entities/vigile/vigileConfig.ts` et `src/game/entities/director/directorConfig.ts`. Le système utilise une seule machine d'états partagée ; seuls les paramètres distinguent les espèces. Le Rampant et le Vigile reprennent ceux du Costard, sauf mention contraire plus bas.

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

Toute télégraphie d'attaque dure au moins **0,2 s** et combine un signal
visuel et sonore avant les dégâts. C'est un plancher de lisibilité du combat,
pas une valeur de configuration validée automatiquement. Les valeurs
actuelles (0,35 s et 0,4 s) sont dans le tableau ci-dessus. Le bruit de visée
de chaque ennemi utilise le RNG déterministe ; le code n'appelle pas
`Math.random()`.

## Rampant et Vigile

Seules les valeurs qui diffèrent de celles du Costard.

| Paramètre | Costard | Rampant | Vigile | Unité |
|---|---:|---:|---:|---|
| Points de vie | 50 | 20 | 140 | PV |
| Rayon de capsule | 0,4 | 0,35 | 0,5 | m |
| Demi-hauteur de capsule | 0,5 | 0,25 | 0,5 | m |
| Hauteur des yeux | 1,6 | 0,8 | 1,75 | m |
| Masse | 75 | 45 | 130 | kg |
| Distance de vision | 22 | 26 | 20 | m |
| Perte de contact avant retour au repos | 5 | 6 | 8 | s |
| Vitesse de poursuite | 3,6 | 9,5 | 2,6 | m/s |
| Vitesse de rotation | 8 | 12 | 2,2 | rad/s |
| Durée d'alerte | 0,45 | 0,3 | 0,6 | s |
| Télégraphie d'attaque | 0,35 | 0,28 | 0,55 | s |
| Délai minimum entre les attaques | 1,7 | 1,1 | 1,8 | s |
| Distance d'armement | 16 | 2,6 | 2,8 | m |
| Portée du coup au contact | — | 1,9 | 2,3 | m |
| Vitesse du bond | — | 7 | 3,5 | m/s |
| Dégâts | 6 | 6 | 22 | PV |
| Vitesse initiale du recul reçu | 4,5 | 4,5 | 1,2 | m/s |
| Arc du bouclier | — | — | 70 de chaque côté | degrés |

Repères : le joueur marche à 9 m/s et court à 13 m/s. Le Rampant rattrape un
joueur qui marche. À 3 m, un joueur qui marche tourne autour du Vigile à
3 rad/s, plus vite que lui : c'est ce qui permet de passer dans son dos.

## Difficulté

`src/game/session/progression/difficulty.ts`. Les PV et les dégâts sont
multipliés puis arrondis, avec un plancher de 1.

| | Client | Habitué | Lanceur d'alerte |
|---|---:|---:|---:|
| PV des ennemis | ×0,75 | ×1 | ×1,3 |
| Dégâts des ennemis | ×0,6 | ×1 | ×1,5 |
| Part d'un groupe réveillé | 50 % | 75 % | 100 % |
| Probabilité de don | ×1,4 | ×1 | ×0,7 |

| PV obtenus | Client | Habitué | Lanceur d'alerte |
|---|---:|---:|---:|
| Costard | 38 | 50 | 65 |
| Rampant | 15 | 20 | 26 |
| Vigile | 105 | 140 | 182 |
| Directeur | 225 | 300 | 390 |

Un coup de pompe à bout portant retire 54 PV : il tue un Costard d'un coup en
Client et en Habitué, pas en Lanceur d'alerte.

## Explosion

`explosionConfig`, dans `src/game/level/props/propConfig.ts`.

| Paramètre | Valeur |
|---|---:|
| Rayon du souffle | 5 m |
| Dégâts au centre, décroissants jusqu'au rayon | 120 PV |
| Part des dégâts reçue par le joueur | 50 % |
| Distance sous laquelle un ennemi éclate | 2,5 m |
| Délai avant qu'une bonbonne atteinte explose | 9 pas fixes (0,15 s) |
| PV d'une bonbonne | 20 |

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

Les configs mutables et variantes sont exposées par `window.cassandre` en développement. Voir [Ennemis et IA](../4-technique/ennemis-et-ia.md), [Difficulté](../2-fonctionnel/difficulte.md) et [Valeurs de l'économie](valeurs-economie.md).
