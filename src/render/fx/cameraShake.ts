import * as THREE from "three";

const SHAKE_NEGLIGIBLE_FRACTION = 0.05;
const SHAKE_DECAY_RATE = -Math.log(SHAKE_NEGLIGIBLE_FRACTION); // ≈ 2.9957


export class CameraShake {
  private shakePeak = 0;
  private shakeElapsed = 0;
  private shakeDurationActive = 0;


  constructor(private readonly random: () => number) {}

  triggerShake(amplitude: number, duration: number) {
    const current = this.currentShakeAmplitude();
    this.shakePeak = Math.max(current, amplitude);
    this.shakeElapsed = 0;
    this.shakeDurationActive = duration;
  }

  private currentShakeAmplitude(): number {
    if (this.shakePeak <= 0 || this.shakeDurationActive <= 0) return 0;
    if (this.shakeElapsed >= this.shakeDurationActive) return 0;
    const k = SHAKE_DECAY_RATE / this.shakeDurationActive;
    return this.shakePeak * Math.exp(-k * this.shakeElapsed);
  }

  currentShakeOffset(out: THREE.Vector3): THREE.Vector3 {
    const amp = this.currentShakeAmplitude();
    if (amp <= 0) return out.set(0, 0, 0);

    const theta = this.random() * Math.PI * 2;
    const phi = Math.acos(2 * this.random() - 1);
    // La racine cubique répartit uniformément dans le volume, pas seulement sur la surface.
    const r = amp * Math.cbrt(this.random());
    const sinPhi = Math.sin(phi);
    out.set(r * sinPhi * Math.cos(theta), r * sinPhi * Math.sin(theta), r * Math.cos(phi));
    return out;
  }
  update(realDt: number): void { this.shakeElapsed += realDt; }

  reset(): void {
    this.shakePeak = 0;
    this.shakeElapsed = 0;
    this.shakeDurationActive = 0;
  }
}
