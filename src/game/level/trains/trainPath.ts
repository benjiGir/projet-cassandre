import * as THREE from "three";
import type { TrainRoute } from "./trainTypes";

const delta = new THREE.Vector3();
const offset = new THREE.Vector3();
const projected = new THREE.Vector3();

export function routeLength(route: TrainRoute): number {
  let length = 0;
  for (let i = 1; i < route.points.length; i++) length += route.points[i - 1]!.distanceTo(route.points[i]!);
  return length;
}

export function poseOnRoute(route: TrainRoute, distance: number, position: THREE.Vector3, direction: THREE.Vector3): void {
  for (let i = 1; i < route.points.length; i++) {
    const start = route.points[i - 1]!;
    const end = route.points[i]!;
    direction.subVectors(end, start);
    const length = direction.length();
    direction.divideScalar(length);
    if (distance <= length || i === route.points.length - 1) {
      position.copy(start).addScaledVector(direction, distance);
      return;
    }
    distance -= length;
  }
}

export function distanceAlongRoute(route: TrainRoute, point: THREE.Vector3): number {
  let travelled = 0;
  let nearest = Infinity;
  let result = 0;
  for (let i = 1; i < route.points.length; i++) {
    const start = route.points[i - 1]!;
    const end = route.points[i]!;
    delta.subVectors(end, start);
    const length = delta.length();
    const along = THREE.MathUtils.clamp(offset.subVectors(point, start).dot(delta) / length, 0, length);
    const distance = point.distanceToSquared(projected.copy(start).addScaledVector(delta, along / length));
    if (distance < nearest) { nearest = distance; result = travelled + along; }
    travelled += length;
  }
  return result;
}
