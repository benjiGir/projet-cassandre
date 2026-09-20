import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { damageForWeapon } from "../player/weaponConfig";
import type { HitEvent } from "../player/weapons";

/**
 * `prop_*` — mobilier PHYSIQUE du niveau : poussable par le joueur et les
 * ennemis, cassable au tir quand le `.glb` lui donne des PV.
 *
 * Ce fichier ne contient que la partie MUTABLE, propre à une partie (PV
 * courants, transformations interpolées, files d'évènements). La construction
 * des corps Rapier, elle, reste dans `level/loader.ts` avec tous les autres
 * préfixes — un seul endroit connaît la correspondance nom Blender → effet.
 *
 * Trois disciplines du projet se rejoignent ici, aucune n'est négociable :
 *
 * 1. **Pas fixe strict** (invariant #1). `update()` applique les dégâts et
 *    les impulsions AVANT `physics.step()` (ordre garanti par `core/loop.ts` :
 *    `updateGameplay` puis `stepPhysics`). `syncFromPhysics()` relit les corps
 *    APRÈS le pas. Rien ne lit ni n'écrit un corps au taux d'affichage.
 * 2. **Interpolation du rendu** (même patron que la balle de la gym) :
 *    `snapshotPrevious()` / `syncFromPhysics()` tiennent deux poses par prop,
 *    `interpolate(alpha)` est le SEUL endroit qui touche un mesh.
 * 3. **Évènements, pas d'appels directs.** La destruction pousse un évènement
 *    lu par `loop/updateFx.ts` (débris, son) : `game/` ne connaît jamais
 *    `render/fx.ts`, exactement comme `SuitManager` et ses `hurtEvents`.
 *
 * see: docs/decisions/0030-props-dynamiques.md
 * see: docs/systems/physique.md#props-dynamiques
 */

/**
 * Matière d'un prop, lue dans la custom property Blender `matiere`. Décide du
 * son de destruction et de la couleur des débris — jamais de la physique
 * (c'est `masse` qui la porte).
 */
export const PROP_MATERIALS = ["bois", "carton", "verre", "metal"] as const;
export type PropMaterial = (typeof PROP_MATERIALS)[number];

/** Matière par défaut d'un `prop_*` qui n'en déclare pas. */
export const DEFAULT_PROP_MATERIAL: PropMaterial = "bois";

export function parsePropMaterial(raw: unknown): PropMaterial | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return (PROP_MATERIALS as readonly string[]).includes(value) ? (value as PropMaterial) : null;
}

/**
 * Un `prop_*` tel que le loader le construit : corps dynamique déjà posé dans
 * le monde, mesh déjà recentré sur ce corps (voir `buildProp`). Données
 * IMMUABLES — les PV courants vivent dans `PropState`, pas ici, pour que le
 * `LevelHandle` reste une description du fichier et pas un état de partie.
 */
