import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { loadingSnapshot } from "../../../src/core/loadingProgress";
import type { LevelHandle } from "../../../src/game/level/loader";
import type { PersistentEngine } from "../../../src/game/session/gameEngine";
import type { GameSession } from "../../../src/game/session/gameSession";
import { teardownGameSession } from "../../../src/game/session/lifecycle";
import { waitForGameSessionReady } from "../../../src/app/sessionFlow";
import { createGameFlowActor } from "../../../src/ui/gameFlowMachine";

describe("cycle de vie d'une GameSession", () => {
  it("attend l'arrêt du niveau avant de libérer le monde Rapier", async () => {
    let finishStop!: () => void;
    const stop = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishStop = resolve;
        }),
    );
    const free = vi.fn();
    const resetSession = vi.fn();
    const session = {
      gltfLevelSession: { stop },
      levelLoadGeneration: 3,
      gymRoot: null,
      suitSprites: new Map(),
      directorSprites: new Map(),
      droppedCardMesh: null,
      physics: { world: { free } },
    } as unknown as GameSession;
    const engine = {
      scene: new THREE.Scene(),
      fx: { resetSession },
    } as unknown as PersistentEngine;

    const tearingDown = teardownGameSession(engine, session);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(session.levelLoadGeneration).toBe(4);
    expect(free).not.toHaveBeenCalled();

    finishStop();
    await tearingDown;
    expect(resetSession).toHaveBeenCalledTimes(1);
    expect(free).toHaveBeenCalledTimes(1);
  });

  it("reste hors de playing après un premier échec, puis entre en jeu après retry", async () => {
    const actor = createGameFlowActor();
    actor.send({ type: "BEGIN_LOAD" });
    const boom = new Error("niveau invalide");
    const handle = {} as LevelHandle;
    const reload = vi.fn().mockResolvedValue({
      status: "committed",
      handle,
      isFirstLoad: true,
    });
    const session = {
      gltfLevelSession: {
        firstLoad: Promise.resolve({ status: "failed", error: boom, previousRetained: false }),
        reload,
      },
    } as unknown as GameSession;
    const waiting = waitForGameSessionReady(actor, session);
    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe("loadFailed"));
    expect(reload).not.toHaveBeenCalled();

    const failed = loadingSnapshot();
    if (failed?.status !== "failed") throw new Error("état d'échec attendu");
    failed.retry();

    await expect(waiting).resolves.toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(actor.getSnapshot().value).toBe("playing");
  });
});
