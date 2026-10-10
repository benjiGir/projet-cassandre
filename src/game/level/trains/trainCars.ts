import * as THREE from "three";
import { TRAIN_CAR_LENGTH } from "./trainConfig";
import { poseOnRoute } from "./trainPath";
import type { TrainPass, TrainRoute } from "./trainTypes";

const direction = new THREE.Vector3();

/** Distance, le long du trajet, du centre de la voiture `car` d'une rame dont le nez est à `front`. */
export function carDistance(front: number, car: number): number {
  return front - (car + 0.5) * TRAIN_CAR_LENGTH;
}

/** Début de la portion du trajet où une voiture existe : affichée, heurtable, mortelle. */
export function stageStart(route: TrainRoute): number {
  return (route.visibleStart ?? -Infinity) - (route.visualPadding ?? 0);
}

export function stageEnd(route: TrainRoute): number {
  return (route.visibleEnd ?? Infinity) + (route.visualPadding ?? 0);
}

export function carOnStage(route: TrainRoute, distance: number): boolean {
  return distance >= stageStart(route) && distance <= stageEnd(route);
}

/** Pose monde de la voiture `car` : position sur la voie, lacet seul. */
export function poseCar(
  pass: TrainPass,
  front: number,
  car: number,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
): void {
  poseOnRoute(pass.route, carDistance(front, car), position, direction);
  rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(direction.x, direction.z));
}
