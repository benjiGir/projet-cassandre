import type { EnemyState } from "../../entities/shared/enemyTypes";
import { levelSpaceAt } from "../../level/navigation/levelSpaces";
import type { GameSession } from "../gameSession";
import { triggerHeroLine } from "./feedback";
import { nextPlaceLine } from "./placeLineState";

// see: docs/4-technique/systemes-de-niveau.md#espaces-du-niveau

const ENGAGED_STATES: ReadonlySet<EnemyState> = new Set(["alert", "chase", "attack", "charge", "recover", "stagger"]);

function enemyEngaged(session: GameSession): boolean {
  for (const suit of session.suitManager.suits) if (ENGAGED_STATES.has(suit.state)) return true;
  for (const director of session.directorManager.directors) if (ENGAGED_STATES.has(director.state)) return true;
  return false;
}

export function updatePlaceLine(session: GameSession, dt: number): void {
  if (!session.level.spaces) return;
  const space = levelSpaceAt(session.level.spaces, session.player.position);
  const line = nextPlaceLine(
    session.run.placeLine,
    space,
    dt,
    session.run.heroLinesSaid,
    enemyEngaged(session),
    session.level.placeLines,
  );
  if (line) triggerHeroLine(session, line);
}
