import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { runGameplaySync } from "../../../app/runtime/gameRuntime";
import { RaycastService } from "../../../physics/raycast";
import { GROUP, interactionGroups } from "../../../physics/world";
import type { SurfaceProbe } from "../../../render/fx/goreConfig";
import { isMovableOrBreakableHandle } from "../../level/loading/movableColliders";
import type { GameSession } from "../gameSession";

// Ce qui peut recevoir une marque durable (impact, tache) : le décor statique
// du niveau, et lui seul — voir `level/loading/movableColliders.ts`.

type ProbeSession = Pick<GameSession, "physics" | "gltfLevelSession">;

// Le mobilier (`prop_*`) est hors du groupe WORLD : ce filtre l'écarte déjà.
const STATIC_GROUPS = interactionGroups(GROUP.PLAYER_SHOT, GROUP.WORLD);

/** Sonde du décor statique de CETTE partie, pour les effets qui s'y posent — voir `render/fx/gore.ts`. */
export function createStaticSurfaceProbe(session: ProbeSession): SurfaceProbe {
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const isStatic = (collider: RAPIER.Collider) =>
    !isMovableOrBreakableHandle(session.gltfLevelSession, collider.handle);
  return (origin, direction, maxDistance) => {
    ray.origin.x = origin.x;
    ray.origin.y = origin.y;
    ray.origin.z = origin.z;
    ray.dir.x = direction.x;
    ray.dir.y = direction.y;
    ray.dir.z = direction.z;
    const hit = runGameplaySync(
      RaycastService.use((raycast) =>
        raycast.castRayAndGetNormal(
          session.physics,
          ray,
          maxDistance,
          true,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          STATIC_GROUPS,
          undefined,
          undefined,
          isStatic,
        ),
      ),
    );
    // Départ à l'intérieur d'un collider : aucune surface à marquer.
    if (!hit || hit.timeOfImpact <= 1e-4) return null;
    const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
    if (normal.lengthSq() < 1e-8) return null;
    normal.normalize();
    // Un trimesh rend la normale de sa face, d'un côté ou de l'autre : on la veut face au rayon.
    if (normal.dot(direction) > 0) normal.negate();
    return { point: new THREE.Vector3().copy(origin).addScaledVector(direction, hit.timeOfImpact), normal };
  };
}
