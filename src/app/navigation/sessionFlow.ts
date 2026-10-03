import { createElement } from "react";
import type { Root } from "react-dom/client";

import { input } from "../../core/input/input";
import { beginLoading, finishLoading, letBrowserPaint, waitForLoadingRetry } from "../../core/loading/loadingProgress";
import { bootGameSession, teardownGameSession } from "../../game/session/lifecycle";
import type { GameEngine, PersistentEngine } from "../../game/session/gameEngine";
import type { GameSession } from "../../game/session/gameSession";
import type { LevelDef } from "../../game/level/catalog/levels";
import { App } from "../../ui/App/App";
import type { GameFlowActor } from "./gameFlowMachine";
import { resolveBootChoice } from "./bootChoice";

export async function bootGameSessionWithRetry(
  engine: PersistentEngine,
  choice: LevelDef,
  actor: GameFlowActor,
): Promise<GameSession> {
  while (true) {
    try {
      return await bootGameSession(engine, choice);
    } catch (error) {
      actor.send({ type: "LOAD_FAILED" });
      await waitForLoadingRetry(error);
      actor.send({ type: "RETRY_LOAD" });
      beginLoading("Préparation des ramassages", 0.3);
    }
  }
}

export async function waitForGameSessionReady(actor: GameFlowActor, session: GameSession): Promise<boolean> {
  const levelSession = session.gltfLevelSession;
  if (levelSession) {
    let result = await levelSession.firstLoad;
    while (result.status === "failed") {
      actor.send({ type: "LOAD_FAILED" });
      await waitForLoadingRetry(result.error);
      actor.send({ type: "RETRY_LOAD" });
      beginLoading("Nouvelle tentative", 0.3);
      result = await levelSession.reload();
    }
    if (result.status === "cancelled") return false;
  }
  finishLoading();
  actor.send({ type: "PLAY" });
  return true;
}

export interface SessionFlow {
  replay(): Promise<void>;
  returnToMenu(): Promise<void>;
  resume(): void;
}

export function createSessionFlow(engine: GameEngine, root: Root, actor: GameFlowActor): SessionFlow {
  let transitionInFlight: Promise<void> | null = null;

  function runTransition(operation: () => Promise<void>): Promise<void> {
    if (transitionInFlight) return transitionInFlight;
    transitionInFlight = operation().finally(() => {
      transitionInFlight = null;
    });
    return transitionInFlight;
  }

  function replay(): Promise<void> {
    return runTransition(replaySession);
  }

  function returnToMenu(): Promise<void> {
    return runTransition(returnToMenuSession);
  }

  async function replaySession(): Promise<void> {
    const choice = engine.session.choice;
    actor.send({ type: "REPLAY" });
    beginLoading("Redémarrage de la partie", 0.02);
    await letBrowserPaint();
    await teardownGameSession(engine, engine.session);
    engine.session = await bootGameSessionWithRetry(engine, choice, actor);
    await waitForGameSessionReady(actor, engine.session);
  }

  async function returnToMenuSession(): Promise<void> {
    actor.send({ type: "RETURN_TO_MENU" });
    await teardownGameSession(engine, engine.session);
    const url = new URL(window.location.href);
    url.searchParams.delete("level");
    window.history.replaceState(null, "", url.toString());
    const choice = await resolveBootChoice(root);
    actor.send({ type: "BEGIN_LOAD" });
    beginLoading("Démarrage", 0.02);
    root.render(createElement(App, {
      onReplay: () => void replay(),
      onReturnToMenu: () => void returnToMenu(),
      onResume: resume,
    }));
    await letBrowserPaint();
    engine.session = await bootGameSessionWithRetry(engine, choice, actor);
    await waitForGameSessionReady(actor, engine.session);
  }

  function resume(): void {
    input.clearPendingEdges();
    input.requestPointerLockNow();
    actor.send({ type: "RESUME" });
  }

  return { replay, returnToMenu, resume };
}
