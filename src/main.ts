import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { initAudio } from "./core/audio";
import { input } from "./core/input";
import { initMusic } from "./core/music";
import { startLoop } from "./core/loop";
import { runGameplaySync } from "./core/runtime";
import { initPhysics } from "./physics/world";
import { RenderService } from "./render/renderService";
import { createGameFlowActor } from "./ui/gameFlowMachine";
import { App } from "./ui/App";
import { useGameStore } from "./game/state";
import { resolveBootChoice } from "./game/session/bootChoice";
import { buildGameEngine, type GameEngine } from "./game/session/gameEngine";
import { bootGameSession, replay, returnToMenu } from "./game/session/lifecycle";
import { snapshotPrevious, stepPhysics } from "./game/loop/stepPhysics";
import { updateGameplay } from "./game/loop/updateGameplay";
import { interpolateVisuals } from "./game/loop/interpolateVisuals";
import { updateFx } from "./game/loop/updateFx";
import { exposeDebugApi } from "./game/devtools/consoleApi";

// Orchestrateur mince depuis le refactor du 2026-09-05 (2229 -> 129 lignes,
// extraction structurelle pure, aucun comportement observable changé).
// see: docs/systems/session.md#origine-des-modules-gamesession
async function main() {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement;
  const root = createRoot(uiRoot);

  // Un seul acteur pour toute la durée de vie de l'onglet, créé AVANT le
  // choix du niveau ci-dessous — jamais recréé par `replay`/`returnToMenu`.
  // see: docs/decisions/0019-machine-xstate-flux-ecran.md
  // see: docs/systems/hud.md#flux-décran
  const flowActor = createGameFlowActor();
  flowActor.subscribe((snapshot) => {
    useGameStore.getState().setFlowState(snapshot.value);
  });

  // Choix du niveau (Phase 5), tout en haut de `main()` — voir l'ordre exact
  // et pourquoi `ENTER_MENU` n'est envoyé qu'ici.
  // see: docs/systems/session.md#choix-du-niveau-au-boot
  if (!new URLSearchParams(window.location.search).get("level")) {
    flowActor.send({ type: "ENTER_MENU" });
  }
  const choice = await resolveBootChoice(root);
  flowActor.send({ type: "PLAY" });

  input.attach(canvas);
  // Pools de SFX (tir, impact), placeholders synthétiques (invariant #9).
  // see: docs/systems/hud-audio.md#assets-sonores-boîtes-blanches
  initAudio();
  // Musique + nappe d'ambiance (Phase 6), module séparé de `core/audio.ts`.
  // see: docs/systems/hud-audio.md#musique-et-nappe-dambiance
  initMusic();

  await initPhysics();

  // État PERSISTANT (survit à un reset) : `buildGameEngine` ne construit PAS
  // `session` (ordre de construction circulaire) — `bootGameSession` la
  // construit juste après, à partir de ce même `persistentEngine`.
  // see: docs/systems/session.md#un-type-intermédiaire-pour-éviter-une-dépendance-circulaire-persistentengine
  const persistentEngine = buildGameEngine(canvas, root, flowActor);
  const session = bootGameSession(persistentEngine, choice);
  const engine: GameEngine = { ...persistentEngine, session };

  // `<App/>` monté APRÈS la construction du monde : `onReplay`/
  // `onReturnToMenu` ferment sur `engine`.
  // see: docs/systems/hud.md#composition-de-app
  root.render(createElement(App, { onReplay: () => replay(engine), onReturnToMenu: () => returnToMenu(engine) }));

  startLoop({
    snapshotPrevious: () => snapshotPrevious(engine),
    // Décide le mouvement AVANT le step.
    // see: docs/systems/boucle-de-jeu.md#ordre-des-callbacks
    updateGameplay: (dt) => updateGameplay(engine, dt),
    stepPhysics: (dt) => stepPhysics(engine, dt),
    interpolateVisuals: (alpha) => interpolateVisuals(engine, alpha),
    updateFx: (realDt, stats) => updateFx(engine, realDt, stats),
    render() {
      // Jalon M7 (PLAN_EFFECT_XSTATE.md, §9) : seul appel qui touche
      // vraiment une API externe dans le chemin de rendu — voir
      // `RenderService` (`render/renderService.ts`).
      runGameplaySync(RenderService.use((rs) => rs.render(engine.renderer, engine.scene, engine.camera)));
    },
  });

  exposeDebugApi(engine);
}

main();
