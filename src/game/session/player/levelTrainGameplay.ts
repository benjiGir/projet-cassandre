import type { LevelTrains } from "../../level/trains/levelTrains";
import { Vector3 } from "three";
import { moveConfig } from "../../player/movement/moveConfig";
import { directorConfig } from "../../entities/director/directorConfig";
import type { GameEngine } from "../gameEngine";
import type { GameSession } from "../gameSession";
import { applyPlayerDamage, showHudMessage, triggerHeroLine } from "./feedback";
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
  let controllerKills = 0;
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
    if (session.suitManager.debugKill(suit)) {
      suitKills++;
      if (suit.cfg.charge) controllerKills++;
    }
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
  recordSuitKills(session.run.stats, suitKills);
  recordDirectorKills(session.run.stats, directorKills);
  const kills = suitKills + directorKills;
  session.run.stats.trainKills += kills;
  session.run.stats.controllerTrainKills += controllerKills;
  noteControllerPush(session, trains);
  presentTrainKills(session, kills, directorKills, controllerKills);
  if (session.run.playerHp <= 0) return;
  if (
    trains.system.touches({
      position: session.player.position,
      previous: session.player.previousPosition,
      radius: moveConfig.capsuleRadius,
      halfHeight: moveConfig.capsuleHalfHeight + moveConfig.capsuleRadius,
    })
  ) {
    showHudMessage("Fauché par une rame");
    applyPlayerDamage(engine, session, session.run.playerHp, undefined, "train");
    return;
  }
  noteCrossings(session, trains.crossed(session.player.position));
}

/** Une traversée de voie réussie : le direct la voit, et le héros en dit un mot la première fois. */
function noteCrossings(session: GameSession, crossings: number): void {
  session.run.stats.trainCrossings += crossings;
  for (let i = 0; i < crossings; i++) streamEvent(session, "train");
  if (crossings > 0) triggerHeroLine(session, "metro_traversee");
}

function noteControllerPush(session: GameSession, trains: LevelTrains): void {
  if (session.run.stats.controllerPushExpires >= session.run.stats.gameplayElapsed) {
    const feetY = session.player.position.y - moveConfig.capsuleHalfHeight - moveConfig.capsuleRadius;
    if (
      trains.data.navigationZones.some(
        ({ box }) =>
          session.player.position.x >= box.min.x &&
          session.player.position.x <= box.max.x &&
          session.player.position.z >= box.min.z &&
          session.player.position.z <= box.max.z &&
          feetY >= box.min.y &&
          feetY <= box.max.y,
      )
    ) {
      session.run.stats.controllerPushesToRail++;
      session.run.stats.controllerPushExpires = -Infinity;
    }
  }
}

function presentTrainKills(session: GameSession, kills: number, directorKills: number, controllerKills: number): void {
  if (kills > 0) {
    session.heroPortrait.kill(kills);
    startKillRush(session.run);
    for (let i = 0; i < kills; i++)
      streamEvent(
        session,
        directorKills > i ? "boss" : i < directorKills + controllerKills ? "controleur_rame" : "kill",
      );
    showHudMessage("Ennemi fauché par une rame");
    triggerHeroLine(session, "metro_ennemi_fauche");
  }
}
