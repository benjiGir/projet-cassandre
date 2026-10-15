import type * as THREE from "three";

import type { BlastConfig } from "../../level/props/propConfig";
import { weaponConfig } from "../../player/weapons/weaponConfig";
import { applyBlast } from "../../session/player/explosions";
import { triggerHeroLine } from "../../session/player/feedback";
import { PROP_BREAK_LINES } from "../../session/presentation/heroLines";
import {
  recordDirectorKills,
  recordPropsDestroyed,
  recordSanitairesDestroyed,
  recordSuitKills,
  recordVitresDestroyed,
} from "../../session/progression/score";
import { streamEvent } from "../../session/stream/streamFeed";
import { recordDirectorKillFeedback, recordKillFeedback } from "./combatSteps";
import type { GameplayStep } from "./gameplayStep";

/** Le souffle sur les vivants, et ce qu'il rapporte au score et au direct. */
function blastLiving({ engine, session }: GameplayStep, center: THREE.Vector3, blast?: BlastConfig): void {
  const outcome = applyBlast(engine, session, center, blast);
  recordSuitKills(session.run.stats, outcome.suitKills);
  recordKillFeedback(session, outcome.suitKills);
  recordDirectorKills(session.run.stats, outcome.directorKills);
  recordDirectorKillFeedback(session, outcome.directorKills);
  if (outcome.playerDamage > 0) streamEvent(session, "degats");
}

/** Tout ce qui casse sous les tirs du pas : mobilier et explosifs, vitrages, sanitaires, écrans. */
export function updateBreakables(step: GameplayStep): void {
  const { session, dt } = step;
  const propsDestroyedBefore = session.level.propSystem?.destroyedEvents.length ?? 0;
  session.level.propSystem?.update(session.weapons.hitEvents);
  // Explosifs (`matiere: gaz`) : les props se sont déjà poussés et
  // amorcés entre eux, reste le souffle sur le joueur et les ennemis.
  for (const explosion of session.level.propSystem?.takeNewExplosions() ?? []) blastLiving(step, explosion.point);
  // Fusées du pistolet de détresse : même souffle en plus court, et une
  // bonbonne qu'il atteint s'amorce comme sous celui d'une autre bonbonne.
  for (const detonation of session.weapons.takeNewFlareDetonations()) {
    session.level.propSystem?.applyBlast(detonation.point, weaponConfig.flareBlast);
    blastLiving(step, detonation.point, weaponConfig.flareBlast);
  }
  const propsDestroyed = session.level.propSystem?.destroyedEvents.slice(propsDestroyedBefore) ?? [];
  recordPropsDestroyed(session.run.stats, propsDestroyed.length);
  const breakLine = propsDestroyed.map((e) => PROP_BREAK_LINES[e.matiere]).find((l) => l !== undefined);
  if (breakLine) triggerHeroLine(session, breakLine);
  let casse = propsDestroyed.length > 0;
  if (
    !session.run.heroLinesSaid.has("objet_pousse") &&
    session.level.propSystem?.isPushedNear(session.player.position)
  ) {
    triggerHeroLine(session, "objet_pousse");
  }

  // Vitrages : même file, mêmes deux raisons (déterminisme du rejeu,
  // pas fixe strict) que le mobilier physique juste au-dessus.
  const vitresDestroyedBefore = session.level.vitreSystem?.destroyedEvents.length ?? 0;
  session.level.vitreSystem?.update(session.weapons.hitEvents);
  const vitresDestroyed = (session.level.vitreSystem?.destroyedEvents.length ?? 0) - vitresDestroyedBefore;
  recordVitresDestroyed(session.run.stats, vitresDestroyed);
  if (vitresDestroyed > 0) triggerHeroLine(session, "casse_vitre");
  casse ||= vitresDestroyed > 0;

  // Sanitaires : même file, même contrat que les vitrages juste au-dessus.
  const sanitairesDestroyedBefore = session.level.sanitaireSystem?.destroyedEvents.length ?? 0;
  session.level.sanitaireSystem?.update(session.weapons.hitEvents);
  const sanitairesDestroyed = (session.level.sanitaireSystem?.destroyedEvents.length ?? 0) - sanitairesDestroyedBefore;
  recordSanitairesDestroyed(session.run.stats, sanitairesDestroyed);
  casse ||= sanitairesDestroyed > 0;

  // Écrans (`ecran_*`, chantier « Les coulisses ») : même file de
  // impacts, plus l'horloge d'animation propre à `EcranSystem.update`
  // (voir sa doc) — avancée au pas fixe, jamais un dt réel.
  const ecransDestroyedBefore = session.level.ecranSystem?.destroyedEvents.length ?? 0;
  session.level.ecranSystem?.update(dt, session.weapons.hitEvents);
  if ((session.level.ecranSystem?.destroyedEvents.length ?? 0) > ecransDestroyedBefore) {
    triggerHeroLine(session, "casse_ecran");
    casse = true;
  }
  // Une seule fois par pas fixe : une rafale qui casse trois objets reste un seul évènement.
  if (casse) streamEvent(session, "casse");
}
