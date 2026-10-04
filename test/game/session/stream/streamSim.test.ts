import { describe, expect, it } from "vitest";

import {
  createStreamState,
  mysteryDonation,
  notifyStream,
  spend,
  streamConfig,
  streamRecap,
  updateStream,
  type StreamEventKind,
} from "../../../../src/game/session/stream/streamSim";
import { MYSTERY_DONATIONS, MYSTERY_DONOR } from "../../../../src/game/session/stream/streamTexts";

/** Petit générateur déterministe, local au test. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const DT = 1 / 60;

function partie(seed: number, evenements: readonly [number, StreamEventKind][], duree: number) {
  const state = createStreamState();
  const random = rng(seed);
  const dons: number[] = [];
  let i = 0;
  for (let now = 0; now < duree; now += DT) {
    while (i < evenements.length && evenements[i]![0] <= now) {
      const don = notifyStream(state, evenements[i]![1], now, random);
      if (don) dons.push(don.amount);
      i++;
    }
    updateStream(state, DT, now, random);
  }
  return { state, dons };
}

describe("simulation du direct", () => {
  const scenario: [number, StreamEventKind][] = [
    [2, "kill"], [3, "kill"], [4, "kill"], [10, "secret"], [14, "casse"], [20, "degats"], [30, "boss"],
  ];

  it("la même séquence d'actions donne le même direct, au message près", () => {
    const a = partie(42, scenario, 40);
    const b = partie(42, scenario, 40);
    expect(a.state.chat).toEqual(b.state.chat);
    expect(a.dons).toEqual(b.dons);
    expect(a.state.viewers).toBe(b.state.viewers);
    expect(a.state.wallet).toBe(b.state.wallet);
  });

  it("un évènement fait monter l'audience, et les abonnés suivent les spectateurs gagnés", () => {
    const state = createStreamState();
    notifyStream(state, "kill", 1, () => 0.999);
    expect(state.viewers).toBeGreaterThan(streamConfig.startViewers + streamConfig.viewerGain[0]);
    expect(state.followers).toBe(
      streamConfig.startFollowers + Math.floor(state.gained / streamConfig.viewersPerFollower),
    );
  });

  it("trois kills rapprochés font une série, qui rapporte plus qu'un kill", () => {
    const state = createStreamState();
    notifyStream(state, "kill", 1, () => 0.99);
    notifyStream(state, "kill", 2, () => 0.99);
    expect(state.lastTopic).toBe("kill");
    const avant = state.viewers;
    notifyStream(state, "kill", 3, () => 0.99);
    expect(state.lastTopic).toBe("serie");
    expect(state.viewers - avant).toBeGreaterThan(streamConfig.viewerGain[1]);
  });

  it("l'ennui fait partir l'audience, sans descendre sous une part du pic", () => {
    const state = createStreamState();
    for (let t = 0; t < 10; t++) notifyStream(state, "boss", t, () => 0.99);
    const pic = state.peakViewers;
    const random = rng(1);
    for (let now = 10; now < 10 + streamConfig.idleGrace - 1; now += DT) updateStream(state, DT, now, random);
    expect(state.viewers).toBe(pic);
    for (let now = 40; now < 600; now += DT) updateStream(state, DT, now, random);
    expect(state.viewers).toBeLessThan(pic);
    expect(state.viewers).toBeCloseTo(pic * streamConfig.floorOfPeak, 5);
    expect(state.peakViewers).toBe(pic);
  });

  it("deux dons ordinaires ne se suivent pas de trop près", () => {
    const state = createStreamState();
    const toujours = () => 0;
    expect(notifyStream(state, "secret", 1, toujours)).not.toBeNull();
    expect(notifyStream(state, "secret", 1 + streamConfig.donationCooldown - 1, toujours)).toBeNull();
    expect(notifyStream(state, "secret", 1 + streamConfig.donationCooldown + 1, toujours)).not.toBeNull();
    expect(state.donationCount).toBe(2);
  });

  it("le chat écrit à son rythme, garde ses dernières lignes et numérote ses messages", () => {
    const { state } = partie(7, [], 60);
    expect(state.chat).toHaveLength(streamConfig.chatLines);
    const [min, max] = streamConfig.chatInterval;
    expect(state.chatSerial).toBeGreaterThanOrEqual(Math.floor(60 / max) - 1);
    expect(state.chatSerial).toBeLessThanOrEqual(Math.ceil(60 / min));
    expect(new Set(state.chat.map((message) => message.text)).size).toBe(state.chat.length);
    const ids = state.chat.map((message) => message.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it("le bilan de fin rend le pic d'audience, les abonnés gagnés et les dons, même après une retombée", () => {
    const state = createStreamState();
    for (let t = 0; t < 5; t++) notifyStream(state, "boss", t * 10, () => 0);
    const pic = state.peakViewers;
    for (let now = 50; now < 400; now += DT) updateStream(state, DT, now, rng(3));
    const bilan = streamRecap(state);
    expect(bilan.peakViewers).toBe(Math.round(pic));
    expect(bilan.peakViewers).toBeGreaterThan(Math.round(state.viewers));
    expect(bilan.followersGained).toBe(state.followers - streamConfig.startFollowers);
    expect(bilan.donations).toBe(state.wallet);
    expect(bilan.donationCount).toBe(5);
  });

  it("une dépense débite le solde sans toucher au total des dons du bilan", () => {
    const state = createStreamState();
    mysteryDonation(state, "carte_or", 0);
    const recu = MYSTERY_DONATIONS.carte_or.amount;

    expect(spend(state, recu + 1)).toBe(false);
    expect(state.wallet).toBe(recu);

    expect(spend(state, 20)).toBe(true);
    expect(state.wallet).toBe(recu - 20);
    expect(streamRecap(state).donations).toBe(recu);
  });

  it("le donateur mystère donne une fois par étape, quel que soit le délai entre dons", () => {
    const state = createStreamState();
    notifyStream(state, "secret", 1, () => 0);
    const don = mysteryDonation(state, "carte_or", 1.1);
    expect(don).toEqual({ pseudo: MYSTERY_DONOR, mystery: true, ...MYSTERY_DONATIONS.carte_or });
    expect(mysteryDonation(state, "carte_or", 50)).toBeNull();
    expect(state.chat.at(-1)).toMatchObject({ pseudo: MYSTERY_DONOR, kind: "don" });
  });
});
