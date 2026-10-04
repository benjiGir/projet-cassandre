import * as THREE from "three";

import { configureRetroTexture } from "../pipeline/renderer";

// Le gore : ce qu'un ennemi laisse sur le décor. Des éclaboussures PERSISTANTES
// au sol et aux murs, et des morceaux qui volent, heurtent le décor et y
// restent. Tout est cosmétique : temps d'affichage, flux de présentation,
// aucun effet sur la simulation.
//
// Deux lots de dessin en tout, quelle que soit la quantité de sang : les
// éclaboussures sont des quads d'UNE géométrie, les morceaux un `InstancedMesh`.
// Les plus anciens sont repris quand la réserve est pleine.

export interface SurfaceHit {
  point: THREE.Vector3;
  /** Unitaire, tournée vers l'origine du rayon. */
  normal: THREE.Vector3;
}

/**
 * Premier décor STATIQUE sur un rayon (`direction` unitaire), ou `null`. Fourni
 * par le jeu : le rendu ne connaît pas Rapier. Un décor mobile ou cassable
 * n'est jamais rendu — une tache y resterait suspendue en l'air.
 */
export type SurfaceProbe = (origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number) => SurfaceHit | null;

type Range = readonly [number, number];

// Valeurs de départ, à juger en jouant.
export const goreConfig = {
  splatCapacity: 192,
  chunkCapacity: 48,
  /** Écart entre la tache et sa surface, en mètres — voir le z-fighting des habillages affleurants. */
  surfaceOffset: 0.015,

  /** Flaque sous un ennemi mort sans exploser : elle s'étale lentement. */
  deathPoolSize: [1.1, 1.6] as Range,
  deathPoolGrow: 1.6,

  /** Flaque d'un ennemi qui explose : plus large, et d'un coup. */
  gibPoolSize: [1.9, 2.5] as Range,
  gibPoolGrow: 0.3,
  /** Giclées projetées dans l'axe du coup, et leur portée en mètres. */
  gibSprayCount: 12,
  gibSprayRange: 5,
  gibSpraySpread: 0.8,
  gibSpraySize: [0.6, 1.1] as Range,
  /** Au sol, une giclée s'allonge dans l'axe du coup : longueur en multiples de sa largeur. */
  gibSprayStretch: [1.4, 2.4] as Range,
  gibSprayGrow: 0.12,
  gibChunks: 14,

  chunkSpeed: [3, 8] as Range,
  chunkSpread: 0.9,
  chunkSize: [0.07, 0.17] as Range,
  /** Tache laissée par un morceau à chaque choc. */
  chunkSplatSize: [0.25, 0.45] as Range,
  /** Part de la vitesse gardée après un choc contre un mur : c'est mou, ça ne rebondit presque pas. */
  chunkRestitution: 0.2,
  /** Un morceau qui n'a rien touché au bout de ce temps disparaît (chute hors du niveau). */
  chunkMaxFlight: 3,

  /** Giclée derrière un ennemi touché sans mourir. */
  hitSprayRange: 3.5,
  hitSpraySize: [0.3, 0.55] as Range,
  hitSprayChance: { melee: 1, pistol: 1, shotgun: 0.4 } as Record<"melee" | "pistol" | "shotgun", number>,
};

const GRAVITY = -25;
/** Au-delà de cette pente, une surface est un sol : la tache y est ronde et le morceau s'y pose. */
const FLOOR_NORMAL_Y = 0.6;
/** Taille de départ d'une tache qui s'étale, en part de sa taille finale. */
const GROW_FROM = 0.3;

// --- Atlas des taches -------------------------------------------------------
// Dessiné par le code, sans tirage : huit formes fixes, gros pixels francs.
// Ligne du haut : taches rondes (sols, plafonds). Ligne du bas : taches à
// coulures (murs), posées coulures vers le bas.

