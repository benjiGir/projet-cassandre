import { createElement } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";

import "./ui/theme/tokens.css";

import { initAudio } from "./core/audio/audio";
import { initHeroVoice } from "./core/audio/heroVoice";
import { initZoneAmbience } from "./core/audio/zoneAmbience";
import { input } from "./core/input/input";
import { initWaterAmbience } from "./core/audio/waterAmbience";
import { initShowerAmbience } from "./core/audio/showerAmbience";
import { startLoop, type LoopHandle } from "./core/loop/loop";
import { installFatalErrorHandling, reportFatalError } from "./app/runtime/fatalError";
import { showCrashScreen } from "./app/navigation/showCrashScreen";
import { runGameplaySync } from "./app/runtime/gameRuntime";
import { initPhysics } from "./physics/world";
import { loadEnemySpriteSheetOrPlaceholder } from "./render/sprites/enemySprites";
import { RenderService } from "./render/pipeline/renderService";
import { loadWeaponModelsOrPlaceholder } from "./render/viewmodel/weaponModels";
import { loadHero } from "./render/hero/loadHero";
import { loadCardPickupTextures } from "./render/pickups/cardPickups";
import { createGameFlowActor, isPhysicsLiveState, isPlayingState } from "./app/navigation/gameFlowMachine";
import { App } from "./ui/App/App";
import { initAudioSettingsAtBoot } from "./game/settings/audioSettings";
import { initGraphicsSettingsAtBoot, registerRenderTarget } from "./game/settings/graphicsSettings";
import { useGameStore } from "./game/hud/state";
import { devLevelShortcut, resolveBootChoice } from "./app/navigation/bootChoice";
import {
  bootGameSessionWithRetry,
  createSessionFlow,
  introPending,
  loadingDestination,
  waitForGameSessionReady,
} from "./app/navigation/sessionFlow";
import { levelStory } from "./game/session/presentation/storyPanels";
import { buildGameEngine, type GameEngine } from "./game/session/gameEngine";
import { snapshotPrevious, stepPhysics } from "./game/loop/stepPhysics";
import { updateGameplay } from "./game/loop/updateGameplay";
import { updateDisplayInput } from "./game/loop/updateDisplayInput";
import { interpolateVisuals } from "./game/loop/interpolateVisuals";
import { updateFx } from "./game/loop/updateFx";
import { exposeDebugApi } from "./game/devtools/consoleApi";
import { maybeRenderDevPreview } from "./ui/dev/devPreview/devPreview";
import { LoadingScreen } from "./ui/screens/loading/LoadingScreen/LoadingScreen";
import { flushCampaignSave } from "./game/session/campaign/campaignStorage";
import { beginLoading, letBrowserPaint, reportLoading } from "./core/loading/loadingProgress";

// see: docs/6-reference/notes-code-core.md#chargement-et-orchestration
async function main() {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement;
  // Une erreur de rendu que rien ne rattrape démonte l'interface : elle arrête le jeu comme les autres.
  const root = createRoot(uiRoot, { onUncaughtError: reportFatalError });
  let loop: LoopHandle | null = null;
  installFatalErrorHandling(window, (error) => {
    loop?.stop();
    showCrashScreen(root, error);
  });

  if (import.meta.env.DEV && maybeRenderDevPreview(root)) return;

  initAudioSettingsAtBoot();
  const audioReady = Promise.all([
    initAudio(),
    initHeroVoice(),
    initZoneAmbience(),
    initWaterAmbience(),
    initShowerAmbience(),
  ]);

  initGraphicsSettingsAtBoot();

  const flowActor = createGameFlowActor();
  // Niveau de la partie en cours, connu une fois le moteur construit.
  let currentLevelId: () => string | null = () => null;
  const flow = {
    isPlaying: () => isPlayingState(flowActor.getSnapshot().value),
    isPhysicsLive: () => isPhysicsLiveState(flowActor.getSnapshot().value),
    playerDied: () => {
      flowActor.send({ type: "DIED" });
      document.exitPointerLock();
    },
    levelCompleted: () => {
      const levelId = currentLevelId();
      const outro = levelId === null ? undefined : levelStory(levelId)?.outro;
      if (outro) {
        useGameStore.getState().setStory(outro);
        flowActor.send({ type: "SHOW_OUTRO" });
      } else {
        flowActor.send({ type: "LEVEL_COMPLETED" });
      }
      document.exitPointerLock();
    },
    pause: () => flowActor.send({ type: "PAUSE" }),
    resume: () => flowActor.send({ type: "RESUME" }),
  };
  flowActor.subscribe((snapshot) => {
    useGameStore.getState().setFlowState(snapshot.value);
  });

  const fromMenu = devLevelShortcut() === null;
  if (fromMenu) flowActor.send({ type: "ENTER_MENU" });
  const { choice, entry } = await resolveBootChoice(root);
  flowActor.send({ type: "BEGIN_LOAD" });

  beginLoading("Démarrage", 0.02, loadingDestination(choice));
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
  const [
    ,
    suitSheet,
    directorSheet,
    rampantSheet,
    vigileSheet,
    controllerSheet,
    weaponModels,
    cardPickupTextures,
    heroAsset,
  ] = await Promise.all([
    initPhysics(),
    loadEnemySpriteSheetOrPlaceholder("costard"),
    loadEnemySpriteSheetOrPlaceholder("directeur"),
    loadEnemySpriteSheetOrPlaceholder("rampant"),
    loadEnemySpriteSheetOrPlaceholder("vigile"),
    loadEnemySpriteSheetOrPlaceholder("controleur"),
    loadWeaponModelsOrPlaceholder(),
    loadCardPickupTextures(),
    loadHero(),
  ]);
  reportLoading("Chargement du niveau", 0.3);
  await letBrowserPaint();

  const persistentEngine = buildGameEngine(
    canvas,
    flow,
    {
      suit: suitSheet,
      director: directorSheet,
      rampant: rampantSheet,
      vigile: vigileSheet,
      controller: controllerSheet,
    },
    weaponModels,
    cardPickupTextures,
    heroAsset,
  );

  registerRenderTarget(persistentEngine.scene, persistentEngine.camera, persistentEngine.renderer);

  const session = await bootGameSessionWithRetry(persistentEngine, choice, flowActor, entry);
  const engine: GameEngine = { ...persistentEngine, session };
  currentLevelId = () => engine.session.choice.id;

  await audioReady;
  await waitForGameSessionReady(flowActor, session, fromMenu && introPending(choice));
  const sessionFlow = createSessionFlow(engine, root, flowActor);

  root.render(createElement(App, sessionFlow.appProps()));

  const cameraViewPrevPos = new THREE.Vector3();
  const cameraViewPrevQuat = new THREE.Quaternion();

  loop = startLoop({
    updateDisplayInput: () => updateDisplayInput(engine),
    snapshotPrevious: () => snapshotPrevious(engine),
    updateGameplay: (dt) => updateGameplay(engine, dt),
    stepPhysics: (dt) => stepPhysics(engine, dt),
    interpolateVisuals: (alpha) => interpolateVisuals(engine, alpha),
    updateFx: (realDt, stats) => {
      updateFx(engine, realDt, stats);
      flushCampaignSave();
      engine.cameraViewOverlay.update(realDt);
    },
    render() {
      const cam = engine.session.level.cameraView?.currentCam ?? null;
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

main().catch(reportFatalError);
