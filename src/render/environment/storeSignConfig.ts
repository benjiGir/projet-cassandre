import type { NeonStep } from "./storeSignTypes";

export const STORE_SIGN_PREFIX = "fx_enseigne_hyper_varan_";
export const STORE_SIGN_DIFFUSE = "#391018";
export const STORE_SIGN_EMISSIVE = "#ff321c";
export const STORE_SIGN_EMISSION = 1.35;

export const STEADY_NEON: readonly NeonStep[] = [[1, 1]];

// Séquences fixes : aucun tirage ne doit décaler le RNG du combat ou le rejeu.
export const FAULTY_NEONS: Readonly<Record<number, readonly NeonStep[]>> = {
  3: [[2.6, 1], [0.12, 0], [0.09, 0.65], [0.18, 0], [0.1, 1], [0.22, 0], [1.4, 0.3], [0.13, 0], [1.8, 1]],
  6: [[5.4, 0], [0.13, 0.7], [0.17, 0], [0.19, 1], [0.32, 0], [0.85, 0.4], [3.1, 0]],
  8: [[1, 0]],
  9: [[1.9, 0.75], [0.11, 0], [0.14, 1], [0.16, 0], [0.21, 0.35], [0.28, 0], [2.7, 1], [1.6, 0]],
};
