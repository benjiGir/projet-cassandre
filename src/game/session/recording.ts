import { FIXED_DT } from "../../core/loop";
import { inputRecorder, type Recording } from "../../core/inputRecorder";
import { moveConfig } from "../player/moveConfig";
import { type GameSession } from "./gameSession";
import { type GameEngine } from "./gameEngine";

/**
 * Extraction du refactor de `main.ts` (2229 lignes → modules, 2026-09-05) :
 * `startRecording`/`startPlayback` (harnais F9/F10, voir `game/loop/updateFx.ts`
 * et `game/devtools/consoleApi.ts`) déplacées telles quelles, `engine`/
 * `session` en paramètres explicites au lieu d'une fermeture sur le scope
 * de `main()`.
 */

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
