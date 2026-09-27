import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { damageForWeapon } from "../player/weaponConfig";
import type { HitEvent } from "../player/weapons";

/**
 * Préfixe `ecran_*` — écrans/façades animés du chantier « Les coulisses »
 * (système 2) : un mur d'écrans qui boucle sur une chaîne (`journal`, `pub`,
 * `mire`, `foot`, `cctv`), cassable au tir (`pv`) vers un état CASSÉ
 * (neige/noir qui flashe). L'atlas est `assets_src/textures/prd_chaines.png`,
 * généré par `tools/textures/generate_chaines.py` — `ECRAN_ATLAS` ci-dessous
 * DOIT rester la traduction exacte de `CHAINES` dans ce script (même ordre,
 * mêmes 16 cases).
 *
 * Même séparation en trois temps que `vitre_*`/`sanitaire_*` :
 * - `loader.ts` construit un candidat par mesh `ecran_*` (collider fixe posé
 *   sur sa bbox monde, comme un sanitaire — jamais de `col_*` jumeau) ;
 * - `mergeEcranDecor` fusionne tous les écrans qui partagent le matériau de
 *   l'atlas en UN SEUL lot de dessin pour tout le niveau (contrainte dure du
 *   budget, 200 pire vue) ;
 * - `EcranSystem` fait vivre l'état de partie (PV, frame courante, casse).
 *
 * La boucle d'animation ne bouge JAMAIS la géométrie : elle réécrit l'UV de
 * la plage de sommets de CET écran pour pointer sur une autre case de
 * l'atlas, exactement comme `VitreSystem`/`SanitaireSystem` réécrivent des
 * POSITIONS à la casse. Un lot fusionné reste un lot, quel que soit le nombre
 * d'écrans qui changent de frame — c'est ce qui rend une quarantaine de
 * télévisions animées (atelier SAV, lot 3) tenable dans le budget.
 *
 * Horloge dérivée du PAS FIXE (`update(dtFixed, ...)`, invariant #1) — jamais
 * de `Date.now()`/`requestAnimationFrame` : un écran figé par un hitstop gèle
 * son animation avec le reste du jeu, et le rejeu d'input reste déterministe.
 */

// ---------------------------------------------------------------------------
// Atlas — miroir exact de tools/textures/generate_chaines.py::CHAINES.
// ---------------------------------------------------------------------------

/** Chaînes choisissables par la custom property Blender `chaine`. `"casse"`
 * N'EN FAIT PAS PARTIE : c'est un état interne, jamais posé dans Blender —
 * voir `ECRAN_CHAINES` dans `validate_level.py`, qui doit rester identique. */
export const ECRAN_CHAINES = ["journal", "pub", "mire", "foot", "cctv"] as const;
export type EcranChaine = (typeof ECRAN_CHAINES)[number];

/** Chaîne par défaut d'un `ecran_*` dont `chaine` est absente/inconnue —
 * repli avec avertissement bruyant, même règle que `sorte` sur un
 * `sanitaire_*` (`loader.ts::readEcranChaine`). */
export const DEFAULT_ECRAN_CHAINE: EcranChaine = "mire";

export function parseEcranChaine(raw: unknown): EcranChaine | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return (ECRAN_CHAINES as readonly string[]).includes(value) ? (value as EcranChaine) : null;
}

/** Clé interne de l'état cassé — une chaîne de plus, jamais exposée à Blender. */
const ECRAN_CASSE = "casse";
type EcranTrack = EcranChaine | typeof ECRAN_CASSE;

const CELL = 32;
const ATLAS_SIZE = 4 * CELL;
/** Taille d'une case en coordonnées UV normalisées (0..1). */
const CELL_UV = CELL / ATLAS_SIZE;

/** Index séquentiel (`i = col + row*4`) de chaque frame, dans l'ordre EXACT
 * où `generate_chaines.py::CHAINES` les pose dans l'atlas. */
const CHAINE_FRAME_COUNTS: Record<EcranTrack, number> = {
  journal: 4,
  pub: 4,
  mire: 2,
  foot: 2,
  cctv: 2,
  casse: 2,
};

