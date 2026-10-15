/**
 * Pistolet de détresse : possession, dotation, cadence, et la fusée elle-même —
 * la seule munition du jeu qui vole au lieu de toucher le pas où elle part.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { describe, expect, it } from "vitest";

import { emptyInputFrame } from "../../../../src/core/input/inputRecorder";
import { GameClock } from "../../../../src/core/loop/time";
import { weaponConfig } from "../../../../src/game/player/weapons/weaponConfig";
import { WeaponSystem } from "../../../../src/game/player/weapons/weapons";
import { COLLISION_GROUPS, initPhysics, PhysicsWorld } from "../../../../src/physics/world";

await initPhysics();

const DT = 1 / 60;
const EYE = new THREE.Vector3(0, 1.6, 0);

function unarmed(physics = new PhysicsWorld()): WeaponSystem {
  const weapons = new WeaponSystem(physics, new GameClock());
  weapons.startUnarmed();
  return weapons;
}

function step(weapons: WeaponSystem, frame: Partial<ReturnType<typeof emptyInputFrame>> = {}) {
  weapons.snapshotPrevious();
  weapons.update(DT, { ...emptyInputFrame(), ...frame }, EYE, 0, 0);
}

/** Un mur plein face au tir (visée par défaut : −Z), à `distance` mètres des yeux. */
function wallAhead(physics: PhysicsWorld, distance: number): RAPIER.Collider {
  const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 1.5, -distance - 0.1));
  const collider = physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(4, 3, 0.1).setCollisionGroups(COLLISION_GROUPS.WORLD),
    body,
  );
  physics.step(0);
  return collider;
}

describe("Pistolet de détresse — possession et munitions", () => {
  it("n'existe pas tant qu'il n'est pas ramassé : la touche 4 ne l'équipe pas", () => {
    const weapons = unarmed();

    step(weapons, { switchToFlare: true, fire: true });

    expect(weapons.activeWeapon).toBe("none");
    expect(weapons.flares).toHaveLength(0);
  });

  it("ramassé : équipé, avec sa dotation de fusées", () => {
    const weapons = unarmed();

    expect(weapons.tryCollectFlare()).toBe(true);

    expect(weapons.activeWeapon).toBe("flare");
    expect(weapons.owns("flare")).toBe(true);
    expect(weapons.flareAmmo).toBe(weaponConfig.flareStartingAmmo);
  });

  it("un second vaut sa dotation, et reste au sol une fois le plafond atteint", () => {
    const weapons = unarmed();
    weapons.pickUpFlare();
    weapons.flareAmmo = 1;

    expect(weapons.tryCollectFlare()).toBe(true);
    expect(weapons.flareAmmo).toBe(1 + weaponConfig.flareStartingAmmo);

    weapons.addFlareAmmo(weaponConfig.flareMaxAmmo);
    expect(weapons.flareAmmo).toBe(weaponConfig.flareMaxAmmo);
    expect(weapons.tryCollectFlare()).toBe(false);
  });

  it("la touche 4 y revient depuis une autre arme", () => {
    const weapons = unarmed();
    weapons.pickUpFlare();
    weapons.pickUpMelee();

    step(weapons, { switchToFlare: true });

    expect(weapons.activeWeapon).toBe("flare");
  });

  it("l'inventaire garde les fusées, et une sauvegarde qui n'en parle pas en donne zéro", () => {
    const weapons = unarmed();
    weapons.pickUpFlare();
    const inventory = weapons.inventory();
    expect(inventory.owned).toContain("flare");
    expect(inventory.flareAmmo).toBe(weaponConfig.flareStartingAmmo);

    const restored = unarmed();
    restored.restoreInventory(inventory);
    expect(restored.owns("flare")).toBe(true);
    expect(restored.flareAmmo).toBe(weaponConfig.flareStartingAmmo);

    const older = unarmed();
    older.restoreInventory({ owned: ["melee"], active: "melee", pistolAmmo: 0, shotgunAmmo: 0 });
    expect(older.owns("flare")).toBe(false);
    expect(older.flareAmmo).toBe(0);
  });
});

