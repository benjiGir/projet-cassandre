import type * as THREE from "three";

export interface TrainConfig {
  speed: number;
  warning: number;
  interval: number;
  stopDuration: number;
  stopCooldown: number;
  visualWarning: boolean;
  soundWarning: boolean;
}

export interface TrainRoute {
  id: string;
  points: readonly THREE.Vector3[];
}

export interface TrainLaneDef {
  id: string;
  routes: readonly TrainRoute[];
  firstArrival: number;
  enabled?: boolean;
}

export interface TrainPass {
  lane: string;
  route: TrainRoute;
  arrival: number;
  speed: number;
  front: number;
  previousFront: number;
  length: number;
}

export interface TrainActor {
  position: THREE.Vector3;
  previous: THREE.Vector3;
  radius: number;
  halfHeight: number;
}

export type TrainCommand =
  | { type: "switch"; lane: string; route?: string }
  | { type: "stop" | "pass"; lane: string }
  | { type: "enable"; lane: string; enabled: boolean }
  | { type: "reset" };
export interface TrainLaneStatus {
  id: string;
  countdown: number;
  announced: boolean;
  route: string;
  pendingRoute: string | null;
  stopped: number;
  cooldown: number;
  enabled: boolean;
}
