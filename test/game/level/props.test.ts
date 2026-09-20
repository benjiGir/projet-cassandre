/**
 * `prop_*` — mobilier physique poussable/destructible.
 *
 * Testé contre un VRAI monde Rapier et le VRAI chemin de chargement
 * (`buildLevelFromGltf`), jamais contre un faux corps : ce qui est en jeu ici
 * est précisément le comportement de corps dynamiques réels (recentrage sur le
 * centre de masse, impulsion intégrée par un pas, collider désactivé à la
 * destruction). Même patron de fixtures en mémoire que `loader.test.ts` —
 * un objet THREE nommé à la main est indiscernable d'un objet importé pour
 * `blenderName()`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { initPhysics, PhysicsWorld, GROUP } from "../../../src/physics/world";
import { buildLevelFromGltf } from "../../../src/game/level/loader";
import { PropSystem } from "../../../src/game/level/props";
import type { HitEvent } from "../../../src/game/player/weapons";
import { weaponConfig } from "../../../src/game/player/weaponConfig";

await initPhysics();

/**
 * Boîte dont l'ORIGINE est un coin, comme toute pièce du kit du projet — c'est
 * le cas qui casse si le recentrage sur le centre de masse est oublié.
 */
function propMesh(name: string, size: THREE.Vector3, at: THREE.Vector3, extras: Record<string, unknown> = {}) {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  geometry.translate(size.x / 2, size.y / 2, size.z / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffffff }));
  mesh.name = name;
  mesh.position.copy(at);
  mesh.userData = { ...extras };
  return mesh;
}

function build(objects: THREE.Object3D[]) {
  const physics = new PhysicsWorld();
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  for (const obj of objects) group.add(obj);
  const handle = buildLevelFromGltf({ scene: group, animations: [] } as never, scene, physics);
  return { handle, scene, physics };
}

/** Un impact de pompe sur `collider`, venant de +X (donc qui pousse vers −X). */
function hitFrom(colliderHandle: number, point: THREE.Vector3, normal = new THREE.Vector3(1, 0, 0)): HitEvent {
  return { point, normal, material: "concrete", weapon: "shotgun", colliderHandle, distance: 3 };
}

afterEach(() => {
  vi.restoreAllMocks();
});

/** Les messages `prop_*` seulement : un fixture sans `spawn_player` en produit
 * un autre, sans rapport, et il ne doit pas entrer dans ces assertions. */
function propWarnings(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls
    .map((call: unknown[]) => String(call[0]))
    .filter((msg: string) => msg.includes("(prop_*)"));
}

