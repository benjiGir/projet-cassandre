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
import { PARCOURS, PROFILES, type PlayProfile, type ProfileId } from "./economyProfiles";
import { Effect } from "effect";
import { DeterministicRandom } from "../../../core/effect/random";
import { kioskOffer } from "../../player/kioskOffer";

// Relevé du portefeuille (lot B7 de PLAN_SUITE.md) : une partie type, décrite
// comme une suite d'étapes du niveau, rejouée à travers la VRAIE simulation
// du direct (`streamSim.ts`) — mêmes règles, mêmes tirages. Ce que le relevé
// mesure : combien le joueur a en poche devant chaque borne, et combien de
// perks il peut s'offrir. Ce qu'il ne mesure pas : si c'est amusant. Le parcours
// et les profils sont dans `economyProfiles.ts`.

/** Prix d'une borne, par perk : ceux du niveau, ou ceux d'une variante à l'essai. */
export type PriceList = Readonly<Record<Perk, number>>;

/** Générateur déterministe local : le relevé ne touche à aucun flux du jeu. */
function mulberry32(seed: number): () => number {
  return Effect.runSync(DeterministicRandom.useSync((random) => random.forSeed(seed))
    .pipe(Effect.provide(DeterministicRandom.layer)));
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
  readonly wallet: number;
  readonly consumables: number;
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
  let consumables = 0;
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
      const resolved = kioskOffer(bought, { perk: stop.kiosk, price: prices[stop.kiosk] });
      const price = resolved.price;
      const wallet = state.wallet;
      const buys = spend(state, price);
      if (buys && resolved.kind === "perk") bought.add(stop.kiosk);
      if (buys && resolved.kind !== "perk") consumables++;
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
  return { wallet: state.wallet, consumables, seconds: now, donated: state.donated, mystery, spendable, bought: [...bought], best: bestCount(visits, prices), kiosks };
}

export function simulateCampaign(profile: PlayProfile, difficulty: Difficulty, prices: PriceList, seed: number) {
  const store = simulateRun(profile, difficulty, prices, seed);
  const state = createStreamState(difficultyConfig[difficulty].donations);
  state.wallet = store.wallet;
  const perks = new Set(store.bought);
  const random = mulberry32(seed ^ 0xc1c1);
  let seconds = 0;
  let consumables = 0;
  const visits: KioskReading[] = [];
  for (const stop of METRO_ECONOMY_ROUTE) {
    const kills = Math.round(stop.kills * profile.killShare * difficultyConfig[difficulty].groupShare);
    const duration = profile.travel + kills * profile.killInterval;
    for (let t = 0; t < duration; t += STEP) {
      seconds += STEP;
      updateStream(state, STEP, seconds, random);
    }
    for (let i = 0; i < kills; i++) notifyStream(state, "kill", seconds, random);
    if (stop.kiosk) {
      const offer = kioskOffer(perks, { perk: stop.kiosk, price: prices[stop.kiosk] });
      const wallet = state.wallet;
      const bought = spend(state, offer.price);
      if (bought && offer.kind === "perk") perks.add(stop.kiosk);
      if (bought && offer.kind !== "perk") consumables++;
      visits.push({ stop: stop.id, perk: stop.kiosk, price: offer.price, wallet, bought, at: seconds });
    }
  }
  return { store, metro: { entryWallet: store.wallet, entryPerks: store.bought,
    wallet: state.wallet, perks: [...perks], donated: state.donated, consumables, seconds, visits } };
}

// see: docs/4-technique/campagne.md#relevé-déconomie
const METRO_ECONOMY_ROUTE: readonly { id: string; kills: number; kiosk?: Perk }[] = [
  { id: "quartier", kills: 4, kiosk: "boisson" },
  { id: "hall", kills: 6, kiosk: "perche" },
  { id: "mezzanine", kills: 4, kiosk: "vpn" },
  { id: "quai_1", kills: 8, kiosk: "aimant" },
  { id: "maintenance", kills: 6, kiosk: "premium" },
  { id: "rame", kills: 4 },
  { id: "station_2", kills: 8, kiosk: "gilet" },
  { id: "sortie", kills: 4, kiosk: "boisson" },
];

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
