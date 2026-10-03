import type * as THREE from "three";
export type WeaponKind = "none" | "melee" | "pistol" | "shotgun";

export type FiringWeapon = Exclude<WeaponKind, "none">;

/** Un déclenchement réel, jamais une tentative à sec ou pendant le cooldown. */
export interface FireEvent {
  weapon: FiringWeapon;
  /** Origine authentique du pas fixe (yeux, non bobée) — pas une position rendue. */
  muzzlePosition: THREE.Vector3;
  /** Direction de visée unitaire au moment du tir. */
  muzzleDirection: THREE.Vector3;
  // see: docs/6-reference/notes-code-gameplay-joueur.md#contrats-des-armes
  pelletEndpoints?: THREE.Vector3[];
}

export interface HitEvent {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  material: string;
  weapon: FiringWeapon;
  colliderHandle: number;
  /** Distance en mètres entre l'origine du tir et `point`. */
  distance: number;
}

/** Horloges de présentation avancées au pas fixe ; aucune ne conditionne un tir. */
export interface ViewmodelClocks {
  active: WeaponKind;
  /** Arme montrée avant le dernier changement. */
  previous: WeaponKind;
  sinceSwitch: number;
  sinceMeleeFire: number;
  sincePistolFire: number;
  sinceShotgunFire: number;
}
