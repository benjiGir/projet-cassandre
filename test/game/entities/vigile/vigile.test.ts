/**
 * Le Vigile (lot B6) : lourd, lent, protégé de face par un bouclier. Il passe
 * par le gestionnaire du Costard avec sa propre configuration ; son bouclier
 * arrête les tirs de face, pas ceux de dos ni le souffle d'une explosion.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { suitConfig } from "../../../../src/game/entities/suit/suitConfig";
import { SuitManager } from "../../../../src/game/entities/suit/suitManager";
import { vigileConfig } from "../../../../src/game/entities/vigile/vigileConfig";
import { buildLevelFromGltf } from "../../../../src/game/level/loading/loader";
import { moveConfig } from "../../../../src/game/player/movement/moveConfig";
import type { HitEvent } from "../../../../src/game/player/weapons/weaponTypes";
import { ALERT_LINES, ATTACK_LINES, HERO_LINES } from "../../../../src/game/session/presentation/heroLines";
import { initPhysics, PhysicsWorld } from "../../../../src/physics/world";

await initPhysics();

const LOIN = new THREE.Vector3(0, 0, 80);
const YEUX = new THREE.Vector3(0, 1.6, 80);

/** Un Vigile à l'origine, tourné vers +Z. */
function vigile() {
  const manager = new SuitManager(new PhysicsWorld());
  const suit = manager.spawnSuit(0, 0, 0, new THREE.Vector3(0, 0, 1), "vigile");
  return { manager, suit };
}

/** Un tir de pompe qui touche le corps du côté `cote` (la normale de l'impact). */
function tir(suit: { position: THREE.Vector3; collider: { handle: number } | null }, cote: THREE.Vector3): HitEvent {
  return {
    point: suit.position.clone().addScaledVector(cote, 0.5),
    normal: cote.clone().normalize(),
    material: "flesh",
    weapon: "shotgun",
    colliderHandle: suit.collider!.handle,
    distance: 6,
  };
}

describe("Vigile — configuration", () => {
  it("naît avec sa configuration : plus de PV qu'un Costard, plus lent, au corps-à-corps, bouclier devant", () => {
    const { suit } = vigile();
    expect(suit.kind).toBe("vigile");
    expect(suit.cfg).toBe(vigileConfig);
    expect(suit.hp).toBeGreaterThan(suitConfig.maxHp * 2);
    expect(vigileConfig.chaseSpeed).toBeLessThan(suitConfig.chaseSpeed);
    expect(vigileConfig.melee).toBeDefined();
    expect(vigileConfig.shield?.halfArcDeg).toBeGreaterThan(45);
  });

  it("se contourne : à 3 m, un joueur qui marche tourne plus vite que lui", () => {
    expect(moveConfig.walkSpeed / 3).toBeGreaterThan(vigileConfig.turnRateRadPerSec);
  });

  it("a ses répliques, comme chaque espèce", () => {
    for (const table of [ALERT_LINES, ATTACK_LINES]) {
      expect(Object.hasOwn(HERO_LINES, table.vigile)).toBe(true);
    }
    expect(Object.hasOwn(HERO_LINES, "vigile_bouclier")).toBe(true);
  });
});

describe("Vigile — bouclier", () => {
  it("arrête un tir de face : aucun dégât, et le tir est signalé comme bloqué", () => {
    const { manager, suit } = vigile();
    const face = tir(suit, new THREE.Vector3(0, 0, 1));

    manager.update(1 / 60, LOIN, YEUX, [face]);

    expect(suit.hp).toBe(vigileConfig.maxHp);
    expect(manager.blockedHits.has(face)).toBe(true);
    expect(manager.hurtEvents).toEqual([]);
  });

  it("couvre l'arc avant, pas les flancs", () => {
    const { manager, suit } = vigile();
    const dans = (deg: number) =>
      new THREE.Vector3(Math.sin((deg * Math.PI) / 180), 0, Math.cos((deg * Math.PI) / 180));
    const bord = tir(suit, dans(vigileConfig.shield!.halfArcDeg - 5));
    const flanc = tir(suit, dans(vigileConfig.shield!.halfArcDeg + 15));

    manager.update(1 / 60, LOIN, YEUX, [bord, flanc]);

    expect(manager.blockedHits.has(bord)).toBe(true);
    expect(manager.blockedHits.has(flanc)).toBe(false);
    expect(suit.hp).toBeLessThan(vigileConfig.maxHp);
  });

  it("laisse passer un tir dans le dos, qui le blesse", () => {
    const { manager, suit } = vigile();
    const dos = tir(suit, new THREE.Vector3(0, 0, -1));

    manager.update(1 / 60, LOIN, YEUX, [dos]);

    expect(manager.blockedHits.size).toBe(0);
    expect(suit.hp).toBeLessThan(vigileConfig.maxHp);
    expect(manager.hurtEvents.map((e) => e.suit)).toEqual([suit]);
  });

  it("viser la tête ne passe pas par-dessus : seule compte la direction vue de dessus", () => {
    const { manager, suit } = vigile();
    const plongeant = tir(suit, new THREE.Vector3(0, 2, 1));
    manager.update(1 / 60, LOIN, YEUX, [plongeant]);
    expect(manager.blockedHits.has(plongeant)).toBe(true);
  });

  it("ne protège pas d'une explosion", () => {
    const { manager, suit } = vigile();
    // Le souffle part de devant lui, côté bouclier.
    manager.applyBlast(
      new THREE.Vector3(0, 1, 2),
      () => 60,
      () => true,
      0,
    );
    expect(suit.hp).toBe(vigileConfig.maxHp - 60);
  });

  it("un Costard, lui, n'a pas de bouclier", () => {
    const manager = new SuitManager(new PhysicsWorld());
    const costard = manager.spawnSuit(0, 0, 0, new THREE.Vector3(0, 0, 1));
    const face = tir(costard, new THREE.Vector3(0, 0, 1));
    manager.update(1 / 60, LOIN, YEUX, [face]);
    expect(manager.blockedHits.size).toBe(0);
    expect(costard.hp).toBeLessThan(suitConfig.maxHp);
  });

  it("la liste des tirs bloqués se vide après la présentation", () => {
    const { manager, suit } = vigile();
    manager.update(1 / 60, LOIN, YEUX, [tir(suit, new THREE.Vector3(0, 0, 1))]);
    manager.clearFrameEvents();
    expect(manager.blockedHits.size).toBe(0);
  });
});

describe("Convention glTF `spawn_vigile_*`", () => {
  it("rejoint la liste des apparitions du Costard, avec son espèce et son `groupe`", () => {
    const group = new THREE.Group();
    for (const [name, x, extras] of [
      ["spawn_player", 0, {}],
      ["spawn_vigile_escalier", 4, { groupe: "escalier" }],
    ] as const) {
      const obj = new THREE.Object3D();
      obj.name = name;
      obj.position.set(x, 0, 0);
      Object.assign(obj.userData, extras);
      group.add(obj);
    }
    const handle = buildLevelFromGltf(
      { scene: group, animations: [] } as unknown as GLTF,
      new THREE.Scene(),
      new PhysicsWorld(),
    );

    expect(handle.spawnSuits.map((s) => [s.name, s.kind, s.group])).toEqual([
      ["spawn_vigile_escalier", "vigile", "escalier"],
    ]);
  });
});
