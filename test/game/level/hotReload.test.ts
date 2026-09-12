/**
 * Jalon M2 (PLAN_EFFECT_XSTATE.md) : `createLevelSession` retrofité vers
 * Effect (mutex de rechargement, polling `Schedule.spaced`) — voir la doc de
 * tête de `src/game/level/hotReload.ts`. `./loader` est mocké : ces tests
 * portent sur l'orchestration de session (coalescing, callbacks, stop()),
 * pas sur le chargement glTF réel (déjà couvert par `loader.test.ts`).
 *
 * Style vitest nu (pas `@effect/vitest`) : `createLevelSession` est
 * exactement la frontière Promise/plain-JS que `main.ts` consomme, jamais un
 * générateur Effect exposé publiquement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import type { LevelHandle } from "../../../src/game/level/loader";

vi.mock("../../../src/game/level/loader", () => ({
  loadLevel: vi.fn(),
}));

import { loadLevel } from "../../../src/game/level/loader";
import { createLevelSession } from "../../../src/game/level/hotReload";

const loadLevelMock = vi.mocked(loadLevel);

function fakeHandle(): LevelHandle {
  return {
    root: new THREE.Object3D(),
    gltf: {} as never,
    spawnPlayer: null,
    spawnSuits: [],
    spawnDirectors: [],
    triggers: [],
    doors: [],
    useObjects: [],
    secrets: [],
    stats: {
      colliderCount: 0,
      colliderKindCounts: { cuboid: 0, convexHull: 0, trimesh: 0 },
      spawnSuitCount: 0,
      spawnDirectorCount: 0,
      triggerCount: 0,
      doorCount: 0,
      useCount: 0,
      secretCount: 0,
      unprefixedMeshCount: 0,
      decorBatchCount: 0,
      lightCount: 0,
    },
    dispose: vi.fn(),
  };
}

beforeEach(() => {
  loadLevelMock.mockReset();
  // Le sondage de fond (`Effect.repeat(Schedule.spaced(...))`) appelle
  // `fetch` en HEAD sur l'URL du niveau — sans rapport avec ce qui est
  // testé ici (couvert séparément par le comportement silencieux documenté
  // dans hotReload.ts). Stub global pour ne jamais taper un vrai réseau
  // pendant ces tests, et un intervalle large pour qu'il ne se déclenche
  // jamais dans la fenêtre de vie d'un test.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("réseau non disponible dans les tests")),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createLevelSession (jalon M2) — mutex de rechargement", () => {
  it("coalesce deux appels concurrents à reload() en un seul chargement en vol", async () => {
    let resolveFirst!: (handle: LevelHandle) => void;
    const firstLoad = new Promise<LevelHandle>((resolve) => {
      resolveFirst = resolve;
    });
    loadLevelMock.mockReturnValue(firstLoad);

    const session = createLevelSession("/fake.glb", {} as never, {} as never, {
      pollIntervalMs: 60_000,
    });

    // `createLevelSession` déclenche déjà un premier chargement à la
    // construction (voir sa doc) : il est ici volontairement laissé EN VOL
    // (la promesse n'est pas encore résolue) pour simuler le pire cas —
    // un rechargement Blender déclenché pendant qu'un chargement précédent
    // tourne encore.
    expect(loadLevelMock).toHaveBeenCalledTimes(1);

    const reload1 = session.reload();
    const reload2 = session.reload();

    // Deux appels concurrents PENDANT que le premier est encore en vol :
    // aucun second appel réseau ne doit avoir été déclenché.
    expect(loadLevelMock).toHaveBeenCalledTimes(1);

    const handle = fakeHandle();
    resolveFirst(handle);
    await reload1;
    await reload2;

    expect(loadLevelMock).toHaveBeenCalledTimes(1);
    expect(session.current).toBe(handle);

    session.stop();
  });

  it("un nouvel appel à reload() APRÈS complétion déclenche bien un nouveau chargement", async () => {
    const handleA = fakeHandle();
    loadLevelMock.mockResolvedValueOnce(handleA);

    const session = createLevelSession("/fake.glb", {} as never, {} as never, {
      pollIntervalMs: 60_000,
    });
    // `await session.reload()` plutôt que `session.ready` : `reload()`
    // renvoie `reloadInFlight.finally(() => reloadInFlight = null)`, donc
    // `await` sur CETTE promesse garantit que le flag de coalescing est déjà
    // retombé à `null` au réveil — `ready` seul se résout un peu PLUS TÔT
    // (à l'intérieur du `Effect.map` de `performLoadEffect`, avant que
    // `.finally` n'ait tourné), ce qui course avec le second `reload()`
    // ci-dessous et le fait parfois coalescer à tort avec le premier.
    await session.reload();
    expect(loadLevelMock).toHaveBeenCalledTimes(1);
    expect(session.current).toBe(handleA);

    const handleB = fakeHandle();
    loadLevelMock.mockResolvedValueOnce(handleB);
    await session.reload();

    expect(loadLevelMock).toHaveBeenCalledTimes(2);
    expect(session.current).toBe(handleB);
    // L'ancien handle est disposé au profit du nouveau (même séquence
    // qu'avant cette migration : `currentHandle?.dispose()` avant affectation).
    expect(handleA.dispose).toHaveBeenCalledTimes(1);

    session.stop();
  });

  it("stop() interrompt le sondage et dispose le niveau courant", async () => {
    const handle = fakeHandle();
    loadLevelMock.mockResolvedValueOnce(handle);

    const session = createLevelSession("/fake.glb", {} as never, {} as never, {
      pollIntervalMs: 60_000,
    });
    await session.reload();

    session.stop();

    expect(handle.dispose).toHaveBeenCalledTimes(1);
    expect(session.current).toBeNull();
  });

  it("un échec de chargement appelle onError et conserve le niveau précédent", async () => {
    const handleA = fakeHandle();
    loadLevelMock.mockResolvedValueOnce(handleA);

    const onError = vi.fn();
    const session = createLevelSession("/fake.glb", {} as never, {} as never, {
      pollIntervalMs: 60_000,
      onError,
    });
    await session.reload();

    const boom = new Error("glb temporairement invalide");
    loadLevelMock.mockRejectedValueOnce(boom);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await session.reload();

    expect(onError).toHaveBeenCalledWith(boom);
    expect(session.current).toBe(handleA); // niveau précédent conservé
    expect(errorSpy).toHaveBeenCalledWith(
      '[level] échec du (re)chargement de "/fake.glb" — niveau précédent conservé.',
      boom,
    );

    session.stop();
  });
});
