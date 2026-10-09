import * as THREE from "three";

import { ATLAS_COLUMNS, ATLAS_ROWS, createSplatAtlas } from "./goreAtlas";
import { FLOOR_NORMAL_Y, goreConfig, type SurfaceProbe } from "./goreConfig";

// Les taches de sang du gore : des quads d'UNE géométrie, dans une réserve
// tournante — un seul lot de dessin, quelle que soit la quantité.

/** Taille de départ d'une tache qui s'étale, en part de sa taille finale. */
const GROW_FROM = 0.3;

interface Splat {
  readonly center: THREE.Vector3;
  readonly tangent: THREE.Vector3;
  readonly bitangent: THREE.Vector3;
  size: number;
  /** Longueur le long de `tangent`, en multiples de `size`. */
  stretch: number;
  age: number;
  /** Durée de l'étalement, en secondes ; 0 = posée à sa taille. */
  grow: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const QUAD_CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
/** Points du pourtour vérifiés avant de poser une tache : elle ne dépasse pas d'une arête. */
const FIT_PROBES: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const FIT_REACH = 0.45;

const scratchA = new THREE.Vector3();
const scratchB = new THREE.Vector3();
const scratchC = new THREE.Vector3();

export class GoreSplats {
  readonly mesh: THREE.Mesh;
  private readonly splats: Splat[] = [];
  private readonly growing = new Set<number>();
  private readonly positions: THREE.BufferAttribute;
  private readonly normals: THREE.BufferAttribute;
  private readonly uvs: THREE.BufferAttribute;
  private readonly colors: THREE.BufferAttribute;
  private cursor = 0;
  private used = 0;

