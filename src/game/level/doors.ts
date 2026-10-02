import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { LevelResources } from "./levelResources";
import { attributeKey, materialKey } from "./mergeStaticDecor";

// see: docs/6-reference/notes-code-gameplay-niveau.md#portes


export const DOOR_MOVEMENTS = ["descend", "monte", "battant", "coulisse"] as const;
export type DoorMovement = (typeof DOOR_MOVEMENTS)[number];

export const DEFAULT_DOOR_MOVEMENT: DoorMovement = "descend";

export function parseDoorMovement(raw: unknown): DoorMovement | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return (DOOR_MOVEMENTS as readonly string[]).includes(value) ? (value as DoorMovement) : null;
}

export type DoorHinge = "min" | "max";
export type DoorSens = "auto" | "+" | "-";

export type DoorAuto = "non" | "tous" | "ennemis";

/** Ce que la touche E peut faire à une porte, à moins de `PORTEE_ACTION_MANUELLE`. */
export type DoorManuelle = "non" | "les-deux" | "fermer";

/** Portée de l'action manuelle, mètres — la même que celle d'un `use_*`, pour que « agir » ait une seule distance dans tout le jeu. */
export const PORTEE_ACTION_MANUELLE = 2;

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
  /** `auto: true` -> "tous", `auto: "ennemis"` -> "ennemis", absent -> "non". */
  autoQui: DoorAuto;
  manuelle: DoorManuelle;
  /** `null` = calculée depuis la géométrie (voir `DoorSystem` — longueur du vantail pour `coulisse`, hauteur pour `monte`/`descend`). */
  course: number | null;
  duree: number;
  auto: boolean;
  referme: boolean;
  delai: number;
  groupe: string | null;
  portee: number;
}

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

  const autoQui: DoorAuto = extras.auto === true ? "tous" : extras.auto === "ennemis" ? "ennemis" : "non";
  const auto = autoQui !== "non";

  const manuelle: DoorManuelle =
    extras.manuelle === true ? "les-deux" : extras.manuelle === "fermer" ? "fermer" : "non";

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

  return {
    charniere,
    angleRad: THREE.MathUtils.degToRad(angleDeg),
    sens,
    autoQui,
    manuelle,
    course,
    duree,
    auto,
    referme,
    delai,
    groupe,
    portee,
  };
}

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
  /** Le joueur, par opposition à un ennemi — voir `DoorAuto`. Le refus de refermeture, lui, vaut pour les deux. */
  joueur: boolean;
}

/** Émis quand un GROUPE de vantaux démarre une ouverture depuis l'état fermé — consommé par `updateFx.ts` pour le son. */
export interface DoorMovementEvent {
  /** Nom du membre "représentant" du groupe (le premier), pour le journal de debug. */
  name: string;
  movement: DoorMovement;
}

export type DoorRuntimeState = "closed" | "opening" | "open" | "closing";

export interface DoorBatchSlot {
  batch: THREE.BatchedMesh;
  instanceId: number;
}

export function batchDoorMeshes(root: THREE.Object3D, doors: readonly DoorInfo[], resources?: LevelResources): number {
  const groups = new Map<string, DoorInfo[]>();
  let seuls = 0;
  for (const door of doors) {
    const mesh = door.object as THREE.Mesh;
    // Le mesh reste parent de ses pièces mobiles (panneaux vitrés, par
    // exemple). Le BatchedMesh ne contient que la géométrie du vantail et
    // masquerait ces enfants : on garde alors cet ensemble animé en un lot.
    if (mesh.children.length > 0) {
      seuls++;
      continue;
    }
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
    resources?.batch(batch);
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

export interface DoorHingeGeometry {
  /** Point de charnière, espace LOCAL du mesh (avant échelle). */
  pivotLocal: THREE.Vector3;
  /** Direction du bout LIBRE du vantail depuis la charnière, espace LOCAL, unitaire (avant échelle). */
  farLocalDir: THREE.Vector3;
  /** Longueur locale (avant échelle) du grand axe horizontal — sert de défaut à `course` pour un coulissant. */
  grandAxisLocalLength: number;
  axis: "x" | "z";
}

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
  autoQui: DoorAuto;
  /** La plus permissive des valeurs de ses membres — un groupe se manœuvre d'un bloc. */
  manuelle: DoorManuelle;
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
        autoQui: members.some((m) => m.config.autoQui === "tous")
          ? "tous"
          : members.some((m) => m.config.autoQui === "ennemis")
            ? "ennemis"
            : "non",
        manuelle: members.some((m) => m.config.manuelle === "les-deux")
          ? "les-deux"
          : members.some((m) => m.config.manuelle === "fermer")
            ? "fermer"
            : "non",
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

  open(name: string, openerPosition: THREE.Vector3, opts: { silent?: boolean } = {}): boolean {
    const group = this.groupByDoorName.get(name);
    if (!group) return false;
    group.permanent = true;
    this.beginOpening(group, openerPosition, opts.silent ?? false);
    return true;
  }

  actionner(position: THREE.Vector3): { name: string; action: "ouverte" | "fermee" } | null {
    const porteeSq = PORTEE_ACTION_MANUELLE * PORTEE_ACTION_MANUELLE;
    let cible: DoorGroup | null = null;
    let meilleure = Infinity;
    for (const group of this.groups) {
      if (group.manuelle === "non") continue;
      for (const member of group.members) {
        const t = member.info.body.translation();
        const dx = position.x - t.x;
        const dy = position.y - t.y;
        const dz = position.z - t.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < meilleure && d <= porteeSq) {
          meilleure = d;
          cible = group;
        }
      }
    }
    if (!cible) return null;

    const nom = cible.members[0]!.info.name;
    if (cible.target === 1) {
      this.beginClosing(cible);
      return { name: nom, action: "fermee" };
    }
    if (cible.manuelle !== "les-deux") return null; // « fermer » seulement : rien à faire sur une porte déjà fermée
    this.beginOpening(cible, position, false);
    return { name: nom, action: "ouverte" };
  }

  private beginClosing(group: DoorGroup): void {
    group.permanent = false;
    group.idleTimer = 0;
    group.target = 0;
    const representative = group.members[0]!;
    this._movementEvents.push({ name: representative.info.name, movement: representative.info.movement });
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
      if (group.autoQui === "ennemis" && actor.joueur) continue; // à lui d'ouvrir à la main
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
