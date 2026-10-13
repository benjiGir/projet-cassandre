import type { EnemyPlayerHitEvent } from "../../entities/shared/enemyManager";
import type { StepEvents } from "../../entities/shared/eventQueue";
import { FLESH_MATERIAL } from "../../player/weapons/weapons";
import type { GameSession } from "../../session/gameSession";
import { applyPlayerDamage, triggerHeroLine } from "../../session/player/feedback";
import { ALERT_LINES, ATTACK_LINES } from "../../session/presentation/heroLines";
import { startKillRush } from "../../session/progression/perks";
import { recordDirectorKills, recordShot, recordSuitKills, type SessionStats } from "../../session/progression/score";
import { streamEvent } from "../../session/stream/streamFeed";
import type { GameplayStep } from "./gameplayStep";

export function recordKillFeedback(session: GameSession, count: number): void {
  session.heroPortrait.kill(count);
  if (count > 0) startKillRush(session.run);
  for (let i = 0; i < count; i++) {
    streamEvent(session, "kill");
    if (session.run.firstKillTriggered) {
      // Le kill vient de l'arme en main : un tir et sa mort tombent dans le même pas fixe.
      const weapon = session.weapons.activeWeapon;
      triggerHeroLine(
        session,
        weapon === "shotgun" ? "kill_pompe" : weapon === "flare" ? "kill_fusee" : "kill_costard",
      );
      continue;
    }
    session.run.firstKillTriggered = true;
    triggerHeroLine(session, "premier_kill");
  }
}

/** Mort du Directeur : vues multipliées, et sa propre réplique plutôt que celle d'un Costard. */
export function recordDirectorKillFeedback(session: GameSession, count: number): void {
  session.heroPortrait.kill(count);
  for (let i = 0; i < count; i++) streamEvent(session, "boss");
  if (count > 0) triggerHeroLine(session, "boss_mort");
}

// L'origine des tirs est reconstruite depuis la position du joueur APRÈS son
// déplacement, jamais depuis la pose interpolée du rendu : le rejeu en dépend.
export function fireWeapons({ session, dt, frame, eyeOrigin }: GameplayStep): void {
  eyeOrigin.set(
    session.player.position.x,
    session.player.position.y + session.player.eyeOffset,
    session.player.position.z,
  );
  const fireCountBefore = session.weapons.fireEvents.length;
  const hitCountBefore = session.weapons.hitEvents.length;
  session.weapons.update(dt, frame, eyeOrigin, frame.yaw, frame.pitch);
  if (session.weapons.fireEvents.length > fireCountBefore) {
    session.heroPortrait.react("focus");
    let hitEnemy = false;
    for (let i = hitCountBefore; i < session.weapons.hitEvents.length; i++) {
      if (session.weapons.hitEvents[i].material === FLESH_MATERIAL) {
        hitEnemy = true;
        break;
      }
    }
    recordShot(session.run.stats, hitEnemy);
  }
}

/** Coups portés au joueur par les ennemis d'un gestionnaire pendant ce pas. */
function applyEnemyHits(
  { engine, session }: GameplayStep,
  playerHits: StepEvents<EnemyPlayerHitEvent>,
  source: NonNullable<SessionStats["lastDamageSource"]>,
): void {
  for (let i = 0; i < playerHits.stepCount; i++) {
    const hit = playerHits.stepAt(i);
    if (!hit) continue;
    applyPlayerDamage(engine, session, hit.amount, hit.normal, hit.push ? "controleur" : source);
    if (hit.push && session.run.playerHp > 0) {
      session.player.applyPush(hit.push.displacement, hit.push.duration);
      session.run.stats.controllerHits++;
      session.run.stats.controllerPushExpires = session.run.stats.gameplayElapsed + hit.push.duration + 0.3;
    }
  }
  if (playerHits.stepCount > 0) streamEvent(session, "degats");
}

// Après `fireWeapons` : les impacts d'un tir sont vus par les ennemis dans le même pas.
export function updateSuits(step: GameplayStep): void {
  const { session, dt, eyeOrigin } = step;
  const manager = session.suitManager;
  manager.update(
    dt,
    session.player.position,
    eyeOrigin,
    session.weapons.hitEvents,
    session.level.navGraph,
    session.level.vitreSystem ?? undefined,
    session.level.sanitaireSystem ?? undefined,
  );
  const kills = manager.deaths.stepCount;
  recordSuitKills(session.run.stats, kills);
  recordKillFeedback(session, kills);
  // La réplique suit l'espèce du premier ennemi qui vient d'agir.
  const shooter = manager.shots.stepAt(0)?.enemy;
  const watcher = manager.alerts.stepAt(0)?.enemy;
  if (shooter) triggerHeroLine(session, ATTACK_LINES[shooter.kind]);
  else if (watcher) triggerHeroLine(session, ALERT_LINES[watcher.kind]);
  // Premier tir arrêté par un bouclier : le héros dit quoi en faire.
  if (manager.blockedHits.size > 0) triggerHeroLine(session, "vigile_bouclier");
  applyEnemyHits(step, manager.playerHits, "suit");
}

export function updateDirectors(step: GameplayStep): void {
  const { session, dt, eyeOrigin } = step;
  const manager = session.directorManager;
  manager.update(
    dt,
    session.player.position,
    eyeOrigin,
    session.weapons.hitEvents,
    session.level.navGraph,
    session.level.vitreSystem ?? undefined,
    session.level.sanitaireSystem ?? undefined,
  );
  const kills = manager.deaths.stepCount;
  if (manager.alerts.stepCount > 0 || manager.reveals.stepCount > 0) session.heroPortrait.react("discover");
  recordDirectorKills(session.run.stats, kills);
  recordDirectorKillFeedback(session, kills);
  if (manager.reveals.stepCount > 0) triggerHeroLine(session, "boss_revelation");
  else if (manager.telegraphs.stepCount > 0) triggerHeroLine(session, "boss_attaque");
  applyEnemyHits(step, manager.playerHits, "director");
}
