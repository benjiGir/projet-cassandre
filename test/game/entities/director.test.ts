/**
 * Jalon M5 (PLAN_EFFECT_XSTATE.md) — tests de CARACTÉRISATION de `Director`
 * (`src/game/entities/director.ts`), écrits contre le code ACTUEL, NON
 * modifié. Miroir DÉLIBÉRÉMENT DUPLIQUÉ de `test/game/entities/suit.test.ts`
 * (même choix de duplication que celui déjà assumé entre `suit.ts`/
 * `director.ts` eux-mêmes — voir leur doc de tête) : ce fichier ajoute
 * seulement les tests spécifiques au Directeur (`revealed`/`justRevealed`/
 * `tintColor`, section 4 de la tâche) et adapte les valeurs numériques à
 * `directorConfig`.
 *
 * `suit.ts`/`director.ts`/`suitManager.ts`/`directorManager.ts` sont
 * LECTURE SEULE pour cette tâche — rien ici ne les modifie.
 *
 * Voir la doc de tête de `suit.test.ts` pour l'explication complète de la
 * technique utilisée pour scripter `RaycastService`/`PathfindingService`
 * sans pouvoir toucher `director.ts` (qui ferme sur le `GameRuntime` réel,
 * un singleton construit une seule fois par `core/runtime.ts`) : on
 * récupère l'instance UNIQUE de chaque service via
 * `GameRuntime.runSync(XxxService)` (identité garantie par
 * `Context.Service.of`, vérifié dans `node_modules/effect/src/Context.ts`),
 * puis on réécrit ses méthodes par `Object.assign` avec la forme produite
 * par `XxxService.test(overrides)`.
 */
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { Effect } from "effect";
import { assert, beforeEach, describe, it } from "@effect/vitest";

import { GameRuntime } from "../../../src/core/runtime";
import { RaycastService, type RaycastServiceShape } from "../../../src/physics/raycast";
import {
  PathfindingService,
  type PathfindingServiceShape,
  EMPTY_NAV_GRAPH,
} from "../../../src/game/level/pathfinding";
import { GROUP, initPhysics, PhysicsWorld } from "../../../src/physics/world";
import {
  Director,
  configureDirectorCharacterController,
  DIRECTOR_DEATH_FRAME_COUNT,
  type DirectorState,
  type DirectorUpdateContext,
} from "../../../src/game/entities/director";
import { directorConfig, type DirectorConfig } from "../../../src/game/entities/directorConfig";

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

const DT = 1 / 60;

function membershipCollider(bit: number): RAPIER.Collider {
  return { collisionGroups: () => (bit << 16) >>> 0 } as unknown as RAPIER.Collider;
}
const WORLD_COLLIDER = membershipCollider(GROUP.WORLD);
const PLAYER_COLLIDER = membershipCollider(GROUP.PLAYER);

const BLOCKED_HIT = {} as RAPIER.RayColliderHit;

function onlyClearDirection(clearDir: THREE.Vector3, eps = 1e-3) {
  return (_physics: PhysicsWorld, ray: RAPIER.Ray) =>
    Effect.succeed(
      Math.abs(ray.dir.x - clearDir.x) < eps && Math.abs(ray.dir.z - clearDir.z) < eps ? null : BLOCKED_HIT,
    );
}

function createRig(cfg: DirectorConfig = directorConfig, seed = 1) {
  const physics = new PhysicsWorld();
  const director = new Director(physics, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1), seed, cfg);
  physics.step(0); // voir la doc identique dans `suit.test.ts` (piège Rapier M3/M4).

  const kcc = physics.world.createCharacterController(cfg.colliderOffset);
  configureDirectorCharacterController(kcc, cfg);

  const ctx: DirectorUpdateContext = {
    physics,
    kcc,
    playerTargetPosition: new THREE.Vector3(0, 0, 100),
    playerEyePosition: new THREE.Vector3(0, cfg.eyeHeight, 100),
    navGraph: null,
  };

  return { director, physics, kcc, ctx };
}

const LIVE_STATES = ["idle", "alert", "chase", "attack", "stagger"] as const satisfies ReadonlyArray<DirectorState>;

/** Réimplémentation FIDÈLE de `mulberry32` (privée, non exportée par `director.ts`) — voir la doc identique dans `suit.test.ts`. */
function referenceMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Réimplémentation FIDÈLE de `Director.applyAimJitter` + du calcul du point d'impact de `resolveAttack` — voir la doc identique dans `suit.test.ts`. */
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
// 1. Table de transition complète (miroir de suit.test.ts)
// ---------------------------------------------------------------------------

