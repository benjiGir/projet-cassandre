import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { attributeKey, materialKey } from "./mergeStaticDecor";

/**
 * `door_*` animés — voir `docs/reference/conventions-nommage.md#portes-animées`
 * et [ADR 0031](../../../docs/decisions/0031-portes-animees-et-vitres.md) pour
 * la cause racine (aucune porte ne bougeait jamais à l'écran depuis la porte à
 * badge de la Zone E, 2026-08-23 : `session/doors.ts::unlockDoor` désactivait
 * le collider et glissait le CORPS Rapier, mais rien ne recopiait cette pose
 * sur le MESH — seuls les `prop_*` le faisaient).
 *
 * Ce fichier ne contient que la partie MUTABLE, propre à une partie
 * (progression d'ouverture, minuteurs) et les fonctions PURES de géométrie —
 * exactement la même séparation que `game/level/props.ts` : `loader.ts`
 * construit `DoorInfo` (corps/collider Rapier, pose fermée, bbox locale),
 * `DoorSystem` fait vivre cette donnée pas fixe après pas fixe.
 *
 * Comportement physique (délibérément simple et robuste) : le corps Rapier
 * reste FIXE à la pose FERMÉE pour toujours — seul le MESH est animé (pivot/
 * translation). Le collider n'est activé QUE quand la porte est
 * complètement fermée : désactivé dès le premier instant d'une ouverture,
 * réactivé seulement en fin de fermeture, et jamais réactivé si une capsule
 * de personnage chevauche alors le vantail (la porte rouvre plutôt que de se
 * refermer dessus). Un vantail ne bloque donc jamais physiquement le joueur
 * en cours de mouvement — il n'existe qu'ouvert ou fermé du point de vue de
 * Rapier, jamais "à moitié".
 */

// ---------------------------------------------------------------------------
// Convention `mouvement` — mirroring `props.ts::PropMaterial` (donnée + parse
// pur ici, avertissement bruyant + repli côté `loader.ts`).
// ---------------------------------------------------------------------------

export const DOOR_MOVEMENTS = ["descend", "monte", "battant", "coulisse"] as const;
export type DoorMovement = (typeof DOOR_MOVEMENTS)[number];

/** Défaut si `mouvement` est absent — comportement HISTORIQUE (la porte
 * s'enfonce de sa propre hauteur) : les `.glb` déjà exportés avant ce
 * contrat (`hypermarche_complet`, les zones A-E) doivent continuer à
 * fonctionner, et enfin se VOIR bouger. */
export const DEFAULT_DOOR_MOVEMENT: DoorMovement = "descend";

export function parseDoorMovement(raw: unknown): DoorMovement | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return (DOOR_MOVEMENTS as readonly string[]).includes(value) ? (value as DoorMovement) : null;
}

export type DoorHinge = "min" | "max";
export type DoorSens = "auto" | "+" | "-";

/** Durée d'ouverture par défaut, secondes — valeurs du contrat, une par mouvement. */
const MOVEMENT_DEFAULT_DUREE: Record<DoorMovement, number> = {
  battant: 0.5,
  coulisse: 0.45,
  monte: 1.4,
  descend: 0.6,
};

const DEFAULT_ANGLE_DEG = 95;
const DEFAULT_PORTEE = 2.5;
/** |Δaltitude| max d'une porte `auto`, mètres — fixe, pas exposé en extra (le contrat ne le rend pas paramétrable). */
const AUTO_ALTITUDE_TOLERANCE = 2;
const DEFAULT_DELAI = 1.2;

export interface ParsedDoorConfig {
  charniere: DoorHinge;
  angleRad: number;
  sens: DoorSens;
  /** `null` = calculée depuis la géométrie (voir `DoorSystem` — longueur du vantail pour `coulisse`, hauteur pour `monte`/`descend`). */
  course: number | null;
  duree: number;
  auto: boolean;
  referme: boolean;
  delai: number;
  groupe: string | null;
  portee: number;
}

/**
 * Lit les extras Blender d'un `door_*`, TOUS optionnels. Aucun n'est
 * bruyant (contrairement à `mouvement`, lu séparément par `loader.ts`) : une
 * valeur absente ou mal formée retombe silencieusement sur son défaut — le
 * contrat ne réclame un avertissement que pour `mouvement`.
 */
