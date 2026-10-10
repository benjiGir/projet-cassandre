import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Effect } from "effect";
import { RaycastService } from "../../../physics/raycast";
import { GROUP, interactionGroups, type PhysicsWorld } from "../../../physics/world";
import { poseOnRoute } from "./trainPath";
import { TrainLevelError, type TrainLevelData } from "./trainLevelData";
import type { TrainConfig } from "./trainTypes";

/** Pas d'échantillonnage des portions visibles, extrémités comprises. */
const SAMPLE_STEP = 4;
/** Hauteur des yeux d'un joueur debout sur la voie. */
const EYE_HEIGHT = 1.6;
/** Au-delà, un panneau ne compte plus comme lisible. */
const SIGNAL_MAX_DISTANCE = 20;
/** Un rayon arrêté à moins de cette distance du panneau l'a atteint. */
const SIGNAL_HIT_TOLERANCE = 0.15;
/** Distance à parcourir dans le refuge pour y être à l'abri. */
const REFUGE_ENTRY_MARGIN = 0.8;
/** Vitesse de fuite retenue pour le joueur, en m/s. */
const ESCAPE_SPEED = 9;
/** Temps laissé au joueur pour réagir avant de courir, en secondes. */
const REACTION_TIME = 1.58;

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
    for (let at = visible.start; at <= visible.end; at = Math.min(at + SAMPLE_STEP, visible.end)) {
      poseOnRoute(visible.route, at, position, direction);
      const railY = position.y;
      position.y += EYE_HEIGHT;
      let seen = false;
      for (const signal of data.signals) {
        if (signal.lane !== visible.lane || signal.position.distanceTo(position) > SIGNAL_MAX_DISTANCE) continue;
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
        if (!hit || hit.timeOfImpact >= length - SIGNAL_HIT_TOLERANCE) {
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
        distance = Math.min(distance, Math.hypot(position.x - safe.x, position.z - safe.z) + REFUGE_ENTRY_MARGIN);
      }
      if (distance / ESCAPE_SPEED + REACTION_TIME > config.warning)
        return yield* new TrainLevelError({ message: `Refuge trop loin : ${visible.lane} à ${at.toFixed(1)} m.` });
      samples++;
      if (at === visible.end) break;
    }
  }
  return { samples };
});
