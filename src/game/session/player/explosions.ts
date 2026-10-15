import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { hasClearWorldPath } from "../../entities/shared/enemyPerception";
import { blastDamageAt, explosionConfig, type BlastConfig } from "../../level/props/propConfig";
import { useGameStore } from "../../hud/state";
import type { GameEngine } from "../gameEngine";
import type { GameSession } from "../gameSession";
import { applyPlayerDamage } from "./feedback";

// Un souffle sur les vivants : celui d'un prop `gaz` ou d'une fusée du pistolet
// de détresse. `PropSystem` s'occupe des props (impulsion, réaction en chaîne) ;
// ici, le joueur et les ennemis.

export interface BlastOutcome {
  suitKills: number;
  directorKills: number;
  /** PV retirés au joueur. */
  playerDamage: number;
}

const rayScratch = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
const normalScratch = new THREE.Vector3();

/**
 * Applique un souffle centré sur `center`, dans le pas fixe. Un mur arrête le
 * souffle : seul ce qui a une ligne dégagée vers le centre est touché.
 */
export function applyBlast(
  engine: GameEngine,
  session: GameSession,
  center: THREE.Vector3,
  blast: BlastConfig = explosionConfig,
): BlastOutcome {
  const damageAt = (distance: number) => blastDamageAt(distance, blast);
  const reaches = (point: THREE.Vector3) => hasClearWorldPath(session.physics, center, point, rayScratch);
  const gibDistance = blast.gibOnKill ? blast.radius : blast.gibDistance;

  const suitDeathsBefore = session.suitManager.deathEvents.length;
  session.suitManager.applyBlast(center, damageAt, reaches, gibDistance);
  const directorDeathsBefore = session.directorManager.deathEvents.length;
  session.directorManager.applyBlast(center, damageAt, reaches, blast.gibOnKill ? blast.radius : undefined);

  let playerDamage = 0;
  const position = session.player.position;
  const amount = Math.round(damageAt(position.distanceTo(center)) * blast.playerDamageScale);
  if (amount > 0 && session.run.playerHp > 0 && reaches(position)) {
    const hpBefore = session.run.playerHp;
    normalScratch.subVectors(center, position);
    applyPlayerDamage(engine, session, amount, normalScratch);
    playerDamage = hpBefore - session.run.playerHp;
    // Ponctuel, comme un soin : le HUD n'attend pas le prochain coup d'un ennemi.
    useGameStore.getState().setPlayerHp(session.run.playerHp);
  }

  return {
    suitKills: session.suitManager.deathEvents.length - suitDeathsBefore,
    directorKills: session.directorManager.deathEvents.length - directorDeathsBefore,
    playerDamage,
  };
}
