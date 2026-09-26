---
title: Physique
tags: [technique]
status: stable
updated: 2026-09-26
---

# Physique

## Responsabilité

Fait : porte le monde Rapier (`@dimforge/rapier3d-compat`) partagé par tout
le jeu — un seul `PhysicsWorld` par session — et le point d'entrée unique par
lequel le reste du code lui pose une question géométrique (`RaycastService`).
Décide qui a le droit de toucher qui (les groupes de collision) et fournit le
`KinematicCharacterController` que joueur et ennemis utilisent chacun de leur
côté pour se déplacer contre le décor (invariant #6).

Ne fait pas : ne décide d'aucune règle de gameplay (dégâts, IA, ouverture de
porte) — ça reste aux systèmes appelants (`src/game/player/weapons.ts`,
`src/game/entities/enemyMachine.ts`, `src/game/level/doors.ts`…). Ne dessine
rien (le rendu du décor, des sprites ou des debris cosmétiques vit dans
`src/render/`, voir [ADR 0018](../decisions/0018-physique-jouet-debris-cosmetiques.md)
pour les debris qui n'utilisent délibérément aucun `RigidBody`).

## Fichiers

- `src/physics/world.ts` — `PhysicsWorld` (monde Rapier, gravité, pas),
  `GROUP`/`COLLISION_GROUPS` (groupes de collision), `configureCharacterController`
  (réglages KCC partagés par la fabrique du joueur).
- `src/physics/raycast.ts` — `RaycastService` : service Effect qui enveloppe
  les quatre requêtes physiques réellement utilisées par le jeu.
- `src/game/player/controller.ts` — fabrique et pilotage du KCC du joueur
  (détail complet : `joueur.md`).
- `src/game/entities/enemyMachine.ts` — `configureEnemyCharacterController`,
  les rayons de ligne de vue et d'évitement local des ennemis.
- `src/game/level/loader.ts` — construit tous les colliders du niveau au
  chargement (`col_*`, `col_box_*`, `col_hull_*`, `prop_*`, `door_*`, `vitre_*`,
  `sanitaire_*`, `trig_*`).
- `src/game/level/pathfinding.ts` — bake du graphe de navigation, seul
  consommateur de `castShape`.
- `src/game/session/spawning.ts` — appelle `refreshSceneQueries()` avant le
  bake du graphe de navigation, au chargement d'un niveau.

## Où ça s'insère dans la boucle

Le pas fixe et son ordre exact sont décrits dans
[Boucle et temps](../3-architecture/boucle-et-temps.md). Pour la physique
précisément : `stepPhysics` (`src/game/loop/stepPhysics.ts`) appelle
`session.physics.step(dt)` **après** `updateGameplay` — les décisions de
gameplay du pas (tir, déplacement voulu, ouverture de porte) sont donc déjà
prises quand Rapier intègre les corps dynamiques et les KCC. Un raycast de
gameplay (tir, ligne de vue, neartag de sanitaire) est un `Effect.sync`
immédiat via `RaycastService` : il ne suspend jamais le pas fixe, conforme à
la frontière synchrone stricte (invariant #11).

Le chargement de niveau est la seule séquence hors pas fixe qui crée des
colliders en masse : `loader.ts` peuple `PhysicsWorld` pendant l'import du
glTF, puis `spawning.ts` appelle `refreshSceneQueries()` avant de lancer le
bake du graphe de navigation (voir Pièges).

## Données et contrats

### Groupes de collision

Encodage Rapier : 32 bits, 16 bits d'appartenance (poids fort) + 16 bits de
filtre (poids faible). Deux colliders `a`/`b` interagissent si et seulement
si `((a >> 16) & b) != 0 && ((b >> 16) & a) != 0` — condition **symétrique** :
mettre un groupe dans le filtre de l'autre sans l'inverse ne produit aucune
interaction. `interactionGroups(memberships, filter)` (`src/physics/world.ts`)
compose ce masque ; `COLLISION_GROUPS` la symétrise par construction pour
chaque groupe déclaré dans `GROUP`.

| Groupe | Porté par | Interagit avec |
|---|---|---|
| `WORLD` | Décor `col_*`/`col_box_*`/`col_hull_*`, `vitre_*` (`solide !== false`), `sanitaire_*`, `door_*` (corps fixe, collider actif seulement fermé) | tout |
| `PLAYER` | KCC du joueur | `WORLD`, `ENEMY`, `ENEMY_SHOT`, `TRIGGER`, `PROP` |
| `ENEMY` | KCC de Costard/Directeur | `WORLD`, `PLAYER`, `PLAYER_SHOT`, `ENEMY` (lui-même), `PROP` |
| `PLAYER_SHOT` | Rayons/capsule des armes du joueur | `WORLD`, `ENEMY`, `PROP` |
| `ENEMY_SHOT` | Rayon de tir ennemi | `WORLD`, `PLAYER` |
| `DEBRIS` | Déclaré, non utilisé (voir Pièges) | `WORLD` |
| `TRIGGER` | `trig_*` (sensor) | `PLAYER` |
| `PROP` | `prop_*` (corps dynamique) | `WORLD`, `PLAYER`, `ENEMY`, `PLAYER_SHOT`, `PROP` |

Deux groupes s'incluent eux-mêmes, chacun pour une raison différente et
documentée dans son ADR :

- `ENEMY` se bloque avec lui-même — sans ça, plusieurs ennemis convergeant sur
  le même point (le joueur) interpénètrent leurs capsules et leurs billboards
  clignotent (z-fighting franc, voir [ADR 0008](../decisions/0008-collision-ennemi-ennemi.md)).
- `PROP` se bloque avec lui-même — deux props peuvent se heurter (une pile de
  cartons qui s'écroule) et se bloquer réciproquement.

`PROP` est **volontairement séparé de `WORLD`**. Deux requêtes du jeu
filtrent sur `WORLD` seul, calculées une fois pour toutes au chargement du
niveau : la ligne de vue ennemie (`WORLD_ONLY_RAY_GROUPS` dans
`enemyMachine.ts`) et le bake du graphe de navigation (même filtre dans
`pathfinding.ts`). Un prop en `WORLD` entrerait dans les deux — or il bouge :
un caddie poussé laisserait derrière lui un trou de navigation et un
bloqueur de vue fantômes. Conséquence assumée : `ENEMY_SHOT` est absent du
filtre de `PROP`, donc **un prop n'arrête pas une balle ennemie**
([ADR 0030](../decisions/0030-props-dynamiques.md)).

`DEBRIS` reste déclaré mais aucun collider ne le porte : douilles éjectées et
gibs de mise à mort utilisent une physique factice en temps d'affichage
(`src/render/fx.ts`), jamais de vrai `RigidBody` — sinon ils bloqueraient des
tirs pour zéro gameplay ([ADR 0018](../decisions/0018-physique-jouet-debris-cosmetiques.md)).

### Types de colliders produits par le loader

| Préfixe / cas | Corps | Collider | Groupe |
|---|---|---|---|
| `col_box_*` | fixe | cuboid, confiance à l'artiste (pas de revalidation géométrique) | `WORLD` |
| `col_*` (mesh détecté axis-aligned box) | fixe | cuboid (rattrapage automatique, [ADR 0004](../decisions/0004-colliders-cuboid.md)) | `WORLD` |
| `col_hull_*` | fixe | convex hull, repli sur trimesh si les sommets sont dégénérés | `WORLD` |
| `col_*` / `col_mesh_*` (dernier recours) | fixe | trimesh | `WORLD` |
| `trig_*` | fixe | cuboid, sensor | `TRIGGER` |
| `prop_*` | dynamique, CCD activé | cuboid, masse/friction/restitution lues sur l'objet | `PROP` |
| `door_*` | **fixe**, posé à la pose FERMÉE pour toujours (voir [ADR 0031](../decisions/0031-portes-animees-et-vitres.md)) | cuboid, activé/désactivé par `DoorSystem` selon l'état d'ouverture | `WORLD` |
| `vitre_*` (`solide !== false`) | fixe | cuboid | `WORLD` |
| `vitre_*` (`solide === false`) | — | aucun collider (verrière/fenêtre incassable) | — |
| `sanitaire_*` | fixe | cuboid | `WORLD` |

Le collider cuboid d'un `prop_*` est posé sur le **centre** de sa boîte, pas
sur l'origine du mesh — un corps dynamique tourne autour de son centre de
masse. L'écart est conservé (`PropInfo.centerOffset`) et réappliqué au
rendu ; `door_*` n'a pas ce problème depuis l'ADR 0031 (corps fixe pour de
bon, recentré comme un `col_box_*`).

### Service de raycasting (`RaycastService`)

Point d'entrée unique pour toute question géométrique au monde physique — le
jeu n'utilise pas `THREE.Raycaster`. Quatre méthodes, miroir direct de l'API
Rapier :

| Méthode | Miroir de | Utilisé par |
|---|---|---|
| `castRay` | `RAPIER.World.castRay` | ligne de vue et évitement local des ennemis (`enemyMachine.ts`), sonde de sol (`spawning.ts`), rayon de visée des sanitaires (`session/sanitaires.ts`) |
| `castRayAndGetNormal` | `RAPIER.World.castRayAndGetNormal` | résolution d'attaque ennemie, pistolet et pompe (`player/weapons.ts`), bake du graphe de navigation (`level/pathfinding.ts`) |
| `castShape` | `RAPIER.World.castShape` | balayage de la capsule de personnage entre deux cellules de navigation, uniquement dans le bake (`level/pathfinding.ts`) |
| `intersectionsWithShape` | `RAPIER.World.intersectionsWithShape` (callback natif, mais collecté dans un tableau retourné) | capsule du pied-de-biche (`player/weapons.ts`) |

`physics: PhysicsWorld` est un **paramètre** de chaque méthode, jamais stocké
dans le service : `PhysicsWorld` se construit après `GameLayer`/`GameRuntime`
(init WASM asynchrone), et ça permet à `RaycastService.test(overrides)` de
scripter des résultats (par défaut « rien touché ») sans jamais construire de
vrai monde Rapier — utile pour tester `enemyMachine.ts`/`pathfinding.ts` de
façon déterministe. Discipline zéro-allocation : `ray`/`shapePos`/`shapeRot`/
`shape` sont fournis déjà construits par l'appelant (scratch réutilisé) ; le
service ne fabrique jamais lui-même une forme Rapier.

Tout appel passe par `runGameplaySync(RaycastService.use(...))`, jamais par
un accès direct à `physics.world.castRay(...)` — ce contrat garde la
frontière synchrone stricte visible à la lecture (invariant #11).

## Pièges

**Broad-phase vide juste après la création d'un collider.** Rapier ne range
un collider neuf dans la structure qui sert aux requêtes qu'au moment d'un
`world.step()`. Un collider tout juste créé est invisible à `castRay`/
`castRayAndGetNormal`/`intersectionsWithShape`/`castShape` tant qu'aucun pas
n'a eu lieu — Rapier 0.20 n'offre aucune autre façon de rafraîchir cette
structure. De M4 (2026-09-03) au 2026-09-11, `loadGltfLevel` bakait le graphe
de navigation juste après avoir créé les colliders du niveau, et **le graphe
sortait vide dans tous les niveaux** : 0 cellule praticable, les ennemis
retombaient toujours sur l'évitement local. Même cause pour les premiers
rayons de ligne de vue ennemie ([ADR 0022](../decisions/0022-occlusion-rangees-non-bloquante.md),
remplacé par [ADR 0025](../decisions/0025-occlusion-lignes-de-vue-cause-racine.md)
une fois la cause confirmée) : posés derrière une rangée, des ennemis se
réveillaient quand même à travers elle. `PhysicsWorld.refreshSceneQueries()`
force un pas de durée nulle (rien n'est simulé, le `timestep` est restauré
juste après) — appelé une fois par `spawning.ts` avant le bake, sans entamer
l'invariant #1. Tout futur code qui interroge le monde juste après avoir créé
des colliders doit passer par cette méthode.

**Un collider de plafond pris pour le sol.** Un plafond n'a jamais de
collider — le bake du graphe de navigation prendrait la face du dessous pour
un sol praticable. C'est pour ça qu'une verrière incassable (`vitre_*` avec
`solide: false`) n'a délibérément aucun collider, plutôt que d'en avoir un
neutralisé autrement.

**Un prop en `WORLD` fausserait la vision et la navigation.** Détaillé dans
Données et contrats ci-dessus : c'est la raison même du groupe `PROP` séparé.

**Ghost collisions trimesh.** Un trimesh est numériquement moins stable qu'un
cuboid — sensible aux triangles longs et fins et sujet à des collisions
fantômes sur les arêtes internes entre triangles adjacents. C'est pourquoi le
loader préfère systématiquement un cuboid ou un convex hull dès qu'un mesh s'y
prête, et ne tombe sur trimesh qu'en dernier recours
([ADR 0004](../decisions/0004-colliders-cuboid.md)).

## Tests

- `test/physics/raycast.test.ts` — `RaycastService` contre un vrai monde
  Rapier, et sa Layer scriptée (`RaycastService.test`).
- `test/game/level/pathfinding.test.ts` — bake du graphe de navigation,
  Layer scriptée, et une section dédiée à `PhysicsWorld.refreshSceneQueries`
  (colliders neufs visibles au bake).
- `test/game/entities/lineOfSight.test.ts` — occlusion de la ligne de vue
  ennemie (pièces du kit isolées et vrai niveau exporté), et une section
  dédiée à `refreshSceneQueries` pour le rayon de ligne de vue.
- `test/game/level/props.test.ts` — chargement d'un `prop_*`, tir/poussée/
  destruction, interpolation du rendu.
- `test/game/level/doors.test.ts` — géométrie et progression d'un `door_*`,
  collider actif seulement fermé, portes manœuvrables à la main et auto.
- `test/game/level/vitres.test.ts`, `test/game/session/sanitaires.test.ts` —
  colliders et rayon de visée des vitres et sanitaires.
- `test/game/level/loader.test.ts` — les sept cas de dégradation du loader
  (géométrie manquante, hull dégénéré, etc.).

## Comment vérifier que ça marche

- `pnpm test -- raycast pathfinding lineOfSight props doors` pour la
  couverture ci-dessus.
- Console `cassandre.doors()` : inspecte les `DoorInfo` réels (position,
  `halfExtents`, groupe) du niveau chargé.
- Touche `V` (`src/render/debugView.ts`) : bascule le wireframe pour voir la
  géométrie de rendu par-dessus les colliders.
- Touche `B` (`src/render/ballisticsDebug.ts`) : affiche les gizmos des
  rayons de tir réellement lancés, utile pour confirmer qu'un `PLAYER_SHOT`
  s'arrête bien où le groupe de collision le prévoit.
