import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { type Actor, createActor, setup } from "xstate";

import type {
  EnemyState,
  EnemyUpdateContext,
  EnemyMachineContext,
  CreateEnemyContextParams,
  EnemyEvent,
  EnemyDamageOutcome,
} from "./enemyTypes";
import { DeterministicRandom } from "../../../core/effect/random";
import { runGameplaySync } from "../../../app/runtime/gameRuntime";
import { computeEyePosition, hasClearWorldPath } from "./enemyPerception";
import { computeAvoidedDirection, turnTowards, tryComputeChaseDirectionFromPath } from "./enemyNavigation";
import { detachEnemyPhysics, updateKnockback, integratePhysics } from "./enemyPhysics";
import { resolveAttack } from "./enemyCombat";
import { cheats } from "../../devtools/cheats";
import type { EnemyAnimationInput } from "../../../render/sprites/enemySpriteTypes";

// see: docs/archive/systems-entites.md#la-machine-partagée-ce-quelle-porte-et-où-sarrête-sa-responsabilité

/** Pose du sprite pour chaque état : l'attaque se TIENT en joue pendant la télégraphie. */
const ENEMY_POSE: Record<EnemyState, EnemyAnimationInput["pose"]> = {
  idle: "idle",
  alert: "alert",
  chase: "chase",
  attack: "aim",
  stagger: "stagger",
  dead: "death",
  corpse: "corpse",
};

// see: docs/archive/systems-rendu.md#animation-des-sprites-dennemis
export function readEnemyAnimation(actor: EnemyActor, out: EnemyAnimationInput): EnemyAnimationInput {
  const snapshot = actor.getSnapshot();
  const ctx = snapshot.context;
  const state = snapshot.value as EnemyState;
  out.pose = ENEMY_POSE[state];
  out.poseTime = ctx.stateTimer;
  out.poseDuration =
    state === "alert"
      ? ctx.cfg.alertDuration
      : state === "stagger"
        ? ctx.cfg.staggerDuration
        : state === "dead"
          ? ctx.cfg.deathFrameDuration * ctx.deathFrameCount
          : 0;
  out.clock = ctx.animClock;
  out.stride = ctx.strideDistance;
  out.timeSinceShot = ctx.timeSinceShot;
  return out;
}

/** Construit le `context` XState d'une entité neuve. Appelé UNE FOIS par le constructeur de `Suit`/`Director`, jamais par pas fixe. */
export function createEnemyMachineContext(params: CreateEnemyContextParams): EnemyMachineContext {
  const position = params.centerPosition.clone();
  const forward = params.forward.clone();
  return {
    cfg: params.cfg,
    nextRandom: params.nextRandom,

    body: params.body,
    collider: params.collider,

    position,
    previousPosition: position.clone(),
    forward,
    previousForward: forward.clone(),

    hp: params.hp,
    stateTimer: 0,
    timeSinceLastSeen: 0,
    attackCooldownRemaining: 0,
    isGrounded: false,
    verticalVelocity: 0,

    velocityHorizontal: new THREE.Vector3(),
    knockbackVelocity: new THREE.Vector3(),

    pendingAlert: false,
    pendingTelegraph: false,
    pendingShot: false,
    pendingAttackDamage: 0,
    pendingPlayerHitPoint: new THREE.Vector3(),
    pendingPlayerHitNormal: new THREE.Vector3(),

    currentPath: [],
    currentWaypointIndex: 0,
    // Sentinelle loin de tout niveau réel — garantit une première requête de
    // chemin dès le premier pas fixe en `chase`.
    lastPathQueryTarget: new THREE.Vector3(Number.POSITIVE_INFINITY, 0, Number.POSITIVE_INFINITY),

    deathFrameCount: params.deathFrameCount,

    animClock: 0,
    strideDistance: 0,
    timeSinceShot: Number.POSITIVE_INFINITY,

    scratchRay: new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }),
    scratchToPlayer: new THREE.Vector3(),
    scratchEye: new THREE.Vector3(),
    scratchMoveDir: new THREE.Vector3(),
    scratchLeftDir: new THREE.Vector3(),
    scratchRightDir: new THREE.Vector3(),
    scratchAimDir: new THREE.Vector3(),
    scratchJitteredDir: new THREE.Vector3(),
    scratchAimRight: new THREE.Vector3(),
    scratchAimUp: new THREE.Vector3(),
    scratchEnemyShotPoint: new THREE.Vector3(),
    desiredScratch: { x: 0, y: 0, z: 0 },
    movementScratch: { x: 0, y: 0, z: 0 },
    nextTranslationScratch: new THREE.Vector3(),
  };
}

