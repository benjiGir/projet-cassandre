# PROJET_CASSANDRE — contexte projet

Boomer shooter rétro façon Duke Nukem 3D / Ion Fury, en Three.js vanilla.
Prototype : 1 niveau, 2 armes, 1 type d'ennemi, 8-10 minutes de jeu.

## Stack

Vite + TypeScript · three (vanilla) · @dimforge/rapier3d-compat · React DOM
en overlay uniquement · zustand · howler · Blender → glTF

## Invariants — non négociables

Toute proposition qui viole un de ces points doit être **refusée avec
explication**, pas contournée.

1. **Fixed timestep 1/60.** Aucune logique de gameplay ou de physique hors du
   pas fixe. Delta clampé à 0.25 s.
2. **React ne touche jamais la boucle.** Pas de `setState` par frame. Le HUD
   s'abonne à zustand, throttlé à 10 Hz maximum.
3. **La rotation caméra n'est pas interpolée.** Elle est lue au taux
   d'affichage. L'interpoler ajoute de la latence de visée.
4. **Résolution interne 640×360**, upscalée. `NearestFilter` sur toutes les
   textures, `generateMipmaps = false`.
5. **`MeshLambertMaterial` uniquement.** Pas de PBR, pas de
   `MeshStandardMaterial`, pas de map de rugosité ni de métalness.
6. **Character controller = celui de Rapier** (`KinematicCharacterController`).
   Jamais d'implémentation maison capsule-vs-monde.
7. **Gravité −25 m/s².** Le réalisme donne un saut mou.
8. **Pas d'ECS** avant 12 types d'ennemis. `Entity[]` + `update(dt)` + `switch`.
9. **Boîtes blanches jusqu'à la Phase 5.** Pas d'assets finaux avant que le
   gameplay soit validé.
10. **Aucune animation ne bloque le joueur.** Pas de rechargement immobilisant.

## Conventions de nommage glTF

| Préfixe | Effet à l'import |
|---|---|
| `col_*` | collider trimesh statique, mesh rendu invisible |
| `spawn_player` | position/orientation de départ |
| `spawn_suit_*` | point d'apparition ennemi |
| `trig_*` | volume de trigger (box), mesh invisible |
| `door_*` | porte animée, collider dynamique |
| `use_*` | objet interactif (portée 2 m) |
| `secret_*` | zone comptabilisée dans le compteur de secrets |

## Structure

```
src/core/     loop input time audio
src/render/   renderer billboard fx
src/physics/  world
src/game/     player entities level state
src/ui/       React overlay
```

## Phase courante

> Phase 0 — Socle technique.
> Mettre à jour cette ligne à chaque passage de phase.

Les critères de validation et de rollback de chaque phase sont dans
`PLAN_PROTO_BOOMER_SHOOTER.md`. Ne pas avancer de phase sans que
`qa-evidence` ait validé la précédente.