const CELL = 32;
const COLUMNS = 4;
const ROWS = 2;
/** Bord transparent de chaque case : les mipmaps n'y mélangent que du vide. */
const MARGIN = 2;

const RIM = [0x4a, 0x0a, 0x0e] as const;
const BODY = [0x8c, 0x12, 0x18] as const;
const CORE = [0x5f, 0x0c, 0x11] as const;
const GLINT = [0xb5, 0x2a, 0x2a] as const;

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 0x100000000;
}

interface Disc { x: number; y: number; r: number }
interface Drip { x: number; top: number; bottom: number; halfWidth: number }

function splatShapes(variant: number, wall: boolean): { discs: Disc[]; drips: Drip[] } {
  let serial = variant * 1000;
  const next = () => hash(serial++);
  const between = (min: number, max: number) => min + next() * (max - min);
  const discs: Disc[] = [];
  const drips: Drip[] = [];

  const main: Disc = wall
    ? { x: between(14.5, 17.5), y: between(10, 11.5), r: between(5.5, 7) }
    : { x: between(15.5, 16.5), y: between(15.5, 16.5), r: between(7, 8.5) };
  discs.push(main);
  /** Rayon utile de la case : rien ne vient s'y faire couper net par la marge. */
  const reach = wall ? main.y - MARGIN : CELL / 2 - MARGIN - 0.5;

  // Lobes : la tache n'est jamais un disque.
  const lobes = Math.round(between(6, 10));
  for (let i = 0; i < lobes; i++) {
    const angle = between(0, Math.PI * 2);
    const r = between(2.2, 4.5);
    const distance = Math.min(main.r * between(0.7, 1.15), reach - r);
    discs.push({ x: main.x + Math.cos(angle) * distance, y: main.y + Math.sin(angle) * distance, r });
  }

  // Gouttes projetées, alignées par deux ou trois sur un même rayon.
  const rays = Math.round(between(4, 7));
  for (let i = 0; i < rays; i++) {
    const angle = wall ? between(Math.PI, Math.PI * 2) : between(0, Math.PI * 2);
    let distance = main.r + between(1.5, 2.5);
    const drops = Math.round(between(1, 3));
    for (let j = 0; j < drops; j++) {
      const r = between(0.8, 1.5);
      if (distance + r > reach) break;
      discs.push({ x: main.x + Math.cos(angle) * distance, y: main.y + Math.sin(angle) * distance, r });
      distance += between(1.8, 2.6);
    }
  }

  if (wall) {
    const count = Math.round(between(2, 4));
    for (let i = 0; i < count; i++) {
      const x = Math.round(main.x + between(-main.r, main.r) * 0.9);
      const bottom = between(main.y + 8, CELL - MARGIN - 2);
      const halfWidth = i === 0 ? 1 : 0.5;
      drips.push({ x: x + (halfWidth === 1 ? 0 : 0.5), top: main.y, bottom, halfWidth });
      discs.push({ x: x + (halfWidth === 1 ? 0 : 0.5), y: bottom, r: between(1.1, 1.7) });
    }
  }
  return { discs, drips };
}

function createSplatAtlas(): THREE.DataTexture {
  const width = CELL * COLUMNS;
  const height = CELL * ROWS;
  const data = new Uint8Array(width * height * 4);
  // Le vide porte la couleur du sang : pas de liseré sombre au bord des taches réduites.
  for (let i = 0; i < width * height; i++) data.set(BODY, i * 4);

  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const variant = row * COLUMNS + column;
      const { discs, drips } = splatShapes(variant, row === 1);
      for (let py = MARGIN; py < CELL - MARGIN; py++) {
        for (let px = MARGIN; px < CELL - MARGIN; px++) {
          const x = px + 0.5;
          const y = py + 0.5;
          let depth = -1;
          for (const disc of discs) depth = Math.max(depth, disc.r - Math.hypot(x - disc.x, y - disc.y));
          for (const drip of drips) {
            if (y >= drip.top && y <= drip.bottom && Math.abs(x - drip.x) <= drip.halfWidth) depth = Math.max(depth, 1.2);
          }
          if (depth < 0) continue;
          let color: readonly number[] = depth < 0.8 ? RIM : depth > 3.2 ? CORE : BODY;
          if (color === BODY && hash(variant * 4096 + py * 64 + px) < 0.07) color = GLINT;
          // Image écrite de haut en bas ; la texture, elle, part du bas.
          const dataRow = (ROWS - 1 - row) * CELL + (CELL - 1 - py);
          const offset = (dataRow * width + column * CELL + px) * 4;
          data.set(color, offset);
          data[offset + 3] = 255;
        }
      }
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  configureRetroTexture(texture);
  return texture;
}

