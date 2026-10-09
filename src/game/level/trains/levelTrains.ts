import type * as THREE from "three";
import { Vector3 } from "three";
import type { PhysicsWorld } from "../../../physics/world";
import type { Difficulty } from "../../session/progression/difficulty";
import type { LevelResources } from "../loading/levelResources";
import { TrainPresentation } from "../../../render/environment/trainGym/trainPresentation";
import { TrainBeacons } from "../../../render/environment/trainGym/trainBeacons";
import { TrainSystem } from "./trainSystem";
import { trainDifficulty } from "./trainDifficulty";
import type { TrainLevelData } from "./trainLevelData";
import type { TrainConfig } from "./trainTypes";
import { distanceAlongRoute, poseOnRoute } from "./trainPath";

// see: docs/4-technique/trains-metro.md#cycle-de-vie
export class LevelTrains {
  readonly config: TrainConfig = trainDifficulty("habitue");
  readonly system: TrainSystem;
  readonly presentation: TrainPresentation;
  readonly beacons: TrainBeacons;
  private resetRequested = false;
  private readonly crossingEntries = new Map<number, number>();
  private readonly center = new Vector3();
  private readonly forward = new Vector3();

  constructor(private readonly root: THREE.Object3D, physics: PhysicsWorld, readonly data: TrainLevelData, resources: LevelResources) {
    this.system = new TrainSystem(data.lanes, this.config);
    this.presentation = new TrainPresentation(root, physics, data.model, resources.bodies);
    this.beacons = new TrainBeacons(root, data.signals.filter(signal => signal.appearance === "feu"));
    resources.onCleanup(() => { this.presentation.dispose(); this.beacons.dispose(); });
    this.presentation.prepare(data.lanes.length * 2);
    for (const signal of data.signals) {
      if (signal.appearance !== "ecran") continue;
      this.presentation.addDisplay(signal.position, signal.position, signal.yaw, [signal.lane], "TRAFIC — VOIE " + signal.lane, .5, true);
    }
  }

  setDifficulty(difficulty: Difficulty): void {
    Object.assign(this.config, trainDifficulty(difficulty));
    this.system.reset();
  }

  use(name: string): void {
    const command = this.data.commands.get(name);
    if (command) this.system.enqueue(command);
  }

  fixed(dt: number, listener: THREE.Vector3): void {
    if (!this.active) return;
    if (this.resetRequested) {
      this.presentation.reset();
      this.crossingEntries.clear();
      this.resetRequested = false;
    }
    this.system.update(dt, listener);
    this.presentation.updateFixed(this.system);
  }

  get active(): boolean { return this.root.visible; }

  reset(): void {
    this.system.enqueue({ type: "reset" });
    this.resetRequested = true;
  }

  crossed(position: THREE.Vector3): number {
    let completed = 0;
    for (let index = 0; index < this.data.crossings.length; index++) {
      const crossing = this.data.crossings[index]!;
      const route = this.data.lanes.find((lane) => lane.id === crossing.lane)!.routes[0]!;
      crossing.box.getCenter(this.center);
      poseOnRoute(route, distanceAlongRoute(route, this.center), this.center, this.forward);
      const lateral = (position.x - this.center.x) * this.forward.z - (position.z - this.center.z) * this.forward.x;
      const sign = Math.sign(lateral);
      if (crossing.box.containsPoint(position)) {
        if (!this.crossingEntries.has(index) && sign !== 0) this.crossingEntries.set(index, sign);
      } else {
        const entered = this.crossingEntries.get(index);
        if (entered !== undefined && sign !== entered && Math.abs(lateral) > 1.8) completed++;
        this.crossingEntries.delete(index);
      }
    }
    return completed;
  }
}
