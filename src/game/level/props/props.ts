import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

import { damageForHit } from "../../player/weapons/weaponConfig";
import type { HitEvent } from "../../player/weapons/weaponTypes";
import { runGameplaySync } from "../../../app/runtime/gameRuntime";
import { DeterministicRandom } from "../../../core/effect/random";
import { FOOD_HEAL_AMOUNTS, parseFoodItem, type FoodItem } from "../interactions/food";
import { HEAL_PICKUP_RADIUS } from "../interactions/interactive";
import { explosionConfig } from "./propConfig";

// see: docs/decisions/0030-props-dynamiques.md

// see: docs/6-reference/notes-code-gameplay-niveau.md#objets-cassables-et-interactions
export const PROP_MATERIALS = [
  "bois",
  "carton",
  "verre",
  "metal",
  "farine",
  "eau",
  "electronique",
  // Explosif : sa casse est un souffle, voir `PropSystem.explode`.
  "gaz",
] as const;
export type PropMaterial = (typeof PROP_MATERIALS)[number];

/** Matière par défaut d'un `prop_*` qui n'en déclare pas. */
export const DEFAULT_PROP_MATERIAL: PropMaterial = "bois";

export function parsePropMaterial(raw: unknown): PropMaterial | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return (PROP_MATERIALS as readonly string[]).includes(value) ? (value as PropMaterial) : null;
}

export interface PropInfo {
  name: string;
  object: THREE.Mesh;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  /** Demi-étendues MONDE du cuboid, mêmes conventions que `DoorInfo`. */
  halfExtents: THREE.Vector3;
  centerOffset: THREE.Vector3;
  /** PV de départ, lus dans `pv`. `null` = INDESTRUCTIBLE (poussable seulement). */
  maxHp: number | null;
  matiere: PropMaterial;
  // see: docs/archive/reference-conventions-nommage.md#props-physiques
  contenu: { item: string; count: number } | null;
  extras: Record<string, unknown>;
}

/** Un prop touché par un tir du joueur (qu'il soit détruit ou non, ce pas-ci). */
export interface PropHitEvent {
  name: string;
  point: THREE.Vector3;
  matiere: PropMaterial;
  /** `true` si ce coup a amené les PV à zéro — un `PropDestroyedEvent` suit dans la même frame. */
  fatal: boolean;
}

/** Un prop dont les PV viennent de tomber à zéro. Poussé UNE SEULE FOIS par prop. */
export interface PropDestroyedEvent {
  name: string;
  /** Point du coup fatal (MONDE) — origine des débris. */
  point: THREE.Vector3;
  /** Direction du coup fatal, unitaire — direction de base de la dispersion des débris. */
  direction: THREE.Vector3;
  matiere: PropMaterial;
}

/** Un prop `gaz` vient d'exploser. Poussé UNE SEULE FOIS par prop. */
export interface PropExplosionEvent {
  name: string;
  /** Centre du souffle (MONDE) : le centre du prop au moment où il saute. */
  point: THREE.Vector3;
}

/** État par prop, reconstruit à chaque chargement de niveau. */
interface PropState {
  info: PropInfo;
  /** `Infinity` pour un prop indestructible — évite un `null` à tester à chaque coup. */
  hp: number;
  destroyed: boolean;
  /** Pas fixes avant qu'un prop `gaz` atteint par un souffle n'explose à son tour ; 0 = pas amorcé. */
  fuse: number;
  /** Pose du pas fixe précédent et du pas courant — lues par `interpolate`. */
  prevPos: THREE.Vector3;
  prevQuat: THREE.Quaternion;
  currPos: THREE.Vector3;
  currQuat: THREE.Quaternion;
  /** Échelle MONDE figée à la construction : un corps Rapier n'en porte pas. */
  scale: THREE.Vector3;
  /** `translate(-centerOffset)`, précalculée — ramène la pose du CORPS (centre de la boîte) sur l'ORIGINE du mesh. */
  offsetMatrix: THREE.Matrix4;
  moving: boolean;
  /** Dans la portée de rendu à la frame précédente — voir `PROP_RENDER_DISTANCE_SQ`. */
  visible: boolean;
}

