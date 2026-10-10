import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GROUP, interactionGroups, type PhysicsWorld } from "../../../physics/world";
import { carDistance, carOnStage, poseCar } from "./trainCars";
import { TRAIN_CAR_BODY_LENGTH, TRAIN_CAR_COUNT, TRAIN_HEIGHT, TRAIN_WIDTH } from "./trainConfig";
import type { TrainSystem } from "./trainSystem";
import type { TrainPass } from "./trainTypes";

// Les corps cinématiques des voitures : ils arrêtent les tirs, les ennemis et
// les props. Le joueur n'est pas dans leurs groupes — il meurt au contact du
// volume balayé, sans être poussé.
// see: docs/4-technique/trains-metro.md#contact-mortel
export class TrainCarBodies {
  private readonly spare: RAPIER.RigidBody[][] = [];
  private readonly all: RAPIER.RigidBody[] = [];
  private readonly active = new Map<TrainPass, RAPIER.RigidBody[]>();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();

  /** `owned` : liste des corps du niveau, que son nettoyage retire du monde ; chaque corps créé ici y est inscrit. */
  constructor(
    private readonly physics: PhysicsWorld,
    private readonly owned?: RAPIER.RigidBody[],
  ) {}

  /** Crée d'avance les corps de `passes` rames, pour ne rien allouer à la première entrée en voie. */
  prepare(passes: number): void {
    for (let i = 0; i < passes; i++) this.spare.push(this.createCars());
  }

  private createCars(): RAPIER.RigidBody[] {
    const cars: RAPIER.RigidBody[] = [];
    for (let i = 0; i < TRAIN_CAR_COUNT; i++) {
      const body = this.physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(this.position.x, this.position.y, this.position.z)
          .setRotation(this.rotation),
      );
      this.physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(TRAIN_WIDTH / 2, TRAIN_HEIGHT / 2, TRAIN_CAR_BODY_LENGTH / 2)
          .setTranslation(0, TRAIN_HEIGHT / 2, 0)
          .setCollisionGroups(
            interactionGroups(
              GROUP.WORLD,
              GROUP.PLAYER_SHOT | GROUP.ENEMY_SHOT | GROUP.ENEMY | GROUP.PROP | GROUP.DEBRIS,
            ),
          ),
        body,
      );
      this.owned?.push(body);
      body.setEnabled(false);
      cars.push(body);
      this.all.push(body);
    }
    return cars;
  }

  private release(cars: RAPIER.RigidBody[]): void {
    for (const body of cars) body.setEnabled(false);
    this.spare.push(cars);
  }

  private teleport(body: RAPIER.RigidBody): void {
    body.setTranslation(this.position, true);
    body.setRotation(this.rotation, true);
  }

  /** Un pas fixe, après `system.update` : une rame sortie rend ses corps, une rame entrée en prend. */
  updateFixed(system: TrainSystem): void {
    for (const [pass, cars] of this.active) {
      if (system.passes.includes(pass)) continue;
      this.release(cars);
      this.active.delete(pass);
    }
    for (const pass of system.passes) {
      let cars = this.active.get(pass);
      if (!cars) {
        cars = this.spare.pop() ?? this.createCars();
        cars.forEach((body, i) => {
          poseCar(pass, pass.front, i, this.position, this.rotation);
          this.teleport(body);
        });
        this.active.set(pass, cars);
      }
      cars.forEach((body, i) => {
        const onStage = carOnStage(pass.route, carDistance(pass.front, i));
        poseCar(pass, pass.front, i, this.position, this.rotation);
        // Un corps qui entre en scène y est posé d'un coup : sans cela il balaierait tout le trajet depuis sa dernière pose.
        if (onStage && !body.isEnabled()) this.teleport(body);
        body.setEnabled(onStage);
        body.setNextKinematicTranslation(this.position);
        body.setNextKinematicRotation(this.rotation);
      });
    }
  }

  reset(): void {
    for (const cars of this.active.values()) this.release(cars);
    this.active.clear();
  }

  dispose(): void {
    this.reset();
    for (const body of this.all) {
      this.physics.world.removeRigidBody(body);
      const index = this.owned?.indexOf(body) ?? -1;
      if (index >= 0) this.owned?.splice(index, 1);
    }
    this.all.length = 0;
    this.spare.length = 0;
  }
}