describe("chargement d'un prop_*", () => {
  it("pose le corps sur le CENTRE de la boîte, pas sur l'origine du mesh", () => {
    const { handle } = build([
      propMesh("prop_caisse", new THREE.Vector3(1, 2, 3), new THREE.Vector3(10, 5, -3)),
    ]);

    expect(handle.stats.propCount).toBe(1);
    const prop = handle.props[0]!;
    const t = prop.body.translation();
    // Origine du mesh (10, 5, −3) + demi-boîte : c'est là qu'est le centre de masse.
    expect(t.x).toBeCloseTo(10.5, 5);
    expect(t.y).toBeCloseTo(6, 5);
    expect(t.z).toBeCloseTo(-1.5, 5);
    expect(prop.centerOffset.toArray()).toEqual([0.5, 1, 1.5]);
    expect(prop.halfExtents.toArray()).toEqual([0.5, 1, 1.5]);
  });

  it("crée un corps DYNAMIQUE dans le groupe PROP, pas un collider de monde", () => {
    const { handle } = build([propMesh("prop_caddie", new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 1, 0))]);
    const prop = handle.props[0]!;

    expect(prop.body.isDynamic()).toBe(true);
    const membership = (prop.collider.collisionGroups() >>> 16) & 0xffff;
    expect(membership & GROUP.PROP).toBeTruthy();
    expect(membership & GROUP.WORLD).toBeFalsy();
    // Un prop n'est PAS un collider de niveau : il ne gonfle pas ce compteur.
    expect(handle.stats.colliderCount).toBe(0);
  });

  it("reste visible et n'est jamais compté comme décor fusionnable", () => {
    const { handle } = build([propMesh("prop_caisse", new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 1, 0))]);
    expect(handle.props[0]!.object.visible).toBe(true);
    // `unprefixedMeshCount` ne compte que les meshes SANS préfixe reconnu :
    // un prop est reconnu, donc il n'y entre pas — et ne peut pas se retrouver
    // dans un lot fusionné par ce chemin.
    expect(handle.stats.unprefixedMeshCount).toBe(0);
  });

  it("lit masse, pv et matiere ; un pv absent laisse le prop indestructible", () => {
    const { handle } = build([
      propMesh("prop_vitrine", new THREE.Vector3(2, 2, 0.2), new THREE.Vector3(0, 0, 0), {
        masse: 40,
        pv: 30,
        matiere: "verre",
      }),
      propMesh("prop_pilier", new THREE.Vector3(1, 3, 1), new THREE.Vector3(5, 0, 0)),
    ]);

    const vitrine = handle.props.find((p) => p.name === "prop_vitrine")!;
    expect(vitrine.maxHp).toBe(30);
    expect(vitrine.matiere).toBe("verre");
    expect(vitrine.body.mass()).toBeCloseTo(40, 3);

    const pilier = handle.props.find((p) => p.name === "prop_pilier")!;
    expect(pilier.maxHp).toBeNull();
    expect(pilier.matiere).toBe("bois"); // défaut silencieux
  });

  it("avertit bruyamment sur une matiere inconnue, sans refuser le prop", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handle } = build([
      propMesh("prop_bidon", new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0), { matiere: "plutonium" }),
    ]);

    expect(handle.props).toHaveLength(1);
    expect(handle.props[0]!.matiere).toBe("bois");
    const warnings = propWarnings(errorSpy);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("plutonium");
  });

  it("avertit bruyamment sur une masse non positive, sans refuser le prop", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handle } = build([
      propMesh("prop_caisse", new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0), { masse: -3 }),
    ]);

    expect(handle.props).toHaveLength(1);
    expect(handle.props[0]!.body.mass()).toBeCloseTo(25, 3); // DEFAULT_PROP_MASS_KG
    const warnings = propWarnings(errorSpy);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("masse");
  });
});

describe("PropSystem — tir, poussée, destruction", () => {
  it("un impact pousse réellement le corps, dans le sens du tir", () => {
    const { handle, physics } = build([
      propMesh("prop_caddie", new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0), { masse: 10 }),
    ]);
    const props = new PropSystem(handle.props, handle.root);
    const prop = handle.props[0]!;
    const avant = prop.body.translation().x;

    // Normale vers +X (le tireur est à droite) : l'impulsion doit pousser vers −X.
    props.update([hitFrom(prop.collider.handle, new THREE.Vector3(0.5, 0.5, 0.5))]);
    physics.step(1 / 60);
    props.syncFromPhysics();

    expect(prop.body.translation().x).toBeLessThan(avant);
  });

  it("détruit le prop exactement au passage à zéro PV, et une seule fois", () => {
    const pelletDamage = weaponConfig.shotgunDamagePerPellet;
    const { handle } = build([
      propMesh("prop_caisse", new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0), {
        pv: pelletDamage * 2,
        matiere: "carton",
      }),
    ]);
    const props = new PropSystem(handle.props, handle.root);
    const prop = handle.props[0]!;
    const point = new THREE.Vector3(0.5, 0.5, 0.5);

    props.update([hitFrom(prop.collider.handle, point)]);
    expect(props.destroyedEvents).toHaveLength(0);
    expect(props.hitEvents[0]!.fatal).toBe(false);
    expect(props.aliveCount).toBe(1);
    props.clearFrameEvents();

    props.update([hitFrom(prop.collider.handle, point)]);
    expect(props.destroyedEvents).toHaveLength(1);
    expect(props.destroyedEvents[0]!.matiere).toBe("carton");
    expect(props.aliveCount).toBe(0);
    expect(prop.object.visible).toBe(false);
    expect(prop.collider.isEnabled()).toBe(false);
    expect(prop.body.isEnabled()).toBe(false);
    props.clearFrameEvents();

    // Un tir de plus sur le même handle ne produit plus rien.
    props.update([hitFrom(prop.collider.handle, point)]);
    expect(props.hitEvents).toHaveLength(0);
    expect(props.destroyedEvents).toHaveLength(0);
  });

  it("ne détruit jamais un prop sans pv, quel que soit le nombre de coups", () => {
    const { handle } = build([
      propMesh("prop_pilier", new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0)),
    ]);
    const props = new PropSystem(handle.props, handle.root);
    const prop = handle.props[0]!;

    for (let i = 0; i < 200; i++) {
      props.update([hitFrom(prop.collider.handle, new THREE.Vector3(0.5, 0.5, 0.5))]);
      props.clearFrameEvents();
    }
    expect(props.aliveCount).toBe(1);
    expect(prop.object.visible).toBe(true);
  });

  it("ignore un impact qui ne touche aucun prop", () => {
    const { handle } = build([propMesh("prop_caisse", new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0), { pv: 1 })]);
    const props = new PropSystem(handle.props, handle.root);

    props.update([hitFrom(9999, new THREE.Vector3(0, 0, 0))]);
    expect(props.hitEvents).toHaveLength(0);
    expect(props.aliveCount).toBe(1);
  });

  it("destroyByName casse un prop sans tir, et refuse un nom inconnu ou déjà cassé", () => {
    const { handle } = build([propMesh("prop_caisse", new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0), { pv: 50 })]);
    const props = new PropSystem(handle.props, handle.root);

    expect(props.destroyByName("prop_inconnu")).toBe(false);
    expect(props.destroyByName("prop_caisse")).toBe(true);
    expect(props.destroyByName("prop_caisse")).toBe(false);
    expect(props.destroyedEvents).toHaveLength(1);
  });
});

