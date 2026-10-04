import { PERKS, type Perk } from "../../player/perks";
import { difficultyConfig, wokenGroupSize, type Difficulty } from "../../session/progression/difficulty";
import {
  createStreamState,
  mysteryDonation,
  notifyStream,
  spend,
  updateStream,
  type StreamEventKind,
} from "../../session/stream/streamSim";
import type { MysteryBeat } from "../../session/stream/streamTexts";

// Relevé du portefeuille (lot B7 de PLAN_SUITE.md) : une partie type, décrite
// comme une suite d'étapes du niveau, rejouée à travers la VRAIE simulation
// du direct (`streamSim.ts`) — mêmes règles, mêmes tirages. Ce que le relevé
// mesure : combien le joueur a en poche devant chaque borne, et combien de
// perks il peut s'offrir. Ce qu'il ne mesure pas : si c'est amusant.

/** Une étape du parcours, dans l'ordre où le joueur la traverse. */
interface Stop {
  readonly id: string;
  /** Ennemis présents au chargement. */
  readonly kills: number;
  /** Groupes réveillés par le script, à leur taille la plus dure. */
  readonly groups?: readonly number[];
  /** Annonces des haut-parleurs ou de l'interphone (évènement `moment`). */
  readonly moments?: number;
  /** Détour : seuls certains profils y passent. */
  readonly detour?: boolean;
  readonly kiosk?: Perk;
  readonly beat?: MysteryBeat;
  /** Une carte de fidélité s'y ramasse. */
  readonly card?: boolean;
  /** Le Directeur y meurt. */
  readonly boss?: boolean;
  readonly secrets?: number;
  /** Étape facultative même sur le chemin (le quai de la réserve) : le profil dit s'il y va. */
  readonly optional?: boolean;
}

// Relevé du niveau v2 au 2026-10-04 (après le lot B6). Les six bornes sont sur
// le chemin obligé ; celle du couloir du personnel se retrouve au retour du parking.
export const PARCOURS: readonly Stop[] = [
  { id: "parking", kills: 2, beat: "depart" },
  { id: "galerie", kills: 3, kiosk: "perche" },
  { id: "cafeteria", kills: 2, detour: true, secrets: 2 },
  { id: "caisses", kills: 4, moments: 2, kiosk: "vpn" },
  { id: "hub", kills: 2 },
  { id: "rayons", kills: 6, card: true, beat: "carte_argent", secrets: 1 },
  { id: "electro", kills: 5, detour: true },
  { id: "labo", kills: 4, detour: true },
  { id: "hub_nord", kills: 0, kiosk: "aimant" },
  { id: "reserve_entree", kills: 2, kiosk: "premium" },
  { id: "reserve_arene", kills: 0, groups: [4, 4], moments: 3 },
  { id: "quai", kills: 0, beat: "quai", optional: true },
  { id: "personnel", kills: 0, kiosk: "boisson" },
  { id: "coulisses", kills: 5, detour: true, secrets: 1 },
  { id: "souterrain", kills: 2, groups: [2, 4], card: true, beat: "carte_or" },
  { id: "personnel_retour", kills: 0, groups: [1], moments: 1, kiosk: "boisson" },
  { id: "escalier", kills: 0, moments: 2, beat: "escalier" },
  { id: "bureaux", kills: 3, kiosk: "gilet" },
  { id: "direction", kills: 0, boss: true },
];

export interface PlayProfile {
  readonly label: string;
  /** Part des ennemis du chemin que le joueur tue. */
  readonly killShare: number;
  readonly detours: readonly string[];
  readonly secrets: number;
  /** Secondes entre deux kills d'un même combat, en moyenne. */
  readonly killInterval: number;
  /** Secondes de marche entre deux étapes. */
  readonly travel: number;
  /** Casses et coups reçus par étape de combat. */
  readonly breaks: number;
  readonly hits: number;
  readonly quai: boolean;
  readonly toilettes: boolean;
}

