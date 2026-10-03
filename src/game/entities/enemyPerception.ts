import type * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { runGameplaySync } from "../../core/runtime";
import { RaycastService } from "../../physics/raycast";
import { GROUP, interactionGroups, type PhysicsWorld } from "../../physics/world";
import type { EnemyMachineContext } from "./enemyTypes";

export const WORLD_ONLY_RAY_GROUPS = interactionGroups(GROUP.ENEMY, GROUP.WORLD);

export function computeEyePosition(ctx: EnemyMachineContext, out: THREE.Vector3): THREE.Vector3 {
  const feetY = ctx.position.y - (ctx.cfg.capsuleHalfHeight + ctx.cfg.capsuleRadius);
  return out.set(ctx.position.x, feetY + ctx.cfg.eyeHeight, ctx.position.z);
}

export function hasClearWorldPath(
  physics: PhysicsWorld,
  origin: THREE.Vector3,
  target: THREE.Vector3,
  ray: RAPIER.Ray,
): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-4) return true;

  ray.origin.x = origin.x;
  ray.origin.y = origin.y;
  ray.origin.z = origin.z;
  ray.dir.x = dx / dist;
  ray.dir.y = dy / dist;
  ray.dir.z = dz / dist;

  // Petite marge sous la distance réelle : évite qu'un contact quasi-tangent
  // pile à la distance cible (imprécision flottante) ne compte comme un
  // blocage alors qu'il n'y a rien entre les deux points.
  const hit = runGameplaySync(
    RaycastService.use((raycast) =>
      raycast.castRay(
        physics,
        ray,
        Math.max(0, dist - 0.05),
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        WORLD_ONLY_RAY_GROUPS,
      ),
    ),
  );
  return hit === null;
}
