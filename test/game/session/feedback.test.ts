import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyPlayerDamage, grantKillViews, presentPlayerDamage } from "../../../src/game/session/feedback";
import { createInitialStats } from "../../../src/game/session/score";
import { useGameStore } from "../../../src/game/state";
import { type GameEngine } from "../../../src/game/session/gameEngine";
import { type GameSession } from "../../../src/game/session/gameSession";

function sessionWithHp(playerHp: number): GameSession {
  return {
    playerHp,
    deathHandled: false,
    lowHpLineTriggered: false,
    stats: createInitialStats(),
    suitManager: { suits: [] },
    directorManager: { directors: [] },
    choice: {},
  } as unknown as GameSession;
}

function engineWithSend(send: (event: { type: string }) => void): GameEngine {
  return { flow: { playerDied: () => send({ type: "DIED" }) } } as unknown as GameEngine;
}

beforeEach(() => {
  useGameStore.getState().resetGameStore();
});

describe("applyPlayerDamage — résolution dans le pas fixe", () => {
  it("applique immédiatement les PV et le compteur de dégâts sans attendre la présentation", () => {
    const send = vi.fn();
    const session = sessionWithHp(100);

    applyPlayerDamage(engineWithSend(send), session, 25);

    expect(session.playerHp).toBe(75);
    expect(session.stats.hpLost).toBe(25);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    [[15]],
    [[7, 8]],
    [Array.from({ length: 15 }, () => 1)],
  ])("déclenche la mort au même pas logique après 1, 2 ou 15 groupes : %j", (groups) => {
    const send = vi.fn();
    const session = sessionWithHp(15);
    const engine = engineWithSend(send);

    for (const amount of groups) applyPlayerDamage(engine, session, amount);

    expect(session.playerHp).toBe(0);
    expect(session.stats.hpLost).toBe(15);
    expect(session.deathHandled).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: "DIED" });
  });

  it("reste idempotent face à un second impact après la mort", () => {
    const send = vi.fn();
    const session = sessionWithHp(5);
    const engine = engineWithSend(send);

    applyPlayerDamage(engine, session, 10);
    applyPlayerDamage(engine, session, 10);

    expect(session.stats.hpLost).toBe(5);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("le gain de vues suit le RNG de session, indépendamment du rendu", () => {
    const session = { viewsRandom: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(1) } as unknown as GameSession;
    grantKillViews(session);
    grantKillViews(session);
    expect(useGameStore.getState().debug.views).toBe(252);
    expect(session.viewsRandom).toHaveBeenCalledTimes(2);
  });

  it("la publication des PV ne modifie aucun drapeau de partie", () => {
    const session = sessionWithHp(25);
    presentPlayerDamage(session.playerHp);
    expect(useGameStore.getState().debug.playerHp).toBe(25);
    expect(session.lowHpLineTriggered).toBe(false);
  });
});
