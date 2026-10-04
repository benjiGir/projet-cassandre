import type * as THREE from "three";

export type NeonStep = readonly [duration: number, brightness: number];

export interface SignLetter {
  readonly material: THREE.MeshLambertMaterial;
  readonly steps: readonly NeonStep[];
  readonly period: number;
  readonly phase: number;
}

export interface StoreSignState {
  time: number;
  readonly letters: readonly SignLetter[];
}
