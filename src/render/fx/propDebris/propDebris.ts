import * as THREE from "three";
import type { SurfaceProbe } from "../goreConfig";
import { FRAGMENT_MATERIALS, FRAGMENT_RECIPES } from "./fragmentRecipes";
import { SurfaceResidue } from "./surfaceResidue";
import { FragmentBatch } from "./fragmentBatch";
import { propDebrisConfig } from "./propDebrisConfig";
import type { FragmentMaterial, FragmentPose, PropDebrisMaterial, PropFragmentSource } from "./propDebrisTypes";

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
  private readonly residue = new SurfaceResidue();
  private readonly meshes: THREE.InstancedMesh[];

  constructor(
    scene: THREE.Scene,
    private readonly random: () => number,
  ) {
    this.batches = Object.fromEntries(
      FRAGMENT_MATERIALS.map((kind) => [kind, new FragmentBatch(kind, random)]),
    ) as Record<FragmentMaterial, FragmentBatch>;
    this.meshes = [...FRAGMENT_MATERIALS.map((kind) => this.batches[kind].mesh), ...Object.values(this.residue.meshes)];
    scene.add(...this.meshes);
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
    for (const mesh of this.meshes) {
      const visible = mesh.visible;
      mesh.getMatrixAt(0, previous);
      mesh.setMatrixAt(0, matrix);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = true;
      try {
        render();
      } finally {
        mesh.setMatrixAt(0, previous);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.visible = visible;
      }
    }
  }

  spawn(kind: PropDebrisMaterial, source: PropFragmentSource): void {
    this.spawnFragments(kind, source);
    if (kind === "electronics") this.spawnFragments("circuit", source);
    if (kind === "flour" || kind === "water")
      this.residue.add(
        kind,
        source.center,
        THREE.MathUtils.clamp(source.halfExtents.length() * 2, 0.55, propDebrisConfig.residueSize),
        this.probe,
      );
  }

  private spawnFragments(kind: FragmentMaterial, source: PropFragmentSource): void {
    const { halfExtents: half } = source;
    const recipe = FRAGMENT_RECIPES[kind];
    const count = recipe.count;
    const strength = THREE.MathUtils.clamp(source.strength, 0.5, 3);
    for (let i = 0; i < count; i++) {
      const face = FACE_NORMALS[i % FACE_NORMALS.length];
      this.normal.copy(face).applyQuaternion(source.rotation);
      this.offset.copy(face).multiply(half).multiplyScalar(0.82).applyQuaternion(source.rotation);
      this.pose.position.copy(source.center).add(this.offset);
      this.pose.rotation.setFromUnitVectors(UP, face).premultiply(source.rotation);
      const width = face.x !== 0 ? half.z * 2 : half.x * 2;
      const length = face.y !== 0 ? half.z * 2 : half.y * 2;
      const scale = 0.85 + this.random() * 0.3;
      const minimum = recipe.lifetime ? 0.025 : 0.1;
      this.pose.scale.set(
        THREE.MathUtils.clamp(width * recipe.width * scale, minimum, recipe.maxWidth),
        recipe.thickness,
        THREE.MathUtils.clamp(length * recipe.length * scale, minimum, recipe.maxLength),
      );
      const speed = recipe.speed * strength * propDebrisConfig.speedScale;
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
      this.pose.color.set(recipe.tint);
      if (recipe.sourceTint && !neutral) this.pose.color.copy(source.color);
      this.pose.color.multiplyScalar(0.85 + this.random() * 0.3);
      this.batches[kind].spawn(this.pose);
    }
  }

  update(dt: number): void {
    for (const kind of FRAGMENT_MATERIALS) this.batches[kind].update(dt, this.probe);
  }
  reset(): void {
    for (const batch of Object.values(this.batches)) batch.reset();
    this.residue.reset();
    this.probe = null;
  }
}