describe("Director — table de transition (jalon M5, caractérisation)", () => {
  it("idle -> alert : ligne de vue dégagée + distance < sightRange", () => {
    const { director, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 10); // < sightRange (22)
    ctx.playerEyePosition.set(0, directorConfig.eyeHeight, 10);
    scriptRaycast();

    director.update(DT, ctx);

    assert.strictEqual(director.state, "alert");
    assert.strictEqual(director.stateTimer, 0);
    assert.isTrue(director.pendingAlert);
  });

  it("idle reste idle : distance > sightRange (LOS non revérifiée)", () => {
    const { director, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 30); // > sightRange (22)
    scriptRaycast();

    director.update(DT, ctx);

    assert.strictEqual(director.state, "idle");
    assert.isFalse(director.pendingAlert);
  });

  it("idle reste idle : distance < sightRange mais ligne de vue bloquée", () => {
    const { director, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 10);
    scriptRaycast({ castRay: () => Effect.succeed(BLOCKED_HIT) });

    director.update(DT, ctx);

    assert.strictEqual(director.state, "idle");
    assert.isFalse(director.pendingAlert);
  });

  it("alert -> chase : inconditionnel après alertDuration, SANS revérifier la ligne de vue", () => {
    const { director, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 10);
    scriptRaycast();
    director.update(DT, ctx);
    assert.strictEqual(director.state, "alert");

    scriptRaycast({ castRay: () => Effect.succeed(BLOCKED_HIT) }); // bloquée pendant toute la fenêtre.

    const step = 0.05;
    const stepsBeforeThreshold = Math.floor((directorConfig.alertDuration - step) / step);
    for (let i = 0; i < stepsBeforeThreshold; i++) {
      director.update(step, ctx);
      assert.strictEqual(director.state, "alert", `ne doit pas basculer avant alertDuration (étape ${i})`);
    }
    for (let i = 0; i < 5; i++) director.update(step, ctx);

    assert.strictEqual(director.state, "chase");
  });

  it("chase -> attack : en vue + distance <= attackRange + cooldown écoulé", () => {
    const { director, ctx } = createRig();
    director.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 10); // < attackRange (14)
    ctx.playerEyePosition.set(0, directorConfig.eyeHeight, 10);
    scriptRaycast();

    director.update(DT, ctx);

    assert.strictEqual(director.state, "attack");
    assert.strictEqual(director.stateTimer, 0);
    assert.isTrue(director.pendingTelegraph);
  });

  it("chase reste chase : hors de portée d'attaque", () => {
    const { director, ctx } = createRig();
    director.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 20); // > attackRange (14), toujours < sightRange (22).
    scriptRaycast();

    director.update(DT, ctx);

    assert.strictEqual(director.state, "chase");
  });

  it("chase reste chase : cooldown d'attaque non écoulé", () => {
    const { director, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 10);
    ctx.playerEyePosition.set(0, directorConfig.eyeHeight, 10);
    scriptRaycast();

    director.state = "attack";
    director.stateTimer = directorConfig.attackTelegraphDuration;
    director.update(DT, ctx);
    assert.strictEqual(director.state, "chase", "précondition : l'attaque doit avoir résolu");

    director.update(DT, ctx);

    assert.strictEqual(director.state, "chase");
  });

  it("chase reste chase : hors de vue (LOS bloquée)", () => {
    const { director, ctx } = createRig();
    director.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 10);
    scriptRaycast({ castRay: () => Effect.succeed(BLOCKED_HIT) });

    director.update(DT, ctx);

    assert.strictEqual(director.state, "chase");
  });

  it("chase -> idle : perte de contact ACCUMULÉE progressivement (lostContactTimeout), pas un seul pas fixe", () => {
    const { director, ctx } = createRig();
    director.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 5);
    scriptRaycast({ castRay: () => Effect.succeed(BLOCKED_HIT) });

    for (let i = 0; i < 299; i++) {
      director.update(DT, ctx);
      assert.strictEqual(director.state, "chase", `ne doit pas repasser idle avant lostContactTimeout (pas ${i})`);
    }
    for (let i = 0; i < 60; i++) director.update(DT, ctx);

    assert.strictEqual(director.state, "idle");
  });

  it("attack reste TIR (pose tenue) avant attackTelegraphDuration, même à un pas fixe de la limite", () => {
    const { director, ctx } = createRig();
    director.state = "attack";
    director.stateTimer = 0;
    ctx.playerTargetPosition.set(0, 0, 10);
    ctx.playerEyePosition.set(0, directorConfig.eyeHeight, 10);
    scriptRaycast();

    const step = 0.05;
    const stepsBeforeThreshold = Math.floor((directorConfig.attackTelegraphDuration - step) / step);
    for (let i = 0; i < stepsBeforeThreshold; i++) {
      director.update(step, ctx);
      assert.strictEqual(director.state, "attack", `pose TIR doit tenir avant attackTelegraphDuration (étape ${i})`);
    }
    assert.isBelow(director.stateTimer, directorConfig.attackTelegraphDuration);
  });

  it("attack -> chase : résolution du tir, cible touchée (pendingAttackDamage/pendingPlayerHitPoint corrects)", () => {
    const { director, ctx } = createRig();
    const eye = new THREE.Vector3(0, directorConfig.eyeHeight, 0);
    const targetEye = new THREE.Vector3(0, directorConfig.eyeHeight, 10);
    ctx.playerTargetPosition.set(targetEye.x, 0, targetEye.z);
    ctx.playerEyePosition.copy(targetEye);

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

    director.state = "attack";
    director.stateTimer = directorConfig.attackTelegraphDuration;
    director.update(DT, ctx);

    assert.strictEqual(director.state, "chase");
    assert.strictEqual(director.pendingAttackDamage, directorConfig.attackDamage);
    assert.approximately(director.pendingPlayerHitNormal.z, -1, 1e-9);

    const expected = computeExpectedHitPoint(1, directorConfig.aimJitterDeg, eye, targetEye, timeOfImpact);
    assertVectorApprox(director.pendingPlayerHitPoint, expected, 1e-6, "pendingPlayerHitPoint");
  });

  it("attack -> chase : résolution du tir, raté — un mur est touché en premier", () => {
    const { director, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 10);
    ctx.playerEyePosition.set(0, directorConfig.eyeHeight, 10);
    scriptRaycast({
      castRay: () => Effect.succeed(null),
      castRayAndGetNormal: () =>
        Effect.succeed({ collider: WORLD_COLLIDER, timeOfImpact: 3, normal: { x: 0, y: 0, z: -1 } } as RAPIER.RayColliderIntersection),
    });

    director.state = "attack";
    director.stateTimer = directorConfig.attackTelegraphDuration;
    director.update(DT, ctx);

    assert.strictEqual(director.state, "chase");
    assert.strictEqual(director.pendingAttackDamage, 0);
  });

  it("attack -> chase : résolution du tir, raté — le joueur est sorti du couloir de tir (LOS bloquée au moment de tirer)", () => {
    const { director, ctx } = createRig();
    ctx.playerTargetPosition.set(0, 0, 10);
    ctx.playerEyePosition.set(0, directorConfig.eyeHeight, 10);
    scriptRaycast({ castRay: () => Effect.succeed(BLOCKED_HIT) });

    director.state = "attack";
    director.stateTimer = directorConfig.attackTelegraphDuration;
    director.update(DT, ctx);

    assert.strictEqual(director.state, "chase");
    assert.strictEqual(director.pendingAttackDamage, 0);
  });

  it("stagger -> chase : après staggerDuration, déclenché par applyDamage non-fatal", () => {
    const { director, physics, ctx } = createRig();

    director.applyDamage(5, physics, new THREE.Vector3(1, 0, 0));
    assert.strictEqual(director.state, "stagger");
    assert.strictEqual(director.stateTimer, 0);

    const step = 0.05;
    const stepsBeforeThreshold = Math.floor((directorConfig.staggerDuration - step) / step);
    for (let i = 0; i < stepsBeforeThreshold; i++) {
      director.update(step, ctx);
      assert.strictEqual(director.state, "stagger", `ne doit pas basculer avant staggerDuration (étape ${i})`);
    }
    for (let i = 0; i < 5; i++) director.update(step, ctx);

    assert.strictEqual(director.state, "chase");
  });

  it.each(LIVE_STATES)("* -> dead : applyDamage fatal depuis l'état vivant %s", (fromState) => {
    const { director, physics } = createRig();
    director.state = fromState;
    director.stateTimer = 1.23;

    const result = director.applyDamage(directorConfig.maxHp + 100, physics, new THREE.Vector3(0, 0, 1));

    assert.isTrue(result.died);
    assert.strictEqual(director.state, "dead");
    assert.strictEqual(director.stateTimer, 0);
    assert.strictEqual(director.hp, 0);
    assert.isNull(director.body);
    assert.isNull(director.collider);
    assert.strictEqual(
      (director as unknown as { velocityHorizontal: THREE.Vector3 }).velocityHorizontal.lengthSq(),
      0,
    );
    assert.strictEqual(
      (director as unknown as { knockbackVelocity: THREE.Vector3 }).knockbackVelocity.lengthSq(),
      0,
    );
  });

  it("dead -> corpse : après deathFrameDuration * DIRECTOR_DEATH_FRAME_COUNT, jamais avant", () => {
    const { director, physics, ctx } = createRig();
    director.applyDamage(directorConfig.maxHp + 100, physics, new THREE.Vector3(0, 0, 1));
    assert.strictEqual(director.state, "dead");

    const totalDeathTime = directorConfig.deathFrameDuration * DIRECTOR_DEATH_FRAME_COUNT;
    const step = 0.1;

    const stepsBeforeThreshold = Math.floor(totalDeathTime / step);
    for (let i = 0; i < stepsBeforeThreshold; i++) {
      director.update(step, ctx);
      assert.strictEqual(
        director.state,
        "dead",
        `ne doit pas devenir corpse avant deathFrameDuration*DIRECTOR_DEATH_FRAME_COUNT (étape ${i})`,
      );
    }
    for (let i = 0; i < 3; i++) director.update(step, ctx);

    assert.strictEqual(director.state, "corpse");
  });

  it("corpse : état terminal, update() ne fait rien même avec un ctx bidon", () => {
    const { director, physics, ctx } = createRig();
    director.applyDamage(directorConfig.maxHp + 100, physics, new THREE.Vector3(0, 0, 1));
    const totalDeathTime = directorConfig.deathFrameDuration * DIRECTOR_DEATH_FRAME_COUNT;
    director.update(totalDeathTime + 1, ctx);
    assert.strictEqual(director.state, "corpse");

    const hpBefore = director.hp;
    const timerBefore = director.stateTimer;

    assert.doesNotThrow(() => {
      director.update(DT, null as unknown as DirectorUpdateContext);
    });

    assert.strictEqual(director.state, "corpse");
    assert.strictEqual(director.hp, hpBefore);
    assert.strictEqual(director.stateTimer, timerBefore);
  });
});

