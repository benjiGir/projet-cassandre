import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { damageForWeapon } from "../player/weaponConfig";
import type { HitEvent } from "../player/weapons";

/**
 * Préfixe `sanitaire_*` — cuvette ou urinoir utilisable/cassable ("Duke
 * Nukem 3D"), voir `docs/reference/conventions-nommage.md#préfixe-sanitaire`
 * et [ADR 0032](../../../docs/decisions/0032-sanitaires-utilisables.md).
 *
 * Architecture CALQUÉE sur `vitre_*` (`game/level/vitres.ts`, à lire en
 * entier avant de retoucher ce fichier) : `loader.ts` construit les
 * candidats bruts (`SanitaireCandidate`, un par mesh `sanitaire_*`, collider
 * déjà posé), `mergeSanitaireDecor` les FUSIONNE en UN lot par matériau pour
 * TOUT le niveau — même contrainte dure du budget de lots de dessin (200,
 * pire vue déjà à 198) que le verre, et pour la même raison : une salle de
 * toilettes tient dans quelques cabines/urinoirs côte à côte, jamais assez
 * de triangles pour justifier une découpe en cellules — et `SanitaireSystem`
 * fait vivre l'état de partie (intact/cassé, PV) au-dessus du résultat.
 *
 * Deux différences avec `vitre_*`, toutes deux dans le contrat commun :
 * 1. **Toujours un collider** (jamais de `solide: false`) — un sanitaire est
 *    un meuble, pas une verrière.
 * 2. **La portée d'usage exige de VISER l'appareil**, pas seulement de s'en
 *    tenir à distance (`SanitaireSystem.resolveAim`, "neartag" façon Duke
 *    3D — voir [ADR 0032](../../../docs/decisions/0032-sanitaires-utilisables.md),
 *    section "Portée — visée") : le rayon de visée du joueur
 *    (`game/session/sanitaires.ts`, seul endroit qui connaît
 *    `RaycastService`/`PhysicsWorld` côté sanitaires) doit toucher le
 *    collider d'un sanitaire INTACT en premier — une cloison de cabine plus
 *    proche gagne, comme n'importe quel mur bloquerait un tir. Un sanitaire
 *    CASSÉ n'a plus de collider (désactivé à la casse, voir `destroy`) :
 *    viser son jet — le volume vertical au-dessus de `jetOrigin` — compte à
 *    la place, à condition qu'aucun obstacle WORLD ne soit plus proche sur
 *    le même rayon.
 */

export type SanitaireKind = "cuvette" | "urinoir";
export const SANITAIRE_KINDS: readonly SanitaireKind[] = ["cuvette", "urinoir"];
/**
 * Repli d'un `sorte` absent ou inconnu — toujours accompagné d'un
 * avertissement bruyant (voir `loader.ts::readSanitaireKind`), contrairement
 * à `matiere`/`mouvement` dont l'absence est silencieuse : `sorte` est
 * OBLIGATOIRE par contrat. La cuvette est le sanitaire le plus fréquent du
 * plan de masse (trois cabines contre une rangée d'urinoirs) — un repli
 * dessus ne fait jamais disparaître l'objet ni planter le chargement.
 */
export const DEFAULT_SANITAIRE_KIND: SanitaireKind = "cuvette";

export function parseSanitaireKind(raw: unknown): SanitaireKind | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return (SANITAIRE_KINDS as readonly string[]).includes(value) ? (value as SanitaireKind) : null;
}

// ---------------------------------------------------------------------------
// Données du loader — un candidat par mesh `sanitaire_*`, AVANT fusion.
// ---------------------------------------------------------------------------

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
  /** Origine MONDE du jet d'eau permanent à la casse : bas-centre de la bbox
   * monde, calculée une fois ici (avant fusion, indépendante d'elle). Sert
   * aussi d'ancrage au volume de visée du jet une fois cassé, voir
   * `SanitaireSystem.resolveAim`. */
  jetOrigin: THREE.Vector3;
  extras: Record<string, unknown>;
}

/**
 * Un sanitaire APRÈS fusion — ce que `SanitaireSystem`/`LevelHandle.sanitaires`
 * manipulent. `batchGeometry`/`vertexStart`/`vertexCount` : la plage de
 * sommets de CE sanitaire dans le lot fusionné (ou sa propre géométrie,
 * inchangée, s'il n'a pas eu besoin d'être fusionné) — même contrat que
 * `VitreInfo`.
 */
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
  /**
   * Ce qui est RENDU — lots fusionnés, ou mesh resté seul de son matériau —
   * avec son centre MONDE, pour l'élagage par distance des objets
   * interactifs (`render/useObjectCulling.ts`). Sans lui, le lot de la salle
   * des toilettes était dessiné depuis le parking extérieur, à 80 m, dans la
   * pire vue du niveau (mesuré le 2026-09-24).
   */
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

/**
 * Fusionne les `sanitaire_*` qui partagent un même matériau, pour TOUT le
 * niveau (pas de découpe en cellules — même raison que `mergeVitreDecor` :
 * une salle de toilettes pèse quelques centaines de triangles, la fusion sert
 * ici à tenir le budget de LOTS, pas à écarter du rendu hors champ).
 * `root.matrixWorld` doit être à jour.
 */
export function mergeSanitaireDecor(
  root: THREE.Object3D,
  candidates: readonly SanitaireCandidate[],
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
      return candidate.mesh.geometry.clone().applyMatrix4(toRootSpace);
    });
    const merged = mergeGeometries(geometries, false);
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

