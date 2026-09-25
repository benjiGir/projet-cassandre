import { input } from "../../core/input";
import { inputRecorder } from "../../core/inputRecorder";
import { moveConfig } from "../player/moveConfig";
import { type GameEngine } from "../session/gameEngine";

type DisplayInputEngine = Pick<GameEngine, "look" | "lookDelta">;

/**
 * Capture la rotation brute une fois par frame d'affichage, avant tout pas
 * fixe. Le tir du premier pas voit ainsi la même visée que l'image rendue.
 */
export function updateDisplayInput(engine: DisplayInputEngine): void {
  const { dx, dy } = input.consumeMouseDelta();
  if (inputRecorder.isPlaying()) return;

  engine.lookDelta.dx += dx;
  engine.lookDelta.dy += dy;
  engine.look.yaw -= dx * moveConfig.lookSensitivity;
  engine.look.pitch -= dy * moveConfig.lookSensitivity;
  const pitchLimit = (moveConfig.pitchLimitDeg * Math.PI) / 180;
  engine.look.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, engine.look.pitch));
}