// ---------------------------------------------------------------------------
// 2. Comportement de poursuite (chase) — miroir de suit.test.ts.
// ---------------------------------------------------------------------------

describe("Director — poursuite (chase) : pathfinding puis repli sur l'évitement local", () => {
  it("chemin scripté (PathfindingService.test) : la direction pointe vers le PREMIER waypoint, pas vers le joueur", () => {
    const { director, ctx } = createRig();
    director.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 20);
    ctx.playerEyePosition.set(0, directorConfig.eyeHeight, 20);
    ctx.navGraph = EMPTY_NAV_GRAPH;
    scriptRaycast();
    scriptPathfinding({
      findPath: () => Effect.succeed([new THREE.Vector3(5, 0, 0), new THREE.Vector3(10, 0, 0)]),
    });

    director.update(DT, ctx);

    const velocity = (director as unknown as { velocityHorizontal: THREE.Vector3 }).velocityHorizontal;
    assert.approximately(velocity.x, directorConfig.chaseSpeed, 1e-6, "direction vers le waypoint (+X)");
    assert.approximately(velocity.z, 0, 1e-6, "PAS vers le joueur (+Z)");
  });

  it("repli (PathfindingService.test() par défaut, findPath échoue) : rayon direct dégagé -> tout droit vers le joueur", () => {
    const { director, ctx } = createRig();
    director.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 20);
    ctx.playerEyePosition.set(0, directorConfig.eyeHeight, 20);
    ctx.navGraph = EMPTY_NAV_GRAPH;
    scriptRaycast();

    director.update(DT, ctx);

    const velocity = (director as unknown as { velocityHorizontal: THREE.Vector3 }).velocityHorizontal;
    assert.approximately(velocity.x, 0, 1e-6);
    assert.approximately(velocity.z, directorConfig.chaseSpeed, 1e-6);
  });

  it("repli : rayon direct bloqué + rayon gauche (+30°) dégagé -> dévie à gauche", () => {
    const { director, ctx } = createRig();
    director.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 20);
    ctx.playerEyePosition.set(0, directorConfig.eyeHeight, 20);
    ctx.navGraph = EMPTY_NAV_GRAPH;

    const angleRad = THREE.MathUtils.degToRad(directorConfig.avoidanceSideAngleDeg);
    const leftDir = new THREE.Vector3(Math.sin(angleRad), 0, Math.cos(angleRad));
    scriptRaycast({ castRay: onlyClearDirection(leftDir) });

    director.update(DT, ctx);

    const velocity = (director as unknown as { velocityHorizontal: THREE.Vector3 }).velocityHorizontal;
    assert.approximately(velocity.x, leftDir.x * directorConfig.chaseSpeed, 1e-6);
    assert.approximately(velocity.z, leftDir.z * directorConfig.chaseSpeed, 1e-6);
  });

  it("repli : les trois rayons (direct, gauche, droite) bloqués -> velocityHorizontal reste nul", () => {
    const { director, ctx } = createRig();
    director.state = "chase";
    ctx.playerTargetPosition.set(0, 0, 20);
    ctx.playerEyePosition.set(0, directorConfig.eyeHeight, 20);
    ctx.navGraph = EMPTY_NAV_GRAPH;
    scriptRaycast({ castRay: () => Effect.succeed(BLOCKED_HIT) });

    director.update(DT, ctx);

    const velocity = (director as unknown as { velocityHorizontal: THREE.Vector3 }).velocityHorizontal;
    assert.strictEqual(velocity.lengthSq(), 0);
  });
});

