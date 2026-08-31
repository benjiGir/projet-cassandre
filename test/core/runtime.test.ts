/**
 * Jalon M1 (PLAN_EFFECT_XSTATE.md) : `runGameplaySync` est la frontière
 * synchrone stricte du pas fixe (principe transverse #1) — ce fichier
 * teste cette frontière elle-même en vitest nu (pas `@effect/vitest`),
 * car son rôle est précisément le pont entre du code Effect et du code
 * JS non-Effect appelé une fois par pas fixe.
 */
import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { runGameplaySync } from "../../src/core/runtime";
import { DeterministicRandom } from "../../src/core/random";

describe("runGameplaySync (garde-fou M1)", () => {
  it("laisse passer un Effect purement synchrone", () => {
    expect(runGameplaySync(Effect.sync(() => 42))).toBe(42);
  });

  it("fournit automatiquement les services de GameLayer (DeterministicRandom)", () => {
    const value = runGameplaySync(
      Effect.gen(function* () {
        const random = yield* DeterministicRandom;
        return random.forSeed(1)();
      }),
    );
    expect(typeof value).toBe("number");
  });

  it("relance l'erreur ET logue un message explicite si un Effect suspend", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() =>
        runGameplaySync(Effect.promise(() => Promise.resolve(1))),
      ).toThrow();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toMatch(/tenté de suspendre/);
    } finally {
      spy.mockRestore();
    }
  });
});
