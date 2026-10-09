import * as THREE from "three";

import { FLOOR_NORMAL_Y, goreConfig, type SurfaceHit, type SurfaceProbe } from "./goreConfig";

// Les morceaux d'un ennemi qui éclate : un `InstancedMesh`, dans une réserve
// tournante. Ils volent, heurtent le décor et s'y posent.

const GRAVITY = -25;

interface Chunk {
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly rotation: THREE.Euler;
  readonly scale: THREE.Vector3;
  active: boolean;
  flying: boolean;
  flight: number;
}

const CHUNK_COLORS = [0x3a120f, 0x5a1418, 0x7a1e1e, 0x8f3a34].map((hex) => new THREE.Color(hex));
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const chunkMatrix = new THREE.Matrix4();
const chunkQuaternion = new THREE.Quaternion();
const stepDirection = new THREE.Vector3();

export class GoreChunks {
  readonly mesh: THREE.InstancedMesh;
  private readonly chunks: Chunk[] = [];
  private cursor = 0;

  constructor(private readonly random: () => number) {
    const capacity = goreConfig.chunkCapacity;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), capacity);
    // three calcule la sphère englobante une seule fois, toutes instances à l'origine.
    this.mesh.frustumCulled = false;
    for (let i = 0; i < capacity; i++) {
      this.chunks.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        scale: new THREE.Vector3(),
        active: false,
        flying: false,
        flight: 0,
      });
      this.mesh.setMatrixAt(i, HIDDEN);
      this.mesh.setColorAt(i, CHUNK_COLORS[0]);
    }
    this.mesh.visible = false;
  }

  get resting(): number {
    return this.chunks.filter((chunk) => chunk.active && !chunk.flying).length;
  }

  get flying(): number {
    return this.chunks.filter((chunk) => chunk.active && chunk.flying).length;
  }

  spawn(point: THREE.Vector3, direction: THREE.Vector3, count: number): void {
    const [speedMin, speedMax] = goreConfig.chunkSpeed;
    const [sizeMin, sizeMax] = goreConfig.chunkSize;
    const spread = goreConfig.chunkSpread;
    for (let i = 0; i < count; i++) {
      const index = this.cursor;
      this.cursor = (this.cursor + 1) % this.chunks.length;
      const chunk = this.chunks[index];
      chunk.position.copy(point);
      chunk.velocity
        .set(
          direction.x + (this.random() * 2 - 1) * spread,
          direction.y + (this.random() * 2 - 1) * spread + 0.8,
          direction.z + (this.random() * 2 - 1) * spread,
        )
        .normalize()
        .multiplyScalar(speedMin + this.random() * (speedMax - speedMin));
      const size = sizeMin + this.random() * (sizeMax - sizeMin);
      // Silhouette cassée : jamais un cube.
      chunk.scale.set(
        size * (0.6 + this.random() * 0.8),
        size * (0.5 + this.random() * 0.6),
        size * (0.6 + this.random() * 0.8),
      );
      chunk.rotation.set(this.random() * Math.PI, this.random() * Math.PI, this.random() * Math.PI);
      chunk.active = true;
      chunk.flying = true;
      chunk.flight = 0;
      this.mesh.setColorAt(index, CHUNK_COLORS[Math.floor(this.random() * CHUNK_COLORS.length) % CHUNK_COLORS.length]);
      this.write(index);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.visible = true;
  }

  private write(index: number): void {
    const chunk = this.chunks[index];
    if (!chunk.active) {
      this.mesh.setMatrixAt(index, HIDDEN);
    } else {
      chunkQuaternion.setFromEuler(chunk.rotation);
      this.mesh.setMatrixAt(index, chunkMatrix.compose(chunk.position, chunkQuaternion, chunk.scale));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** `onImpact` : un morceau vient de heurter le décor, à cet endroit. */
  update(realDt: number, probe: SurfaceProbe | null, onImpact: (hit: SurfaceHit) => void): void {
    for (let index = 0; index < this.chunks.length; index++) {
      const chunk = this.chunks[index];
      if (!chunk.active || !chunk.flying) continue;

      chunk.flight += realDt;
      if (chunk.flight > goreConfig.chunkMaxFlight) {
        chunk.active = false;
        this.write(index);
        continue;
      }

      chunk.velocity.y += GRAVITY * realDt;
      const distance = chunk.velocity.length() * realDt;
      const hit =
        probe && distance > 1e-6
          ? probe(chunk.position, stepDirection.copy(chunk.velocity).normalize(), distance + chunk.scale.y * 0.5)
          : null;
      if (!hit) {
        chunk.position.addScaledVector(chunk.velocity, realDt);
        chunk.rotation.x += realDt * 10;
        chunk.rotation.z += realDt * 7;
      } else {
        onImpact(hit);
        chunk.position.copy(hit.point).addScaledVector(hit.normal, chunk.scale.y * 0.5);
        if (hit.normal.y > FLOOR_NORMAL_Y) {
          // Posé : à plat, et il y reste.
          chunk.flying = false;
          chunk.rotation.set(0, chunk.rotation.y, 0);
        } else {
          // Contre un mur ou un plafond : il s'écrase, glisse et retombe.
          chunk.velocity.reflect(hit.normal).multiplyScalar(goreConfig.chunkRestitution);
        }
      }
      this.write(index);
    }
  }

  reset(): void {
    for (let index = 0; index < this.chunks.length; index++) {
      this.chunks[index].active = false;
      this.mesh.setMatrixAt(index, HIDDEN);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.cursor = 0;
    this.mesh.visible = false;
  }
}
