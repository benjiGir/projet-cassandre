import * as THREE from "three";
import type { SurfaceProbe } from "../goreConfig";
import { FragmentBatch } from "./fragmentBatch";
import { propDebrisConfig } from "./propDebrisConfig";
import type { FragmentMaterial, FragmentPose, PropFragmentSource } from "./propDebrisTypes";

const UP = new THREE.Vector3(0, 1, 0);
const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  UP,
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

export class PropDebris {
  private readonly batches: Record<FragmentMaterial, FragmentBatch>;
  private probe: SurfaceProbe | null = null;
  private readonly pose: FragmentPose = {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    scale: new THREE.Vector3(),
    rotation: new THREE.Quaternion(),
    color: new THREE.Color(),
  };
  private readonly normal = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private readonly scatter = new THREE.Vector3();
  private readonly tint = { carton: new THREE.Color(0xb49568), bois: new THREE.Color(0x987447) };

  constructor(
    scene: THREE.Scene,
    private readonly random: () => number,
  ) {
    this.batches = { carton: new FragmentBatch("carton", random), bois: new FragmentBatch("bois", random) };
    scene.add(this.batches.carton.mesh, this.batches.bois.mesh);
  }

  setSurfaceProbe(probe: SurfaceProbe | null): void {
    this.probe = probe;
  }

  warm(camera: THREE.Camera, render: () => void): void {
    const position = new THREE.Vector3(),
      direction = new THREE.Vector3();
    camera.getWorldPosition(position);
    camera.getWorldDirection(direction);
    const matrix = new THREE.Matrix4().makeScale(0.4, 0.4, 0.4).setPosition(position.addScaledVector(direction, 2));
    const previous = new THREE.Matrix4();
    for (const batch of Object.values(this.batches)) {
      const visible = batch.mesh.visible;
      batch.mesh.getMatrixAt(0, previous);
      batch.mesh.setMatrixAt(0, matrix);
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.mesh.visible = true;
      try {
        render();
      } finally {
        batch.mesh.setMatrixAt(0, previous);
        batch.mesh.instanceMatrix.needsUpdate = true;
        batch.mesh.visible = visible;
      }
    }
  }

  spawn(kind: FragmentMaterial, source: PropFragmentSource): void {
    const { halfExtents: half } = source;
    const count = kind === "carton" ? propDebrisConfig.cardboardCount : propDebrisConfig.woodCount;
    const strength = THREE.MathUtils.clamp(source.strength, 0.5, 3);
    for (let i = 0; i < count; i++) {
      const face = FACE_NORMALS[i % FACE_NORMALS.length];
      this.normal.copy(face).applyQuaternion(source.rotation);
      this.offset.copy(face).multiply(half).multiplyScalar(0.82).applyQuaternion(source.rotation);
      this.pose.position.copy(source.center).add(this.offset);
      this.pose.rotation.setFromUnitVectors(UP, face).premultiply(source.rotation);
      const width = face.x !== 0 ? half.z * 2 : half.x * 2;
      const length = face.y !== 0 ? half.z * 2 : half.y * 2;
      const scale = 0.7 + this.random() * 0.22;
      this.pose.scale.set(
        THREE.MathUtils.clamp(
          width * (kind === "carton" ? scale : 0.22 + this.random() * 0.18),
          0.1,
          kind === "carton" ? 1.1 : 0.4,
        ),
        kind === "carton" ? 0.028 : 0.035,
        THREE.MathUtils.clamp(length * scale, 0.14, 1.3),
      );
      const speed = (kind === "carton" ? 0.75 : 1.4) * strength * propDebrisConfig.speedScale;
      this.pose.velocity
        .copy(this.normal)
        .multiplyScalar(speed * 0.6)
        .addScaledVector(source.direction, speed)
        .add(
          this.scatter.set(
            (this.random() - 0.5) * speed,
            (0.65 + this.random() * 0.65) * strength * propDebrisConfig.liftScale,
            (this.random() - 0.5) * speed,
          ),
        );
      const neutral =
        Math.max(source.color.r, source.color.g, source.color.b) -
          Math.min(source.color.r, source.color.g, source.color.b) <
        0.05;
      this.pose.color.copy(neutral ? this.tint[kind] : source.color).multiplyScalar(0.85 + this.random() * 0.3);
      this.batches[kind].spawn(this.pose);
    }
  }

  update(dt: number): void {
    this.batches.carton.update(dt, this.probe);
    this.batches.bois.update(dt, this.probe);
  }
  reset(): void {
    for (const batch of Object.values(this.batches)) batch.reset();
    this.probe = null;
  }
}
