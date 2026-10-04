import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { hasClearWorldPath } from "../../entities/shared/enemyPerception";
import { blastDamageAt, explosionConfig } from "../../level/props/propConfig";
import { useGameStore } from "../../hud/state";
import { type GameEngine } from "../gameEngine";
import { type GameSession } from "../gameSession";
import { applyPlayerDamage } from "./feedback";

// Le souffle d'un prop `gaz` sur les vivants. `PropSystem` s'occupe des
// props (impulsion, réaction en chaîne) ; ici, le joueur et les ennemis.

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
export function applyBlast(engine: GameEngine, session: GameSession, center: THREE.Vector3): BlastOutcome {
  const reaches = (point: THREE.Vector3) => hasClearWorldPath(session.physics, center, point, rayScratch);

  const suitDeathsBefore = session.suitManager.deathEvents.length;
  session.suitManager.applyBlast(center, blastDamageAt, reaches, explosionConfig.gibDistance);
  const directorDeathsBefore = session.directorManager.deathEvents.length;
  session.directorManager.applyBlast(center, blastDamageAt, reaches);

  let playerDamage = 0;
  const position = session.player.position;
  const amount = Math.round(blastDamageAt(position.distanceTo(center)) * explosionConfig.playerDamageScale);
  if (amount > 0 && session.playerHp > 0 && reaches(position)) {
    const hpBefore = session.playerHp;
    normalScratch.subVectors(center, position);
    applyPlayerDamage(engine, session, amount, normalScratch);
    playerDamage = hpBefore - session.playerHp;
    // Ponctuel, comme un soin : le HUD n'attend pas le prochain coup d'un ennemi.
    useGameStore.getState().setPlayerHp(session.playerHp);
  }

  return {
    suitKills: session.suitManager.deathEvents.length - suitDeathsBefore,
    directorKills: session.directorManager.deathEvents.length - directorDeathsBefore,
    playerDamage,
  };
}
