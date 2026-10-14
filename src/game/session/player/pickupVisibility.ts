import RAPIER from "@dimforge/rapier3d-compat";
import type * as THREE from "three";
import { Effect } from "effect";

import { RaycastService } from "../../../physics/raycast";
import { GROUP, interactionGroups } from "../../../physics/world";
import type { GameSession } from "../gameSession";

const PICKUP_RAY_GROUPS = interactionGroups(GROUP.PLAYER, GROUP.WORLD);
const TARGET_MARGIN = 0.02;
const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

// see: docs/6-reference/notes-code-gameplay-niveau.md#ramassages-et-obstacles
export const hasClearPickupPath = Effect.fn("hasClearPickupPath")(function* (
  session: GameSession,
  target: THREE.Vector3,
): Effect.fn.Return<boolean, never, RaycastService> {
  const origin = session.player.position;
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance <= TARGET_MARGIN) return true;

  ray.origin.x = origin.x;
  ray.origin.y = origin.y;
  ray.origin.z = origin.z;
  ray.dir.x = dx / distance;
  ray.dir.y = dy / distance;
  ray.dir.z = dz / distance;

  const rays = yield* RaycastService;
  const hit = yield* rays.castRay(
    session.physics,
    ray,
    distance - TARGET_MARGIN,
    true,
    RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
    PICKUP_RAY_GROUPS,
  );
  return hit === null;
});
