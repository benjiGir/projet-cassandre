import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { playSfx } from "../../../core/audio/audio";
import { runGameplaySync } from "../../../app/runtime/gameRuntime";
import { RaycastService } from "../../../physics/raycast";
import { GROUP, interactionGroups } from "../../../physics/world";
import { useGameStore } from "../../hud/state";
import { showHudMessage, triggerHeroLine } from "./feedback";
import type { GameSession } from "../gameSession";
import { streamEvent } from "../stream/streamFeed";

// see: docs/6-reference/notes-code-gameplay.md#progression-et-fin

export const SANITAIRE_AIM_RANGE_METERS = 1.4;

const SANITAIRE_AIM_RAY_GROUPS = interactionGroups(GROUP.PLAYER, GROUP.WORLD);

const aimEyeOriginScratch = new THREE.Vector3();
const aimEulerScratch = new THREE.Euler(0, 0, 0, "YXZ"); // même convention que la caméra/les armes (weapons.ts::computeAimBasis)
const aimQuatScratch = new THREE.Quaternion();
const aimDirectionScratch = new THREE.Vector3();
const aimRayScratch = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });

/** Fraction de `playerMaxHp` rendue par un soulagement (Duke : max/10 PV — +10 sur 100). */
const SANITAIRE_RELIEF_HEAL_FRACTION = 0.1;

export const SANITAIRE_RELIEF_COOLDOWN_SECONDS = 220;

/** PV rendus par une gorgée au jet d'eau d'un sanitaire cassé — illimité, contrairement au soulagement. */
const SANITAIRE_SIP_HEAL = 1;

/** Message HUD (canal SYSTÈME, sans cooldown) pendant le délai — court, drôle, facultatif au sens du contrat. */
const HUD_SANITAIRE_ON_COOLDOWN = "Rien ne vient.";
/** Message HUD à PV pleins — partagé par le soulagement et la gorgée. */
const HUD_SANITAIRE_FULL_HP = "Vous êtes déjà en pleine forme.";

export function relieveAtSanitaire(session: GameSession): void {
  // La chasse d'eau part dans TOUS les cas — soin ou pas, contrat Duke.
  playSfx("sanitaire_use");

  if (session.sanitaireReliefCooldown > 0) {
    showHudMessage(HUD_SANITAIRE_ON_COOLDOWN);
    triggerHeroLine(session, "toilettes_delai");
    return;
  }

  const maxHp = session.playerMaxHp;
  if (session.playerHp >= maxHp) {
    // Délai NON consommé : écart volontaire à Duke, voir la doc de tête.
    showHudMessage(HUD_SANITAIRE_FULL_HP);
    return;
  }

  const healed =
    Math.min(maxHp, session.playerHp + Math.round(maxHp * SANITAIRE_RELIEF_HEAL_FRACTION)) - session.playerHp;
  session.playerHp += healed;
  session.heroPortrait.heal(session.playerHp, maxHp);
  useGameStore.getState().setPlayerHp(session.playerHp);
  session.sanitaireReliefCooldown = SANITAIRE_RELIEF_COOLDOWN_SECONDS;
  showHudMessage(`+${healed} PV`);
  triggerHeroLine(session, "toilettes_soulagement");
  streamEvent(session, "toilettes");
}

/** Gorgée au jet d'eau permanent d'un sanitaire CASSÉ — voir la doc de tête du fichier. */
function drinkFromSanitaire(session: GameSession): void {
  const maxHp = session.playerMaxHp;
  if (session.playerHp >= maxHp) {
    // Pas de son de gorgée à PV pleins — il n'y a rien à boire "pour rien",
    // contrairement à la chasse d'eau du soulagement qui part toujours.
    showHudMessage(HUD_SANITAIRE_FULL_HP);
    return;
  }

  session.playerHp = Math.min(maxHp, session.playerHp + SANITAIRE_SIP_HEAL);
  session.heroPortrait.heal(session.playerHp, maxHp);
  useGameStore.getState().setPlayerHp(session.playerHp);
  playSfx("water_drink");
  showHudMessage(`+${SANITAIRE_SIP_HEAL} PV`);
  triggerHeroLine(session, "boire_fuite");
}

export function trySanitaire(
  session: GameSession,
  usePressed: boolean,
  playerPosition: THREE.Vector3,
  eyeOffset: number,
  yaw: number,
  pitch: number,
): boolean {
  if (!usePressed) return false;
  const system = session.sanitaireSystem;
  if (!system) return false;

  aimEyeOriginScratch.set(playerPosition.x, playerPosition.y + eyeOffset, playerPosition.z);
  aimEulerScratch.set(pitch, yaw, 0);
  aimQuatScratch.setFromEuler(aimEulerScratch);
  aimDirectionScratch.set(0, 0, -1).applyQuaternion(aimQuatScratch);

  aimRayScratch.origin.x = aimEyeOriginScratch.x;
  aimRayScratch.origin.y = aimEyeOriginScratch.y;
  aimRayScratch.origin.z = aimEyeOriginScratch.z;
  aimRayScratch.dir.x = aimDirectionScratch.x;
  aimRayScratch.dir.y = aimDirectionScratch.y;
  aimRayScratch.dir.z = aimDirectionScratch.z;

  const hit = runGameplaySync(
    RaycastService.use((raycast) =>
      raycast.castRay(
        session.physics,
        aimRayScratch,
        SANITAIRE_AIM_RANGE_METERS,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        SANITAIRE_AIM_RAY_GROUPS,
      ),
    ),
  );

  const aimed = system.resolveAim(
    aimEyeOriginScratch,
    aimDirectionScratch,
    SANITAIRE_AIM_RANGE_METERS,
    hit ? { colliderHandle: hit.collider.handle, distance: hit.timeOfImpact } : null,
  );
  if (!aimed) return false;

  if (aimed.broken) drinkFromSanitaire(session);
  else relieveAtSanitaire(session);
  return true;
}