export function parseDoorConfig(mouvement: DoorMovement, extras: Record<string, unknown>): ParsedDoorConfig {
  const charniere: DoorHinge = extras.charniere === "max" ? "max" : "min";

  const angleDeg =
    typeof extras.angle === "number" && Number.isFinite(extras.angle) ? extras.angle : DEFAULT_ANGLE_DEG;

  const sens: DoorSens = extras.sens === "+" || extras.sens === "-" ? extras.sens : "auto";

  const course =
    typeof extras.course === "number" && Number.isFinite(extras.course) && extras.course > 0
      ? extras.course
      : null;

  const duree =
    typeof extras.duree === "number" && Number.isFinite(extras.duree) && extras.duree > 0
      ? extras.duree
      : MOVEMENT_DEFAULT_DUREE[mouvement];

  const auto = extras.auto === true;

  const referme = typeof extras.referme === "boolean" ? extras.referme : true;

  const delai =
    typeof extras.delai === "number" && Number.isFinite(extras.delai) && extras.delai >= 0
      ? extras.delai
      : DEFAULT_DELAI;

  const groupe = typeof extras.groupe === "string" && extras.groupe.trim() !== "" ? extras.groupe.trim() : null;

  const portee =
    typeof extras.portee === "number" && Number.isFinite(extras.portee) && extras.portee > 0
      ? extras.portee
      : DEFAULT_PORTEE;

  return { charniere, angleRad: THREE.MathUtils.degToRad(angleDeg), sens, course, duree, auto, referme, delai, groupe, portee };
}

// ---------------------------------------------------------------------------
// Données du loader — mêmes conventions que `PropInfo` (`level/props.ts`).
// ---------------------------------------------------------------------------

export interface DoorInfo {
  name: string;
  object: THREE.Object3D;
  /** Corps Rapier FIXE, posé à la pose FERMÉE pour toujours — voir la doc de tête. */
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  /** Demi-étendues MONDE (après échelle), mêmes conventions que `DoorInfo` historique. */
  halfExtents: THREE.Vector3;
  /** Bounding box LOCALE du mesh (avant échelle) — dérive le pivot d'un battant et l'axe d'un coulissant. */
  localMin: THREE.Vector3;
  localMax: THREE.Vector3;
  /**
   * Pose FERMÉE, espace LOCAL de `root` — le mesh est rattaché sous `root`
   * (`root.attach`, comme un `prop_*`) précisément pour que cette pose locale
   * soit directement la pose à écrire dans le mesh (`DoorSystem` n'a besoin
   * d'aucune matrice inverse supplémentaire, contrairement à `PropSystem` qui
   * relit un corps DYNAMIQUE à chaque pas).
   */
  closedPosition: THREE.Vector3;
  closedQuaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  /** `mouvement`, déjà validé (voir `UnknownDoorMovementWarning` dans `loader.ts`). */
  movement: DoorMovement;
  /** Place du vantail dans un lot de portes (`batchDoorMeshes`) — `object`
   * reste alors caché et ne sert plus qu'à porter la pose, recopiée dans le
   * lot par `DoorSystem.interpolate`. Absent : le vantail se dessine seul. */
  batchSlot?: DoorBatchSlot;
  clip: THREE.AnimationClip | null;
  extras: Record<string, unknown>;
}

/** Un occupant (joueur ou ennemi vivant) pris en compte par les portes `auto` et par le refus de refermeture. */
export interface DoorActor {
  /** Centre de capsule, MONDE. */
  position: THREE.Vector3;
  radius: number;
  halfHeight: number;
}

/** Émis quand un GROUPE de vantaux démarre une ouverture depuis l'état fermé — consommé par `updateFx.ts` pour le son. */
export interface DoorMovementEvent {
  /** Nom du membre "représentant" du groupe (le premier), pour le journal de debug. */
  name: string;
  movement: DoorMovement;
}

export type DoorRuntimeState = "closed" | "opening" | "open" | "closing";

// ---------------------------------------------------------------------------
// Lots de vantaux — un lot de dessin par matériau, pour tout le niveau.
// ---------------------------------------------------------------------------

export interface DoorBatchSlot {
  batch: THREE.BatchedMesh;
  instanceId: number;
}

