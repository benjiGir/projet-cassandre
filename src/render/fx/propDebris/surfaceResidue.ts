import * as THREE from "three";
import { configureRetroTexture } from "../../pipeline/renderer";
import { FLOOR_NORMAL_Y, type SurfaceProbe } from "../goreConfig";
import { propDebrisConfig } from "./propDebrisConfig";

type ResidueKind = "farine" | "eau";
const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const FIT_POINTS = [
  [-0.45, -0.45],
  [0.45, -0.45],
  [0.45, 0.45],
  [-0.45, 0.45],
] as const;

function createResidue(kind: ResidueKind): THREE.InstancedMesh {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const dx = (x - 32) / 29,
        dy = (y - 32) / 25;
      const angle = Math.atan2(dy, dx);
      const edge = 0.82 + Math.sin(angle * 5) * 0.1 + Math.cos(angle * 9) * 0.06;
      const distance = Math.hypot(dx, dy);
      const noise = ((x * 17 + y * 23 + x * y * 7) % 97) / 97;
      if (distance > edge || (kind === "farine" && noise < distance * 0.5)) continue;
      ctx.fillStyle =
        kind === "farine" ? (noise > 0.6 ? "#e6dcc2" : "#c6bda7") : distance > edge - 0.07 ? "#647a78" : "#384f50";
      ctx.fillRect(x, y, 1, 1);
    }
  const texture = new THREE.CanvasTexture(canvas);
  configureRetroTexture(texture);
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    alphaTest: 0.5,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    material,
    propDebrisConfig.residueCapacity,
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.visible = false;
  for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, HIDDEN);
  return mesh;
}

export class SurfaceResidue {
  readonly meshes = { farine: createResidue("farine"), eau: createResidue("eau") };
  private readonly cursors = { farine: 0, eau: 0 };
  private readonly origin = new THREE.Vector3();
  private readonly corner = new THREE.Vector3();
  private readonly inward = new THREE.Vector3();
  private readonly facing = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();

  add(kind: ResidueKind, center: THREE.Vector3, size: number, probe: SurfaceProbe | null): void {
    if (!probe) return;
    const hit = probe(this.origin.copy(center).addScaledVector(UP, 0.05), DOWN, propDebrisConfig.residueReach);
    if (!hit || hit.normal.y < FLOOR_NORMAL_Y) return;
    this.facing.setFromUnitVectors(UP, hit.normal);
    this.inward.copy(hit.normal).negate();
    for (const candidate of [size, size * 0.5]) {
      const fits = FIT_POINTS.every(([x, z]) => {
        this.corner
          .set(x * candidate, 0, z * candidate)
          .applyQuaternion(this.facing)
          .add(hit.point)
          .addScaledVector(hit.normal, 0.15);
        const support = probe(this.corner, this.inward, 0.3);
        return (
          support !== null && support.normal.dot(hit.normal) > 0.95 && support.point.distanceTo(this.corner) < 0.22
        );
      });
      if (!fits) continue;
      const mesh = this.meshes[kind],
        index = this.cursors[kind];
      this.origin.copy(hit.point).addScaledVector(hit.normal, propDebrisConfig.surfaceOffset);
      this.scale.set(candidate, 1, candidate);
      mesh.setMatrixAt(index, this.matrix.compose(this.origin, this.facing, this.scale));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = true;
      this.cursors[kind] = (index + 1) % mesh.count;
      return;
    }
  }

  reset(): void {
    for (const kind of ["farine", "eau"] as const) {
      const mesh = this.meshes[kind];
      for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, HIDDEN);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = false;
      this.cursors[kind] = 0;
    }
  }
}
