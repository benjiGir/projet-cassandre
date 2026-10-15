import type { GameSession } from "../gameSession";
import { triggerHeroLine } from "./feedback";

// see: docs/2-fonctionnel/histoire-metro.md#les-moments-en-jeu

/** Voies publiques de la station : celles qu'on voit passer depuis les quais. */
const PLATFORM_LANES = ["A", "B"];
/** Secondes de voyage avant le remerciement du compte vérifié : entre les deux vagues. */
const ONBOARD_THANKS_SECONDS = 20;

/** Le premier passage : une rame défile à la hauteur du joueur pendant qu'il est sur les quais. */
export function trainPassingPlatform(session: GameSession): boolean {
  if (session.run.placeLine.space !== "quais") return false;
  const trains = session.gltfLevelSession?.current?.trains;
  if (!trains?.active) return false;
  return PLATFORM_LANES.some(
    (voie) =>
      trains.data.lanes.some((lane) => lane.id === voie) &&
      trains.system.status(voie, session.player.position).countdown <= 0,
  );
}

/** Le joueur est à bord de la rame de fret, en route depuis assez longtemps pour qu'on le remercie. */
export function ridingFreightTrain(session: GameSession): boolean {
  const ride = session.gltfLevelSession?.current?.metroBlockout?.system.state;
  if (!ride || ride.phase === "boarding" || ride.phase === "closing" || ride.phase === "arrived") return false;
  return ride.elapsed >= ONBOARD_THANKS_SECONDS;
}

/** Moments du métro qui tiennent à l'état des rames : ni un `trig_*` ni le script de niveau ne les voient. */
export function updateMetroMoments(session: GameSession): void {
  if (session.choice.textes !== "metro" || session.run.heroLinesSaid.has("metro_premier_passage")) return;
  if (trainPassingPlatform(session)) triggerHeroLine(session, "metro_premier_passage");
}
