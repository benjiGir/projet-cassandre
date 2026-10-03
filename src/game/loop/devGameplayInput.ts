import { input } from "../../core/input/input";
import { inputRecorder } from "../../core/input/inputRecorder";
import { toggleNotarget } from "../devtools/cheats";
import type { GameEngine } from "../session/gameEngine";
import type { GameSession } from "../session/gameSession";
import { showHudMessage } from "../session/player/feedback";
import { startPlayback, startRecording } from "../devtools/replay/recording";
/** Les commandes de dev qui modifient le jeu sont consommées une fois dans le pas fixe. */
export function handleDevGameplayInput(engine: GameEngine, session: GameSession): void {
  if (input.consumeJustPressed("F9")) {
    if (inputRecorder.isRecording()) {
      engine.lastRecording = inputRecorder.stopRecording();
      console.info(`[recorder] ${engine.lastRecording?.frames.length ?? 0} pas fixes enregistrés`);
    } else {
      startRecording(engine, session);
      console.info("[recorder] enregistrement démarré");
    }
  }
  if (input.consumeJustPressed("F10") && engine.lastRecording) {
    startPlayback(engine, session, engine.lastRecording);
    console.info(`[recorder] rejeu de ${engine.lastRecording.frames.length} pas fixes`);
  }
  if (input.consumeJustPressed("F8")) {
    const on = toggleNotarget();
    showHudMessage(on ? "Dev : ennemis passifs" : "Dev : ennemis à nouveau hostiles");
    console.info(`[debug] notarget ${on ? "activé" : "désactivé"}`);
  }
}
