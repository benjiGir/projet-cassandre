import { createElement } from "react";
import { createRoot } from "react-dom/client";

import "./ui/theme/tokens.css";

import { initAudio } from "./core/audio";
import { input } from "./core/input";
import { initMusic } from "./core/music";
import { initWaterAmbience } from "./core/waterAmbience";
import { startLoop } from "./core/loop";
import { runGameplaySync } from "./core/runtime";
import { initPhysics } from "./physics/world";
import { loadEnemySpriteSheetOrPlaceholder } from "./render/enemySprites";
import { RenderService } from "./render/renderService";
import { loadWeaponModelsOrPlaceholder } from "./render/viewmodel";
import { createGameFlowActor } from "./ui/gameFlowMachine";
import { App } from "./ui/App";
import { initGraphicsSettingsAtBoot, registerRenderTarget } from "./game/graphicsSettings";
import { useGameStore } from "./game/state";
import { resolveBootChoice } from "./game/session/bootChoice";
import { buildGameEngine, type GameEngine } from "./game/session/gameEngine";
import {
  bootGameSession,
  replay,
  resumeGame,
  returnToMenu,
  waitForGameSessionReady,
} from "./game/session/lifecycle";
import { snapshotPrevious, stepPhysics } from "./game/loop/stepPhysics";
import { updateGameplay } from "./game/loop/updateGameplay";
import { updateDisplayInput } from "./game/loop/updateDisplayInput";
import { interpolateVisuals } from "./game/loop/interpolateVisuals";
import { updateFx } from "./game/loop/updateFx";
import { exposeDebugApi } from "./game/devtools/consoleApi";
import { maybeRenderDevPreview } from "./ui/dev/devPreview/devPreview";
import { LoadingScreen } from "./ui/screens/loading/LoadingScreen/LoadingScreen";
import { beginLoading, letBrowserPaint, reportLoading } from "./core/loadingProgress";

// Orchestrateur mince depuis le refactor du 2026-09-05 (2229 -> 129 lignes,
// extraction structurelle pure, aucun comportement observable changé).
// see: docs/systems/session.md#origine-des-modules-gamesession
async function main() {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement;
  const root = createRoot(uiRoot);

  // Harnais d'aperçu des écrans (`?uiPreview=<écran>`), DEV UNIQUEMENT —
  // voir `ui/dev/devPreview/devPreview.tsx`. Doit rester la toute première chose testée :
  // s'il rend, tout le reste du boot (physique, session, boucle) ne doit
  // jamais démarrer.
  if (import.meta.env.DEV && maybeRenderDevPreview(root)) return;

  // Réglages graphiques persistés (`game/graphicsSettings.ts`) — chargés et
  // appliqués (FOV, screenshake) AVANT le menu principal : un joueur qui a
  // déjà réglé ces deux-là ne doit pas les voir revenir à leur valeur
  // d'origine le temps d'un aller-retour en jeu. Le filtrage et la
  // résolution interne, eux, ont besoin de `scene`/`camera`/`renderer` —
  // appliqués plus bas via `registerRenderTarget`, juste après
  // `buildGameEngine` (qui relit `current` lui-même, pas de valeur à
  // transporter jusque-là).
  initGraphicsSettingsAtBoot();

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
  flowActor.send({ type: "BEGIN_LOAD" });

  // L'écran de chargement prend la place du menu IMMÉDIATEMENT, et le garde
  // jusqu'à ce que le niveau soit réellement là. Avant ça, le menu restait
  // affiché, figé, pendant les 29 Mo du niveau v2 — puis le HUD apparaissait
  // sur une scène vide, le décor surgissant d'un coup quelques secondes plus
  // tard. see: docs/systems/hud.md#écran-de-chargement
  beginLoading("Démarrage", 0.02);
  root.render(createElement(LoadingScreen));
  await letBrowserPaint();

  input.attach(canvas);

  // Pause automatique sur perte du verrouillage du pointeur PENDANT une
  // partie — Échap le libère toujours au niveau du navigateur, mais ne
  // livre pas nécessairement son évènement clavier à la page (les deux
  // moteurs de rendu testés en diffèrent) : le changement de verrouillage
  // est le signal robuste, celui que `PauseScreen`/l'acteur de flux
  // écoutent réellement. Écouteur DOM ponctuel, hors du pas fixe ET de la
  // boucle d'affichage (un changement de flux est un évènement DISCRET, pas
  // un flux à 60 Hz — voir le skill `react-hud-bridge`) ; `flowActor` est
  // fermé par référence, `engine` n'a pas besoin d'exister encore.
  // see: docs/systems/session.md#pause
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === canvas) return; // verrouillage OBTENU, pas perdu
    if (flowActor.getSnapshot().value !== "playing") return;
    input.clearPendingEdges();
    flowActor.send({ type: "PAUSE" });
  });

  // Pools de SFX (tir, impact), placeholders synthétiques (invariant #9).
  // see: docs/systems/hud-audio.md#assets-sonores
  initAudio();
  // Musique + nappe d'ambiance (Phase 6), module séparé de `core/audio.ts`.
  // see: docs/systems/hud-audio.md#musique-et-nappe-dambiance
  initMusic();
  // Boucle d'eau positionnelle des sanitaires cassés — module séparé lui
  // aussi (mise à jour continue par frame, pas un pool de sons ponctuels).
  // see: docs/systems/hud-audio.md#boucle-deau-positionnelle
  initWaterAmbience();

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
  // tête de `game/graphicsSettings.ts`). Enregistré AVANT `bootGameSession` :
  // le filtrage posé ici devient le mode par défaut de `configureRetroTexture`
  // pour CHAQUE texture chargée ensuite (premier niveau, `replay()`, hot
  // reload), sans qu'aucun de ces chemins n'ait besoin d'y penser.
  // `registerRenderTarget` applique aussi `graphicsSettings` immédiatement, et
  // reste la cible de tout changement fait EN JEU depuis la pause.
  registerRenderTarget(persistentEngine.scene, persistentEngine.camera, persistentEngine.renderer);

  const session = bootGameSession(persistentEngine, choice);
  const engine: GameEngine = { ...persistentEngine, session };

  // On ATTEND le premier chargement avant de rendre la main au joueur. Sur le
  // chemin glTF, `bootGameSession` ne fait que LANCER le chargement : sans
  // cette attente la boucle démarrait aussitôt et le joueur tombait dans le
  // vide depuis (0, 2, 0) — position transitoire documentée dans
  // `lifecycle.ts` — jusqu'à ce que le commit du niveau le repose sur
  // `spawn_player`.
  //
  // Frontière explicite : le flux ne passe à `playing` qu'après un commit de
  // niveau réussi. Un échec reste sur l'écran de chargement et propose une
  // relance, sans démarrer la boucle sur une scène vide.
  await waitForGameSessionReady(engine, session);

  // `<App/>` monté APRÈS la construction du monde : `onReplay`/
  // `onReturnToMenu`/`onResume` ferment sur `engine`.
  // see: docs/systems/hud.md#composition-de-app
  root.render(
    createElement(App, {
      onReplay: () => void replay(engine),
      onReturnToMenu: () => void returnToMenu(engine),
      onResume: () => resumeGame(engine),
    }),
  );

  startLoop({
    updateDisplayInput: () => updateDisplayInput(engine),
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