// ---------------------------------------------------------------------------
// Système — état mutable d'une partie, reconstruit à chaque chargement.
// ---------------------------------------------------------------------------

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

/**
 * Ce que le raycast de visée a touché dans le monde WORLD (mur, cloison de
 * cabine, OU le collider d'un sanitaire intact), passé par l'appelant —
 * `game/session/sanitaires.ts`, seul endroit du jeu qui connaît
 * `RaycastService`/`PhysicsWorld` côté sanitaires. `null` si le rayon n'a
 * rien touché dans sa portée.
 */
export interface SanitaireAimWorldHit {
  colliderHandle: number;
  /** Distance le long du rayon jusqu'à ce point, mêmes unités que `rangeMeters` de `resolveAim` (mètres, rayon unitaire). */
  distance: number;
}

/** Rayon horizontal (m) du volume considéré comme "le jet" d'un sanitaire
 * cassé, pour la visée — quelques dizaines de centimètres (ADR 0032, section
 * "Portée — visée") : assez large pour viser sans devoir toucher le pixel
 * près, assez étroit pour qu'une cuvette voisine (cabines espacées de
 * 1,25 m) ne réponde pas au même rayon. */
const JET_AIM_RADIUS_METERS = 0.3;
/** Hauteur (m) du volume du jet au-dessus de `jetOrigin` — demandé par la tâche. */
const JET_AIM_HEIGHT_METERS = 1.5;
/** Marge (m) tolérée quand on compare l'entrée dans le volume du jet à la
 * distance du premier obstacle WORLD — absorbe l'imprécision flottante des
 * deux calculs (raycast Rapier vs. slab test maison), pas une vraie
 * épaisseur de mur. */
const JET_BLOCK_EPSILON_METERS = 1e-3;

const AXES = ["x", "y", "z"] as const;

/**
 * Distance d'entrée d'un rayon (`origin` + `direction` unitaire) dans la
 * boîte alignée aux axes centrée sur `jetOrigin` (colonne d'eau verticale,
 * voir `JET_AIM_RADIUS_METERS`/`JET_AIM_HEIGHT_METERS`) — `null` si le rayon
 * ne la touche pas dans `[0, maxDistance]`. Test des lames (slab test)
 * standard, déterministe : aucune fonction transcendante, et cette fonction
 * n'alimente d'ailleurs aucune physique Rapier — seulement une décision de
 * gameplay prise une fois par appui sur E (invariant #12 sans objet ici,
 * mentionné pour mémoire).
 */
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

/**
 * Les sanitaires d'UN niveau chargé. Reconstruit à chaque `onLoaded` (hot
 * reload compris, comme `PropSystem`/`VitreSystem`) : ils reviennent intacts
 * au rechargement, avec le fichier.
 */
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

  /**
   * Écrit les origines MONDE des jets d'eau actifs dans `out` (vidé
   * d'abord), SANS allouer — contrairement à `activeJets` ci-dessus, qui
   * clone un `Vector3` par jet à chaque appel. Pour `core/waterAmbience.ts`,
   * lu au taux d'affichage (60 fois par seconde) : `out` est un tableau
   * scratch fourni et réutilisé par l'appelant, les `Vector3` poussés dedans
   * sont des RÉFÉRENCES vers `SanitaireInfo.jetOrigin` — à ne jamais muter.
   */
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

  /**
   * Tirs du JOUEUR (hitscan, plombs, pied-de-biche) — même chemin de
   * `HitEvent` que `VitreSystem.update`, dégâts par la MÊME table
   * (`damageForWeapon`). Non destructif : la file appartient à `WeaponSystem` ;
   * le curseur local empêche sa relecture lors d'un second pas fixe.
   */
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

  /**
   * Tir ENNEMI (`enemyMachine.ts::handleEnemyShotMiss`) : casse le sanitaire
   * D'UN COUP, sans passer par ses PV — même effet Duke Nukem que
   * `VitreSystem.tryBreakByColliderHandle`, généralisé côté
   * `enemyMachine.ts` (`BreakableHitTarget`) plutôt que dupliqué. Retourne
   * `true` si un sanitaire intact a bien été cassé.
   */
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

  /**
   * Sanitaire VISÉ à portée courte — "neartag" façon Duke 3D, ADR 0032
   * section "Portée — visée". Le RAYCAST Rapier lui-même est fait par
   * l'appelant (`game/session/sanitaires.ts::trySanitaire`, seul endroit du
   * jeu qui connaît `RaycastService`/`PhysicsWorld` côté sanitaires — même
   * séparation que `vitre_*`/`prop_*`) : cette méthode ne fait QUE
   * l'interprétation géométrique de son résultat (`worldHit`), donnée pour
   * `[eyeOrigin, eyeOrigin + direction * rangeMeters]`.
   *
   * - Si `worldHit` pointe sur le collider d'un sanitaire encore INTACT, il
   *   gagne — rien de plus proche ne bloquait le rayon (une cloison de
   *   cabine plus proche aurait été le collider touché à la place).
   * - Sinon, teste le volume vertical du jet de chaque sanitaire CASSÉ
   *   (`rayJetVolumeEntry`, ancré sur `jetOrigin`) : le premier volume
   *   touché par le rayon l'emporte, à condition qu'aucun obstacle WORLD
   *   (`worldHit`, s'il existe) ne soit strictement plus proche sur le même
   *   rayon — sinon une cloison ou un mur est entre le joueur et le jet.
   *
   * C'est à l'appelant de décider quoi faire de `broken` (soulagement vs
   * gorgée) — ce système ne connaît ni les PV du joueur ni les répliques.
   */
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
