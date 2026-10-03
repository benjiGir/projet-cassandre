import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Effect } from "effect";
import { runGameplaySync } from "../../app/gameRuntime";
import { RaycastService } from "../../physics/raycast";
import type { PhysicsWorld } from "../../physics/world";
import { PathfindingService } from "../level/pathfinding";
import { WORLD_ONLY_RAY_GROUPS } from "./enemyPerception";
import type { EnemyMachineContext, EnemyUpdateContext } from "./enemyTypes";

// see: docs/6-reference/notes-code-gameplay-ennemis.md#déplacement-et-combat

const TAU = Math.PI * 2;
const PATH_REQUERY_DISTANCE = 1.5;
const WAYPOINT_REACHED_DISTANCE = 0.6;

function horizontalDistanceSq(a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function rotateHorizontal(dir: THREE.Vector3, angleRad: number, out: THREE.Vector3): THREE.Vector3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return out.set(dir.x * c + dir.z * s, 0, -dir.x * s + dir.z * c);
}

function castAvoidanceRay(ctx: EnemyMachineContext, physics: PhysicsWorld, dir: THREE.Vector3): boolean {
  ctx.scratchRay.origin.x = ctx.position.x;
  ctx.scratchRay.origin.y = ctx.position.y;
  ctx.scratchRay.origin.z = ctx.position.z;
  ctx.scratchRay.dir.x = dir.x;
  ctx.scratchRay.dir.y = 0;
  ctx.scratchRay.dir.z = dir.z;
  const hit = runGameplaySync(
    RaycastService.use((raycast) =>
      raycast.castRay(
        physics,
        ctx.scratchRay,
        ctx.cfg.avoidanceRayLength,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        WORLD_ONLY_RAY_GROUPS,
      ),
    ),
  );
  return hit === null;
}

export function computeAvoidedDirection(
  ctx: EnemyMachineContext,
  physics: PhysicsWorld,
  desiredDir: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  if (desiredDir.lengthSq() < 1e-8) return out.set(0, 0, 0);

  if (castAvoidanceRay(ctx, physics, desiredDir)) return out.copy(desiredDir);

  const angleRad = THREE.MathUtils.degToRad(ctx.cfg.avoidanceSideAngleDeg);
  rotateHorizontal(desiredDir, angleRad, ctx.scratchLeftDir);
  rotateHorizontal(desiredDir, -angleRad, ctx.scratchRightDir);

  if (castAvoidanceRay(ctx, physics, ctx.scratchLeftDir)) return out.copy(ctx.scratchLeftDir);
  if (castAvoidanceRay(ctx, physics, ctx.scratchRightDir)) return out.copy(ctx.scratchRightDir);

  return out.set(0, 0, 0);
}

export function turnTowards(ctx: EnemyMachineContext, targetDir: THREE.Vector3, dt: number): void {
  if (targetDir.lengthSq() < 1e-8) return;
  const currentAngle = Math.atan2(ctx.forward.x, ctx.forward.z);
  const targetAngle = Math.atan2(targetDir.x, targetDir.z);
  let delta = targetAngle - currentAngle;
  delta = ((delta + Math.PI) % TAU + TAU) % TAU - Math.PI; // repli dans [-PI, PI]
  const maxStep = ctx.cfg.turnRateRadPerSec * dt;
  const applied = Math.abs(delta) <= maxStep ? delta : Math.sign(delta) * maxStep;
  const newAngle = currentAngle + applied;
  ctx.forward.set(Math.sin(newAngle), 0, Math.cos(newAngle));
}

export function tryComputeChaseDirectionFromPath(
  ctx: EnemyMachineContext,
  updateCtx: EnemyUpdateContext,
  out: THREE.Vector3,
): boolean {
  const navGraph = updateCtx.navGraph;
  if (!navGraph) return false;

  const target = updateCtx.playerTargetPosition;
  const pathExhausted = ctx.currentWaypointIndex >= ctx.currentPath.length;
  const targetMovedEnough =
    ctx.lastPathQueryTarget.distanceToSquared(target) >= PATH_REQUERY_DISTANCE * PATH_REQUERY_DISTANCE;

  if (pathExhausted || targetMovedEnough) {
    ctx.lastPathQueryTarget.copy(target);
    const fromPosition = ctx.position;
    const path = runGameplaySync(
      PathfindingService.use((pf) => pf.findPath(navGraph, fromPosition, target)).pipe(
        Effect.catch(() => Effect.succeed(null)),
      ),
    );
    ctx.currentPath = path ?? [];
    ctx.currentWaypointIndex = 0;
  }

  if (ctx.currentWaypointIndex >= ctx.currentPath.length) return false; // aucun chemin exploitable — repli.

  while (
    ctx.currentWaypointIndex < ctx.currentPath.length - 1 &&
    horizontalDistanceSq(ctx.position, ctx.currentPath[ctx.currentWaypointIndex]!) <
      WAYPOINT_REACHED_DISTANCE * WAYPOINT_REACHED_DISTANCE
  ) {
    ctx.currentWaypointIndex++;
  }

  const waypoint = ctx.currentPath[ctx.currentWaypointIndex]!;
  out.set(waypoint.x - ctx.position.x, 0, waypoint.z - ctx.position.z);
  if (out.lengthSq() < 1e-8) return true; // déjà sur le waypoint : pathfinding "actif" mais rien à déplacer ce pas-ci.
  out.normalize();
  return true;
}
