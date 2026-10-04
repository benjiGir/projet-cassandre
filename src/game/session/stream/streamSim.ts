import type { ChatMessage, DonationAlert, LiveRecap } from "../../hud/hudTypes";
import {
  CHAT_LINES,
  DONATION_LINES,
  MYSTERY_TEXTS,
  MYSTERY_DONOR,
  PSEUDOS,
  type ChatTopic,
  type DonationTopic,
  type MysteryBeat,
} from "./streamTexts";

// see: docs/decisions/0038-simulation-du-direct.md

/** Ce que le joueur vient de faire et que le direct remarque. */
export type StreamEventKind = "kill" | "boss" | "secret" | "casse" | "degats" | "toilettes" | "carte" | "moment";

/** Graine du flux RNG du direct : spectateurs, dons et chat, jamais les armes ni les ennemis. */
export const STREAM_SEED = 0x71e75;

// Un barème, donc réglable : `devtools/economy/economyVariants.ts` y pose ses variantes.
interface EventRule {
  /** Multiplicateur du gain de spectateurs. */
  audience: number;
  /** Probabilité qu'un spectateur donne. */
  donation: number;
  /** Montants possibles, en euros. */
  amounts: readonly number[];
}

// Les probabilités de don et les montants du donateur mystère sont ceux de la
// variante B du lot B7 (`devtools/economy/economyVariants.ts`), relevés par
// `pnpm economy`. Le reste (audience, chat) attend encore un playtest.
export const streamConfig = {
  startViewers: 12,
  startFollowers: 200,
  /** Gain de spectateurs d'un évènement de poids 1, tiré entre ces bornes. */
  viewerGain: [40, 200] as readonly [number, number],
  /** Un abonné de plus tous les N spectateurs gagnés. */
  viewersPerFollower: 40,
  /** Secondes sans rien de notable avant que l'audience commence à partir. */
  idleGrace: 20,
  /** Part de l'audience perdue par seconde une fois l'ennui installé. */
  idleLossPerSecond: 0.015,
  /** L'audience ne retombe jamais sous cette part de son pic. */
  floorOfPeak: 0.4,
  /** Kills rapprochés qui font une série, et la fenêtre qui les réunit. */
  streakKills: 3,
  streakWindow: 6,
  /** Écart minimal entre deux dons de spectateurs ordinaires. */
  donationCooldown: 8,
  /** Intervalle entre deux messages du chat, tiré entre ces bornes. */
  chatInterval: [2, 4] as readonly [number, number],
  /** Durée pendant laquelle le chat commente encore le dernier évènement. */
  chatMemory: 8,
  chatLines: 5,
  /** Part des messages qui se plaignent de l'ennui quand il ne se passe rien. */
  idleChatShare: 0.4,
  /** Un bond d'audience de cette taille fait arriver les touristes. */
  touristJump: 400,
  rules: {
    kill: { audience: 1, donation: 0.168, amounts: [1, 2, 2, 5] },
    serie: { audience: 2, donation: 0.7, amounts: [5, 5, 10] },
    boss: { audience: 4, donation: 1, amounts: [20, 50] },
    secret: { audience: 1.5, donation: 0.84, amounts: [5, 10] },
    casse: { audience: 0.25, donation: 0.07, amounts: [1, 2] },
    degats: { audience: 0.3, donation: 0.056, amounts: [1] },
    toilettes: { audience: 0.5, donation: 0.7, amounts: [1, 2] },
    carte: { audience: 1.5, donation: 0.56, amounts: [5, 10] },
    moment: { audience: 1, donation: 0, amounts: [] },
  } satisfies Record<StreamEventKind | "serie", EventRule> as Record<StreamEventKind | "serie", EventRule>,
  /** Dons du donateur mystère, en euros : ils grossissent au fil de l'histoire, et ne dépendent ni du hasard ni de la difficulté. */
  mystery: { depart: 10, carte_argent: 10, quai: 15, carte_or: 20, escalier: 45 } as Record<MysteryBeat, number>,
};

