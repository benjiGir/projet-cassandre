import type * as THREE from "three";
import type { Fiber } from "effect";
import { Effect, Schedule, Semaphore } from "effect";

import type { PhysicsWorld } from "../../../physics/world";
import { loadLevel } from "./loader";
import type { LevelHandle } from "./levelTypes";
import { GameRuntime } from "../../../app/runtime/gameRuntime";

// see: docs/archive/pipeline-niveau-blender.md#hot-reload

export interface LevelSessionOptions {
  /** Intervalle de sondage HTTP HEAD, ms. 400 ms par défaut : largement sous
   * les 60 s cibles, sans matraquer le serveur dev. Sans effet en production,
   * où le sondage n'existe pas (voir plus bas). */
  pollIntervalMs?: number;
  // see: docs/6-reference/notes-code-gameplay-niveau.md#chargement-et-ressources
  prepare?: (handle: LevelHandle, info: { isFirstLoad: boolean }) => (() => void) | void | Promise<(() => void) | void>;
  /** Appelé si un (re)chargement échoue (export Blender à moitié écrit,
   * glb temporairement invalide pendant l'écriture...). La session garde le
   * niveau précédent affiché — jamais d'écran noir sur une erreur transitoire. */
  onError?: (error: unknown) => void;
  /** Avancement du TÉLÉCHARGEMENT du `.glb`, fraction 0..1. Appelé aussi lors
   * d'un rechargement à chaud — c'est à l'appelant de décider si ça l'intéresse
   * encore (`core/loading/loadingProgress.ts` ignore tout après `finishLoading()`). */
  onProgress?: (fraction: number) => void;
}

export type LevelLoadResult =
  | { status: "committed"; handle: LevelHandle; isFirstLoad: boolean }
  | { status: "failed"; error: unknown; previousRetained: boolean }
  | { status: "cancelled" };

export interface LevelSession {
  /** Niveau actuellement affiché, `null` avant le tout premier chargement réussi. */
  /** Lecture brute au pas fixe : aucune frontière asynchrone ici. */
  readonly current: LevelHandle | null;
  /** Résolu après le PREMIER chargement validé — pratique pour `await` la
   * position de spawn au boot sans dupliquer la logique de préparation. */
  readonly ready: Promise<LevelHandle>;
  /** Résultat du premier essai. Un échec reste distinct d'un succès et peut
   * donc ouvrir un chemin de retry sans laisser entrer dans le jeu. */
  readonly firstLoad: Promise<LevelLoadResult>;
  /** Force un rechargement immédiat, sans attendre le prochain sondage. */
  reload(): Promise<LevelLoadResult>;
  /** Arrête le sondage, attend le chargement en vol, puis libère le niveau. */
  stop(): Promise<void>;
}

export function createLevelSession(
  url: string,
  scene: THREE.Scene,
  physics: PhysicsWorld,
  options: LevelSessionOptions = {},
): LevelSession {
  const pollIntervalMs = options.pollIntervalMs ?? 400;

  let currentHandle: LevelHandle | null = null;
  let lastSignature: string | null = null;
  let isFirstLoad = true;
  let stopped = false;
  let reloadInFlight: Promise<LevelLoadResult> | null = null;
  let stopInFlight: Promise<void> | null = null;
  let resolveReady!: (handle: LevelHandle) => void;
  const ready = new Promise<LevelHandle>((resolve) => {
    resolveReady = resolve;
  });

  // Garde-fou structurel EN PLUS de `reloadInFlight` (ne le remplace pas —
  // un Semaphore seul sérialiserait les appels concurrents au lieu de les
  // coalescer). see: docs/archive/pipeline-niveau-blender.md#hot-reload
  const reloadSemaphore = Semaphore.makeUnsafe(1);

  async function performLoadAttempt(): Promise<LevelLoadResult> {
    let candidate: LevelHandle | null = null;
    let restorePrevious: (() => void) | null = null;
    const previous = currentHandle;
    const firstLoad = isFirstLoad;

    try {
      candidate = await loadLevel(url, scene, physics, options.onProgress);
      if (stopped) {
        candidate.dispose();
        candidate = null;
        return { status: "cancelled" };
      }

      restorePrevious = previous?.suspend() ?? null;
      const commit = await options.prepare?.(candidate, { isFirstLoad: firstLoad });
      if (stopped) {
        candidate.dispose();
        candidate = null;
        restorePrevious?.();
        return { status: "cancelled" };
      }

      commit?.();
      previous?.dispose();
      currentHandle = candidate;
      const committed = candidate;
      candidate = null;
      if (firstLoad) {
        isFirstLoad = false;
        resolveReady(committed);
      }
      return { status: "committed", handle: committed, isFirstLoad: firstLoad };
    } catch (error) {
      candidate?.dispose();
      restorePrevious?.();
      if (stopped) return { status: "cancelled" };

      console.error(`[level] échec du (re)chargement de "${url}" — niveau précédent conservé.`, error);
      options.onError?.(error);
      return { status: "failed", error, previousRetained: previous !== null };
    }
  }

  function performLoad(): Promise<LevelLoadResult> {
    return GameRuntime.runPromise(
      reloadSemaphore.withPermit(
        Effect.tryPromise({
          try: performLoadAttempt,
          catch: (cause) => cause,
        }),
      ),
    );
  }

  function reload(): Promise<LevelLoadResult> {
    if (stopped) return Promise.resolve({ status: "cancelled" });
    if (!reloadInFlight) {
      reloadInFlight = performLoad().finally(() => {
        reloadInFlight = null;
      });
    }
    return reloadInFlight;
  }

  function pollOnceEffect(): Effect.Effect<void> {
    return Effect.gen(function* () {
      const res = yield* Effect.tryPromise({
        try: () => fetch(url, { method: "HEAD", cache: "no-store" }),
        catch: () => null,
      }).pipe(
        // Serveur dev temporairement indisponible : retente au prochain
        // tick, jamais de throw depuis la boucle de fond.
        Effect.catch(() => Effect.succeed(null)),
      );
      if (!res || !res.ok) return;

      const signature =
        res.headers.get("etag") ?? res.headers.get("last-modified") ?? res.headers.get("content-length");
      if (signature === null) return;

      if (lastSignature !== null && signature !== lastSignature) {
        console.info(`[level] changement détecté sur "${url}" — rechargement.`);
        yield* Effect.promise(() => reload()).pipe(Effect.asVoid);
      }
      lastSignature = signature;
    });
  }

  let pollFiber: Fiber.Fiber<unknown> | null = null;
  if (import.meta.env.DEV) {
    pollFiber = GameRuntime.runFork(pollOnceEffect().pipe(Effect.repeat(Schedule.spaced(pollIntervalMs))));
  }

  const firstLoad = reload();

  return {
    get current() {
      return currentHandle;
    },
    ready,
    firstLoad,
    reload,
    stop() {
      if (stopInFlight) return stopInFlight;
      stopped = true;
      if (pollFiber) {
        pollFiber.interruptUnsafe();
        pollFiber = null;
      }
      const pending = reloadInFlight;
      stopInFlight = (async () => {
        if (pending) await pending;
        currentHandle?.dispose();
        currentHandle = null;
      })();
      return stopInFlight;
    },
  };
}
