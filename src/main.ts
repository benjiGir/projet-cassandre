import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { initAudio } from "./core/audio";
import { input } from "./core/input";
import { initMusic } from "./core/music";
import { startLoop } from "./core/loop";
import { runGameplaySync } from "./core/runtime";
import { initPhysics } from "./physics/world";
import { loadEnemySpriteSheetOrPlaceholder } from "./render/enemySprites";
import { RenderService } from "./render/renderService";
import { loadWeaponModelsOrPlaceholder } from "./render/viewmodel";
import { createGameFlowActor } from "./ui/gameFlowMachine";
import { App } from "./ui/App";
import { applyRenderSettings, initGraphicsSettingsAtBoot } from "./ui/graphicsSettings";
import { useGameStore } from "./game/state";
import { resolveBootChoice } from "./game/session/bootChoice";
import { buildGameEngine, type GameEngine } from "./game/session/gameEngine";
import { bootGameSession, replay, returnToMenu } from "./game/session/lifecycle";
import { snapshotPrevious, stepPhysics } from "./game/loop/stepPhysics";
import { updateGameplay } from "./game/loop/updateGameplay";
import { interpolateVisuals } from "./game/loop/interpolateVisuals";
import { updateFx } from "./game/loop/updateFx";
import { exposeDebugApi } from "./game/devtools/consoleApi";
import { maybeRenderDevPreview } from "./ui/devPreview";
import { LoadingScreen } from "./ui/LoadingScreen";
import { finishLoading, letBrowserPaint, reportLoading } from "./core/loadingProgress";

// Orchestrateur mince depuis le refactor du 2026-09-05 (2229 -> 129 lignes,
// extraction structurelle pure, aucun comportement observable changé).
// see: docs/systems/session.md#origine-des-modules-gamesession
async function main() {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement;
  const root = createRoot(uiRoot);

  // Harnais d'aperçu des écrans (`?uiPreview=<écran>`), DEV UNIQUEMENT —
  // voir `ui/devPreview.tsx`. Doit rester la toute première chose testée :
  // s'il rend, tout le reste du boot (physique, session, boucle) ne doit
  // jamais démarrer.
  if (import.meta.env.DEV && maybeRenderDevPreview(root)) return;

  // Réglages graphiques persistés (`ui/graphicsSettings.ts`) — chargés et
  // appliqués (FOV, screenshake) AVANT le menu principal : un joueur qui a
  // déjà réglé ces deux-là ne doit pas les voir revenir à leur valeur
  // d'origine le temps d'un aller-retour en jeu. Le filtrage et la
  // résolution interne, eux, ont besoin de `scene`/`camera`/`renderer` —
  // appliqués plus bas, juste après `buildGameEngine`.
  const graphicsSettings = initGraphicsSettingsAtBoot();

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

  // L'écran de chargement prend la place du menu IMMÉDIATEMENT, et le garde
  // jusqu'à ce que le niveau soit réellement là. Avant ça, le menu restait
  // affiché, figé, pendant les 29 Mo du niveau v2 — puis le HUD apparaissait
  // sur une scène vide, le décor surgissant d'un coup quelques secondes plus
  // tard. see: docs/systems/hud.md#écran-de-chargement
  reportLoading("Démarrage", 0.02);
  root.render(createElement(LoadingScreen));
  await letBrowserPaint();

  input.attach(canvas);
  // Pools de SFX (tir, impact), placeholders synthétiques (invariant #9).
  // see: docs/systems/hud-audio.md#assets-sonores
  initAudio();
  // Musique + nappe d'ambiance (Phase 6), module séparé de `core/audio.ts`.
  // see: docs/systems/hud-audio.md#musique-et-nappe-dambiance
  initMusic();

  // Planches de sprites des ennemis et modèles d'armes : chargés ici, à la
  // frontière asynchrone, jamais depuis la boucle (invariant #11).
  reportLoading("Moteur physique et planches de sprites", 0.08);
  const [, suitSheet, directorSheet, weaponModels] = await Promise.all([
    initPhysics(),
    loadEnemySpriteSheetOrPlaceholder("costard"),
    loadEnemySpriteSheetOrPlaceholder("directeur"),
    loadWeaponModelsOrPlaceholder(),
  ]);
  reportLoading("Chargement du niveau", 0.3);
  await letBrowserPaint();

  // État PERSISTANT (survit à un reset) : `buildGameEngine` ne construit PAS
  // `session` (ordre de construction circulaire) — `bootGameSession` la
  // construit juste après, à partir de ce même `persistentEngine`.
  // see: docs/systems/session.md#un-type-intermédiaire-pour-éviter-une-dépendance-circulaire-persistentengine
  const persistentEngine = buildGameEngine(
    canvas,
    root,
    flowActor,
    { suit: suitSheet, director: directorSheet },
    weaponModels,
  );

  // Filtrage des textures réduites + résolution interne : les deux seuls
  // réglages graphiques qui ont besoin d'un moteur construit (voir la doc de
  // tête de `ui/graphicsSettings.ts`). Appelé AVANT `bootGameSession` : le
  // filtrage posé ici devient le mode par défaut de `configureRetroTexture`
  // pour CHAQUE texture chargée ensuite (premier niveau, `replay()`, hot
  // reload), sans qu'aucun de ces chemins n'ait besoin d'y penser.
  applyRenderSettings(graphicsSettings, persistentEngine.scene, persistentEngine.camera, persistentEngine.renderer);

  const session = bootGameSession(persistentEngine, choice);
  const engine: GameEngine = { ...persistentEngine, session };

  // On ATTEND le premier chargement avant de rendre la main au joueur. Sur le
  // chemin glTF, `bootGameSession` ne fait que LANCER le chargement : sans
  // cette attente la boucle démarrait aussitôt et le joueur tombait dans le
  // vide depuis (0, 2, 0) — position transitoire documentée dans
  // `lifecycle.ts` — jusqu'à ce que `onLoaded` le repose sur `spawn_player`.
  //
  // `firstLoadSettled` et pas `ready` : sur un `.glb` absent ou corrompu,
  // `ready` ne se résout jamais et l'écran de chargement resterait affiché
  // pour toujours, cachant l'erreur au lieu de la montrer.
  await session.gltfLevelSession?.firstLoadSettled;
  finishLoading();

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

  // `window.cassandre` est un outil de dev, pas une API joueur : il donne des
  // cartes, téléporte, rend les ennemis passifs. Absent du build de production.
  // see: docs/systems/debug.md#point-dentrée-console-windowcassandre
  if (import.meta.env.DEV) exposeDebugApi(engine);
}

main();
