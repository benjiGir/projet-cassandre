import * as THREE from "three";

import type { InputFrame } from "../../core/inputRecorder";

/**
 * `cam_*`/console à `cameras` — vue façon Duke Nukem 3D : une console
 * (`use_*` portant l'extra `cameras`, liste de noms `cam_*` séparés par des
 * virgules) fait passer le rendu par une caméra fixe du niveau. `E` fait
 * défiler la liste, TOUT MOUVEMENT en sort (invariant #10 : jamais
 * d'immobilisation forcée du joueur — la vue n'est qu'une redirection du
 * rendu, le joueur reste libre de bouger, et bouger la referme aussitôt).
 *
 * Système synchrone pur (aucun accès GPU/DOM ici, voir `render/cameraView.ts`
 * pour l'overlay 2D) : passe par la même frontière que le reste du pas fixe
 * (invariant #11), pas d'Effect nécessaire — même style que `VitreSystem`.
 * see: docs/archive/reference-conventions-nommage.md#préfixe-cam
 */

/** Un `cam_*` du niveau — position/orientation MONDE figées à la construction
 * (un empty ne bouge jamais après le chargement, contrairement à un `prop_*`). */
export interface CamPoint {
  name: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** Étiquette affichée par l'overlay pendant la vue — custom property
   * Blender `nom`, repli sur le nom Blender brut si absente. */
  label: string;
}

/** Delta de visée au-delà duquel un mouvement de souris sort de la vue,
 * radians — assez petit pour qu'un tremblement de main ne suffise pas à
 * annuler un déplacement volontaire vers la console suivante, assez grand
 * pour qu'un vrai geste de visée sorte immédiatement. */
const LOOK_EXIT_EPSILON = 0.02;

export class CameraViewSystem {
  private readonly byName = new Map<string, CamPoint>();

  private activeNames: readonly string[] | null = null;
  private index = 0;
  private baseYaw = 0;
  private basePitch = 0;

  constructor(cams: readonly CamPoint[]) {
    for (const cam of cams) this.byName.set(cam.name, cam);
  }

  get active(): boolean {
    return this.activeNames !== null;
  }

  /** Caméra actuellement affichée, `null` hors vue ou si le nom référencé par
   * la console est introuvable (avertissement déjà émis par `loader.ts`). */
  get currentCam(): CamPoint | null {
    if (!this.activeNames) return null;
    return this.byName.get(this.activeNames[this.index]!) ?? null;
  }

  get cameraIndex(): number {
    return this.index;
  }
  get cameraCount(): number {
    return this.activeNames?.length ?? 0;
  }

  /**
   * Appelée par `InteractionHandlers.onCameraConsoleUse` sur un appui E dans
   * la portée d'une console. Une première activation choisit la première
   * caméra ; un appui répété SUR LA MÊME CONSOLE fait défiler — comparaison
   * par référence du tableau `extras.cameras` déjà stable d'un pas à l'autre
   * (même `UseObject`, jamais recréé hors hot reload).
   */
  activate(cameraNames: readonly string[], currentYaw: number, currentPitch: number): void {
    if (cameraNames.length === 0) return;
    if (this.activeNames === cameraNames) {
      this.index = (this.index + 1) % this.activeNames.length;
      return;
    }
    this.activeNames = cameraNames;
    this.index = 0;
    this.baseYaw = currentYaw;
    this.basePitch = currentPitch;
  }

  /** Sort de la vue immédiatement, quelle qu'en soit la raison. */
  exit(): void {
    this.activeNames = null;
    this.index = 0;
  }

  /**
   * Un pas fixe : sort de la vue au premier mouvement (déplacement, saut, ou
   * visée qui dépasse `LOOK_EXIT_EPSILON` depuis l'activation) — jamais
   * d'immobilisation du joueur, invariant #10. `frame.use` n'est PAS testé
   * ici : c'est `InteractionHandlers.onCameraConsoleUse` qui gère le cycle,
   * cette méthode ne gère que la SORTIE.
   */
  update(frame: InputFrame): void {
    if (!this.activeNames) return;
    if (frame.forward || frame.back || frame.left || frame.right || frame.jump) {
      this.exit();
      return;
    }
    if (
      Math.abs(frame.yaw - this.baseYaw) > LOOK_EXIT_EPSILON ||
      Math.abs(frame.pitch - this.basePitch) > LOOK_EXIT_EPSILON
    ) {
      this.exit();
    }
  }
}
