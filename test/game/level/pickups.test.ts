/**
 * Ramassages pris en marchant dessus : trousses de soin (`soin`), boîtes de
 * munitions (`munitions`), et les trois armes au sol nommées (`use_crowbar`/
 * `use_shotgun`/`use_pistol`, mêmes noms qu'avant leur passage à la touche E
 * à ce ramassage automatique). Couvre la traversée du loader (`extras` ->
 * `UseObject.heals`/`ammo`) et `InteractionSystem.collectHeals`/`collectAmmo`/
 * `collectWeapons` — la décision « déjà possédée » elle-même est testée dans
 * `test/game/player/weaponPickups.test.ts` (`WeaponSystem.tryCollectXxx`).
 */
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { buildLevelFromGltf } from "../../../src/game/level/loader";
import {
  HEAL_PICKUP_RADIUS,
  InteractionSystem,
  type InteractionHandlers,
  type WeaponPickupHandlers,
} from "../../../src/game/level/interactive";
import { UseObjectCulling, USE_RENDER_DISTANCE, type CullableUseObject } from "../../../src/render/useObjectCulling";

await initPhysics();

function build(extras: Record<string, unknown>, nom = "use_soin_caisses_1") {
  const spawn = new THREE.Object3D();
  spawn.name = "spawn_player";
  const trousse = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial());
  trousse.name = nom;
  Object.assign(trousse.userData, extras);
  const group = new THREE.Group();
  group.add(spawn, trousse);
  const gltf = { scene: group, animations: [] } as unknown as GLTF;
  return buildLevelFromGltf(gltf, new THREE.Scene(), new PhysicsWorld());
}

describe("Convention glTF des trousses de soin", () => {
  it("`soin` sur un use_* : l'objet rend ce nombre de PV, sans avertissement « sans cible »", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handle = build({ soin: 25 });

    expect(handle.useObjects[0].heals).toBe(25);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("valeur nulle, négative ou non numérique : avertissement bruyant, propriété ignorée", () => {
    for (const valeur of [0, -10, "beaucoup"]) {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const handle = build({ soin: valeur });

      expect(handle.useObjects[0].heals).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        `[level] "use_soin_caisses_1" (use_*) : propriété "soin" = "${valeur}", ` +
          "qui n'est pas un nombre de PV strictement positif — propriété ignorée.",
      );
      errorSpy.mockRestore();
    }
  });
});

describe("InteractionSystem.collectHeals", () => {
  it("à portée : soigne, disparaît, ne se reprend pas", () => {
    const handle = build({ soin: 25 });
    const trousse = handle.useObjects[0];
    const tryHeal = vi.fn(() => true);
    const system = new InteractionSystem();

    system.collectHeals(handle.useObjects, trousse.position.clone(), tryHeal);
    system.collectHeals(handle.useObjects, trousse.position.clone(), tryHeal);

    expect(tryHeal).toHaveBeenCalledTimes(1);
    expect(tryHeal).toHaveBeenCalledWith(25);
    expect(trousse.object.visible).toBe(false);
  });

  it("refusée (PV pleins) : reste au sol et se ramasse plus tard", () => {
    const handle = build({ soin: 25 });
    const joueur = handle.useObjects[0].position.clone();
    const system = new InteractionSystem();

    system.collectHeals(handle.useObjects, joueur, () => false);
    expect(handle.useObjects[0].object.visible).toBe(true);

    const tryHeal = vi.fn(() => true);
    system.collectHeals(handle.useObjects, joueur, tryHeal);
    expect(tryHeal).toHaveBeenCalledTimes(1);
  });

  it("hors de portée : rien", () => {
    const handle = build({ soin: 25 });
    const tryHeal = vi.fn(() => true);
    const loin = handle.useObjects[0].position.clone().add(new THREE.Vector3(HEAL_PICKUP_RADIUS + 0.1, 0, 0));

    new InteractionSystem().collectHeals(handle.useObjects, loin, tryHeal);

    expect(tryHeal).not.toHaveBeenCalled();
  });

  it("la touche E ignore une trousse, même collée au joueur", () => {
    const handle = build({ soin: 25 });
    const handlers = new Proxy({} as InteractionHandlers, { get: () => vi.fn() });
    const system = new InteractionSystem();

    system.update(true, handle.useObjects, handle.useObjects[0].position.clone(), handlers);

    expect(system.nearestInRangeName).toBeNull();
    expect(handle.useObjects[0].object.visible).toBe(true);
  });
});