  constructor(private readonly random: () => number) {
    const capacity = goreConfig.splatCapacity;
    const geometry = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(new Float32Array(capacity * 12), 3);
    this.normals = new THREE.BufferAttribute(new Float32Array(capacity * 12), 3);
    this.uvs = new THREE.BufferAttribute(new Float32Array(capacity * 8), 2);
    this.colors = new THREE.BufferAttribute(new Float32Array(capacity * 12), 3);
    geometry.setAttribute("position", this.positions);
    geometry.setAttribute("normal", this.normals);
    geometry.setAttribute("uv", this.uvs);
    geometry.setAttribute("color", this.colors);
    const index: number[] = [];
    for (let i = 0; i < capacity; i++) {
      const v = i * 4;
      index.push(v, v + 1, v + 2, v, v + 2, v + 3);
      this.splats.push({
        center: new THREE.Vector3(),
        tangent: new THREE.Vector3(),
        bitangent: new THREE.Vector3(),
        size: 0,
        stretch: 1,
        age: 0,
        grow: 0,
      });
    }
    geometry.setIndex(index);

    // Trous francs (`alphaTest`), jamais de transparence. Sans écriture de
    // profondeur : deux taches superposées se recouvrent dans l'ordre de pose
    // au lieu de scintiller. D'où `renderOrder` plus bas : dessinées avant
    // leur mur, elles seraient repeintes par lui.
    const material = new THREE.MeshLambertMaterial({
      map: createSplatAtlas(),
      alphaTest: 0.5,
      vertexColors: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    // Les taches couvrent tout le niveau : une sphère englobante n'élaguerait rien d'utile.
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
  }

  get count(): number {
    return this.used;
  }

  /**
   * Pose une tache de `size` mètres, réduite ou refusée si elle dépasse de sa
   * surface. Rend la taille posée. `streak` : sur un sol, la tache s'allonge
   * dans cet axe au lieu de rester ronde.
   */
  add(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    size: number,
    grow: number,
    probe: SurfaceProbe | null,
    streak?: { along: THREE.Vector3; stretch: number },
  ): number {
    const floor = Math.abs(normal.y) > FLOOR_NORMAL_Y;
    const index = this.cursor;
    const splat = this.splats[index];
    splat.stretch = 1;

    if (floor) {
      // Sol ou plafond : n'importe quelle orientation autour de la normale, sauf traînée.
      const angle = this.random() * Math.PI * 2;
      splat.tangent.set(Math.cos(angle), 0, Math.sin(angle));
      if (streak) {
        scratchA.copy(streak.along).addScaledVector(normal, -streak.along.dot(normal));
        if (scratchA.lengthSq() > 1e-4) {
          splat.tangent.copy(scratchA);
          splat.stretch = streak.stretch;
        }
      }
      splat.tangent.addScaledVector(normal, -splat.tangent.dot(normal)).normalize();
      splat.bitangent.crossVectors(normal, splat.tangent);
    } else {
      // Mur : le haut de la tache reste en haut, les coulures descendent.
      splat.bitangent.copy(UP).addScaledVector(normal, -normal.y).normalize();
      splat.tangent.crossVectors(splat.bitangent, normal);
    }

    const fitted = probe ? this.fit(point, normal, splat, size, probe) : size;
    if (fitted <= 0) return 0;

    this.cursor = (this.cursor + 1) % this.splats.length;
    this.used = Math.min(this.used + 1, this.splats.length);
    splat.center.copy(point).addScaledVector(normal, goreConfig.surfaceOffset);
    splat.size = fitted;
    splat.age = 0;
    splat.grow = grow;

    const column = Math.floor(this.random() * ATLAS_COLUMNS) % ATLAS_COLUMNS;
    const row = floor ? 0 : 1;
    const mirrored = this.random() < 0.5;
    const u0 = (column + (mirrored ? 1 : 0)) / ATLAS_COLUMNS;
    const u1 = (column + (mirrored ? 0 : 1)) / ATLAS_COLUMNS;
    const v0 = 1 - (row + 1) / ATLAS_ROWS;
    const v1 = 1 - row / ATLAS_ROWS;
    const shade = 0.72 + this.random() * 0.28;
    const v = index * 4;
    this.uvs.setXY(v, u0, v0);
    this.uvs.setXY(v + 1, u1, v0);
    this.uvs.setXY(v + 2, u1, v1);
    this.uvs.setXY(v + 3, u0, v1);
    for (let corner = 0; corner < 4; corner++) {
      this.normals.setXYZ(v + corner, normal.x, normal.y, normal.z);
      this.colors.setXYZ(v + corner, shade, shade, shade);
    }
    this.uvs.needsUpdate = true;
    this.normals.needsUpdate = true;
    this.colors.needsUpdate = true;

    this.writeQuad(index, grow > 0 ? GROW_FROM : 1);
    if (grow > 0) this.growing.add(index);
    else this.growing.delete(index);
    this.mesh.visible = true;
    return fitted;
  }

  /** La plus grande taille, jusqu'à la moitié de celle demandée, dont le pourtour repose sur la même surface. */
  private fit(point: THREE.Vector3, normal: THREE.Vector3, splat: Splat, size: number, probe: SurfaceProbe): number {
    const inward = scratchA.copy(normal).negate();
    for (const candidate of [size, size * 0.5]) {
      let supported = true;
      for (const [t, b] of FIT_PROBES) {
        const origin = scratchB
          .copy(point)
          .addScaledVector(splat.tangent, t * candidate * splat.stretch * FIT_REACH)
          .addScaledVector(splat.bitangent, b * candidate * FIT_REACH)
          .addScaledVector(normal, 0.2);
        const hit = probe(origin, inward, 0.35);
        if (!hit || hit.normal.dot(normal) < 0.9) {
          supported = false;
          break;
        }
      }
      if (supported) return candidate;
    }
    return 0;
  }

  private writeQuad(index: number, scale: number): void {
    const splat = this.splats[index];
    const half = splat.size * scale * 0.5;
    for (let corner = 0; corner < 4; corner++) {
      const [t, b] = QUAD_CORNERS[corner];
      scratchC
        .copy(splat.center)
        .addScaledVector(splat.tangent, t * half * splat.stretch)
        .addScaledVector(splat.bitangent, b * half);
      this.positions.setXYZ(index * 4 + corner, scratchC.x, scratchC.y, scratchC.z);
    }
    this.positions.needsUpdate = true;
  }

  update(realDt: number): void {
    for (const index of this.growing) {
      const splat = this.splats[index];
      splat.age += realDt;
      const t = Math.min(1, splat.age / splat.grow);
      // Part vite, finit lentement : un liquide qui s'étale.
      const eased = 1 - (1 - t) * (1 - t);
      this.writeQuad(index, GROW_FROM + (1 - GROW_FROM) * eased);
      if (t >= 1) this.growing.delete(index);
    }
  }

  reset(): void {
    this.positions.array.fill(0);
    this.positions.needsUpdate = true;
    this.growing.clear();
    this.cursor = 0;
    this.used = 0;
    this.mesh.visible = false;
  }
}
