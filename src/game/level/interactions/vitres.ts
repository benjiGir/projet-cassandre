import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

import type { LevelResources } from "../loading/levelResources";
import { mergeBreakableDecor, rangeCenter } from "../loading/mergeBreakableDecor";
import { damageForHit } from "../../player/weapons/weaponConfig";
import type { HitEvent } from "../../player/weapons/weaponTypes";
import type { PropMaterial } from "../props/props";
import type { PropBreakShape } from "../props/propAppearance";

// see: docs/6-reference/notes-code-gameplay-niveau.md#objets-cassables-et-interactions

export interface VitreCandidate {
  name: string;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  /** `null` si `solide: false` (verrière au plafond) — AUCUN collider, incassable. */
  collider: RAPIER.Collider | null;
  body: RAPIER.RigidBody | null;
  /** PV de départ, lus dans `pv`. `null` = incassable (absent, invalide, ou `solide: false`). */
  maxHp: number | null;
  /** Matière des débris/du son, `verre` par défaut. */
  matiere?: PropMaterial;
  givre: boolean;
  extras: Record<string, unknown>;
}

export interface VitreInfo {
  name: string;
  collider: RAPIER.Collider | null;
  body: RAPIER.RigidBody | null;
  maxHp: number | null;
  matiere: PropMaterial;
  givre: boolean;
  extras: Record<string, unknown>;
  batchGeometry: THREE.BufferGeometry;
  vertexStart: number;
  vertexCount: number;
  /** Centre de CETTE vitre dans l'espace de `batchGeometry` — les sommets de sa plage sont ramenés ici à la casse. */
  localCenter: THREE.Vector3;
}

export interface VitreMergeResult {
  vitres: VitreInfo[];
  /** Lots de dessin ajoutés (un par matériau fusionné à 2 vitres ou plus). */
  batchCount: number;
}

/** Un vitrage enfant d'un vantail garde sa hiérarchie glTF : le détacher pour le lot global le laisserait immobile pendant l'ouverture. */
function followsDoor(candidate: VitreCandidate): boolean {
  for (let parent = candidate.mesh.parent; parent; parent = parent.parent) {
    if (parent.name.startsWith("door_")) return true;
  }
  return false;
}

export function mergeVitreDecor(
  root: THREE.Object3D,
  candidates: readonly VitreCandidate[],
  resources?: LevelResources,
): VitreMergeResult {
  const merge = mergeBreakableDecor(root, candidates, "vitre_fusion", resources, followsDoor);
  const vitres = merge.ranges.map(({ candidate, batchGeometry, vertexStart, vertexCount }) => ({
    name: candidate.name,
    collider: candidate.collider,
    body: candidate.body,
    maxHp: candidate.maxHp,
    matiere: candidate.matiere ?? "verre",
    givre: candidate.givre,
    extras: candidate.extras,
    batchGeometry,
    vertexStart,
    vertexCount,
    localCenter: rangeCenter(batchGeometry.getAttribute("position") as THREE.BufferAttribute, vertexStart, vertexCount),
  }));
  return { vitres, batchCount: merge.batchCount };
}

/** Une vitre touchée par un tir du joueur (cassée ou non ce coup-ci). */
export interface VitreHitEvent {
  name: string;
  point: THREE.Vector3;
  givre: boolean;
  fatal: boolean;
}

/** Un `vitre_*` dont les PV viennent de tomber à zéro (ou cassé par un tir ennemi). */
export interface VitreDestroyedEvent {
  name: string;
  point: THREE.Vector3;
  direction: THREE.Vector3;
  givre: boolean;
  matiere: PropMaterial;
  shape?: PropBreakShape;
}

interface VitreState {
  info: VitreInfo;
  /** `Infinity` pour une vitre incassable — évite un `null` à tester à chaque coup, même discipline que `PropSystem`. */
  hp: number;
  broken: boolean;
}

const DEFAULT_BREAK_DIRECTION = new THREE.Vector3(0, 1, 0);

export class VitreSystem {
  private readonly states: VitreState[] = [];
  private readonly byColliderHandle = new Map<number, VitreState>();
  private readonly byName = new Map<string, VitreState>();

  private readonly _hitEvents: VitreHitEvent[] = [];
  private readonly _destroyedEvents: VitreDestroyedEvent[] = [];
  private hitCursor = 0;

  constructor(vitres: readonly VitreInfo[]) {
    for (const info of vitres) {
      const state: VitreState = { info, hp: info.maxHp ?? Infinity, broken: false };
      this.states.push(state);
      this.byName.set(info.name, state);
      if (info.collider) this.byColliderHandle.set(info.collider.handle, state);
    }
  }

