/**
 * Ramassage AUTOMATIQUE des armes au sol (`WeaponSystem.tryCollectMelee`/
 * `tryCollectShotgun`/`tryCollectPistol`), voir `interactive.ts::collectWeapons`
 * pour le câblage `use_*` -> ces méthodes. Couvre la décision « déjà
 * possédée » à la Duke : le pied-de-biche et le pompe n'ont rien à offrir à
 * un second ramassage (`false`, reste au sol), le pistolet se comporte alors
 * comme une boîte de munitions (`true` sauf au plafond).
 */
import { describe, expect, it } from "vitest";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { GameClock } from "../../../src/core/time";
import { WeaponSystem } from "../../../src/game/player/weapons";
import { weaponConfig } from "../../../src/game/player/weaponConfig";

await initPhysics();

function armes(): WeaponSystem {
  const weapons = new WeaponSystem(new PhysicsWorld(), new GameClock());
  weapons.startUnarmed();
  return weapons;
}

describe("WeaponSystem.tryCollectMelee", () => {
  it("pas encore possédé : ramasse et équipe", () => {
    const weapons = armes();

    expect(weapons.tryCollectMelee()).toBe(true);
    expect(weapons.activeWeapon).toBe("melee");
  });

  it("déjà possédé : rien à offrir, reste au sol", () => {
    const weapons = armes();
    weapons.pickUpMelee();
    weapons.activeWeapon = "none"; // pour vérifier que rien ne le rééquipe

    expect(weapons.tryCollectMelee()).toBe(false);
    expect(weapons.activeWeapon).toBe("none");
  });
});

describe("WeaponSystem.tryCollectShotgun", () => {
  it("pas encore possédé : ramasse et équipe", () => {
    const weapons = armes();

    expect(weapons.tryCollectShotgun()).toBe(true);
    expect(weapons.activeWeapon).toBe("shotgun");
  });

  it("déjà possédé : le pompe garde sa dotation unique, rien à offrir, reste au sol", () => {
    const weapons = armes();
    weapons.pickUpShotgun();
    const ammoAvant = weapons.shotgunAmmo;
    weapons.activeWeapon = "none";

    expect(weapons.tryCollectShotgun()).toBe(false);
    expect(weapons.activeWeapon).toBe("none");
    expect(weapons.shotgunAmmo).toBe(ammoAvant); // aucune munition ajoutée
  });
});

describe("WeaponSystem.tryCollectPistol — seule arme qui peut rendre `true` deux fois", () => {
  it("pas encore possédé : ramasse, équipe, dotation de départ", () => {
    const weapons = armes();

    expect(weapons.hasPistolAlready).toBe(false);
    expect(weapons.tryCollectPistol()).toBe(true);
    expect(weapons.activeWeapon).toBe("pistol");
    expect(weapons.pistolAmmo).toBe(weaponConfig.pistolStartingAmmo);
  });

  it("déjà possédé, sous le plafond : se comporte comme une boîte de munitions", () => {
    const weapons = armes();
    weapons.pickUpPistol();
    weapons.pistolAmmo = 10; // loin du plafond après quelques tirs
    expect(weapons.hasPistolAlready).toBe(true);

    expect(weapons.tryCollectPistol()).toBe(true);
    expect(weapons.pistolAmmo).toBe(10 + weaponConfig.pistolStartingAmmo);
  });

  it("déjà possédé, au plafond : rien à ajouter, reste au sol", () => {
    const weapons = armes();
    weapons.pickUpPistol();
    weapons.pistolAmmo = weaponConfig.pistolMaxAmmo;

    expect(weapons.tryCollectPistol()).toBe(false);
    expect(weapons.pistolAmmo).toBe(weaponConfig.pistolMaxAmmo);
  });
});
