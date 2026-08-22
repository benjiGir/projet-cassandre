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

tools/blender/        scripts headless (kit, niveaux, bake, validation, export)
assets_src/blender/   sources .blend (kit + niveaux), jamais servi en runtime
public/assets/levels/ .glb exportés, seuls fichiers lus par le jeu
```

## Phase courante

> Phase 5 — Le niveau (l'hypermarché), en cours zone par zone.
> **Écran de choix de niveau** au boot (`src/ui/LevelMenu.tsx` + registre
> `src/game/level/levels.ts`) : "Gym (test)" / "Zone A — Parking", chemins
> MUTUELLEMENT EXCLUSIFS (plus de coexistence additive gym+niveau par
> défaut — ça produisait du z-fighting réel, constaté). `?level=<id
> enregistré>` saute le menu ; `?level=<nom>` non enregistré retombe sur
> l'ancien comportement additif brut (outil de test isolé du loader, pas un
> chemin joueur). `window.cassandre.level.load(name)` en console peut
> toujours recréer l'additif volontairement, pour ce même usage de test.
> **Zone A — Parking** codée et fonctionnelle : géométrie construite et
> exportée directement depuis Blender (`public/assets/levels/zone_a_parking.glb`,
> géométrie visible en plus des colliders — voir piège ci-dessous). Parking
> clos, vitrine (fente horizontale 1.2-2.0m — ligne de vue dégagée, aucun
> chemin au sol), un Costard scellé dans une alcôve à 20m (au-delà
> d'`attackRange`, en-deçà de `sightRange` : visible, jamais punitif, aucun
> code IA nouveau nécessaire — vérifié par décodage direct du `.glb`). Pied-
> de-biche au sol (`use_crowbar`) : le joueur démarre désarmé dans cette
> zone uniquement (`WeaponSystem.startUnarmed()` / `pickUpMelee()`,
> `activeWeapon: "none"|"melee"|"shotgun"`), ramassé via
> `src/game/level/interactive.ts` (touche `E`, dispatch par nom d'objet
> Blender — le contrat `use_*`/`extras.target` est pensé pour un
> interrupteur-vers-porte, pas pour un pickup autoportant, décision
> documentée dans le fichier). `gym.ts` démarre toujours armé, zéro
> régression (vérifié, les deux chemins testés en navigateur).
> **Pipeline de niveau v2 (2026-08-21/22)** : nouvel agent `level-forge` +
> 6 skills Blender (`blender-level-conventions`, `blender-python-automation`,
> `collision-proxy-authoring`, `modular-kit-design`, `retro-texture-density`,
> `vertex-color-sector-lighting`). Vrai kit modulaire de 25 pièces
> (`assets_src/blender/kit_hypermarche.blend`, VERDICT CONFORME), scripts
> headless sous `tools/blender/` (`build_kit.py`, `build_level.py`,
> `bake_vertex_lighting.py`, `validate_level.py`, `export_level.py`,
> `inspect_kit.py` — voir leur `README.md`). Proxies de collision cuboid
> (pas trimesh, perf/stabilité — `loader.ts` détecte maintenant `col_box_*`
> ET tout `col_*` géométriquement boîte) et éclairage baké en vertex colors
> (`COLOR_0`, `material.vertexColors = true`). **Zones A et B reconstruites
> avec ce vrai kit**, remplaçant les prototypes en boîtes plates du premier
> jet — 56 et 64 colliders cuboid respectivement (vs ~9 boîtes brutes
> avant), murs à 5m (hauteur "salle de vente" du kit, pas 3.2m), éclairage
> visible en jeu. Contrat runtime inchangé (mêmes noms d'objets, mêmes
> comptes `spawns`/`use`/`colliders` vérifiés en jeu après reconstruction).
> **Piège Blender découvert** (premier jet, avant le kit) : `col_*` est
> rendu INVISIBLE par convention (collider seul) — un mur voulu à la fois
> visible et solide a besoin de DEUX objets superposés. Oublié dans le tout
> premier jet de Zone A ; corrigé, puis structurellement résolu par le kit
> (chaque pièce porte son rendu + son proxy ensemble).
> `spawn_suit_*` → vrai `Suit` : corrigé, le Costard scellé de la Zone A est
> réellement présent en jeu (`Entities: 1`, état ALERTE en continu, jamais
> TIR — revérifié après la reconstruction au kit, distance inchangée). Le
> registre `levels.ts` a remplacé le hardcode par id.
>
> **Zone B — Caisses** : sol + périmètre 24×24m, 4 `kit_checkout` en ligne
> à Y≈9.5 (trouées de 2m), 3 `spawn_suit_*` à 18m du spawn (`spawn_suit_2`
> était à 15m dans le premier jet — sous `attackRange`, aucune fenêtre
> d'approche, signalé par `entity-designer` et corrigé lors de la
> reconstruction). Démarre ARMÉE (pas de `startUnarmed`). Vérifié en jeu :
> 3 Costards visibles, positions exactes, état ALERTE.
> **Écart encore ouvert, jugement humain requis** : les caisses (`kit_checkout`,
> 1.10m) restent sous `eyeHeight` (1.6m, joueur ET Costard) utilisé par tous
> les raycasts de vision/tir — la "couverture" du plan reste purement
> visuelle, ne bloque aucun hitscan (et il n'y a pas de crouch dans
> `moveConfig.ts`). Pas corrigé par la reconstruction au kit (question de
> layout, pas de géométrie).
> **Observation non traitée, hors scope de la reconstruction** : en Zone B,
> `spawn_suit_2` inflige déjà des dégâts après quelques secondes d'immobilité
> du joueur — effet de l'agressivité/vitesse de l'IA à cette distance, pas
> de la géométrie (distance vérifiée exacte à 18m). À évaluer en jouant.
> Zones C-E, secrets, caddies, micro d'annonces, porte à badge : pas
> commencés.
>
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
