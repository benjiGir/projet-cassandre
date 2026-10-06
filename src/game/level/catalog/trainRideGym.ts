import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { COLLISION_GROUPS, type PhysicsWorld } from "../../../physics/world";
import { DoorSystem } from "../doors/doors";
import type { DoorInfo } from "../doors/doorTypes";
import { TrainRideSystem } from "../trainRide/trainRideSystem";
import { RIDE_ENTRY_DOOR, RIDE_EXIT_DOOR } from "../trainRide/trainRideConfig";
import { TrainRidePresentation } from "../../../render/environment/trainRide/trainRidePresentation";

export interface TrainRideGym {
  system: TrainRideSystem;
  presentation: TrainRidePresentation;
  doors: DoorSystem;
  spawn: THREE.Vector3;
  control: THREE.Vector3;
  waveSpawned: boolean;
  resetDoors(): DoorSystem;
}

// see: docs/4-technique/prototype-voyage-rame.md#rame-et-quais
export function buildTrainRideGym(root: THREE.Group, physics: PhysicsWorld): TrainRideGym {
  const materials = new Map<number, THREE.Material>();
  function box(parent: THREE.Group, color: number, x: number, y: number, z: number,
    w: number, h: number, d: number, solid = true, lit = false): THREE.Mesh {
    let material = materials.get(color);
    if (!material) { material = lit ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color }); materials.set(color, material); }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); parent.add(mesh);
    if (solid) physics.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
      .setTranslation(x, y, z).setCollisionGroups(COLLISION_GROUPS.WORLD));
    return mesh;
  }
  box(root, 0x4f6669, 0, -.15, 0, 3.6, .3, 46);
  box(root, 0xa6afa5, 0, 3.1, 0, 3.9, .2, 46);
  for (const z of [-23, 23]) box(root, 0x768c87, 0, 1.5, z, 3.9, 3, .2);
  for (const side of [-1, 1]) {
    const doorZ = side === -1 ? 17 : -17;
    for (const [low, high] of [[-23, doorZ - 1.5], [doorZ + 1.5, 23]]) {
      const z = (low! + high!) / 2, length = high! - low!;
      box(root, 0x486c75, side * 1.8, .4, z, .16, .8, length, false);
      box(root, 0x8da59c, side * 1.8, 2.9, z, .16, .4, length, false);
      physics.world.createCollider(RAPIER.ColliderDesc.cuboid(.08, 1.5, length / 2)
        .setTranslation(side * 1.8, 1.5, z).setCollisionGroups(COLLISION_GROUPS.WORLD));
    }
    for (let z = -22.5; z < 23; z += 3) {
      if (Math.abs(z - doorZ) < 1.6) continue;
      box(root, 0x8da59c, side * 1.8, 1.7, z, .16, 2, .13, false);
    }
    for (const z of [-12, -3, 6, 12]) {
      box(root, 0x354952, side * 1.25, .3, z, .7, .6, 1.8);
      box(root, 0x6c8177, side * 1.56, .95, z, .16, .7, 1.8, false);
    }
  }
  for (const z of [-7.5, 7.5]) {
    for (const side of [-1, 1]) box(root, 0x3f5357, side * 1.46, 1.5, z, .68, 3, .45);
    box(root, 0x3f5357, 0, 2.8, z, 2.3, .4, .45);
    box(root, 0xabc1b7, 0, .015, z, 2.25, .025, .4, false);
  }
  for (const z of [-18, -9, 0, 9, 18]) {
    box(root, 0xe8deb2, 0, 2.96, z, .35, .04, 2, false, true);
  }
  const departure = new THREE.Group(), arrival = new THREE.Group();
  root.add(departure, arrival);
  for (const [group, side, z] of [[departure, -1, 17], [arrival, 1, -17]] as const) {
    box(group, 0x6b7577, side * 5, -.15, z, 6.2, .3, 12);
    box(group, 0x526b6a, side * 8, 1.8, z, .25, 3.6, 12);
    for (const dz of [-6, 6]) box(group, 0x526b6a, side * 5, 1.8, z + dz, 6.2, 3.6, .25);
    box(group, 0x303e43, side * 5, 3.6, z, 6.2, .2, 12);
    for (const dz of [-4, 0, 4]) box(group, 0xd6b351, side * 2.2, .025, z + dz, .25, .04, 3, false);
    box(group, 0x537d74, side * 6.5, .45, z, 1, .9, 2);
  }
  function door(name: string, side: number, z: number, open: boolean): DoorInfo {
    const mesh = box(root, 0x577a7d, side * 1.8, 1.35, z, .18, 2.7, 3, false);
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(mesh.position.x, mesh.position.y, z));
    const collider = physics.world.createCollider(RAPIER.ColliderDesc.cuboid(.09, 1.35, 1.5).setCollisionGroups(COLLISION_GROUPS.WORLD), body);
    mesh.geometry.computeBoundingBox();
    return { name, object: mesh, body, collider, halfExtents: new THREE.Vector3(.09, 1.35, 1.5),
      localMin: mesh.geometry.boundingBox!.min.clone(), localMax: mesh.geometry.boundingBox!.max.clone(),
      closedPosition: mesh.position.clone(), closedQuaternion: mesh.quaternion.clone(), scale: mesh.scale.clone(),
      movement: "coulisse", clip: null, extras: { ouverte: open, course: 3.2, sens: "+", duree: .6, referme: false } };
  }
  const doorInfos = [door(RIDE_ENTRY_DOOR, -1, 17, true), door(RIDE_EXIT_DOOR, 1, -17, false)];
  const doors = new DoorSystem(doorInfos);
  doors.lock(RIDE_EXIT_DOOR);
  const control = new THREE.Vector3(0, 1.2, -21.5);
  box(root, 0x31454f, 0, .6, -21.5, 1.5, 1.2, .65);
  box(root, 0x71d1a1, 0, 1.23, -21.3, .35, .08, .3, false, true);
  const system = new TrainRideSystem();
  const presentation = new TrainRidePresentation(root, departure, arrival);
  physics.refreshSceneQueries();
  return { system, presentation, doors, spawn: new THREE.Vector3(0, 0, 18), control, waveSpawned: false,
    resetDoors() {
      for (const info of doorInfos) info.collider.setEnabled(true);
      return new DoorSystem(doorInfos);
    } };
}
