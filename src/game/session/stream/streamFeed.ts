import { useGameStore } from "../../hud/state";
import type { DonationAlert } from "../../hud/hudTypes";
import { chatEnabled } from "../../settings/audioSettings";
import type { GameSession } from "../gameSession";
import { triggerHeroLine } from "../player/feedback";
import { mysteryDonation, notifyStream, updateStream, type StreamEventKind, type StreamState } from "./streamSim";
import type { MysteryBeat } from "./streamTexts";

// see: docs/decisions/0038-simulation-du-direct.md

const DONATION_DISPLAY_MS = 5000;
/** Un don de cette taille arrache une réaction au héros, une fois. */
const BIG_DONATION = 50;
/** Au repos, l'audience affichée ne se rafraîchit pas plus d'une fois par seconde. */
const IDLE_PUBLISH_INTERVAL = 1;

let lastIdlePublishAt = 0;

/** Où en est l'histoire : chaque étape déclenche un don du donateur mystère, une seule fois. */
const MYSTERY_BEATS: readonly { readonly beat: MysteryBeat; readonly reached: (session: GameSession) => boolean }[] = [
  { beat: "depart", reached: (session) => session.stats.gameplayElapsed >= 12 },
  { beat: "carte_argent", reached: (session) => session.cards.has("argent") },
  { beat: "quai", reached: (session) => session.heroLinesSaid.has("quai") },
  { beat: "carte_or", reached: (session) => session.cards.has("or") },
  { beat: "escalier", reached: (session) => session.placeLine.space === "c_escalier" },
];

function publishCounters(stream: StreamState): void {
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
  publishChat(session.stream);
  triggerHeroLine(session, donation.amount >= BIG_DONATION ? "don_gros" : "don_premier");
}

/** Le jeu signale un évènement notable au direct. Appelé dans le pas fixe. */
export function streamEvent(session: GameSession, kind: StreamEventKind): void {
  const donation = notifyStream(session.stream, kind, session.stats.gameplayElapsed, session.streamRandom);
  publishCounters(session.stream);
  if (donation) showDonation(session, donation);
}

/** Un pas fixe du direct : ennui, chat, et dons du donateur mystère. */
export function updateStreamFeed(session: GameSession, dt: number): void {
  const now = session.stats.gameplayElapsed;
  const stream = session.stream;

  for (const { beat, reached } of MYSTERY_BEATS) {
    if (stream.mysteryDone.has(beat) || !reached(session)) continue;
    const donation = mysteryDonation(stream, beat, now);
    if (donation) {
      publishCounters(stream);
      showDonation(session, donation);
    }
  }

  if (updateStream(stream, dt, now, session.streamRandom)) publishChat(stream);
  if (Math.abs(now - lastIdlePublishAt) >= IDLE_PUBLISH_INTERVAL) {
    lastIdlePublishAt = now;
    publishCounters(stream);
  }
}