export interface StreamState {
  viewers: number;
  peakViewers: number;
  followers: number;
  /** Solde dépensable aux bornes, en euros. */
  wallet: number;
  /** Total des dons reçus, achats non déduits : c'est lui que rend le bilan. */
  donated: number;
  donationCount: number;
  /** Spectateurs gagnés depuis le début : c'est eux qui font les abonnés. */
  gained: number;
  lastEventAt: number;
  lastTopic: ChatTopic | null;
  /** Audience au dernier message du chat, pour repérer un bond. */
  viewersAtLastChat: number;
  killTimes: number[];
  lastDonationAt: number;
  nextChatAt: number;
  chat: ChatMessage[];
  chatSerial: number;
  mysteryDone: Set<MysteryBeat>;
  /** Multiplicateur de la probabilité de don des spectateurs, posé par la difficulté de la partie. */
  generosity: number;
  /** Temps de jeu du dernier pas ou du dernier évènement : il date les lignes du journal. */
  clock: number;
  /** Journal du portefeuille de CETTE partie : chaque don et chaque achat, pour le relevé (`cassandre.economie.journal()`). */
  ledger: LedgerEntry[];
}

export interface LedgerEntry {
  /** Secondes de jeu. */
  readonly at: number;
  /** Euros : positif pour un don, négatif pour un achat. */
  readonly amount: number;
  readonly source: "don" | "mystere" | "achat";
  /** Solde après l'opération. */
  readonly wallet: number;
}

