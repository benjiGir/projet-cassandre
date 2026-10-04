import type { NamedSpawn } from "../../level/loading/levelTypes";
import type { ScriptAction } from "../../level/scripting/levelScript";
import { HERO_LINES, type HeroLineId } from "../presentation/heroLines";
import { showAnnouncement, triggerHeroLine } from "../player/feedback";
import { streamEvent } from "../stream/streamFeed";
import { spawnSuitAt } from "../spawning";
import { difficultyConfig, wokenGroupSize } from "./difficulty";
import type { GameEngine } from "../gameEngine";
import type { GameSession } from "../gameSession";

/**
 * Les spawns d'un groupe qui apparaissent à son réveil : les premiers par
 * ordre de nom, pour que le niveau décide de ceux qui restent en difficulté
 * basse (`spawn_suit_arene_1` avant `spawn_suit_arene_2`). Comparaison par
 * code de caractère, sans locale : le même ordre sur toutes les machines.
 */
export function wokenSpawns<T extends Pick<NamedSpawn, "name" | "group">>(
  spawns: readonly T[],
  groupe: string,
  share: number,
): T[] {
  const group = spawns
    .filter((spawn) => spawn.group === groupe)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return group.slice(0, wokenGroupSize(group.length, share));
}

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
    case "reveiller": {
      const group = wokenSpawns(
        session.gltfLevelSession?.current?.spawnSuits ?? [],
        action.groupe,
        difficultyConfig[session.difficulty].groupShare,
      );
      const woken = session.levelScript.woken.get(action.groupe) ?? [];
      for (const spawn of group) {
        woken.push(spawnSuitAt(engine, session, spawn.position.x, spawn.position.y, spawn.position.z, spawn.kind));
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
