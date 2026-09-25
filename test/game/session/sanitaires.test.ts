/**
 * Règle "sanitaires utilisables" (`game/session/sanitaires.ts`, ADR 0032) —
 * la partie ORCHESTRATION (PV, délai, messages, réplique, dispatch du rayon
 * de visée), pas la géométrie du "neartag" ni la casse (couvertes par
 * `test/game/level/sanitaires.test.ts`, `SanitaireSystem.resolveAim`). Même
 * patron de session réduite que `test/game/player/loyaltyCards.test.ts` :
 * un objet qui satisfait STRUCTURELLEMENT `GameSession` pour ce que ce
 * module touche réellement, casté `as unknown as GameSession`.
 *
 * `trySanitaire` lance désormais un VRAI rayon Rapier (`RaycastService`,
 * ADR 0032 section "Portée — visée") : `sanitaireSystem` est ici un objet
 * FACTICE qui n'implémente que `resolveAim` (spié, jamais la géométrie
 * réelle — c'est le rôle de `SanitaireSystem` dans l'autre fichier), et le
 * rayon lui-même est SCRIPTÉ via la technique déjà établie par
 * `test/game/entities/suit.test.ts`/`director.test.ts` : `RaycastService`
 * est un singleton partagé par tout le process (garanti par
 * `Context.Service.of`, l'identité), on récupère l'instance UNIQUE via
 * `GameRuntime.runSync(RaycastService)` puis on réécrit ses méthodes par
 * `Object.assign` avec la forme produite par `RaycastService.test(overrides)`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Effect } from "effect";

import { GameRuntime } from "../../../src/core/runtime";
import { RaycastService, type RaycastServiceShape } from "../../../src/physics/raycast";
import { initPhysics } from "../../../src/physics/world";
import {
  relieveAtSanitaire,
  trySanitaire,
  SANITAIRE_RELIEF_COOLDOWN_SECONDS,
  SANITAIRE_AIM_RANGE_METERS,
} from "../../../src/game/session/sanitaires";
import { type GameSession } from "../../../src/game/session/gameSession";
import { useGameStore } from "../../../src/game/state";

await initPhysics();

// ---------------------------------------------------------------------------
// Contrôle du rayon Rapier interne — voir la doc de tête du fichier.
// ---------------------------------------------------------------------------

const liveRaycast: RaycastServiceShape = GameRuntime.runSync(RaycastService);

function scriptRaycast(overrides: Partial<RaycastServiceShape> = {}) {
  const shape = Effect.runSync(Effect.provide(RaycastService, RaycastService.test(overrides)));
  Object.assign(liveRaycast, shape);
}

/** Un hit Rapier minimal, juste ce que `trySanitaire` lit (`collider.handle`, `timeOfImpact`). */
function fakeHit(colliderHandle: number, timeOfImpact: number): RAPIER.RayColliderHit {
  return {
    collider: { handle: colliderHandle } as unknown as RAPIER.Collider,
    timeOfImpact,
  } as unknown as RAPIER.RayColliderHit;
}

interface FakeAimedResult {
  name: string;
  kind: "cuvette" | "urinoir";
  broken: boolean;
}

/** `sanitaireSystem` factice : ne porte QUE `resolveAim`, spié — la
 * géométrie réelle du "neartag" (volume du jet, cloison qui bloque) est
 * testée contre le VRAI `SanitaireSystem` dans `test/game/level/sanitaires.test.ts`.
 * Signature explicite (4 paramètres) pour que `.mock.calls[n]` soit un vrai
 * tuple à 4 éléments, pas déduit vide depuis `() => result`. */
function fakeSanitaireSystem(result: FakeAimedResult | null) {
  return {
    resolveAim: vi.fn(
      (_eyeOrigin: THREE.Vector3, _direction: THREE.Vector3, _rangeMeters: number, _worldHit: unknown) => result,
    ),
  };
}

function sessionDeTest(overrides: Partial<GameSession> = {}): GameSession {
  return {
    playerHp: 100,
    sanitaireReliefCooldown: 0,
    sanitaireReliefRandom: () => 0,
    lastHeroLineAt: -Infinity,
    sanitaireSystem: null,
    physics: {} as never, // ignoré par le rayon SCRIPTÉ (RaycastService.test), jamais un vrai monde Rapier ici
    ...overrides,
  } as unknown as GameSession;
}

