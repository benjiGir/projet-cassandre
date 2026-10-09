import * as THREE from "three";
import { TRAIN_CAR_LENGTH, TRAIN_HEIGHT, TRAIN_WIDTH } from "./trainConfig";
import { poseOnRoute } from "./trainPath";
import type { TrainActor, TrainPass } from "./trainTypes";

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const direction = new THREE.Vector3();
const previousDirection = new THREE.Vector3();
const corners = Array.from({ length: 8 }, () => ({ x: 0, z: 0 }));
const hull = new Int32Array(16);
type Point = { x: number; z: number };

function cross(p: Point, q: Point, r: Point): number {
  return (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
}

function convexHull(): number {
  corners.sort((p, q) => p.x - q.x || p.z - q.z);
  let size = 0;
  for (let i = 0; i < 8; i++) {
    while (size >= 2 && cross(corners[hull[size - 2]!]!, corners[hull[size - 1]!]!, corners[i]!) <= 0) size--;
    hull[size++] = i;
  }
  const lower = size + 1;
  for (let i = 6; i >= 0; i--) {
    while (size >= lower && cross(corners[hull[size - 2]!]!, corners[hull[size - 1]!]!, corners[i]!) <= 0) size--;
    hull[size++] = i;
  }
  return size - 1;
}

function inside(p: Point, size: number): boolean {
  for (let i = 0; i < size; i++) {
    if (cross(corners[hull[i]!]!, corners[hull[(i + 1) % size]!]!, p) < -1e-9) return false;
  }
  return true;
}

function pointSegmentDistanceSq(p: Point, start: Point, end: Point): number {
  const dx = end.x - start.x, dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq > 0 ? THREE.MathUtils.clamp(((p.x - start.x) * dx + (p.z - start.z) * dz) / lengthSq, 0, 1) : 0;
  return (p.x - start.x - dx * t) ** 2 + (p.z - start.z - dz * t) ** 2;
}

function segmentsDistanceSq(p: Point, q: Point, start: Point, end: Point): number {
  const ux = q.x - p.x, uz = q.z - p.z, vx = end.x - start.x, vz = end.z - start.z;
  const det = ux * vz - uz * vx;
  if (Math.abs(det) > 1e-9) {
    const wx = start.x - p.x, wz = start.z - p.z;
    const t = (wx * vz - wz * vx) / det;
    const s = (wx * uz - wz * ux) / det;
    if (t >= 0 && t <= 1 && s >= 0 && s <= 1) return 0;
  }
  return Math.min(pointSegmentDistanceSq(p, start, end), pointSegmentDistanceSq(q, start, end),
    pointSegmentDistanceSq(start, p, q), pointSegmentDistanceSq(end, p, q));
}

// Le volume balayé reste indépendant du collider : aucune capsule n'est transportée par une rame.
// see: docs/4-technique/trains-metro.md#contact-mortel
export function trainTouchesActor(pass: TrainPass, actor: TrainActor): boolean {
  const halfLength = (TRAIN_CAR_LENGTH - .35) / 2;
  for (let car = 0; car < Math.round(pass.length / TRAIN_CAR_LENGTH); car++) {
    const offset = (car + .5) * TRAIN_CAR_LENGTH;
    if (pass.front-offset < (pass.route.visibleStart ?? -Infinity) - (pass.route.visualPadding ?? 0) || pass.previousFront-offset > (pass.route.visibleEnd ?? Infinity) + (pass.route.visualPadding ?? 0)) continue;
    poseOnRoute(pass.route, pass.previousFront - offset, a, previousDirection);
    poseOnRoute(pass.route, pass.front - offset, b, direction);
    if (Math.min(actor.position.y, actor.previous.y) - actor.halfHeight > Math.max(a.y, b.y) + TRAIN_HEIGHT ||
        Math.max(actor.position.y, actor.previous.y) + actor.halfHeight < Math.min(a.y, b.y)) continue;
    previousDirection.y = direction.y = 0;
    previousDirection.normalize(); direction.normalize();
    const angle = Math.acos(THREE.MathUtils.clamp(previousDirection.dot(direction), -1, 1));
    const margin = Math.hypot(halfLength, TRAIN_WIDTH / 2) * (1 - Math.cos(angle / 2))
      + a.distanceTo(b) * Math.sin(angle / 2);
    for (let pose = 0; pose < 2; pose++) {
      const center = pose === 0 ? a : b, forward = pose === 0 ? previousDirection : direction;
      for (let i = 0; i < 4; i++) {
        const along = i < 2 ? -halfLength : halfLength;
        const side = i % 2 ? TRAIN_WIDTH / 2 : -TRAIN_WIDTH / 2;
        corners[pose * 4 + i]!.x = center.x + forward.x * along + forward.z * side;
        corners[pose * 4 + i]!.z = center.z + forward.z * along - forward.x * side;
      }
    }
    const size = convexHull(), radiusSq = (actor.radius + margin) ** 2;
    if (inside(actor.previous, size) || inside(actor.position, size)) return true;
    for (let i = 0; i < size; i++) {
      if (segmentsDistanceSq(actor.previous, actor.position, corners[hull[i]!]!, corners[hull[(i + 1) % size]!]!) <= radiusSq) return true;
    }
  }
  return false;
}
