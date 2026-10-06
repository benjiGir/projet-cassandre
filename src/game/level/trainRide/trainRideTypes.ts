export type TrainRidePhase = "boarding" | "closing" | "accelerating" | "cruising" | "braking" | "arrived";
export type TrainRideCommand = "depart" | "reset";
export type TrainRideEvent = "depart" | "wave" | "arrived" | "reset";

export interface TrainRideConfig {
  speed: number;
  duration: number;
  acceleration: number;
  braking: number;
  waveDelay: number;
  combat: boolean;
}

export interface TrainRideState {
  phase: TrainRidePhase;
  elapsed: number;
  distance: number;
  speed: number;
  remaining: number;
}
