import type { MoveConfig } from "../../../../game/player/movement/moveConfig";
import type { WeaponConfig } from "../../../../game/player/weapons/weaponConfig";
import type { SuitConfig } from "../../../../game/entities/suit/suitConfig";

// see: docs/6-reference/notes-code-interface.md#outils-de-développement
export interface ConfigEditor<T extends object> {
  readonly values: T;
  set<K extends keyof T>(key: K, value: T[K]): void;
  refresh(): void;
}

export interface TuningField<K extends string> {
  key: K;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
  unit?: string;
}

export type MoveKey = Exclude<keyof MoveConfig, "autostepIncludeDynamicBodies">;

export interface MoveField extends TuningField<MoveKey> {
  /** Lu par Rapier (capsule, KCC) : sans effet tant que `player.applyConfig()` n'a pas été rappelé. Marqué ⚙. */
  requiresApplyConfig?: boolean;
}

export interface FieldGroup<F> {
  title: string;
  fields: readonly F[];
}

export type ImpactKey = Extract<
  keyof WeaponConfig,
  | "hitstopDuration"
  | "hitstopScale"
  | "enemyHitstopDuration"
  | "enemyHitstopScale"
  | "shakeAmplitude"
  | "shakeDuration"
  | "enemyShakeAmplitude"
  | "enemyShakeDuration"
>;

export type HitmarkerKey = Extract<
  keyof WeaponConfig,
  | "hitmarkerDuration"
  | "hitmarkerSize"
  | "hitmarkerThickness"
  | "hitmarkerKillDuration"
  | "hitmarkerKillSize"
  | "hitmarkerKillThickness"
>;

export type CrosshairKey = Extract<
  keyof WeaponConfig,
  | "crosshairSize"
  | "crosshairGap"
  | "crosshairThickness"
  | "crosshairDotRadius"
  | "crosshairPulseScale"
  | "crosshairPulseDuration"
>;

export type SuitFeedbackKey = Extract<
  keyof SuitConfig,
  "knockbackSpeed" | "knockbackDecayTime" | "knockbackUpBoost" | "hitFlashDuration"
>;
