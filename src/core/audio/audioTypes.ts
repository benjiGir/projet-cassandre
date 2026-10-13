// see: docs/6-reference/notes-code-core.md#adaptateurs-audio
export interface SfxDef {
  sprite: string;
  volume: number;
  pitch?: number;
}

export type EnemySfxEvent = "alert" | "telegraph" | "shot" | "hurt" | "death";

/** Qui pousse le son : chaque espèce d'ennemi a sa voix. */
export type EnemyVoice = "costard" | "rampant" | "vigile" | "controleur" | "chef_brigade";
export type DoorSfxEvent = "locked" | "unlock";