describe("PropSystem — interpolation du rendu", () => {
  it("réécrit la pose du mesh en respectant le décalage origine/centre", () => {
    const { handle } = build([
      propMesh("prop_caisse", new THREE.Vector3(2, 2, 2), new THREE.Vector3(4, 0, 7), { masse: 10 }),
    ]);
    const props = new PropSystem(handle.props, handle.root);
    const prop = handle.props[0]!;

    // Corps téléporté d'un mètre en +X : le mesh doit suivre EXACTEMENT, donc
    // garder son origine à un coin (4+1, 0, 7) et non se recentrer dessus.
    const t = prop.body.translation();
    prop.body.setTranslation({ x: t.x + 1, y: t.y, z: t.z }, true);
    props.syncFromPhysics();
    props.interpolate(1, new THREE.Vector3(5, 1, 7)); // caméra à côté

    expect(prop.object.position.x).toBeCloseTo(5, 5);
    expect(prop.object.position.y).toBeCloseTo(0, 5);
    expect(prop.object.position.z).toBeCloseTo(7, 5);
  });

  it("ne touche plus un mesh une fois le prop détruit", () => {
    const { handle } = build([propMesh("prop_caisse", new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0), { pv: 1 })]);
    const props = new PropSystem(handle.props, handle.root);
    const prop = handle.props[0]!;

    props.destroyByName("prop_caisse");
    const figee = prop.object.position.clone();
    prop.body.setTranslation({ x: 99, y: 99, z: 99 }, false);
    props.syncFromPhysics();
    props.interpolate(1, new THREE.Vector3(0, 1, 0));

    expect(prop.object.position.equals(figee)).toBe(true);
  });

  it("n'affiche pas un prop hors de portée, et le repose correctement au retour", () => {
    const { handle } = build([
      propMesh("prop_caisse", new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0), { masse: 10 }),
    ]);
    const props = new PropSystem(handle.props, handle.root);
    const prop = handle.props[0]!;

    // Caméra à 100 m : au-delà de la portée de rendu, le prop n'est pas dessiné.
    props.interpolate(1, new THREE.Vector3(100, 0, 0));
    expect(prop.object.visible).toBe(false);

    // Il bouge PENDANT qu'il est élagué, puis s'endort : sa pose est périmée.
    prop.body.setTranslation({ x: 3, y: 0.5, z: 0 }, true);
    props.syncFromPhysics();
    props.snapshotPrevious();
    props.syncFromPhysics(); // deux poses identiques -> le prop « dort »
    props.interpolate(1, new THREE.Vector3(100, 0, 0));

    // La caméra revient : le prop réapparaît À SA VRAIE PLACE, pas à l'ancienne.
    props.interpolate(1, new THREE.Vector3(4, 0, 0));
    expect(prop.object.visible).toBe(true);
    expect(prop.object.position.x).toBeCloseTo(2.5, 5); // centre 3 − demi-boîte 0,5
  });
});
