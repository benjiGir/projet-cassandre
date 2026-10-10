import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { COLLISION_GROUPS, type PhysicsWorld } from "../../../physics/world";
import { buildGym } from "../../level/catalog/gym";
import type { PersistentEngine } from "../gameEngine";
import type { GameSession } from "../gameSession";
import { spawnSuitAt } from "../spawning";
import { disposeModeRoot, type BuiltLevelMode, type LevelMode } from "./levelMode";

const BALL_RADIUS = 0.4;
const BALL_START = new THREE.Vector3(3, 4, 0);
/** Garde verticale des ennemis posés à la main, la même que celle du joueur. */
const SPAWN_FEET_GUARD = 0.1;

// La salle d'essai : la boîte blanche de `catalog/gym.ts`, une balle témoin de
// collision dynamique, et une rencontre par espèce d'ennemi.
// see: docs/6-reference/notes-code-gameplay.md#session-et-moteur
class GymMode implements LevelMode {
  readonly entityCount = 1;
  private readonly ballPrevPos = BALL_START.clone();
  private readonly ballPrevQuat = new THREE.Quaternion();
  private readonly ballCurrPos = BALL_START.clone();
  private readonly ballCurrQuat = new THREE.Quaternion();

  constructor(
    private readonly scene: THREE.Object3D,
    private readonly root: THREE.Group,
    private readonly ballMesh: THREE.Mesh,
    private readonly ballBody: RAPIER.RigidBody,
  ) {}

  populate(engine: PersistentEngine, session: GameSession): void {
    spawnSuitAt(engine, session, -9, SPAWN_FEET_GUARD, 5);
    spawnSuitAt(engine, session, 9, SPAWN_FEET_GUARD, 5);
    spawnSuitAt(engine, session, 0, SPAWN_FEET_GUARD, 13);
    // Rencontre d'essai du Rampant : une meute de quatre, au fond de la salle.
    for (const [x, z] of [
      [-6, 17],
      [-2, 19],
      [2, 19],
      [6, 17],
    ] as const) {
      spawnSuitAt(engine, session, x, SPAWN_FEET_GUARD, z, "rampant");
    }
    // Rencontre d'essai du Vigile : seul, à l'écart, avec la place de lui tourner autour.
    spawnSuitAt(engine, session, -14, SPAWN_FEET_GUARD, -6, "vigile");
  }

  snapshotPrevious(): void {
    this.ballPrevPos.copy(this.ballCurrPos);
    this.ballPrevQuat.copy(this.ballCurrQuat);
  }

  syncFromPhysics(): void {
    const t = this.ballBody.translation();
    const r = this.ballBody.rotation();
    this.ballCurrPos.set(t.x, t.y, t.z);
    this.ballCurrQuat.set(r.x, r.y, r.z, r.w);
  }

  interpolate(alpha: number): void {
    this.ballMesh.position.lerpVectors(this.ballPrevPos, this.ballCurrPos, alpha);
    this.ballMesh.quaternion.slerpQuaternions(this.ballPrevQuat, this.ballCurrQuat, alpha);
  }

  dispose(): void {
    disposeModeRoot(this.scene, this.root);
  }
}

export function buildGymMode(scene: THREE.Object3D, physics: PhysicsWorld): BuiltLevelMode {
  const root = new THREE.Group();
  scene.add(root);
  const gym = buildGym(root, physics);

  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 16, 12),
    new THREE.MeshLambertMaterial({ color: 0x4488cc }),
  );
  // Enfant de la racine du mode : un seul retrait de scène emporte la salle et la balle.
  root.add(ballMesh);

  const ballBody = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(BALL_START.x, BALL_START.y, BALL_START.z).setLinvel(-2, 0, 3),
  );
  physics.world.createCollider(
    RAPIER.ColliderDesc.ball(BALL_RADIUS)
      .setRestitution(0.7)
      // Groupe WORLD : elle doit rester heurtable par le joueur (un groupe
      // DEBRIS ne collisionnerait qu'avec le décor).
      .setCollisionGroups(COLLISION_GROUPS.WORLD),
    ballBody,
  );

  return { mode: new GymMode(scene, root, ballMesh, ballBody), spawn: gym.spawn, spawnYaw: gym.spawnYaw };
}