export interface PropInfo {
  name: string;
  object: THREE.Mesh;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  /** Demi-étendues MONDE du cuboid, mêmes conventions que `DoorInfo`. */
  halfExtents: THREE.Vector3;
  /**
   * Centre de la bounding box dans l'espace LOCAL du mesh.
   *
   * Un corps dynamique tourne autour de son centre de masse, donc le collider
   * est posé sur le centre de la boîte — alors que l'origine du mesh, elle,
   * est où l'artiste l'a laissée (le kit du projet la met dans un COIN). Sans
   * ce décalage, un caddie poussé tournerait autour d'un point situé hors de
   * lui. C'est le piège que `buildDoor` n'avait pas traité
   * ([ADR 0012](../../../docs/decisions/0012-porte-collider-non-recentre.md)),
   * sans conséquence pour une porte verrouillée, fatal pour un corps libre.
   */
  centerOffset: THREE.Vector3;
  /** PV de départ, lus dans `pv`. `null` = INDESTRUCTIBLE (poussable seulement). */
  maxHp: number | null;
  matiere: PropMaterial;
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

/** État par prop, reconstruit à chaque chargement de niveau. */
interface PropState {
  info: PropInfo;
  /** `Infinity` pour un prop indestructible — évite un `null` à tester à chaque coup. */
  hp: number;
  destroyed: boolean;
  /** Pose du pas fixe précédent et du pas courant — lues par `interpolate`. */
  prevPos: THREE.Vector3;
  prevQuat: THREE.Quaternion;
  currPos: THREE.Vector3;
  currQuat: THREE.Quaternion;
  /** Échelle MONDE figée à la construction : un corps Rapier n'en porte pas. */
  scale: THREE.Vector3;
  /** `translate(-centerOffset)`, précalculée — ramène la pose du CORPS (centre de la boîte) sur l'ORIGINE du mesh. */
  offsetMatrix: THREE.Matrix4;
  /**
   * Le prop a bougé entre les deux dernières poses. Faux pour tout ce qui
   * dort — c'est-à-dire la quasi-totalité des props la quasi-totalité du
   * temps — et `interpolate` saute alors entièrement ce prop.
   */
  moving: boolean;
  /** Dans la portée de rendu à la frame précédente — voir `PROP_RENDER_DISTANCE_SQ`. */
  visible: boolean;
}

/**
 * Impulsion transmise par un impact de tir, en N·s par point de dégât.
 *
 * Calibré sur les valeurs du jeu plutôt que sur la physique : un plomb de
 * pompe fait `shotgunPelletDamage` et il en touche plusieurs, un coup de
 * pied-de-biche fait `meleeDamage`. À 12 N·s par point, une caisse de 30 kg
 * encaisse un déplacement visible sans décoller comme un ballon.
 */
const IMPULSE_PER_DAMAGE = 12;

/**
 * Distance au-delà de laquelle un prop n'est plus dessiné, en mètres.
 *
 * Trois.js n'élimine que par le CÔNE DE VUE, jamais par occlusion. Le décor
 * s'en sort parce qu'il est fusionné par cellule de 48 m
 * ([ADR 0023](../../../docs/decisions/0023-fusion-decor-au-chargement.md)) : un
 * mur lointain coûte alors une fraction de lot. Un prop, lui, est un mesh à
 * part par construction — il ne peut pas rejoindre un lot — donc chaque prop
 * DANS LE CÔNE est un lot de dessin, mur ou pas mur entre les deux.
 *
 * Mesuré : depuis le spawn du parking, qui regarde l'axe long du niveau,
 * 37 props sur 51 étaient dessinés à travers tout le magasin — 210 lots pour
 * un budget de 200. Ce n'est pas « un lot par prop visible », c'est « un lot
 * par prop dans le cône », et la nuance coûtait le budget entier.
 *
 * 36 m est choisi sur la taille apparente : un carton de 0,6 m fait environ
 * quatre pixels de haut à cette distance en 640×360. Ce qui disparaît au-delà
 * n'était de toute façon pas lisible.
 */
const PROP_RENDER_DISTANCE_SQ = 36 * 36;

/** Scratch réutilisés — zéro allocation en régime établi (discipline du pas fixe). */
const impulseScratch = new THREE.Vector3();
const worldMatrixScratch = new THREE.Matrix4();
const localMatrixScratch = new THREE.Matrix4();
const lerpPosScratch = new THREE.Vector3();
const lerpQuatScratch = new THREE.Quaternion();

/**
 * Les props d'UN niveau chargé. Reconstruit à chaque `onLoaded` (donc à chaque
 * hot reload), au même titre que `currentNavGraph` et `lightPool` — voir
 * `game/session/spawning.ts`.
 */
export class PropSystem {
  private readonly states: PropState[] = [];
  /**
   * `collider.handle` → prop. C'est ce qui permet de router un tir sans
   * dupliquer la moindre logique de balistique hors de `weapons.ts` : chaque
   * `HitEvent` porte déjà le handle du collider RÉELLEMENT touché.
   */
  private readonly byColliderHandle = new Map<number, PropState>();
  /**
   * Inverse de la matrice monde de la racine du niveau. Les corps Rapier
   * raisonnent en MONDE, les meshes sont enfants de cette racine : sans cette
   * matrice, un niveau dont la racine porte une transformation (rien ne
   * l'interdit dans le `.glb`) verrait ses props dériver.
   */
  private readonly rootInverse: THREE.Matrix4;

  private readonly _hitEvents: PropHitEvent[] = [];
  private readonly _destroyedEvents: PropDestroyedEvent[] = [];

