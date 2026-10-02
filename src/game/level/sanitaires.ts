import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { LevelResources } from "./levelResources";
import { damageForWeapon } from "../player/weaponConfig";
import type { HitEvent } from "../player/weaponTypes";

// see: docs/6-reference/notes-code-gameplay-niveau.md#objets-cassables-et-interactions

export type SanitaireKind = "cuvette" | "urinoir";
export const SANITAIRE_KINDS: readonly SanitaireKind[] = ["cuvette", "urinoir"];

export const DEFAULT_SANITAIRE_KIND: SanitaireKind = "cuvette";

export function parseSanitaireKind(raw: unknown): SanitaireKind | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return (SANITAIRE_KINDS as readonly string[]).includes(value) ? (value as SanitaireKind) : null;
}

export interface SanitaireCandidate {
  name: string;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  collider: RAPIER.Collider;
  body: RAPIER.RigidBody;
  kind: SanitaireKind;
  /** PV de départ, lus dans `pv`. `null` = incassable AU TIR DU JOUEUR — reste
   * toujours utilisable, et un tir ENNEMI le casse quand même d'un coup (même
   * asymétrie que `vitre_*`, voir `SanitaireSystem.tryBreakByColliderHandle`). */
  maxHp: number | null;
  jetOrigin: THREE.Vector3;
  extras: Record<string, unknown>;
}

export interface SanitaireInfo {
  name: string;
  collider: RAPIER.Collider;
  body: RAPIER.RigidBody;
  kind: SanitaireKind;
  maxHp: number | null;
  jetOrigin: THREE.Vector3;
  extras: Record<string, unknown>;
  batchGeometry: THREE.BufferGeometry;
  vertexStart: number;
  vertexCount: number;
  /** Centre de CE sanitaire dans l'espace de `batchGeometry` — les sommets de sa plage sont ramenés ici à la casse. */
  localCenter: THREE.Vector3;
}

export interface SanitaireMergeResult {
  sanitaires: SanitaireInfo[];
  /** Lots de dessin ajoutés (un par matériau fusionné à 2 sanitaires ou plus). */
  batchCount: number;
  rendus: SanitaireRendu[];
}

export interface SanitaireRendu {
  object: THREE.Object3D;
  position: THREE.Vector3;
}

function renduDe(mesh: THREE.Mesh): SanitaireRendu {
  mesh.geometry.computeBoundingSphere();
  const position = mesh.geometry.boundingSphere!.center.clone().applyMatrix4(mesh.matrixWorld);
  return { object: mesh, position };
}

function materialKey(mat: THREE.MeshLambertMaterial): string {
  return [mat.map?.uuid ?? "-", mat.color.getHexString(), mat.transparent, mat.opacity, mat.alphaTest].join("|");
}

/** Centre d'une plage de sommets `[start, start+count)` d'un attribut position — espace de l'attribut lui-même, quel qu'il soit. */
function rangeCenter(position: THREE.BufferAttribute, start: number, count: number): THREE.Vector3 {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = start; i < start + count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (x < min.x) min.x = x;
    if (y < min.y) min.y = y;
    if (z < min.z) min.z = z;
    if (x > max.x) max.x = x;
    if (y > max.y) max.y = y;
    if (z > max.z) max.z = z;
  }
  return min.add(max).multiplyScalar(0.5);
}

/** Un candidat non fusionné (seul de son matériau) devient sa propre "plage" : toute sa géométrie, espace inchangé. */
function passthroughSanitaireInfo(candidate: SanitaireCandidate): SanitaireInfo {
  const position = candidate.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  return {
    name: candidate.name,
    collider: candidate.collider,
    body: candidate.body,
    kind: candidate.kind,
    maxHp: candidate.maxHp,
    jetOrigin: candidate.jetOrigin,
    extras: candidate.extras,
    batchGeometry: candidate.mesh.geometry,
    vertexStart: 0,
    vertexCount: position.count,
    localCenter: rangeCenter(position, 0, position.count),
  };
}

