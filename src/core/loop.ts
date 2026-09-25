import { input } from "./input";

export const FIXED_DT = 1 / 60;
const MAX_FRAME = 0.25; // garde-fou anti spiral of death

/** Diagnostic de la dernière frame d'affichage. Lu hors du pas fixe. */
export interface LoopStats {
  /** Pas fixes exécutés pendant cette frame (0 possible à haute fréquence d'affichage). */
  steps: number;
  /** Reste de l'accumulateur après les pas fixes, en secondes. */
  accumulator: number;
  /** Facteur d'interpolation passé au rendu. */
  alpha: number;
  /**
   * Jalon M7 : compteurs de temps par phase pour `DebugPanel`. `gameplayMs`/
   * `physicsMs` somment tous les pas fixes de la frame ; `renderMs` est
   * mesuré sur la frame PRÉCÉDENTE (décalage d'une frame, sans conséquence
   * pour un indicateur de debug déjà lissé).
   *
   * see: docs/systems/boucle-de-jeu.md#mesure-des-temps-de-frame-loopstats
   */
  gameplayMs: number;
  physicsMs: number;
  renderMs: number;
}

export interface LoopCallbacks {
  /** Capture la visée au taux d'affichage avant que le premier pas fixe ne la lise. */
  updateDisplayInput: () => void;
  snapshotPrevious: () => void;
  /**
   * Décide du mouvement du pas courant. Appelé AVANT `stepPhysics` : un
   * character controller kinématique pose sa translation cible ici, et
   * `world.step()` l'applique dans le même pas fixe (voir plus bas).
   */
  updateGameplay: (dt: number) => void;
  stepPhysics: (dt: number) => void;
  interpolateVisuals: (alpha: number) => void;
  updateFx: (realDt: number, stats: LoopStats) => void;
  render: () => void;
}

/**
 * Boucle à pas fixe 1/60 avec accumulateur et interpolation du rendu.
 * L'ORDRE des callbacks (gameplay avant physique, `endFrame` en dernier) est
 * une décision de conception délibérée — ne pas l'inverser sans relire la
 * doc.
 *
 * see: docs/systems/boucle-de-jeu.md#ordre-des-callbacks
 */
export function startLoop(callbacks: LoopCallbacks) {
  let accumulator = 0;
  let last = performance.now();
  // Frame précédente : `renderMs` ne peut se mesurer avant sa propre fin.
  // see: docs/systems/boucle-de-jeu.md#mesure-des-temps-de-frame-loopstats
  let lastRenderMs = 0;

  function frame(now: number) {
    requestAnimationFrame(frame);

    let frameTime = (now - last) / 1000;
    last = now;
    if (frameTime > MAX_FRAME) frameTime = MAX_FRAME;
    accumulator += frameTime;

    input.beginFrame();
    callbacks.updateDisplayInput();

    let steps = 0;
    let gameplayMs = 0;
    let physicsMs = 0;
    while (accumulator >= FIXED_DT) {
      input.beginFixedStep();
      callbacks.snapshotPrevious();
      const gameplayStart = performance.now();
      callbacks.updateGameplay(FIXED_DT);
      gameplayMs += performance.now() - gameplayStart;
      const physicsStart = performance.now();
      callbacks.stepPhysics(FIXED_DT);
      physicsMs += performance.now() - physicsStart;
      accumulator -= FIXED_DT;
      steps++;
    }

    const alpha = accumulator / FIXED_DT;
    const renderStart = performance.now();
    callbacks.interpolateVisuals(alpha);
    callbacks.updateFx(frameTime, { steps, accumulator, alpha, gameplayMs, physicsMs, renderMs: lastRenderMs });
    callbacks.render();
    lastRenderMs = performance.now() - renderStart;

    // DOIT rester le dernier appel de la frame.
    // see: docs/systems/boucle-de-jeu.md#ordre-de-la-frame-daffichage
    input.endFrame();
  }

  requestAnimationFrame(frame);
}
