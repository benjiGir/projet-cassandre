import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GROUP, interactionGroups, type PhysicsWorld } from "../../../physics/world";
import { TRAIN_CAR_COUNT, TRAIN_CAR_LENGTH, TRAIN_HEIGHT, TRAIN_WIDTH } from "../../../game/level/trains/trainConfig";
import { poseOnRoute } from "../../../game/level/trains/trainPath";
import type { TrainPass } from "../../../game/level/trains/trainTypes";
import type { TrainSystem } from "../../../game/level/trains/trainSystem";

interface Car {
  mesh: THREE.Object3D;
  body: RAPIER.RigidBody;
}
interface Display {
  mesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  at: THREE.Vector3;
  lanes: readonly string[];
  title: string;
  compact: boolean;
}

export class TrainPresentation {
  private readonly spare: Car[][] = [];
  private readonly allCars: Car[] = [];
  private readonly active = new Map<TrainPass, Car[]>();
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly materials = new Map<number, THREE.MeshLambertMaterial>();
  private readonly displays: Display[] = [];
  private displayAt = -Infinity;
  private readonly position = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();

  constructor(
    private readonly root: THREE.Object3D,
    private readonly physics: PhysicsWorld,
    private readonly model?: THREE.Object3D,
    private readonly bodies?: RAPIER.RigidBody[],
  ) {}

