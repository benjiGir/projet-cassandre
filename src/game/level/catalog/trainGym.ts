import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { COLLISION_GROUPS, type PhysicsWorld } from "../../../physics/world";
import { poseOnRoute, routeLength } from "../trains/trainPath";
import { TrainSystem } from "../trains/trainSystem";
import { TrainPresentation } from "../../../render/environment/trainGym/trainPresentation";
import type { TrainCommand } from "../trains/trainTypes";

export interface TrainGym {
  system: TrainSystem;
  presentation: TrainPresentation;
  spawn: THREE.Vector3;
  spawnYaw: number;
  use(position: THREE.Vector3): boolean;
}

export function buildTrainGym(root: THREE.Group, physics: PhysicsWorld): TrainGym {
  const materials = new Map<number, THREE.MeshLambertMaterial>();
  const box = (color: number, x: number, y: number, z: number, w: number, h: number, d: number, solid = true) => {
    let material = materials.get(color);
    if (!material) { material = new THREE.MeshLambertMaterial({ color }); materials.set(color, material); }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); root.add(mesh);
    if (solid) physics.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
      .setTranslation(x, y, z).setCollisionGroups(COLLISION_GROUPS.WORLD));
  };
  box(0x414b50, 2, -.2, 1.5, 24, .4, 47);
  box(0x89908b, -7.35, .45, 1.5, 5.3, .9, 47);
  box(0x89908b, 11.85, .45, 1.5, 4.3, .9, 47);
  for (const [low, high] of [[-22, -16.5], [-13.5, 13.5], [16.5, 25]]) {
    for (const x of [-3.5, 8.5]) box(0x89908b, x, .45, (low! + high!) / 2, 2.4, .9, high! - low!);
  }
  box(0x657078, -10, 2.5, 1.5, .4, 5, 47);
  box(0x657078, 14, 2.5, 1.5, .4, 5, 47);
  for (const [low, high] of [[-10, -1.9], [1.9, 3.1], [6.9, 14]]) {
    box(0x657078, (low! + high!) / 2, 2.5, 25, high! - low!, 5, .4);
  }
  for (const x of [0, 5]) box(0x090e12, x, 2.5, 25.1, 3.8, 5, .02, false);
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(12, 2.5, .2)
    .setTranslation(2, 2.5, 25).setCollisionGroups(COLLISION_GROUPS.WORLD));
  box(0x657078, -6.25, 2.5, -22, 7.5, 5, .4);
  box(0x657078, 2.8, 2.5, -22, .6, 5, .4);
  box(0x657078, 10.45, 2.5, -22, 7.1, 5, .4);
  box(0x090e12, 5, 2.5, -22.1, 3.8, 5, .02, false);
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(1.9, 2.5, .2)
    .setTranslation(5, 2.5, -22).setCollisionGroups(COLLISION_GROUPS.WORLD));
  for (const x of [0, 5]) {
    for (const offset of [-.8, .8]) box(0x343d40, x + offset, .07, 1.5, .1, .14, 47, false);
    for (let z = -20; z < 24; z += 1) for (const side of [-1, 1]) {
      box(z % 2 ? 0xe1b950 : 0x262b2e, x + side * 1.9, .015, z, .15, .025, 1, false);
    }
  }
  for (const z of [15, -15]) {
    for (let i = 0; i < 6; i++) for (const side of [-1, 1]) {
      box(0x74857e, side === -1 ? -2.5 - i * .4 : 7.5 + i * .4, (i + 1) * .075, z, .4, (i + 1) * .15, 3);
    }
    box(0xa9a06e, 2.5, .025, z, 9.8, .05, 3, false);
  }
  const niches = [-35, -65, -95, -125, -155];
  box(0x485258, 0, -.2, -98.5, 4.8, .4, 153);
  box(0x505960, 0, 4.4, -98.5, 4.8, .4, 153);
  for (const side of [-1, 1]) {
    let previous = -22;
    for (const z of niches) {
      const end = z + 2;
      const gaps = side === 1 ? [[end, Math.min(previous, -140)], [Math.max(end, -108), previous]] : [[end, previous]];
      for (const [low, high] of gaps) if (high! > low!) box(0x646d70, side * 2.6, 2, (low! + high!) / 2, .4, 4, high! - low!);
      box(0x49735a, side * 4, -.2, z, 3.2, .4, 4);
      box(0x65726a, side * 5.5, 2, z, .4, 4, 4);
      for (const dz of [-2, 2]) box(0x65726a, side * 4, 2, z + dz, 3.2, 4, .4);
      previous = z - 2;
    }
    box(0x646d70, side * 2.6, 2, (previous - 175) / 2, .4, 4, previous + 175);
  }
  for (let z = -23; z > -175; z -= 1) for (const side of [-1, 1]) {
    box(z % 2 ? 0xe1b950 : 0x262b2e, side * 1.9, .02, z, .15, .03, 1, false);
  }
  box(0x65726a, 3.5, 2, -175, 17, 4, .4);
  // La dérivation reste visible dans la salle, sans géométrie de tunnel finale.
  box(0x596368, 10, -.2, -140, 20, .4, 70);
  const routes = [
    { id: "TUNNEL", points: [new THREE.Vector3(0, 0, 25), new THREE.Vector3(0, 0, -175)] },
    { id: "DÉVIATION", points: [new THREE.Vector3(0, 0, 25), new THREE.Vector3(0, 0, -110),
      new THREE.Vector3(12, 0, -130), new THREE.Vector3(12, 0, -175)] },
  ];
  const position = new THREE.Vector3(), direction = new THREE.Vector3();
  for (let d = 135; d < routeLength(routes[1]!); d++) {
    poseOnRoute(routes[1]!, d, position, direction);
    for (const side of [-1, 1]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(.15, .03, 1), materials.get(d % 2 ? 0xe1b950 : 0x262b2e));
      mesh.position.set(position.x + direction.z * 1.9 * side, .02, position.z - direction.x * 1.9 * side);
      mesh.rotation.y = Math.atan2(direction.x, direction.z); root.add(mesh);
    }
  }
  box(0x65726a, 20, 2, -140, .4, 4, 70);
  box(0x65726a, 10, 2, -105, 15, 4, .4);
  const system = new TrainSystem([
    { id: "A", routes, firstArrival: 10 },
    { id: "B", routes: [{ id: "QUAI", points: [new THREE.Vector3(5, 0, -22), new THREE.Vector3(5, 0, 25)] }], firstArrival: 25 },
  ]);
  const presentation = new TrainPresentation(root, physics);
  presentation.addDisplay(new THREE.Vector3(-5, 0, 10), new THREE.Vector3(-6, 2.8, -2));
  for (const z of niches) presentation.addDisplay(new THREE.Vector3(0, 0, z), new THREE.Vector3(-5.25, 2.2, z), Math.PI / 2);
  const controls: Array<{ position: THREE.Vector3; command: TrainCommand }> = [
    { position: new THREE.Vector3(-3.7, 1.2, 6), command: { type: "stop", lane: "A" } },
    { position: new THREE.Vector3(-3.7, 1.2, 2), command: { type: "switch", lane: "A" } },
    ...niches.map((z) => ({ position: new THREE.Vector3(-4.6, 1.2, z - 1), command: { type: "stop" as const, lane: "A" } })),
  ];
  for (const control of controls) {
    box(control.command.type === "stop" ? 0xb74838 : 0x41999c, control.position.x, 1.2, control.position.z, .45, .45, .45);
  }
  physics.refreshSceneQueries();
  return { system, presentation, spawn: new THREE.Vector3(-6, .9, 10), spawnYaw: 0,
    use(position) {
      const control = controls.find((candidate) => candidate.position.distanceTo(position) <= 2);
      if (!control) return false;
      system.enqueue(control.command); return true;
    } };
}
