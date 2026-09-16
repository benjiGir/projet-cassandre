/**
 * Jalon M5 (PLAN_EFFECT_XSTATE.md) — tests de CARACTÉRISATION de `Suit`
 * (`src/game/entities/suit.ts`), écrits contre le code ACTUEL, NON modifié.
 * Ce fichier est le filet de sécurité du futur refactor XState : chaque
 * assertion ci-dessous doit rester vraie, à l'identique, une fois la machine
 * à états extraite dans `enemyMachine.ts` — c'est la preuve de non-régression
 * qui remplace le playtest impossible dans cet environnement (pas d'outil
 * navigateur).
 *
 * `suit.ts`/`director.ts`/`suitManager.ts`/`directorManager.ts` sont
 * LECTURE SEULE pour cette tâche — rien ici ne les modifie.
 *
 * ## Piloter `Suit` sans construire de vrai monde Rapier ni de vraie
 * géométrie de niveau — la difficulté principale de ce fichier
 *
 * `Suit` appelle `runGameplaySync(RaycastService.use(...))`/
 * `runGameplaySync(PathfindingService.use(...))` en interne
 * (`hasClearWorldPath`, `castAvoidanceRay`, `resolveAttack`,
 * `tryComputeChaseDirectionFromPath`), TOUJOURS via le `GameRuntime` réel
 * exporté par `core/runtime.ts` (`ManagedRuntime.make(GameLayer)`, construit
 * UNE SEULE FOIS à l'import de ce module, jamais recréé — voir sa doc).
 * Comme `suit.ts` est figé pour cette tâche, on ne peut pas lui faire
 * recevoir un Effect déjà `Effect.provide`-é avec une Layer de test : le
 * point d'injection (`RaycastService.use`/`PathfindingService.use`) est
 * entièrement à l'intérieur du fichier gelé.
 *
 * Solution retenue : `Context.Service.of` est l'IDENTITÉ (vérifié dans
 * `node_modules/effect/src/Context.ts` : `of<Service>(self) { return self }`)
 * — l'objet passé à `RaycastService.of({...})` dans `RaycastService.layer`
 * (`src/physics/raycast.ts`) est donc le MÊME objet, par référence, que
 * celui enregistré dans `GameLayer`/`GameRuntime`, du premier import à la fin
 * du process. On récupère cette instance UNIQUE via
 * `GameRuntime.runSync(RaycastService)` (le tag EST un `Effect` qui se
 * résout lui-même depuis le contexte ambiant), puis on réécrit ses méthodes
 * par `Object.assign` avec la forme produite par `RaycastService.test(overrides)`
 * — LA MÊME fabrique de Layer scriptée que M3/M4, seulement matérialisée en
 * objet brut ici pour pouvoir la poser sur le singleton figé plutôt que de la
 * fournir via `Effect.provide` (impossible depuis l'extérieur d'un
 * `runGameplaySync` déjà fermé sur `GameRuntime`). `beforeEach` réinitialise
 * aux défauts ("rien touché" / "findPath échoue toujours") avant chaque test
 * pour qu'aucun état script d'un test ne fuite vers le suivant (les deux
 * services sont des singletons PARTAGÉS par tous les `it()` de ce fichier,
 * vitest isolant les modules par FICHIER de test, pas par test individuel).
 */
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { Effect } from "effect";
import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest";

import { GameRuntime } from "../../../src/core/runtime";
import { RaycastService, type RaycastServiceShape } from "../../../src/physics/raycast";
import {
  PathfindingService,
  type PathfindingServiceShape,
  EMPTY_NAV_GRAPH,
} from "../../../src/game/level/pathfinding";
import { GROUP, initPhysics, PhysicsWorld } from "../../../src/physics/world";
import {
  Suit,
  configureSuitCharacterController,
  DEATH_FRAME_COUNT,
  type SuitState,
  type SuitUpdateContext,
} from "../../../src/game/entities/suit";
import { suitConfig, type SuitConfig } from "../../../src/game/entities/suitConfig";
import { setNotarget } from "../../../src/game/devtools/cheats";

await initPhysics();

// ---------------------------------------------------------------------------
// Contrôle des services Effect internes — voir la doc de tête du fichier.
// ---------------------------------------------------------------------------

