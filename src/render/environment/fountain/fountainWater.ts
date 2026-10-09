import * as THREE from "three";
import type { LevelResources } from "../../../game/level/loading/levelResources";
import { createFountainDroplets, createFountainPools, createFountainStreams } from "./fountainWaterGeometry";
import {
  createFountainClock,
  createFountainDropMaterial,
  createFountainPoolMaterial,
  createFountainStreamMaterial,
} from "./fountainWaterMaterial";

export class FountainWater {
  readonly group = new THREE.Group();
  private readonly clock = createFountainClock();
  private previousTime = 0;
  private currentTime = 0;

  constructor(root: THREE.Object3D, position: THREE.Vector3, resources: LevelResources) {
    this.group.name = "fx_fontaine_eau";
    this.group.position.copy(position);
    const pool = new THREE.Mesh(
      resources.geometry(createFountainPools()),
      resources.material(createFountainPoolMaterial(this.clock)),
    );
    const streams = new THREE.Mesh(
      resources.geometry(createFountainStreams()),
      resources.material(createFountainStreamMaterial(this.clock)),
    );
    const drops = new THREE.Mesh(
      resources.geometry(createFountainDroplets()),
      resources.material(createFountainDropMaterial(this.clock)),
    );
    resources.onCleanup(() => {
      pool.geometry.dispose();
      streams.geometry.dispose();
      drops.geometry.dispose();
      pool.material.dispose();
      streams.material.dispose();
      drops.material.dispose();
    });
    const nozzle = new THREE.Mesh(
      resources.geometry(new THREE.CylinderGeometry(0.072, 0.09, 0.12, 10)),
      resources.material(new THREE.MeshLambertMaterial({ color: 0x627a7c })),
    );
    pool.name = "fx_fontaine_bassins";
    streams.name = "fx_fontaine_jets";
    drops.name = "fx_fontaine_gouttes";
    nozzle.name = "fx_fontaine_buse";
    nozzle.position.y = 1.91;
    this.group.add(pool, streams, drops, nozzle);
    root.add(this.group);
  }

  fixed(dt: number): void {
    this.previousTime = this.currentTime;
    this.currentTime += dt;
  }

  interpolate(alpha: number): void {
    this.clock.value = (this.previousTime + (this.currentTime - this.previousTime) * alpha) % 64;
  }
}

export function createFountainWater(root: THREE.Object3D, resources: LevelResources): FountainWater | null {
  const bounds = new THREE.Box3();
  const localBounds = new THREE.Box3();
  const inverseRoot = root.matrixWorld.clone().invert();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object.userData.kit !== "fontaine_place") return;
    const name = typeof object.userData.name === "string" ? object.userData.name : object.name;
    if (name.startsWith("col_")) return;
    object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) return;
    localBounds.copy(object.geometry.boundingBox).applyMatrix4(inverseRoot.clone().multiply(object.matrixWorld));
    bounds.union(localBounds);
  });
  if (bounds.isEmpty()) return null;
  const position = bounds.getCenter(new THREE.Vector3());
  position.y = bounds.min.y;
  return new FountainWater(root, position, resources);
}
