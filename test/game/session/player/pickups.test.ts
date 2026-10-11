/**
 * Ce que le joueur gagne en marchant sur un ramassage : munitions, armes,
 * soins et aliments. Un ramassage qui n'apporterait rien reste au sol. Le
 * niveau est lu par le vrai chargeur, les armes sont les vraies.
 */
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { playSfx } from "../../../../src/core/audio/audio";
import { GameClock } from "../../../../src/core/loop/time";
import { useGameStore } from "../../../../src/game/hud/state";
import { HEAL_PICKUP_RADIUS, InteractionSystem } from "../../../../src/game/level/interactions/interactive";
import { buildLevelFromGltf } from "../../../../src/game/level/loading/loader";
import { weaponConfig } from "../../../../src/game/player/weapons/weaponConfig";
import { WeaponSystem } from "../../../../src/game/player/weapons/weapons";
import type { GameSession } from "../../../../src/game/session/gameSession";
import { healPlayer, updatePickups } from "../../../../src/game/session/player/pickups";
import { HeroPortrait } from "../../../../src/game/session/presentation/heroPortrait";
import { createInitialStats } from "../../../../src/game/session/progression/score";
import { initPhysics, PhysicsWorld } from "../../../../src/physics/world";

vi.mock("../../../../src/core/audio/audio", () => ({ playSfx: vi.fn(), playHeroVoice: vi.fn(() => false) }));

await initPhysics();

type Extras = Record<string, unknown>;

/** Un niveau réduit à un point d'apparition et aux ramassages demandés, tous posés à l'origine. */
function partie(ramassages: Record<string, Extras>, hp = 60) {
  const physics = new PhysicsWorld();
  const group = new THREE.Group();
  const spawn = new THREE.Object3D();
  spawn.name = "spawn_player";
  group.add(spawn);
  for (const [name, extras] of Object.entries(ramassages)) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial());
    mesh.name = name;
    Object.assign(mesh.userData, extras);
    group.add(mesh);
  }
  const level = buildLevelFromGltf({ scene: group, animations: [] } as unknown as GLTF, new THREE.Scene(), physics);
  const weapons = new WeaponSystem(physics, new GameClock());
  weapons.startUnarmed();
  const session = {
    gltfLevelSession: { current: level },
    player: { position: new THREE.Vector3(0, 0, 0) },
    weapons,
    heroPortrait: new HeroPortrait(),
    run: {
      pickupRadius: HEAL_PICKUP_RADIUS,
      playerHp: hp,
      playerMaxHp: 100,
      lastHeroLineAt: -Infinity,
      lastHeroBarkAt: -Infinity,
      heroLinesSaid: new Set<string>(),
      heroLineRandom: () => 0,
      stats: createInitialStats(),
    },
    level: {
      propSystem: null,
    },
  } as unknown as GameSession;
  const interaction = new InteractionSystem();
  return { session, interaction, pas: () => updatePickups(interaction, session) };
}

const hud = () => useGameStore.getState().hudMessage;

beforeEach(() => {
  useGameStore.getState().resetGameStore();
  vi.mocked(playSfx).mockClear();
});

describe("healPlayer", () => {
  it("rend les PV demandés, les publie au HUD et dit combien ont été gagnés", () => {
    const { session } = partie({}, 40);

    expect(healPlayer(session, 25)).toBe(25);

    expect(session.run.playerHp).toBe(65);
    expect(useGameStore.getState().debug.playerHp).toBe(65);
  });

  it("plafonne au maximum et ne compte que ce qui a servi", () => {
    const { session } = partie({}, 90);

    expect(healPlayer(session, 25)).toBe(10);

    expect(session.run.playerHp).toBe(100);
  });

  it("atteint EXACTEMENT le maximum, même depuis des PV à décimales", () => {
    const { session } = partie({}, 99.7);

    healPlayer(session, 5);

    expect(session.run.playerHp).toBe(100);
  });
});

