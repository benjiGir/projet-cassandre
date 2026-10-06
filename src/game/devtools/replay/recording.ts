import { FIXED_DT } from "../../../core/loop/loop";
import { inputRecorder } from "../../../core/input/inputRecorder";
import { type Recording } from "../../../core/input/inputTypes";
import { moveConfig } from "../../player/movement/moveConfig";
import { type GameSession } from "../../session/gameSession";
import { type GameEngine } from "../../session/gameEngine";
// Harnais F9/F10 (voir `game/loop/devGameplayInput.ts` pour la détection des
// touches, `game/devtools/consoleApi.ts` pour l'exposition console).
// see: docs/archive/systems-session.md#harnais-f9-et-f10

export function startRecording(engine: GameEngine, session: GameSession): void {
  session.gltfLevelSession?.current?.trains?.reset();
  session.trainGym?.system.enqueue({ type: "reset" });
  session.trainRideGym?.system.enqueue("reset");
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
  session.gltfLevelSession?.current?.trains?.reset();
  session.trainGym?.system.enqueue({ type: "reset" });
  session.trainRideGym?.system.enqueue("reset");
  inputRecorder.startPlayback(rec);
}
