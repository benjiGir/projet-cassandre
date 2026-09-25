import { createElement } from "react";
import type { Root } from "react-dom/client";

import { input } from "../core/input";
import { beginLoading, finishLoading, letBrowserPaint, waitForLoadingRetry } from "../core/loadingProgress";
import { bootGameSession, teardownGameSession } from "../game/session/lifecycle";
import type { GameEngine } from "../game/session/gameEngine";
import type { GameSession } from "../game/session/gameSession";
import { App } from "../ui/App";
import type { GameFlowActor } from "../ui/gameFlowMachine";
import { resolveBootChoice } from "./bootChoice";

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
  async function replay(): Promise<void> {
    const choice = engine.session.choice;
    actor.send({ type: "REPLAY" });
    beginLoading("Redémarrage de la partie", 0.02);
    await letBrowserPaint();
    await teardownGameSession(engine, engine.session);
    engine.session = bootGameSession(engine, choice);
    await waitForGameSessionReady(actor, engine.session);
  }

  async function returnToMenu(): Promise<void> {
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
    engine.session = bootGameSession(engine, choice);
    await waitForGameSessionReady(actor, engine.session);
  }

  function resume(): void {
    input.clearPendingEdges();
    input.requestPointerLockNow();
    actor.send({ type: "RESUME" });
  }

  return { replay, returnToMenu, resume };
}
