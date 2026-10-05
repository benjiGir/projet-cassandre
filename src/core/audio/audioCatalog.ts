import type { FiringWeapon } from "../../game/player/weapons/weaponTypes";
import type { DoorMovement } from "../../game/level/doors/doorTypes";
import type { DoorSfxEvent, EnemySfxEvent, EnemyVoice, SfxDef, SfxId } from "./audioTypes";

// see: docs/6-reference/notes-code-core.md#adaptateurs-audio
export const POOL_LECTURES = 12;

export const PITCH_VARIATION = 0.08;

export const SFX_TABLE: Record<SfxId, SfxDef> = {
  melee_fire: { sprite: "crowbar_swing", volume: 0.7, pitch: 0.04 },
  shotgun_fire: { sprite: "shotgun", volume: 1.0, pitch: 0.025 },
  impact_concrete: { sprite: "impact_concrete", volume: 0.8 },
  impact_metal: { sprite: "impact_metal", volume: 0.8 },
  impact_flesh: { sprite: "impact_flesh", volume: 0.8 },
  enemy_alert: { sprite: "suit_alert", volume: 0.9 },
  enemy_telegraph: { sprite: "suit_telegraph", volume: 1.0 },
  enemy_shot: { sprite: "suit_shot", volume: 0.85, pitch: 0.03 },
  enemy_hurt: { sprite: "enemy_hurt", volume: 0.7 },
  enemy_death: { sprite: "suit_death", volume: 0.9 },
  enemy_gib: { sprite: "gib_splat", volume: 1.0, pitch: 0.1 },
  door_locked: { sprite: "door_locked", volume: 0.8 },
  door_unlock: { sprite: "door_unlock", volume: 0.9 },
  door_swing: { sprite: "door_open", volume: 0.85 },
  door_slide: { sprite: "door_slide", volume: 0.7 },
  door_shutter: { sprite: "door_shutter", volume: 0.9 },
  secret_found: { sprite: "secret_found", volume: 0.9 },
  heal_pickup: { sprite: "pickup_health", volume: 0.7 },
  pistol_fire: { sprite: "pistol_fire", volume: 0.75, pitch: 0.025 },
  ammo_pickup: { sprite: "pickup_ammo", volume: 0.7 },
  prop_break_wood: { sprite: "prop_break_wood", volume: 0.85 },
  prop_break_glass: { sprite: "impact_glass", volume: 0.9 },
  sanitaire_use: { sprite: "toilet_flush", volume: 0.8 },
  sanitaire_break: { sprite: "ceramic_break", volume: 0.9 },
  water_drink: { sprite: "water_gulp", volume: 0.7 },
  food_eat: { sprite: "food_eat", volume: 0.65 },
  explosion: { sprite: "explosion", volume: 1.0, pitch: 0.04 },
  rampant_alert: { sprite: "rampant_alert", volume: 0.85, pitch: 0.1 },
  rampant_telegraph: { sprite: "rampant_telegraph", volume: 0.9, pitch: 0.06 },
  rampant_attack: { sprite: "rampant_attack", volume: 0.8, pitch: 0.06 },
  rampant_death: { sprite: "rampant_death", volume: 0.85, pitch: 0.1 },
};

export const WEAPON_FIRE_SFX: Record<FiringWeapon, SfxId> = {
  kick: "melee_fire",
  pistol: "pistol_fire",
  melee: "melee_fire",
  shotgun: "shotgun_fire",
};

export const MATERIAL_IMPACT_SFX: Record<string, SfxId> = {
  concrete: "impact_concrete",
  metal: "impact_metal",
  flesh: "impact_flesh",
};

export const DEFAULT_IMPACT_SFX: SfxId = "impact_concrete";

export const PROP_BREAK_SFX: Record<string, SfxId> = {
  bois: "prop_break_wood",
  carton: "prop_break_wood",
  verre: "prop_break_glass",
  metal: "impact_metal",
  farine: "prop_break_wood", // sac de papier qui éclate : même famille sèche que le bois/carton
  eau: "water_drink", // seul timbre liquide du catalogue (le vivier de la chambre froide)
  electronique: "impact_metal",
  // La bonbonne qui cède : la tôle. Le souffle a son propre son, joué par l'explosion.
  gaz: "impact_metal",
};

export const DEFAULT_PROP_BREAK_SFX: SfxId = "prop_break_wood";

export const ENEMY_SFX: Record<EnemyVoice, Record<EnemySfxEvent, SfxId>> = {
  costard: {
    alert: "enemy_alert",
    telegraph: "enemy_telegraph",
    shot: "enemy_shot",
    hurt: "enemy_hurt",
    death: "enemy_death",
  },
  rampant: {
    alert: "rampant_alert",
    telegraph: "rampant_telegraph",
    shot: "rampant_attack",
    // Pas de cri de douleur propre : il meurt en deux balles.
    hurt: "enemy_hurt",
    death: "rampant_death",
  },
  // Pas encore de voix propre : celle du Costard, et le coup de matraque du Rampant.
  vigile: {
    alert: "enemy_alert",
    telegraph: "enemy_telegraph",
    shot: "rampant_attack",
    hurt: "enemy_hurt",
    death: "enemy_death",
  },
};

export const DOOR_SFX: Record<DoorSfxEvent, SfxId> = {
  locked: "door_locked",
  unlock: "door_unlock",
};

export const DOOR_MOVEMENT_SFX: Record<DoorMovement, SfxId> = {
  battant: "door_swing",
  coulisse: "door_slide",
  descend: "door_slide",
  monte: "door_shutter",
};
