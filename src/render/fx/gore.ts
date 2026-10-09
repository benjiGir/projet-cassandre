import type { FiringWeapon } from "../../game/player/weapons/weaponTypes";
import * as THREE from "three";

import { GoreChunks } from "./goreChunks";
import { goreConfig, type Range, type SurfaceProbe } from "./goreConfig";
import { GoreSplats } from "./goreSplats";

// Le gore : ce qu'un ennemi laisse sur le décor. Des éclaboussures PERSISTANTES
// au sol et aux murs, et des morceaux qui volent, heurtent le décor et y
// restent. Tout est cosmétique : temps d'affichage, flux de présentation,
// aucun effet sur la simulation.
//
// Deux lots de dessin en tout, quelle que soit la quantité de sang : les
// éclaboussures sont des quads d'UNE géométrie, les morceaux un `InstancedMesh`.
// Les plus anciens sont repris quand la réserve est pleine.
//
// Rangement : `goreConfig.ts` (contrat de la sonde et réglages),
// `goreSplats.ts` et son `goreAtlas.ts` (taches), `goreChunks.ts` (morceaux).

const DOWN = new THREE.Vector3(0, -1, 0);
const sprayDirection = new THREE.Vector3();
const sprayOrigin = new THREE.Vector3();

export class Gore {
  private readonly splats: GoreSplats;
  private readonly chunks: GoreChunks;
  private probe: SurfaceProbe | null = null;

  constructor(
    scene: THREE.Scene,
    private readonly random: () => number,
  ) {
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
  spawnSpray(point: THREE.Vector3, direction: THREE.Vector3, weapon: FiringWeapon): void {
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
