import type { GameEngine } from "../session/gameEngine";
import { captureArrival } from "../session/campaign/campaignArrival";
import { campaignArrival, campaignPersistenceFailed } from "../session/campaign/campaignStorage";
import type { CampaignDebugCommand } from "../session/campaign/campaignTypes";

export function createCampaignDebug(engine: GameEngine) {
  return {
    action: (command: CampaignDebugCommand) => {
      if (engine.flow.isPlaying()) engine.session.devCampaignCommands.push(command);
    },
    etat: () => ({
      level: engine.session.choice.id,
      mode: engine.session.entryMode,
      playing: engine.flow.isPlaying(),
      entry: engine.session.entryArrival,
      current: captureArrival(engine.session),
      saved: campaignArrival(),
      persistenceFailed: campaignPersistenceFailed(),
      cards: [...engine.session.cards],
      time: engine.session.stats.gameplayElapsed,
      pickupRadius: engine.session.pickupRadius,
      meleeDamageScale: engine.session.weapons.meleeDamageScale,
      sightRangeScale: engine.session.suitManager.sightRangeScale,
      maxHp: engine.session.playerMaxHp,
      pistolMaxAmmo: engine.session.weapons.pistolMaxAmmo,
    }),
  };
}
