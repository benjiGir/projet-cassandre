import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { WeaponConfig } from "./weaponConfig";
import type { FlareDetonation, FlareProjectile } from "./weaponTypes";

// Les fusées du pistolet de détresse en vol. Le seul tir qui n'est pas résolu
// le pas où il part : la fusée avance au pas fixe et éclate sur ce qu'elle
// rencontre. see: docs/decisions/0046-projectile-du-joueur.md

/** Recul du centre du souffle par rapport à la surface touchée, en mètres : sa ligne de vue ne part pas de l'intérieur d'un mur. */
const BLAST_STANDOFF = 0.15;

interface FlyingFlare extends FlareProjectile {
  /** Mètres parcourus depuis le tir. */
  travelled: number;
}

/** Ce qu'une fusée vient de toucher, remis à `WeaponSystem` qui en fait un `HitEvent`. */
export interface FlareImpact {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  collider: RAPIER.Collider;
  /** Distance parcourue depuis le tir, en mètres. */
  distance: number;
}

/** Le rayon des tirs du joueur, lancé par `WeaponSystem` : premier obstacle sur `reach` mètres, ou `null`. */
export type FlareSweep = (ray: RAPIER.Ray, reach: number) => RAPIER.RayColliderIntersection | null;

export class FlareFlight {
  private readonly flying: FlyingFlare[] = [];
  private readonly _detonations: FlareDetonation[] = [];
  private readonly pendingBlasts: FlareDetonation[] = [];
  private nextId = 0;
  private readonly ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });

  constructor(
    private readonly cfg: WeaponConfig,
    private readonly sweep: FlareSweep,
  ) {}

  /** Fusées en vol, positions du pas fixe : l'affichage interpole entre `previousPosition` et `position`. */
  get flares(): ReadonlyArray<FlareProjectile> {
    return this.flying;
  }

  /** Fusées éclatées depuis l'image précédente : lecture non destructive, vidée par `clearFrameEvents`. */
  get detonations(): ReadonlyArray<FlareDetonation> {
    return this._detonations;
  }

  /**
   * Les fusées éclatées dont le souffle n'a pas encore été appliqué, une seule
   * fois chacune. Une file à part de `detonations`, que l'affichage vide à
   * chaque image — même raison que `PropSystem.takeNewExplosions`.
   */
  takeNewDetonations(): ReadonlyArray<FlareDetonation> {
    return this.pendingBlasts.splice(0);
  }

  clearFrameEvents(): void {
    this._detonations.length = 0;
  }

  launch(origin: THREE.Vector3, direction: THREE.Vector3): void {
    this.flying.push({
      id: this.nextId++,
      position: origin.clone(),
      previousPosition: origin.clone(),
      velocity: direction.clone().multiplyScalar(this.cfg.flareSpeed),
      age: 0,
      travelled: 0,
    });
  }

  /** Un pas fixe de vol : chaque fusée balaie d'un rayon le trajet qu'elle va parcourir. */
  advance(dt: number, onImpact: (impact: FlareImpact) => void): void {
    const cfg = this.cfg;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const flare = this.flying[i];
      flare.previousPosition.copy(flare.position);
      flare.age += dt;
      flare.velocity.y -= cfg.flareGravity * dt;
      const speed = flare.velocity.length();
      const reach = speed * dt;
      if (reach <= 1e-9) continue;

      const { origin, dir } = this.ray;
      origin.x = flare.position.x;
      origin.y = flare.position.y;
      origin.z = flare.position.z;
      dir.x = flare.velocity.x / speed;
      dir.y = flare.velocity.y / speed;
      dir.z = flare.velocity.z / speed;
      const hit = this.sweep(this.ray, reach);

      if (!hit) {
        flare.position.addScaledVector(flare.velocity, dt);
        flare.travelled += reach;
        if (flare.age >= cfg.flareLifetime) this.detonate(i, flare.position);
        continue;
      }

      const point = new THREE.Vector3(
        origin.x + dir.x * hit.timeOfImpact,
        origin.y + dir.y * hit.timeOfImpact,
        origin.z + dir.z * hit.timeOfImpact,
      );
      const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
      onImpact({ point, normal, collider: hit.collider, distance: flare.travelled + hit.timeOfImpact });
      flare.position.copy(point);
      this.detonate(i, point.clone().addScaledVector(normal, BLAST_STANDOFF));
    }
  }

  private detonate(index: number, point: THREE.Vector3): void {
    const detonation = { id: this.flying[index].id, point: point.clone() };
    this.flying.splice(index, 1);
    this._detonations.push(detonation);
    this.pendingBlasts.push(detonation);
  }
}