// ---------------------------------------------------------------------------
// 3. applyDamage appelé DIRECTEMENT (hors update()), comme le fait
//    DirectorManager en production.
// ---------------------------------------------------------------------------

describe("Director — applyDamage() appelé directement (hors update())", () => {
  it("dégâts non-fatals (sans franchir le seuil de révélation) -> stagger + knockback non nul, justRevealed=false", () => {
    const { director, physics } = createRig();
    const dir = new THREE.Vector3(1, 0, 0);

    const result = director.applyDamage(5, physics, dir); // 5 << revealHpFraction*maxHp (150).

    assert.isFalse(result.died);
    assert.isFalse(result.justRevealed);
    assert.strictEqual(director.state, "stagger");
    assert.strictEqual(director.stateTimer, 0);
    const knockback = (director as unknown as { knockbackVelocity: THREE.Vector3 }).knockbackVelocity;
    assert.approximately(knockback.x, directorConfig.knockbackSpeed, 1e-9);
    assert.approximately(knockback.y, directorConfig.knockbackUpBoost, 1e-9);
    assert.approximately(knockback.z, 0, 1e-9);
  });

  it("dégâts fatals -> dead", () => {
    const { director, physics } = createRig();
    const result = director.applyDamage(directorConfig.maxHp + 1, physics, new THREE.Vector3(0, 0, 1));

    assert.isTrue(result.died);
    assert.strictEqual(director.state, "dead");
  });

  it("sur une entité déjà dead : aucun effet (garde-fou), { died: false, justRevealed: false }", () => {
    const { director, physics } = createRig();
    director.applyDamage(directorConfig.maxHp + 100, physics, new THREE.Vector3(0, 0, 1));
    assert.strictEqual(director.state, "dead");
    const hpAfterDeath = director.hp;

    const result = director.applyDamage(50, physics, new THREE.Vector3(0, 0, 1));

    assert.isFalse(result.died);
    assert.isFalse(result.justRevealed);
    assert.strictEqual(director.state, "dead");
    assert.strictEqual(director.hp, hpAfterDeath);
  });

  it("sur une entité déjà corpse : aucun effet (garde-fou), { died: false, justRevealed: false }", () => {
    const { director, physics, ctx } = createRig();
    director.applyDamage(directorConfig.maxHp + 100, physics, new THREE.Vector3(0, 0, 1));
    const totalDeathTime = directorConfig.deathFrameDuration * DIRECTOR_DEATH_FRAME_COUNT;
    director.update(totalDeathTime + 1, ctx);
    assert.strictEqual(director.state, "corpse");

    const result = director.applyDamage(50, physics, new THREE.Vector3(0, 0, 1));

    assert.isFalse(result.died);
    assert.isFalse(result.justRevealed);
    assert.strictEqual(director.state, "corpse");
  });
});

