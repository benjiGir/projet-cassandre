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
   * Jalon M7 (PLAN_EFFECT_XSTATE.md, §9) : compteurs de temps par phase, en
   * millisecondes, pour `DebugPanel` — le filet de sécurité concret du
   * risque de perf assumé dans ce chantier (§0 du plan : aucun budget fixé
   * à l'avance, mais toute dégradation doit être visible immédiatement).
   * `gameplayMs`/`physicsMs` sont la SOMME sur tous les pas fixes exécutés
   * PENDANT cette frame d'affichage (`steps` peut dépasser 1). `renderMs`
   * couvre `interpolateVisuals` + `updateFx` + `render` ensemble (tout ce
   * qui tourne au taux d'affichage) — MESURÉ SUR LA FRAME PRÉCÉDENTE : la
   * durée réelle de ces trois callbacks n'est connue qu'après leur propre
   * exécution, dont `updateFx` (qui reçoit ces `stats`) fait partie — un
   * décalage d'une frame, sans conséquence pour un indicateur de debug lissé
   * (même principe que `fpsSmoothed` dans `main.ts`, déjà lissé sur
   * plusieurs frames).
   */
  gameplayMs: number;
  physicsMs: number;
  renderMs: number;
}

export interface LoopCallbacks {
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
 *
 * ORDRE DES CALLBACKS — décision de conception, ne pas inverser sans relire ceci.
 *
 *     snapshotPrevious → updateGameplay → stepPhysics
 *
 * L'ordre naturel (physique puis gameplay) coûte une frame de latence au
 * déplacement : le controller calcule son mouvement après le step et le pose
 * via `setNextKinematicTranslation`, qui n'est consommé que par le step
 * SUIVANT. 16.6 ms de retard sur chaque input de déplacement, inacceptable.
 *
 * En décidant le mouvement avant le step, la translation cible est appliquée
 * par le `world.step()` du même pas fixe : latence nulle, et le corps
 * kinématique acquiert une vitesse cohérente pour pousser les corps
 * dynamiques (`setApplyImpulsesToDynamicBodies`).
 *
 * Contrepartie assumée : `updateGameplay` observe le monde tel qu'il est au
 * DÉBUT du pas (positions des corps dynamiques d'avant le step). C'est la
 * convention normale d'un controller kinématique, et elle est stable — donc
 * déterministe.
 *
 * ORDRE DE L'INPUT — deuxième décision de conception, ne pas inverser non plus.
 *
 *     beginFrame → [beginFixedStep …]* → interpolateVisuals → updateFx → render → endFrame
 *
 * `endFrame` ferme la frame d'affichage et doit donc venir APRÈS tout code lu
 * au taux d'affichage. Le placer avant `interpolateVisuals` (erreur naturelle,
 * puisqu'il « appartient » visuellement au bloc des pas fixes) rend les fronts
 * montants invisibles à `interpolateVisuals` et `updateFx` dès qu'un pas fixe a
 * tourné dans la frame : à 60 Hz d'affichage, c'est presque toutes les frames.
 *
 * Invariants tenus ici :
 * - un seul `world.step()` par pas fixe, jamais dans le rendu ;
 * - delta clampé à 0.25 s ;
 * - snapshot n−1 avant toute mutation, interpolation au rendu via `alpha` ;
 * - la rotation caméra est lue dans `interpolateVisuals`, au taux
 *   d'affichage, hors du pas fixe, et n'est jamais interpolée ;
 * - `updateFx` reçoit le temps réel de la frame, pas FIXED_DT.
 */
export function startLoop(callbacks: LoopCallbacks) {
  let accumulator = 0;
  let last = performance.now();
  // Voir la doc de `LoopStats.renderMs` : durée de la frame d'affichage
  // PRÉCÉDENTE (interpolateVisuals + updateFx + render), reportée au tour
  // suivant faute de pouvoir se mesurer elle-même avant que `updateFx` (qui
  // consomme ces stats) n'ait fini de s'exécuter.
  let lastRenderMs = 0;

  function frame(now: number) {
    requestAnimationFrame(frame);

    let frameTime = (now - last) / 1000;
    last = now;
    if (frameTime > MAX_FRAME) frameTime = MAX_FRAME;
    accumulator += frameTime;

    input.beginFrame();

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

    // Clôture de la frame d'affichage : DOIT rester le dernier appel. Les
    // callbacks ci-dessus tournent au taux d'affichage et lisent des fronts
    // montants (rotation caméra, outillage recorder F9/F10, effets) ; vider les
    // fronts avant eux les rendrait aveugles dès qu'un pas fixe a tourné dans la
    // frame — c'est-à-dire presque toujours à 60 Hz et toujours à 30 Hz.
    input.endFrame();
  }

  requestAnimationFrame(frame);
}