/**
 * Regroupe les vantaux qui partagent un matériau en un `BatchedMesh` : un lot
 * de dessin par matériau pour TOUT le niveau, au lieu d'un par vantail.
 *
 * Pourquoi : un vantail animé ne peut pas rejoindre le décor fusionné, et
 * three.js n'élimine que par le cône de vue — vingt vantaux coûtaient jusqu'à
 * treize lots dans une seule vue (le bout du hub, 2026-09-19), sur un budget
 * de 200 déjà tenu à 198. Un `BatchedMesh` garde une matrice par vantail
 * (`setMatrixAt`) et élimine chaque instance hors champ séparément, en un
 * seul appel de dessin (`WEBGL_multi_draw`, repli intégré à three.js sinon).
 *
 * Le mesh d'origine reste dans la scène, CACHÉ : c'est toujours lui qui porte
 * la pose (`DoorSystem.interpolate` l'écrit, puis la recopie dans le lot). Un
 * vantail seul de son matériau (ou dont la géométrie n'a pas les mêmes
 * attributs que les autres) reste un mesh ordinaire. Retourne le nombre de
 * lots de dessin des vantaux.
 */
export function batchDoorMeshes(root: THREE.Object3D, doors: readonly DoorInfo[]): number {
  const groups = new Map<string, DoorInfo[]>();
  let seuls = 0;
  for (const door of doors) {
    const mesh = door.object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material) || !(mesh.material instanceof THREE.MeshLambertMaterial)) {
      seuls++;
      continue;
    }
    const key = `${materialKey(mesh.material)}#${attributeKey(mesh.geometry)}`;
    const list = groups.get(key);
    if (list) list.push(door);
    else groups.set(key, [door]);
  }

  let lots = 0;
  for (const group of groups.values()) {
    if (group.length < 2) {
      seuls += group.length;
      continue;
    }
    const meshes = group.map((door) => door.object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>);
    const vertices = meshes.reduce((n, m) => n + m.geometry.getAttribute("position").count, 0);
    const indices = meshes.reduce((n, m) => n + (m.geometry.index?.count ?? 0), 0);
    const batch = new THREE.BatchedMesh(meshes.length, vertices, indices, meshes[0]!.material);
    batch.name = `lot_vantaux_${lots}`;
    group.forEach((door, i) => {
      const mesh = meshes[i]!;
      const instanceId = batch.addInstance(batch.addGeometry(mesh.geometry));
      mesh.updateMatrix();
      batch.setMatrixAt(instanceId, mesh.matrix);
      mesh.visible = false;
      door.batchSlot = { batch, instanceId };
    });
    root.add(batch);
    lots++;
  }
  return lots + seuls;
}

// ---------------------------------------------------------------------------
// Géométrie pure — pivot d'un battant, direction "s'éloigner de l'ouvreur".
// ---------------------------------------------------------------------------

export interface DoorHingeGeometry {
  /** Point de charnière, espace LOCAL du mesh (avant échelle). */
  pivotLocal: THREE.Vector3;
  /** Direction du bout LIBRE du vantail depuis la charnière, espace LOCAL, unitaire (avant échelle). */
  farLocalDir: THREE.Vector3;
  /** Longueur locale (avant échelle) du grand axe horizontal — sert de défaut à `course` pour un coulissant. */
  grandAxisLocalLength: number;
  axis: "x" | "z";
}

/**
 * Dérive la charnière et le grand axe horizontal LOCAL d'une bounding box
 * (skill `collision-proxy-authoring` : la rotation est portée par le corps,
 * jamais par la géométrie — travailler en LOCAL reste valide quelle que soit
 * l'orientation posée dans Blender).
 */
