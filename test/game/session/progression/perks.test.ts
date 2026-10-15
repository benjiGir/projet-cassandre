/**
 * Bornes et perks (lots B1 et B2) : l'achat (solde, achat unique, borne
 * épuisée), ce que le joueur en voit, l'invite publiée au HUD seulement quand
 * elle change, et l'effet de chaque perk — posé sur la partie, jamais sur une
 * config globale.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { emptyInputFrame } from "../../../../src/core/input/inputRecorder";
import { GameClock } from "../../../../src/core/loop/time";
import { suitConfig } from "../../../../src/game/entities/suit/suitConfig";
import { useGameStore } from "../../../../src/game/hud/state";
import { HEAL_PICKUP_RADIUS, InteractionSystem } from "../../../../src/game/level/interactions/interactive";
import type { UseObject } from "../../../../src/game/level/loading/levelTypes";
import { PlayerController } from "../../../../src/game/player/movement/controller";
import { moveConfig } from "../../../../src/game/player/movement/moveConfig";
import { kioskConfig } from "../../../../src/game/player/kioskOffer";
import { BOISSON_VARIANTS, perkConfig } from "../../../../src/game/player/perkConfig";
import { PERKS, type PerkOffer } from "../../../../src/game/player/perks";
import { damageForHit, weaponConfig } from "../../../../src/game/player/weapons/weaponConfig";
import { WeaponSystem } from "../../../../src/game/player/weapons/weapons";
import type { GameSession } from "../../../../src/game/session/gameSession";
import { HeroPortrait } from "../../../../src/game/session/presentation/heroPortrait";
import {
  buyPerk,
  grantPerk,
  publishPerkOffer,
  startKillRush,
  updateKillRush,
  usePerkKiosk,
} from "../../../../src/game/session/progression/perks";
import { createInitialStats } from "../../../../src/game/session/progression/score";
import { createStreamState, streamRecap } from "../../../../src/game/session/stream/streamSim";
import { COLLISION_GROUPS, initPhysics, PhysicsWorld } from "../../../../src/physics/world";

vi.mock("../../../../src/core/audio/audio", () => ({ playSfx: vi.fn(), playHeroVoice: vi.fn(() => false) }));

await initPhysics();

const DT = 1 / 60;
const GILET: PerkOffer = { perk: "gilet", price: 100 };
const PERCHE: PerkOffer = { perk: "perche", price: 5 };

const GLOBALES = JSON.stringify({ moveConfig, weaponConfig, suitConfig });

/** Une partie réduite à ce que les perks touchent, avec de vraies armes et un vrai joueur. */
function sessionAvec(solde: number): GameSession {
  const physics = new PhysicsWorld();
  const stream = createStreamState();
  stream.wallet = solde;
  stream.donated = solde;
  return {
    physics,
    player: new PlayerController(physics),
    weapons: new WeaponSystem(physics, new GameClock()),
    suitManager: { sightRangeScale: 1 },
    heroPortrait: new HeroPortrait(),
    run: {
      perks: new Set(),
      stream,
      playerHp: 60,
      playerMaxHp: 100,
      pickupRadius: HEAL_PICKUP_RADIUS,
      killRushRemaining: 0,
      lastHeroLineAt: -Infinity,
      lastHeroBarkAt: -Infinity,
      heroLinesSaid: new Set(),
      heroLineRandom: () => 0.99,
      stats: createInitialStats(),
    },
  } as unknown as GameSession;
}

function borne(offer: PerkOffer | null): UseObject {
  return { name: "use_borne_test", object: new THREE.Object3D(), sells: offer } as unknown as UseObject;
}

beforeEach(() => {
  useGameStore.getState().resetGameStore();
});

