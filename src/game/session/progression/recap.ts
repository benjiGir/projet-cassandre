import { useGameStore } from "../../hud/state";
import { submitRun } from "../../settings/records";
import type { GameSession } from "../gameSession";
import { streamRecap } from "../stream/streamSim";
import { DIFFICULTY_INFO } from "./difficulty";
import { buildLevelRecap } from "./score";
// Publié à la mort ou à la fin, jamais par image. `completed` : le niveau est
// terminé — le bonus de chrono compte, et la partie s'inscrit aux records.
export function publishLevelRecap(session: GameSession, completed: boolean): void {
  const recap = buildLevelRecap({
    stats: session.stats,
    suitTotal: session.suitManager.suits.length,
    directorTotal: session.directorManager.directors.length,
    secretsFound: session.secretsFound,
    secretsTotal: session.secretsTotal,
    parTimeSeconds: completed ? (session.choice.parTime ?? null) : null,
    difficulty: DIFFICULTY_INFO[session.difficulty].label,
  });
  if (completed) {
    recap.record = submitRun(session.choice.id, session.difficulty, recap.total, recap.elapsedSeconds);
  }
  useGameStore.getState().setRecap(recap);
  useGameStore.getState().setLiveRecap(streamRecap(session.stream));
}
