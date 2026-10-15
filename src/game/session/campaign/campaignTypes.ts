import type { WeaponInventory } from "../../player/weapons/weaponInventory";
import type { Perk } from "../../player/perks";
import type { Difficulty } from "../progression/difficulty";

export interface CampaignArrival {
  readonly weapons: WeaponInventory;
  readonly perks: readonly Perk[];
  readonly wallet: number;
  readonly hp: number;
  readonly difficulty: Difficulty;
}

export type EntryMode = "new-game" | "standalone" | "transition" | "continue" | "dev";
export type CampaignDebugCommand = "death" | "consume" | "ammo" | "heal";

export interface SessionEntry {
  readonly mode: EntryMode;
  readonly arrival?: CampaignArrival;
}