const liveRaycast: RaycastServiceShape = GameRuntime.runSync(RaycastService);
const livePathfinding: PathfindingServiceShape = GameRuntime.runSync(PathfindingService);

function scriptRaycast(overrides: Partial<RaycastServiceShape> = {}) {
  const shape = Effect.runSync(Effect.provide(RaycastService, RaycastService.test(overrides)));
  Object.assign(liveRaycast, shape);
}

function scriptPathfinding(overrides: Partial<PathfindingServiceShape> = {}) {
  const shape = Effect.runSync(Effect.provide(PathfindingService, PathfindingService.test(overrides)));
  Object.assign(livePathfinding, shape);
}

beforeEach(() => {
  scriptRaycast();
  scriptPathfinding();
});

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

/** Pas fixe de référence pour ces tests — même granularité que la boucle réelle (invariant #1), mais rien n'oblige `Suit.update` à recevoir exactement cette valeur (elle prend `dt` en paramètre). */
const DT = 1 / 60;

function membershipCollider(bit: number): RAPIER.Collider {
  return { collisionGroups: () => (bit << 16) >>> 0 } as unknown as RAPIER.Collider;
}
const WORLD_COLLIDER = membershipCollider(GROUP.WORLD);
const PLAYER_COLLIDER = membershipCollider(GROUP.PLAYER);

/** Un hit `castRay`/`castRayAndGetNormal` générique — son contenu n'est JAMAIS lu par `hasClearWorldPath`/`castAvoidanceRay` (seul `hit === null` compte), seule sa non-nullité importe pour ces deux call sites. */
const BLOCKED_HIT = {} as RAPIER.RayColliderHit;

/**
 * Ne laisse passer (renvoie `null`, "rien touché") QUE les rayons dont la
 * direction horizontale (X/Z) correspond à `clearDir` — tout le reste est
 * "bloqué" (renvoie `BLOCKED_HIT`). Utilisé pour distinguer sans ambiguïté
 * le rayon direct des deux rayons latéraux (±30°) de
 * `Suit.computeAvoidedDirection`, quel que soit l'ordre dans lequel ils sont
 * testés en interne.
 */
function onlyClearDirection(clearDir: THREE.Vector3, eps = 1e-3) {
  return (_physics: PhysicsWorld, ray: RAPIER.Ray) =>
    Effect.succeed(
      Math.abs(ray.dir.x - clearDir.x) < eps && Math.abs(ray.dir.z - clearDir.z) < eps ? null : BLOCKED_HIT,
    );
}

/** Fabrique un rig complet (`Suit` + `PhysicsWorld` réel vide + `KinematicCharacterController` réel + `SuitUpdateContext` par défaut) — AUCUNE géométrie de niveau, tous les raycasts passent par les singletons scriptés ci-dessus. */
function createRig(cfg: SuitConfig = suitConfig, seed = 1) {
  const physics = new PhysicsWorld();
  const suit = new Suit(physics, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1), seed, cfg);
  // Piège Rapier déjà documenté en M3/M4 (`raycast.test.ts`/`pathfinding.test.ts`) :
  // un monde tout juste construit ne peuple sa broad-phase qu'après un `step()`.
  // Ici les raycasts sont tous scriptés (jamais réellement dispatchés à Rapier),
  // mais `ctx.kcc.computeColliderMovement` interroge bien le VRAI monde — même
  // précaution reprise par prudence.
  physics.step(0);

  const kcc = physics.world.createCharacterController(cfg.colliderOffset);
  configureSuitCharacterController(kcc, cfg);

  const ctx: SuitUpdateContext = {
    physics,
    kcc,
    playerTargetPosition: new THREE.Vector3(0, 0, 100),
    playerEyePosition: new THREE.Vector3(0, cfg.eyeHeight, 100),
    navGraph: null,
  };

  return { suit, physics, kcc, ctx };
}

const LIVE_STATES = ["idle", "alert", "chase", "attack", "stagger"] as const satisfies ReadonlyArray<SuitState>;

