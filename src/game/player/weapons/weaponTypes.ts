import type * as THREE from "three";
export type WeaponKind = "none" | "melee" | "pistol" | "shotgun" | "flare";
export type AmmoWeaponKind = "pistol" | "shotgun" | "flare";

export type FiringWeapon = Exclude<WeaponKind, "none"> | "kick";

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
  /** Multiplicateur de dégâts porté par le coup (perk de la partie) ; absent = 1. */
  damageScale?: number;
}

/** Horloges de présentation avancées au pas fixe ; aucune ne conditionne un tir. */
export interface ViewmodelClocks {
  active: WeaponKind;
  /** Arme montrée avant le dernier changement. */
  previous: WeaponKind;
  sinceSwitch: number;
  sinceKickFire?: number;
  sinceMeleeFire: number;
  sincePistolFire: number;
  sinceShotgunFire: number;
  sinceFlareFire: number;
}

/** Une fusée du pistolet de détresse en vol : simulée au pas fixe, dessinée entre ses deux dernières positions. */
export interface FlareProjectile {
  /** Numéro de tir, croissant dans la partie : l'affichage s'en sert pour suivre la même fusée d'une image à l'autre. */
  readonly id: number;
  readonly position: THREE.Vector3;
  readonly previousPosition: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  /** Secondes de gameplay depuis le tir. */
  age: number;
}

/** Une fusée vient d'éclater : contre un obstacle, ou en l'air en fin de course. */
export interface FlareDetonation {
  id: number;
  /** Centre du souffle (MONDE), décollé de la surface touchée. */
  point: THREE.Vector3;
}
