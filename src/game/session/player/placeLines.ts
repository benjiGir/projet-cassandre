import type { EnemyState } from "../../entities/shared/enemyTypes";
import { levelSpaceAt } from "../../level/navigation/levelSpaces";
import type { HeroLineId } from "../presentation/heroLines";
import type { GameSession } from "../gameSession";
import { triggerHeroLine } from "./feedback";

// see: docs/4-technique/systemes-de-niveau.md#espaces-du-niveau

/** Temps d'observation dans un espace avant d'en parler, en secondes de gameplay. */
export const PLACE_LINE_DWELL_SECONDS = 1.5;

export interface PlaceLineState {
  space: string | null;
  dwell: number;
  /** Un combat a éclaté pendant CETTE visite : la réplique attend la prochaine. */
  abandoned: boolean;
}

export function createPlaceLineState(): PlaceLineState {
  return { space: null, dwell: 0, abandoned: false };
}

/**
 * Avance le suivi d'un pas fixe et rend la réplique de lieu à tenter, ou
 * `null`. Tant que le canal du héros la refuse (délai entre répliques), elle
 * est rendue à nouveau au pas suivant, jusqu'à la sortie de l'espace.
 */
export function nextPlaceLine(
  state: PlaceLineState,
  space: string | null,
  dt: number,
  said: ReadonlySet<HeroLineId>,
  enemyEngaged: boolean,
  lines: ReadonlyMap<string, HeroLineId>,
): HeroLineId | null {
  if (space !== state.space) {
    state.space = space;
    state.dwell = 0;
    state.abandoned = false;
  }
  const line = space === null ? undefined : lines.get(space);
  if (line === undefined || said.has(line) || state.abandoned) return null;
  if (enemyEngaged) {
    state.abandoned = true;
    return null;
  }
  state.dwell += dt;
  return state.dwell >= PLACE_LINE_DWELL_SECONDS ? line : null;
}

const ENGAGED_STATES: ReadonlySet<EnemyState> = new Set(["alert", "chase", "attack", "stagger"]);

function enemyEngaged(session: GameSession): boolean {
  for (const suit of session.suitManager.suits) if (ENGAGED_STATES.has(suit.state)) return true;
  for (const director of session.directorManager.directors) if (ENGAGED_STATES.has(director.state)) return true;
  return false;
}

export function updatePlaceLine(session: GameSession, dt: number): void {
  if (!session.levelSpaces) return;
  const space = levelSpaceAt(session.levelSpaces, session.player.position);
  const line = nextPlaceLine(
    session.placeLine,
    space,
    dt,
    session.heroLinesSaid,
    enemyEngaged(session),
    session.placeLines,
  );
  if (line) triggerHeroLine(session, line);
}