describe("Convention glTF des boîtes de munitions", () => {
  it("`munitions` sur un use_* : l'objet donne ce nombre de munitions", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handle = build({ munitions: 24 }, "use_munitions_caisses_1");

    expect(handle.useObjects[0].ammo).toBe(24);
    expect(handle.useObjects[0].heals).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("valeur invalide : avertissement bruyant nommant la bonne propriété", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handle = build({ munitions: 0 }, "use_munitions_caisses_1");

    expect(handle.useObjects[0].ammo).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      '[level] "use_munitions_caisses_1" (use_*) : propriété "munitions" = "0", ' +
        "qui n'est pas un nombre de munitions strictement positif — propriété ignorée.",
    );
    errorSpy.mockRestore();
  });

  it("collectAmmo : ramassée à portée, laissée au sol si le preneur refuse", () => {
    const handle = build({ munitions: 24 }, "use_munitions_caisses_1");
    const boite = handle.useObjects[0];
    const joueur = boite.position.clone();
    const system = new InteractionSystem();

    system.collectAmmo(handle.useObjects, joueur, () => false);
    expect(boite.object.visible).toBe(true);

    const tryTake = vi.fn(() => true);
    system.collectAmmo(handle.useObjects, joueur, tryTake);
    system.collectAmmo(handle.useObjects, joueur, tryTake);

    expect(tryTake).toHaveBeenCalledTimes(1);
    expect(tryTake).toHaveBeenCalledWith(24);
    expect(boite.object.visible).toBe(false);
  });

  it("une trousse n'est pas une boîte : collectHeals ignore les munitions, et l'inverse", () => {
    const handle = build({ munitions: 24 }, "use_munitions_caisses_1");
    const tryHeal = vi.fn(() => true);

    new InteractionSystem().collectHeals(handle.useObjects, handle.useObjects[0].position.clone(), tryHeal);

    expect(tryHeal).not.toHaveBeenCalled();
  });
});

/** Handlers d'armes muets, sauf ceux qu'un test remplace — même idée que
 * `handlersDeTest` de `loyaltyCards.test.ts`, pour `WeaponPickupHandlers`. */
function armeHandlersDeTest(overrides: Partial<WeaponPickupHandlers> = {}): WeaponPickupHandlers {
  return {
    onCrowbarPickup: () => false,
    onShotgunPickup: () => false,
    onPistolPickup: () => false,
    ...overrides,
  };
}

/** Construit un niveau avec un unique `use_*` nommé, sans extras — les trois
 * armes au sol n'en portent aucun (`.glb` antérieur à `soin`/`munitions`) et
 * déclenchent donc l'avertissement « sans cible » de `loader.ts`, déjà connu
 * et accepté pour ces trois noms (voir CLAUDE.md, warnings « crowbar/shotgun
 * sans target »). Ce module le rend silencieux pour ne pas polluer la sortie
 * du test, sans quoi ce défaut PRÉEXISTANT (hors scope de cette tâche)
 * masquerait un vrai `console.error` qu'un futur test voudrait vérifier.
 */
function buildArme(nom: string) {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    return build({}, nom);
  } finally {
    errorSpy.mockRestore();
  }
}