function buildCellIndex(): Record<EcranTrack, number[]> {
  const order: EcranTrack[] = ["journal", "pub", "mire", "foot", "cctv", "casse"];
  const result = {} as Record<EcranTrack, number[]>;
  let cursor = 0;
  for (const track of order) {
    const count = CHAINE_FRAME_COUNTS[track];
    result[track] = Array.from({ length: count }, () => cursor++);
  }
  return result;
}

/** `chaine -> [index de case dans l'atlas, une par frame]`. */
const ECRAN_ATLAS = buildCellIndex();

/** Durée d'affichage d'une frame, secondes de GAMEPLAY. La casse flashe plus
 * vite (neige qui grésille) que les chaînes normales (plan qui tient). */
const FRAME_DURATION: Record<EcranTrack, number> = {
  journal: 0.9,
  pub: 0.9,
  mire: 0.35,
  foot: 0.6,
  cctv: 0.7,
  casse: 0.12,
};

/** Rectangle UV `[u0, v0]` d'une case, dans l'ordre du `PIL` (origine
 * haut-gauche) — mêmes conventions que `generate_chaines.py`, qui écrit
 * `y = (i // 4) * CELL` du haut vers le bas ET une image `.png` classique
 * (V croissant vers le BAS). `THREE` attend V croissant vers le HAUT pour un
 * UV standard ; le loader ne retourne PAS les textures des atlas existants
 * (`prd_ecrans`/`prd_chaines` partagent le même exportateur Blender que le
 * reste du niveau, dont les faces sont UV-mappées avec la même convention
 * "haut d'image = V=1"), donc `v0` se calcule depuis le HAUT comme `u0`.
 */
function cellRect(index: number): { u0: number; v0: number } {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { u0: col * CELL_UV, v0: 1 - (row + 1) * CELL_UV };
}

// ---------------------------------------------------------------------------
// Données du loader — un candidat par mesh `ecran_*`, AVANT fusion.
// ---------------------------------------------------------------------------

export interface EcranCandidate {
  name: string;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  collider: RAPIER.Collider;
  body: RAPIER.RigidBody;
  /** `null` = incassable (aucun `pv` déclaré). */
  maxHp: number | null;
  chaine: EcranChaine;
  extras: Record<string, unknown>;
}

/** Un écran APRÈS fusion — même contrat que `VitreInfo`/`SanitaireInfo` : une
 * plage de sommets adressable dans le lot fusionné, plus l'UV NORMALISÉ
 * (0..1 dans l'empreinte d'origine de CET écran) qui permet de replacer sa
 * frame courante n'importe où dans l'atlas sans jamais retoucher la géométrie. */
export interface EcranInfo {
  name: string;
  collider: RAPIER.Collider;
  body: RAPIER.RigidBody;
  maxHp: number | null;
  chaine: EcranChaine;
  extras: Record<string, unknown>;
  batchGeometry: THREE.BufferGeometry;
  vertexStart: number;
  vertexCount: number;
  /** `[u,v]` par sommet de la plage, normalisé 0..1 dans le rectangle UV
   * d'origine du mesh — voir la doc de tête pour pourquoi ce n'est jamais la
   * géométrie qui bouge. */
  normalizedUV: Float32Array;
}

export interface EcranMergeResult {
  ecrans: EcranInfo[];
  /** Lots de dessin ajoutés — un par matériau fusionné à 2 écrans ou plus,
   * même contrat que `VitreMergeResult.batchCount`. */
  batchCount: number;
}

function materialKey(mat: THREE.MeshLambertMaterial): string {
  return [mat.map?.uuid ?? "-", mat.color.getHexString(), mat.transparent, mat.opacity, mat.alphaTest].join("|");
}

