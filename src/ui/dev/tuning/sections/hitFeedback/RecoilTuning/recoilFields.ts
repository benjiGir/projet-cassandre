import type { RecoilKick } from "../../../../../../game/player/weapons/weaponConfig";
import type { TuningField } from "../../../lib/tuningTypes";

export const RECOIL_FIELDS: readonly TuningField<keyof RecoilKick>[] = [
  { key: "kickX", label: "Décalage horizontal", min: -0.3, max: 0.3, step: 0.005, decimals: 3, unit: "m" },
  { key: "kickY", label: "Décalage vertical", min: -0.3, max: 0.3, step: 0.005, decimals: 3, unit: "m" },
  { key: "kickZ", label: "Recul", min: -0.3, max: 0.3, step: 0.005, decimals: 3, unit: "m" },
  { key: "kickPitchDeg", label: "Relèvement", min: -20, max: 20, step: 0.5, decimals: 1, unit: "°" },
  { key: "recoverTime", label: "Retour au repos", min: 0.01, max: 1, step: 0.01, decimals: 2, unit: "s" },
];

export const RECOIL_WEAPONS = [
  { key: "meleeRecoil", label: "Pied-de-biche" },
  { key: "pistolRecoil", label: "Pistolet" },
  { key: "shotgunRecoil", label: "Pompe" },
] as const;