export function createStreamState(generosity = 1): StreamState {
  return {
    viewers: streamConfig.startViewers,
    peakViewers: streamConfig.startViewers,
    followers: streamConfig.startFollowers,
    wallet: 0,
    donated: 0,
    donationCount: 0,
    gained: 0,
    lastEventAt: 0,
    lastTopic: null,
    viewersAtLastChat: streamConfig.startViewers,
    killTimes: [],
    lastDonationAt: -Infinity,
    nextChatAt: streamConfig.chatInterval[1],
    chat: [],
    chatSerial: 0,
    mysteryDone: new Set(),
    generosity,
    clock: 0,
    ledger: [],
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
}

function pushChat(state: StreamState, message: Omit<ChatMessage, "id">): ChatMessage {
  const entry = { id: ++state.chatSerial, ...message };
  state.chat = [...state.chat, entry].slice(-streamConfig.chatLines);
  return entry;
}

function donate(state: StreamState, now: number, alert: DonationAlert): DonationAlert {
  state.wallet += alert.amount;
  state.donated += alert.amount;
  state.donationCount++;
  state.lastDonationAt = now;
  state.ledger.push({ at: now, amount: alert.amount, source: alert.mystery ? "mystere" : "don", wallet: state.wallet });
  pushChat(state, { pseudo: alert.pseudo, text: `a donné ${alert.amount} €`, kind: "don" });
  return alert;
}

function donationTopic(kind: StreamEventKind | "serie"): DonationTopic {
  return kind === "degats" || kind === "moment" ? "generique" : kind;
}

/**
 * Un évènement notable du jeu : l'audience monte, le chat a de quoi parler,
 * et un spectateur donne parfois. Rend le don à afficher, ou `null`.
 */
export function notifyStream(
  state: StreamState,
  kind: StreamEventKind,
  now: number,
  random: () => number,
): DonationAlert | null {
  state.clock = now;
  let effective: StreamEventKind | "serie" = kind;
  if (kind === "kill") {
    state.killTimes = state.killTimes.filter((t) => now - t <= streamConfig.streakWindow);
    state.killTimes.push(now);
    if (state.killTimes.length >= streamConfig.streakKills) {
      effective = "serie";
      state.killTimes = [];
    }
  }

  const rule = streamConfig.rules[effective];
  const [min, max] = streamConfig.viewerGain;
  const gain = Math.round((min + random() * (max - min)) * rule.audience);
  state.viewers += gain;
  state.gained += gain;
  state.peakViewers = Math.max(state.peakViewers, state.viewers);
  state.followers = streamConfig.startFollowers + Math.floor(state.gained / streamConfig.viewersPerFollower);
  state.lastEventAt = now;
  state.lastTopic = effective;

  if (rule.amounts.length === 0 || now - state.lastDonationAt < streamConfig.donationCooldown) return null;
  if (random() >= rule.donation * state.generosity) return null;
  const topic = donationTopic(effective);
  const lines = random() < 0.5 ? DONATION_LINES[topic] : DONATION_LINES.generique;
  return donate(state, now, {
    pseudo: pick(PSEUDOS, random),
    amount: pick(rule.amounts, random),
    text: pick(lines, random),
    mystery: false,
  });
}

/** Débite le portefeuille si le solde suffit ; sinon rend `false` sans rien toucher. */
export function spend(state: StreamState, amount: number): boolean {
  if (amount > state.wallet) return false;
  state.wallet -= amount;
  state.ledger.push({ at: state.clock, amount: -amount, source: "achat", wallet: state.wallet });
  return true;
}

/** Bilan du direct, pour l'écran de fin. */
export function streamRecap(state: StreamState): LiveRecap {
  return {
    peakViewers: Math.round(state.peakViewers),
    followers: state.followers,
    followersGained: state.followers - streamConfig.startFollowers,
    donations: state.donated,
    donationCount: state.donationCount,
  };
}

/** Le donateur mystère : un don fixé par l'histoire, une seule fois par étape. */
export function mysteryDonation(state: StreamState, beat: MysteryBeat, now: number): DonationAlert | null {
  if (state.mysteryDone.has(beat)) return null;
  state.mysteryDone.add(beat);
  return donate(state, now, {
    pseudo: MYSTERY_DONOR,
    amount: streamConfig.mystery[beat],
    text: MYSTERY_TEXTS[beat],
    mystery: true,
  });
}

/**
 * Un pas fixe du direct : l'ennui fait partir l'audience, et le chat écrit à
 * son rythme. Rend `true` si le chat a un nouveau message.
 */
export function updateStream(state: StreamState, dt: number, now: number, random: () => number): boolean {
  state.clock = now;
  if (now - state.lastEventAt > streamConfig.idleGrace) {
    const floor = Math.max(streamConfig.startViewers, state.peakViewers * streamConfig.floorOfPeak);
    state.viewers = Math.max(floor, state.viewers * (1 - streamConfig.idleLossPerSecond * dt));
  }

  if (now < state.nextChatAt) return false;
  const [min, max] = streamConfig.chatInterval;
  state.nextChatAt = now + min + random() * (max - min);

  let topic: ChatTopic;
  if (state.viewers - state.viewersAtLastChat >= streamConfig.touristJump) topic = "touristes";
  else if (state.lastTopic !== null && now - state.lastEventAt <= streamConfig.chatMemory) topic = state.lastTopic;
  // L'ennui ne monopolise pas le chat : une exploration calme reste un direct, pas un reproche continu.
  else if (now - state.lastEventAt > streamConfig.idleGrace && random() < streamConfig.idleChatShare) topic = "calme";
  else topic = "ambiance";
  state.viewersAtLastChat = state.viewers;

  // Pas deux fois le même texte à l'écran : on retire jusqu'à trouver une ligne absente du chat.
  let line = pick(CHAT_LINES[topic], random);
  for (let attempt = 0; attempt < 3 && state.chat.some((m) => m.text === (typeof line === "string" ? line : line.text)); attempt++) {
    line = pick(CHAT_LINES[topic], random);
  }
  const pseudo = typeof line === "string" ? pick(PSEUDOS, random) : line.pseudo;
  pushChat(state, { pseudo, text: typeof line === "string" ? line : line.text, kind: "message" });
  return true;
}
