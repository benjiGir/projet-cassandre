import { createElement } from "react";
import type { Root } from "react-dom/client";

import { input } from "../../core/input/input";
import { beginLoading, finishLoading, letBrowserPaint, waitForLoadingRetry } from "../../core/loading/loadingProgress";
import { bootGameSession, teardownGameSession } from "../../game/session/lifecycle";
import type { GameEngine, PersistentEngine } from "../../game/session/gameEngine";
import type { GameSession } from "../../game/session/gameSession";
import type { LevelDef } from "../../game/level/catalog/levels";
import { useGameStore } from "../../game/hud/state";
import { levelStory } from "../../game/session/presentation/storyPanels";
import { hasSeenIntro, markIntroSeen } from "../../game/settings/storySettings";
import { App, type AppProps } from "../../ui/App/App";
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

/** L'intro du niveau reste à montrer : il en a une, et ce navigateur ne l'a pas encore vue. */
export function introPending(choice: LevelDef): boolean {
  return levelStory(choice.id) !== null && !hasSeenIntro(choice.id);
}

/** `showIntro` : passer par les panneaux d'intro avant de donner la main au joueur. */
export async function waitForGameSessionReady(
  actor: GameFlowActor,
  session: GameSession,
  showIntro = false,
): Promise<boolean> {
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
  const intro = showIntro ? levelStory(session.choice.id)?.intro : undefined;
  if (intro) {
    useGameStore.getState().setStory(intro);
    actor.send({ type: "SHOW_INTRO" });
  } else {
    actor.send({ type: "PLAY" });
  }
  return true;
}

export interface SessionFlow {
  replay(): Promise<void>;
  returnToMenu(): Promise<void>;
  resume(): void;
  /** Fin ou passage des panneaux d'intro : la partie commence. */
  finishIntro(): void;
  /** Fin ou passage des panneaux de fin : le récapitulatif s'affiche. */
  finishOutro(): void;
  /** Les rappels que `App` attend, tous branchés sur ce flux. */
  appProps(): AppProps;
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
    root.render(createElement(App, appProps()));
    await letBrowserPaint();
    engine.session = await bootGameSessionWithRetry(engine, choice, actor);
    await waitForGameSessionReady(actor, engine.session, introPending(choice));
  }

  function resume(): void {
    input.clearPendingEdges();
    input.requestPointerLockNow();
    actor.send({ type: "RESUME" });
  }

  function finishIntro(): void {
    markIntroSeen(engine.session.choice.id);
    useGameStore.getState().setStory(null);
    input.clearPendingEdges();
    input.requestPointerLockNow();
    actor.send({ type: "PLAY" });
  }

  function finishOutro(): void {
    useGameStore.getState().setStory(null);
    actor.send({ type: "LEVEL_COMPLETED" });
  }

  function appProps(): AppProps {
    return {
      onReplay: () => void replay(),
      onReturnToMenu: () => void returnToMenu(),
      onResume: resume,
      onIntroDone: finishIntro,
      onOutroDone: finishOutro,
    };
  }

  return { replay, returnToMenu, resume, finishIntro, finishOutro, appProps };
}