describe("InteractionSystem.collectWeapons — armes au sol ramassées en marchant dessus", () => {
  it("à portée : la touche E ne les propose plus (voir aussi loyaltyCards.test.ts)", () => {
    const handle = buildArme("use_crowbar");
    const system = new InteractionSystem();

    system.update(true, handle.useObjects, handle.useObjects[0].position.clone(), {
      onExitDoorUse: () => {},
      onFrozenStorageUse: () => {},
      onDoorUse: () => {},
      onPaMicUse: () => {},
      onToiletUse: () => {},
      onCardPickup: () => {},
      onCardDoorUse: () => {},
    });

    expect(system.nearestInRangeName).toBeNull();
  });

  it("use_crowbar à portée : ramassé, disparaît, ne se reprend pas", () => {
    const handle = buildArme("use_crowbar");
    const crowbar = handle.useObjects[0];
    const onCrowbarPickup = vi.fn(() => true);
    const system = new InteractionSystem();

    system.collectWeapons(handle.useObjects, crowbar.position.clone(), armeHandlersDeTest({ onCrowbarPickup }));
    system.collectWeapons(handle.useObjects, crowbar.position.clone(), armeHandlersDeTest({ onCrowbarPickup }));

    expect(onCrowbarPickup).toHaveBeenCalledTimes(1);
    expect(crowbar.object.visible).toBe(false);
  });

  it("use_shotgun/use_pistol : même mécanique, chacun son propre callback", () => {
    const handle = buildArme("use_shotgun");
    const onShotgunPickup = vi.fn(() => true);
    const onPistolPickup = vi.fn(() => true);
    const system = new InteractionSystem();

    system.collectWeapons(
      handle.useObjects,
      handle.useObjects[0].position.clone(),
      armeHandlersDeTest({ onShotgunPickup, onPistolPickup }),
    );

    expect(onShotgunPickup).toHaveBeenCalledTimes(1);
    expect(onPistolPickup).not.toHaveBeenCalled();
  });

  it("hors de portée (même rayon que les trousses/munitions) : rien", () => {
    const handle = buildArme("use_pistol");
    const onPistolPickup = vi.fn(() => true);
    const loin = handle.useObjects[0].position.clone().add(new THREE.Vector3(HEAL_PICKUP_RADIUS + 0.1, 0, 0));

    new InteractionSystem().collectWeapons(handle.useObjects, loin, armeHandlersDeTest({ onPistolPickup }));

    expect(onPistolPickup).not.toHaveBeenCalled();
  });

  it("handler refuse (déjà possédée, rien à offrir) : reste au sol, réessayée au pas suivant", () => {
    const handle = buildArme("use_shotgun");
    const shotgun = handle.useObjects[0];
    const onShotgunPickup = vi.fn(() => false); // ex. `WeaponSystem.tryCollectShotgun` déjà possédé
    const system = new InteractionSystem();

    system.collectWeapons(handle.useObjects, shotgun.position.clone(), armeHandlersDeTest({ onShotgunPickup }));
    system.collectWeapons(handle.useObjects, shotgun.position.clone(), armeHandlersDeTest({ onShotgunPickup }));

    expect(onShotgunPickup).toHaveBeenCalledTimes(2); // jamais consommé : réessayé à chaque pas
    expect(shotgun.object.visible).toBe(true);
  });
});

describe("UseObjectCulling — élagage par distance des `use_*`", () => {
  function cible(x: number): CullableUseObject {
    const object = new THREE.Object3D();
    object.position.set(x, 0, 0);
    return { object, position: new THREE.Vector3(x, 0, 0) };
  }

  it("éteint au-delà de la portée, rallume en revenant", () => {
    const culling = new UseObjectCulling();
    const proche = cible(0);
    const loin = cible(USE_RENDER_DISTANCE + 10);

    culling.update([proche, loin], new THREE.Vector3());
    expect(proche.object.visible).toBe(true);
    expect(loin.object.visible).toBe(false);

    culling.update([proche, loin], new THREE.Vector3(USE_RENDER_DISTANCE + 10, 0, 0));
    expect(loin.object.visible).toBe(true);
    expect(proche.object.visible).toBe(false);
  });

  it("ne rallume JAMAIS un ramassage consommé (éteint par quelqu'un d'autre)", () => {
    const culling = new UseObjectCulling();
    const ramasse = cible(0);
    ramasse.object.visible = false; // `interactive.ts` le cache à la consommation

    culling.update([ramasse], new THREE.Vector3());
    expect(ramasse.object.visible).toBe(false);

    // Même après un aller-retour hors de portée : il n'a jamais été éteint par l'élagage.
    culling.update([ramasse], new THREE.Vector3(USE_RENDER_DISTANCE + 10, 0, 0));
    culling.update([ramasse], new THREE.Vector3());
    expect(ramasse.object.visible).toBe(false);
  });
});
