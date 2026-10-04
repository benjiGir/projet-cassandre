import * as THREE from "three";

import {
  FAULTY_NEONS,
  STEADY_NEON,
  STORE_SIGN_DIFFUSE,
  STORE_SIGN_EMISSIVE,
  STORE_SIGN_EMISSION,
  STORE_SIGN_PREFIX,
} from "./storeSignConfig";
import type { SignLetter, StoreSignState } from "./storeSignTypes";

const signs = new WeakMap<THREE.Object3D, StoreSignState>();

function brightnessAt(letter: SignLetter, time: number): number {
  let phase = (time + letter.phase) % letter.period;
  for (const [duration, brightness] of letter.steps) {
    if (phase < duration) return brightness;
    phase -= duration;
  }
  return letter.steps[0]![1];
}

export function initializeStoreSign(root: THREE.Object3D): void {
  if (signs.has(root)) return;
  const letters: SignLetter[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshLambertMaterial)) return;
    const name = typeof object.userData.name === "string" ? object.userData.name : object.name;
    if (!name.startsWith(STORE_SIGN_PREFIX)) return;
    const index = Number(name.slice(STORE_SIGN_PREFIX.length).split("_")[0]);
    const steps = FAULTY_NEONS[index] ?? STEADY_NEON;
    const material = object.material;
    material.map = null;
    material.vertexColors = false;
    material.color.set(STORE_SIGN_DIFFUSE);
    material.emissive.set(STORE_SIGN_EMISSIVE);
    const letter: SignLetter = {
      material,
      steps,
      period: steps.reduce((total, [duration]) => total + duration, 0),
      phase: Number.isFinite(index) ? index * 0.43 : 0,
    };
    material.emissiveIntensity = STORE_SIGN_EMISSION * brightnessAt(letter, 0);
    material.needsUpdate = true;
    letters.push(letter);
  });
  signs.set(root, { time: 0, letters });
}

/** Appelé au pas fixe : le clignotement s'arrête en pause et suit le rejeu. */
export function updateStoreSign(root: THREE.Object3D | null, dt: number): void {
  if (!root) return;
  const sign = signs.get(root);
  if (!sign || sign.letters.length === 0) return;
  sign.time += dt;
  for (const letter of sign.letters) {
    letter.material.emissiveIntensity = STORE_SIGN_EMISSION * brightnessAt(letter, sign.time);
  }
}