export function mergeSanitaireDecor(
  root: THREE.Object3D,
  candidates: readonly SanitaireCandidate[],
  resources?: LevelResources,
): SanitaireMergeResult {
  const groups = new Map<string, SanitaireCandidate[]>();
  for (const candidate of candidates) {
    const key = materialKey(candidate.mesh.material);
    const list = groups.get(key);
    if (list) list.push(candidate);
    else groups.set(key, [candidate]);
  }

  const rootInverse = root.matrixWorld.clone().invert();
  const toRootSpace = new THREE.Matrix4();
  const sanitaires: SanitaireInfo[] = [];
  const rendus: SanitaireRendu[] = [];
  let batchCount = 0;

  for (const group of groups.values()) {
    if (group.length < 2) {
      sanitaires.push(passthroughSanitaireInfo(group[0]!));
      rendus.push(renduDe(group[0]!.mesh));
      continue;
    }

    const geometries = group.map((candidate) => {
      toRootSpace.multiplyMatrices(rootInverse, candidate.mesh.matrixWorld);
      const geometry = candidate.mesh.geometry.clone();
      resources?.geometry(geometry);
      return geometry.applyMatrix4(toRootSpace);
    });
    const merged = mergeGeometries(geometries, false);
    if (merged) resources?.geometry(merged);
    if (!merged) {
      // Repli défensif, ne devrait jamais arriver pour un mesh à un seul
      // matériau : chaque sanitaire garde sa PROPRE géométrie plutôt que de
      // disparaître du niveau — même garde que `mergeVitreDecor`.
      for (const g of geometries) g.dispose();
      for (const candidate of group) {
        sanitaires.push(passthroughSanitaireInfo(candidate));
        rendus.push(renduDe(candidate.mesh));
      }
      continue;
    }

    const batch = new THREE.Mesh(merged, group[0]!.mesh.material);
    batch.name = `sanitaire_fusion_${batchCount}`;
    root.add(batch);
    batch.updateMatrixWorld(true);
    batchCount++;
    rendus.push(renduDe(batch));

    const mergedPosition = merged.getAttribute("position") as THREE.BufferAttribute;
    let cursor = 0;
    for (let i = 0; i < group.length; i++) {
      const candidate = group[i]!;
      const count = (geometries[i]!.getAttribute("position") as THREE.BufferAttribute).count;
      sanitaires.push({
        name: candidate.name,
        collider: candidate.collider,
        body: candidate.body,
        kind: candidate.kind,
        maxHp: candidate.maxHp,
        jetOrigin: candidate.jetOrigin,
        extras: candidate.extras,
        batchGeometry: merged,
        vertexStart: cursor,
        vertexCount: count,
        localCenter: rangeCenter(mergedPosition, cursor, count),
      });
      cursor += count;
    }

    for (const g of geometries) g.dispose();
    for (const candidate of group) {
      candidate.mesh.removeFromParent();
      candidate.mesh.geometry.dispose();
      if (candidate.mesh.material !== batch.material) candidate.mesh.material.dispose();
    }
  }

  return { sanitaires, batchCount, rendus };
}

/** Un sanitaire touché par un tir du joueur (cassé ou non ce coup-ci). */
export interface SanitaireHitEvent {
  name: string;
  point: THREE.Vector3;
  kind: SanitaireKind;
  fatal: boolean;
}

/** Un sanitaire dont les PV viennent de tomber à zéro (ou cassé d'un coup par un tir ennemi). */
export interface SanitaireDestroyedEvent {
  name: string;
  point: THREE.Vector3;
  direction: THREE.Vector3;
  kind: SanitaireKind;
  /** Origine MONDE du jet d'eau permanent — transmise telle quelle par
   * `updateFx.ts` à `engine.fx.addWaterJet`, jamais recalculée côté rendu. */
  jetOrigin: THREE.Vector3;
}

interface SanitaireState {
  info: SanitaireInfo;
  /** `Infinity` pour un sanitaire incassable AU TIR DU JOUEUR — évite un `null` à tester à chaque coup, même discipline que `VitreSystem`. */
  hp: number;
  broken: boolean;
}