describe("updatePickups — trousses et aliments", () => {
  it("joueur blessé : la trousse soigne, le dit, et ne sert qu'une fois", () => {
    const { session, pas } = partie({ use_soin_test: { soin: 25 } });

    pas();
    expect(session.run.playerHp).toBe(85);
    expect(hud()).toBe("+25 PV");
    expect(playSfx).toHaveBeenCalledWith("heal_pickup");

    session.run.playerHp = 10;
    pas();
    expect(session.run.playerHp).toBe(10);
  });

  it("joueur en pleine forme : la trousse reste au sol, le héros le dit, et elle servira plus tard", () => {
    const { session, pas } = partie({ use_soin_test: { soin: 25 } }, 100);

    pas();
    expect(session.run.playerHp).toBe(100);
    expect(session.run.heroLinesSaid.has("soin_plein")).toBe(true);
    expect(playSfx).not.toHaveBeenCalled();

    session.run.playerHp = 50;
    pas();
    expect(session.run.playerHp).toBe(75);
  });

  it("le message annonce les PV réellement gagnés, pas la valeur de la trousse", () => {
    const { pas } = partie({ use_soin_test: { soin: 25 } }, 92);

    pas();

    expect(hud()).toBe("+8 PV");
  });

  it("un aliment se mange avec son propre son et sa réplique, jamais le carillon de trousse", () => {
    const { session, pas } = partie({ use_sandwich_test: { aliment: "sandwich" } });

    pas();

    expect(session.run.playerHp).toBe(70);
    expect(playSfx).toHaveBeenCalledWith("food_eat");
    expect(playSfx).not.toHaveBeenCalledWith("heal_pickup");
    expect(session.run.heroLinesSaid.has("manger_sandwich")).toBe(true);
  });

  it("un aliment laissé au sol à PV pleins ne fait rien dire au héros", () => {
    const { session, pas } = partie({ use_donut_test: { aliment: "donut" } }, 100);

    pas();

    expect(session.run.heroLinesSaid.size).toBe(0);
  });
});

describe("updatePickups — munitions", () => {
  it("sans plafond atteint : la boîte recharge le pistolet et l'annonce", () => {
    const { session, pas } = partie({ use_munitions_test: { munitions: 24 } });
    session.weapons.pickUpPistol();
    const avant = session.weapons.pistolAmmo;

    pas();

    expect(session.weapons.pistolAmmo).toBe(avant + 24);
    expect(hud()).toBe("+24 munitions");
    expect(playSfx).toHaveBeenCalledWith("ammo_pickup");
    expect(session.run.heroLinesSaid.has("munitions_24")).toBe(true);
  });

  it("au plafond : la boîte reste au sol, sans message ni son", () => {
    const { session, pas } = partie({ use_munitions_test: { munitions: 24 } });
    session.weapons.pickUpPistol();
    session.weapons.addPistolAmmo(weaponConfig.pistolMaxAmmo);

    pas();

    expect(session.weapons.pistolAmmo).toBe(weaponConfig.pistolMaxAmmo);
    expect(hud()).toBeNull();
    expect(playSfx).not.toHaveBeenCalled();
  });

  it("le message annonce les balles réellement prises quand le plafond coupe la boîte", () => {
    const { session, pas } = partie({ use_munitions_test: { munitions: 24 } });
    session.weapons.pickUpPistol();
    session.weapons.addPistolAmmo(weaponConfig.pistolMaxAmmo);
    session.weapons.pistolAmmo -= 5;

    pas();

    expect(hud()).toBe("+5 munitions");
  });

  it("une grande boîte et la cache de la gaine ont chacune leur réplique", () => {
    const grande = partie({ use_munitions_test: { munitions: 36 } });
    grande.session.weapons.pickUpPistol();
    grande.pas();
    expect(grande.session.run.heroLinesSaid.has("munitions_36")).toBe(true);

    const cache = partie({ use_munitions_gaine_1: { munitions: 36 } });
    cache.session.weapons.pickUpPistol();
    cache.pas();
    expect([...cache.session.run.heroLinesSaid]).toEqual(["cache_gaine"]);
  });
});