  constructor(props: readonly PropInfo[], root: THREE.Object3D) {
    root.updateWorldMatrix(true, false);
    this.rootInverse = root.matrixWorld.clone().invert();

    for (const info of props) {
      const t = info.body.translation();
      const r = info.body.rotation();
      const position = new THREE.Vector3(t.x, t.y, t.z);
      const quaternion = new THREE.Quaternion(r.x, r.y, r.z, r.w);
      const state: PropState = {
        info,
        hp: info.maxHp ?? Infinity,
        destroyed: false,
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

  /**
   * Vide les files d'évènements. Appelée UNE SEULE FOIS par frame
   * d'affichage, après TOUS les lecteurs — même contrat que
   * `WeaponSystem.clearFrameEvents`/`SuitManager.clearFrameEvents`.
   */
  clearFrameEvents(): void {
    this._hitEvents.length = 0;
    this._destroyedEvents.length = 0;
  }

  /**
   * Pas fixe. Route les impacts d'armes du pas courant vers les props touchés :
   * impulsion (toujours) puis dégâts (si le prop a des PV).
   *
   * À appeler APRÈS `weapons.update` (les `hitEvents` du pas existent) et
   * AVANT `physics.step` (l'impulsion doit être intégrée par ce pas-ci) —
   * c'est exactement la place qu'occupe déjà `suitManager.update`.
   *
   * Lecture NON DESTRUCTIVE de `hitEvents` : la file appartient à
   * `WeaponSystem`, qui la vide lui-même en fin de frame d'affichage.
   */
  update(hitEvents: ReadonlyArray<HitEvent>): void {
    if (this.states.length === 0) return;
    for (const hit of hitEvents) {
      const state = this.byColliderHandle.get(hit.colliderHandle);
      if (!state || state.destroyed) continue;

      // `damageForWeapon` : la MÊME table que celle qui blesse un Costard
      // (`SuitManager.aggregateHits`), jamais un barème parallèle pour les props.
      const damage = damageForWeapon(hit.weapon);

      // `normal` pointe VERS le tireur (convention `castRayAndGetNormal`) :
      // l'impulsion pousse dans l'autre sens, donc vers l'intérieur du prop.
      impulseScratch.copy(hit.normal).negate().multiplyScalar(damage * IMPULSE_PER_DAMAGE);
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
  }

  /**
   * Retire un prop du jeu : collider et corps DÉSACTIVÉS, mesh caché, un
   * `PropDestroyedEvent` poussé.
   *
   * Le corps est désactivé plutôt que retiré du monde, et c'est délibéré :
   * `loader.ts::disposeLevelResource` appelle `removeRigidBody` sur CHAQUE
   * corps du niveau à la libération. Un corps déjà retiré ici libérerait son
   * handle, que Rapier peut avoir réattribué entre-temps à un corps neuf — la
   * libération du niveau détruirait alors l'objet de quelqu'un d'autre. Un
   * corps désactivé ne simule plus rien et reste libérable exactement une fois.
   */
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
  }

  /**
   * Détruit un prop par son nom, sans passer par un tir. Sert au harnais de
   * console (`cassandre.props().casser("prop_caisse_1")`) et aux tests —
   * jamais au gameplay, qui passe toujours par `update`.
   */
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

  /**
   * Pas fixe, APRÈS `physics.step` — relit la pose de chaque corps.
   *
   * `moving` retombe à faux dès que le corps dort : un prop endormi (donc la
   * quasi-totalité d'entre eux la quasi-totalité du temps) ne coûte alors plus
   * rien au rendu. Le test porte sur le DÉPLACEMENT et pas sur
   * `body.isSleeping()` seul, pour que la dernière pose d'un corps qui vient de
   * s'endormir soit bien écrite dans le mesh.
   */
  syncFromPhysics(): void {
    for (const state of this.states) {
      if (state.destroyed) continue;
      const t = state.info.body.translation();
      const r = state.info.body.rotation();
      state.currPos.set(t.x, t.y, t.z);
      state.currQuat.set(r.x, r.y, r.z, r.w);
      state.moving =
        !state.prevPos.equals(state.currPos) || !state.prevQuat.equals(state.currQuat);
    }
  }

  /**
   * Taux d'affichage. SEUL endroit qui écrit dans un mesh de prop — même
   * séparation que `interpolatedPosition` côté ennemis.
   */
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
      localMatrixScratch.decompose(
        state.info.object.position,
        state.info.object.quaternion,
        state.info.object.scale,
      );
    }
  }

  /** Résumé lisible pour la console de dev (`cassandre.props()`). */
  describe(): Array<{ name: string; matiere: PropMaterial; hp: number; maxHp: number | null; destroyed: boolean; position: THREE.Vector3 }> {
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
