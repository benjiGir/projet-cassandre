/**
 * Jalon M6 (PLAN_EFFECT_XSTATE.md, §8) — test d'intégration hors navigateur
 * remplaçant l'extraction de `updateGameplay` hors de `main.ts` (voir la
 * réduction de périmètre notée en tête du §8 du plan) : construit de VRAIES
 * instances `WeaponSystem`/`SuitManager`/`Suit` contre un vrai (petit) monde
 * Rapier, et vérifie qu'un tir résout un dégât et qu'un changement d'état de
 * machine se propage — la même preuve que demande le plan, sans avoir besoin
 * de toucher à la structure de `main.ts`. Chaque étape de cette chaîne
 * (`WeaponSystem.update` → `SuitManager.update` → `Suit.applyDamage`) passe
 * déjà par `runGameplaySync(RaycastService.use(...))` en interne (jalon M3) —
 * si l'un de ces appels suspendait, `runGameplaySync` lèverait une exception
 * et ce test échouerait tel quel, sans assertion dédiée nécessaire.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { GameClock } from "../../../src/core/time";
import { emptyInputFrame } from "../../../src/core/inputRecorder";
import { WeaponSystem } from "../../../src/game/player/weapons";
import { SuitManager } from "../../../src/game/entities/suitManager";

await initPhysics();

describe("pas fixe intégré : tir -> dégât -> changement d'état (jalon M6)", () => {
  it("un coup de pied-de-biche sur un Costard à portée applique un dégât et fait transitionner son état", () => {
    const physics = new PhysicsWorld();
    const clock = new GameClock();
    const weapons = new WeaponSystem(physics, clock);
    const suitManager = new SuitManager(physics);

    // Pieds à (0, 0, -1) : à portée du pied-de-biche (meleeRange: 2m) depuis
    // un joueur regardant droit devant lui (yaw=0, pitch=0 -> aimForward
    // (0,0,-1), voir `WeaponSystem.computeAimBasis`) à hauteur des yeux 1.6m.
    const suit = suitManager.spawnSuit(0, 0, -1);
    const suitMaxHp = suit.hp;
    expect(suit.state).toBe("idle");

    // Piège Rapier déjà documenté (M3/M4, `test/physics/raycast.test.ts`) :
    // un monde fraîchement construit avec un collider tout juste créé ne
    // renvoie AUCUN hit de raycast/requête de forme tant qu'un `world.step()`
    // n'a pas été appelé au moins une fois (broad-phase pas encore peuplée).
    physics.step(0);

    const eyeOrigin = new THREE.Vector3(0, 1.6, 0);
    const fireFrame = { ...emptyInputFrame(), fire: true };
    const gameplayDt = clock.tick(1 / 60);

    // `WeaponSystem` démarre équipée du pied-de-biche par défaut
    // (`hasMelee`/`activeWeapon: "melee"`, voir sa doc de tête) — aucun
    // ramassage à simuler pour ce test.
    weapons.update(gameplayDt, fireFrame, eyeOrigin, 0, 0);
    expect(weapons.hitEvents.length).toBeGreaterThan(0);

    const playerTargetPosition = new THREE.Vector3(0, 0, 0);
    suitManager.update(gameplayDt, playerTargetPosition, eyeOrigin, weapons.hitEvents);

    expect(suit.hp).toBeLessThan(suitMaxHp);
    // 40 dégâts de pied-de-biche (`weaponConfig.meleeDamage`) contre 50 PV
    // (`suitConfig.maxHp`) : non fatal -> `stagger`, la transition d'état
    // déclenchée directement par `applyDamage` (précondition documentée :
    // `SuitManager` n'appelle pas `Suit.update()` le même pas fixe).
    expect(suit.state).toBe("stagger");
  });
});
