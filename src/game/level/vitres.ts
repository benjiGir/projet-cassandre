import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { damageForWeapon } from "../player/weaponConfig";
import type { HitEvent } from "../player/weapons";

/**
 * Préfixe `vitre_*` — vitrage cassable ou non, voir
 * `docs/reference/conventions-nommage.md#préfixe-vitre` et
 * [ADR 0031](../../../docs/decisions/0031-portes-animees-et-vitres.md).
 *
 * Même séparation que `game/level/props.ts` : `loader.ts` construit les
 * candidats bruts (`VitreCandidate`, un par mesh `vitre_*` rencontré, collider
 * déjà posé), `mergeVitreDecor` les FUSIONNE en UN lot par matériau pour tout
 * le niveau — CONTRAINTE DURE du budget de lots de dessin (200, pire vue déjà
 * à 198) — et `VitreSystem` fait vivre l'état de partie (PV, casse) au-dessus
 * du résultat.
 *
 * Pas de découpe en cellules, contrairement au décor : la découpe sert à
 * écarter du rendu de gros lots hors champ, et le verre de tout le niveau (une
 * quarantaine de vitres, quelques centaines de triangles) ne pèse rien.
 * Découpé par cellules de 48 m, il coûtait jusqu'à six lots dans une même vue
 * (mesuré au spawn du parking, 2026-09-19) ; en un lot, il en coûte un.
 *
 * La casse d'UNE vitre dans un lot fusionné n'écrase QUE sa propre plage de
 * sommets (ramenés sur son centre, `needsUpdate`) : le lot reste un seul mesh,
 * un seul lot de dessin, pour toujours — casser dix vitres ne coûte jamais
 * un dessin de plus.
 */

// ---------------------------------------------------------------------------
// Données du loader — un candidat par mesh `vitre_*`, AVANT fusion.
// ---------------------------------------------------------------------------

export interface VitreCandidate {
  name: string;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  /** `null` si `solide: false` (verrière au plafond) — AUCUN collider, incassable. */
  collider: RAPIER.Collider | null;
  body: RAPIER.RigidBody | null;
  /** PV de départ, lus dans `pv`. `null` = incassable (absent, invalide, ou `solide: false`). */
  maxHp: number | null;
  givre: boolean;
  extras: Record<string, unknown>;
}

/**
 * Une vitre APRÈS fusion — ce que `VitreSystem`/`LevelHandle.vitres`
 * manipulent. `batchGeometry`/`vertexStart`/`vertexCount` : la plage de
 * sommets de CETTE vitre dans le lot fusionné (ou sa propre géométrie,
 * inchangée, si elle n'a pas eu besoin d'être fusionnée — un lot d'UNE seule
 * vitre est déjà un lot, `mergeVitreDecor` ne le touche pas).
 */
