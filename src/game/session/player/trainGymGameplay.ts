import * as THREE from "three";
import { moveConfig } from "../../player/movement/moveConfig";
import type { GameEngine } from "../gameEngine";
import { applyPlayerDamage, showHudMessage } from "./feedback";
import { recordSuitKills } from "../progression/score";
import { streamEvent } from "../stream/streamFeed";

const previousEnemy = new THREE.Vector3();

// see: docs/4-technique/prototype-trains.md#contact-mortel
export function updateTrainGym(engine: GameEngine, dt: number, use: boolean): void {
  const session = engine.session;
  const gym = session.trainGym;
  if (!gym) return;
  if (use) gym.use(session.player.position);
  gym.system.update(dt, session.player.position);
  gym.presentation.updateFixed(gym.system);
  for (const message of gym.system.takeFeedback()) showHudMessage(message);
  for (const suit of session.suitManager.suits) {
    if (
      !suit.isAlive ||
      !gym.system.touches({
        position: suit.position,
        previous: suit.interpolatedPosition(0, previousEnemy),
        radius: suit.cfg.capsuleRadius,
        halfHeight: suit.cfg.capsuleHalfHeight + suit.cfg.capsuleRadius,
      })
    )
      continue;
    if (session.suitManager.debugKill(suit)) {
      recordSuitKills(session.stats, 1);
      session.heroPortrait.kill(1);
      streamEvent(session, "kill");
      showHudMessage("Ennemi fauché par une rame");
    }
  }
  if (
    gym.system.touches({
      position: session.player.position,
      previous: session.player.previousPosition,
      radius: moveConfig.capsuleRadius,
      halfHeight: moveConfig.capsuleHalfHeight + moveConfig.capsuleRadius,
    })
  ) {
    showHudMessage("Fauché par une rame");
    applyPlayerDamage(engine, session, session.playerHp, undefined, "train");
  }
}