export function computeHingeGeometry(
  localMin: THREE.Vector3,
  localMax: THREE.Vector3,
  charniere: DoorHinge,
): DoorHingeGeometry {
  const sizeX = localMax.x - localMin.x;
  const sizeZ = localMax.z - localMin.z;
  const axis: "x" | "z" = sizeX >= sizeZ ? "x" : "z";
  const centerY = (localMin.y + localMax.y) / 2;

  const pivotLocal = new THREE.Vector3();
  const farLocalDir = new THREE.Vector3();
  let grandAxisLocalLength: number;

  if (axis === "x") {
    grandAxisLocalLength = sizeX;
    const centerZ = (localMin.z + localMax.z) / 2;
    const pivotX = charniere === "min" ? localMin.x : localMax.x;
    const farX = charniere === "min" ? localMax.x : localMin.x;
    pivotLocal.set(pivotX, centerY, centerZ);
    farLocalDir.set(farX - pivotX, 0, 0);
  } else {
    grandAxisLocalLength = sizeZ;
    const centerX = (localMin.x + localMax.x) / 2;
    const pivotZ = charniere === "min" ? localMin.z : localMax.z;
    const farZ = charniere === "min" ? localMax.z : localMin.z;
    pivotLocal.set(centerX, centerY, pivotZ);
    farLocalDir.set(0, 0, farZ - pivotZ);
  }

  // Vantail dégénéré (grand axe nul) : direction arbitraire plutôt qu'un
  // vecteur nul, pour que `normalize()` en aval ne produise jamais NaN.
  if (farLocalDir.lengthSq() < 1e-10) farLocalDir.set(1, 0, 0);
  else farLocalDir.normalize();

  return { pivotLocal, farLocalDir, grandAxisLocalLength, axis };
}

/**
 * Signe d'ouverture d'un battant en `sens: "auto"` : la porte s'ouvre en
 * s'ÉLOIGNANT de celui qui l'ouvre. `farDirWorld` est la direction (MONDE,
 * unitaire) du bout libre depuis la charnière à la pose FERMÉE.
 *
 * Dérivation : une rotation positive (main droite) autour de +Y déplace le
 * bout libre, à l'instant initial, dans la direction `up × farDirWorld`
 * (dérivée de `R(θ)v` en `θ=0`). On appelle `normal = farDirWorld × up`
 * (l'opposé) le côté "+" du plan du vantail. Pour que le bout libre s'écarte
 * du côté OPPOSÉ à l'ouvreur, il faut que la rotation choisie déplace le bout
 * libre vers `-side · normal` où `side = signe(offset · normal)` — ce qui se
 * simplifie exactement en `openSign = side` (voir le calcul détaillé dans
 * l'ADR 0031).
 */
export function resolveAutoOpenSign(
  pivotWorld: THREE.Vector3,
  farDirWorld: THREE.Vector3,
  openerPosition: THREE.Vector3,
): 1 | -1 {
  const normal = new THREE.Vector3().crossVectors(farDirWorld, new THREE.Vector3(0, 1, 0));
  if (normal.lengthSq() < 1e-10) return 1; // vantail dégénéré : repli arbitraire.
  normal.normalize();
  const offsetX = openerPosition.x - pivotWorld.x;
  const offsetZ = openerPosition.z - pivotWorld.z;
  const side = offsetX * normal.x + offsetZ * normal.z;
  return side >= 0 ? 1 : -1;
}

/** Pivot d'un battant, en espace ROOT (mesh fermé) — TRS local -> root. */
export function hingePivotInRootSpace(
  closedPosition: THREE.Vector3,
  closedQuaternion: THREE.Quaternion,
  pivotLocal: THREE.Vector3,
  scale: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  out.set(pivotLocal.x * scale.x, pivotLocal.y * scale.y, pivotLocal.z * scale.z);
  out.applyQuaternion(closedQuaternion);
  out.add(closedPosition);
  return out;
}

/**
 * Pose d'un battant à l'angle signé `theta` (radians, 0 = fermé) — rotation
 * autour de l'axe vertical passant par `pivotWorld`. Formule standard de
 * rotation autour d'un pivot externe : `pos' = pivot + Δq·(pos - pivot)`,
 * `quat' = Δq·quat`.
 */
export function composeBattantPose(
  closedPosition: THREE.Vector3,
  closedQuaternion: THREE.Quaternion,
  pivotWorld: THREE.Vector3,
  theta: number,
  outPosition: THREE.Vector3,
  outQuaternion: THREE.Quaternion,
): void {
  const deltaQuat = new THREE.Quaternion().setFromAxisAngle(UP_AXIS, theta);
  outPosition.copy(closedPosition).sub(pivotWorld).applyQuaternion(deltaQuat).add(pivotWorld);
  outQuaternion.copy(closedQuaternion).premultiply(deltaQuat);
}

const UP_AXIS = new THREE.Vector3(0, 1, 0);