// see: docs/6-reference/notes-code-gameplay-ennemis.md#état-et-horloges
export function createEnemyPrng(seed: number): () => number {
  return runGameplaySync(DeterministicRandom.useSync((random) => random.forSeed(seed)));
}

// Machine XState — graphe + actions d'entrée.
// see: docs/archive/systems-entites.md#pourquoi-le-calcul-de-transition-vit-hors-des-gardes-xstate

export const enemyMachine = setup({
  types: {} as {
    context: EnemyMachineContext;
    events: EnemyEvent;
    input: EnemyMachineContext;
  },
  actions: {
    resetStateTimer: ({ context }) => {
      context.stateTimer = 0;
    },
    resetTimeSinceLastSeen: ({ context }) => {
      context.timeSinceLastSeen = 0;
    },
    setPendingAlert: ({ context }) => {
      context.pendingAlert = true;
    },
    setPendingTelegraph: ({ context }) => {
      context.pendingTelegraph = true;
    },
    armAttackCooldown: ({ context }) => {
      context.attackCooldownRemaining = context.cfg.attackCooldown;
    },
    enterDead: ({ context, event }) => {
      if (event.type !== "HIT_FATAL") return;
      context.stateTimer = 0;
      context.hp = 0;
      context.velocityHorizontal.set(0, 0, 0);
      context.knockbackVelocity.set(0, 0, 0);
      detachEnemyPhysics(context, event.physics);
    },
    /** `* -> stagger`. */
    enterStagger: ({ context, event }) => {
      if (event.type !== "HIT_NONFATAL") return;
      context.stateTimer = 0;
      context.knockbackVelocity.set(
        event.knockbackDirection.x * context.cfg.knockbackSpeed,
        context.cfg.knockbackUpBoost,
        event.knockbackDirection.z * context.cfg.knockbackSpeed,
      );
    },
  },
}).createMachine({
  id: "enemy",
  context: ({ input }) => input,
  initial: "idle",
  states: {
    idle: {
      on: {
        SAW_PLAYER: { target: "alert", actions: ["resetStateTimer", "resetTimeSinceLastSeen", "setPendingAlert"] },
        HIT_FATAL: { target: "dead", actions: "enterDead" },
        HIT_NONFATAL: { target: "stagger", actions: "enterStagger" },
      },
    },
    alert: {
      on: {
        ALERT_ELAPSED: { target: "chase", actions: "resetStateTimer" },
        HIT_FATAL: { target: "dead", actions: "enterDead" },
        HIT_NONFATAL: { target: "stagger", actions: "enterStagger" },
      },
    },
    chase: {
      on: {
        TARGET_IN_RANGE: { target: "attack", actions: ["resetStateTimer", "setPendingTelegraph"] },
        CONTACT_LOST: { target: "idle", actions: "resetStateTimer" },
        HIT_FATAL: { target: "dead", actions: "enterDead" },
        HIT_NONFATAL: { target: "stagger", actions: "enterStagger" },
      },
    },
    attack: {
      on: {
        ATTACK_RESOLVED: {
          target: "chase",
          actions: ["resetStateTimer", "armAttackCooldown", "resetTimeSinceLastSeen"],
        },
        HIT_FATAL: { target: "dead", actions: "enterDead" },
        HIT_NONFATAL: { target: "stagger", actions: "enterStagger" },
      },
    },
    stagger: {
      on: {
        STAGGER_ELAPSED: { target: "chase", actions: ["resetStateTimer", "resetTimeSinceLastSeen"] },
        HIT_FATAL: { target: "dead", actions: "enterDead" },
        HIT_NONFATAL: { target: "stagger", actions: "enterStagger" },
      },
    },
    dead: {
      on: {
        DEATH_ANIM_DONE: { target: "corpse" },
      },
    },
    corpse: {},
  },
});

