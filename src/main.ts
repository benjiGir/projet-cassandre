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

/**
 * Point d'entrée du jeu — orchestrateur mince depuis le refactor du
 * 2026-09-05 (`src/main.ts` faisait 2229 lignes : une seule fonction
 * `main()` de ~1530 lignes contenant ~15 fonctions imbriquées et les 5
 * callbacks de `startLoop`, tous fermés sur les mêmes ~35 variables
 * locales). Ce fichier ne fait plus que construire l'état PERSISTANT
 * (`GameEngine`, `game/session/gameEngine.ts`), la première partie
 * (`GameSession`, `game/session/lifecycle.ts`), et câbler les callbacks de
 * la boucle (`game/loop/*.ts`) — toute la logique vit désormais dans des
 * modules dédiés, testables/lisibles indépendamment. Extraction
 * STRUCTURELLE PURE : aucun comportement observable changé (même principe
 * que le retrofit Effect de `loader.ts` au jalon M2, voir
 * `PLAN_EFFECT_XSTATE.md` §1.4).
 */
async function main() {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement;
  const root = createRoot(uiRoot);

  // --- Jalon M8 (PLAN_EFFECT_XSTATE.md, §10) : acteur de flux d'écran ------
  // Créé AVANT même le choix du niveau : `boot` est son état initial, et
  // `setFlowState` (store zustand) doit refléter cet état dès que possible,
  // pas seulement une fois la partie commencée. Un seul acteur pour toute la
  // durée de vie de l'onglet (voir la doc de tête de `ui/gameFlowMachine.ts`) —
  // jamais recréé par `replay`/`returnToMenu` (contrairement à `engine.session`).
  //
  // `actor.subscribe(...)`, PAS `@xstate/react` (interdit par le plan) :
  // React ne s'abonne qu'au store zustand (`state.flowState`), exactement le
  // pont déjà utilisé pour le reste de l'état de jeu exposé au HUD (invariant
  // #2).
  const flowActor = createGameFlowActor();
  flowActor.subscribe((snapshot) => {
    useGameStore.getState().setFlowState(snapshot.value);
  });

  // --- Choix du niveau (Phase 5) — TOUT EN HAUT de `main()`, avant absolument
  // tout le reste du boot (avant `root.render(App)`, avant `input.attach`,
  // avant `initAudio`, avant la scène/caméra/renderer/physique). Invariant #2
  // (React ne touche jamais la boucle) est trivialement respecté ici : il n'y
  // a même pas encore de boucle à ce stade. Voir `game/level/levels.ts` pour
  // le registre.
  //
  // `ENTER_MENU` envoyé ICI (pas dans `resolveBootChoice`) SEULEMENT si
  // `?level=` est absent — sinon `resolveBootChoice` bypass tout menu et
  // `PLAY` (juste en dessous) transitionnera directement depuis `boot`,
  // jamais depuis `mainMenu`. Voir la doc de tête de `ui/gameFlowMachine.ts`
  // pour la raison pour laquelle la navigation interne (Options, Choisir une
  // zone) n'envoie PAS d'évènements intermédiaires.
  if (!new URLSearchParams(window.location.search).get("level")) {
    flowActor.send({ type: "ENTER_MENU" });
  }
  // `resolveBootChoice` enrobe `resolveLevelChoice` d'un nouveau menu
  // principal (Phase 6) SANS jamais toucher son comportement historique
  // (`?level=`) — voir `game/session/bootChoice.ts`.
  const choice = await resolveBootChoice(root);
  flowActor.send({ type: "PLAY" });

  input.attach(canvas);
  // Pools de SFX (tir, impact) : voir core/audio.ts. Placeholders
  // synthétiques présents depuis la Phase 3 (invariant #9 — pas des choix de
  // sound design arrêtés), géré silencieusement (un seul console.warn par id
  // manquant, jamais de throw). Initialisé avant startLoop, comme les autres
  // systèmes globaux.
  initAudio();
  // Musique + nappe d'ambiance (Phase 6) : voir core/music.ts pour la
  // séparation avec `audio.ts` (SFX ponctuels) — même discipline de
  // placeholder synthétique, module distinct car le pattern Howler diffère
  // (streaming en boucle, pas un pool de sources courtes).
  initMusic();

  await initPhysics();

  // --- État PERSISTANT (survit à un reset) — voir `game/session/gameEngine.ts`.
  // `buildGameEngine` ne construit PAS `session` (ordre de construction
  // circulaire documenté sur `PersistentEngine`) : `bootGameSession` la
  // construit juste après, à partir de ce même `persistentEngine`.
  const persistentEngine = buildGameEngine(canvas, root, flowActor);
  const session = bootGameSession(persistentEngine, choice);
  const engine: GameEngine = { ...persistentEngine, session };

  // `<App/>` (HUD de prod + DebugPanel + écrans de fin de partie) monté
  // APRÈS la construction du monde : `onReplay`/`onReturnToMenu` référencent
  // `engine`, qui doit exister avant que ces callbacks puissent être
  // invoqués — trivialement vrai ici puisqu'un clic utilisateur ne peut
  // survenir qu'après la fin de ce script synchrone.
  root.render(createElement(App, { onReplay: () => replay(engine), onReturnToMenu: () => returnToMenu(engine) }));

  startLoop({
    snapshotPrevious: () => snapshotPrevious(engine),
    // Décide le mouvement AVANT le step : la translation cible est consommée
    // par le `world.step()` du même pas fixe (voir l'ordre dans core/loop.ts).
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