  private box(parent: THREE.Object3D, color: number, size: readonly number[], position: readonly number[]): void {
    let material = this.materials.get(color);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color });
      this.materials.set(color, material);
    }
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.scale.set(size[0], size[1], size[2]);
    mesh.position.set(position[0], position[1], position[2]);
    parent.add(mesh);
  }

  addDisplay(
    at: THREE.Vector3,
    position: THREE.Vector3,
    yaw = 0,
    lanes: readonly string[] = ["A", "B"],
    title = "ESSAI T1 — TRAINS",
    scale = 1,
    compact = false,
  ): void {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 1.8),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide }),
    );
    mesh.position.copy(position);
    mesh.rotation.y = yaw;
    mesh.scale.setScalar(scale);
    const back = new THREE.Mesh(mesh.geometry, mesh.material);
    back.rotation.y = Math.PI;
    back.position.z = -0.01;
    mesh.add(back);
    this.root.add(mesh);
    this.displays.push({ mesh, canvas, texture, at, lanes, title, compact });
  }

  prepare(passes: number): void {
    for (let i = 0; i < passes; i++) this.spare.push(this.createCars());
  }

  get warmMeshes(): THREE.Object3D[] {
    return this.allCars.map((car) => car.mesh);
  }

  private createCars(): Car[] {
    const cars: Car[] = [];
    for (let i = 0; i < TRAIN_CAR_COUNT; i++) {
      const mesh = this.model?.clone(true) ?? new THREE.Group();
      mesh.visible = true;
      if (!this.model) {
        this.box(mesh, 0x69757a, [TRAIN_WIDTH, TRAIN_HEIGHT, TRAIN_CAR_LENGTH - 0.35], [0, TRAIN_HEIGHT / 2, 0]);
        this.box(mesh, 0xd4b54e, [TRAIN_WIDTH + 0.02, 0.22, TRAIN_CAR_LENGTH - 0.35], [0, 0.85, 0]);
        for (const x of [-TRAIN_WIDTH / 2 - 0.015, TRAIN_WIDTH / 2 + 0.015]) {
          for (const z of [-5, -2, 2, 5]) this.box(mesh, 0x17272b, [0.03, 1.15, 1.8], [x, 2.05, z]);
        }
        if (i === 0) {
          this.box(mesh, 0x10252c, [2.2, 1.1, 0.05], [0, 2.15, TRAIN_CAR_LENGTH / 2 - 0.16]);
          for (const x of [-0.95, 0.95])
            this.box(mesh, 0xffe4a0, [0.3, 0.3, 0.08], [x, 0.55, TRAIN_CAR_LENGTH / 2 - 0.14]);
        }
      }
      const body = this.physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(this.position.x, this.position.y, this.position.z)
          .setRotation(this.rotation),
      );
      this.physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(TRAIN_WIDTH / 2, TRAIN_HEIGHT / 2, (TRAIN_CAR_LENGTH - 0.35) / 2)
          .setTranslation(0, TRAIN_HEIGHT / 2, 0)
          .setCollisionGroups(
            interactionGroups(
              GROUP.WORLD,
              GROUP.PLAYER_SHOT | GROUP.ENEMY_SHOT | GROUP.ENEMY | GROUP.PROP | GROUP.DEBRIS,
            ),
          ),
        body,
      );
      this.bodies?.push(body);
      mesh.visible = false;
      body.setEnabled(false);
      this.root.add(mesh);
      const car = { mesh, body };
      cars.push(car);
      this.allCars.push(car);
    }
    return cars;
  }

  private release(cars: Car[]): void {
    for (const car of cars) {
      car.mesh.visible = false;
      car.body.setEnabled(false);
    }
    this.spare.push(cars);
  }

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
        cars.forEach((car, i) => {
          this.pose(pass, pass.front, i);
          car.body.setTranslation(this.position, true);
          car.body.setRotation(this.rotation, true);
        });
        this.active.set(pass, cars);
      }
      cars.forEach((car, i) => {
        const at = pass.front - (i + 0.5) * TRAIN_CAR_LENGTH;
        const visible =
          at >= (pass.route.visibleStart ?? -Infinity) - (pass.route.visualPadding ?? 0) &&
          at <= (pass.route.visibleEnd ?? Infinity) + (pass.route.visualPadding ?? 0);
        this.pose(pass, pass.front, i);
        if (visible && !car.body.isEnabled()) {
          car.body.setTranslation(this.position, true);
          car.body.setRotation(this.rotation, true);
        }
        car.body.setEnabled(visible);
        car.body.setNextKinematicTranslation(this.position);
        car.body.setNextKinematicRotation(this.rotation);
      });
    }
  }

  private pose(pass: TrainPass, front: number, car: number): void {
    poseOnRoute(pass.route, front - (car + 0.5) * TRAIN_CAR_LENGTH, this.position, this.direction);
    this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(this.direction.x, this.direction.z));
  }

  interpolate(system: TrainSystem, alpha: number, elapsed: number): void {
    for (const [pass, cars] of this.active)
      cars.forEach((car, i) => {
        const front = THREE.MathUtils.lerp(pass.previousFront, pass.front, alpha);
        const at = front - (i + 0.5) * TRAIN_CAR_LENGTH;
        car.mesh.visible =
          at >= (pass.route.visibleStart ?? -Infinity) - (pass.route.visualPadding ?? 0) &&
          at <= (pass.route.visibleEnd ?? Infinity) + (pass.route.visualPadding ?? 0);
        this.pose(pass, front, i);
        car.mesh.position.copy(this.position);
        car.mesh.quaternion.copy(this.rotation);
      });
    if (elapsed < this.displayAt + 0.1) return;
    this.displayAt = elapsed;
    for (const display of this.displays) {
      const ctx = display.canvas.getContext("2d")!;
      const status = system.status(display.lanes[0], display.at);
      ctx.fillStyle = "#111b20";
      ctx.fillRect(0, 0, 512, 192);
      ctx.font = "bold 22px monospace";
      ctx.fillStyle = "#c9d7d4";
      ctx.fillText(display.title, 16, 30);
      const warning = system.config.visualWarning && status.announced;
      if (display.compact) {
        ctx.fillStyle = warning ? "#ff7859" : "#adc775";
        ctx.font = "bold 40px monospace";
        ctx.fillText(
          !system.config.visualWarning
            ? "SIGNAL MASQUÉ"
            : !Number.isFinite(status.countdown)
              ? "TRAFIC SUSPENDU"
              : status.countdown <= 0
                ? "RAME EN PASSAGE"
                : `RAME DANS ${Math.ceil(status.countdown)} s`,
          16,
          101,
        );
        ctx.fillStyle = "#c9d7d4";
        ctx.font = "24px monospace";
        ctx.fillText(
          status.stopped > 0 ? `RETENU : ${Math.ceil(status.stopped)} s` : `DIRECTION : ${status.route.toUpperCase()}`,
          16,
          164,
        );
        display.texture.needsUpdate = true;
        continue;
      }
      ctx.fillStyle = warning ? "#ff7859" : "#adc775";
      ctx.font = "bold 32px monospace";
      ctx.fillText(
        !system.config.visualWarning
          ? "SIGNAL MASQUÉ"
          : !Number.isFinite(status.countdown)
            ? "TRAFIC SUSPENDU"
            : status.countdown <= 0
              ? "RAME EN PASSAGE"
              : `VOIE ${status.id} : ${Math.ceil(status.countdown)} s`,
        16,
        77,
      );
      ctx.fillStyle = "#c9d7d4";
      ctx.font = "20px monospace";
      if (display.lanes[1] && display.at.z >= -22) {
        const opposite = system.status(display.lanes[1], display.at);
        ctx.fillStyle = system.config.visualWarning && opposite.announced ? "#ff7859" : "#adc775";
        ctx.fillText(
          !system.config.visualWarning
            ? "VOIE B : signal masqué"
            : opposite.countdown <= 0
              ? "VOIE B : rame en passage"
              : `VOIE B : ${Math.ceil(opposite.countdown)} s`,
          16,
          109,
        );
      } else ctx.fillText(`Route suivante : ${status.route}`, 16, 109);
      ctx.fillText(
        status.stopped > 0 ? `Trafic retenu : ${Math.ceil(status.stopped)} s` : "Jaune = danger / Vert = refuge",
        16,
        146,
      );
      ctx.fillText(`Route : ${status.route} / E : commande`, 16, 175);
      display.texture.needsUpdate = true;
    }
  }

  reset(): void {
    for (const cars of this.active.values()) this.release(cars);
    this.active.clear();
    this.displayAt = -Infinity;
  }

  private removeCar(car: Car): void {
    car.mesh.removeFromParent();
    this.physics.world.removeRigidBody(car.body);
    if (this.bodies) {
      const index = this.bodies.indexOf(car.body);
      if (index >= 0) this.bodies.splice(index, 1);
    }
  }

  dispose(): void {
    this.reset();
    for (const car of this.allCars) this.removeCar(car);
    this.allCars.length = 0;
    this.spare.length = 0;
    for (const display of this.displays) {
      this.root.remove(display.mesh);
      display.mesh.geometry.dispose();
      (display.mesh.material as THREE.Material).dispose();
      display.texture.dispose();
    }
    this.geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
  }
}
