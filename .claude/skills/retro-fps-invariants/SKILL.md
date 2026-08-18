---
name: retro-fps-invariants
description: Invariants non négociables de PROJET_CASSANDRE — fixed timestep, découplage React, pipeline 640×360, matériaux Lambert, Rapier KCC, interdiction d'ECS prématuré. Charger en premier pour toute tâche sur le jeu, avant tout autre skill.
---

# Invariants — PROJET_CASSANDRE

Skill racine. Chargé avant tous les autres. Toute proposition qui viole un
point ci-dessous doit être **refusée avec explication du coût**, jamais
contournée silencieusement.

## Les dix

| # | Invariant | Coût de la violation |
|---|---|---|
| 1 | Fixed timestep 1/60, delta clampé à 0.25 s | Le feel devient dépendant de la machine ; tout le tuning est à refaire |
| 2 | React ne touche jamais la boucle | Budget de perf perdu avant d'avoir commencé |
| 3 | Rotation caméra non interpolée, lue au taux d'affichage | Latence de visée perçue |
| 4 | 640×360 interne, `NearestFilter`, pas de mipmaps | L'identité visuelle disparaît |
| 5 | `MeshLambertMaterial` exclusivement | Le look Build vient de l'absence de spécularité |
| 6 | Character controller = `KinematicCharacterController` de Rapier | ~6 semaines perdues, classiquement |
| 7 | Gravité −25 m/s² | Saut mou et flottant |
| 8 | Pas d'ECS avant 12 types d'ennemis | Un moteur magnifique et zéro jeu |
| 9 | Boîtes blanches jusqu'à la Phase 5 | Un joli niveau retarde le diagnostic d'un combat mou |
| 10 | Aucune animation ne bloque le joueur | Casse le rythme d'un boomer shooter |

## Hiérarchie de décision

En cas de conflit entre deux objectifs, l'ordre est :

1. **Feel** — la sensation de jeu prime sur tout
2. **Lisibilité** — le joueur doit toujours comprendre ce qui le tue
3. **Déterminisme** — même entrée, même sortie
4. **Identité visuelle** — le look rétro cohérent
5. **Performance** — dans le budget, pas au-delà
6. **Élégance du code** — dernière, et loin derrière

Cette hiérarchie est volontairement inhabituelle pour un projet applicatif.
Elle est correcte pour un prototype de jeu.

## Le piège principal

Le réflexe naturel d'un développeur senior est de bien concevoir : registres,
abstractions, généricité. Sur un prototype de jeu, c'est le mode d'échec
numéro un.

**Symptôme diagnostique** : tu as passé une session entière sur un système et
tu ne peux pas décrire ce que le joueur en voit à l'écran.

## Question de contrôle

Avant toute proposition d'architecture, réponds : *est-ce que ça aide à
répondre à « ce jeu est-il fun 8 minutes ? »* Si non, c'est hors scope, quelle
que soit la qualité technique de l'idée.
