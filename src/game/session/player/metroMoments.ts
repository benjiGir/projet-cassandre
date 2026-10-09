import type { GameSession } from "../gameSession";
import { triggerHeroLine } from "./feedback";

// see: docs/2-fonctionnel/histoire-metro.md#les-moments-en-jeu

/** Voies publiques de la station : celles qu'on voit passer depuis les quais. */
const VOIES_DES_QUAIS = ["A", "B"];
/** Secondes de voyage avant le remerciement du compte vérifié : entre les deux vagues. */
const REMERCIEMENT_A_BORD = 20;

/** Le premier passage : une rame défile à la hauteur du joueur pendant qu'il est sur les quais. */
export function trainPassingPlatform(session: GameSession): boolean {
  if (session.placeLine.space !== "quais") return false;
  const trains = session.gltfLevelSession?.current?.trains;
  if (!trains?.active) return false;
  return VOIES_DES_QUAIS.some(
    (voie) =>
      trains.data.lanes.some((lane) => lane.id === voie) &&
      trains.system.status(voie, session.player.position).countdown <= 0,
  );
}

/** Le joueur est à bord de la rame de fret, en route depuis assez longtemps pour qu'on le remercie. */
export function ridingFreightTrain(session: GameSession): boolean {
  const voyage = session.gltfLevelSession?.current?.metroBlockout?.system.state;
  if (!voyage || voyage.phase === "boarding" || voyage.phase === "closing" || voyage.phase === "arrived") return false;
  return voyage.elapsed >= REMERCIEMENT_A_BORD;
}

/** Moments du métro qui tiennent à l'état des rames : ni un `trig_*` ni le script de niveau ne les voient. */
export function updateMetroMoments(session: GameSession): void {
  if (session.choice.textes !== "metro" || session.heroLinesSaid.has("metro_premier_passage")) return;
  if (trainPassingPlatform(session)) triggerHeroLine(session, "metro_premier_passage");
}
