import { FIXED_DT } from "../../core/loop";
import { inputRecorder, type Recording } from "../../core/inputRecorder";
import { moveConfig } from "../player/moveConfig";
import { type GameSession } from "./gameSession";
import { type GameEngine } from "./gameEngine";

// Harnais F9/F10 (voir `game/loop/devGameplayInput.ts` pour la détection des
// touches, `game/devtools/consoleApi.ts` pour l'exposition console).
// see: docs/systems/session.md#harnais-f9-et-f10

export function startRecording(engine: GameEngine, session: GameSession): void {
  inputRecorder.startRecording(
    {
      position: { x: session.player.position.x, y: session.player.position.y, z: session.player.position.z },
      velocity: { x: session.player.velocity.x, y: session.player.velocity.y, z: session.player.velocity.z },
      yaw: engine.look.yaw,
      pitch: engine.look.pitch,
    },
    FIXED_DT,
  );
}

export function startPlayback(engine: GameEngine, session: GameSession, rec: Recording): void {
  const feetY = rec.start.position.y - (moveConfig.capsuleHalfHeight + moveConfig.capsuleRadius);
  session.player.spawn(rec.start.position.x, feetY, rec.start.position.z);
  session.player.velocity.set(rec.start.velocity.x, rec.start.velocity.y, rec.start.velocity.z);
  engine.look.yaw = rec.start.yaw;
  engine.look.pitch = rec.start.pitch;
  inputRecorder.startPlayback(rec);
}
