---
title: Three.js et Rapier
tags: [reference, physique, rendu]
status: brouillon
updated: 2026-09-26
---

# Three.js et Rapier

Repères de l'intégration utilisés par le dépôt. Les règles complètes de la physique et de la présentation sont dans [Physique](../4-technique/physique.md) et [Rendu](../4-technique/rendu.md).

## Unités et initialisation

Le monde utilise les unités SI : mètres, secondes et kilogrammes. `initPhysics()` initialise le module WASM avant la création de `PhysicsWorld`. La gravité initiale vaut (0, −25, 0) m/s². `PhysicsWorld.step(dt)` avance Rapier avec le pas fixe fourni par la boucle.

## Character controller

Le joueur et les ennemis utilisent `KinematicCharacterController` de Rapier. Il calcule une translation corrigée ; le code du jeu applique la gravité et alimente le résultat au corps/collider. La fabrique partagée règle l'axe vertical, l'offset, l'autostep, le snap-to-ground, les pentes, les impulsions aux corps dynamiques et la masse du personnage.

Les paramètres canoniques du joueur sont dans `src/game/player/moveConfig.ts`. Le contrôleur d'ennemi reçoit les configurations de `src/game/entities/suitConfig.ts` et `src/game/entities/directorConfig.ts`. Ne créez pas une capsule-vs-monde maison.

## Groupes de collision

`src/physics/world.ts` définit les groupes. Une valeur Rapier encode les bits d'appartenance dans les 16 bits hauts, puis le filtre dans les 16 bits bas. L'interaction est symétrique : l'appartenance de A doit correspondre au filtre de B, et l'inverse aussi.

| Groupe | Appartenance | Filtre |
|---|---|---|
| `WORLD` | décor fixe | Tous les groupes |
| `PLAYER` | joueur | monde, ennemi, tir ennemi, trigger, prop |
| `ENEMY` | ennemi | monde, joueur, tirs joueur, ennemis, props |
| `PLAYER_SHOT` | tir joueur | monde, ennemis, props |
| `ENEMY_SHOT` | tir ennemi | monde, joueur |
| `DEBRIS` | débris cosmétiques | monde |
| `TRIGGER` | volume de niveau | joueur |
| `PROP` | prop physique mobile | monde, joueur, ennemis, tirs joueur, props |

Le groupe `PROP` reste séparé de `WORLD`. Les tirs ennemis traversent volontairement les props. Les requêtes de ligne de vue et le graphe de navigation filtrent le monde fixe.

## Raycasts et trimesh

Les tirs et les requêtes de visibilité passent par les raycasts Rapier avec des groupes de filtre explicitement choisis. Le loader construit les colliders du niveau ; une géométrie de niveau en trimesh active la correction des arêtes internes de Rapier pour éviter les accrocs sur les coutures de triangles.

Un collider sensor de niveau interagit avec le personnage kinématique grâce au groupe `TRIGGER`. Les changements de types de collision et d'événements sont configurés lors de sa création.

## Three.js

Le renderer dessine à une résolution interne de 640×360 puis agrandit l'image. Les matériaux de décor utilisent `MeshLambertMaterial`. La caméra lit sa rotation au taux d'affichage ; seules les positions visuelles peuvent être interpolées. Les assets du jeu sont importés depuis `public/assets/` au moyen du loader glTF.

Évitez d'appliquer une mise à jour visuelle à un mesh séparément de son système de jeu. Les portes et props synchronisent notamment leur pose depuis leurs systèmes au moment prévu dans la boucle.

Sources : `src/physics/world.ts`, `src/physics/raycast.ts`, `src/game/level/loader.ts`, `src/render/renderer.ts`. Pour les contrats d'import, voir [Conventions de nommage](conventions-nommage.md).
