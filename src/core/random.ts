import { Context, Layer } from "effect";

/**
 * Algorithme mulberry32 — copie exacte de celui dupliqué dans
 * `weapons.ts`/`suit.ts`/`director.ts`. Ce fichier en devient la source
 * canonique ; faire pointer ces trois call sites ici est prévu pour le
 * jalon M6 (PLAN_EFFECT_XSTATE.md), pas ici — ne pas les toucher tant
 * qu'ils n'ont pas de raison de bouger.
 */
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
 * Fabrique de générateurs déterministes indépendants — PAS un flux
 * partagé. `weapons.ts` seed une instance unique pour la dispersion du
 * pompe ; `suitManager.ts`/`directorManager.ts` seedent une instance PAR
 * ENTITÉ à partir d'un compteur de spawn. Ces flux ne doivent jamais
 * s'entrelacer : si `forSeed` renvoyait un seul flux global, la sortie de
 * chaque appelant dépendrait de l'ordre d'appel des autres, cassant le
 * rejeu d'input déterministe (F9/F10, `core/inputRecorder.ts`).
 *
 * `forSeed` passe par le service Effect pour rester injectable en test
 * (un double scripté peut remplacer mulberry32 sans toucher les
 * appelants) ; le générateur qu'elle retourne reste une fonction
 * synchrone brute, appelée plusieurs fois par pas fixe (jitter de visée
 * par ennemi, dispersion de tir) — l'envelopper dans un Effect à chaque
 * `next()` ajouterait un coût par appel pour aucun bénéfice ici.
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
