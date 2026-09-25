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

type FakeHandle = LevelHandle & { restore: ReturnType<typeof vi.fn> };

function fakeHandle(): FakeHandle {
  const restore = vi.fn();
  return {
    root: new THREE.Object3D(),
    gltf: {} as never,
    spawnPlayer: null,
    spawnSuits: [],
    spawnDirectors: [],
    triggers: [],
    doors: [],
    props: [],
    vitres: [],
    sanitaires: [],
    sanitaireRendus: [],
    useObjects: [],
    secrets: [],
    lights: [],
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
      propCount: 0,
      vitreCount: 0,
      vitreBatchCount: 0,
      doorBatchCount: 0,
      sanitaireCount: 0,
      sanitaireBatchCount: 0,
    },
    restore,
    suspend: vi.fn(() => restore),
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

    await session.stop();
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
    expect(handleA.suspend).toHaveBeenCalledTimes(1);
    // L'ancien handle est disposé au profit du nouveau (même séquence
    // qu'avant cette migration : `currentHandle?.dispose()` avant affectation).
    expect(handleA.dispose).toHaveBeenCalledTimes(1);

    await session.stop();
  });

  it("stop() interrompt le sondage et dispose le niveau courant", async () => {
    const handle = fakeHandle();
    loadLevelMock.mockResolvedValueOnce(handle);

    const session = createLevelSession("/fake.glb", {} as never, {} as never, {
      pollIntervalMs: 60_000,
    });
    await session.reload();

    await session.stop();

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

    await session.stop();
  });

  it("stop() attend le chargement en vol puis dispose son résultat sans le publier", async () => {
    let resolveLoad!: (handle: LevelHandle) => void;
    loadLevelMock.mockReturnValueOnce(
      new Promise<LevelHandle>((resolve) => {
        resolveLoad = resolve;
      }),
    );
    const prepare = vi.fn(() => vi.fn());
    const session = createLevelSession("/fake.glb", {} as never, {} as never, {
      pollIntervalMs: 60_000,
      prepare,
    });

    const stopPromise = session.stop();
    const lateHandle = fakeHandle();
    resolveLoad(lateHandle);
    await stopPromise;

    expect(prepare).not.toHaveBeenCalled();
    expect(lateHandle.dispose).toHaveBeenCalledTimes(1);
    expect(session.current).toBeNull();
  });

  it("un échec de préparation dispose le candidat et réactive le niveau courant", async () => {
    const handleA = fakeHandle();
    const handleB = fakeHandle();
    const boom = new Error("construction dérivée impossible");
    const prepare = vi.fn((handle: LevelHandle) => {
      if (handle === handleB) throw boom;
      return vi.fn();
    });
    const onError = vi.fn();
    loadLevelMock.mockResolvedValueOnce(handleA);
    const session = createLevelSession("/fake.glb", {} as never, {} as never, {
      pollIntervalMs: 60_000,
      prepare,
      onError,
    });
    await session.reload();

    loadLevelMock.mockResolvedValueOnce(handleB);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(session.reload()).resolves.toEqual({
      status: "failed",
      error: boom,
      previousRetained: true,
    });

    expect(handleA.suspend).toHaveBeenCalledTimes(1);
    expect(handleA.restore).toHaveBeenCalledTimes(1);
    expect(handleA.dispose).not.toHaveBeenCalled();
    expect(handleB.dispose).toHaveBeenCalledTimes(1);
    expect(session.current).toBe(handleA);
    expect(onError).toHaveBeenCalledWith(boom);
    expect(errorSpy).toHaveBeenCalled();

    await session.stop();
  });

  it("un premier échec reste retentable et le premier succès conserve isFirstLoad", async () => {
    const boom = new Error("niveau absent au boot");
    const handle = fakeHandle();
    const commits: boolean[] = [];
    const prepare = vi.fn((_handle: LevelHandle, info: { isFirstLoad: boolean }) => () => {
      commits.push(info.isFirstLoad);
    });
    loadLevelMock.mockRejectedValueOnce(boom);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const session = createLevelSession("/fake.glb", {} as never, {} as never, {
      pollIntervalMs: 60_000,
      prepare,
    });

    await expect(session.firstLoad).resolves.toEqual({
      status: "failed",
      error: boom,
      previousRetained: false,
    });
    expect(session.current).toBeNull();

    loadLevelMock.mockResolvedValueOnce(handle);
    await expect(session.reload()).resolves.toMatchObject({
      status: "committed",
      handle,
      isFirstLoad: true,
    });
    await expect(session.ready).resolves.toBe(handle);
    expect(commits).toEqual([true]);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    await session.stop();
  });
});
