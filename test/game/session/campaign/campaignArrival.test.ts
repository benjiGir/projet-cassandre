/**
 * Équipement d'arrivée au métro : ce que la fin du magasin relève de la
 * partie, ce que le métro en restitue, et les trois profils de départ direct.
 * Tout ce que ce module fabrique doit rester une sauvegarde valide.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameClock } from "../../../../src/core/loop/time";
import { HEAL_PICKUP_RADIUS } from "../../../../src/game/level/interactions/interactive";
import { perkConfig } from "../../../../src/game/player/perkConfig";
import { weaponConfig } from "../../../../src/game/player/weapons/weaponConfig";
import { WeaponSystem } from "../../../../src/game/player/weapons/weapons";
import {
  applyArrival,
  captureArrival,
  freezeArrival,
  metroArrival,
} from "../../../../src/game/session/campaign/campaignArrival";
import type { CampaignArrival } from "../../../../src/game/session/campaign/campaignTypes";
import type { GameSession } from "../../../../src/game/session/gameSession";
import { INITIAL_PLAYER_MAX_HP } from "../../../../src/game/session/player/playerState";
import { HeroPortrait } from "../../../../src/game/session/presentation/heroPortrait";
import { DIFFICULTIES, type Difficulty } from "../../../../src/game/session/progression/difficulty";
import { createStreamState } from "../../../../src/game/session/stream/streamSim";
import { initPhysics, PhysicsWorld } from "../../../../src/physics/world";

await initPhysics();

const PROFILS = ["type", "pauvre", "riche"] as const;

/** Une partie neuve, réduite à ce que l'arrivée lit et écrit. */
function partie(difficulty: Difficulty = "habitue"): GameSession {
  return {
    weapons: new WeaponSystem(new PhysicsWorld(), new GameClock()),
    suitManager: { sightRangeScale: 1 },
    heroPortrait: new HeroPortrait(),
    difficulty,
    run: {
      perks: new Set(),
      stream: createStreamState(),
      playerHp: INITIAL_PLAYER_MAX_HP,
      playerMaxHp: INITIAL_PLAYER_MAX_HP,
      pickupRadius: HEAL_PICKUP_RADIUS,
    },
  } as unknown as GameSession;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("freezeArrival", () => {
  it("fige l'arrivée en profondeur sans toucher à l'objet d'origine", () => {
    const origine: CampaignArrival = {
      weapons: { owned: ["melee"], active: "melee", pistolAmmo: 0, shotgunAmmo: 0 },
      perks: ["aimant"],
      wallet: 3,
      hp: 80,
      difficulty: "client",
    };

    const figee = freezeArrival(origine);

    expect(figee).toEqual(origine);
    expect(figee).not.toBe(origine);
    expect(Object.isFrozen(figee.weapons.owned)).toBe(true);
    expect(Object.isFrozen(figee.perks)).toBe(true);
    expect(Object.isFrozen(origine)).toBe(false);
    expect(Object.isFrozen(origine.weapons.owned)).toBe(false);
  });
});

describe("captureArrival / applyArrival — du magasin au métro", () => {
  it("relève les armes, les perks, la cagnotte, les PV et la difficulté de la partie", () => {
    const session = partie("lanceur");
    session.weapons.startUnarmed();
    session.weapons.pickUpMelee();
    session.weapons.pickUpPistol();
    session.run.perks.add("vpn");
    session.run.stream.wallet = 64;
    session.run.playerHp = 41;

    expect(captureArrival(session)).toEqual({
      weapons: {
        owned: ["melee", "pistol"],
        active: "pistol",
        pistolAmmo: weaponConfig.pistolStartingAmmo,
        shotgunAmmo: session.weapons.shotgunAmmo,
      },
      perks: ["vpn"],
      wallet: 64,
      hp: 41,
      difficulty: "lanceur",
    });
  });

  it("l'arrivée relevée ne suit plus la partie qui continue", () => {
    const session = partie();
    session.run.stream.wallet = 10;

    const arrival = captureArrival(session);
    session.run.stream.wallet = 500;
    session.run.perks.add("gilet");
    session.weapons.pickUpPistol();

    expect(arrival.wallet).toBe(10);
    expect(arrival.perks).toEqual([]);
    expect(arrival.weapons.owned).not.toContain("pistol");
  });

  it.each(PROFILS)("profil « %s » : appliqué à une partie neuve puis relevé, il revient à l'identique", (profil) => {
    const arrival = metroArrival("habitue", profil);
    const session = partie();

    applyArrival(session, arrival);

    expect(captureArrival(session)).toEqual(arrival);
  });

  it("restitue l'effet des perks, pas seulement leur nom", () => {
    const session = partie();

    applyArrival(session, metroArrival("habitue", "riche"));

    expect(session.run.playerMaxHp).toBe(INITIAL_PLAYER_MAX_HP + perkConfig.giletMaxHpBonus);
    expect(session.weapons.pistolMaxAmmo).toBe(weaponConfig.pistolMaxAmmo + perkConfig.premiumPistolAmmoBonus);
    expect(session.weapons.meleeDamageScale).toBe(perkConfig.percheMeleeDamageScale);
    expect(session.run.pickupRadius).toBe(perkConfig.aimantPickupRadius);
  });

  it("les PV d'arrivée font foi : le gilet relève le maximum sans rendre de vie", () => {
    const session = partie();
    const blesse: CampaignArrival = { ...metroArrival("habitue", "riche"), hp: 30 };

    applyArrival(session, blesse);

    expect(session.run.playerHp).toBe(30);
    expect(session.run.playerMaxHp).toBe(INITIAL_PLAYER_MAX_HP + perkConfig.giletMaxHpBonus);
  });

  it("arriver sans arme laisse le joueur sans arme, même si la partie neuve en avait", () => {
    const session = partie();
    const mainsVides: CampaignArrival = {
      ...metroArrival("habitue", "pauvre"),
      weapons: { owned: [], active: "none", pistolAmmo: 0, shotgunAmmo: 0 },
    };

    applyArrival(session, mainsVides);

    expect(session.weapons.owns("melee")).toBe(false);
    expect(session.weapons.owns("shotgun")).toBe(false);
    expect(session.weapons.inventory()).toEqual(mainsVides.weapons);
  });
});

describe("metroArrival — départ direct au métro", () => {
  it("le profil pauvre arrive démuni, le riche arrive plein", () => {
    const pauvre = metroArrival("habitue", "pauvre");
    const type = metroArrival("habitue");
    const riche = metroArrival("habitue", "riche");

    expect(pauvre).toMatchObject({ perks: [], wallet: 0, hp: 20 });
    expect(pauvre.weapons.owned).toEqual(["melee", "pistol"]);
    expect(riche.weapons.pistolAmmo).toBe(weaponConfig.pistolMaxAmmo + perkConfig.premiumPistolAmmoBonus);
    expect(riche.weapons.shotgunAmmo).toBe(weaponConfig.shotgunMaxAmmo);
    expect(riche.hp).toBe(INITIAL_PLAYER_MAX_HP + perkConfig.giletMaxHpBonus);
    for (const champ of ["wallet", "hp"] as const) {
      expect(pauvre[champ]).toBeLessThan(type[champ]);
      expect(type[champ]).toBeLessThanOrEqual(riche[champ]);
    }
    expect(type.perks.length).toBeLessThan(riche.perks.length);
  });

  it("garde la difficulté demandée", () => {
    for (const difficulty of DIFFICULTIES) expect(metroArrival(difficulty).difficulty).toBe(difficulty);
  });

  it.each(DIFFICULTIES.flatMap((difficulty) => PROFILS.map((profil) => [difficulty, profil] as const)))(
    "%s / %s est une sauvegarde valide : écrite puis relue dans un onglet neuf",
    async (difficulty, profil) => {
      const items = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => void items.set(key, value),
      });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const arrival = metroArrival(difficulty, profil);

      vi.resetModules();
      const ecriture = await import("../../../../src/game/session/campaign/campaignStorage");
      ecriture.queueCampaignSave(arrival);
      ecriture.flushCampaignSave();
      vi.resetModules();
      const lecture = await import("../../../../src/game/session/campaign/campaignStorage");

      expect(lecture.campaignArrival()).toEqual(arrival);
      expect(warn).not.toHaveBeenCalled();
    },
  );
});