describe("buyPerk — achat à une borne", () => {
  it("solde suffisant : le prix est débité et le perk rangé dans la partie", () => {
    const session = sessionAvec(120);

    expect(buyPerk(session.run, GILET)).toBe("achete");

    expect(session.run.stream.wallet).toBe(20);
    expect([...session.run.perks]).toEqual(["gilet"]);
  });

  it("solde insuffisant : rien n'est débité, rien n'est acquis, et l'essai reste rejouable", () => {
    const session = sessionAvec(99);

    expect(buyPerk(session.run, GILET)).toBe("solde_insuffisant");
    expect(session.run.stream.wallet).toBe(99);
    expect(session.run.perks.size).toBe(0);

    session.run.stream.wallet += 1;
    expect(buyPerk(session.run, GILET)).toBe("achete");
  });

  it("achat unique : la borne est épuisée, un second appui ne débite plus", () => {
    const session = sessionAvec(500);
    buyPerk(session.run, GILET);

    expect(buyPerk(session.run, GILET)).toBe("epuisee");

    expect(session.run.stream.wallet).toBe(400);
    expect(session.run.perks.size).toBe(1);
  });

  it("le bilan de fin garde le total des dons reçus, achats non déduits", () => {
    const session = sessionAvec(120);

    buyPerk(session.run, GILET);

    expect(streamRecap(session.run.stream).donations).toBe(120);
  });
});

describe("usePerkKiosk — ce que le joueur voit", () => {
  it("achat : le solde du HUD suit, un message annonce le prix payé, le héros lit la pub, l'effet est posé", () => {
    const session = sessionAvec(120);

    expect(usePerkKiosk(session, GILET)).toBe("achete");

    expect(useGameStore.getState().debug.wallet).toBe(20);
    expect(useGameStore.getState().hudMessage).toBe("Gilet Alu-Tactique : −100 €");
    expect(session.run.heroLinesSaid.has("pub_gilet")).toBe(true);
    expect(session.run.playerMaxHp).toBe(100 + perkConfig.giletMaxHpBonus);
  });

  it("solde insuffisant : un message dit ce qui manque, le héros le commente, aucun effet n'est posé", () => {
    const session = sessionAvec(3);

    expect(usePerkKiosk(session, PERCHE)).toBe("solde_insuffisant");

    expect(useGameStore.getState().hudMessage).toBe("Solde insuffisant : il manque 2 €");
    expect(session.run.heroLinesSaid.has("borne_solde")).toBe(true);
    expect(session.run.stream.wallet).toBe(3);
    expect(session.weapons.meleeDamageScale).toBe(1);
  });

  it("perk déjà acheté : la borne ne vend plus que sa recharge, au prix de la recharge", () => {
    const session = sessionAvec(50);
    session.weapons.pickUpPistol();
    usePerkKiosk(session, PERCHE);
    const balles = session.weapons.pistolAmmo;

    expect(usePerkKiosk(session, PERCHE)).toBe("achete");

    expect(useGameStore.getState().hudMessage).toBe(`Recharge de munitions : −${kioskConfig.ammoPrice} €`);
    expect(session.run.stream.wallet).toBe(45 - kioskConfig.ammoPrice);
    expect(session.weapons.pistolAmmo).toBeGreaterThan(balles);
    expect([...session.run.perks]).toEqual(["perche"]);
  });

  it("recharge inutile : un message, aucun débit", () => {
    const session = sessionAvec(200);
    usePerkKiosk(session, GILET);
    session.run.playerHp = session.run.playerMaxHp;

    expect(usePerkKiosk(session, GILET)).toBe("epuisee");

    expect(useGameStore.getState().hudMessage).toBe("Santé déjà au maximum");
    expect(session.run.stream.wallet).toBe(100);
  });

  it("recharge trop chère : rien n'est débité, le héros le commente", () => {
    const session = sessionAvec(100);
    usePerkKiosk(session, GILET);

    expect(usePerkKiosk(session, GILET)).toBe("solde_insuffisant");

    expect(useGameStore.getState().hudMessage).toBe(`Solde insuffisant : il manque ${kioskConfig.healPrice} €`);
    expect(session.run.stream.wallet).toBe(0);
    expect(session.run.playerHp).toBe(60 + perkConfig.giletMaxHpBonus);
  });
});

