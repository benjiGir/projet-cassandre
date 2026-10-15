import type * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Effect } from "effect";
import { GROUP, interactionGroups, type PhysicsWorld } from "../../../physics/world";
import { RaycastService } from "../../../physics/raycast";
import { suitConfig } from "../../entities/suit/suitConfig";
import { NAV_CELL_SIZE, DIRS, FORWARD_DIR_INDICES } from "./navGraph";
import type { NavGraph } from "./pathfindingTypes";

/** Marge au-dessus/au-dessous de l'AABB fournie pour l'origine/la portée du rayon vertical descendant — purement défensif contre une géométrie exactement affleurante aux bornes de `bounds`. */
const RAY_MARGIN_UP = 2;

const RAY_MARGIN_DOWN = 2;

// see: docs/6-reference/notes-code-gameplay-niveau.md#navigation
const MIN_FLOOR_NORMAL_Y = Math.cos((suitConfig.maxSlopeClimbAngleDeg * Math.PI) / 180);

/** Marche verticale maximale du KCC ennemi. Les pentes continues sont
 * traitées à part avec l'angle de montée du même contrôleur.
 * see: docs/archive/systems-pathfinding.md#la-marche-verticale-maximale-entre-deux-cellules-reliées-max_step_height */
const MAX_STEP_HEIGHT = suitConfig.autostepMaxHeight;

/** Décalage vertical du centre de la capsule de test d'élagage au-dessus du sol détecté — évite qu'une capsule tangente au sol touche par accident un collider adjacent qui affleure aussi au niveau du sol (ex. le pied d'un mur). */
const STAND_CLEARANCE = 0.05;

/** Filtre « rayon d'ENEMY qui ne teste QUE la géométrie du niveau » —
 * DUPLIQUÉ depuis `suit.ts`/`director.ts` (aucun des deux ne l'exporte). */
const WORLD_ONLY_RAY_GROUPS = interactionGroups(GROUP.ENEMY, GROUP.WORLD);

/** Rotation identité, réutilisée pour `intersectionsWithShape` (capsule verticale, axe local Y déjà vertical — pas de rotation nécessaire, contrairement à la capsule horizontale du pied-de-biche dans `weapons.ts`). */
const IDENTITY_ROTATION: RAPIER.Rotation = { x: 0, y: 0, z: 0, w: 1 };

/** Implémentation réelle de `PathfindingServiceShape.bake`. Toutes les
 * requêtes physiques passent par `RaycastService`, jamais un accès direct à
 * `physics.world.*`. see: docs/archive/systems-pathfinding.md#comment-le-graphe-est-construit */
