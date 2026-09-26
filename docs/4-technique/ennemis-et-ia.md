---
title: Ennemis et IA
tags: [technique]
status: stable
updated: 2026-09-26
---

# Ennemis et IA

## Responsabilité

Fait : porte le comportement de combat de Costard et Directeur — perception
(ligne de vue, portée), poursuite (pathfinding 2.5D + évitement local),
télégraphie et résolution d'une attaque hitscan, recul, mort — via une seule
machine XState **partagée** entre les deux types
([ADR 0009](../decisions/0009-machine-partagee-suit-director.md)). Intègre
aussi leur propre corps Rapier (`KinematicCharacterController`, invariant
#6) : c'est ce fichier, pas `physics/`, qui construit et pilote le
personnage ennemi. Fournit le spawn depuis les Empties `spawn_suit_*`/
`spawn_director_*` du niveau.

Ne fait pas : ne construit pas le graphe de navigation ni ne décide de son
`MAX_STEP_HEIGHT` ([Pathfinding](pathfinding.md)) — se contente de
l'interroger. Ne dessine rien (sprites, gibs, flash, screenshake : au taux
d'affichage, `src/game/loop/updateFx.ts` + `src/render/`). N'applique pas
lui-même les dégâts au joueur — il produit un `pendingAttackDamage`, c'est
`updateGameplay.ts` qui appelle `applyPlayerDamage` ([Joueur](joueur.md)).
Ne connaît aucune arme du joueur au-delà du contrat `HitEvent` qu'il consomme
en entrée (D28).

## Fichiers

- `src/game/entities/entity.ts` — contrat minimal `Entity` partagé par toute
  entité de jeu ; squelettique par choix (invariant #8, pas d'ECS avant 12
  types d'ennemis).
- `src/game/entities/enemyMachine.ts` — la machine partagée : contexte,
  table de transition, perception, évitement, suivi de chemin, résolution
  d'attaque, intégration physique, `tickEnemy`. Fichier central de cette page.
- `src/game/entities/suit.ts` / `suitConfig.ts` / `suitManager.ts` — le
  Costard : fin wrapper Rapier + config + PRNG + acteur ; `SuitManager`
  pilote `Suit[]`, un seul KCC partagé, les files d'évènements par frame.
- `src/game/entities/director.ts` / `directorConfig.ts` / `directorManager.ts`
  — le Directeur : même schéma, plus la révélation (`revealed`), la carte
  Platine lâchée à la mort (`DroppedCard`) et son délai de ramassage.
- `src/game/session/spawning.ts` — `spawnSuitAt`/`spawnDirectorAt`, appelées
  depuis les Empties `spawn_suit_*`/`spawn_director_*`, et
  `refreshSceneQueries()` avant le bake du graphe de navigation.
- `src/game/loop/updateGameplay.ts` — appelle les deux managers après
  `weapons.update`, applique les dégâts reçus par le joueur, appelle
  `directorManager.tryCollectCard`.
- `src/game/loop/updateFx.ts` — lit les files d'évènements et déclenche
  sprite/son/fx ; vide les files en tout dernier (`clearFrameEvents()`).
- `src/render/fx.ts` — `spawnGibs`, infrastructure partagée avec les débris
  de `prop_*`.
- `src/core/random.ts` — `DeterministicRandom`, seule source du PRNG par
  entité (invariant #12).

## Où ça s'insère dans la boucle

Ordre complet du pas fixe : [Boucle et temps](../3-architecture/boucle-et-temps.md).
Pour les ennemis, dans `updateGameplay.ts`, **après** `weapons.update` (les
`hitEvents` du pas courant doivent déjà exister) :

1. `suitManager.update(gameplayDt, playerTargetPosition, playerEyePosition,
   weapons.hitEvents, navGraph, vitreSystem, sanitaireSystem)` — agrège les
   nouveaux `hitEvents` par Costard touché (voir Données et contrats),
   applique les dégâts groupés, puis avance d'un pas chaque Costard non
   touché ce pas-ci via `tickEnemy`.
2. Les `playerHitEvents` produits sont immédiatement consommés :
   `applyPlayerDamage(engine, session, amount)` pour chacun.
3. Même séquence pour `directorManager.update(...)`, puis
   `directorManager.tryCollectCard(session.player.position)`.

`snapshotPrevious()` (sur chaque manager) s'exécute avant `stepPhysics`,
comme le joueur ; au taux d'affichage, `interpolatedPosition(alpha)`/
`interpolatedForward(alpha)` alimentent le billboard — jamais une position
brute du pas fixe. Le chargement de niveau (spawn initial) est hors pas
fixe : `spawning.ts::loadGltfLevel` appelle `refreshSceneQueries()` puis
bake le graphe de navigation avant de spawner le premier Costard/Directeur
(voir Pièges).

## Données et contrats

**`EnemyMachineContext`** (`enemyMachine.ts`) porte tout ce qu'une entité vit,
hors id/rendu. Deux catégories de champs à distinguer à la lecture :

- **Minuteurs d'état**, remis à zéro à chaque transition par l'action
  correspondante : `stateTimer` (temps dans l'état courant). Comparé à une
  durée de `cfg` (`alertDuration`, `attackTelegraphDuration`,
  `staggerDuration`, `deathFrameDuration × deathFrameCount`) dans `runAlert`/
  `runAttack`/`runStagger`/`tickEnemy` pour déclencher la transition suivante.
- **Mémoire persistante**, qui traverse les transitions : `timeSinceLastSeen`
  (contact visuel), `attackCooldownRemaining` (décrémenté chaque pas,
  indépendant de l'état). Les drapeaux `pendingAlert`/`pendingTelegraph`/
  `pendingAttackDamage` sont remis à `false`/`0` en tête de chaque
  `tickEnemy`, positionnés au plus une fois par pas par `runIdle`/`runAttack`,
  et lus par le manager juste après (`drainSuitPendingEvents`/
  `drainDirectorPendingEvents`) — jamais relus au pas suivant.
- **Horloges d'animation**, avancées au pas fixe et **lues par le rendu
  seul** — aucune décision de `tickEnemy` ne les consulte : `animClock`
  (secondes de gameplay depuis l'apparition), `strideDistance` (mètres
  parcourus, fait défiler la pose de course), `timeSinceShot` (secondes
  depuis le dernier tir réellement parti, pilote l'éclair de tir du sprite).

**`tickEnemy(actor, dt, updateCtx)` — un pas fixe, étape par étape** : purge
les drapeaux `pending*`, avance `animClock`/`timeSinceShot`, retourne tôt si
`corpse` (rien à faire) ou `dead` (seul `stateTimer` avance, vers
`DEATH_ANIM_DONE`) ; sinon décroît le knockback et le cooldown d'attaque,
recalcule la direction/distance horizontale vers le joueur, appelle la
fonction `run<État>` correspondante (`runIdle`/`runAlert`/`runChase`/
`runAttack`/`runStagger`), puis `integratePhysics` intègre gravité +
déplacement voulu + knockback via le `KinematicCharacterController`
**partagé** (une seule instance par manager, `updateCtx.kcc`). Sept états,
table de transition et évènements déjà posés dans
[Effect et XState](../3-architecture/effect-et-xstate.md#costard-et-directeur)
— pas redessinés ici. `tickEnemy` est un **appel de fonction direct**, pas
un évènement `TICK` (écart ancienne doc/ex-invariant #13, déjà tranché).
Aucune transition n'utilise `guard:` de `setup()` : les conditions (portée,
ligne de vue, cooldown) sont évaluées dans les fonctions `run<État>`
elles-mêmes, avant l'envoi de l'évènement — testables sans acteur XState
instancié. Discipline zéro allocation : tous les scratch (`scratchRay`,
`scratchToPlayer`, `scratchAimDir`…) sont créés une fois par
`createEnemyMachineContext`, jamais réalloués dans `tickEnemy`.

**Vision** (`hasClearWorldPath`) : un raycast Rapier entre deux yeux
(`computeEyePosition`, dérivée de `eyeHeight`), filtré
`WORLD_ONLY_RAY_GROUPS` (membership `ENEMY`, filtre `WORLD` seul — ne peut
jamais toucher le joueur ni un autre ennemi, voir [Physique](physique.md)).
`runIdle` s'en sert pour `SAW_PLAYER`, `runChase` pour mesurer
`timeSinceLastSeen` et décider `TARGET_IN_RANGE`.

**Télégraphie et tir hitscan.** `attack` correspond à l'état interne
`"aim"` : la pose TIR est tenue `attackTelegraphDuration` (plancher non
négociable du skill `enemy-state-machine`, ≥ 0.2 s) avant que
`resolveAttack` ne tire réellement. `resolveAttack` re-vérifie la ligne de
vue au moment du tir (raté silencieux si le joueur s'est mis à couvert
pendant la télégraphie), applique un jitter de visée seedé par entité
(`applyAimJitter`, jamais `Math.random()`), puis un second raycast (groupe
`ENEMY_SHOT`) décide : rien touché avant `maxDist` → raté ; mur touché en
premier → raté, sauf une vitre ou un sanitaire cassable, qui volent en
éclats (`handleEnemyShotMiss`, [ADR 0031](../decisions/0031-portes-animees-et-vitres.md),
[ADR 0032](../decisions/0032-sanitaires-utilisables.md)) ; joueur touché →
`pendingAttackDamage`/`pendingPlayerHitPoint`/`pendingPlayerHitNormal` posés,
lus et appliqués par `updateGameplay.ts` ce même pas.

**Recul et mort.** Les deux ennemis sont des corps **kinématiques** :
`RAPIER.RigidBody.applyImpulse` n'aurait aucun effet. `HIT_NONFATAL` convertit
`knockbackDirection` (fournie par l'appelant) en `knockbackVelocity`,
décroissante sur `knockbackDecayTime` (`updateKnockback`), intégrée par
`integratePhysics` comme une composante de vélocité de plus. `HIT_FATAL`
détache immédiatement le corps/collider (`detachEnemyPhysics`) : l'entité
n'existe plus pour la physique dès ce pas, seule l'animation continue côté
rendu/`stateTimer` jusqu'à `corpse` (`deathFrameDuration × deathFrameCount`,
6 frames pour les deux types). `applyEnemyDamageCore` fait le garde-fou
`isAlive` + la soustraction de `hp` **avant** d'envoyer quoi que ce soit à
l'acteur — c'est l'appelant (`Suit.applyDamage`/`Director.applyDamage`) qui
choisit l'évènement et, pour le Directeur, lit `hp` juste après pour
calculer `justRevealed` (ordre à préserver : `enterDead` remettrait `hp` à 0
après).

**Ce qui diffère du Costard au Directeur.** `revealed`/`justRevealed`
(costume humain → reptilien sous `revealHpFraction × maxHp`, purement
cosmétique, orthogonal à la machine à états) : `updateFx.ts` bascule l'atlas
du sprite (`sprite.setAtlas(engine.directorSheet.atlases.revele)`, repli sur
une teinte via `Director.tintColor` si la planche manque) et déclenche un
screenshake dédié. `DroppedCard` (`director.ts`, objet de logique pur, sans
`THREE.Object3D`) est ramassée par **proximité seule** (`tryCollectCard`,
pas de `use_*`), gardée par `cardPickupDelay` (0.6 s) pour qu'un kill à bout
portant ne la ramasse pas au pas fixe de sa création. Pas de gibs pour le
Directeur (casserait la mise en scène de révélation).

**Spawn et RNG.** `spawn_suit_*`/`spawn_director_*` (loader.ts) →
`spawnSuitAt`/`spawnDirectorAt` (`spawning.ts`) → `SuitManager.spawnSuit`/
`DirectorManager.spawnDirector`, qui posent le corps Rapier et indexent
`collider.handle → entité` (retiré **immédiatement** à la mort — Rapier peut
recycler un handle de collider supprimé). `createEnemyPrng(seed)` retourne
`runGameplaySync(DeterministicRandom.useSync((r) => r.forSeed(seed)))` — une
instance mulberry32 **par entité**, jamais partagée ni `Math.random()` ;
chaque manager dérive sa graine d'une base fixe (`BASE_SUIT_SEED`/
`BASE_DIRECTOR_SEED`, distinctes) plus `spawnCount × SEED_STRIDE` (pas
impair), jamais `Date.now()`.

**Gibs.** `SuitManager.consumeNewHits` marque un coup `gibs: true` si l'arme
est le pompe et la distance ≤ `SuitConfig.gibDistance` (3 m) ; le
`SuitDeathEvent` porte alors `gibs`/`point`/`direction`, lus par `updateFx.ts`
qui appelle `engine.fx.spawnGibs(point, direction)` **à la place** de
l'animation de mort — côté simulation, l'entité reste `dead`/`corpse`
normalement, seul le rendu change.

## Pièges

**Broad-phase vide au premier bake.** Un ennemi posé juste derrière une
rangée peut se réveiller à travers elle si le graphe/les rayons de vision
sont interrogés avant le premier `world.step()` — cause racine commune au
graphe de navigation vide et à l'occlusion non fiable, détail complet et
garde-fou (`refreshSceneQueries()`) dans [Physique](physique.md#pièges).

**Embuscade en allée droite.** Une allée entre deux rangées de gondoles est
par construction une ligne dégagée d'un bout à l'autre : `hasClearWorldPath`
n'y est jamais coupé, contrairement à un ennemi posé derrière une rangée qui
borde l'allée sans jamais la traverser. Un `spawn_suit_*` posé au milieu
d'une allée est donc déjà en `attack` dès le chargement s'il est sous
`attackRange` — pas un bug de perception, la géométrie ne protège pas.
Corrigé en level design une fois trouvé en jeu
([ADR 0025](../decisions/0025-occlusion-lignes-de-vue-cause-racine.md)) :
poser un spawn hors `attackRange`, jamais compter sur une occlusion qu'une
allée droite ne peut pas fournir.

**`MAX_STEP_HEIGHT` du graphe = marche réelle d'un ennemi.** Le bake du
graphe reprend `suitConfig.autostepMaxHeight` (0,35 m) : changer la marche
d'un ennemi change aussi ce que le graphe juge franchissable. Voir
[Pathfinding](pathfinding.md).

**Précondition de `tickEnemy` : jamais le même pas qu'un coup reçu.**
`SuitManager.update`/`DirectorManager.update` n'appellent pas `entity.update`
pour une entité qui vient d'être touchée ce pas-ci — `applyDamage` a déjà
positionné l'état (stagger/mort). Violer l'ordre ferait tourner la machine
deux fois sur le même pas pour la même entité.

**Curseur d'évènements, pas une comparaison de longueur.** `hitCursor`
avance sur `weapons.hitEvents`, qui peut recevoir plusieurs pas fixes en une
seule frame d'affichage ; il ne retombe à 0 que dans `clearFrameEvents()`,
jamais déduit d'une comparaison de longueur — sinon un impact déjà traité
serait recompté ou un nouveau raté
([ADR 0010](../decisions/0010-curseur-evenements-multi-pas-fixe.md)).

## Tests

- `test/game/entities/suit.test.ts` — machine à états, dégâts, knockback,
  gibs, RNG par entité, intégration physique.
- `test/game/entities/director.test.ts` — mêmes garanties + révélation,
  `justRevealed`, `DroppedCard`/`tryCollectCard`.
- `test/game/entities/lineOfSight.test.ts` — occlusion de ligne de vue
  (pièces du kit isolées et vrai niveau exporté), section dédiée à
  `refreshSceneQueries`.
- `test/game/entities/enemyShotVitre.test.ts` — `handleEnemyShotMiss` (tir
  ennemi qui casse une vitre/un sanitaire plutôt que de rater silencieusement).
- `test/render/enemySprites.test.ts` — sélection d'angle du billboard,
  `readEnemyAnimation`.

`Suit.state`/`Director.state` (setters) réassignent l'état via
`forceEnemyState`, sans vraie transition — réservé à ces tests, jamais au
chemin de production (`tickEnemy`/`applyEnemyDamageCore`).

## Comment vérifier que ça marche

- `pnpm test -- suit director lineOfSight enemyShotVitre enemySprites`.
- Console : `cassandre.suits`/`spawnSuit(x,y,z)`/`killSuit()`/`suitConfig` ;
  `cassandre.directors`/`directorManager`/`spawnDirector(x,y,z)`/
  `killDirector()`/`directorConfig`.
- Touche `B` : gizmos des rayons de tir réellement lancés (raté silencieux,
  jitter). Touche `V` : wireframe, capsule/déplacement réel sous le sprite.

**Ajouter un type d'ennemi** (recette complète prévue en D56) : dupliquer la
forme de `SuitConfig` (jamais l'étendre —
[ADR 0009](../decisions/0009-machine-partagee-suit-director.md)), dupliquer
le fin wrapper `suit.ts`/`suitManager.ts` (la logique de combat reste dans
`enemyMachine.ts`, inchangée), ajouter un préfixe de spawn glTF au loader,
câbler un manager dans `GameSession`, brancher ses évènements dans
`updateFx.ts`, fournir un atlas 8 directions
([ADR 0028](../decisions/0028-sprites-ennemis-pre-rendus.md)), puis mesurer
le budget (20 ennemis actifs à 60 fps, skill `enemy-state-machine`).