export interface VitreInfo {
  name: string;
  collider: RAPIER.Collider | null;
  body: RAPIER.RigidBody | null;
  maxHp: number | null;
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

/** Un candidat non fusionné (seul de son matériau, ou repli si `mergeGeometries` échoue) devient sa propre "plage" : toute sa géométrie, espace inchangé. */
function passthroughVitreInfo(candidate: VitreCandidate): VitreInfo {
  const position = candidate.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  return {
    name: candidate.name,
    collider: candidate.collider,
    body: candidate.body,
    maxHp: candidate.maxHp,
    givre: candidate.givre,
    extras: candidate.extras,
    batchGeometry: candidate.mesh.geometry,
    vertexStart: 0,
    vertexCount: position.count,
    localCenter: rangeCenter(position, 0, position.count),
  };
}

/**
 * Fusionne les `vitre_*` qui partagent un même matériau, pour tout le niveau
 * (voir l'en-tête : pas de cellules). Calculé ici plutôt que par
 * `mergeStaticDecor` parce que le résultat doit garder la plage de sommets de
 * CHAQUE vitre, pour une casse individuelle. `root.matrixWorld` doit être à
 * jour.
 */
export function mergeVitreDecor(root: THREE.Object3D, candidates: readonly VitreCandidate[]): VitreMergeResult {
  const groups = new Map<string, VitreCandidate[]>();
  for (const candidate of candidates) {
    const key = materialKey(candidate.mesh.material);
    const list = groups.get(key);
    if (list) list.push(candidate);
    else groups.set(key, [candidate]);
  }

  const rootInverse = root.matrixWorld.clone().invert();
  const toRootSpace = new THREE.Matrix4();
  const vitres: VitreInfo[] = [];
  let batchCount = 0;

  for (const group of groups.values()) {
    if (group.length < 2) {
      vitres.push(passthroughVitreInfo(group[0]!));
      continue;
    }

    const geometries = group.map((candidate) => {
      toRootSpace.multiplyMatrices(rootInverse, candidate.mesh.matrixWorld);
      return candidate.mesh.geometry.clone().applyMatrix4(toRootSpace);
    });
    const merged = mergeGeometries(geometries, false);
    if (!merged) {
      // Repli défensif (attributs incompatibles entre deux vitrages, ne
      // devrait jamais arriver pour un mesh plat à un seul matériau) : chaque
      // vitre garde sa PROPRE géométrie plutôt que de disparaître du niveau.
      for (const g of geometries) g.dispose();
      for (const candidate of group) vitres.push(passthroughVitreInfo(candidate));
      continue;
    }

    const batch = new THREE.Mesh(merged, group[0]!.mesh.material);
    batch.name = `vitre_fusion_${batchCount}`;
    root.add(batch);
    batch.updateMatrixWorld(true);
    batchCount++;

    const mergedPosition = merged.getAttribute("position") as THREE.BufferAttribute;
    let cursor = 0;
    for (let i = 0; i < group.length; i++) {
      const candidate = group[i]!;
      const count = (geometries[i]!.getAttribute("position") as THREE.BufferAttribute).count;
      vitres.push({
        name: candidate.name,
        collider: candidate.collider,
        body: candidate.body,
        maxHp: candidate.maxHp,
        givre: candidate.givre,
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

  return { vitres, batchCount };
}

// ---------------------------------------------------------------------------
// Système — état mutable d'une partie, reconstruit à chaque chargement.
// ---------------------------------------------------------------------------

/** Une vitre touchée par un tir du joueur (cassée ou non ce coup-ci). */
export interface VitreHitEvent {
  name: string;
  point: THREE.Vector3;
  givre: boolean;
  fatal: boolean;
}

/** Une vitre dont les PV viennent de tomber à zéro (ou cassée d'un coup par un tir ennemi). */
export interface VitreDestroyedEvent {
  name: string;
  point: THREE.Vector3;
  direction: THREE.Vector3;
  givre: boolean;
}

interface VitreState {
  info: VitreInfo;
  /** `Infinity` pour une vitre incassable — évite un `null` à tester à chaque coup, même discipline que `PropSystem`. */
  hp: number;
  broken: boolean;
}

const DEFAULT_BREAK_DIRECTION = new THREE.Vector3(0, 1, 0);

/**
 * Les vitres d'UN niveau chargé. Reconstruit à chaque `onLoaded` (hot reload
 * compris, comme `PropSystem`/`currentNavGraph`/`lightPool`) : les vitres
 * reviennent intactes au rechargement, avec le fichier.
 */
export class VitreSystem {
  private readonly states: VitreState[] = [];
  private readonly byColliderHandle = new Map<number, VitreState>();
  private readonly byName = new Map<string, VitreState>();

  private readonly _hitEvents: VitreHitEvent[] = [];
  private readonly _destroyedEvents: VitreDestroyedEvent[] = [];

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

  /** Vide les files d'évènements. Une seule fois par frame d'affichage, comme `PropSystem.clearFrameEvents`. */
  clearFrameEvents(): void {
    this._hitEvents.length = 0;
    this._destroyedEvents.length = 0;
  }

  /**
   * Tirs du JOUEUR (hitscan, plombs, pied-de-biche) — même chemin de
   * `HitEvent` que `PropSystem.update`, dégâts par la MÊME table
   * (`damageForWeapon`). Non destructif : la file appartient à `WeaponSystem`.
   */
  update(hitEvents: ReadonlyArray<HitEvent>): void {
    if (this.states.length === 0) return;
    for (const hit of hitEvents) {
      const state = this.byColliderHandle.get(hit.colliderHandle);
      if (!state || state.broken) continue;

      const damage = damageForWeapon(hit.weapon);
      state.hp -= damage;
      const fatal = state.hp <= 0;
      this._hitEvents.push({ name: state.info.name, point: hit.point.clone(), givre: state.info.givre, fatal });
      if (fatal) {
        // `normal` pointe vers le tireur (convention `castRayAndGetNormal`) —
        // le coup vient donc de l'autre sens, même convention que `PropSystem.destroy`.
        this.destroy(state, hit.point, hit.normal.clone().negate());
      }
    }
  }

  /**
   * Tir ENNEMI (`enemyMachine.ts::resolveAttack`) : casse la vitre D'UN COUP,
   * sans passer par ses PV — effet Duke Nukem voulu par le contrat. Un ennemi
   * ne "vise" jamais le verre : s'il en rencontre un sur le chemin de son tir
   * vers le joueur, il le fait exploser plutôt que de l'endommager
   * progressivement comme le ferait un joueur qui s'acharne dessus.
   * Retourne `true` si une vitre intacte a bien été cassée.
   */
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

    const finalDirection = direction.lengthSq() < 1e-8 ? DEFAULT_BREAK_DIRECTION.clone() : direction.clone().normalize();
    this._destroyedEvents.push({ name: state.info.name, point: point.clone(), direction: finalDirection, givre: state.info.givre });
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