export type EnemyActor = Actor<typeof enemyMachine>;

/** Crée et démarre un acteur — un par entité (`Suit`/`Director`), jamais partagé. */
export function createEnemyActor(context: EnemyMachineContext): EnemyActor {
  return createActor(enemyMachine, { input: context }).start();
}

// see: docs/archive/systems-entites.md#réassigner-létat-depuis-les-tests-sans-casser-lencapsulation
export function forceEnemyState(actor: EnemyActor, next: EnemyState): EnemyActor {
  const context = actor.getSnapshot().context;
  const resolved = enemyMachine.resolveState({ value: next, context });
  const snapshot = { ...enemyMachine.getPersistedSnapshot(resolved), context };
  // En mémoire uniquement : garder les références Rapier, vecteurs et RNG, sans JSON.
  const replacement = createActor(enemyMachine, { input: context, snapshot });
  actor.stop();
  return replacement.start();
}

// Décisions par état. `actor` n'est utilisé que pour `send(...)`, jamais
// relu (voir `tickEnemy`, qui a déjà extrait `ctx`/`state` une fois pour
// toutes ce pas-ci).

function runIdle(actor: EnemyActor, ctx: EnemyMachineContext, updateCtx: EnemyUpdateContext, distance: number): void {
  if (cheats.notarget) return; // dev : jamais de repérage, donc jamais d'alerte
  if (distance > ctx.cfg.sightRange) return;
  const eye = computeEyePosition(ctx, ctx.scratchEye);
  if (!hasClearWorldPath(updateCtx.physics, eye, updateCtx.playerEyePosition, ctx.scratchRay)) return;

  actor.send({ type: "SAW_PLAYER" });
}

function runAlert(actor: EnemyActor, ctx: EnemyMachineContext, dt: number): void {
  ctx.stateTimer += dt;
  turnTowards(ctx, ctx.scratchToPlayer, dt);
  // Transition INCONDITIONNELLE après `alertDuration` : ne re-vérifie pas la
  // ligne de vue ici, choix délibéré.
  if (ctx.stateTimer >= ctx.cfg.alertDuration) {
    actor.send({ type: "ALERT_ELAPSED" });
  }
}

function runChase(
  actor: EnemyActor,
  ctx: EnemyMachineContext,
  updateCtx: EnemyUpdateContext,
  dt: number,
  distance: number,
): void {
  const eye = computeEyePosition(ctx, ctx.scratchEye);
  const inSight =
    !cheats.notarget &&
    distance <= ctx.cfg.sightRange &&
    hasClearWorldPath(updateCtx.physics, eye, updateCtx.playerEyePosition, ctx.scratchRay);

  // Sous `notarget`, le contact est perdu TOUT DE SUITE plutôt qu'au bout de
  // `lostContactTimeout` : on veut se promener, pas être suivi cinq secondes
  // par un ennemi déjà lancé quand la bascule est activée.
  if (inSight) ctx.timeSinceLastSeen = 0;
  else ctx.timeSinceLastSeen = cheats.notarget ? ctx.cfg.lostContactTimeout : ctx.timeSinceLastSeen + dt;

  if (ctx.timeSinceLastSeen >= ctx.cfg.lostContactTimeout) {
    actor.send({ type: "CONTACT_LOST" });
    return;
  }

  if (inSight && distance <= ctx.cfg.attackRange && ctx.attackCooldownRemaining <= 0) {
    turnTowards(ctx, ctx.scratchToPlayer, dt);
    actor.send({ type: "TARGET_IN_RANGE" });
    return;
  }

  // Jalon M4 : suivi de chemin réel en priorité, repli EXPLICITE sur
  // l'évitement local historique si aucun graphe n'est encore baké ou si
  // aucun chemin n'a pu être trouvé.
  if (tryComputeChaseDirectionFromPath(ctx, updateCtx, ctx.scratchMoveDir)) {
    ctx.velocityHorizontal.copy(ctx.scratchMoveDir).multiplyScalar(ctx.cfg.chaseSpeed);
    turnTowards(ctx, ctx.scratchMoveDir.lengthSq() > 1e-8 ? ctx.scratchMoveDir : ctx.scratchToPlayer, dt);
    return;
  }

  const avoided = computeAvoidedDirection(ctx, updateCtx.physics, ctx.scratchToPlayer, ctx.scratchMoveDir);
  ctx.velocityHorizontal.copy(avoided).multiplyScalar(ctx.cfg.chaseSpeed);
  turnTowards(ctx, ctx.scratchToPlayer.lengthSq() > 1e-8 ? ctx.scratchToPlayer : avoided, dt);
}