/** Réimplémentation FIDÈLE de `mulberry32` (privée, non exportée par `suit.ts`) — même technique que `test/core/random.test.ts` (M1) : valeur de référence recalculée en exécutant l'algorithme réel, jamais recopiée à la main. */
function referenceMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Réimplémentation FIDÈLE de `Suit.applyAimJitter` + du calcul du point d'impact de `resolveAttack` — même séquence d'opérations THREE.js, dans le même ordre, pour obtenir une valeur de référence indépendante du code testé. */
function computeExpectedHitPoint(
  seed: number,
  aimJitterDeg: number,
  eye: THREE.Vector3,
  targetEye: THREE.Vector3,
  timeOfImpact: number,
): THREE.Vector3 {
  const rnd = referenceMulberry32(seed);
  const dir = new THREE.Vector3().subVectors(targetEye, eye).normalize();
  const jitterYaw = (rnd() * 2 - 1) * THREE.MathUtils.degToRad(aimJitterDeg);
  const jitterPitch = (rnd() * 2 - 1) * THREE.MathUtils.degToRad(aimJitterDeg);
  const upHint = Math.abs(dir.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(upHint, dir).normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();
  const jittered = dir
    .clone()
    .addScaledVector(right, Math.tan(jitterYaw))
    .addScaledVector(up, Math.tan(jitterPitch))
    .normalize();
  return eye.clone().addScaledVector(jittered, timeOfImpact);
}

function assertVectorApprox(actual: THREE.Vector3, expected: THREE.Vector3, eps = 1e-9, label = "") {
  assert.approximately(actual.x, expected.x, eps, `${label} x`);
  assert.approximately(actual.y, expected.y, eps, `${label} y`);
  assert.approximately(actual.z, expected.z, eps, `${label} z`);
}

// ---------------------------------------------------------------------------
// 1. Table de transition complète
// ---------------------------------------------------------------------------

describe("Suit — table de transition (jalon M5, caractérisation)", () => {
  it("idle -> alert : ligne de vue dégagée + distance < sightRange", () => {
    const { suit, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 10); // < sightRange (22)
    ctx.playerEyePosition.set(0, suitConfig.eyeHeight, 10);
    scriptRaycast(); // défaut : rien touché, LOS dégagée.

    suit.update(DT, ctx);

    assert.strictEqual(suit.state, "alert");
    assert.strictEqual(suit.stateTimer, 0);
    assert.isTrue(suit.pendingAlert);
  });

  it("idle reste idle : distance > sightRange (LOS non revérifiée)", () => {
    const { suit, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 30); // > sightRange (22)
    scriptRaycast(); // LOS dégagée malgré tout — ne doit pas suffire.

    suit.update(DT, ctx);

    assert.strictEqual(suit.state, "idle");
    assert.isFalse(suit.pendingAlert);
  });

  it("idle reste idle : distance < sightRange mais ligne de vue bloquée", () => {
    const { suit, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 10);
    scriptRaycast({ castRay: () => Effect.succeed(BLOCKED_HIT) });

    suit.update(DT, ctx);

    assert.strictEqual(suit.state, "idle");
    assert.isFalse(suit.pendingAlert);
  });

  it("alert -> chase : inconditionnel après alertDuration, SANS revérifier la ligne de vue", () => {
    const { suit, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 10);
    scriptRaycast(); // entrée en alert : LOS dégagée.
    suit.update(DT, ctx);
    assert.strictEqual(suit.state, "alert");

    // Pendant TOUTE la fenêtre d'alerte, la ligne de vue est BLOQUÉE — la
    // transition doit quand même avoir lieu (décision documentée dans
    // `suit.ts::runAlert`).
    scriptRaycast({ castRay: () => Effect.succeed(BLOCKED_HIT) });

    const step = 0.05;
    const stepsBeforeThreshold = Math.floor((suitConfig.alertDuration - step) / step); // reste nettement AVANT le seuil.
    for (let i = 0; i < stepsBeforeThreshold; i++) {
      suit.update(step, ctx);
      assert.strictEqual(suit.state, "alert", `ne doit pas basculer avant alertDuration (étape ${i})`);
    }

    // Franchit le seuil (les étapes ci-dessus se sont arrêtées strictement en
    // dessous) : quelques pas supplémentaires suffisent à le dépasser.
    for (let i = 0; i < 5; i++) suit.update(step, ctx);

    assert.strictEqual(suit.state, "chase");
  });

  it("chase -> attack : en vue + distance <= attackRange + cooldown écoulé", () => {
    const { suit, ctx } = createRig();
    suit.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 10); // < attackRange (16)
    ctx.playerEyePosition.set(0, suitConfig.eyeHeight, 10);
    scriptRaycast(); // LOS dégagée.

    suit.update(DT, ctx);

    assert.strictEqual(suit.state, "attack");
    assert.strictEqual(suit.stateTimer, 0);
    assert.isTrue(suit.pendingTelegraph);
  });

  it("chase reste chase : hors de portée d'attaque", () => {
    const { suit, ctx } = createRig();
    suit.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 20); // > attackRange (16), toujours < sightRange (22).
    scriptRaycast();

    suit.update(DT, ctx);

    assert.strictEqual(suit.state, "chase");
  });

  it("chase reste chase : cooldown d'attaque non écoulé", () => {
    const { suit, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 10);
    ctx.playerEyePosition.set(0, suitConfig.eyeHeight, 10);
    scriptRaycast();

    // Fait résoudre une première attaque réelle pour armer le cooldown
    // (`attackCooldownRemaining = attackCooldown` dans `runAttack`).
    suit.state = "attack";
    suit.stateTimer = suitConfig.attackTelegraphDuration;
    suit.update(DT, ctx);
    assert.strictEqual(suit.state, "chase", "précondition : l'attaque doit avoir résolu");

    // Toujours en vue, toujours à portée, mais le cooldown vient tout juste
    // d'être armé : ne doit PAS ré-entrer en attack immédiatement.
    suit.update(DT, ctx);

    assert.strictEqual(suit.state, "chase");
  });

  it("chase reste chase : hors de vue (LOS bloquée)", () => {
    const { suit, ctx } = createRig();
    suit.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 10); // à portée...
    scriptRaycast({ castRay: () => Effect.succeed(BLOCKED_HIT) }); // ...mais hors de vue.

    suit.update(DT, ctx);

    assert.strictEqual(suit.state, "chase");
  });

  it("chase -> idle : perte de contact ACCUMULÉE progressivement (lostContactTimeout), pas un seul pas fixe", () => {
    const { suit, ctx } = createRig();
    suit.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 5);
    scriptRaycast({ castRay: () => Effect.succeed(BLOCKED_HIT) }); // jamais en vue, dès le premier pas.

    // ~4.98 s (< lostContactTimeout = 5 s) de contact perdu, en 299 pas fixes
    // distincts : si la perte de contact n'était pas ACCUMULÉE (bug à
    // caractériser explicitement), un seul pas suffirait à faire basculer en
    // idle — ce n'est PAS le cas ici.
    for (let i = 0; i < 299; i++) {
      suit.update(DT, ctx);
      assert.strictEqual(suit.state, "chase", `ne doit pas repasser idle avant lostContactTimeout (pas ${i})`);
    }

    // ~5.98 s au total : le seuil est maintenant clairement dépassé.
    for (let i = 0; i < 60; i++) suit.update(DT, ctx);

    assert.strictEqual(suit.state, "idle");
  });

  it("attack reste TIR (pose tenue) avant attackTelegraphDuration, même à un pas fixe de la limite", () => {
    const { suit, ctx } = createRig();
    suit.state = "attack";
    suit.stateTimer = 0;
    ctx.playerTargetPosition.set(0, 0, 10);
    ctx.playerEyePosition.set(0, suitConfig.eyeHeight, 10);
    scriptRaycast();

    const step = 0.05;
    const stepsBeforeThreshold = Math.floor((suitConfig.attackTelegraphDuration - step) / step);
    for (let i = 0; i < stepsBeforeThreshold; i++) {
      suit.update(step, ctx);
      assert.strictEqual(suit.state, "attack", `pose TIR doit tenir avant attackTelegraphDuration (étape ${i})`);
    }
    // Encore UN pas fixe (de la même taille) sous le seuil, volontairement.
    assert.isBelow(suit.stateTimer, suitConfig.attackTelegraphDuration);
  });

  it("attack -> chase : résolution du tir, cible touchée (pendingAttackDamage/pendingPlayerHitPoint corrects)", () => {
    const { suit, ctx } = createRig();
    const eye = new THREE.Vector3(0, suitConfig.eyeHeight, 0);
    const targetEye = new THREE.Vector3(0, suitConfig.eyeHeight, 10);
    ctx.playerTargetPosition.set(targetEye.x, 0, targetEye.z);
    ctx.playerEyePosition.copy(targetEye);

    const timeOfImpact = 9.5;
    scriptRaycast({
      castRay: () => Effect.succeed(null), // LOS dégagée au moment du tir.
      castRayAndGetNormal: () =>
        Effect.succeed({
          collider: PLAYER_COLLIDER,
          timeOfImpact,
          normal: { x: 0, y: 0, z: -1 },
        } as RAPIER.RayColliderIntersection),
    });

    suit.state = "attack";
    suit.stateTimer = suitConfig.attackTelegraphDuration; // sur le point de résoudre CE pas-ci.
    suit.update(DT, ctx);

    assert.strictEqual(suit.state, "chase");
    assert.strictEqual(suit.pendingAttackDamage, suitConfig.attackDamage);
    assert.approximately(suit.pendingPlayerHitNormal.z, -1, 1e-9);

    const expected = computeExpectedHitPoint(1, suitConfig.aimJitterDeg, eye, targetEye, timeOfImpact);
    assertVectorApprox(suit.pendingPlayerHitPoint, expected, 1e-6, "pendingPlayerHitPoint");
  });

  it("attack -> chase : résolution du tir, raté — un mur est touché en premier", () => {
    const { suit, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 10);
    ctx.playerEyePosition.set(0, suitConfig.eyeHeight, 10);
    scriptRaycast({
      castRay: () => Effect.succeed(null), // LOS dégagée...
      castRayAndGetNormal: () =>
        Effect.succeed({ collider: WORLD_COLLIDER, timeOfImpact: 3, normal: { x: 0, y: 0, z: -1 } } as RAPIER.RayColliderIntersection), // ...mais le jitter fait toucher un mur en premier.
    });

    suit.state = "attack";
    suit.stateTimer = suitConfig.attackTelegraphDuration;
    suit.update(DT, ctx);

    assert.strictEqual(suit.state, "chase"); // la transition a quand même lieu — seuls les dégâts sont annulés.
    assert.strictEqual(suit.pendingAttackDamage, 0);
  });

  it("attack -> chase : résolution du tir, raté — le joueur est sorti du couloir de tir (LOS bloquée au moment de tirer)", () => {
    const { suit, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 10);
    ctx.playerEyePosition.set(0, suitConfig.eyeHeight, 10);
    scriptRaycast({ castRay: () => Effect.succeed(BLOCKED_HIT) }); // resolveAttack s'arrête avant même le jitter.

    suit.state = "attack";
    suit.stateTimer = suitConfig.attackTelegraphDuration;
    suit.update(DT, ctx);

    assert.strictEqual(suit.state, "chase");
    assert.strictEqual(suit.pendingAttackDamage, 0);
  });

  it("stagger -> chase : après staggerDuration, déclenché par applyDamage non-fatal", () => {
    const { suit, physics, ctx } = createRig();

    suit.applyDamage(5, physics, new THREE.Vector3(1, 0, 0));
    assert.strictEqual(suit.state, "stagger");
    assert.strictEqual(suit.stateTimer, 0);

    const step = 0.05;
    const stepsBeforeThreshold = Math.floor((suitConfig.staggerDuration - step) / step);
    for (let i = 0; i < stepsBeforeThreshold; i++) {
      suit.update(step, ctx);
      assert.strictEqual(suit.state, "stagger", `ne doit pas basculer avant staggerDuration (étape ${i})`);
    }
    for (let i = 0; i < 5; i++) suit.update(step, ctx);

    assert.strictEqual(suit.state, "chase");
  });

  it.each(LIVE_STATES)("* -> dead : applyDamage fatal depuis l'état vivant %s", (fromState) => {
    const { suit, physics } = createRig();
    suit.state = fromState;
    suit.stateTimer = 1.23; // valeur non nulle arbitraire, pour prouver qu'elle est bien remise à 0.

    const result = suit.applyDamage(suitConfig.maxHp + 100, physics, new THREE.Vector3(0, 0, 1));

    assert.isTrue(result.died);
    assert.strictEqual(suit.state, "dead");
    assert.strictEqual(suit.stateTimer, 0);
    assert.strictEqual(suit.hp, 0);
    assert.isNull(suit.body);
    assert.isNull(suit.collider);
    assert.strictEqual((suit as unknown as { velocityHorizontal: THREE.Vector3 }).velocityHorizontal.lengthSq(), 0);
    assert.strictEqual((suit as unknown as { knockbackVelocity: THREE.Vector3 }).knockbackVelocity.lengthSq(), 0);
  });

  it("dead -> corpse : après deathFrameDuration * DEATH_FRAME_COUNT, jamais avant", () => {
    const { suit, physics, ctx } = createRig();
    suit.applyDamage(suitConfig.maxHp + 100, physics, new THREE.Vector3(0, 0, 1));
    assert.strictEqual(suit.state, "dead");

    const totalDeathTime = suitConfig.deathFrameDuration * DEATH_FRAME_COUNT;
    const step = 0.1;

    const stepsBeforeThreshold = Math.floor(totalDeathTime / step); // reste strictement sous le total.
    for (let i = 0; i < stepsBeforeThreshold; i++) {
      suit.update(step, ctx);
      assert.strictEqual(suit.state, "dead", `ne doit pas devenir corpse avant deathFrameDuration*DEATH_FRAME_COUNT (étape ${i})`);
    }

    for (let i = 0; i < 3; i++) suit.update(step, ctx); // dépasse nettement le total.

    assert.strictEqual(suit.state, "corpse");
  });

  it("corpse : état terminal, update() ne fait rien même avec un ctx bidon", () => {
    const { suit, physics, ctx } = createRig();
    suit.applyDamage(suitConfig.maxHp + 100, physics, new THREE.Vector3(0, 0, 1));
    const totalDeathTime = suitConfig.deathFrameDuration * DEATH_FRAME_COUNT;
    suit.update(totalDeathTime + 1, ctx);
    assert.strictEqual(suit.state, "corpse");

    const hpBefore = suit.hp;
    const timerBefore = suit.stateTimer;

    assert.doesNotThrow(() => {
      suit.update(DT, null as unknown as SuitUpdateContext);
    });

    assert.strictEqual(suit.state, "corpse");
    assert.strictEqual(suit.hp, hpBefore);
    assert.strictEqual(suit.stateTimer, timerBefore);
  });
});

