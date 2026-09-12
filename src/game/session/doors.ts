import * as THREE from "three";

import { playDoorSfx } from "../../core/audio";
import { LOYALTY_CARD_LABELS, type LoyaltyCard } from "../player/loyaltyCards";
import { hasCard } from "./cards";
import { showHudMessage } from "./feedback";
import { type GameSession } from "./gameSession";
import { type GameEngine } from "./gameEngine";

/**
 * Déverrouille le `door_*` nommé `targetName` (glissement + collider
 * désactivé, voir `OpeningDoor` dans `gameSession.ts`). Retourne `false`
 * sans effet si `targetName` ne correspond à aucun `door_*` du niveau
 * courant (erreur de données Blender, pas un état de jeu valide).
 * see: docs/systems/session.md#portes-et-fin-de-niveau
 */
export function unlockDoor(session: GameSession, targetName: string, successMessage: string): boolean {
  const door = (session.gltfLevelSession?.current?.doors ?? []).find((d) => d.name === targetName);
  if (!door) {
    console.error(`[main] use_* référence une porte introuvable ("${targetName}").`);
    return false;
  }
  session.unlockedDoors.add(targetName);
  const t = door.body.translation();
  session.openingDoor = { body: door.body, startY: t.y, targetY: t.y - door.halfExtents.y * 2, t: 0 };
  door.collider.setEnabled(false);
  showHudMessage(successMessage);
  playDoorSfx("unlock");
  return true;
}

/**
 * Tentative d'ouverture d'une porte gardée par une carte de fidélité
 * (jalon N7) : déverrouille si la carte est en poche, refuse sinon — message
 * et son, sans jamais consommer le `use_*`, donc réessayable.
 *
 * Seule `door_e_exit` arme le suivi de fin de niveau (voir la doc de
 * `ExitDoorTracking`) : une autre porte à carte partage exactement la même
 * mécanique sans jamais être une sortie.
 *
 * see: docs/systems/session.md#cartes-de-fidélité
 */
export function tryOpenCardDoor(session: GameSession, targetName: string, required: LoyaltyCard): boolean {
  if (session.unlockedDoors.has(targetName)) return false; // déjà déverrouillée
  if (!hasCard(session, required)) {
    showHudMessage(`${LOYALTY_CARD_LABELS[required]} requise`);
    playDoorSfx("locked");
    return false;
  }
  const ouverte = unlockDoor(session, targetName, "Porte déverrouillée");
  if (ouverte && targetName === "door_e_exit") setupExitDoorTracking(session, targetName);
  return ouverte;
}

/**
 * Arme le suivi de franchissement pour `doorName` — voir la doc de
 * `ExitDoorTracking` dans `gameSession.ts`. Appelé UNIQUEMENT depuis
 * `onExitDoorUse` (`game/loop/updateGameplay.ts`) pour `"door_e_exit"`,
 * jamais pour `door_b_frozen` (le secret 1 n'est pas une sortie de niveau).
 */
export function setupExitDoorTracking(session: GameSession, doorName: string): void {
  const door = (session.gltfLevelSession?.current?.doors ?? []).find((d) => d.name === doorName);
  if (!door) return; // défensif : `unlockDoor` a déjà loggé une erreur si absent, rien à ajouter ici.

  // Axe LOCAL le plus fin (hors hauteur) = l'épaisseur du vantail, donc sa
  // normale — même heuristique que `buildCuboidCollider`/`buildDoor`
  // (les deux ne connaissent que des demi-étendues, jamais un "axe de
  // porte" explicite côté données Blender).
  const localThinIsX = Math.abs(door.halfExtents.x) <= Math.abs(door.halfExtents.z);
  const localAxis = localThinIsX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const r = door.body.rotation();
  const crossingAxis = localAxis.applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).normalize();

  const t = door.body.translation();
  const doorPosition = new THREE.Vector3(t.x, t.y, t.z);
  const playerOffset = new THREE.Vector3().subVectors(session.player.position, doorPosition);
  const insideSign: 1 | -1 = playerOffset.dot(crossingAxis) >= 0 ? 1 : -1;

  session.exitDoorTracking = {
    doorPosition,
    crossingAxis,
    insideSign,
    halfExtentOnAxis: localThinIsX ? door.halfExtents.x : door.halfExtents.z,
  };
}

/**
 * Bascule vers l'écran de fin de niveau (`LEVEL_COMPLETED` envoyé à
 * l'acteur de flux) et libère le pointeur, même geste qu'à la mort — voir
 * `feedback.ts::handlePlayerHit` pour la même discussion d'idempotence
 * appliquée à `session.levelCompleteHandled`.
 * see: docs/systems/session.md#portes-et-fin-de-niveau
 */
export function triggerLevelComplete(engine: GameEngine, session: GameSession): void {
  if (session.levelCompleteHandled) return;
  session.levelCompleteHandled = true;
  engine.flowActor.send({ type: "LEVEL_COMPLETED" });
  document.exitPointerLock();
}
