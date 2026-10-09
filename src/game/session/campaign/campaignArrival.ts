import { perkConfig } from "../../player/perkConfig";
import type { Difficulty } from "../progression/difficulty";
import { weaponConfig } from "../../player/weapons/weaponConfig";
import { INITIAL_PLAYER_MAX_HP } from "../player/playerState";
import { grantPerk } from "../progression/perks";
import type { GameSession } from "../gameSession";
import type { CampaignArrival } from "./campaignTypes";

export function freezeArrival(arrival: CampaignArrival): CampaignArrival {
  return Object.freeze({ ...arrival,
    weapons: Object.freeze({ ...arrival.weapons, owned: Object.freeze([...arrival.weapons.owned]) }),
    perks: Object.freeze([...arrival.perks]),
  });
}

export function captureArrival(session: GameSession): CampaignArrival {
  return freezeArrival({ weapons: session.weapons.inventory(), perks: [...session.perks],
    wallet: session.stream.wallet, hp: session.playerHp, difficulty: session.difficulty });
}

export function applyArrival(session: GameSession, arrival: CampaignArrival): void {
  for (const perk of arrival.perks) grantPerk(session, perk);
  session.weapons.restoreInventory(arrival.weapons);
  session.stream.wallet = arrival.wallet;
  session.playerHp = arrival.hp;
  session.heroPortrait.heal(session.playerHp, session.playerMaxHp);
}

export function metroArrival(difficulty: Difficulty, profile: "type" | "pauvre" | "riche" = "type"): CampaignArrival {
  const rich = profile === "riche";
  const poor = profile === "pauvre";
  return freezeArrival({
    difficulty,
    weapons: {
      owned: poor ? ["melee", "pistol"] : ["melee", "pistol", "shotgun"],
      active: "pistol",
      pistolAmmo: poor ? 12 : rich ? weaponConfig.pistolMaxAmmo + perkConfig.premiumPistolAmmoBonus : Math.floor(weaponConfig.pistolMaxAmmo / 2),
      shotgunAmmo: poor ? 0 : rich ? weaponConfig.shotgunMaxAmmo : Math.floor(weaponConfig.shotgunMaxAmmo / 2),
    },
    perks: poor ? [] : rich ? ["perche", "boisson", "aimant", "premium", "gilet"] : ["perche", "boisson", "aimant"],
    wallet: poor ? 0 : rich ? 150 : 40,
    hp: poor ? 20 : INITIAL_PLAYER_MAX_HP + (rich ? perkConfig.giletMaxHpBonus : 0),
  });
}
