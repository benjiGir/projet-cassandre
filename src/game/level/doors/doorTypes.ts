import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

export const DOOR_MOVEMENTS = ["descend", "monte", "battant", "coulisse"] as const;

export type DoorMovement = (typeof DOOR_MOVEMENTS)[number];

export type DoorHinge = "min" | "max";

export type DoorSens = "auto" | "+" | "-";

export type DoorAuto = "non" | "tous" | "ennemis";

/** Ce que la touche E peut faire à une porte, à moins de `PORTEE_ACTION_MANUELLE`. */
export type DoorManuelle = "non" | "les-deux" | "fermer";

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
  /** La porte est ouverte au chargement, et le reste tant que rien ne la ferme (un rideau d'arène). */
  ouverte: boolean;
}

export interface DoorInfo {
  name: string;
  object: THREE.Object3D;
  /** Corps Rapier FIXE, posé à la pose fermée ; seul son collider est activé ou désactivé. */
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
  /** `mouvement`, déjà validé (voir `UnknownDoorMovementWarning` dans `levelDiagnostics.ts`). */
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

export interface DoorHingeGeometry {
  /** Point de charnière, espace LOCAL du mesh (avant échelle). */
  pivotLocal: THREE.Vector3;
  /** Direction du bout LIBRE du vantail depuis la charnière, espace LOCAL, unitaire (avant échelle). */
  farLocalDir: THREE.Vector3;
  /** Longueur locale (avant échelle) du grand axe horizontal — sert de défaut à `course` pour un coulissant. */
  grandAxisLocalLength: number;
  axis: "x" | "z";
}

export interface DoorMember {
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

export interface DoorGroup {
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
  /** Tenu fermé par le script de niveau : ni portée, ni main, ni carte ne l'ouvre. */
  locked: boolean;
  /** Le groupe était ouvert quand le verrou est tombé : il se rouvre à sa levée. */
  reopenOnUnlock: boolean;
}