function computeNormalizedUV(uv: THREE.BufferAttribute, start: number, count: number): Float32Array {
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (let i = start; i < start + count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (u < uMin) uMin = u;
    if (u > uMax) uMax = u;
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
  }
  const du = uMax - uMin || 1;
  const dv = vMax - vMin || 1;
  const out = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    out[i * 2] = (uv.getX(start + i) - uMin) / du;
    out[i * 2 + 1] = (uv.getY(start + i) - vMin) / dv;
  }
  return out;
}

function passthroughEcranInfo(candidate: EcranCandidate): EcranInfo {
  const uv = candidate.mesh.geometry.getAttribute("uv") as THREE.BufferAttribute;
  return {
    name: candidate.name,
    collider: candidate.collider,
    body: candidate.body,
    maxHp: candidate.maxHp,
    chaine: candidate.chaine,
    extras: candidate.extras,
    batchGeometry: candidate.mesh.geometry,
    vertexStart: 0,
    vertexCount: uv.count,
    normalizedUV: computeNormalizedUV(uv, 0, uv.count),
  };
}

/**
 * Fusionne les `ecran_*` qui partagent un matériau (l'atlas `prd_chaines`,
 * en pratique un seul groupe pour tout le niveau) en UN lot de dessin — même
 * technique que `mergeVitreDecor`, sans découpe par cellule (une quarantaine
 * d'écrans pèse quelques centaines de triangles, rien à écarter par distance).
 */