export const PROFILES = {
  presse: {
    label: "Pressé",
    killShare: 0.55, detours: [], secrets: 0, killInterval: 2.5, travel: 14, breaks: 0, hits: 2, quai: false, toilettes: false,
  },
  normal: {
    label: "Normal",
    killShare: 0.85, detours: ["cafeteria", "coulisses"], secrets: 1, killInterval: 3.5, travel: 20, breaks: 2, hits: 2,
    quai: true, toilettes: true,
  },
  completiste: {
    label: "Complétiste",
    killShare: 1, detours: ["cafeteria", "electro", "labo", "coulisses"], secrets: 4, killInterval: 4.5, travel: 28,
    breaks: 5, hits: 3, quai: true, toilettes: true,
  },
} as const satisfies Record<string, PlayProfile>;

export type ProfileId = keyof typeof PROFILES;

/** Prix d'une borne, par perk : ceux du niveau, ou ceux d'une variante à l'essai. */
export type PriceList = Readonly<Record<Perk, number>>;

/** Générateur déterministe local : le relevé ne touche à aucun flux du jeu. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface KioskReading {
  readonly stop: string;
  readonly perk: Perk;
  readonly price: number;
  /** Secondes de jeu à l'arrivée. */
  readonly at: number;
  /** Solde en arrivant devant la borne. */
  readonly wallet: number;
  readonly bought: boolean;
}

export interface RunReading {
  readonly seconds: number;
  /** Total des dons reçus, achats non déduits. */
  readonly donated: number;
  /** Part du donateur mystère dans ce total. */
  readonly mystery: number;
  /** Total reçu AVANT la dernière borne : ce qui tombe après (le Directeur) ne s'achète rien. */
  readonly spendable: number;
  /** Perks achetés par un joueur qui achète dès qu'il peut. */
  readonly bought: readonly Perk[];
  /** Le plus grand nombre de perks qu'un joueur économe pouvait s'offrir. */
  readonly best: number;
  readonly kiosks: readonly KioskReading[];
}

const STEP = 0.25;

/** Rejoue une partie type et relève le portefeuille. Même graine, même relevé. */
export function simulateRun(profile: PlayProfile, difficulty: Difficulty, prices: PriceList, seed: number): RunReading {
  const rules = difficultyConfig[difficulty];
  const state = createStreamState(rules.donations);
  const streamRandom = mulberry32(seed);
  const playRandom = mulberry32(seed ^ 0x9e3779b9);
  let now = 0;
  let mystery = 0;
  let secretsLeft = profile.secrets;
  const bought = new Set<Perk>();
  const kiosks: KioskReading[] = [];
  /** Total reçu à chaque passage devant une borne, pour le calcul du meilleur achat possible. */
  const visits: { perk: Perk; donated: number }[] = [];

  const advance = (seconds: number) => {
    for (let t = 0; t < seconds; t += STEP) {
      now += STEP;
      updateStream(state, STEP, now, streamRandom);
    }
  };
  const event = (kind: StreamEventKind) => notifyStream(state, kind, now, streamRandom);

  for (const stop of PARCOURS) {
    if (stop.detour && !profile.detours.includes(stop.id)) continue;
    if (stop.optional && !(stop.id === "quai" && profile.quai)) continue;
    advance(profile.travel);

    if (stop.beat) {
      // Le premier don attend 12 s de jeu, comme dans `streamFeed.ts`.
      if (stop.beat === "depart") advance(Math.max(0, 12 - now));
      const don = mysteryDonation(state, stop.beat, now);
      if (don) mystery += don.amount;
    }
    for (let i = 0; i < (stop.moments ?? 0); i++) {
      event("moment");
      advance(3);
    }

    if (stop.kiosk) {
      const price = prices[stop.kiosk];
      const wallet = state.wallet;
      const buys = !bought.has(stop.kiosk) && spend(state, price);
      if (buys) bought.add(stop.kiosk);
      kiosks.push({ stop: stop.id, perk: stop.kiosk, price, at: now, wallet, bought: buys });
      visits.push({ perk: stop.kiosk, donated: state.donated });
    }

    const present = stop.kills + (stop.groups ?? []).reduce((sum, size) => sum + wokenGroupSize(size, rules.groupShare), 0);
    const kills = Math.round(present * (stop.detour || present <= 1 ? 1 : profile.killShare));
    for (let i = 0; i < kills; i++) {
      // Intervalle étalé autour de la moyenne : des doublés, donc des séries, et des temps morts.
      advance(profile.killInterval * (0.3 + 1.4 * playRandom()));
      event("kill");
      if (playRandom() < profile.hits / Math.max(1, kills)) event("degats");
      if (playRandom() < profile.breaks / Math.max(1, kills)) event("casse");
    }

    if (stop.card) event("carte");
    if (stop.boss) event("boss");
    for (let i = 0; i < (stop.secrets ?? 0) && secretsLeft > 0; i++, secretsLeft--) {
      advance(10);
      event("secret");
    }
    if (stop.id === "cafeteria" && profile.toilettes) event("toilettes");
  }

  const spendable = visits.at(-1)?.donated ?? 0;
  return { seconds: now, donated: state.donated, mystery, spendable, bought: [...bought], best: bestCount(visits, prices), kiosks };
}