/** Pose d'un coulissant : translation de `distance` mètres le long du grand axe LOCAL, signée par `sign`. */
export function composeCoulissePose(
  closedPosition: THREE.Vector3,
  closedQuaternion: THREE.Quaternion,
  axis: "x" | "z",
  sign: 1 | -1,
  distance: number,
  outPosition: THREE.Vector3,
): void {
  const localAxis = axis === "x" ? AXIS_X : AXIS_Z;
  const worldAxis = localAxis.clone().applyQuaternion(closedQuaternion);
  outPosition.copy(closedPosition).addScaledVector(worldAxis, sign * distance);
}
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/** Pose d'un rideau/panneau vertical : translation pure sur Y. `monte` = signe +1, `descend` = signe −1. */
export function composeVerticalPose(
  closedPosition: THREE.Vector3,
  sign: 1 | -1,
  distance: number,
  outPosition: THREE.Vector3,
): void {
  outPosition.copy(closedPosition);
  outPosition.y += sign * distance;
}

/**
 * Une capsule de personnage (`actor`) chevauche-t-elle la boîte englobante
 * MONDE d'une porte à sa pose FERMÉE ? Test OBB-vs-point inflé, en espace
 * LOCAL du corps (rotation inversée) — pur, aucune requête Rapier : sert au
 * refus de refermeture ("rouvrir plutôt que refermer dessus").
 */
export function isActorBlockingClosedDoor(
  closedWorldPosition: THREE.Vector3,
  closedWorldQuaternion: THREE.Quaternion,
  halfExtents: THREE.Vector3,
  actor: DoorActor,
): boolean {
  const inverse = closedWorldQuaternion.clone().invert();
  const local = actor.position.clone().sub(closedWorldPosition).applyQuaternion(inverse);
  return (
    Math.abs(local.x) < halfExtents.x + actor.radius &&
    Math.abs(local.y) < halfExtents.y + actor.halfHeight &&
    Math.abs(local.z) < halfExtents.z + actor.radius
  );
}

/** Un occupant (joueur ou ennemi) est-il à portée `auto` du centre d'un groupe ? Horizontal + tolérance d'altitude fixe. */
export function isActorInAutoRange(center: THREE.Vector3, actor: DoorActor, portee: number): boolean {
  const dx = actor.position.x - center.x;
  const dz = actor.position.z - center.z;
  const horizontal = Math.hypot(dx, dz);
  return horizontal <= portee && Math.abs(actor.position.y - center.y) < AUTO_ALTITUDE_TOLERANCE;
}

/** Avance `progress` (0..1) vers `target` de `dt/duree`, clampé. Fonction pure, testée directement. */
export function advanceDoorProgress(progress: number, target: 0 | 1, dt: number, duree: number): number {
  const step = duree > 0 ? dt / duree : 1;
  if (target === 1) return Math.min(1, progress + step);
  return Math.max(0, progress - step);
}

// ---------------------------------------------------------------------------
// Système — état mutable d'une partie, reconstruit à chaque chargement.
// ---------------------------------------------------------------------------

interface DoorMember {
  info: DoorInfo;
  config: ParsedDoorConfig;
  hinge: DoorHingeGeometry | null; // battant seulement
  axis: "x" | "z" | null; // coulisse seulement
  /** Course résolue en MÈTRES MONDE — explicite (`course`) ou géométrique (longueur/hauteur du vantail). */
  courseWorld: number;
  /** Signe résolu au début de CHAQUE ouverture (capture `sens: "auto"` au moment où quelqu'un pousse). */
  openSign: 1 | -1;
  prevPosition: THREE.Vector3;
  prevQuaternion: THREE.Quaternion;
  currPosition: THREE.Vector3;
  currQuaternion: THREE.Quaternion;
  /** La pose EXACTE de repos a été écrite — voir `DoorSystem.interpolate`. */
  settled: boolean;
}

interface DoorGroup {
  key: string;
  members: DoorMember[];
  /** Centre du groupe, MONDE (moyenne des corps fermés) — la portée `auto` se mesure depuis lui. */
  center: THREE.Vector3;
  auto: boolean;
  portee: number;
  delai: number;
  /** `false` si UN SEUL membre porte `referme:false` — un groupe "reste ouvert" ne se referme sur AUCUN de ses vantaux. */
  referme: boolean;
  /** Durée d'ouverture du groupe — le MAX des membres, pour que des vantaux différents arrivent ensemble. */
  duree: number;
  progress: number;
  target: 0 | 1;
  /** Une fois vraie, le groupe ne se referme plus jamais (cartes/use_*, ou `referme:false`). */
  permanent: boolean;
  /** Secondes depuis que plus personne n'est à portée (portes `auto` à refermeture). */
  idleTimer: number;
}