// ---------------------------------------------------------------------------
// 2. Comportement de poursuite (chase) : pathfinding puis repli sur
//    l'évitement local.
// ---------------------------------------------------------------------------

describe("Suit — poursuite (chase) : pathfinding puis repli sur l'évitement local", () => {
  it("chemin scripté (PathfindingService.test) : la direction pointe vers le PREMIER waypoint, pas vers le joueur", () => {
    const { suit, ctx } = createRig();
    suit.state = "chase";
    // Joueur loin vers +Z (hors d'attackRange, donc pas de transition attack) ;
    // le chemin scripté part vers +X — deux directions nettement distinctes.
    ctx.playerTargetPosition.set(0, 0, 20);
    ctx.playerEyePosition.set(0, suitConfig.eyeHeight, 20);
    ctx.navGraph = EMPTY_NAV_GRAPH; // non-null : déclenche l'appel à PathfindingService.
    scriptRaycast();
    scriptPathfinding({
      findPath: () => Effect.succeed([new THREE.Vector3(5, 0, 0), new THREE.Vector3(10, 0, 0)]),
    });

    suit.update(DT, ctx);

    const velocity = (suit as unknown as { velocityHorizontal: THREE.Vector3 }).velocityHorizontal;
    assert.approximately(velocity.x, suitConfig.chaseSpeed, 1e-6, "direction vers le waypoint (+X)");
    assert.approximately(velocity.z, 0, 1e-6, "PAS vers le joueur (+Z)");
  });

  it("repli (PathfindingService.test() par défaut, findPath échoue) : rayon direct dégagé -> tout droit vers le joueur", () => {
    const { suit, ctx } = createRig();
    suit.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 20);
    ctx.playerEyePosition.set(0, suitConfig.eyeHeight, 20);
    ctx.navGraph = EMPTY_NAV_GRAPH; // pathfinding tenté, échoue (défaut de PathfindingService.test()), repli attendu.
    scriptRaycast(); // tous les rayons dégagés.

    suit.update(DT, ctx);

    const velocity = (suit as unknown as { velocityHorizontal: THREE.Vector3 }).velocityHorizontal;
    assert.approximately(velocity.x, 0, 1e-6);
    assert.approximately(velocity.z, suitConfig.chaseSpeed, 1e-6);
  });

  it("repli : rayon direct bloqué + rayon gauche (+30°) dégagé -> dévie à gauche", () => {
    const { suit, ctx } = createRig();
    suit.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 20);
    ctx.playerEyePosition.set(0, suitConfig.eyeHeight, 20);
    ctx.navGraph = EMPTY_NAV_GRAPH;

    const angleRad = THREE.MathUtils.degToRad(suitConfig.avoidanceSideAngleDeg);
    const leftDir = new THREE.Vector3(Math.sin(angleRad), 0, Math.cos(angleRad)); // même formule que `rotateHorizontal(desiredDir=(0,0,1), +angleRad)`.
    scriptRaycast({ castRay: onlyClearDirection(leftDir) });

    suit.update(DT, ctx);

    const velocity = (suit as unknown as { velocityHorizontal: THREE.Vector3 }).velocityHorizontal;
    assert.approximately(velocity.x, leftDir.x * suitConfig.chaseSpeed, 1e-6);
    assert.approximately(velocity.z, leftDir.z * suitConfig.chaseSpeed, 1e-6);
  });

  it("repli : les trois rayons (direct, gauche, droite) bloqués -> velocityHorizontal reste nul", () => {
    const { suit, ctx } = createRig();
    suit.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 20);
    ctx.playerEyePosition.set(0, suitConfig.eyeHeight, 20);
    ctx.navGraph = EMPTY_NAV_GRAPH;
    scriptRaycast({ castRay: () => Effect.succeed(BLOCKED_HIT) });

    suit.update(DT, ctx);

    const velocity = (suit as unknown as { velocityHorizontal: THREE.Vector3 }).velocityHorizontal;
    assert.strictEqual(velocity.lengthSq(), 0);
  });
});

