import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { GameClock } from "../../../src/core/time";
import { emptyInputFrame } from "../../../src/core/inputRecorder";
import { WeaponSystem, type ViewmodelClocks } from "../../../src/game/player/weapons";

await initPhysics();

const DT = 1 / 60;
const EYE = new THREE.Vector3(0, 1.6, 0);

function lire(weapons: WeaponSystem): ViewmodelClocks {
  return weapons.viewmodelClocks(1, {
    active: "none",
    previous: "none",
    sinceSwitch: 0,
    sinceMeleeFire: 0,
    sincePistolFire: 0,
    sinceShotgunFire: 0,
  });
}

function pas(weapons: WeaponSystem, frame: Partial<ReturnType<typeof emptyInputFrame>> = {}) {
  weapons.snapshotPrevious();
  weapons.update(DT, { ...emptyInputFrame(), ...frame }, EYE, 0, 0);
}

describe("horloges du viewmodel dans WeaponSystem", () => {
  it("un tir de pompe remet son horloge à zéro, qui avance ensuite au pas fixe", () => {
    const weapons = new WeaponSystem(new PhysicsWorld(), new GameClock());
    weapons.activeWeapon = "shotgun";
    pas(weapons);

    pas(weapons, { fire: true });
    expect(lire(weapons).sinceShotgunFire).toBe(0);

    pas(weapons);
    expect(lire(weapons).sinceShotgunFire).toBeCloseTo(DT);
  });

  it("un changement d'arme par la touche est vu, avec l'arme quittée", () => {
    const weapons = new WeaponSystem(new PhysicsWorld(), new GameClock());
    pas(weapons, { switchToShotgun: true });
    const c = lire(weapons);
    expect(c).toMatchObject({ active: "shotgun", previous: "melee", sinceSwitch: 0 });
  });

  it("un ramassage depuis les mains nues est vu au pas suivant", () => {
    const weapons = new WeaponSystem(new PhysicsWorld(), new GameClock());
    weapons.startUnarmed();
    pas(weapons);
    weapons.pickUpMelee();
    pas(weapons);
    expect(lire(weapons)).toMatchObject({ active: "melee", previous: "none", sinceSwitch: 0 });
  });

  it("les horloges ne décident d'aucun tir : le pompe retire dès la fin du cooldown", () => {
    const weapons = new WeaponSystem(new PhysicsWorld(), new GameClock());
    weapons.activeWeapon = "shotgun";
    const ammo = weapons.shotgunAmmo;
    pas(weapons, { fire: true });
    const steps = Math.ceil(0.8 / DT);
    for (let i = 0; i < steps; i++) pas(weapons);
    pas(weapons, { fire: true });
    expect(weapons.shotgunAmmo).toBe(ammo - 2);
  });
});
