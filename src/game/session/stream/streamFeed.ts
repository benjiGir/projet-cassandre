import { useGameStore } from "../../hud/state";
import type { DonationAlert } from "../../hud/hudTypes";
import { chatEnabled } from "../../settings/audioSettings";
import type { GameSession } from "../gameSession";
import { triggerHeroLine } from "../player/feedback";
import { ridingFreightTrain, trainPassingPlatform } from "../player/metroMoments";
import { mysteryDonation, notifyStream, updateStream, type StreamEventKind, type StreamState } from "./streamSim";
import type { MysteryBeat } from "./streamTexts";

// see: docs/decisions/0038-simulation-du-direct.md

const DONATION_DISPLAY_MS = 5000;
/** Un don de cette taille arrache une réaction au héros, une fois. */
const BIG_DONATION = 50;
/** Au repos, l'audience affichée ne se rafraîchit pas plus d'une fois par seconde. */
const IDLE_PUBLISH_INTERVAL = 1;

let lastIdlePublishAt = 0;

interface MysteryStep {
  readonly beat: MysteryBeat;
  readonly reached: (session: GameSession) => boolean;
}

/** Où en est l'histoire : chaque étape déclenche un don du donateur mystère, une seule fois. */
const MYSTERY_BEATS: readonly MysteryStep[] = [
  { beat: "depart", reached: (session) => session.run.stats.gameplayElapsed >= 12 },
  { beat: "carte_argent", reached: (session) => session.run.cards.has("argent") },
  { beat: "quai", reached: (session) => session.run.heroLinesSaid.has("quai") },
  { beat: "carte_or", reached: (session) => session.run.cards.has("or") },
  { beat: "escalier", reached: (session) => session.run.placeLine.space === "c_escalier" },
];

// see: docs/2-fonctionnel/histoire-metro.md#le-premier-abonné-à-visage-découvert
// Aucune étape ne dépend d'une réplique dite : couper les sous-titres ne doit pas changer le portefeuille.
const METRO_MYSTERY_BEATS: readonly MysteryStep[] = [
  { beat: "metro_depart", reached: (session) => session.run.stats.gameplayElapsed >= 12 },
  // En sommeil tant que le niveau ne pose aucun badge.
  { beat: "metro_badge", reached: (session) => session.run.cards.size > 0 },
  { beat: "metro_passage", reached: trainPassingPlatform },
  { beat: "metro_fret", reached: (session) => session.run.placeLine.space === "fret" },
  { beat: "metro_bord", reached: ridingFreightTrain },
];

function mysterySteps(session: GameSession): readonly MysteryStep[] {
  if (session.choice.mysteryDonations === false) return [];
  return session.choice.textes === "metro" ? METRO_MYSTERY_BEATS : MYSTERY_BEATS;
}

/** Recopie audience, abonnés et solde dans le store — seulement s'ils ont changé. */
export function publishCounters(stream: StreamState): void {
  const store = useGameStore.getState();
  const views = Math.round(stream.viewers);
  const { debug } = store;
  if (debug.views === views && debug.followers === stream.followers && debug.wallet === stream.wallet) return;
  store.setDebug({ views, followers: stream.followers, wallet: stream.wallet });
}

function publishChat(stream: StreamState): void {
  useGameStore.getState().setChat(chatEnabled() ? stream.chat : []);
}

function showDonation(session: GameSession, donation: DonationAlert): void {
  useGameStore.getState().showDonation(donation);
  globalThis.setTimeout(() => {
    if (useGameStore.getState().donation === donation) useGameStore.getState().showDonation(null);
  }, DONATION_DISPLAY_MS);
  publishChat(session.run.stream);
  // Le héros prend le compte vérifié pour un allié : il le dit une fois, avant toute autre réaction.
  if (donation.verified && triggerHeroLine(session, "metro_don_verifie")) return;
  triggerHeroLine(session, donation.amount >= BIG_DONATION ? "don_gros" : "don_premier");
}

/** Le jeu signale un évènement notable au direct. Appelé dans le pas fixe. */
export function streamEvent(session: GameSession, kind: StreamEventKind): void {
  const donation = notifyStream(session.run.stream, kind, session.run.stats.gameplayElapsed, session.run.streamRandom);
  publishCounters(session.run.stream);
  if (donation) showDonation(session, donation);
}

/** Un pas fixe du direct : ennui, chat, et dons du donateur mystère. */
export function updateStreamFeed(session: GameSession, dt: number): void {
  const now = session.run.stats.gameplayElapsed;
  const stream = session.run.stream;

  for (const { beat, reached } of mysterySteps(session)) {
    if (stream.mysteryDone.has(beat) || !reached(session)) continue;
    const donation = mysteryDonation(stream, beat, now);
    if (donation) {
      publishCounters(stream);
      showDonation(session, donation);
    }
  }

  if (updateStream(stream, dt, now, session.run.streamRandom)) publishChat(stream);
  if (Math.abs(now - lastIdlePublishAt) >= IDLE_PUBLISH_INTERVAL) {
    lastIdlePublishAt = now;
    publishCounters(stream);
  }
}