// ---------------------------------------------------------------------------
// 4. Spécifique Director : revealed / justRevealed / tintColor.
// ---------------------------------------------------------------------------

describe("Director — révélation (revealed / justRevealed / tintColor)", () => {
  it("revealed passe à true UNE SEULE FOIS, exactement quand hp tombe sous revealHpFraction*maxHp — jamais avant", () => {
    const { director, physics } = createRig();
    const threshold = directorConfig.revealHpFraction * directorConfig.maxHp; // 150.
    assert.strictEqual(director.hp, directorConfig.maxHp);
    assert.isFalse(director.revealed);
    assert.strictEqual(director.tintColor, directorConfig.humanTintColor);

    // Ramène hp à threshold + 1 (151) : encore AU-DESSUS du seuil, ne doit pas révéler.
    const firstHit = directorConfig.maxHp - (threshold + 1);
    const result1 = director.applyDamage(firstHit, physics, new THREE.Vector3(0, 0, 1));
    assert.strictEqual(director.hp, threshold + 1);
    assert.isFalse(director.revealed, "ne doit pas être révélé juste au-dessus du seuil");
    assert.isFalse(result1.justRevealed);
    assert.strictEqual(director.tintColor, directorConfig.humanTintColor);

    // Un coup de plus amène hp EXACTEMENT au seuil (150) : condition `hp <= seuil` — doit révéler CE coup-ci.
    const result2 = director.applyDamage(1, physics, new THREE.Vector3(0, 0, 1));
    assert.strictEqual(director.hp, threshold);
    assert.isTrue(director.revealed);
    assert.isTrue(result2.justRevealed);
    assert.strictEqual(director.tintColor, directorConfig.revealedTintColor);
  });

  it("justRevealed est true SEULEMENT le pas de la révélation ; false ensuite alors que revealed reste true à jamais", () => {
    const { director, physics } = createRig();
    const threshold = directorConfig.revealHpFraction * directorConfig.maxHp;

    const revealingHit = directorConfig.maxHp - threshold; // amène hp pile au seuil.
    const revealResult = director.applyDamage(revealingHit, physics, new THREE.Vector3(0, 0, 1));
    assert.isTrue(director.revealed);
    assert.isTrue(revealResult.justRevealed);

    // Coup suivant, toujours non-fatal : revealed reste true, mais justRevealed
    // redevient false (la bascule ne se produit qu'UNE fois).
    const afterResult = director.applyDamage(1, physics, new THREE.Vector3(0, 0, 1));
    assert.isFalse(afterResult.died);
    assert.isTrue(director.revealed, "jamais remis à false ensuite");
    assert.isFalse(afterResult.justRevealed);
    assert.strictEqual(director.tintColor, directorConfig.revealedTintColor);
  });
});

