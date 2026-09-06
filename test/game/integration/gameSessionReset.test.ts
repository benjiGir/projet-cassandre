/**
 * Jalon M8 (PLAN_EFFECT_XSTATE.md, §10) — test d'intégration hors navigateur
 * pour le mécanisme de RESET lui-même (`main.ts::bootGameSession`/
 * `teardownGameSession`).
 *
 * `bootGameSession`/`teardownGameSession` sont des fonctions imbriquées dans
 * `main()` (`src/main.ts`), fermées sur `scene`/`clock`/les atlas de sprite
 * partagés — les exporter proprement pour les tester directement demanderait
 * une extraction disproportionnée pour ce jalon (même réduction de périmètre
 * que M6 pour `updateGameplay`, voir sa doc dans `main.ts`). Ce test vérifie
 * donc directement la PARTIE la plus risquée de ce qu'elles font — construire
 * un `PhysicsWorld` (et les systèmes qui en dépendent), le LIBÉRER
 * (`world.free()`), puis en reconstruire un second — sans passer par
 * `main.ts` ni par Three.js/le DOM (`WeaponSystem`/`SuitManager`/
 * `DirectorManager`/`PlayerController` n'ont aucune dépendance Three.js hors
 * du rendu, qui n'est pas exercé ici).
 *
 * Preuve recherchée : `physics.world.free()` puis la construction d'un TOUT
 * NOUVEAU monde ne lève aucune exception, et le nouveau monde fonctionne de
 * façon totalement indépendante de l'ancien (un Costard qui encaisse un coup
 * dans la seconde "session" ne voit pas fuiter d'état de la première) — la
 * même propriété dont dépend "Rejouer"/"Retour au menu" en jeu.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { GameClock } from "../../../src/core/time";
import { emptyInputFrame } from "../../../src/core/inputRecorder";
import { PlayerController } from "../../../src/game/player/controller";
import { WeaponSystem } from "../../../src/game/player/weapons";
import { SuitManager } from "../../../src/game/entities/suitManager";
import { DirectorManager } from "../../../src/game/entities/directorManager";

await initPhysics();

/** Construit une "session" minimale (mêmes systèmes que `bootGameSession`, moins Three.js/le niveau) et l'exerce une fois — reproduit la séquence réelle d'une partie sans dépendre de `main.ts`. */
function buildAndExerciseSession(clock: GameClock) {
  const physics = new PhysicsWorld();
  const player = new PlayerController(physics);
  player.spawn(0, 0, 0);

  const weapons = new WeaponSystem(physics, clock);
  const suitManager = new SuitManager(physics);
  const directorManager = new DirectorManager(physics);

  const suit = suitManager.spawnSuit(0, 0, -1);
  physics.step(0); // même piège Rapier documenté ailleurs : broad-phase pas peuplée avant un premier step.

  const eyeOrigin = new THREE.Vector3(0, 1.6, 0);
  const fireFrame = { ...emptyInputFrame(), fire: true };
  const gameplayDt = clock.tick(1 / 60);
  weapons.update(gameplayDt, fireFrame, eyeOrigin, 0, 0);
  suitManager.update(gameplayDt, new THREE.Vector3(0, 0, 0), eyeOrigin, weapons.hitEvents);

  return { physics, player, weapons, suitManager, directorManager, suit };
}

describe("reset de partie (jalon M8) : construire -> libérer -> reconstruire un PhysicsWorld", () => {
  it("libérer un monde puis en construire un second n'exécute aucune exception, et le second fonctionne indépendamment du premier", () => {
    const clock = new GameClock();

    const first = buildAndExerciseSession(clock);
    expect(first.suit.hp).toBeLessThan(50); // dégât du pied-de-biche bien appliqué dans la 1re session

    // `teardownGameSession` : `physics.world.free()` EN DERNIER, après tout
    // retrait Three.js/dispose applicatif (non pertinent ici, aucune scène) —
    // voir sa doc dans `main.ts`. Aucune exception attendue.
    expect(() => first.physics.world.free()).not.toThrow();

    // `bootGameSession` : reconstruction complète, comme si c'était le tout
    // premier boot — même fonction, pas de cas spécial "après un reset".
    let second: ReturnType<typeof buildAndExerciseSession>;
    expect(() => {
      second = buildAndExerciseSession(clock);
    }).not.toThrow();

    // Indépendance totale : le nouveau Costard démarre à PV pleins (50, voir
    // `suitConfig.maxHp`) malgré le coup encaissé par l'ancien juste avant —
    // aucun état ne fuite entre les deux mondes Rapier.
    expect(second!.suit.hp).toBeLessThan(50); // touché par le tir de CETTE session...
    expect(second!.suit.hp).toBe(first.suit.hp); // ...avec EXACTEMENT le même dégât que la 1re, donc bien reparti d'un état neuf (pas cumulé).

    expect(() => second!.physics.world.free()).not.toThrow();
  });
});