function runAttack(actor: EnemyActor, ctx: EnemyMachineContext, updateCtx: EnemyUpdateContext, dt: number): void {
  turnTowards(ctx, ctx.scratchToPlayer, dt);
  ctx.stateTimer += dt;
  if (ctx.stateTimer < ctx.cfg.attackTelegraphDuration) return; // pose TIR tenue = la télégraphie visuelle exigée par le skill.

  resolveAttack(ctx, updateCtx);
  actor.send({ type: "ATTACK_RESOLVED" });
}

function runStagger(actor: EnemyActor, ctx: EnemyMachineContext, dt: number): void {
  ctx.stateTimer += dt;
  if (ctx.stateTimer >= ctx.cfg.staggerDuration) {
    actor.send({ type: "STAGGER_ELAPSED" });
  }
}

export function tickEnemy(actor: EnemyActor, dt: number, updateCtx: EnemyUpdateContext): void {
  const snapshot = actor.getSnapshot();
  const ctx = snapshot.context;
  const state = snapshot.value;

  ctx.pendingAlert = false;
  ctx.pendingTelegraph = false;
  ctx.pendingShot = false;
  ctx.pendingAttackDamage = 0;
  ctx.animClock += dt;
  ctx.timeSinceShot += dt;

  if (state === "corpse") return; // figé, rien à faire (pas d'allocation, pas de raycast).

  if (state === "dead") {
    ctx.stateTimer += dt;
    if (ctx.stateTimer >= ctx.cfg.deathFrameDuration * ctx.deathFrameCount) {
      actor.send({ type: "DEATH_ANIM_DONE" });
    }
    return;
  }

  updateKnockback(ctx, dt);
  ctx.attackCooldownRemaining = Math.max(0, ctx.attackCooldownRemaining - dt);

  ctx.scratchToPlayer.subVectors(updateCtx.playerTargetPosition, ctx.position);
  ctx.scratchToPlayer.y = 0;
  const distance = ctx.scratchToPlayer.length();
  if (distance > 1e-4) ctx.scratchToPlayer.multiplyScalar(1 / distance);

  ctx.velocityHorizontal.set(0, 0, 0);

  switch (state) {
    case "idle":
      runIdle(actor, ctx, updateCtx, distance);
      break;
    case "alert":
      runAlert(actor, ctx, dt);
      break;
    case "chase":
      runChase(actor, ctx, updateCtx, dt, distance);
      break;
    case "attack":
      runAttack(actor, ctx, updateCtx, dt);
      break;
    case "stagger":
      runStagger(actor, ctx, dt);
      break;
  }

  integratePhysics(ctx, dt, updateCtx);
}

export function applyEnemyDamageCore(actor: EnemyActor, amount: number): EnemyDamageOutcome {
  const snapshot = actor.getSnapshot();
  if (snapshot.value === "dead" || snapshot.value === "corpse") return "already-dead"; // garde-fou, ne devrait jamais arriver.
  snapshot.context.hp -= amount;
  return snapshot.context.hp <= 0 ? "fatal" : "nonfatal";
}

export function snapshotEnemyPrevious(ctx: EnemyMachineContext): void {
  ctx.previousPosition.copy(ctx.position);
  ctx.previousForward.copy(ctx.forward);
}

export function interpolateEnemyPosition(ctx: EnemyMachineContext, alpha: number, out: THREE.Vector3): THREE.Vector3 {
  return out.lerpVectors(ctx.previousPosition, ctx.position, alpha);
}

export function interpolateEnemyForward(ctx: EnemyMachineContext, alpha: number, out: THREE.Vector3): THREE.Vector3 {
  out.lerpVectors(ctx.previousForward, ctx.forward, alpha);
  if (out.lengthSq() < 1e-8) out.copy(ctx.forward);
  return out.normalize();
}