export function mergeEcranDecor(root: THREE.Object3D, candidates: readonly EcranCandidate[]): EcranMergeResult {
  const groups = new Map<string, EcranCandidate[]>();
  for (const candidate of candidates) {
    const key = materialKey(candidate.mesh.material);
    const list = groups.get(key);
    if (list) list.push(candidate);
    else groups.set(key, [candidate]);
  }

  const rootInverse = root.matrixWorld.clone().invert();
  const toRootSpace = new THREE.Matrix4();
  const ecrans: EcranInfo[] = [];
  let batchCount = 0;

  for (const group of groups.values()) {
    if (group.length < 2) {
      ecrans.push(passthroughEcranInfo(group[0]!));
      continue;
    }

    const geometries = group.map((candidate) => {
      toRootSpace.multiplyMatrices(rootInverse, candidate.mesh.matrixWorld);
      return candidate.mesh.geometry.clone().applyMatrix4(toRootSpace);
    });
    const merged = mergeGeometries(geometries, false);
    if (!merged) {
      for (const g of geometries) g.dispose();
      for (const candidate of group) ecrans.push(passthroughEcranInfo(candidate));
      continue;
    }

    const batch = new THREE.Mesh(merged, group[0]!.mesh.material);
    batch.name = `ecran_fusion_${batchCount}`;
    root.add(batch);
    batch.updateMatrixWorld(true);
    batchCount++;

    let cursor = 0;
    for (let i = 0; i < group.length; i++) {
      const candidate = group[i]!;
      const originalUv = candidate.mesh.geometry.getAttribute("uv") as THREE.BufferAttribute;
      const count = originalUv.count;
      ecrans.push({
        name: candidate.name,
        collider: candidate.collider,
        body: candidate.body,
        maxHp: candidate.maxHp,
        chaine: candidate.chaine,
        extras: candidate.extras,
        batchGeometry: merged,
        vertexStart: cursor,
        vertexCount: count,
        // Normalisé depuis l'UV D'ORIGINE (avant fusion) : la fusion ne
        // touche pas les valeurs d'UV elles-mêmes, seulement leur buffer.
        normalizedUV: computeNormalizedUV(originalUv, 0, count),
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

  return { ecrans, batchCount };
}

// ---------------------------------------------------------------------------
// Système — état mutable d'une partie, reconstruit à chaque chargement.
// ---------------------------------------------------------------------------

export interface EcranHitEvent {
  name: string;
  point: THREE.Vector3;
  fatal: boolean;
}

export interface EcranDestroyedEvent {
  name: string;
  point: THREE.Vector3;
}

interface EcranState {
  info: EcranInfo;
  hp: number;
  broken: boolean;
  track: EcranTrack;
  frameIndex: number;
  clock: number;
}

/**
 * Les écrans d'UN niveau chargé. Reconstruit à chaque commit (hot reload
 * compris, comme `VitreSystem`/`SanitaireSystem`) : un écran cassé redevient
 * intact — et repart sur sa PREMIÈRE frame — au rechargement, avec le fichier.
 */
export class EcranSystem {
  private readonly states: EcranState[] = [];
  private readonly byColliderHandle = new Map<number, EcranState>();

  private readonly _hitEvents: EcranHitEvent[] = [];
  private readonly _destroyedEvents: EcranDestroyedEvent[] = [];
  private hitCursor = 0;

  constructor(ecrans: readonly EcranInfo[]) {
    for (const info of ecrans) {
      const state: EcranState = {
        info,
        hp: info.maxHp ?? Infinity,
        broken: false,
        track: info.chaine,
        frameIndex: 0,
        clock: 0,
      };
      this.states.push(state);
      this.byColliderHandle.set(info.collider.handle, state);
      applyFrame(state);
    }
  }

  get hitEvents(): ReadonlyArray<EcranHitEvent> {
    return this._hitEvents;
  }
  get destroyedEvents(): ReadonlyArray<EcranDestroyedEvent> {
    return this._destroyedEvents;
  }
  /** Nombre total d'`ecran_*` du niveau, cassés compris. */
  get count(): number {
    return this.states.length;
  }

  /** Vide les files d'évènements — une seule fois par frame d'affichage,
   * après tous les lecteurs, même contrat que `VitreSystem.clearFrameEvents`. */
  clearFrameEvents(): void {
    this._hitEvents.length = 0;
    this._destroyedEvents.length = 0;
    this.hitCursor = 0;
  }

  /**
   * Pas fixe : route les impacts du pas courant (comme `VitreSystem.update`)
   * puis avance l'horloge d'animation de CHAQUE écran de `dtFixed`. À
   * appeler APRÈS `weapons.update` et AVANT `physics.step`, même place que
   * les autres systèmes de casse.
   */
  update(dtFixed: number, hitEvents: ReadonlyArray<HitEvent>): void {
    for (let i = this.hitCursor; i < hitEvents.length; i++) {
      const hit = hitEvents[i]!;
      const state = this.byColliderHandle.get(hit.colliderHandle);
      if (!state || state.broken) continue;

      const damage = damageForWeapon(hit.weapon);
      state.hp -= damage;
      const fatal = state.hp <= 0;
      this._hitEvents.push({ name: state.info.name, point: hit.point.clone(), fatal });
      if (fatal) this.breakScreen(state, hit.point);
    }
    this.hitCursor = hitEvents.length;

    for (const state of this.states) {
      state.clock += dtFixed;
      const duration = FRAME_DURATION[state.track];
      const frames = CHAINE_FRAME_COUNTS[state.track];
      let changed = false;
      while (state.clock >= duration) {
        state.clock -= duration;
        state.frameIndex = (state.frameIndex + 1) % frames;
        changed = true;
      }
      if (changed) applyFrame(state);
    }
  }

  private breakScreen(state: EcranState, point: THREE.Vector3): void {
    state.broken = true;
    state.hp = 0;
    state.track = ECRAN_CASSE;
    state.frameIndex = 0;
    state.clock = 0;
    applyFrame(state);
    this._destroyedEvents.push({ name: state.info.name, point: point.clone() });
  }
}

/** Réécrit l'UV de la plage de sommets de `state.info` pour la frame
 * courante — jamais la géométrie/position, voir la doc de tête. */
function applyFrame(state: EcranState): void {
  const { info } = state;
  const cellIndex = ECRAN_ATLAS[state.track][state.frameIndex]!;
  const { u0, v0 } = cellRect(cellIndex);
  const uv = info.batchGeometry.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < info.vertexCount; i++) {
    const nu = info.normalizedUV[i * 2]!;
    const nv = info.normalizedUV[i * 2 + 1]!;
    uv.setXY(info.vertexStart + i, u0 + nu * CELL_UV, v0 + nv * CELL_UV);
  }
  uv.needsUpdate = true;
}
