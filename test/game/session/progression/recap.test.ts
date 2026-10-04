/**
 * Publication du récapitulatif (`progression/recap.ts`) : la difficulté de la
 * partie s'y affiche, et seul un niveau TERMINÉ s'inscrit aux records — dans
 * sa difficulté.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useGameStore } from "../../../../src/game/hud/state";
import type { GameSession } from "../../../../src/game/session/gameSession";
import type { Difficulty } from "../../../../src/game/session/progression/difficulty";
import { publishLevelRecap } from "../../../../src/game/session/progression/recap";
import { createInitialStats, recordSuitKills } from "../../../../src/game/session/progression/score";
import { createStreamState } from "../../../../src/game/session/stream/streamSim";
import { recordFor, resetRecords } from "../../../../src/game/settings/records";

function partie(difficulty: Difficulty, kills: number): GameSession {
  const stats = createInitialStats();
  recordSuitKills(stats, kills);
  stats.gameplayElapsed = 500;
  return {
    choice: { id: "niveau_test", label: "Test", kind: "gltf" },
    difficulty,
    stats,
    suitManager: { suits: [] },
    directorManager: { directors: [] },
    secretsFound: 0,
    secretsTotal: 0,
    stream: createStreamState(),
  } as unknown as GameSession;
}

beforeEach(() => {
  useGameStore.getState().resetGameStore();
});

afterEach(() => {
  resetRecords();
});

describe("publishLevelRecap", () => {
  it("un niveau terminé pose le record de sa difficulté, et l'annonce", () => {
    publishLevelRecap(partie("lanceur", 3), true);

    const recap = useGameStore.getState().recap;
    expect(recap?.difficulty).toBe("Lanceur d'alerte");
    expect(recap?.record).toEqual({ best: recap?.total, isNew: true });
    expect(recordFor("niveau_test", "lanceur")).toEqual({ score: recap?.total, seconds: 500 });
    expect(recordFor("niveau_test", "habitue")).toBeNull();
  });

  it("une partie moins bonne rappelle le record sans le toucher", () => {
    publishLevelRecap(partie("habitue", 5), true);
    const best = useGameStore.getState().recap!.total;

    publishLevelRecap(partie("habitue", 1), true);

    expect(useGameStore.getState().recap?.record).toEqual({ best, isNew: false });
  });

  it("une mort affiche la difficulté mais ne pose aucun record", () => {
    publishLevelRecap(partie("client", 9), false);

    const recap = useGameStore.getState().recap;
    expect(recap?.difficulty).toBe("Client");
    expect(recap?.record).toBeNull();
    expect(recordFor("niveau_test", "client")).toBeNull();
  });
});
