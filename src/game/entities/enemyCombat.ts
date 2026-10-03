import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { runGameplaySync } from "../../app/gameRuntime";
import { RaycastService } from "../../physics/raycast";
import { COLLISION_GROUPS, GROUP } from "../../physics/world";
import { cheats } from "../devtools/cheats";
import { computeEyePosition, hasClearWorldPath } from "./enemyPerception";
import type { BreakableHitTarget, EnemyMachineContext, EnemyUpdateContext } from "./enemyTypes";

// see: docs/6-reference/notes-code-gameplay-ennemis.md#dégâts-et-événements
// see: docs/decisions/0031-portes-animees-et-vitres.md
// see: docs/decisions/0032-sanitaires-utilisables.md

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_RIGHT_FALLBACK = new THREE.Vector3(1, 0, 0);

function isPlayerCollider(collider: RAPIER.Collider): boolean {
  const membership = (collider.collisionGroups() >>> 16) & 0xffff;
  return (membership & GROUP.PLAYER) !== 0;
}

function applyAimJitter(ctx: EnemyMachineContext, dir: THREE.Vector3, out: THREE.Vector3): void {
  const jitterYaw = (ctx.nextRandom() * 2 - 1) * THREE.MathUtils.degToRad(ctx.cfg.aimJitterDeg);
  const jitterPitch = (ctx.nextRandom() * 2 - 1) * THREE.MathUtils.degToRad(ctx.cfg.aimJitterDeg);

  const upHint = Math.abs(dir.y) > 0.98 ? WORLD_RIGHT_FALLBACK : WORLD_UP;
  ctx.scratchAimRight.crossVectors(upHint, dir).normalize();
  ctx.scratchAimUp.crossVectors(dir, ctx.scratchAimRight).normalize();

  out
    .copy(dir)
    .addScaledVector(ctx.scratchAimRight, Math.tan(jitterYaw))
    .addScaledVector(ctx.scratchAimUp, Math.tan(jitterPitch))
    .normalize();
}

export function handleEnemyShotMiss(
  breakables: ReadonlyArray<BreakableHitTarget | undefined>,
  hitCollider: RAPIER.Collider,
  hitIsPlayer: boolean,
  point: THREE.Vector3,
  direction: THREE.Vector3,
): void {
  if (hitIsPlayer) return;
  for (const target of breakables) {
    if (target?.tryBreakByColliderHandle(hitCollider.handle, point, direction)) return;
  }
}

export function resolveAttack(ctx: EnemyMachineContext, updateCtx: EnemyUpdateContext): void {
  if (cheats.notarget) return; // dev : la pose de tir va au bout, le coup ne part pas
  const eye = computeEyePosition(ctx, ctx.scratchEye);
  const targetEye = updateCtx.playerEyePosition;

  if (!hasClearWorldPath(updateCtx.physics, eye, targetEye, ctx.scratchRay)) return;

  ctx.timeSinceShot = 0; // le coup part, touché ou non.
  ctx.pendingShot = true;
  ctx.scratchAimDir.subVectors(targetEye, eye).normalize();
  applyAimJitter(ctx, ctx.scratchAimDir, ctx.scratchJitteredDir);

  const maxDist = eye.distanceTo(targetEye) + 4; // marge : ce qui compte est le PREMIER collider touché.

  ctx.scratchRay.origin.x = eye.x;
  ctx.scratchRay.origin.y = eye.y;
  ctx.scratchRay.origin.z = eye.z;
  ctx.scratchRay.dir.x = ctx.scratchJitteredDir.x;
  ctx.scratchRay.dir.y = ctx.scratchJitteredDir.y;
  ctx.scratchRay.dir.z = ctx.scratchJitteredDir.z;

  const hit = runGameplaySync(
    RaycastService.use((raycast) =>
      raycast.castRayAndGetNormal(
        updateCtx.physics,
        ctx.scratchRay,
        maxDist,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        COLLISION_GROUPS.ENEMY_SHOT,
      ),
    ),
  );
  if (!hit) return; // rien touché avant `maxDist` : raté silencieux.
  if (!isPlayerCollider(hit.collider)) {
    // Mur touché en premier (jitter, ou joueur sorti du couloir de tir) :
    // raté silencieux, SAUF si c'est une vitre — elle vole en éclats.
    const point = ctx.scratchEnemyShotPoint.set(
      eye.x + ctx.scratchJitteredDir.x * hit.timeOfImpact,
      eye.y + ctx.scratchJitteredDir.y * hit.timeOfImpact,
      eye.z + ctx.scratchJitteredDir.z * hit.timeOfImpact,
    );
    handleEnemyShotMiss(
      [updateCtx.vitreSystem, updateCtx.sanitaireSystem],
      hit.collider,
      false,
      point,
      ctx.scratchJitteredDir,
    );
    return;
  }

  ctx.pendingAttackDamage = ctx.cfg.attackDamage;
  ctx.pendingPlayerHitPoint.set(
    eye.x + ctx.scratchJitteredDir.x * hit.timeOfImpact,
    eye.y + ctx.scratchJitteredDir.y * hit.timeOfImpact,
    eye.z + ctx.scratchJitteredDir.z * hit.timeOfImpact,
  );
  ctx.pendingPlayerHitNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
}