// ---------------------------------------------------------------------------
// 3. applyDamage appelé DIRECTEMENT (hors update()), comme le fait
//    SuitManager en production.
// ---------------------------------------------------------------------------

describe("Suit — applyDamage() appelé directement (hors update())", () => {
  it("dégâts non-fatals -> stagger + knockback non nul dans la direction fournie", () => {
    const { suit, physics } = createRig();
    const dir = new THREE.Vector3(1, 0, 0);

    const result = suit.applyDamage(5, physics, dir);

    assert.isFalse(result.died);
    assert.strictEqual(suit.state, "stagger");
    assert.strictEqual(suit.stateTimer, 0);
    const knockback = (suit as unknown as { knockbackVelocity: THREE.Vector3 }).knockbackVelocity;
    assert.approximately(knockback.x, suitConfig.knockbackSpeed, 1e-9);
    assert.approximately(knockback.y, suitConfig.knockbackUpBoost, 1e-9);
    assert.approximately(knockback.z, 0, 1e-9);
  });

  it("dégâts fatals -> dead", () => {
    const { suit, physics } = createRig();
    const result = suit.applyDamage(suitConfig.maxHp + 1, physics, new THREE.Vector3(0, 0, 1));

    assert.isTrue(result.died);
    assert.strictEqual(suit.state, "dead");
  });

  it("sur une entité déjà dead : aucun effet (garde-fou), { died: false }", () => {
    const { suit, physics } = createRig();
    suit.applyDamage(suitConfig.maxHp + 100, physics, new THREE.Vector3(0, 0, 1));
    assert.strictEqual(suit.state, "dead");
    const hpAfterDeath = suit.hp;

    const result = suit.applyDamage(50, physics, new THREE.Vector3(0, 0, 1));

    assert.isFalse(result.died);
    assert.strictEqual(suit.state, "dead");
    assert.strictEqual(suit.hp, hpAfterDeath);
  });

  it("sur une entité déjà corpse : aucun effet (garde-fou), { died: false }", () => {
    const { suit, physics, ctx } = createRig();
    suit.applyDamage(suitConfig.maxHp + 100, physics, new THREE.Vector3(0, 0, 1));
    const totalDeathTime = suitConfig.deathFrameDuration * DEATH_FRAME_COUNT;
    suit.update(totalDeathTime + 1, ctx);
    assert.strictEqual(suit.state, "corpse");

    const result = suit.applyDamage(50, physics, new THREE.Vector3(0, 0, 1));

    assert.isFalse(result.died);
    assert.strictEqual(suit.state, "corpse");
  });
});

