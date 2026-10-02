import { useGameStore } from "../state";
import type { GameSession } from "./gameSession";
import { buildLevelRecap } from "./score";
// Publié à la mort ou à la fin, jamais par image.
export function publishLevelRecap(session: GameSession, includeTimeBonus: boolean): void {
  const recap = buildLevelRecap({
    stats: session.stats,
    suitTotal: session.suitManager.suits.length,
    directorTotal: session.directorManager.directors.length,
    secretsFound: session.secretsFound,
    secretsTotal: session.secretsTotal,
    parTimeSeconds: includeTimeBonus ? (session.choice.parTime ?? null) : null,
  });
  useGameStore.getState().setRecap(recap);
}