describe("updatePickups — armes au sol", () => {
  it("première arme : équipée, annoncée, avec sa réplique", () => {
    const { session, pas } = partie({ use_shotgun: {} });

    pas();

    expect(session.weapons.owns("shotgun")).toBe(true);
    expect(hud()).toBe("Fusil à pompe récupéré");
    expect(session.run.heroLinesSaid.has("arme_pompe")).toBe(true);
  });

  it("arme déjà possédée : elle reste au sol et le héros le remarque", () => {
    const { session, pas } = partie({ use_crowbar: {} });
    session.weapons.pickUpMelee();

    pas();

    expect(hud()).toBeNull();
    expect(playSfx).not.toHaveBeenCalled();
    expect(session.run.heroLinesSaid.has("arme_double")).toBe(true);
  });

  it("premier pistolet : l'arme ; un second : seulement ses balles", () => {
    const premier = partie({ use_pistol: {} });
    premier.pas();
    expect(premier.session.weapons.owns("pistol")).toBe(true);
    expect(hud()).toBe("Pistolet récupéré");
    expect(premier.session.run.heroLinesSaid.has("arme_pistolet")).toBe(true);

    const second = partie({ use_pistol: {} });
    second.session.weapons.pickUpPistol();
    second.pas();
    expect(hud()).toBe(`+${weaponConfig.pistolStartingAmmo} munitions`);
    expect(second.session.run.heroLinesSaid.has("arme_pistolet")).toBe(false);
  });
});

describe("updatePickups — pistolet de détresse", () => {
  it("premier pistolet de détresse : l'arme et sa réplique ; un second : seulement ses fusées", () => {
    const first = partie({ use_flare: {} });
    first.pas();
    expect(first.session.weapons.owns("flare")).toBe(true);
    expect(first.session.weapons.activeWeapon).toBe("flare");
    expect(hud()).toBe("Pistolet de détresse récupéré");
    expect(first.session.run.heroLinesSaid.has("arme_fusee")).toBe(true);

    const second = partie({ use_flare: {} });
    second.session.weapons.pickUpFlare();
    second.session.weapons.flareAmmo = 0;
    second.pas();
    expect(hud()).toBe(`+${weaponConfig.flareStartingAmmo} fusées de détresse`);
    expect(second.session.run.heroLinesSaid.has("arme_fusee")).toBe(false);
  });

  it("une boîte `fusees` recharge le pistolet de détresse, pas les autres armes", () => {
    const { session, pas } = partie({ use_fusees_test: { fusees: 4 } });
    session.weapons.pickUpPistol();
    session.weapons.pickUpFlare();
    const flares = session.weapons.flareAmmo;
    const bullets = session.weapons.pistolAmmo;

    pas();

    expect(session.weapons.flareAmmo).toBe(flares + 4);
    expect(session.weapons.pistolAmmo).toBe(bullets);
    expect(hud()).toBe("+4 fusées de détresse");
    expect(playSfx).toHaveBeenCalledWith("ammo_pickup");
  });

  it("au plafond de fusées : la boîte reste au sol", () => {
    const { session, pas } = partie({ use_fusees_test: { fusees: 4 } });
    session.weapons.pickUpFlare();
    session.weapons.addFlareAmmo(weaponConfig.flareMaxAmmo);

    pas();

    expect(session.weapons.flareAmmo).toBe(weaponConfig.flareMaxAmmo);
    expect(hud()).toBeNull();
  });
});

describe("updatePickups — portée", () => {
  it("hors du rayon de ramassage, rien n'est pris ; l'aimant l'élargit", () => {
    const { session, pas } = partie({ use_soin_test: { soin: 25 } });
    session.player.position.set(HEAL_PICKUP_RADIUS + 1, 0, 0);

    pas();
    expect(session.run.playerHp).toBe(60);

    session.run.pickupRadius = HEAL_PICKUP_RADIUS + 2;
    pas();
    expect(session.run.playerHp).toBe(85);
  });

  it("plusieurs ramassages à portée sont pris au même pas", () => {
    const { session, pas } = partie({
      use_soin_test: { soin: 25 },
      use_shotgun: {},
      use_munitions_test: { munitions: 24 },
    });
    session.weapons.pickUpPistol();
    const avant = session.weapons.pistolAmmo;

    pas();

    expect(session.run.playerHp).toBe(85);
    expect(session.weapons.owns("shotgun")).toBe(true);
    expect(session.weapons.pistolAmmo).toBe(avant + 24);
  });
});