export class DoorSystem {
  private readonly groups: DoorGroup[] = [];
  private readonly groupByDoorName = new Map<string, DoorGroup>();
  private readonly _movementEvents: DoorMovementEvent[] = [];

  constructor(doors: readonly DoorInfo[]) {
    const byKey = new Map<string, DoorMember[]>();
    for (const info of doors) {
      const config = parseDoorConfig(info.movement, info.extras);
      const key = config.groupe ?? info.name;
      const member = buildDoorMember(info, config);
      const list = byKey.get(key);
      if (list) list.push(member);
      else byKey.set(key, [member]);
    }

    for (const [key, members] of byKey) {
      const center = new THREE.Vector3();
      for (const member of members) {
        const t = member.info.body.translation();
        center.add(new THREE.Vector3(t.x, t.y, t.z));
      }
      center.multiplyScalar(1 / members.length);

      const group: DoorGroup = {
        key,
        members,
        center,
        auto: members.some((m) => m.config.auto),
        portee: Math.max(...members.map((m) => m.config.portee)),
        delai: Math.max(...members.map((m) => m.config.delai)),
        referme: members.every((m) => m.config.referme),
        duree: Math.max(...members.map((m) => m.config.duree)),
        progress: 0,
        target: 0,
        permanent: false,
        idleTimer: 0,
      };
      this.groups.push(group);
      for (const member of members) this.groupByDoorName.set(member.info.name, group);
    }
  }

  get movementEvents(): ReadonlyArray<DoorMovementEvent> {
    return this._movementEvents;
  }

  /** À appeler UNE SEULE FOIS par frame d'affichage, après `updateFx` (même contrat que `PropSystem`). */
  clearFrameEvents(): void {
    this._movementEvents.length = 0;
  }

  /** Colliders des groupes `auto` — à désactiver le temps du bake du graphe de navigation (voir `session/spawning.ts`), sinon un bureau derrière une porte automatique ne reçoit jamais d'arête. */
  get autoGroupColliders(): RAPIER.Collider[] {
    const colliders: RAPIER.Collider[] = [];
    for (const group of this.groups) {
      if (!group.auto) continue;
      for (const member of group.members) colliders.push(member.info.collider);
    }
    return colliders;
  }

  /** État courant d'UN vantail par son nom — pour la console/les tests. `null` si le nom est inconnu. */
  stateOf(name: string): DoorRuntimeState | null {
    const group = this.groupByDoorName.get(name);
    if (!group) return null;
    return runtimeState(group);
  }

  /**
   * Ouvre le GROUPE contenant `name` (voir `groupe`) — utilisé par les
   * portes à carte/`use_*` (`session/doors.ts::unlockDoor`), qui restent
   * TOUJOURS ouvertes (`permanent = true`, quel que soit `referme`).
   * `silent` (hot reload, réouverture d'une porte déjà déverrouillée cette
   * partie) : n'émet pas de `DoorMovementEvent`, pas de son au rechargement.
   * Retourne `false` si `name` ne correspond à aucun `door_*` connu.
   */
  open(name: string, openerPosition: THREE.Vector3, opts: { silent?: boolean } = {}): boolean {
    const group = this.groupByDoorName.get(name);
    if (!group) return false;
    group.permanent = true;
    this.beginOpening(group, openerPosition, opts.silent ?? false);
    return true;
  }

  private beginOpening(group: DoorGroup, openerPosition: THREE.Vector3, silent: boolean): void {
    const wasFullyClosed = group.progress === 0 && group.target === 0;
    if (wasFullyClosed && !silent) {
      const representative = group.members[0]!;
      this._movementEvents.push({ name: representative.info.name, movement: representative.info.movement });
    }
    if (wasFullyClosed) {
      for (const member of group.members) member.openSign = resolveMemberOpenSign(member, openerPosition);
    }
    group.target = 1;
    for (const member of group.members) member.info.collider.setEnabled(false);
  }

