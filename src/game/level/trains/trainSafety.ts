import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Effect } from "effect";
import { RaycastService } from "../../../physics/raycast";
import { GROUP, interactionGroups, type PhysicsWorld } from "../../../physics/world";
import { poseOnRoute } from "./trainPath";
import { TrainLevelError, type TrainLevelData } from "./trainLevelData";
import type { TrainConfig } from "./trainTypes";

// see: docs/4-technique/trains-metro.md#lisibilite
export const auditTrainSafety = Effect.fn("auditTrainSafety")(function* (
  physics: PhysicsWorld,
  data: TrainLevelData,
  config: TrainConfig,
) {
  const rays = yield* RaycastService;
  const position = new THREE.Vector3(),
    direction = new THREE.Vector3(),
    toward = new THREE.Vector3();
  const safe = new THREE.Vector3();
  let samples = 0;
  for (const visible of data.visibleRoutes) {
    for (let at = visible.start; at <= visible.end; at = Math.min(at + 4, visible.end)) {
      poseOnRoute(visible.route, at, position, direction);
      const railY = position.y;
      position.y += 1.6;
      let seen = false;
      for (const signal of data.signals) {
        if (signal.lane !== visible.lane || signal.position.distanceTo(position) > 20) continue;
        toward.subVectors(signal.position, position);
        const length = toward.length();
        toward.normalize();
        const hit = yield* rays.castRay(
          physics,
          new RAPIER.Ray(position, toward),
          length,
          true,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          interactionGroups(GROUP.ENEMY, GROUP.WORLD),
        );
        if (!hit || hit.timeOfImpact >= length - 0.15) {
          seen = true;
          break;
        }
      }
      if (!seen)
        return yield* new TrainLevelError({
          message: `Signal masqué ou trop loin : ${visible.lane} à ${at.toFixed(1)} m.`,
        });
      let distance = Infinity;
      position.y = railY;
      for (const refuge of data.refuges) {
        if (refuge.lane !== visible.lane) continue;
        refuge.box.clampPoint(position, safe);
        distance = Math.min(distance, Math.hypot(position.x - safe.x, position.z - safe.z) + 0.8);
      }
      if (distance / 9 + 1.58 > config.warning)
        return yield* new TrainLevelError({ message: `Refuge trop loin : ${visible.lane} à ${at.toFixed(1)} m.` });
      samples++;
      if (at === visible.end) break;
    }
  }
  return { samples };
});