  get hitEvents(): ReadonlyArray<VitreHitEvent> {
    return this._hitEvents;
  }
  get destroyedEvents(): ReadonlyArray<VitreDestroyedEvent> {
    return this._destroyedEvents;
  }
  /** Nombre total de `vitre_*` du niveau, cassées comprises. */
  get count(): number {
    return this.states.length;
  }
  /** Vitres encore intactes — `count` moins les cassées. */
  get intactCount(): number {
    let intact = 0;
    for (const state of this.states) if (!state.broken) intact++;
    return intact;
  }

  /** Vide les files d'évènements et remet `hitCursor` à zéro. Une seule fois par frame d'affichage (ADR 0010). */
  clearFrameEvents(): void {
    this._hitEvents.length = 0;
    this._destroyedEvents.length = 0;
    this.hitCursor = 0;
  }

  update(hitEvents: ReadonlyArray<HitEvent>): void {
    for (let i = this.hitCursor; i < hitEvents.length; i++) {
      const hit = hitEvents[i];
      const state = this.byColliderHandle.get(hit.colliderHandle);
      if (!state || state.broken) continue;

      const damage = damageForHit(hit);
      state.hp -= damage;
      const fatal = state.hp <= 0;
      this._hitEvents.push({ name: state.info.name, point: hit.point.clone(), givre: state.info.givre, fatal });
      if (fatal) {
        // `normal` pointe vers le tireur (convention `castRayAndGetNormal`) —
        // le coup vient donc de l'autre sens, même convention que `PropSystem.destroy`.
        this.destroy(state, hit.point, hit.normal.clone().negate());
      }
    }
    this.hitCursor = hitEvents.length;
  }

  tryBreakByColliderHandle(colliderHandle: number, point: THREE.Vector3, direction: THREE.Vector3): boolean {
    const state = this.byColliderHandle.get(colliderHandle);
    if (!state || state.broken) return false;
    this.destroy(state, point, direction);
    return true;
  }

  /** Casse une vitre par son nom, sans tir — harnais de console/tests, même contrat que `PropSystem.destroyByName`. */
  destroyByName(name: string): boolean {
    const state = this.byName.get(name);
    if (!state || state.broken) return false;
    const c = state.info.localCenter;
    this.destroy(state, new THREE.Vector3(c.x, c.y, c.z), DEFAULT_BREAK_DIRECTION);
    return true;
  }

  private destroy(state: VitreState, point: THREE.Vector3, direction: THREE.Vector3): void {
    state.broken = true;
    state.hp = 0;
    state.info.collider?.setEnabled(false);

    // Écrase la plage de CETTE vitre sur son propre centre — le lot fusionné
    // reste un seul mesh, un seul lot de dessin, pour toujours.
    const position = state.info.batchGeometry.getAttribute("position") as THREE.BufferAttribute;
    const c = state.info.localCenter;
    for (let i = state.info.vertexStart; i < state.info.vertexStart + state.info.vertexCount; i++) {
      position.setXYZ(i, c.x, c.y, c.z);
    }
    position.needsUpdate = true;

    const finalDirection =
      direction.lengthSq() < 1e-8 ? DEFAULT_BREAK_DIRECTION.clone() : direction.clone().normalize();
    this._destroyedEvents.push({
      name: state.info.name,
      point: point.clone(),
      direction: finalDirection,
      givre: state.info.givre,
      matiere: state.info.matiere,
      shape: this.captureShape(state.info.collider),
    });
  }

  private captureShape(collider: RAPIER.Collider | null): PropBreakShape | undefined {
    if (!collider) return undefined;
    const center = collider.translation(),
      rotation = collider.rotation(),
      half = collider.halfExtents();
    if (!half) return undefined;
    return {
      center: new THREE.Vector3(center.x, center.y, center.z),
      rotation: new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
      halfExtents: new THREE.Vector3(half.x, half.y, half.z),
      color: new THREE.Color(),
    };
  }

  /** Résumé lisible pour la console de dev (`cassandre.vitres()`). */
  describe(): Array<{ name: string; hp: number; maxHp: number | null; broken: boolean; givre: boolean }> {
    return this.states.map((state) => ({
      name: state.info.name,
      hp: state.hp,
      maxHp: state.info.maxHp,
      broken: state.broken,
      givre: state.info.givre,
    }));
  }
}
