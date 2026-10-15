import { moveConfig } from "../../player/movement/moveConfig";
import { recordSafeGround, shouldRescue } from "../../session/player/fallRescue";
import { sayOpeningLine, showHudMessage, triggerHeroBark } from "../../session/player/feedback";
import { updateKillRush } from "../../session/progression/perks";
import type { GameplayStep } from "./gameplayStep";

/** Vitesse de chute (m/s) au-delà de laquelle une réception arrache un « Ouf ! » — plus qu'un saut sur place. */
const LANDING_BARK_SPEED = 10;

// Décide le mouvement AVANT le step physique (latence nulle) : la translation
// cible est consommée par `world.step()` du même pas fixe.
// see: docs/archive/systems-boucle-de-jeu.md#ordre-des-callbacks
export function movePlayer({ session, dt, frame }: GameplayStep): void {
  sayOpeningLine(session);
  const enLAir = !session.player.isGrounded;
  const fallSpeed = -session.player.velocity.y;
  updateKillRush(session, dt);
  session.player.update(dt, frame);
  if (enLAir && session.player.isGrounded && fallSpeed >= LANDING_BARK_SPEED)
    triggerHeroBark(session, "effort_reception");
}

// Filet de chute (`session/player/fallRescue.ts`) : le dernier sol RÉELLEMENT
// touché sert de point de retour.
export function rescueFromFall({ session }: GameplayStep): void {
  const player = session.player;
  if (recordSafeGround(session.run.lastSafeGround, player.position, player.isGrounded, player.numCollisions)) return;
  if (!shouldRescue(session.run.lastSafeGround, player.position, player.isGrounded)) return;
  console.warn(
    `[niveau] chute hors du monde en x=${player.position.x.toFixed(1)}, z=${player.position.z.toFixed(1)} — ` +
      `retour au dernier sol touché. Trou de décor à corriger (tools/level_v2/audit_niveau.py).`,
  );
  // `spawn` prend la position des PIEDS, `lastSafeGround` le centre de
  // la capsule : la moitié de la capsule les sépare.
  const demiCapsule = moveConfig.capsuleHalfHeight + moveConfig.capsuleRadius;
  player.spawn(session.run.lastSafeGround.x, session.run.lastSafeGround.y - demiCapsule, session.run.lastSafeGround.z);
  showHudMessage("Sol manquant — vous êtes remis sur pied");
}