describe("publishPerkOffer — invite du HUD", () => {
  it("borne à portée : produit, effet, prix et touche d'usage", () => {
    publishPerkOffer(sessionAvec(0), borne(GILET), "E");

    expect(useGameStore.getState().perkOffer).toEqual({
      key: "E",
      label: "Gilet Alu-Tactique",
      effect: "PV maximum augmentés",
      price: 100,
      sold: false,
    });
  });

  it("n'écrit dans le store que sur un changement (invariant #2)", () => {
    const session = sessionAvec(500);
    const ecritures = vi.fn();
    const stop = useGameStore.subscribe(ecritures);

    for (let pas = 0; pas < 120; pas++) publishPerkOffer(session, borne(GILET), "E");
    expect(ecritures).toHaveBeenCalledTimes(1);

    // Perk acheté : la même borne affiche sa recharge, encore utile tant qu'il manque des PV.
    buyPerk(session.run, GILET);
    for (let pas = 0; pas < 120; pas++) publishPerkOffer(session, borne(GILET), "E");
    expect(ecritures).toHaveBeenCalledTimes(2);
    expect(useGameStore.getState().perkOffer).toMatchObject({
      label: "Trousse de soins",
      price: kioskConfig.healPrice,
      sold: false,
    });

    session.run.playerHp = session.run.playerMaxHp;
    for (let pas = 0; pas < 120; pas++) publishPerkOffer(session, borne(GILET), "E");
    expect(ecritures).toHaveBeenCalledTimes(3);
    expect(useGameStore.getState().perkOffer?.sold).toBe(true);

    for (let pas = 0; pas < 120; pas++) publishPerkOffer(session, null, "E");
    expect(ecritures).toHaveBeenCalledTimes(4);
    expect(useGameStore.getState().perkOffer).toBeNull();
    stop();
  });

  it("un `use_*` qui ne vend rien n'affiche aucune offre", () => {
    publishPerkOffer(sessionAvec(0), borne(null), "E");

    expect(useGameStore.getState().perkOffer).toBeNull();
  });
});

/** Vitesse horizontale atteinte en courant droit devant, joueur en l'air dans un monde vide. */
function vitesseDeCourse(session: GameSession): number {
  const frame = { ...emptyInputFrame(), forward: true, sprint: true };
  for (let pas = 0; pas < 60; pas++) session.player.update(DT, frame);
  return session.player.horizontalSpeed;
}

