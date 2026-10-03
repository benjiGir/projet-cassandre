import type { ScriptAction } from "../../level/scripting/levelScript";
import { HERO_LINES, type HeroLineId } from "../presentation/heroLines";
import { showAnnouncement, triggerHeroLine } from "../player/feedback";
import { streamEvent } from "../stream/streamFeed";
import { spawnSuitAt } from "../spawning";
import type { GameEngine } from "../gameEngine";
import type { GameSession } from "../gameSession";

/** Exécute une action du script de niveau, dans le pas fixe. */
export function runScriptAction(engine: GameEngine, session: GameSession, action: ScriptAction): void {
  switch (action.kind) {
    case "replique":
      if (Object.hasOwn(HERO_LINES, action.id)) triggerHeroLine(session, action.id as HeroLineId);
      return;
    case "annonce":
      showAnnouncement(action.speaker, action.text);
      streamEvent(session, "moment");
      return;
    case "reveiller":
      for (const spawn of session.gltfLevelSession?.current?.spawnSuits ?? []) {
        if (spawn.group !== action.groupe) continue;
        spawnSuitAt(engine, session, spawn.position.x, spawn.position.y, spawn.position.z);
      }
      return;
    case "chaine":
      session.ecranSystem?.setChaine(action.ecrans, action.chaine);
      return;
    default:
      return action satisfies never;
  }
}