const IMPULSE_PER_DAMAGE = 12;

const PROP_RENDER_DISTANCE_SQ = 36 * 36;

/** Seuils de `isPushedNear` : vitesse horizontale du prop (m/s) et distance de son centre au joueur (m). */
const PUSH_SPEED_SQ = 0.6 * 0.6;
const PUSH_DISTANCE_SQ = 1.6 * 1.6;

/** Scratch réutilisés — zéro allocation en régime établi (discipline du pas fixe). */
const impulseScratch = new THREE.Vector3();
const worldMatrixScratch = new THREE.Matrix4();
const localMatrixScratch = new THREE.Matrix4();
const lerpPosScratch = new THREE.Vector3();
const lerpQuatScratch = new THREE.Quaternion();

const FOOD_DROP_SEED = 0x8f00d;
/** Dispersion horizontale des drops autour du point de casse, mètres. */
const FOOD_DROP_SCATTER_RADIUS = 0.5;
/** Placeholder de rendu — géométrie/couleurs PARTAGÉES le temps que
 * `level-forge` pose un vrai modèle en Blender (lot 3/5 du chantier « Les
 * coulisses ») ; le collectible fonctionne dès maintenant. */
const FOOD_DROP_GEOMETRY = new THREE.SphereGeometry(0.12, 8, 6);
const FOOD_DROP_COLORS: Record<FoodItem, number> = {
  donut: 0xe8a0c0,
  sandwich: 0xd8b478,
  jambon: 0xc76a5a,
  poulet: 0xd9a441,
  pizza: 0xd9622b,
};

/** Un aliment lâché par un prop détruit, encore au sol ou déjà ramassé. */
interface FoodDropState {
  item: FoodItem;
  heals: number;
  /** Position MONDE, figée à la création — ces drops ne bougent jamais. */
  position: THREE.Vector3;
  object: THREE.Mesh;
  collected: boolean;
}

export class PropSystem {
  private readonly states: PropState[] = [];
  private readonly byColliderHandle = new Map<number, PropState>();
  private readonly rootInverse: THREE.Matrix4;
  /** Racine du niveau — conservée pour y attacher les drops de nourriture
   * (voir `spawnFoodDrops`), même parent que le décor et les props eux-mêmes. */
  private readonly root: THREE.Object3D;

  private readonly _hitEvents: PropHitEvent[] = [];
  private readonly _destroyedEvents: PropDestroyedEvent[] = [];
  private readonly _explosionEvents: PropExplosionEvent[] = [];
  private readonly dueScratch: PropState[] = [];
  private readonly foodDrops: FoodDropState[] = [];
  private hitCursor = 0;
  private readonly pendingBlasts: PropExplosionEvent[] = [];

  /** Flux déterministe dédié aux drops de nourriture — voir `FOOD_DROP_SEED`. */
  private readonly nextFoodRandom = runGameplaySync(
    DeterministicRandom.useSync((random) => random.forSeed(FOOD_DROP_SEED)),
  );

  constructor(props: readonly PropInfo[], root: THREE.Object3D) {
    root.updateWorldMatrix(true, false);
    this.rootInverse = root.matrixWorld.clone().invert();
    this.root = root;

    for (const info of props) {
      const t = info.body.translation();
      const r = info.body.rotation();
      const position = new THREE.Vector3(t.x, t.y, t.z);
      const quaternion = new THREE.Quaternion(r.x, r.y, r.z, r.w);
      const state: PropState = {
        info,
        hp: info.maxHp ?? Infinity,
        destroyed: false,
        fuse: 0,
        prevPos: position.clone(),
        prevQuat: quaternion.clone(),
        currPos: position,
        currQuat: quaternion,
        scale: info.object.scale.clone(),
        offsetMatrix: new THREE.Matrix4().makeTranslation(
          -info.centerOffset.x,
          -info.centerOffset.y,
          -info.centerOffset.z,
        ),
        // Vrai au premier pas : la pose du mesh doit être écrite au moins une
        // fois, même pour un prop qui ne bougera jamais.
        moving: true,
        visible: false,
      };
      this.states.push(state);
      this.byColliderHandle.set(info.collider.handle, state);
    }
  }

