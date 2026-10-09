import type { GameEngine } from "../session/gameEngine";
import { applyPlayerDamage } from "../session/player/feedback";
import { usePerkKiosk } from "../session/progression/perks";
import type { CampaignDebugCommand } from "../session/campaign/campaignTypes";

export function applyCampaignCommand(engine: GameEngine, command: CampaignDebugCommand): void {
  const session = engine.session;
  switch (command) {
    case "death":
      applyPlayerDamage(engine, session, session.playerHp);
      break;
    case "consume":
      applyPlayerDamage(engine, session, 10);
      session.weapons.pistolAmmo = Math.max(0, session.weapons.pistolAmmo - 5);
      session.weapons.shotgunAmmo = Math.max(0, session.weapons.shotgunAmmo - 2);
      break;
    case "ammo":
      usePerkKiosk(session, { perk: "perche", price: 10 });
      break;
    case "heal":
      usePerkKiosk(session, { perk: "boisson", price: 55 });
      break;
    default:
      command satisfies never;
  }
}