describe("Pistolet de détresse — tir", () => {
  it("tirer consomme une fusée, la lance, et respecte la cadence", () => {
    const weapons = unarmed();
    weapons.pickUpFlare();
    const start = weapons.flareAmmo;

    step(weapons, { fire: true });
    expect(weapons.flareAmmo).toBe(start - 1);
    expect(weapons.fireEvents.map((e) => e.weapon)).toEqual(["flare"]);
    expect(weapons.flares).toHaveLength(1);

    step(weapons, { fire: true });
    expect(weapons.flareAmmo).toBe(start - 1);

    for (let i = 0; i < Math.ceil(weaponConfig.flareCooldown / DT); i++) step(weapons);
    step(weapons, { fire: true });
    expect(weapons.flareAmmo).toBe(start - 2);
    expect(weapons.flares).toHaveLength(2);
  });

  it("à sec : rien ne part", () => {
    const weapons = unarmed();
    weapons.pickUpFlare();
    weapons.flareAmmo = 0;

    step(weapons, { fire: true });

    expect(weapons.fireEvents).toHaveLength(0);
    expect(weapons.flares).toHaveLength(0);
  });

  it("le tir n'attend pas la fin du changement d'arme (invariant #10)", () => {
    const weapons = unarmed();
    weapons.pickUpMelee();
    weapons.pickUpFlare();
    weapons.pickUpMelee();

    step(weapons, { switchToFlare: true, fire: true });

    expect(weapons.fireEvents.map((e) => e.weapon)).toEqual(["flare"]);
  });
});

describe("Pistolet de détresse — vol de la fusée", () => {
  it("part des yeux, avance à sa vitesse et retombe peu à peu", () => {
    const weapons = unarmed();
    weapons.pickUpFlare();
    step(weapons, { fire: true });
    const flare = weapons.flares[0];
    expect(flare.position.toArray()).toEqual(EYE.toArray());

    step(weapons);
    expect(flare.previousPosition.toArray()).toEqual(EYE.toArray());
    expect(flare.position.z).toBeCloseTo(-weaponConfig.flareSpeed * DT, 5);
    expect(flare.position.y).toBeLessThan(EYE.y);

    for (let i = 0; i < 30; i++) step(weapons);
    expect(flare.position.z).toBeCloseTo(-weaponConfig.flareSpeed * DT * 31, 3);
    // Chute libre sous `flareGravity`, intégrée au pas fixe.
    expect(EYE.y - flare.position.y).toBeCloseTo(0.5 * weaponConfig.flareGravity * (31 * DT) ** 2, 1);
  });

  it("sans rien toucher, elle éclate en l'air en fin de course — une seule fois", () => {
    const weapons = unarmed();
    weapons.pickUpFlare();
    step(weapons, { fire: true });

    for (let i = 0; i < Math.ceil(weaponConfig.flareLifetime / DT) + 1; i++) step(weapons);

    expect(weapons.flares).toHaveLength(0);
    expect(weapons.hitEvents).toHaveLength(0);
    expect(weapons.flareDetonations).toHaveLength(1);
    expect(weapons.takeNewFlareDetonations()).toHaveLength(1);
    expect(weapons.takeNewFlareDetonations()).toHaveLength(0);
  });

  it("contre un mur : un impact sur ce mur, et un souffle centré juste devant", () => {
    const physics = new PhysicsWorld();
    const wall = wallAhead(physics, 6);
    const weapons = unarmed(physics);
    weapons.pickUpFlare();
    step(weapons, { fire: true });

    let steps = 0;
    while (weapons.flares.length > 0 && steps < 120) {
      step(weapons);
      steps++;
    }

    // 6 m à 34 m/s : la fusée met plus d'un pas à arriver, elle ne touche pas à l'instant du tir.
    expect(steps).toBe(Math.ceil(6 / (weaponConfig.flareSpeed * DT)));
    expect(weapons.hitEvents).toHaveLength(1);
    const hit = weapons.hitEvents[0];
    expect(hit.weapon).toBe("flare");
    expect(hit.colliderHandle).toBe(wall.handle);
    expect(hit.point.z).toBeCloseTo(-6, 3);
    expect(hit.distance).toBeCloseTo(6, 1);
    const [detonation] = weapons.takeNewFlareDetonations();
    expect(detonation.point.z).toBeGreaterThan(-6);
    expect(detonation.point.z).toBeCloseTo(-5.85, 2);
  });

  it("deux parties identiques font éclater la fusée au même pas, au même point", () => {
    const run = () => {
      const physics = new PhysicsWorld();
      wallAhead(physics, 11.3);
      const weapons = unarmed(physics);
      weapons.pickUpFlare();
      weapons.snapshotPrevious();
      weapons.update(DT, { ...emptyInputFrame(), fire: true }, EYE, 0.31, 0.12);
      let steps = 0;
      while (weapons.flares.length > 0 && steps < 300) {
        step(weapons);
        steps++;
      }
      return { steps, point: weapons.takeNewFlareDetonations()[0].point.toArray() };
    };

    expect(run()).toEqual(run());
  });

  it("une image sans lecteur ne perd pas le souffle : `clearFrameEvents` ne vide pas la file du pas fixe", () => {
    const weapons = unarmed();
    weapons.pickUpFlare();
    step(weapons, { fire: true });
    for (let i = 0; i < Math.ceil(weaponConfig.flareLifetime / DT) + 1; i++) step(weapons);

    weapons.clearFrameEvents();

    expect(weapons.flareDetonations).toHaveLength(0);
    expect(weapons.takeNewFlareDetonations()).toHaveLength(1);
  });
});