  get hitEvents(): ReadonlyArray<PropHitEvent> {
    return this._hitEvents;
  }
  get destroyedEvents(): ReadonlyArray<PropDestroyedEvent> {
    return this._destroyedEvents;
  }
  get explosionEvents(): ReadonlyArray<PropExplosionEvent> {
    return this._explosionEvents;
  }

  /**
   * Les explosions dont le souffle n'a pas encore été appliqué aux vivants,
   * une seule fois chacune. Une file à part de `explosionEvents`, que l'affichage
   * vide à chaque image : une explosion née hors du pas fixe (console de dev),
   * ou pendant une image sans pas fixe, est soufflée au pas suivant au lieu
   * d'être oubliée.
   */
  takeNewExplosions(): ReadonlyArray<PropExplosionEvent> {
    return this.pendingBlasts.splice(0);
  }

  isPushedNear(playerPosition: THREE.Vector3): boolean {
    for (const state of this.states) {
      if (state.destroyed) continue;
      const v = state.info.body.linvel();
      if (v.x * v.x + v.z * v.z < PUSH_SPEED_SQ) continue;
      const t = state.info.body.translation();
      const dx = t.x - playerPosition.x;
      const dz = t.z - playerPosition.z;
      if (dx * dx + dz * dz <= PUSH_DISTANCE_SQ) return true;
    }
    return false;
  }

  /** Nombre total de `prop_*` du niveau, détruits compris. */
  get count(): number {
    return this.states.length;
  }
  /** Props encore debout — `count` moins les détruits. */
  get aliveCount(): number {
    let alive = 0;
    for (const state of this.states) if (!state.destroyed) alive++;
    return alive;
  }

  clearFrameEvents(): void {
    this._hitEvents.length = 0;
    this._destroyedEvents.length = 0;
    this._explosionEvents.length = 0;
    this.hitCursor = 0;
  }

  /** Un pas fixe : les mèches de la réaction en chaîne d'abord, puis les impacts du joueur. */
  update(hitEvents: ReadonlyArray<HitEvent>): void {
    this.burnFuses();
    for (let i = this.hitCursor; i < hitEvents.length; i++) {
      const hit = hitEvents[i];
      const state = this.byColliderHandle.get(hit.colliderHandle);
      if (!state || state.destroyed) continue;

      // `damageForHit` : la MÊME table que celle qui blesse un Costard
      // (`SuitManager.aggregateHits`), jamais un barème parallèle pour les props.
      const damage = damageForHit(hit);

      // `normal` pointe VERS le tireur (convention `castRayAndGetNormal`) :
      // l'impulsion pousse dans l'autre sens, donc vers l'intérieur du prop.
      impulseScratch
        .copy(hit.normal)
        .negate()
        .multiplyScalar(damage * IMPULSE_PER_DAMAGE);
      state.info.body.applyImpulseAtPoint(
        { x: impulseScratch.x, y: impulseScratch.y, z: impulseScratch.z },
        { x: hit.point.x, y: hit.point.y, z: hit.point.z },
        true,
      );

      state.hp -= damage;
      const fatal = state.hp <= 0;
      this._hitEvents.push({
        name: state.info.name,
        point: hit.point.clone(),
        matiere: state.info.matiere,
        fatal,
      });
      if (fatal) this.destroy(state, hit.point, impulseScratch);
    }
    this.hitCursor = hitEvents.length;
  }

