import * as THREE from "three";

import { playDoorSfx } from "../../../core/audio/audio";
import { LOYALTY_CARD_LABELS, type LoyaltyCard } from "../../player/loyaltyCards";
import { hasCard } from "./cards";
import { noteRunOutcome, showHudMessage } from "../player/feedback";
import { publishLevelRecap } from "./recap";
import { type GameSession } from "../gameSession";
import { type GameEngine } from "../gameEngine";

// see: docs/archive/systems-session.md#portes-et-fin-de-niveau
export function unlockDoor(session: GameSession, targetName: string, successMessage: string): boolean {
  if (session.doorSystem?.isLocked(targetName)) {
    showHudMessage("Verrouillée par la sécurité du magasin");
    playDoorSfx("locked");
    return false;
  }
  const opened = session.doorSystem?.open(targetName, session.player.position) ?? false;
  if (!opened) {
    console.error(`[main] use_* référence une porte introuvable ("${targetName}").`);
    return false;
  }
  session.unlockedDoors.add(targetName);
  showHudMessage(successMessage);
  playDoorSfx("unlock");
  return true;
}

// see: docs/archive/systems-session.md#cartes-de-fidélité
// see: docs/6-reference/notes-code-gameplay.md#progression-et-fin
export function estPorteDeSortie(doorName: string): boolean {
  return doorName === "door_e_exit" || doorName === "door_exit";
}

export function tryOpenCardDoor(session: GameSession, targetName: string, required: LoyaltyCard): boolean {
  if (session.unlockedDoors.has(targetName)) return false; // déjà déverrouillée
  if (!hasCard(session, required)) {
    showHudMessage(`${LOYALTY_CARD_LABELS[required]} requise`);
    playDoorSfx("locked");
    return false;
  }
  const ouverte = unlockDoor(session, targetName, "Porte déverrouillée");
  if (ouverte && estPorteDeSortie(targetName)) setupExitDoorTracking(session, targetName);
  return ouverte;
}

export function setupExitDoorTracking(session: GameSession, doorName: string): void {
  const door = (session.gltfLevelSession?.current?.doors ?? []).find((d) => d.name === doorName);
  if (!door) return; // défensif : `unlockDoor` a déjà loggé une erreur si absent, rien à ajouter ici.

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

export function triggerLevelComplete(engine: GameEngine, session: GameSession): void {
  if (session.levelCompleteHandled) return;
  session.levelCompleteHandled = true;
  noteRunOutcome(false);
  // see: docs/archive/systems-session.md#récapitulatif-de-fin-de-partie
  publishLevelRecap(session, true);
  engine.flow.levelCompleted();
}