  /** Pas fixe, AVANT `updateGameplay` (mêmes conventions que `PropSystem.snapshotPrevious`). */
  snapshotPrevious(): void {
    for (const group of this.groups) {
      for (const member of group.members) {
        member.prevPosition.copy(member.currPosition);
        member.prevQuaternion.copy(member.currQuaternion);
      }
    }
  }

  /**
   * Pas fixe. `actors` : joueur + ennemis VIVANTS, sert à la fois au
   * déclenchement des groupes `auto` (proximité) et au refus de refermeture
   * (une capsule qui chevauche encore le vantail). Calcule aussi la pose
   * courante du mesh de chaque membre — invariant #1, tout au pas fixe.
   */
  update(dt: number, actors: readonly DoorActor[]): void {
    for (const group of this.groups) {
      this.updateAutoTrigger(group, actors, dt);
      this.advanceGroup(group, dt, actors);
      for (const member of group.members) this.composeMemberPose(member, group.progress);
    }
  }

  private updateAutoTrigger(group: DoorGroup, actors: readonly DoorActor[], dt: number): void {
    if (!group.auto || group.permanent) return;

    let opener: THREE.Vector3 | null = null;
    for (const actor of actors) {
      if (isActorInAutoRange(group.center, actor, group.portee)) {
        opener = actor.position;
        break;
      }
    }

    if (opener) {
      group.idleTimer = 0;
      if (group.target === 0) this.beginOpening(group, opener, false);
      return;
    }

    if (group.target !== 1) return; // déjà en train de se refermer/fermée : rien à armer
    if (!group.referme) return; // `referme:false` (bureau) : reste ouverte pour toujours une fois ouverte
    group.idleTimer += dt;
    if (group.idleTimer >= group.delai) group.target = 0;
  }

  private advanceGroup(group: DoorGroup, dt: number, actors: readonly DoorActor[]): void {
    if (group.target === group.progress) return; // déjà à sa cible, rien à faire

    if (group.target === 0) {
      const next = advanceDoorProgress(group.progress, 0, dt, group.duree);
      if (next <= 0) {
        // Sur le point de finir sa fermeture : refuse si quelqu'un chevauche encore le vantail.
        const blocked = group.members.some((member) =>
          actors.some((actor) => {
            const t = member.info.body.translation();
            const r = member.info.body.rotation();
            return isActorBlockingClosedDoor(
              new THREE.Vector3(t.x, t.y, t.z),
              new THREE.Quaternion(r.x, r.y, r.z, r.w),
              member.info.halfExtents,
              actor,
            );
          }),
        );
        if (blocked) {
          group.target = 1; // rouvre plutôt que de refermer dessus — aucun son (ce n'est pas une NOUVELLE ouverture).
          return;
        }
        group.progress = 0;
        for (const member of group.members) member.info.collider.setEnabled(true);
        return;
      }
      group.progress = next;
      return;
    }

    group.progress = advanceDoorProgress(group.progress, 1, dt, group.duree);
  }

  private composeMemberPose(member: DoorMember, progress: number): void {
    const info = member.info;
    switch (info.movement) {
      case "battant": {
        const pivotWorld = hingePivotInRootSpace(
          info.closedPosition,
          info.closedQuaternion,
          member.hinge!.pivotLocal,
          info.scale,
          pivotScratch,
        );
        const theta = member.openSign * member.config.angleRad * progress;
        composeBattantPose(info.closedPosition, info.closedQuaternion, pivotWorld, theta, member.currPosition, member.currQuaternion);
        break;
      }
      case "coulisse":
        member.currQuaternion.copy(info.closedQuaternion);
        composeCoulissePose(
          info.closedPosition,
          info.closedQuaternion,
          member.axis!,
          member.openSign,
          member.courseWorld * progress,
          member.currPosition,
        );
        break;
      case "monte":
        member.currQuaternion.copy(info.closedQuaternion);
        composeVerticalPose(info.closedPosition, 1, member.courseWorld * progress, member.currPosition);
        break;
      case "descend":
        member.currQuaternion.copy(info.closedQuaternion);
        composeVerticalPose(info.closedPosition, -1, member.courseWorld * progress, member.currPosition);
        break;
    }
  }