  // Garder le corps désactivé : son handle ne doit pas être réutilisé avant le teardown.
  private destroy(state: PropState, point: THREE.Vector3, impulse: THREE.Vector3): void {
    state.destroyed = true;
    state.hp = 0;
    state.info.collider.setEnabled(false);
    state.info.body.setEnabled(false);
    state.info.object.visible = false;
    state.moving = false;
    state.visible = false;

    const direction = impulse.clone();
    // Un coup exactement tangent donnerait une impulsion nulle : les débris
    // partent alors vers le haut plutôt que de rester collés au point d'impact.
    if (direction.lengthSq() < 1e-8) direction.set(0, 1, 0);
    else direction.normalize();

    this._destroyedEvents.push({
      name: state.info.name,
      point: point.clone(),
      direction,
      matiere: state.info.matiere,
    });

    if (state.info.matiere === "gaz") this.explode(state);

    // Contenu (chantier « Les coulisses », système 3) : seuls les noms qui
    // résolvent en `FoodItem` produisent un pickup — voir `PropInfo.contenu`.
    if (state.info.contenu) {
      const item = parseFoodItem(state.info.contenu.item);
      if (item) this.spawnFoodDrops(point, item, state.info.contenu.count);
    }
  }

  /**
   * Le souffle d'un prop `gaz`, côté props : il pousse ses voisins et amorce
   * les autres bonbonnes à sa portée. Les dégâts au joueur et aux ennemis sont
   * appliqués par l'appelant, à partir de `explosionEvents`.
   */
  private explode(source: PropState): void {
    const t = source.info.body.translation();
    const center = new THREE.Vector3(t.x, t.y, t.z);
    const event = { name: source.info.name, point: center };
    this._explosionEvents.push(event);
    this.pendingBlasts.push(event);

    for (const state of this.states) {
      if (state.destroyed) continue;
      const p = state.info.body.translation();
      impulseScratch.set(p.x - center.x, p.y - center.y, p.z - center.z);
      const distance = impulseScratch.length();
      if (distance >= explosionConfig.radius) continue;

      // Un prop exactement au centre n'a pas de direction : il part vers le haut.
      if (distance > 1e-4) impulseScratch.multiplyScalar(1 / distance);
      else impulseScratch.set(0, 0, 0);
      impulseScratch.y += explosionConfig.impulseLift;
      impulseScratch.multiplyScalar(explosionConfig.impulse * (1 - distance / explosionConfig.radius));
      state.info.body.applyImpulse({ x: impulseScratch.x, y: impulseScratch.y, z: impulseScratch.z }, true);

      // Réaction en chaîne : une mèche déjà allumée n'est pas rallongée.
      if (state.info.matiere === "gaz" && state.fuse === 0) state.fuse = explosionConfig.chainDelaySteps;
    }
  }

  /** Décompte, en pas fixes, des bonbonnes amorcées par un souffle. Ordre du niveau : déterministe. */
  private burnFuses(): void {
    // Deux temps : une bonbonne amorcée PENDANT ce pas ne doit pas voir sa
    // mèche entamée dans le même pas, sinon son délai dépendrait de sa place
    // dans la liste.
    this.dueScratch.length = 0;
    for (const state of this.states) {
      if (state.destroyed || state.fuse === 0) continue;
      state.fuse -= 1;
      if (state.fuse === 0) this.dueScratch.push(state);
    }
    for (const state of this.dueScratch) {
      if (state.destroyed) continue;
      const t = state.info.body.translation();
      this.destroy(state, new THREE.Vector3(t.x, t.y, t.z), new THREE.Vector3(0, 1, 0));
    }
  }