// ---------------------------------------------------------------------------
// 5. Jitter de visée déterministe (PRNG mulberry32 propre à l'entité).
// ---------------------------------------------------------------------------

describe("Suit — jitter de visée déterministe (PRNG mulberry32 propre à l'entité)", () => {
  it("même seed -> même point d'impact, reproductible et conforme à un calcul de référence indépendant", () => {
    const seed = 424242;
    const eye = new THREE.Vector3(0, suitConfig.eyeHeight, 0);
    const targetEye = new THREE.Vector3(0, suitConfig.eyeHeight, 10);
    const timeOfImpact = 9.5;

    scriptRaycast({
      castRay: () => Effect.succeed(null),
      castRayAndGetNormal: () =>
        Effect.succeed({
          collider: PLAYER_COLLIDER,
          timeOfImpact,
          normal: { x: 0, y: 0, z: -1 },
        } as RAPIER.RayColliderIntersection),
    });

    function resolveOnce(): THREE.Vector3 {
      const { suit, ctx } = createRig(suitConfig, seed);
      ctx.playerTargetPosition.set(targetEye.x, 0, targetEye.z);
      ctx.playerEyePosition.copy(targetEye);
      suit.state = "attack";
      suit.stateTimer = suitConfig.attackTelegraphDuration;
      suit.update(DT, ctx);
      return suit.pendingPlayerHitPoint.clone();
    }

    const first = resolveOnce();
    const second = resolveOnce(); // instance INDÉPENDANTE, même seed.

    const expected = computeExpectedHitPoint(seed, suitConfig.aimJitterDeg, eye, targetEye, timeOfImpact);
    assertVectorApprox(first, expected, 1e-6, "premier tir vs référence");
    assertVectorApprox(second, expected, 1e-6, "second tir vs référence");
    assertVectorApprox(first, second, 1e-12, "même seed -> même résultat, deux instances indépendantes");
  });
});