  /** Taux d'affichage — SEUL endroit qui écrit dans un mesh de porte, même séparation que `PropSystem.interpolate`. */
  interpolate(alpha: number): void {
    for (const group of this.groups) {
      for (const member of group.members) {
        // Au repos, on n'écrit rien — mais UNE dernière fois après l'arrivée :
        // la pose écrite juste avant est une interpolation (alpha < 1), et le
        // vantail resterait arrêté quelques degrés avant sa butée.
        const repos = member.prevPosition.equals(member.currPosition) && member.prevQuaternion.equals(member.currQuaternion);
        if (repos && member.settled) continue;
        member.settled = repos;
        const object = member.info.object;
        object.position.lerpVectors(member.prevPosition, member.currPosition, alpha);
        object.quaternion.slerpQuaternions(member.prevQuaternion, member.currQuaternion, alpha);
        const slot = member.info.batchSlot;
        if (slot) {
          object.updateMatrix();
          slot.batch.setMatrixAt(slot.instanceId, object.matrix);
          this.movedBatches.add(slot.batch);
        }
      }
    }
    // La sphère englobante d'un lot sert à l'éliminer en entier : un vantail
    // qui pivote peut en sortir, et le lot disparaîtrait alors qu'il est vu.
    for (const batch of this.movedBatches) batch.computeBoundingSphere();
    this.movedBatches.clear();
  }

  private readonly movedBatches = new Set<THREE.BatchedMesh>();

  /** Résumé lisible pour la console de dev (`cassandre.doors2()`/tests). */
  describe(): Array<{ name: string; movement: DoorMovement; state: DoorRuntimeState; groupe: string }> {
    const out: Array<{ name: string; movement: DoorMovement; state: DoorRuntimeState; groupe: string }> = [];
    for (const group of this.groups) {
      const state = runtimeState(group);
      for (const member of group.members) {
        out.push({ name: member.info.name, movement: member.info.movement, state, groupe: group.key });
      }
    }
    return out;
  }
}

const pivotScratch = new THREE.Vector3();

function runtimeState(group: DoorGroup): DoorRuntimeState {
  if (group.progress === 0) return group.target === 1 ? "opening" : "closed";
  if (group.progress === 1) return group.target === 0 ? "closing" : "open";
  return group.target === 1 ? "opening" : "closing";
}

function resolveMemberOpenSign(member: DoorMember, openerPosition: THREE.Vector3): 1 | -1 {
  if (member.info.movement !== "battant") {
    return member.config.sens === "-" ? -1 : 1; // coulisse : "+"/"-" statique, "auto" invalide ici -> repli "+"
  }
  if (member.config.sens === "+") return 1;
  if (member.config.sens === "-") return -1;
  const pivotWorld = hingePivotInRootSpace(
    member.info.closedPosition,
    member.info.closedQuaternion,
    member.hinge!.pivotLocal,
    member.info.scale,
    new THREE.Vector3(),
  );
  const farDirWorld = member.hinge!.farLocalDir.clone().applyQuaternion(member.info.closedQuaternion);
  return resolveAutoOpenSign(pivotWorld, farDirWorld, openerPosition);
}

function buildDoorMember(info: DoorInfo, config: ParsedDoorConfig): DoorMember {
  const hinge = info.movement === "battant" ? computeHingeGeometry(info.localMin, info.localMax, config.charniere) : null;
  const axis: "x" | "z" | null =
    info.movement === "coulisse" ? (info.localMax.x - info.localMin.x >= info.localMax.z - info.localMin.z ? "x" : "z") : null;

  let courseWorld: number;
  if (config.course !== null) {
    courseWorld = config.course;
  } else if (info.movement === "coulisse") {
    const localLength = axis === "x" ? info.localMax.x - info.localMin.x : info.localMax.z - info.localMin.z;
    const scaleComponent = axis === "x" ? info.scale.x : info.scale.z;
    courseWorld = localLength * Math.abs(scaleComponent);
  } else if (info.movement === "monte" || info.movement === "descend") {
    courseWorld = info.halfExtents.y * 2;
  } else {
    courseWorld = hinge ? hinge.grandAxisLocalLength * Math.abs(hinge.axis === "x" ? info.scale.x : info.scale.z) : 0;
  }

  return {
    info,
    config,
    hinge,
    axis,
    courseWorld,
    openSign: 1,
    prevPosition: info.closedPosition.clone(),
    prevQuaternion: info.closedQuaternion.clone(),
    currPosition: info.closedPosition.clone(),
    currQuaternion: info.closedQuaternion.clone(),
    settled: false,
  };
}
