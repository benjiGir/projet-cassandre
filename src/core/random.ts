import { Context, Layer } from "effect";

// Source canonique unique de mulberry32 — ne pas en dupliquer une copie
// ailleurs (voir l'ADR pour l'historique de la duplication déjà corrigée).
// see: docs/decisions/0007-rng-deterministe.md
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fabrique de générateurs indépendants, jamais un flux partagé : chaque
 * appel à `forSeed` isole ses appelants les uns des autres (sinon l'ordre
 * d'appel romprait le rejeu d'input déterministe). Le générateur retourné
 * est une fonction synchrone brute, pas un `Effect` — appelée plusieurs
 * fois par pas fixe (jitter de tir), l'envelopper coûterait par appel pour
 * aucun bénéfice ici.
 *
 * see: docs/decisions/0007-rng-deterministe.md
 */
export class DeterministicRandom extends Context.Service<
  DeterministicRandom,
  {
    readonly forSeed: (seed: number) => () => number;
  }
>()("cassandre/core/DeterministicRandom") {
  static readonly layer = Layer.succeed(
    DeterministicRandom,
    DeterministicRandom.of({ forSeed: mulberry32 }),
  );
}