describe("effet des perks", () => {
  it("boisson : un kill donne une pointe de vitesse, qui retombe seule à la vitesse validée", () => {
    const session = sessionAvec(0);
    grantPerk(session, "boisson");

    startKillRush(session.run);
    updateKillRush(session, DT);
    expect(vitesseDeCourse(session)).toBeCloseTo(moveConfig.runSpeed * perkConfig.boissonSpeedScale, 5);

    for (let t = 0; t < perkConfig.boissonDuration + 0.1; t += DT) updateKillRush(session, DT);
    expect(session.player.speedScale).toBe(1);
    expect(vitesseDeCourse(session)).toBeCloseTo(moveConfig.runSpeed, 5);
  });

  it("boisson : un second kill relance la pointe sans la cumuler", () => {
    const session = sessionAvec(0);
    grantPerk(session, "boisson");

    startKillRush(session.run);
    for (let pas = 0; pas < 30; pas++) updateKillRush(session, DT);
    startKillRush(session.run);

    expect(session.run.killRushRemaining).toBe(perkConfig.boissonDuration);
    updateKillRush(session, DT);
    expect(session.player.speedScale).toBe(perkConfig.boissonSpeedScale);
  });

  it("sans la boisson, un kill ne change rien à la vitesse", () => {
    const session = sessionAvec(0);

    startKillRush(session.run);
    updateKillRush(session, DT);

    expect(session.run.killRushRemaining).toBe(0);
    expect(vitesseDeCourse(session)).toBeCloseTo(moveConfig.runSpeed, 5);
  });

  it("boisson : les trois variantes du harnais restent une pointe, pas un changement permanent", () => {
    for (const variante of Object.values(BOISSON_VARIANTS)) {
      expect(variante.boissonSpeedScale).toBeGreaterThan(1);
      expect(variante.boissonDuration).toBeGreaterThan(0);
      expect(variante.boissonDuration).toBeLessThanOrEqual(4);
    }
  });

  it("vpn : les Costards de la partie repèrent de moins loin", () => {
    const session = sessionAvec(0);

    grantPerk(session, "vpn");

    expect(session.suitManager.sightRangeScale).toBe(perkConfig.vpnSightRangeScale);
    expect(perkConfig.vpnSightRangeScale).toBeLessThan(1);
  });

  it("gilet : le maximum monte et le bonus est rendu tout de suite, une seule fois", () => {
    const session = sessionAvec(0);

    grantPerk(session, "gilet");
    grantPerk(session, "gilet");

    expect(session.run.playerMaxHp).toBe(100 + perkConfig.giletMaxHpBonus);
    expect(session.run.playerHp).toBe(60 + perkConfig.giletMaxHpBonus);
    expect(useGameStore.getState().debug.playerMaxHp).toBe(session.run.playerMaxHp);
    expect(useGameStore.getState().debug.playerHp).toBe(session.run.playerHp);
  });

  it("premium : le plafond de munitions du pistolet monte, une boîte de plus n'est plus perdue", () => {
    const session = sessionAvec(0);
    session.weapons.pickUpPistol();
    session.weapons.addPistolAmmo(10_000);
    expect(session.weapons.pistolAmmo).toBe(weaponConfig.pistolMaxAmmo);
    expect(session.weapons.addPistolAmmo(24)).toBe(0);

    grantPerk(session, "premium");

    expect(session.weapons.pistolMaxAmmo).toBe(weaponConfig.pistolMaxAmmo + perkConfig.premiumPistolAmmoBonus);
    expect(session.weapons.addPistolAmmo(24)).toBe(24);
  });

  it("perche : chaque coup de pied-de-biche porte son multiplicateur jusqu'à la cible", () => {
    const session = sessionAvec(0);
    const mur = session.physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 1.6, -1.5));
    session.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1, 1, 0.25).setCollisionGroups(COLLISION_GROUPS.WORLD),
      mur,
    );
    session.physics.step(0);
    const frapper = () => {
      session.weapons.snapshotPrevious();
      session.weapons.update(1, { ...emptyInputFrame(), fire: true }, new THREE.Vector3(0, 1.6, 0), 0, 0);
      return session.weapons.hitEvents.at(-1)!;
    };

    expect(damageForHit(frapper())).toBe(weaponConfig.meleeDamage);

    grantPerk(session, "perche");

    expect(damageForHit(frapper())).toBe(weaponConfig.meleeDamage * perkConfig.percheMeleeDamageScale);
    expect(damageForHit({ weapon: "pistol" })).toBe(weaponConfig.pistolDamage);
  });

  it("aimant : une trousse hors de portée sans lui est ramassée de plus loin", () => {
    const session = sessionAvec(0);
    const trousse = {
      name: "use_soin_test",
      object: new THREE.Object3D(),
      position: new THREE.Vector3(2.5, 0, 0),
      heals: 25,
      ammo: null,
    } as unknown as UseObject;
    const system = new InteractionSystem();
    const soigner = vi.fn(() => true);

    system.collectHeals([trousse], new THREE.Vector3(), soigner, session.run.pickupRadius);
    expect(soigner).not.toHaveBeenCalled();

    grantPerk(session, "aimant");
    system.collectHeals([trousse], new THREE.Vector3(), soigner, session.run.pickupRadius);

    expect(session.run.pickupRadius).toBe(perkConfig.aimantPickupRadius);
    expect(soigner).toHaveBeenCalledTimes(1);
  });

  it("tous les perks posés : aucune config globale n'a bougé, et une partie neuve repart sans eux", () => {
    const session = sessionAvec(0);
    for (const perk of PERKS) grantPerk(session, perk);
    startKillRush(session.run);
    updateKillRush(session, DT);

    expect(JSON.stringify({ moveConfig, weaponConfig, suitConfig })).toBe(GLOBALES);

    const neuve = sessionAvec(0);
    expect(neuve.player.speedScale).toBe(1);
    expect(neuve.weapons.pistolMaxAmmo).toBe(weaponConfig.pistolMaxAmmo);
    expect(neuve.weapons.meleeDamageScale).toBe(1);
    expect(neuve.run.pickupRadius).toBe(HEAL_PICKUP_RADIUS);
  });
});
