import * as THREE from "three";
import { Effect, Fiber, Schedule, Semaphore } from "effect";

import type { PhysicsWorld } from "../../physics/world";
import { loadLevel, type LevelHandle } from "./loader";
import { GameRuntime } from "../../core/runtime";

/**
 * Hot reload DEV SEULEMENT pour les niveaux `.glb` — sondage HTTP HEAD plutôt
 * qu'un watcher fichier (voir ADR 0011), préserve la position du joueur, et
 * retrofit Effect au jalon M2 (erreurs typées, mutex de rechargement,
 * polling par `Schedule`). see: docs/pipeline/niveau-blender.md#hot-reload
 *
 * `LevelSession.current` DOIT rester un accès JS brut, sans la moindre
 * indirection Effect : `main.ts` le lit À CHAQUE PAS FIXE (invariant #11,
 * frontière synchrone stricte du pas fixe).
 */

export interface LevelSessionOptions {
  /** Intervalle de sondage HTTP HEAD, ms. 400 ms par défaut : largement sous
   * les 60 s cibles, sans matraquer le serveur dev. Sans effet en production,
   * où le sondage n'existe pas (voir plus bas). */
  pollIntervalMs?: number;
  /** Appelé après CHAQUE (re)chargement réussi, le tout premier compris.
   * `info.isFirstLoad` distingue le boot (où repositionner le joueur sur
   * `handle.spawnPlayer` a du sens) d'un hot reload (où NE JAMAIS le faire). */
  onLoaded?: (handle: LevelHandle, info: { isFirstLoad: boolean }) => void;
  /** Appelé si un (re)chargement échoue (export Blender à moitié écrit,
   * glb temporairement invalide pendant l'écriture...). La session garde le
   * niveau précédent affiché — jamais d'écran noir sur une erreur transitoire. */
  onError?: (error: unknown) => void;
}

export interface LevelSession {
  /** Niveau actuellement affiché, `null` avant le tout premier chargement réussi. */
  readonly current: LevelHandle | null;
  /** Résolu après le PREMIER chargement réussi — pratique pour `await` la
   * position de spawn au boot sans dupliquer la logique de `onLoaded`. */
  readonly ready: Promise<LevelHandle>;
  /** Force un rechargement immédiat, sans attendre le prochain sondage. */
  reload(): Promise<void>;
  /** Arrête le sondage (s'il tourne) et libère le niveau courant. */
  stop(): void;
}

/**
 * Ouvre une session de niveau glTF. Charge `url` UNE PREMIÈRE FOIS
 * immédiatement — en production c'est tout ce qui se passe.
 *
 * EN DÉVELOPPEMENT seulement, sonde ensuite `url` en continu pour détecter un
 * export Blender ultérieur et recharger le niveau en place. `reload()` reste
 * disponible dans les deux cas : c'est un appel explicite, pas une boucle de
 * fond.
 */
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
  let reloadInFlight: Promise<void> | null = null;
  let resolveReady!: (handle: LevelHandle) => void;
  const ready = new Promise<LevelHandle>((resolve) => {
    resolveReady = resolve;
  });

  // Garde-fou structurel EN PLUS de `reloadInFlight` (ne le remplace pas —
  // un Semaphore seul sérialiserait les appels concurrents au lieu de les
  // coalescer). see: docs/pipeline/niveau-blender.md#hot-reload
  const reloadSemaphore = Semaphore.makeUnsafe(1);

  function performLoadEffect(): Effect.Effect<void> {
    return Effect.tryPromise({
      try: () => loadLevel(url, scene, physics),
      catch: (cause) => cause,
    }).pipe(
      Effect.map((nextHandle) => {
        currentHandle?.dispose();
        currentHandle = nextHandle;
        const info = { isFirstLoad };
        if (isFirstLoad) {
          isFirstLoad = false;
          resolveReady(nextHandle);
        }
        options.onLoaded?.(nextHandle, info);
      }),
      Effect.catch((error) =>
        Effect.sync(() => {
          console.error(`[level] échec du (re)chargement de "${url}" — niveau précédent conservé.`, error);
          options.onError?.(error);
        }),
      ),
    );
  }

  function performLoad(): Promise<void> {
    return GameRuntime.runPromise(reloadSemaphore.withPermit(performLoadEffect()));
  }

  function reload(): Promise<void> {
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
        yield* Effect.promise(() => reload());
      }
      lastSignature = signature;
    });
  }

  // Le sondage est un outil d'AUTEUR, pas une fonction du jeu : il sert à voir
  // en jeu un export Blender qu'on vient de faire. En production le `.glb` ne
  // changera jamais, et sonder 2,5 fois par seconde pour l'apprendre coûte du
  // trafic et de la batterie à chaque joueur, indéfiniment.
  //
  // Ce fichier s'annonçait « dev-only » depuis son écriture sans que rien ne
  // l'applique, et le sondage partait bel et bien dans le bundle livré.
  // `import.meta.env.DEV` est remplacé par une constante au build, donc toute
  // cette branche — et `pollOnceEffect` avec elle — disparaît du bundle de
  // production au lieu d'y dormir.
  //
  // Effect.repeat(Schedule.spaced(...)) retourne le compteur du Schedule
  // (jamais lu) : typé au plus large (`unknown`) plutôt que `void`.
  let pollFiber: Fiber.Fiber<unknown, never> | null = null;
  if (import.meta.env.DEV) {
    pollFiber = GameRuntime.runFork(
      pollOnceEffect().pipe(Effect.repeat(Schedule.spaced(pollIntervalMs))),
    );
  }

  void reload();

  return {
    get current() {
      return currentHandle;
    },
    ready,
    reload,
    stop() {
      currentHandle?.dispose();
      currentHandle = null;
      if (pollFiber) {
        pollFiber.interruptUnsafe();
        pollFiber = null;
      }
    },
  };
}
