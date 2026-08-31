/**
 * Jalon M0 (PLAN_EFFECT_XSTATE.md) : preuve que la chaîne Vitest + Effect
 * tourne avant d'investir dans quoi que ce soit d'autre. À retirer/remplacer
 * une fois M1 (fondations déterministes) apporte de vrais tests.
 */
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

describe("bootstrap M0", () => {
  it.effect("Effect tourne dans Vitest", () =>
    Effect.gen(function* () {
      assert.strictEqual(1 + 1, 2);
    }),
  );
});
