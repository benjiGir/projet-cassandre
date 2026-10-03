import { Cause, type Effect, type ManagedRuntime } from "effect";

// see: docs/6-reference/notes-code-core.md#physique-et-services
export function createGameplayRunner<R>(runtime: ManagedRuntime.ManagedRuntime<R, never>) {
  // Pas fixe et rendu : zéro suspension ; laisser remonter l’erreur après diagnostic.
  return function runGameplaySync<A, E>(effect: Effect.Effect<A, E, R>): A {
    try {
      return runtime.runSync(effect);
    } catch (error) {
      if (Cause.isAsyncFiberError(error)) {
        console.error(
          "[effect] un Effect gameplay a tenté de suspendre — vérifier qu'aucun " +
            "Effect.tryPromise/Effect.promise/Effect.async/Effect.sleep n'a été " +
            "introduit dans cet arbre (le pas fixe doit rester strictement synchrone).",
          error,
        );
      }
      throw error;
    }
  };
}