// ---------------------------------------------------------------------------
// 5. Jitter de visée déterministe (PRNG mulberry32 propre à l'entité).
// ---------------------------------------------------------------------------

describe("Director — jitter de visée déterministe (PRNG mulberry32 propre à l'entité)", () => {
  it("même seed -> même point d'impact, reproductible et conforme à un calcul de référence indépendant", () => {
    const seed = 424242;
    const eye = new THREE.Vector3(0, directorConfig.eyeHeight, 0);
    const targetEye = new THREE.Vector3(0, directorConfig.eyeHeight, 10);
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
      const { director, ctx } = createRig(directorConfig, seed);
      ctx.playerTargetPosition.set(targetEye.x, 0, targetEye.z);
      ctx.playerEyePosition.copy(targetEye);
      director.state = "attack";
      director.stateTimer = directorConfig.attackTelegraphDuration;
      director.update(DT, ctx);
      return director.pendingPlayerHitPoint.clone();
    }

    const first = resolveOnce();
    const second = resolveOnce();

    const expected = computeExpectedHitPoint(seed, directorConfig.aimJitterDeg, eye, targetEye, timeOfImpact);
    assertVectorApprox(first, expected, 1e-6, "premier tir vs référence");
    assertVectorApprox(second, expected, 1e-6, "second tir vs référence");
    assertVectorApprox(first, second, 1e-12, "même seed -> même résultat, deux instances indépendantes");
  });
});
