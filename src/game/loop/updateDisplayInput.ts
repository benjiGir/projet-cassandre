import { input } from "../../core/input/input";
import { inputRecorder } from "../../core/input/inputRecorder";
import { moveConfig } from "../player/movement/moveConfig";
import { type GameEngine } from "../session/gameEngine";
type DisplayInputEngine = Pick<GameEngine, "look" | "lookDelta">;

// see: docs/6-reference/notes-code-gameplay.md#boucle-et-présentation
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
