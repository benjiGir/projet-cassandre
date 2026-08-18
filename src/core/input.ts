/**
 * Un appui produit UN événement physique, mais deux couches le lisent à des
 * cadences différentes, et leurs besoins sont incompatibles :
 *
 *  - le pas fixe tourne 0, 1 ou N fois par frame d'affichage. Il lui faut un
 *    front RETENU jusqu'à ce qu'un pas fixe puisse le voir, et CONSOMMÉ pour
 *    qu'un seul pas fixe l'obtienne ;
 *  - le code au taux d'affichage tourne exactement une fois par frame. Il lui
 *    faut un front qui décrive la frame COURANTE, ni retenu ni consommé.
 *
 * Un seul set ne peut pas satisfaire les deux : la rétention (nécessaire au pas
 * fixe) fait rejouer l'appui sur plusieurs frames d'affichage, et le nettoyage
 * par frame (nécessaire à l'affichage) avale les appuis des frames sans pas
 * fixe. D'où deux sets, alimentés par le même keydown, vidés selon deux règles.
 */
class InputManager {
  private keysDown = new Set<string>();

  /**
   * Fronts EN ATTENTE D'UN PAS FIXE. Vidés uniquement quand au moins un pas
   * fixe a tourné pendant la frame. Lus par `consumeJustPressed`.
   */
  private edgesPendingFixedStep = new Set<string>();

  /**
   * Fronts DE LA FRAME D'AFFICHAGE COURANTE. Vidés à chaque fin de frame,
   * inconditionnellement. Lus par `wasJustPressed`.
   */
  private edgesThisDisplayFrame = new Set<string>();

  private mouseDeltaX = 0;
  private mouseDeltaY = 0;

  private canvas: HTMLCanvasElement | null = null;
  private pointerLocked = false;

  /** Pas fixes exécutés depuis le dernier `beginFrame`. Voir `endFrame`. */
  private fixedStepsThisFrame = 0;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("click", this.requestPointerLock);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // `keysDown` filtre l'auto-répétition du clavier : un seul front par appui
    // physique, alimentant les deux vues.
    if (!this.keysDown.has(e.code)) {
      this.edgesPendingFixedStep.add(e.code);
      this.edgesThisDisplayFrame.add(e.code);
    }
    this.keysDown.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.mouseDeltaX += e.movementX;
    this.mouseDeltaY += e.movementY;
  };

  private requestPointerLock = () => {
    this.canvas?.requestPointerLock().catch(() => {
      // Refusé par le navigateur (pas assez d'interaction, contexte non éligible...) : sans gravité.
    });
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  isDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  /**
   * Front montant de la frame d'affichage COURANTE, lecture non destructive.
   * Vrai sur exactement une frame d'affichage par appui physique, que cette
   * frame ait exécuté 0, 1 ou N pas fixes.
   *
   * Réservé au code lu au taux d'affichage (`interpolateVisuals`, `updateFx`).
   * Plusieurs lecteurs peuvent l'observer dans la même frame sans se voler
   * l'événement.
   *
   * NE JAMAIS appeler depuis un pas fixe : le contenu de ce set dépend du taux
   * de rafraîchissement, donc le lire dans le pas fixe rendrait la simulation
   * non déterministe. Le pas fixe utilise `consumeJustPressed`.
   */
  wasJustPressed(code: string): boolean {
    return this.edgesThisDisplayFrame.has(code);
  }

  /**
   * Front montant en attente, lecture DESTRUCTIVE : le premier appelant
   * l'obtient, les suivants non.
   *
   * C'est la lecture correcte depuis un pas fixe. Une frame d'affichage peut
   * exécuter 0, 1 ou N pas fixes ; sans consommation, un appui déclencherait
   * N sauts sur une frame lente (30 Hz d'affichage → 2 pas fixes → double saut).
   *
   * Les deux vues sont indépendantes : consommer ici ne masque rien à
   * `wasJustPressed`. Un même appui peut donc légitimement déclencher un saut
   * (pas fixe) et un effet visuel (taux d'affichage) sans que l'un prive
   * l'autre.
   */
  consumeJustPressed(code: string): boolean {
    return this.edgesPendingFixedStep.delete(code);
  }

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  /**
   * Read once per render frame, outside the fixed step — camera look must
   * track the mouse at display rate or aiming gains perceptible latency.
   */
  consumeMouseDelta(): { dx: number; dy: number } {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }

  beginFrame() {
    // Les events sont accumulés par les listeners au fil de l'eau ; il n'y a
    // rien à collecter ici. On remet seulement à zéro le compteur de pas
    // fixes, qui conditionne le nettoyage des fronts montants.
    this.fixedStepsThisFrame = 0;
  }

  /** Appelé par la boucle au début de chaque pas fixe. */
  beginFixedStep() {
    this.fixedStepsThisFrame++;
  }

  /**
   * Clôture la frame d'affichage.
   *
   * DOIT être appelée en DERNIER dans la frame, après `interpolateVisuals`,
   * `updateFx` et `render` — tout code lu au taux d'affichage doit s'exécuter
   * avant. Voir l'ordre commenté dans `core/loop.ts`.
   *
   * Deux durées de vie, une par vue :
   *
   * - fronts de la frame d'affichage : vidés INCONDITIONNELLEMENT. Ils
   *   décrivent « ce que le joueur a pressé pendant cette frame » ; les retenir
   *   au-delà ferait rejouer le même appui sur les frames suivantes (à 144 Hz,
   *   un appui resterait visible 2 ou 3 frames d'affichage d'affilée).
   *
   * - fronts en attente d'un pas fixe : vidés SEULEMENT si au moins un pas fixe
   *   a tourné. À 144 Hz, la majorité des frames n'exécute aucun pas fixe ;
   *   effacer inconditionnellement avalerait les appuis tombés dans ces
   *   frames-là. Le front reste donc armé jusqu'à ce qu'un pas fixe puisse le
   *   voir.
   */
  endFrame() {
    this.edgesThisDisplayFrame.clear();
    if (this.fixedStepsThisFrame > 0) this.edgesPendingFixedStep.clear();
  }
}

export const input = new InputManager();