// ---------------------------------------------------------------------------
// Bascule de dev `notarget` (game/devtools/cheats.ts)
// ---------------------------------------------------------------------------

describe("Suit sous notarget — la bascule de dev qui rend les ennemis passifs", () => {
  afterEach(() => {
    // `cheats` est un singleton de module, partagé par tous les `it()` de ce
    // fichier : le laisser actif contaminerait les tests suivants.
    setNotarget(false);
  });

  it("idle ne bascule jamais en alerte, même à portée et à vue", () => {
    const { suit, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 10); // < sightRange, LOS dégagée : alerte sans notarget
    ctx.playerEyePosition.set(0, suitConfig.eyeHeight, 10);
    scriptRaycast();
    setNotarget(true);

    suit.update(DT, ctx);

    assert.strictEqual(suit.state, "idle");
    assert.isFalse(suit.pendingAlert);
  });

  it("un Costard déjà lancé perd le contact IMMÉDIATEMENT, sans attendre lostContactTimeout", () => {
    const { suit, ctx } = createRig();
    suit.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 10);
    ctx.playerEyePosition.set(0, suitConfig.eyeHeight, 10);
    scriptRaycast();
    setNotarget(true);

    suit.update(DT, ctx);

    assert.strictEqual(suit.state, "idle");
  });

  it("une pose de tir déjà engagée se résout sans le moindre dégât", () => {
    const { suit, ctx } = createRig();
    const targetEye = new THREE.Vector3(0, suitConfig.eyeHeight, 10);
    ctx.playerTargetPosition.set(targetEye.x, 0, targetEye.z);
    ctx.playerEyePosition.copy(targetEye);
    scriptRaycast({
      castRay: () => Effect.succeed(null),
      castRayAndGetNormal: () =>
        Effect.succeed({
          collider: PLAYER_COLLIDER,
          timeOfImpact: 9.5,
          normal: { x: 0, y: 0, z: -1 },
        } as RAPIER.RayColliderIntersection),
    });
    setNotarget(true);

    suit.state = "attack";
    suit.stateTimer = suitConfig.attackTelegraphDuration; // résout CE pas-ci
    suit.update(DT, ctx);

    assert.strictEqual(suit.pendingAttackDamage, 0);
  });
});