  private spawnFoodDrops(origin: THREE.Vector3, item: FoodItem, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = this.nextFoodRandom() * Math.PI * 2;
      const radius = this.nextFoodRandom() * FOOD_DROP_SCATTER_RADIUS;
      const position = new THREE.Vector3(
        origin.x + Math.cos(angle) * radius,
        origin.y,
        origin.z + Math.sin(angle) * radius,
      );

      const mesh = new THREE.Mesh(FOOD_DROP_GEOMETRY, new THREE.MeshLambertMaterial({ color: FOOD_DROP_COLORS[item] }));
      mesh.position.copy(position).applyMatrix4(this.rootInverse);
      this.root.add(mesh);

      this.foodDrops.push({ item, heals: FOOD_HEAL_AMOUNTS[item], position, object: mesh, collected: false });
    }
  }

  collectFoodDrops(
    playerPosition: THREE.Vector3,
    tryHeal: (amount: number, item: FoodItem) => boolean,
    radius = HEAL_PICKUP_RADIUS,
  ): void {
    const radiusSq = radius * radius;
    for (const drop of this.foodDrops) {
      if (drop.collected) continue;
      if (playerPosition.distanceToSquared(drop.position) > radiusSq) continue;
      if (!tryHeal(drop.heals, drop.item)) continue;
      drop.collected = true;
      drop.object.visible = false;
    }
  }

  /** Nombre de drops de nourriture encore au sol — console de debug. */
  get foodDropCount(): number {
    let alive = 0;
    for (const drop of this.foodDrops) if (!drop.collected) alive++;
    return alive;
  }

  destroyByName(name: string): boolean {
    const state = this.states.find((s) => s.info.name === name);
    if (!state || state.destroyed) return false;
    const t = state.info.body.translation();
    this.destroy(state, new THREE.Vector3(t.x, t.y, t.z), new THREE.Vector3(0, 1, 0));
    return true;
  }

  /** Pas fixe, AVANT `updateGameplay` — la pose du pas précédent devient la référence d'interpolation. */
  snapshotPrevious(): void {
    for (const state of this.states) {
      if (state.destroyed) continue;
      state.prevPos.copy(state.currPos);
      state.prevQuat.copy(state.currQuat);
    }
  }

  syncFromPhysics(): void {
    for (const state of this.states) {
      if (state.destroyed) continue;
      const t = state.info.body.translation();
      const r = state.info.body.rotation();
      state.currPos.set(t.x, t.y, t.z);
      state.currQuat.set(r.x, r.y, r.z, r.w);
      state.moving = !state.prevPos.equals(state.currPos) || !state.prevQuat.equals(state.currQuat);
    }
  }

  interpolate(alpha: number, cameraPosition: THREE.Vector3): void {
    for (const state of this.states) {
      if (state.destroyed) continue;

      // Élagage par distance AVANT tout le reste — c'est lui qui tient le
      // budget de lots de dessin (voir `PROP_RENDER_DISTANCE_SQ`).
      const visible = state.currPos.distanceToSquared(cameraPosition) <= PROP_RENDER_DISTANCE_SQ;
      const reapparu = visible && !state.visible;
      state.visible = visible;
      if (state.info.object.visible !== visible) state.info.object.visible = visible;

      // Un prop qui revient dans la portée a pu bouger pendant qu'il était
      // élagué : sa pose est réécrite une fois, même s'il dort maintenant.
      if (!visible || (!state.moving && !reapparu)) continue;
      lerpPosScratch.lerpVectors(state.prevPos, state.currPos, alpha);
      lerpQuatScratch.slerpQuaternions(state.prevQuat, state.currQuat, alpha);
      // Pose MONDE du CORPS, puis retour sur l'origine du mesh (voir
      // `PropInfo.centerOffset`), puis passage dans l'espace de la racine.
      worldMatrixScratch.compose(lerpPosScratch, lerpQuatScratch, state.scale);
      worldMatrixScratch.multiply(state.offsetMatrix);
      localMatrixScratch.multiplyMatrices(this.rootInverse, worldMatrixScratch);
      localMatrixScratch.decompose(state.info.object.position, state.info.object.quaternion, state.info.object.scale);
    }
  }

  /** Résumé lisible pour la console de dev (`cassandre.props()`). */
  describe(): Array<{
    name: string;
    matiere: PropMaterial;
    hp: number;
    maxHp: number | null;
    destroyed: boolean;
    position: THREE.Vector3;
  }> {
    return this.states.map((state) => ({
      name: state.info.name,
      matiere: state.info.matiere,
      hp: state.hp,
      maxHp: state.info.maxHp,
      destroyed: state.destroyed,
      position: state.currPos.clone(),
    }));
  }
}