/** Le plus grand panier qu'on pouvait remplir, en achetant chaque perk à son dernier passage possible. */
function bestCount(visits: readonly { perk: Perk; donated: number }[], prices: PriceList): number {
  const perks = [...new Set(visits.map((visit) => visit.perk))];
  let best = 0;
  for (let mask = 1; mask < 1 << perks.length; mask++) {
    const wanted = new Set(perks.filter((_, i) => mask & (1 << i)));
    if (wanted.size <= best) continue;
    // Chaque perk voulu s'achète à son DERNIER passage : c'est là qu'il y a le plus en poche.
    const last = new Map<Perk, number>();
    visits.forEach((visit, index) => {
      if (wanted.has(visit.perk)) last.set(visit.perk, index);
    });
    let spent = 0;
    let feasible = true;
    for (const [index, visit] of visits.entries()) {
      if (last.get(visit.perk) !== index) continue;
      spent += prices[visit.perk];
      if (spent > visit.donated) {
        feasible = false;
        break;
      }
    }
    if (feasible) best = wanted.size;
  }
  return best;
}

export interface ProfileSummary {
  readonly profile: ProfileId;
  readonly difficulty: Difficulty;
  readonly minutes: number;
  /** Médianes sur toutes les graines. */
  readonly donated: number;
  readonly mystery: number;
  readonly spendable: number;
  /** Perks achetés par le joueur dépensier : plus petit, médian, plus grand. */
  readonly bought: readonly [number, number, number];
  /** Le mieux qu'un joueur économe pouvait faire : plus petit, médian, plus grand. */
  readonly best: readonly [number, number, number];
  /** Part des parties où chaque perk est acheté par le joueur dépensier. */
  readonly perks: Readonly<Record<Perk, number>>;
  /** Solde médian en arrivant devant chaque borne, dans l'ordre du parcours. */
  readonly wallets: readonly { stop: string; perk: Perk; price: number; wallet: number }[];
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function spread(values: readonly number[]): [number, number, number] {
  return [Math.min(...values), median(values), Math.max(...values)];
}

/** Relevé d'un profil sur `seeds` parties. */
export function summarize(profile: ProfileId, difficulty: Difficulty, prices: PriceList, seeds = 200): ProfileSummary {
  const runs = Array.from({ length: seeds }, (_, seed) => simulateRun(PROFILES[profile], difficulty, prices, seed + 1));
  const perks = Object.fromEntries(
    PERKS.map((perk) => [perk, runs.filter((run) => run.bought.includes(perk)).length / runs.length]),
  ) as Record<Perk, number>;
  const first = runs[0]!;
  return {
    profile,
    difficulty,
    minutes: Math.round((median(runs.map((run) => run.seconds)) / 60) * 10) / 10,
    donated: median(runs.map((run) => run.donated)),
    mystery: median(runs.map((run) => run.mystery)),
    spendable: median(runs.map((run) => run.spendable)),
    bought: spread(runs.map((run) => run.bought.length)),
    best: spread(runs.map((run) => run.best)),
    perks,
    wallets: first.kiosks.map((kiosk, index) => ({
      stop: kiosk.stop,
      perk: kiosk.perk,
      price: kiosk.price,
      wallet: median(runs.map((run) => run.kiosks[index]!.wallet)),
    })),
  };
}