// --- Éclaboussures ----------------------------------------------------------

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
const QUAD_CORNERS: readonly (readonly [number, number])[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
/** Points du pourtour vérifiés avant de poser une tache : elle ne dépasse pas d'une arête. */
const FIT_PROBES: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const FIT_REACH = 0.45;

const scratchA = new THREE.Vector3();
const scratchB = new THREE.Vector3();
const scratchC = new THREE.Vector3();

class GoreSplats {
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
    const splat = this.splats[index]!;
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

    const column = Math.floor(this.random() * COLUMNS) % COLUMNS;
    const row = floor ? 0 : 1;
    const mirrored = this.random() < 0.5;
    const u0 = (column + (mirrored ? 1 : 0)) / COLUMNS;
    const u1 = (column + (mirrored ? 0 : 1)) / COLUMNS;
    const v0 = 1 - (row + 1) / ROWS;
    const v1 = 1 - row / ROWS;
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
    const splat = this.splats[index]!;
    const half = splat.size * scale * 0.5;
    for (let corner = 0; corner < 4; corner++) {
      const [t, b] = QUAD_CORNERS[corner]!;
      scratchC.copy(splat.center).addScaledVector(splat.tangent, t * half * splat.stretch).addScaledVector(splat.bitangent, b * half);
      this.positions.setXYZ(index * 4 + corner, scratchC.x, scratchC.y, scratchC.z);
    }
    this.positions.needsUpdate = true;
  }

  update(realDt: number): void {
    for (const index of this.growing) {
      const splat = this.splats[index]!;
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

// --- Morceaux ---------------------------------------------------------------

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

class GoreChunks {
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
      this.mesh.setColorAt(i, CHUNK_COLORS[0]!);
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
      const chunk = this.chunks[index]!;
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
      chunk.scale.set(size * (0.6 + this.random() * 0.8), size * (0.5 + this.random() * 0.6), size * (0.6 + this.random() * 0.8));
      chunk.rotation.set(this.random() * Math.PI, this.random() * Math.PI, this.random() * Math.PI);
      chunk.active = true;
      chunk.flying = true;
      chunk.flight = 0;
      this.mesh.setColorAt(index, CHUNK_COLORS[Math.floor(this.random() * CHUNK_COLORS.length) % CHUNK_COLORS.length]!);
      this.write(index);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.visible = true;
  }

  private write(index: number): void {
    const chunk = this.chunks[index]!;
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
      const chunk = this.chunks[index]!;
      if (!chunk.active || !chunk.flying) continue;

      chunk.flight += realDt;
      if (chunk.flight > goreConfig.chunkMaxFlight) {
        chunk.active = false;
        this.write(index);
        continue;
      }

      chunk.velocity.y += GRAVITY * realDt;
      const distance = chunk.velocity.length() * realDt;
      const hit = probe && distance > 1e-6
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
      this.chunks[index]!.active = false;
      this.mesh.setMatrixAt(index, HIDDEN);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.cursor = 0;
    this.mesh.visible = false;
  }
}

// --- Façade -----------------------------------------------------------------

const DOWN = new THREE.Vector3(0, -1, 0);
const sprayDirection = new THREE.Vector3();
const sprayOrigin = new THREE.Vector3();

export class Gore {
  private readonly splats: GoreSplats;
  private readonly chunks: GoreChunks;
  private probe: SurfaceProbe | null = null;

  constructor(scene: THREE.Scene, private readonly random: () => number) {
    this.splats = new GoreSplats(random);
    this.chunks = new GoreChunks(random);
    scene.add(this.splats.mesh, this.chunks.mesh);
  }

  /** Sans sonde, rien ne se pose : les morceaux tombent et disparaissent. */
  setSurfaceProbe(probe: SurfaceProbe | null): void {
    this.probe = probe;
  }

  get splatCount(): number {
    return this.splats.count;
  }
  get restingChunkCount(): number {
    return this.chunks.resting;
  }
  get flyingChunkCount(): number {
    return this.chunks.flying;
  }

  private between([min, max]: Range): number {
    return min + this.random() * (max - min);
  }

  private splatAlong(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    range: number,
    size: number,
    grow: number,
    stretch = 1,
  ): boolean {
    const hit = this.probe?.(origin, direction, range);
    if (!hit) return false;
    const streak = stretch > 1 ? { along: direction, stretch } : undefined;
    return this.splats.add(hit.point, hit.normal, size, grow, this.probe, streak) > 0;
  }

  /** Un ennemi est mort sur place : une flaque s'étale sous lui. `center` : n'importe quel point de son corps. */
  spawnPool(center: THREE.Vector3): void {
    this.splatAlong(center, DOWN, 3, this.between(goreConfig.deathPoolSize), goreConfig.deathPoolGrow);
  }

  /** Un ennemi touché saigne sur ce qu'il y a derrière lui : le mur d'abord, à défaut le sol. */
  spawnSpray(point: THREE.Vector3, direction: THREE.Vector3, weapon: "melee" | "pistol" | "shotgun"): void {
    if (this.random() >= goreConfig.hitSprayChance[weapon]) return;
    const size = this.between(goreConfig.hitSpraySize);
    if (this.splatAlong(point, direction, goreConfig.hitSprayRange, size, 0)) return;
    sprayDirection.copy(direction).addScaledVector(DOWN, 0.7).normalize();
    this.splatAlong(point, sprayDirection, goreConfig.hitSprayRange, size, 0);
  }

  /** Un ennemi explose : flaque, giclées dans l'axe du coup, et morceaux qui retombent. */
  spawnGibs(point: THREE.Vector3, direction: THREE.Vector3): void {
    this.splatAlong(point, DOWN, 3, this.between(goreConfig.gibPoolSize), goreConfig.gibPoolGrow);

    const spread = goreConfig.gibSpraySpread;
    for (let i = 0; i < goreConfig.gibSprayCount; i++) {
      sprayDirection
        .set(
          direction.x + (this.random() * 2 - 1) * spread,
          // Biais vers le bas : la moitié des giclées finit au sol, en traînée.
          direction.y + (this.random() * 2 - 1) * spread - 0.25,
          direction.z + (this.random() * 2 - 1) * spread,
        )
        .normalize();
      sprayOrigin.copy(point);
      this.splatAlong(
        sprayOrigin,
        sprayDirection,
        goreConfig.gibSprayRange,
        this.between(goreConfig.gibSpraySize),
        goreConfig.gibSprayGrow,
        this.between(goreConfig.gibSprayStretch),
      );
    }

    this.chunks.spawn(point, direction, goreConfig.gibChunks);
  }

  update(realDt: number): void {
    this.splats.update(realDt);
    this.chunks.update(realDt, this.probe, (hit) => {
      this.splats.add(hit.point, hit.normal, this.between(goreConfig.chunkSplatSize), 0, this.probe);
    });
  }

  reset(): void {
    this.splats.reset();
    this.chunks.reset();
  }
}
