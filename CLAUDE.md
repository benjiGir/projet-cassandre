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

> Phase 4 — Pipeline de niveau (glTF, conventions de nommage, hot reload).
> Codée et fonctionnelle : `src/game/level/loader.ts` (contrat complet
> `col_*`/`spawn_player`/`spawn_suit_*`/`trig_*`/`door_*`/`use_*`/`secret_*`,
> transforms monde appliqués avant Rapier, reconversion forcée en
> `MeshLambertMaterial`/`NearestFilter` — sinon `GLTFLoader` viole l'invariant
> #5 silencieusement), `src/game/level/hotReload.ts` (sondage HTTP HEAD
> ETag/Last-Modified, 400ms, préserve la position du joueur au reload).
> Câblage additif dans `main.ts` : `gym.ts` reste le niveau par défaut au
> boot, le pipeline glTF s'active via `?level=<nom>` ou
> `window.cassandre.level.load(name)` — rien de cassé côté Phases 1-3.
> Critère humain de cette phase ("déplacer un mur dans Blender, exporter, le
> voir en jeu en moins de 60 secondes, chronométré") pas encore constaté —
> hors de portée d'un agent, à tester par l'utilisateur dans son propre
> Blender.
>
> **Phases 0-3 codées, fonctionnelles, et validées humainement.** Phase 3
> ("l'ennemi Costard" — machine à états, billboard, hitscan télégraphié,
> gibs) est le **point de décision majeur du plan** : combat contre plusieurs
> Costards dans la gym jugé fun par l'utilisateur ("Franchement c'est fun
> même si ça ressemble à rien, je valide") — le proto continue. Feedback de
> hit retravaillé après coup (son placeholder synthétique ajouté, crosshair
> permanent, gizmos balistiques touche `B`, fix d'un vrai bug de portée sur
> le pied-de-biche, compteur de munitions du pompe affiché). Phase 1
> (déplacement) validée dès son passage ("Quake / Half-Life 1"), deux bugs de
> stutter post-playtest corrigés (reclip de vélocité sur mur uniquement,
> `groundStickSpeed` réduit à -0.2 m/s — voir `.claude/docs/RAPIER_GUIDE.MD`
> / skill `threejs-rapier-fieldguide` pour la référence qui a orienté le
> diagnostic). Outils de debug : `V` wireframe, `B` gizmos balistiques.
>
> **Gate `qa-evidence` : abandonné par défaut, pas par phase — décision
> explicite de l'utilisateur (2026-08-20).** Ne pas le lancer à chaque phase ;
> il sera lancé une seule fois, à la toute fin du proto, si besoin.
>
> Mettre à jour cette ligne à chaque passage de phase.

Les critères de validation et de rollback de chaque phase sont dans
`PLAN_PROTO_BOOMER_SHOOTER.md`.

**Gate `qa-evidence` abandonné (décision explicite de l'utilisateur,
2026-08-19).** Le passage de phase ne dépend plus d'une validation formelle
par preuve (build/console/hash pixel/déterminisme/perf) — seul le critère
humain de fun/lisibilité du plan compte. Le `director` ne doit plus bloquer
une phase suivante en attendant `qa-evidence`.
