---
name: rapier-character-controller
description: Configuration du KinematicCharacterController de Rapier, groupes de collision, raycasts d'armes hitscan, valeurs de déplacement de référence. Charger pour toute tâche de physique, collision ou déplacement du joueur.
---

# Rapier — controller et collisions

## Ne jamais réimplémenter

Rapier fournit `KinematicCharacterController` avec pentes, marches, autostep
et snap-to-ground. Écrire un controller capsule-vs-monde maison est le trou
noir classique du développement de FPS. C'est un invariant du projet.

## Configuration de référence

```ts
const controller = world.createCharacterController(0.01); // offset
controller.enableAutostep(0.35, 0.2, true);   // hauteur max, largeur mini, dynamique
controller.enableSnapToGround(0.4);
controller.setMaxSlopeClimbAngle(50 * Math.PI / 180);
controller.setMinSlopeSlideAngle(55 * Math.PI / 180);
controller.setApplyImpulsesToDynamicBodies(true);  // pour pousser les caddies
```

Capsule joueur : rayon `0.4`, demi-hauteur `0.6` (hauteur totale 1.2).
Yeux à `1.6` m du sol.

## Groupes de collision

Rapier utilise des bitmasks 32 bits : 16 bits de membership, 16 bits de filtre.

| Groupe | Bit | Collisionne avec |
|---|---|---|
| `WORLD` | 0 | tout |
| `PLAYER` | 1 | WORLD, ENEMY, PICKUP, TRIGGER |
| `ENEMY` | 2 | WORLD, PLAYER, PLAYER_SHOT |
| `PLAYER_SHOT` | 3 | WORLD, ENEMY |
| `ENEMY_SHOT` | 4 | WORLD, PLAYER |
| `DEBRIS` | 5 | WORLD uniquement |
| `TRIGGER` | 6 | PLAYER uniquement (sensor) |

Les débris ne collisionnent qu'avec le monde : sinon les douilles et gibs
bloquent les tirs et coûtent cher pour zéro gameplay.

## Raycast d'arme hitscan

```ts
const hit = world.castRay(
  new RAPIER.Ray(origin, direction),
  maxDistance,
  true,                          // solid
  undefined, undefined, undefined,
  playerCollider,                // exclure le tireur
);
```

Le fusil à pompe tire 9 rays dans un cône de 5°. Utilise une distribution en
disque uniforme, pas gaussienne — la gaussienne concentre trop au centre et
le pompe perd sa signature à moyenne distance.

## Valeurs de déplacement de référence

Point de départ à tuner, **pas** valeurs finales (voir `game-feel-tuning`).

| Paramètre | Valeur |
|---|---|
| Vitesse marche | 9 m/s |
| Vitesse course | 13 m/s |
| Temps → vitesse max au sol | 0.08 s |
| Temps d'arrêt complet | 0.10 s |
| Gravité | −25 m/s² |
| Hauteur de saut | 1.1 m (v₀ ≈ 7.4 m/s) |
| Contrôle aérien | 35 % de l'accélération sol |
| Autostep | 0.35 m |
| Pente max | 50° |

## Diagnostic

Expose en permanence dans le panneau de debug : `isGrounded`, vitesse
horizontale, vitesse verticale, nombre de collisions du dernier `computeColliderMovement`,
et la normale du sol. Un `isGrounded` qui clignote sur terrain plat signale un
problème de snap-to-ground.

## Piège WASM

`@dimforge/rapier3d-compat` nécessite `await RAPIER.init()` avant toute
utilisation. Fais-le avant la création de la scène, pas en lazy — sinon le
premier frame part avec un monde nul.