beforeEach(() => {
  // `showHudMessage`/`triggerHeroLine` programment l'effacement du message
  // avec `window.setTimeout` (voir `session/feedback.ts`) : il n'y a pas de
  // `window` en environnement node. Même contournement que
  // `loyaltyCards.test.ts` — ces tests vérifient l'état AFFICHÉ, pas sa
  // disparition différée.
  vi.stubGlobal("window", { setTimeout: () => 0 });
  useGameStore.getState().setDebug({ playerMaxHp: 100 });
  useGameStore.getState().setPlayerHp(100);
  useGameStore.getState().showHudMessage(null);
  useGameStore.getState().showHeroLine(null);
  scriptRaycast(); // repli par défaut : rayon "rien touché" (voir la doc de tête)
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("relieveAtSanitaire — soulagement (sanitaire intact)", () => {
  it("hors délai, PV pas pleins : soigne 10 % du max (arrondi), pose le délai, message factuel + réplique", () => {
    const session = sessionDeTest({ playerHp: 50 });

    relieveAtSanitaire(session);

    expect(session.playerHp).toBe(60); // 100 * 0.1 = 10
    expect(session.sanitaireReliefCooldown).toBe(SANITAIRE_RELIEF_COOLDOWN_SECONDS);
    expect(useGameStore.getState().debug.playerHp).toBe(60);
    expect(useGameStore.getState().hudMessage).toBe("+10 PV");
    expect(useGameStore.getState().heroLine).not.toBeNull();
  });

  it("plafonne au PV max — jamais un soin qui dépasse", () => {
    const session = sessionDeTest({ playerHp: 95 });

    relieveAtSanitaire(session);

    expect(session.playerHp).toBe(100);
    expect(useGameStore.getState().hudMessage).toBe("+5 PV");
  });

  it("pendant le délai : chasse d'eau seule, message court, AUCUN soin, délai inchangé", () => {
    const session = sessionDeTest({ playerHp: 50, sanitaireReliefCooldown: 137 });

    relieveAtSanitaire(session);

    expect(session.playerHp).toBe(50); // aucun soin
    expect(session.sanitaireReliefCooldown).toBe(137); // ni consommé ni prolongé
    expect(useGameStore.getState().hudMessage).toBe("Rien ne vient.");
    expect(useGameStore.getState().heroLine).toBeNull(); // pas de réplique sans soin réel
  });

  it("à PV pleins ET hors délai : message dédié, délai NON consommé (écart volontaire à Duke)", () => {
    const session = sessionDeTest({ playerHp: 100, sanitaireReliefCooldown: 0 });

    relieveAtSanitaire(session);

    expect(session.sanitaireReliefCooldown).toBe(0); // toujours prêt pour la prochaine fois
    expect(useGameStore.getState().hudMessage).toBe("Vous êtes déjà en pleine forme.");
    expect(useGameStore.getState().heroLine).toBeNull();
  });

  it("la réplique choisie dépend du RNG DÉTERMINISTE de la session — jamais Math.random()", () => {
    const sessionA = sessionDeTest({ playerHp: 10, sanitaireReliefRandom: () => 0 });
    relieveAtSanitaire(sessionA);
    const ligneA = useGameStore.getState().heroLine;

    useGameStore.getState().showHeroLine(null);
    useGameStore.getState().setPlayerHp(10);

    const sessionB = sessionDeTest({ playerHp: 10, sanitaireReliefRandom: () => 0.999 });
    relieveAtSanitaire(sessionB);
    const ligneB = useGameStore.getState().heroLine;

    expect(ligneA).not.toBeNull();
    expect(ligneB).not.toBeNull();
    expect(ligneA).not.toBe(ligneB); // deux graines différentes, deux répliques différentes
  });
});

describe("trySanitaire — point d'entrée touche E, dispatch après visée", () => {
  // Yaw/pitch neutres (0, 0) : direction de visée (0,0,-1), sans incidence
  // ici puisque `resolveAim` est FACTICE et ignore la géométrie reçue — seul
  // compte, dans cette section, CE QUI EST FAIT du résultat qu'il renvoie.
  const AUCUNE_VISEE = { eyeOffset: 1.6, yaw: 0, pitch: 0 };

  it("aucun appui : false, aucun effet, aucun rayon lancé", () => {
    const system = fakeSanitaireSystem({ name: "sanitaire_a", kind: "cuvette", broken: false });
    const session = sessionDeTest({ sanitaireSystem: system as never });

    expect(
      trySanitaire(session, false, new THREE.Vector3(), AUCUNE_VISEE.eyeOffset, AUCUNE_VISEE.yaw, AUCUNE_VISEE.pitch),
    ).toBe(false);
    expect(session.playerHp).toBe(100);
    expect(system.resolveAim).not.toHaveBeenCalled();
  });

  it("aucun SanitaireSystem (niveau sans sanitaire_*, ou gym) : false, aucun rayon lancé", () => {
    const castRay = vi.fn(() => Effect.succeed(null));
    scriptRaycast({ castRay });
    const session = sessionDeTest({ sanitaireSystem: null });

    expect(
      trySanitaire(session, true, new THREE.Vector3(), AUCUNE_VISEE.eyeOffset, AUCUNE_VISEE.yaw, AUCUNE_VISEE.pitch),
    ).toBe(false);
    expect(castRay).not.toHaveBeenCalled();
  });

  it("aucun sanitaire visé (resolveAim renvoie null) : false", () => {
    const session = sessionDeTest({ sanitaireSystem: fakeSanitaireSystem(null) as never });

    expect(
      trySanitaire(session, true, new THREE.Vector3(), AUCUNE_VISEE.eyeOffset, AUCUNE_VISEE.yaw, AUCUNE_VISEE.pitch),
    ).toBe(false);
  });

  it("sanitaire INTACT visé : déclenche le soulagement, consomme l'appui", () => {
    const session = sessionDeTest({
      playerHp: 50,
      sanitaireSystem: fakeSanitaireSystem({ name: "sanitaire_a", kind: "cuvette", broken: false }) as never,
    });

    expect(
      trySanitaire(session, true, new THREE.Vector3(), AUCUNE_VISEE.eyeOffset, AUCUNE_VISEE.yaw, AUCUNE_VISEE.pitch),
    ).toBe(true);
    expect(session.playerHp).toBe(60);
    expect(session.sanitaireReliefCooldown).toBe(SANITAIRE_RELIEF_COOLDOWN_SECONDS);
  });

  it("sanitaire CASSÉ visé : +1 PV par appui, illimité, consomme l'appui", () => {
    const session = sessionDeTest({
      playerHp: 50,
      sanitaireSystem: fakeSanitaireSystem({ name: "sanitaire_a", kind: "urinoir", broken: true }) as never,
    });

    expect(
      trySanitaire(session, true, new THREE.Vector3(), AUCUNE_VISEE.eyeOffset, AUCUNE_VISEE.yaw, AUCUNE_VISEE.pitch),
    ).toBe(true);
    expect(session.playerHp).toBe(51);
    // Aucun délai de soulagement n'est posé par une gorgée — illimité.
    expect(session.sanitaireReliefCooldown).toBe(0);

    trySanitaire(session, true, new THREE.Vector3(), AUCUNE_VISEE.eyeOffset, AUCUNE_VISEE.yaw, AUCUNE_VISEE.pitch);
    trySanitaire(session, true, new THREE.Vector3(), AUCUNE_VISEE.eyeOffset, AUCUNE_VISEE.yaw, AUCUNE_VISEE.pitch);
    expect(session.playerHp).toBe(53);
  });

  it("sanitaire CASSÉ visé, PV déjà pleins : message dédié, aucun soin, appui quand même consommé", () => {
    const session = sessionDeTest({
      playerHp: 100,
      sanitaireSystem: fakeSanitaireSystem({ name: "sanitaire_a", kind: "urinoir", broken: true }) as never,
    });

    expect(
      trySanitaire(session, true, new THREE.Vector3(), AUCUNE_VISEE.eyeOffset, AUCUNE_VISEE.yaw, AUCUNE_VISEE.pitch),
    ).toBe(true);
    expect(session.playerHp).toBe(100);
    expect(useGameStore.getState().hudMessage).toBe("Vous êtes déjà en pleine forme.");
  });

  it("la portée déclarée (SANITAIRE_AIM_RANGE_METERS) vaut 1,4 m — volontairement plus court qu'un use_* générique", () => {
    expect(SANITAIRE_AIM_RANGE_METERS).toBe(1.4);
  });

  describe("le rayon de visée — dos tourné / à côté sans viser / cloison de cabine (plainte corrigée)", () => {
    it("rayon SANS obstacle : resolveAim reçoit worldHit = null", () => {
      scriptRaycast({ castRay: () => Effect.succeed(null) });
      const system = fakeSanitaireSystem(null);
      const session = sessionDeTest({ sanitaireSystem: system as never });

      trySanitaire(session, true, new THREE.Vector3(1, 0, 2), 1.6, 0, 0);

      expect(system.resolveAim).toHaveBeenCalledTimes(1);
      const args = system.resolveAim.mock.calls[0]!;
      expect(args[3]).toBeNull(); // worldHit
    });

    it("dos tourné à 1 m d'un sanitaire (rayon vers autre chose) : traduit fidèlement en worldHit, jamais un hit fabriqué", () => {
      // Le rayon touche un MUR (collider 999, à 3 m) — pas le sanitaire,
      // puisque le joueur regarde ailleurs. `trySanitaire` ne fait AUCUNE
      // hypothèse sur ce que ça veut dire : il transmet tel quel à
      // `resolveAim`, qui seul sait qu'un handle 999 n'est pas un sanitaire.
      scriptRaycast({ castRay: () => Effect.succeed(fakeHit(999, 3)) });
      const system = fakeSanitaireSystem(null); // un mur n'est jamais un sanitaire -> resolveAim répond null
      const session = sessionDeTest({ sanitaireSystem: system as never });

      const consumed = trySanitaire(session, true, new THREE.Vector3(1, 0, 2), 1.6, 0, 0);

      expect(consumed).toBe(false);
      const args = system.resolveAim.mock.calls[0]!;
      expect(args[3]).toEqual({ colliderHandle: 999, distance: 3 });
    });

    it("une cloison de cabine plus proche que le sanitaire visé : worldHit porte SA distance, pas celle du sanitaire derrière", () => {
      // La cloison (collider 42) est touchée à 0.6 m, avant tout sanitaire —
      // `resolveAim` (le VRAI, testé géométriquement ailleurs) refuserait ce
      // cas ; ici on vérifie seulement que `trySanitaire` transmet le hit le
      // plus proche du rayon SANS le réinterpréter lui-même.
      scriptRaycast({ castRay: () => Effect.succeed(fakeHit(42, 0.6)) });
      const system = fakeSanitaireSystem(null);
      const session = sessionDeTest({ sanitaireSystem: system as never });

      trySanitaire(session, true, new THREE.Vector3(0, 0, 0), 1.6, 0, 0);

      const args = system.resolveAim.mock.calls[0]!;
      expect(args[3]).toEqual({ colliderHandle: 42, distance: 0.6 });
    });

    it("œil et direction transmis à resolveAim = position + eyeOffset, et la portée déclarée", () => {
      const system = fakeSanitaireSystem(null);
      const session = sessionDeTest({ sanitaireSystem: system as never });
      const playerPosition = new THREE.Vector3(3, 0.6, -2);

      // yaw=0, pitch=0 : convention caméra/armes (Euler 'YXZ') -> visée droit devant, -z.
      trySanitaire(session, true, playerPosition, 1.6, 0, 0);

      const [eyeOrigin, direction, range] = system.resolveAim.mock.calls[0]!;
      expect(eyeOrigin.x).toBeCloseTo(3, 5);
      expect(eyeOrigin.y).toBeCloseTo(2.2, 5); // 0.6 + 1.6
      expect(eyeOrigin.z).toBeCloseTo(-2, 5);
      expect(direction.x).toBeCloseTo(0, 5);
      expect(direction.y).toBeCloseTo(0, 5);
      expect(direction.z).toBeCloseTo(-1, 5);
      expect(range).toBe(SANITAIRE_AIM_RANGE_METERS);
    });
  });
});
