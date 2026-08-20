import * as THREE from "three";

/**
 * Gizmos balistiques de debug — dessine BRIÈVEMENT, après chaque tir, la
 * forme EXACTE réellement testée par la requête de hit (mêmes nombres que
 * `game/player/weapons.ts` : portée, rayon, directions dispersées des
 * plombs), pas une approximation pédagogique. Demande explicite du
 * playtest : « il faudrait rajouter ... des gizmos pour voir sur quoi on
 * tire, j'ai l'impression de ne pas toucher à bout portant ».
 *
 * ACTIF PAR DÉFAUT — contrairement au wireframe `KeyV`
 * (`render/debugView.ts`), cet outil répond à un besoin de diagnostic
 * IMMÉDIAT signalé par l'utilisateur, pas une fonctionnalité cachée à
 * découvrir plus tard. `KeyB` (ballistics) bascule l'affichage à chaud, même
 * pattern que `createWireframeToggle`.
 *
 * DÉCOUPLAGE DÉLIBÉRÉ, même discipline que `render/fx.ts`/`render/hitmarker.ts`/
 * `render/crosshair.ts` : ce module n'importe rien de `game/*`, uniquement
 * des primitives (`THREE.Vector3`, nombres). `main.ts` fait le pont en
 * lisant `weapons.fireEvents` et en dépaquetant ses champs vers l'API
 * ci-dessous (voir le câblage dans `updateFx`).
 *
 * OBJETS 3D RÉELS dans la scène (pas un canvas 2D comme `crosshair.ts`/
 * `hitmarker.ts`) : ce sont des primitives dans le MONDE — précédent direct,
 * `spawnImpactParticles`/`spawnGibs` de `render/fx.ts`. Matériaux NON
 * ÉCLAIRÉS (`LineBasicMaterial`/`MeshBasicMaterial`), délibérément PAS
 * `MeshLambertMaterial` : l'invariant #5 interdit la PBR/le spéculaire/la
 * métalness sur ce que le JOUEUR voit en jeu ; ces gizmos sont un calque de
 * DIAGNOSTIC transitoire (quelques centaines de ms, jamais du rendu de jeu
 * final) — rester visible quelle que soit la direction de la lumière est le
 * comportement correct pour un outil de mesure, pas une entorse à
 * l'invariant.
 *
 * TEMPS RÉEL, jamais le pas fixe (`update(realDt)`, même régime que
 * `FxSystem.update`/`HitmarkerOverlay.update`) : la géométrie affichée est un
 * instantané figé du pas fixe où le tir a eu lieu, seule sa décroissance
 * (durée de vie avant suppression) est temps réel.
 */

/** "Quelques centaines de ms", auto-effacé — voir la doc de tête. */
const TRACE_LIFETIME = 0.35; // s

const SHOTGUN_TRACE_COLOR = 0xffcc33;
const MELEE_TRACE_COLOR = 0x33ccff;

/** Axe local le long duquel `THREE.CapsuleGeometry` construit sa partie cylindrique — sert à orienter le gizmo capsule sur la direction de visée, même convention que `UNIT_Y` dans `weapons.ts`. */
const UNIT_Y = new THREE.Vector3(0, 1, 0);

interface ActiveTrace {
  object: THREE.Object3D;
  remaining: number;
  dispose: () => void;
}

export class BallisticsDebugOverlay {
  private readonly scene: THREE.Scene;
  private enabled = true;
  private readonly traces: ActiveTrace[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Bascule l'affichage à chaud, même contrat que `createWireframeToggle().toggle()`. Désactiver retire immédiatement toutes les traces actives. */
  toggle(): boolean {
    this.enabled = !this.enabled;
    if (!this.enabled) this.clearAll();
    return this.enabled;
  }

  private clearAll() {
    for (const trace of this.traces) {
      this.scene.remove(trace.object);
      trace.dispose();
    }
    this.traces.length = 0;
  }

  /**
   * Pompe : une ligne PAR PLOMB, de `origin` (l'œil du joueur au tir) à son
   * point de fin — voir la doc de `FireEvent.pelletEndpoints` dans
   * `weapons.ts` : le point d'impact réel s'il y en a un, sinon
   * `shotgunRange` mètres le long de sa direction dispersée si le plomb n'a
   * rien touché. Un seul objet `LineSegments` pour les 9 plombs (pas 9
   * objets), disposé à l'expiration.
   */
  recordShotgunFire(origin: THREE.Vector3, endpoints: ReadonlyArray<THREE.Vector3>) {
    if (!this.enabled || endpoints.length === 0) return;

    const positions = new Float32Array(endpoints.length * 6);
    for (let i = 0; i < endpoints.length; i++) {
      const end = endpoints[i]!;
      positions[i * 6 + 0] = origin.x;
      positions[i * 6 + 1] = origin.y;
      positions[i * 6 + 2] = origin.z;
      positions[i * 6 + 3] = end.x;
      positions[i * 6 + 4] = end.y;
      positions[i * 6 + 5] = end.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: SHOTGUN_TRACE_COLOR,
      transparent: true,
      opacity: 0.9,
    });
    const lines = new THREE.LineSegments(geometry, material);
    this.scene.add(lines);

    this.traces.push({
      object: lines,
      remaining: TRACE_LIFETIME,
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  /**
   * Pied-de-biche : wireframe de la capsule RÉELLEMENT testée par
   * `WeaponSystem.fireMelee` (même `range`/`radius` que la requête Rapier,
   * voir sa doc) — pas une approximation. `THREE.CapsuleGeometry(radius,
   * length, capSegments, radialSegments)` construit sa partie cylindrique de
   * hauteur `length` centrée à l'origine locale le long de Y : EXACTEMENT la
   * même convention que `RAPIER.Capsule(halfHeight, radius)` avec
   * `halfHeight = range / 2` (voir `fireMelee`), donc `length = range`.
   */
  recordMeleeFire(origin: THREE.Vector3, direction: THREE.Vector3, range: number, radius: number) {
    if (!this.enabled || range <= 0 || radius <= 0) return;

    const geometry = new THREE.CapsuleGeometry(radius, range, 4, 8);
    const material = new THREE.MeshBasicMaterial({
      color: MELEE_TRACE_COLOR,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.copy(origin).addScaledVector(direction, range / 2);
    mesh.quaternion.setFromUnitVectors(UNIT_Y, direction);
    this.scene.add(mesh);

    this.traces.push({
      object: mesh,
      remaining: TRACE_LIFETIME,
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  /** Décroissance temps réel des traces actives, jamais le pas fixe — voir la doc de tête. */
  update(realDt: number) {
    for (let i = this.traces.length - 1; i >= 0; i--) {
      const trace = this.traces[i]!;
      trace.remaining -= realDt;
      if (trace.remaining <= 0) {
        this.scene.remove(trace.object);
        trace.dispose();
        this.traces.splice(i, 1);
      }
    }
  }
}
