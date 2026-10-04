// see: docs/6-reference/notes-code-core.md#adaptateurs-audio
export type SfxId =
  | "melee_fire"
  | "shotgun_fire"
  | "impact_concrete"
  | "impact_metal"
  | "impact_flesh"
  | "enemy_alert"
  | "enemy_telegraph"
  | "enemy_shot"
  | "enemy_hurt"
  | "enemy_death"
  | "enemy_gib"
  | "door_locked"
  | "door_unlock"
  | "door_swing"
  | "door_slide"
  | "door_shutter"
  | "secret_found"
  | "heal_pickup"
  | "pistol_fire"
  | "ammo_pickup"
  | "prop_break_wood"
  | "prop_break_glass"
  | "sanitaire_use"
  | "sanitaire_break"
  | "water_drink"
  | "food_eat"
  | "explosion"
  | "rampant_alert"
  | "rampant_telegraph"
  | "rampant_attack"
  | "rampant_death";

export interface SfxDef {
  sprite: string;
  volume: number;
  pitch?: number;
}

export type EnemySfxEvent = "alert" | "telegraph" | "shot" | "hurt" | "death";

/** Qui pousse le son : chaque espèce d'ennemi a sa voix. */
export type EnemyVoice = "costard" | "rampant" | "vigile";
export type DoorSfxEvent = "locked" | "unlock";
