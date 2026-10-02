// see: docs/6-reference/notes-code-core.md#entrées
export type GameAction =
  | "moveForward"
  | "moveBack"
  | "moveLeft"
  | "moveRight"
  | "sprint"
  | "jump"
  | "fire"
  | "switchMelee"
  | "switchPistol"
  | "switchShotgun"
  | "use";

// see: docs/6-reference/notes-code-core.md#rejeu-et-horloge
export interface InputFrame {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  // Un appui consommé déclenche un seul saut.
  jump: boolean;
  sprint: boolean;
  fire: boolean;
  switchToMelee: boolean;
  switchToPistol: boolean;
  switchToShotgun: boolean;
  use: boolean;
  yaw: number;
  pitch: number;
  dx: number;
  dy: number;
}

export interface RecordingStart {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
}

export interface Recording {
  version: 1;
  fixedDt: number;
  start: RecordingStart;
  frames: InputFrame[];
}
