import type * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { COLLISION_GROUPS, type PhysicsWorld } from "../../../physics/world";
import type { EnemyConfig, EnemyMachineContext, EnemyUpdateContext } from "./enemyTypes";

// see: docs/6-reference/notes-code-gameplay-ennemis.md#déplacement-et-combat

export function createEnemyBody(
  physics: PhysicsWorld,
  cfg: EnemyConfig,
  spawnPosition: THREE.Vector3,
): { body: RAPIER.RigidBody; collider: RAPIER.Collider; centerY: number } {
  const centerY = spawnPosition.y + cfg.capsuleHalfHeight + cfg.capsuleRadius;
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawnPosition.x, centerY, spawnPosition.z),
  );
  const collider = physics.world.createCollider(
    RAPIER.ColliderDesc.capsule(cfg.capsuleHalfHeight, cfg.capsuleRadius).setCollisionGroups(COLLISION_GROUPS.ENEMY),
    body,
  );
  return { body, collider, centerY };
}

export function configureEnemyCharacterController(
  controller: RAPIER.KinematicCharacterController,
  cfg: EnemyConfig,
): void {
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.setOffset(cfg.colliderOffset);
  controller.setSlideEnabled(true);
  controller.enableAutostep(cfg.autostepMaxHeight, cfg.autostepMinWidth, cfg.autostepIncludeDynamicBodies);
  controller.enableSnapToGround(cfg.snapToGroundDistance);
  controller.setMaxSlopeClimbAngle((cfg.maxSlopeClimbAngleDeg * Math.PI) / 180);
  controller.setMinSlopeSlideAngle((cfg.minSlopeSlideAngleDeg * Math.PI) / 180);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(cfg.characterMass);
}

export function detachEnemyPhysics(ctx: EnemyMachineContext, physics: PhysicsWorld): void {
  if (ctx.body) {
    physics.world.removeRigidBody(ctx.body); // libère aussi le collider attaché (API Rapier).
  }
  ctx.body = null;
  ctx.collider = null;
}

export function updateKnockback(ctx: EnemyMachineContext, dt: number): void {
  const speed = ctx.knockbackVelocity.length();
  if (speed <= 1e-4) {
    ctx.knockbackVelocity.set(0, 0, 0);
    return;
  }
  const drop = (speed / ctx.cfg.knockbackDecayTime) * dt;
  const newSpeed = Math.max(0, speed - drop);
  ctx.knockbackVelocity.multiplyScalar(newSpeed / speed);
}

export function integratePhysics(ctx: EnemyMachineContext, dt: number, updateCtx: EnemyUpdateContext): void {
  if (!ctx.body || !ctx.collider) return; // garde-fou (dead/corpse retournent avant, voir `tickEnemy`).

  const gravityY = updateCtx.physics.gravityY;
  ctx.verticalVelocity += gravityY * dt;
  if (ctx.isGrounded && ctx.verticalVelocity < 0) ctx.verticalVelocity = -ctx.cfg.groundStickSpeed;
  if (ctx.verticalVelocity < -ctx.cfg.maxFallSpeed) ctx.verticalVelocity = -ctx.cfg.maxFallSpeed;

  ctx.desiredScratch.x = (ctx.velocityHorizontal.x + ctx.knockbackVelocity.x) * dt;
  ctx.desiredScratch.y = (ctx.verticalVelocity + ctx.knockbackVelocity.y) * dt;
  ctx.desiredScratch.z = (ctx.velocityHorizontal.z + ctx.knockbackVelocity.z) * dt;

  const collider = ctx.collider;
  updateCtx.kcc.computeColliderMovement(
    collider,
    ctx.desiredScratch,
    RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
    COLLISION_GROUPS.ENEMY,
    (other) => other.handle !== collider.handle,
  );
  updateCtx.kcc.computedMovement(ctx.movementScratch);
  ctx.strideDistance += Math.hypot(ctx.movementScratch.x, ctx.movementScratch.z);
  const grounded = updateCtx.kcc.computedGrounded();
  if (grounded && ctx.verticalVelocity < 0) ctx.verticalVelocity = 0;
  ctx.isGrounded = grounded;

  const current = ctx.body.translation();
  ctx.nextTranslationScratch.set(
    current.x + ctx.movementScratch.x,
    current.y + ctx.movementScratch.y,
    current.z + ctx.movementScratch.z,
  );
  ctx.body.setNextKinematicTranslation(ctx.nextTranslationScratch);
  ctx.position.copy(ctx.nextTranslationScratch);
}
