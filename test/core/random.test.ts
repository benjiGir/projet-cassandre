/**
 * Non-régression du jalon M1 (PLAN_EFFECT_XSTATE.md) : `DeterministicRandom`
 * doit produire EXACTEMENT la même séquence que le mulberry32 dupliqué dans
 * `weapons.ts`/`suitManager.ts`/`directorManager.ts`, pour ne jamais casser
 * le rejeu d'input déterministe (F9/F10). Les valeurs attendues ci-dessous
 * ont été calculées en exécutant l'algorithme de production tel quel, avec
 * les graines réelles du jeu (SHOTGUN_SPREAD_SEED, et les graines dérivées
 * par SuitManager/DirectorManager pour les deux premiers spawns) — pas
 * recopiées à la main depuis les fichiers source, pour ne pas se contenter
 * de comparer le code à lui-même.
 */
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { DeterministicRandom } from "../../src/core/random";

const SHOTGUN_SPREAD_SEED = 0x9e3779b9;
const BASE_SUIT_SEED = 0x5eed_c057;
const SEED_STRIDE = 0x9e3779b1;
const BASE_DIRECTOR_SEED = 0xd12ec704;

const suitSpawn0Seed = (BASE_SUIT_SEED + 0 * SEED_STRIDE) >>> 0;
const suitSpawn1Seed = (BASE_SUIT_SEED + 1 * SEED_STRIDE) >>> 0;
const directorSpawn0Seed = (BASE_DIRECTOR_SEED + 0 * SEED_STRIDE) >>> 0;

function sample(next: () => number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(next());
  return out;
}

describe("DeterministicRandom (jalon M1)", () => {
  it.effect("reproduit la séquence de weapons.ts (SHOTGUN_SPREAD_SEED)", () =>
    Effect.gen(function* () {
      const random = yield* DeterministicRandom;
      const values = sample(random.forSeed(SHOTGUN_SPREAD_SEED), 5);
      assert.deepStrictEqual(values, [
        0.3588899802416563, 0.10590326134115458, 0.675290479324758,
        0.9179345588199794, 0.10157715040259063,
      ]);
    }).pipe(Effect.provide(DeterministicRandom.layer)),
  );

  it.effect("reproduit la séquence de suitManager.ts (spawn #0)", () =>
    Effect.gen(function* () {
      const random = yield* DeterministicRandom;
      const values = sample(random.forSeed(suitSpawn0Seed), 5);
      assert.deepStrictEqual(values, [
        0.8889212077483535, 0.6804655091837049, 0.5222313636913896,
        0.3544529068749398, 0.9847202489618212,
      ]);
    }).pipe(Effect.provide(DeterministicRandom.layer)),
  );

  it.effect("reproduit la séquence de directorManager.ts (spawn #0)", () =>
    Effect.gen(function* () {
      const random = yield* DeterministicRandom;
      const values = sample(random.forSeed(directorSpawn0Seed), 5);
      assert.deepStrictEqual(values, [
        0.838270419742912, 0.7299352420959622, 0.8244210931006819,
        0.714750834973529, 0.3743045758455992,
      ]);
    }).pipe(Effect.provide(DeterministicRandom.layer)),
  );

  it.effect(
    "deux générateurs indépendants ne s'entrelacent jamais (pas de flux partagé)",
    () =>
      Effect.gen(function* () {
        const random = yield* DeterministicRandom;
        const suit0 = random.forSeed(suitSpawn0Seed);
        const suit1 = random.forSeed(suitSpawn1Seed);

        // Consommer suit1 plusieurs fois ne doit RIEN changer à la
        // séquence de suit0 : si forSeed renvoyait un flux global partagé,
        // ces deux tableaux ne correspondraient plus aux séquences de
        // référence ci-dessus une fois entrelacés.
        const suit0First = suit0();
        for (let i = 0; i < 10; i++) suit1();
        const suit0Second = suit0();

        assert.strictEqual(suit0First, 0.8889212077483535);
        assert.strictEqual(suit0Second, 0.6804655091837049);
      }).pipe(Effect.provide(DeterministicRandom.layer)),
  );
});
