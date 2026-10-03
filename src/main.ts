import { createElement } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";

import "./ui/theme/tokens.css";

import { initAudio } from "./core/audio";
import { initHeroVoice } from "./core/heroVoice";
import { initZoneAmbience } from "./core/zoneAmbience";
import { installAudioActivation } from "./core/audioPreparation";
import { input } from "./core/input";
import { initWaterAmbience } from "./core/waterAmbience";
import { initShowerAmbience } from "./core/showerAmbience";
import { startLoop } from "./core/loop";
import { runGameplaySync } from "./core/runtime";
import { initPhysics } from "./physics/world";
import { loadEnemySpriteSheetOrPlaceholder } from "./render/enemySprites";
import { RenderService } from "./render/renderService";
import { loadWeaponModelsOrPlaceholder } from "./render/weaponModels";
import { loadCardPickupTextures } from "./render/cardPickups";
import { createGameFlowActor } from "./app/gameFlowMachine";
import { App } from "./ui/App";
import { initAudioSettingsAtBoot } from "./game/audioSettings";
import { initGraphicsSettingsAtBoot, registerRenderTarget } from "./game/graphicsSettings";
import { useGameStore } from "./game/state";
import { resolveBootChoice } from "./app/bootChoice";
import { bootGameSessionWithRetry, createSessionFlow, waitForGameSessionReady } from "./app/sessionFlow";
import { buildGameEngine, type GameEngine } from "./game/session/gameEngine";
import { snapshotPrevious, stepPhysics } from "./game/loop/stepPhysics";
import { updateGameplay } from "./game/loop/updateGameplay";
import { updateDisplayInput } from "./game/loop/updateDisplayInput";
import { interpolateVisuals } from "./game/loop/interpolateVisuals";
import { updateFx } from "./game/loop/updateFx";
import { exposeDebugApi } from "./game/devtools/consoleApi";
import { maybeRenderDevPreview } from "./ui/dev/devPreview/devPreview";
import { LoadingScreen } from "./ui/screens/loading/LoadingScreen/LoadingScreen";
import { beginLoading, letBrowserPaint, reportLoading } from "./core/loadingProgress";

// see: docs/6-reference/notes-code-core.md#chargement-et-orchestration
async function main() {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement;
  const root = createRoot(uiRoot);

  if (import.meta.env.DEV && maybeRenderDevPreview(root)) return;

  installAudioActivation();
  initAudioSettingsAtBoot();
  const audioReady = Promise.all([initAudio(), initHeroVoice(), initZoneAmbience(), initWaterAmbience(), initShowerAmbience()]);

  initGraphicsSettingsAtBoot();

  const flowActor = createGameFlowActor();
  const flow = {
    isPlaying: () => flowActor.getSnapshot().value === "playing",
    isPhysicsLive: () => {
      const value = flowActor.getSnapshot().value;
      return value === "playing" || value === "paused" || value === "dead" || value === "levelComplete";
    },
    playerDied: () => {
      flowActor.send({ type: "DIED" });
      void document.exitPointerLock();
    },
    levelCompleted: () => {
      flowActor.send({ type: "LEVEL_COMPLETED" });
      void document.exitPointerLock();
    },
    pause: () => flowActor.send({ type: "PAUSE" }),
    resume: () => flowActor.send({ type: "RESUME" }),
  };
  flowActor.subscribe((snapshot) => {
    useGameStore.getState().setFlowState(snapshot.value);
  });

  if (!new URLSearchParams(window.location.search).get("level")) {
    flowActor.send({ type: "ENTER_MENU" });
  }
  const choice = await resolveBootChoice(root);
  flowActor.send({ type: "BEGIN_LOAD" });

  beginLoading("Démarrage", 0.02);
  root.render(createElement(LoadingScreen));
  await letBrowserPaint();

  input.attach(canvas);

  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === canvas) return;
    if (flowActor.getSnapshot().value !== "playing") return;
    input.clearPendingEdges();
    flowActor.send({ type: "PAUSE" });
  });

  reportLoading("Moteur physique et planches de sprites", 0.08);
  const [, suitSheet, directorSheet, weaponModels, cardPickupTextures] = await Promise.all([
    initPhysics(),
    loadEnemySpriteSheetOrPlaceholder("costard"),
    loadEnemySpriteSheetOrPlaceholder("directeur"),
    loadWeaponModelsOrPlaceholder(),
    loadCardPickupTextures(),
  ]);
  reportLoading("Chargement du niveau", 0.3);
  await letBrowserPaint();

  const persistentEngine = buildGameEngine(
    canvas,
    flow,
    { suit: suitSheet, director: directorSheet },
    weaponModels,
    cardPickupTextures,
  );

  registerRenderTarget(persistentEngine.scene, persistentEngine.camera, persistentEngine.renderer);

  const session = await bootGameSessionWithRetry(persistentEngine, choice, flowActor);
  const engine: GameEngine = { ...persistentEngine, session };

  await audioReady;
  await waitForGameSessionReady(flowActor, session);
  const sessionFlow = createSessionFlow(engine, root, flowActor);

  root.render(
    createElement(App, {
      onReplay: () => void sessionFlow.replay(),
      onReturnToMenu: () => void sessionFlow.returnToMenu(),
      onResume: sessionFlow.resume,
    }),
  );

  const cameraViewPrevPos = new THREE.Vector3();
  const cameraViewPrevQuat = new THREE.Quaternion();

  startLoop({
    updateDisplayInput: () => updateDisplayInput(engine),
    snapshotPrevious: () => snapshotPrevious(engine),
    updateGameplay: (dt) => updateGameplay(engine, dt),
    stepPhysics: (dt) => stepPhysics(engine, dt),
    interpolateVisuals: (alpha) => interpolateVisuals(engine, alpha),
    updateFx: (realDt, stats) => {
      updateFx(engine, realDt, stats);
      engine.cameraViewOverlay.update(realDt);
    },
    render() {
      const cam = engine.session.cameraView?.currentCam ?? null;
      if (cam) {
        cameraViewPrevPos.copy(engine.camera.position);
        cameraViewPrevQuat.copy(engine.camera.quaternion);
        engine.camera.position.copy(cam.position);
        engine.camera.quaternion.copy(cam.quaternion);
        engine.camera.updateMatrixWorld(true);
      }

      try {
        runGameplaySync(RenderService.use((rs) => rs.render(engine.renderer, engine.scene, engine.camera)));
      } finally {
        if (cam) {
          engine.camera.position.copy(cameraViewPrevPos);
          engine.camera.quaternion.copy(cameraViewPrevQuat);
          engine.camera.updateMatrixWorld(true);
        }
      }
      engine.cameraViewOverlay.render(cam !== null, cam?.label ?? null);
    },
  });

  if (import.meta.env.DEV) exposeDebugApi(engine);
}

main();
