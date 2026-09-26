---
title: Valeurs de déplacement
tags: [reference, joueur]
status: brouillon
updated: 2026-09-26
---

# Valeurs de déplacement

Valeurs initiales définies par `src/game/player/moveConfig.ts`. Unité SI. L'objet `moveConfig` est modifiable à chaud pour les essais.

## Mouvement et saut

| Paramètre | Valeur | Unité |
|---|---:|---|
| Vitesse de marche | 9 | m/s |
| Vitesse de sprint | 13 | m/s |
| Accélération jusqu'à la vitesse cible | 0,08 | s |
| Arrêt complet depuis le sprint | 0,10 | s |
| Contrôle aérien | 0,35 | fraction de l'accélération au sol |
| Hauteur de saut visée | 1,1 | m |
| Délai après avoir quitté le bord | 0 | s |
| Mémoire d'appui de saut avant atterrissage | 0 | s |
| Vitesse descendante au sol | 0,2 | m/s |
| Vitesse maximale de chute | 60 | m/s |
| Gravité du monde Rapier | −25 | m/s² |

La vitesse verticale initiale du saut est calculée à partir de la hauteur visée et de la gravité, elle n'est pas stockée comme une valeur indépendante.

## Capsule et contact

| Paramètre | Valeur | Unité |
|---|---:|---|
| Rayon de capsule | 0,4 | m |
| Demi-hauteur de la partie cylindrique | 0,6 | m |
| Hauteur totale capsule | 2,0 | m |
| Hauteur des yeux | 1,6 | m |
| Masse utilisée pour pousser un corps dynamique | 80 | kg |
| Marge du collider | 0,01 | m |
| Hauteur max d'auto-marche | 0,35 | m |
| Largeur libre minimale après marche | 0,2 | m |
| Distance de recollage au sol | 0,4 | m |
| Pente maximale grimpable | 50 | degrés |
| Pente de glissade | 55 | degrés |

## Vue et souris

| Paramètre | Valeur | Unité |
|---|---:|---|
| Sensibilité souris | 0,0025 | radians/pixel |
| Limite de tangage | ±89,5 | degrés |
| FOV vertical au repos | 75 | degrés |
| Élargissement du FOV en sprint | 8 | degrés |
| Réponse du FOV | 0,22 | s |
| Distance par cycle de bob | 5 | m |
| Amplitude verticale du bob | 0,035 | m |
| Amplitude latérale du bob | 0,025 | m |
| Seuil de vitesse du bob | 0,5 | m/s |
| Enfoncement maximal à l'atterrissage | 0,09 | m |
| Temps de retour après réception | 0,35 | s |

Le FOV ne s'élargit qu'au-dessus de 75 % de la vitesse de sprint. Le bob suit la vitesse réalisée et se coupe en l'air. La rotation de caméra est lue au taux d'affichage ; elle n'est pas interpolée.

La gravité appartient à `src/physics/world.ts`, pas à cette configuration. La capsule et le contrôleur viennent de Rapier. Voir [Physique](../4-technique/physique.md) et [Joueur](../4-technique/joueur.md).
