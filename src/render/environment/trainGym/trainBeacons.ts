import * as THREE from "three";
import type { TrainSignal } from "../../../game/level/trains/trainLevelData";
import type { TrainSystem } from "../../../game/level/trains/trainSystem";

// see: docs/4-technique/blockout-metro.md#signaux-et-cadence
export class TrainBeacons {
  private readonly housing: THREE.InstancedMesh;
  private readonly bulbs: THREE.InstancedMesh;
  private readonly states: Int8Array;
  private updatedAt = -Infinity;
  private readonly color = new THREE.Color();
  private readonly colors = [0x7dbe9e, 0xefb14f, 0xee6148, 0x172126];

  constructor(private readonly root: THREE.Object3D, private readonly signals: readonly TrainSignal[]) {
    this.housing = new THREE.InstancedMesh(new THREE.BoxGeometry(.26, .52, .2), new THREE.MeshLambertMaterial({ color: 0x202a2e }), signals.length);
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.15, 8, 4), new THREE.MeshBasicMaterial(), signals.length);
    this.states = new Int8Array(signals.length).fill(-1);
    const pose = new THREE.Object3D();
    signals.forEach((signal, i) => {
      pose.position.copy(signal.position); pose.rotation.y = signal.yaw; pose.updateMatrix();
      this.housing.setMatrixAt(i, pose.matrix);
      this.bulbs.setMatrixAt(i, pose.matrix);
      this.bulbs.setColorAt(i, this.color.setHex(this.colors[0]!));
    });
    root.add(this.housing, this.bulbs);
  }

  update(system: TrainSystem, elapsed: number): void {
    if (elapsed < this.updatedAt + .1) return;
    this.updatedAt = elapsed;
    let changed = false;
    this.signals.forEach((signal, i) => {
      const status = system.status(signal.lane, signal.position);
      const state = !system.config.visualWarning || !status.enabled ? 3 : status.countdown <= 0 ? 2 : status.announced ? 1 : 0;
      if (state === this.states[i]) return;
      this.states[i] = state;
      this.bulbs.setColorAt(i, this.color.setHex(this.colors[state]!)); changed = true;
    });
    if (changed) this.bulbs.instanceColor!.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [this.housing, this.bulbs]) {
      this.root.remove(mesh); mesh.dispose(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
    }
  }
}
