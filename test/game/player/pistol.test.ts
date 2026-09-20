/**
 * Pistolet (2026-09-16) : possession, dotation, cadence et plafond de
 * munitions. Le tir lui-même passe par un vrai `PhysicsWorld` vide — aucun
 * collider, donc aucun impact : ce qui est vérifié ici, c'est la MÉCANIQUE
 * (l'arme part, consomme une balle, respecte sa cadence), pas la balistique.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { GameClock } from "../../../src/core/time";
import { emptyInputFrame } from "../../../src/core/inputRecorder";
import { WeaponSystem } from "../../../src/game/player/weapons";
import { weaponConfig } from "../../../src/game/player/weaponConfig";

await initPhysics();

const DT = 1 / 60;
const EYE = new THREE.Vector3(0, 1.6, 0);

function armes(): WeaponSystem {
  const weapons = new WeaponSystem(new PhysicsWorld(), new GameClock());
  weapons.startUnarmed();
  return weapons;
}

function pas(weapons: WeaponSystem, frame: Partial<ReturnType<typeof emptyInputFrame>> = {}) {
  weapons.snapshotPrevious();
  weapons.update(DT, { ...emptyInputFrame(), ...frame }, EYE, 0, 0);
}

describe("Pistolet", () => {
  it("n'existe pas tant qu'il n'est pas ramassé : la touche 2 ne l'équipe pas", () => {
    const weapons = armes();

    pas(weapons, { switchToPistol: true, fire: true });

    expect(weapons.activeWeapon).toBe("none");
    expect(weapons.pistolAmmo).toBe(0);
  });

  it("ramassé : équipé, avec sa dotation de départ", () => {
    const weapons = armes();

    weapons.pickUpPistol();

    expect(weapons.activeWeapon).toBe("pistol");
    expect(weapons.pistolAmmo).toBe(weaponConfig.pistolStartingAmmo);
  });

  it("un second ramassage ne recharge pas — sinon un hot reload donnerait des munitions gratuites", () => {
    const weapons = armes();
    weapons.pickUpPistol();
    weapons.addPistolAmmo(-0); // no-op explicite
    for (let i = 0; i < 3; i++) pas(weapons, { fire: true, yaw: 0, pitch: 0 });
    const apresTirs = weapons.pistolAmmo;

    weapons.pickUpPistol();

    expect(weapons.pistolAmmo).toBe(apresTirs);
  });

  it("tirer consomme une balle et respecte la cadence", () => {
    const weapons = armes();
    weapons.pickUpPistol();
    const depart = weapons.pistolAmmo;

    pas(weapons, { fire: true });
    expect(weapons.pistolAmmo).toBe(depart - 1);
    expect(weapons.fireEvents.map((e) => e.weapon)).toEqual(["pistol"]);

    // Deuxième appui tout de suite : la cadence n'est pas écoulée.
    pas(weapons, { fire: true });
    expect(weapons.pistolAmmo).toBe(depart - 1);

    // Après le cooldown, il repart.
    const pasNecessaires = Math.ceil(weaponConfig.pistolCooldown / DT);
    for (let i = 0; i < pasNecessaires; i++) pas(weapons);
    pas(weapons, { fire: true });
    expect(weapons.pistolAmmo).toBe(depart - 2);
  });

  it("à sec : le clic ne fait rien, pas d'événement de tir", () => {
    const weapons = armes();
    weapons.pickUpPistol();
    weapons.addPistolAmmo(-weapons.pistolAmmo); // vidé
    weapons.clearFrameEvents();

    pas(weapons, { fire: true });

    expect(weapons.pistolAmmo).toBe(0);
    expect(weapons.fireEvents.length).toBe(0);
  });

  it("une boîte de munitions s'arrête au plafond, et retourne ce qu'elle a vraiment donné", () => {
    const weapons = armes();
    weapons.pickUpPistol();

    expect(weapons.addPistolAmmo(24)).toBe(24);

    const manquantes = weaponConfig.pistolMaxAmmo - weapons.pistolAmmo;
    expect(weapons.addPistolAmmo(manquantes + 50)).toBe(manquantes);
    expect(weapons.pistolAmmo).toBe(weaponConfig.pistolMaxAmmo);
    expect(weapons.addPistolAmmo(24)).toBe(0);
  });
});