export const bakeNavGraphEffect = (
  physics: PhysicsWorld,
  bounds: THREE.Box3,
): Effect.Effect<NavGraph, never, RaycastService> =>
  Effect.gen(function* () {
    const raycast = yield* RaycastService;

    const cellSize = NAV_CELL_SIZE;
    const originX = bounds.min.x;
    const originZ = bounds.min.z;
    const cols = Math.max(1, Math.floor((bounds.max.x - originX) / cellSize) + 1);
    const rows = Math.max(1, Math.floor((bounds.max.z - originZ) / cellSize) + 1);
    const size = cols * rows;

    const groundY = new Float32Array(size).fill(Number.NaN);
    const floorNormalY = new Float32Array(size);
    const walkable = new Uint8Array(size);
    const neighborMask = new Uint8Array(size);

    const rayOriginY = bounds.max.y + RAY_MARGIN_UP;
    const rayLength = bounds.max.y - bounds.min.y + RAY_MARGIN_UP + RAY_MARGIN_DOWN;

    const { capsuleRadius, capsuleHalfHeight, eyeHeight } = suitConfig;
    const standingCapsule = new RAPIER.Capsule(capsuleHalfHeight, capsuleRadius);
    const verticalRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    const horizontalRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    const capsuleStart: RAPIER.Vector = { x: 0, y: 0, z: 0 };
    const capsuleVelocity: RAPIER.Vector = { x: 0, y: 0, z: 0 };

    // Passe 1 : hauteur de sol + élagage, cellule par cellule.
    for (let iz = 0; iz < rows; iz++) {
      for (let ix = 0; ix < cols; ix++) {
        const idx = iz * cols + ix;
        const worldX = originX + ix * cellSize;
        const worldZ = originZ + iz * cellSize;

        verticalRay.origin.x = worldX;
        verticalRay.origin.y = rayOriginY;
        verticalRay.origin.z = worldZ;

        const hit = yield* raycast.castRayAndGetNormal(
          physics,
          verticalRay,
          rayLength,
          true,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          WORLD_ONLY_RAY_GROUPS,
        );
        if (!hit || hit.normal.y < MIN_FLOOR_NORMAL_Y) continue;

        const groundHeight = rayOriginY - hit.timeOfImpact;

        const standCenterY = groundHeight + STAND_CLEARANCE + capsuleHalfHeight + capsuleRadius;
        const overlaps = yield* raycast.intersectionsWithShape(
          physics,
          { x: worldX, y: standCenterY, z: worldZ },
          IDENTITY_ROTATION,
          standingCapsule,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          WORLD_ONLY_RAY_GROUPS,
          hit.collider,
        );
        if (overlaps.length > 0) continue; // pas assez de dégagement vertical pour se tenir debout ici.

        groundY[idx] = groundHeight;
        floorNormalY[idx] = hit.normal.y;
        walkable[idx] = 1;
      }
    }

    // Passe 2 : arêtes, une seule fois par paire (voir FORWARD_DIR_INDICES).
    for (let iz = 0; iz < rows; iz++) {
      for (let ix = 0; ix < cols; ix++) {
        const idx = iz * cols + ix;
        if (walkable[idx] !== 1) continue;

        for (const dirIndex of FORWARD_DIR_INDICES) {
          const dir = DIRS[dirIndex];
          const nx = ix + dir.dx;
          const nz = iz + dir.dz;
          if (nx < 0 || nx >= cols || nz < 0 || nz >= rows) continue;

          const nIdx = nz * cols + nx;
          if (walkable[nIdx] !== 1) continue;

          const heightDiff = Math.abs(groundY[nIdx] - groundY[idx]);
          const horizontalDistance = cellSize * Math.hypot(dir.dx, dir.dz);
          const touchesRamp = floorNormalY[idx] < 0.999 || floorNormalY[nIdx] < 0.999;
          const rampRise = Math.tan((suitConfig.maxSlopeClimbAngleDeg * Math.PI) / 180) * horizontalDistance;
          if (heightDiff > (touchesRamp ? rampRise + STAND_CLEARANCE : MAX_STEP_HEIGHT)) continue;

          const fromX = originX + ix * cellSize;
          const fromZ = originZ + iz * cellSize;
          const toX = originX + nx * cellSize;
          const toZ = originZ + nz * cellSize;
          const rayY = (groundY[idx] + groundY[nIdx]) / 2 + eyeHeight;

          const dxw = toX - fromX;
          const dzw = toZ - fromZ;
          const dist = Math.hypot(dxw, dzw);

          horizontalRay.origin.x = fromX;
          horizontalRay.origin.y = rayY;
          horizontalRay.origin.z = fromZ;
          horizontalRay.dir.x = dxw / dist;
          horizontalRay.dir.y = 0;
          horizontalRay.dir.z = dzw / dist;

          const wallHit = yield* raycast.castRay(
            physics,
            horizontalRay,
            Math.max(0, dist - 0.05),
            true,
            RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
            WORLD_ONLY_RAY_GROUPS,
          );
          if (wallHit) continue; // mur entre les deux cellules.

          if (!touchesRamp) {
            capsuleStart.x = fromX;
            capsuleStart.y =
              Math.max(groundY[idx], groundY[nIdx]) + STAND_CLEARANCE + capsuleHalfHeight + capsuleRadius;
            capsuleStart.z = fromZ;
            capsuleVelocity.x = dxw;
            capsuleVelocity.y = 0;
            capsuleVelocity.z = dzw;
            const blocked = yield* raycast.castShape(
              physics,
              capsuleStart,
              IDENTITY_ROTATION,
              capsuleVelocity,
              standingCapsule,
              0,
              1,
              false,
              RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
              WORLD_ONLY_RAY_GROUPS,
            );
            if (blocked) continue;
          }

          neighborMask[idx] |= 1 << dirIndex;
          neighborMask[nIdx] |= 1 << ((dirIndex + 4) % 8);
        }
      }
    }

    // Une diagonale ne coupe pas l'angle de deux obstacles : les deux chemins
    // orthogonaux qui la bordent doivent être physiquement ouverts.
    for (let iz = 0; iz < rows; iz++) {
      for (let ix = 0; ix < cols; ix++) {
        const idx = iz * cols + ix;
        for (const dirIndex of [3, 5]) {
          if ((neighborMask[idx] & (1 << dirIndex)) === 0) continue;
          const dir = DIRS[dirIndex];
          const nIdx = (iz + dir.dz) * cols + ix + dir.dx;
          const horizontal = dir.dx > 0 ? 2 : 6;
          const vertical = dir.dz > 0 ? 4 : 0;
          const oppositeHorizontal = (horizontal + 4) % 8;
          const oppositeVertical = (vertical + 4) % 8;
          if (
            (neighborMask[idx] & (1 << horizontal)) !== 0 &&
            (neighborMask[idx] & (1 << vertical)) !== 0 &&
            (neighborMask[nIdx] & (1 << oppositeHorizontal)) !== 0 &&
            (neighborMask[nIdx] & (1 << oppositeVertical)) !== 0
          )
            continue;
          neighborMask[idx] &= ~(1 << dirIndex);
          neighborMask[nIdx] &= ~(1 << ((dirIndex + 4) % 8));
        }
      }
    }

    return { cellSize, cols, rows, originX, originZ, groundY, walkable, neighborMask };
  });
