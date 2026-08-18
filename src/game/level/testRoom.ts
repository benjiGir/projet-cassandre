import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsWorld } from "../../physics/world";

export const ROOM_SIZE = 20;
const WALL_HEIGHT = 6;
const WALL_THICKNESS = 0.5;

interface WallDef {
  pos: [number, number, number];
  size: [number, number, number];
}

const WALLS: WallDef[] = [
  { pos: [0, WALL_HEIGHT / 2, -ROOM_SIZE / 2], size: [ROOM_SIZE, WALL_HEIGHT, WALL_THICKNESS] },
  { pos: [0, WALL_HEIGHT / 2, ROOM_SIZE / 2], size: [ROOM_SIZE, WALL_HEIGHT, WALL_THICKNESS] },
  { pos: [-ROOM_SIZE / 2, WALL_HEIGHT / 2, 0], size: [WALL_THICKNESS, WALL_HEIGHT, ROOM_SIZE] },
  { pos: [ROOM_SIZE / 2, WALL_HEIGHT / 2, 0], size: [WALL_THICKNESS, WALL_HEIGHT, ROOM_SIZE] },
];

/** Salle boîte blanche : sol + 4 murs, mesh + collider fixe pour chacun. */
export function buildTestRoom(scene: THREE.Scene, physics: PhysicsWorld) {
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  scene.add(floorMesh);

  const floorBody = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0)
  );
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(ROOM_SIZE / 2, 0.1, ROOM_SIZE / 2), floorBody);

  for (const wall of WALLS) {
    const [w, h, d] = wall.size;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    mesh.position.set(...wall.pos);
    scene.add(mesh);

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(...wall.pos)
    );
    physics.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2), body);
  }
}
