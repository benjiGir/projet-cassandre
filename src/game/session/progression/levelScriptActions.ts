import type { ScriptAction } from "../../level/scripting/levelScript";
import { HERO_LINES, type HeroLineId } from "../presentation/heroLines";
import { showAnnouncement, triggerHeroLine } from "../player/feedback";
import { streamEvent } from "../stream/streamFeed";
import { spawnSuitAt } from "../spawning";
import { difficultyConfig, wokenSpawns } from "./difficulty";
import type { GameEngine } from "../gameEngine";
import type { GameSession } from "../gameSession";

/** Exécute une action du script de niveau, dans le pas fixe. */
export function runScriptAction(engine: GameEngine, session: GameSession, action: ScriptAction): void {
  switch (action.kind) {
    case "train": {
      const trains = session.gltfLevelSession?.current?.trains;
      if (action.commande === "enable" || action.commande === "disable")
        trains?.system.enqueue({ type: "enable", lane: action.voie, enabled: action.commande === "enable" });
      else if (action.commande === "switch")
        trains?.system.enqueue({ type: "switch", lane: action.voie, route: action.trajet });
      else trains?.system.enqueue({ type: action.commande, lane: action.voie });
      return;
    }
    case "replique":
      if (Object.hasOwn(HERO_LINES, action.id)) triggerHeroLine(session, action.id as HeroLineId);
      return;
    case "annonce":
      showAnnouncement(action.speaker, action.text, action.voix);
      streamEvent(session, "moment");
      return;
    case "reveiller": {
      const group = wokenSpawns(
        session.gltfLevelSession?.current?.spawnSuits ?? [],
        action.groupe,
        difficultyConfig[session.difficulty].groupShare,
      );
      const woken = session.levelScript.woken.get(action.groupe) ?? [];
      for (const spawn of group) {
        woken.push(spawnSuitAt(engine, session, spawn.position.x, spawn.position.y, spawn.position.z, spawn.kind, true));
      }
      session.levelScript.woken.set(action.groupe, woken);
      return;
    }
    case "chaine":
      session.ecranSystem?.setChaine(action.ecrans, action.chaine);
      return;
    case "verrouiller":
      for (const porte of action.portes) session.doorSystem?.lock(porte);
      return;
    case "deverrouiller":
      for (const porte of action.portes) session.doorSystem?.unlock(porte, session.player.position);
      return;
    default:
      return action satisfies never;
  }
}