const DEFAULT_BREAK_DIRECTION = new THREE.Vector3(0, 1, 0);

/** Résultat de `resolveAim` — vue en lecture seule, juste ce qu'il faut pour décider soulagement (intact) ou gorgée (cassé). */
export interface AimedSanitaire {
  name: string;
  kind: SanitaireKind;
  broken: boolean;
}

export interface SanitaireAimWorldHit {
  colliderHandle: number;
  /** Distance le long du rayon jusqu'à ce point, mêmes unités que `rangeMeters` de `resolveAim` (mètres, rayon unitaire). */
  distance: number;
}

const JET_AIM_RADIUS_METERS = 0.3;
/** Hauteur (m) du volume du jet au-dessus de `jetOrigin` — demandé par la tâche. */
const JET_AIM_HEIGHT_METERS = 1.5;

const JET_BLOCK_EPSILON_METERS = 1e-3;

const AXES = ["x", "y", "z"] as const;

function rayJetVolumeEntry(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  jetOrigin: THREE.Vector3,
  maxDistance: number,
): number | null {
  const min = {
    x: jetOrigin.x - JET_AIM_RADIUS_METERS,
    y: jetOrigin.y,
    z: jetOrigin.z - JET_AIM_RADIUS_METERS,
  };
  const max = {
    x: jetOrigin.x + JET_AIM_RADIUS_METERS,
    y: jetOrigin.y + JET_AIM_HEIGHT_METERS,
    z: jetOrigin.z + JET_AIM_RADIUS_METERS,
  };

  let tMin = 0;
  let tMax = maxDistance;
  for (const axis of AXES) {
    const o = origin[axis];
    const d = direction[axis];
    if (Math.abs(d) < 1e-8) {
      if (o < min[axis] || o > max[axis]) return null;
      continue;
    }
    let t1 = (min[axis] - o) / d;
    let t2 = (max[axis] - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }
  return tMin;
}

export class SanitaireSystem {
  private readonly states: SanitaireState[] = [];
  private readonly byColliderHandle = new Map<number, SanitaireState>();
  private readonly byName = new Map<string, SanitaireState>();

  private readonly _hitEvents: SanitaireHitEvent[] = [];
  private readonly _destroyedEvents: SanitaireDestroyedEvent[] = [];
  private hitCursor = 0;

  constructor(sanitaires: readonly SanitaireInfo[]) {
    for (const info of sanitaires) {
      const state: SanitaireState = { info, hp: info.maxHp ?? Infinity, broken: false };
      this.states.push(state);
      this.byName.set(info.name, state);
      this.byColliderHandle.set(info.collider.handle, state);
    }
  }

  get hitEvents(): ReadonlyArray<SanitaireHitEvent> {
    return this._hitEvents;
  }
  get destroyedEvents(): ReadonlyArray<SanitaireDestroyedEvent> {
    return this._destroyedEvents;
  }
  /** Nombre total de `sanitaire_*` du niveau, cassés compris. */
  get count(): number {
    return this.states.length;
  }
  /** Sanitaires encore intacts — `count` moins les cassés. */
  get intactCount(): number {
    let intact = 0;
    for (const state of this.states) if (!state.broken) intact++;
    return intact;
  }
  /** Sanitaires cassés = jets d'eau actifs — pour la console/les tests, pas
   * pour `render/fx.ts` (qui les possède déjà une fois posés par
   * `updateFx.ts` à l'évènement de destruction, jamais recalculés ici). */
  get activeJets(): ReadonlyArray<{ name: string; kind: SanitaireKind; origin: THREE.Vector3 }> {
    return this.states
      .filter((state) => state.broken)
      .map((state) => ({ name: state.info.name, kind: state.info.kind, origin: state.info.jetOrigin.clone() }));
  }

  collectActiveJetOrigins(out: THREE.Vector3[]): void {
    out.length = 0;
    for (const state of this.states) {
      if (state.broken) out.push(state.info.jetOrigin);
    }
  }

  /** Vide les files d'évènements et remet `hitCursor` à zéro. Une seule fois par frame d'affichage (ADR 0010). */
  clearFrameEvents(): void {
    this._hitEvents.length = 0;
    this._destroyedEvents.length = 0;
    this.hitCursor = 0;
  }

  update(hitEvents: ReadonlyArray<HitEvent>): void {
    for (let i = this.hitCursor; i < hitEvents.length; i++) {
      const hit = hitEvents[i]!;
      const state = this.byColliderHandle.get(hit.colliderHandle);
      if (!state || state.broken) continue;

      const damage = damageForWeapon(hit.weapon);
      state.hp -= damage;
      const fatal = state.hp <= 0;
      this._hitEvents.push({ name: state.info.name, point: hit.point.clone(), kind: state.info.kind, fatal });
      if (fatal) {
        // `normal` pointe vers le tireur (convention `castRayAndGetNormal`) —
        // le coup vient donc de l'autre sens, même convention que `VitreSystem.destroy`.
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

  /** Casse un sanitaire par son nom, sans tir — harnais de console/tests, même contrat que `VitreSystem.destroyByName`. */
  destroyByName(name: string): boolean {
    const state = this.byName.get(name);
    if (!state || state.broken) return false;
    const c = state.info.localCenter;
    this.destroy(state, new THREE.Vector3(c.x, c.y, c.z), DEFAULT_BREAK_DIRECTION);
    return true;
  }

  private destroy(state: SanitaireState, point: THREE.Vector3, direction: THREE.Vector3): void {
    state.broken = true;
    state.hp = 0;
    state.info.collider.setEnabled(false);

    // Écrase la plage de CE sanitaire sur son propre centre — le lot fusionné
    // reste un seul mesh, un seul lot de dessin, pour toujours.
    const position = state.info.batchGeometry.getAttribute("position") as THREE.BufferAttribute;
    const c = state.info.localCenter;
    for (let i = state.info.vertexStart; i < state.info.vertexStart + state.info.vertexCount; i++) {
      position.setXYZ(i, c.x, c.y, c.z);
    }
    position.needsUpdate = true;

    const finalDirection = direction.lengthSq() < 1e-8 ? DEFAULT_BREAK_DIRECTION.clone() : direction.clone().normalize();
    this._destroyedEvents.push({
      name: state.info.name,
      point: point.clone(),
      direction: finalDirection,
      kind: state.info.kind,
      jetOrigin: state.info.jetOrigin.clone(),
    });
  }

  resolveAim(
    eyeOrigin: THREE.Vector3,
    direction: THREE.Vector3,
    rangeMeters: number,
    worldHit: SanitaireAimWorldHit | null,
  ): AimedSanitaire | null {
    if (this.states.length === 0) return null;

    if (worldHit) {
      const hitState = this.byColliderHandle.get(worldHit.colliderHandle);
      if (hitState && !hitState.broken) {
        return { name: hitState.info.name, kind: hitState.info.kind, broken: false };
      }
    }

    const obstacleDistance = worldHit ? worldHit.distance : rangeMeters;
    let best: SanitaireState | null = null;
    let bestDistance = Infinity;
    for (const state of this.states) {
      if (!state.broken) continue;
      const entry = rayJetVolumeEntry(eyeOrigin, direction, state.info.jetOrigin, rangeMeters);
      if (entry === null) continue;
      if (entry > obstacleDistance + JET_BLOCK_EPSILON_METERS) continue; // une cloison/un mur est devant le jet
      if (entry < bestDistance) {
        bestDistance = entry;
        best = state;
      }
    }
    return best ? { name: best.info.name, kind: best.info.kind, broken: true } : null;
  }

  /** Résumé lisible pour la console de dev (`cassandre.sanitaires().liste()`). */
  describe(): Array<{ name: string; kind: SanitaireKind; hp: number; maxHp: number | null; broken: boolean }> {
    return this.states.map((state) => ({
      name: state.info.name,
      kind: state.info.kind,
      hp: state.hp,
      maxHp: state.info.maxHp,
      broken: state.broken,
    }));
  }
}
