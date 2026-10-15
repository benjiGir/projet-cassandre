import type * as THREE from "three";

import type { InputFrame } from "../../../core/input/inputTypes";

// see: docs/archive/reference-conventions-nommage.md#préfixe-cam

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

// see: docs/6-reference/notes-code-gameplay-niveau.md#écrans-et-douches
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
    return this.byName.get(this.activeNames[this.index]) ?? null;
  }

  get cameraIndex(): number {
    return this.index;
  }
  get cameraCount(): number {
    return this.activeNames?.length ?? 0;
  }

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
