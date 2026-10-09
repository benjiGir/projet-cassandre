import { Vector3 } from "three";
import { moveConfig } from "../../player/movement/moveConfig";
import { directorConfig } from "../../entities/director/directorConfig";
import type { GameEngine } from "../gameEngine";
import { applyPlayerDamage, showHudMessage } from "./feedback";
import { recordDirectorKills, recordSuitKills } from "../progression/score";
import { startKillRush } from "../progression/perks";
import { streamEvent } from "../stream/streamFeed";

const previousEnemy = new Vector3();

// see: docs/4-technique/trains-metro.md#contact
export function updateLevelTrains(engine: GameEngine, dt: number): void {
  const session = engine.session;
  const trains = session.gltfLevelSession?.current?.trains;
  if (!trains?.active) return;
  trains.fixed(dt, session.player.position);
  for (const message of trains.system.takeFeedback()) showHudMessage(message);
  let suitKills = 0,
    directorKills = 0;
  for (const suit of session.suitManager.suits) {
    if (
      !suit.isAlive ||
      !trains.system.touches({
        position: suit.position,
        previous: suit.interpolatedPosition(0, previousEnemy),
        radius: suit.cfg.capsuleRadius,
        halfHeight: suit.cfg.capsuleHalfHeight + suit.cfg.capsuleRadius,
      })
    )
      continue;
    if (session.suitManager.debugKill(suit)) suitKills++;
  }
  for (const director of session.directorManager.directors) {
    if (
      !director.isAlive ||
      !trains.system.touches({
        position: director.position,
        previous: director.previousPosition,
        radius: directorConfig.capsuleRadius,
        halfHeight: directorConfig.capsuleHalfHeight + directorConfig.capsuleRadius,
      })
    )
      continue;
    if (session.directorManager.debugKill(director)) directorKills++;
  }
  recordSuitKills(session.stats, suitKills);
  recordDirectorKills(session.stats, directorKills);
  const kills = suitKills + directorKills;
  session.stats.trainKills += kills;
  if (kills > 0) {
    session.heroPortrait.kill(kills);
    startKillRush(session);
    for (let i = 0; i < kills; i++) streamEvent(session, directorKills > i ? "boss" : "kill");
    showHudMessage("Ennemi fauché par une rame");
  }
  if (session.playerHp <= 0) return;
  if (
    trains.system.touches({
      position: session.player.position,
      previous: session.player.previousPosition,
      radius: moveConfig.capsuleRadius,
      halfHeight: moveConfig.capsuleHalfHeight + moveConfig.capsuleRadius,
    })
  ) {
    showHudMessage("Fauché par une rame");
    applyPlayerDamage(engine, session, session.playerHp, undefined, "train");
    return;
  }
  const crossings = trains.crossed(session.player.position);
  session.stats.trainCrossings += crossings;
  for (let i = 0; i < crossings; i++) streamEvent(session, "train");
}
