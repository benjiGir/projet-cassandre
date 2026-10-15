import RAPIER from "@dimforge/rapier3d-compat";
import { computeEyePosition, hasClearWorldPath, WORLD_ONLY_RAY_GROUPS } from "./enemyPerception";
import type { EnemyEventSink, EnemyMachineContext, EnemyUpdateContext } from "./enemyTypes";

export function beginCharge(ctx: EnemyMachineContext): void {
  ctx.chargeDirection.copy(ctx.scratchToPlayer);
  if (ctx.chargeDirection.lengthSq() < 1e-8) ctx.chargeDirection.copy(ctx.forward);
  ctx.forward.copy(ctx.chargeDirection);
  ctx.chargeRemaining = ctx.cfg.charge!.distance;
  ctx.chargeHit = false;
}

export function finishChargeStep(actor: EnemyEventSink, ctx: EnemyMachineContext, dt: number): void {
  const traveled = Math.hypot(ctx.movementScratch.x, ctx.movementScratch.z);
  ctx.chargeRemaining -= traveled;
  const sideways = Math.abs(
    ctx.movementScratch.x * ctx.chargeDirection.z - ctx.movementScratch.z * ctx.chargeDirection.x,
  );
  if (
    sideways > ctx.cfg.colliderOffset * 2 ||
    traveled < ctx.cfg.charge!.speed * dt * 0.5 ||
    ctx.chargeRemaining <= 0
  ) {
    actor.send({ type: "CHARGE_FINISHED" });
  }
}

export function hasSafeChargeFloor(
  ctx: EnemyMachineContext,
  update: EnemyUpdateContext,
  direction: EnemyMachineContext["forward"],
  step: number,
): boolean {
  const cfg = ctx.cfg;
  const feet = ctx.position.y - cfg.capsuleHalfHeight - cfg.capsuleRadius;
  const next = ctx.scratchEye.copy(ctx.position).addScaledVector(direction, step + cfg.capsuleRadius);
  next.y = feet;
  if (update.canChargeTo && !update.canChargeTo(next)) return false;
  ctx.scratchRay.origin.x = next.x;
  ctx.scratchRay.origin.y = feet + cfg.autostepMaxHeight;
  ctx.scratchRay.origin.z = next.z;
  ctx.scratchRay.dir.x = 0;
  ctx.scratchRay.dir.y = -1;
  ctx.scratchRay.dir.z = 0;
  return (
    update.physics.world.castRay(
      ctx.scratchRay,
      cfg.autostepMaxHeight + cfg.charge!.maxDrop,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      WORLD_ONLY_RAY_GROUPS,
      undefined,
      ctx.body ?? undefined,
    ) !== null
  );
}

function tryChargeHit(ctx: EnemyMachineContext, update: EnemyUpdateContext, step: number): void {
  if (ctx.chargeHit) return;
  const delta = ctx.scratchAimDir.subVectors(update.playerTargetPosition, ctx.position);
  const along = delta.dot(ctx.chargeDirection);
  const near = Math.max(0, Math.min(step, along));
  delta.addScaledVector(ctx.chargeDirection, -near);
  const charge = ctx.cfg.charge!;
  if (Math.hypot(delta.x, delta.z) > charge.reach || Math.abs(delta.y) > ctx.cfg.eyeHeight) return;
  if (
    !hasClearWorldPath(
      update.physics,
      computeEyePosition(ctx, ctx.scratchEye),
      update.playerEyePosition,
      ctx.scratchRay,
    )
  )
    return;
  ctx.chargeHit = true;
  ctx.pendingShot = true;
  ctx.pendingAttackDamage = ctx.cfg.attackDamage;
  ctx.pendingPlayerHitPoint.copy(update.playerTargetPosition);
  ctx.pendingPlayerHitNormal.copy(ctx.chargeDirection).negate();
  ctx.pendingPlayerPush.copy(ctx.chargeDirection).multiplyScalar(charge.pushDistance);
  ctx.pendingPushDuration = charge.pushDuration;
}

export function runCharge(
  actor: EnemyEventSink,
  ctx: EnemyMachineContext,
  update: EnemyUpdateContext,
  dt: number,
  notarget: boolean,
): void {
  const charge = ctx.cfg.charge;
  if (!charge || notarget) {
    actor.send({ type: "CHARGE_FINISHED" });
    return;
  }
  const step = Math.min(charge.speed * dt, ctx.chargeRemaining);
  if (!hasSafeChargeFloor(ctx, update, ctx.chargeDirection, step)) {
    actor.send({ type: "CHARGE_FINISHED" });
    return;
  }
  tryChargeHit(ctx, update, step);
  ctx.velocityHorizontal.copy(ctx.chargeDirection).multiplyScalar(dt > 0 ? step / dt : 0);
}

export function runChargeRecovery(
  actor: EnemyEventSink,
  ctx: EnemyMachineContext,
  update: EnemyUpdateContext,
  dt: number,
  notarget: boolean,
): void {
  ctx.stateTimer += dt;
  if (ctx.stateTimer < (ctx.cfg.charge?.recovery ?? 1)) return;
  const canRepeat =
    ctx.chargesRemaining > 0 &&
    !notarget &&
    ctx.position.distanceTo(update.playerTargetPosition) <= ctx.cfg.attackRange &&
    hasClearWorldPath(
      update.physics,
      computeEyePosition(ctx, ctx.scratchEye),
      update.playerEyePosition,
      ctx.scratchRay,
    );
  actor.send({ type: canRepeat ? "REPEAT_CHARGE" : "RECOVERY_ELAPSED" });
}
