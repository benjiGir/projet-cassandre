import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Effect, Exit, Schema, Scope } from "effect";

import { COLLISION_GROUPS, type PhysicsWorld } from "../../physics/world";
import { GameRuntime } from "../../core/runtime";
import { configureRetroTexture } from "../../render/renderer";
import { mergeStaticDecor } from "./mergeStaticDecor";
import {
  DEFAULT_PROP_MATERIAL,
  PROP_MATERIALS,
  parsePropMaterial,
  type PropInfo,
  type PropMaterial,
} from "./props";
import {
  batchDoorMeshes,
  DEFAULT_DOOR_MOVEMENT,
  DOOR_MOVEMENTS,
  parseDoorMovement,
  type DoorInfo,
  type DoorMovement,
} from "./doors";
import { mergeVitreDecor, type VitreCandidate, type VitreInfo } from "./vitres";
import {
  mergeSanitaireDecor,
  DEFAULT_SANITAIRE_KIND,
  SANITAIRE_KINDS,
  parseSanitaireKind,
  type SanitaireCandidate,
  type SanitaireInfo,
  type SanitaireKind,
  type SanitaireRendu,
} from "./sanitaires";
import { LOYALTY_CARDS, parseLoyaltyCard, type LoyaltyCard } from "../player/loyaltyCards";

// `DoorInfo`/`VitreInfo`/`SanitaireInfo` sont DÉFINIS dans `./doors`/
// `./vitres`/`./sanitaires` (comme `PropInfo` dans `./props`) — ce fichier
// reste le seul point d'import public historique (`devtools/consoleApi.ts`
// importe `DoorInfo` depuis `./loader`), d'où ce ré-export.
export type { DoorInfo, DoorMovement } from "./doors";
export type { VitreInfo } from "./vitres";
export type { SanitaireInfo, SanitaireKind, SanitaireRendu } from "./sanitaires";

/**
 * Pipeline de niveau glTF (Phase 4) — voir le skill `gltf-level-conventions`
 * pour le contrat de nommage complet. Ce fichier est le SEUL endroit qui
 * connaît la correspondance entre un préfixe de nom Blender et son effet en
 * jeu (table complète : reference/conventions-nommage.md).
 *
 * Pièges déjà rencontrés (transforms, renommage `GLTFLoader`, hiérarchie des
 * colliders, invariants #4/#5, cycle de vie Effect, erreurs typées) :
 * see: docs/pipeline/niveau-blender.md
 */

export interface SpawnPoint {
  /** Position MONDE, pieds du joueur (pas les yeux).
   * see: docs/pipeline/niveau-blender.md#convention-spawn_player */
  position: THREE.Vector3;
  /** Yaw, radians. Convention `main.ts`/`gym.ts` (Euler 'YXZ') : yaw=0 -> avant = -Z. */
  yaw: number;
}

export interface NamedSpawn {
  name: string;
  /** Position MONDE, pieds (même convention que `SpawnPoint.position`). */
  position: THREE.Vector3;
}

export interface TriggerVolume {
  name: string;
  object: THREE.Object3D;
  /** Coin min/max de la box en espace MONDE (rotation ignorée pour ce résumé
   * — suffisant pour un compteur de debug ou un futur `interactive.ts` qui
   * testerait une position simple ; la vraie forme physique, elle, est un
   * cuboid ORIENTÉ posé sur le corps Rapier créé en parallèle). */
  min: THREE.Vector3;
  max: THREE.Vector3;
  extras: Record<string, unknown>;
}

export interface UseObject {
  name: string;
  object: THREE.Object3D;
  /** Position MONDE. */
  position: THREE.Vector3;
  /** Portée d'usage, mètres — constante du contrat (voir
   * reference/conventions-nommage.md), pas une valeur par objet. */
  range: number;
  /** Nom de l'objet ciblé, lu dans `extras.target` (custom property Blender
   * `target`, string). `null` si absent — un `use_*` sans cible est un
   * avertissement bruyant (voir plus haut), pas une erreur bloquante : le
   * niveau continue de charger. */
  targetName: string | null;
  /** Carte de fidélité DONNÉE par cet objet (custom property Blender `card`)
   * — en fait un ramassage, consommé au premier usage. `null` si absent.
   * see: docs/reference/conventions-nommage.md#cartes-de-fidélité */
  grantsCard: LoyaltyCard | null;
  /** Carte de fidélité EXIGÉE par cet objet (custom property Blender
   * `requires`) pour agir sur sa cible. `null` = aucune condition.
   * see: docs/reference/conventions-nommage.md#cartes-de-fidélité */
  requiresCard: LoyaltyCard | null;
  /** Munitions de pistolet données par cet objet (custom property Blender
   * `munitions`, nombre > 0) — une boîte, ramassée en marchant dessus comme
   * une trousse. `null` si absent.
   * see: docs/reference/conventions-nommage.md#boîtes-de-munitions */
  ammo: number | null;
  /** PV rendus par cet objet (custom property Blender `soin`, nombre > 0) —
   * une trousse de soin, ramassée en marchant dessus et non à la touche E.
   * `null` si absent.
   * see: docs/reference/conventions-nommage.md#trousses-de-soin */
  heals: number | null;
  extras: Record<string, unknown>;
}

export interface SecretZone {
  name: string;
  object: THREE.Object3D;
  min: THREE.Vector3;
  max: THREE.Vector3;
  extras: Record<string, unknown>;
}

export interface LevelStats {
  colliderCount: number;
  /** Répartition de `colliderCount` par forme physique — voir le skill
   * `collision-proxy-authoring`. Additif : la somme des trois vaut toujours
   * `colliderCount`. */
  colliderKindCounts: {
    cuboid: number;
    convexHull: number;
    trimesh: number;
  };
  spawnSuitCount: number;
  spawnDirectorCount: number;
  triggerCount: number;
  doorCount: number;
  useCount: number;
  secretCount: number;
  /** Meshes rendus tels quels, sans préfixe reconnu — le cas SILENCIEUX. Compté AVANT la fusion du décor. */
  unprefixedMeshCount: number;
  /** Objets de décor réellement rendus après `mergeStaticDecor` : ordre de grandeur des draw calls du décor. */
  decorBatchCount: number;
  /** `light_*` instanciées en `THREE.PointLight` — voir `buildLevelLight`. */
  lightCount: number;
  /**
   * `prop_*` instanciés en corps dynamiques. AJOUTER UN PROP AJOUTE UN LOT DE
   * DESSIN : un corps qui bouge ne peut pas rejoindre un lot fusionné
   * (`mergeStaticDecor`), il se dessine seul pour toujours. À lire avec
   * `decorBatchCount`, sur un budget mesuré à 200.
   * see: docs/decisions/0030-props-dynamiques.md
   */
  propCount: number;
  /** `vitre_*` rencontrées, cassables ou non. */
  vitreCount: number;
  /**
   * Lots de dessin ajoutés par les vitres APRÈS fusion (`mergeVitreDecor`) :
   * un par matériau pour tout le niveau, quel que soit `vitreCount`. À lire
   * avec `decorBatchCount`, sur le même budget de 200.
   * see: docs/decisions/0031-portes-animees-et-vitres.md
   */
  vitreBatchCount: number;
  /**
   * Lots de dessin des vantaux (`batchDoorMeshes`) : un par matériau partagé
   * par au moins deux `door_*`, plus un par vantail seul de son matériau.
   */
  doorBatchCount: number;
  /** `sanitaire_*` rencontrés (cuvettes et urinoirs), cassés ou non. */
  sanitaireCount: number;
  /**
   * Lots de dessin ajoutés par les sanitaires APRÈS fusion
   * (`mergeSanitaireDecor`) : un par matériau pour tout le niveau, quel que
   * soit `sanitaireCount` — même contrat que `vitreBatchCount`.
   * see: docs/decisions/0032-sanitaires-utilisables.md
   */
  sanitaireBatchCount: number;
}

export interface LevelHandle {
  /** Racine ajoutée à `scene` (= `gltf.scene`). */
  root: THREE.Object3D;
  gltf: GLTF;
  /** `null` si absent du fichier — voir l'avertissement bruyant correspondant. */
  spawnPlayer: SpawnPoint | null;
  spawnSuits: NamedSpawn[];
  spawnDirectors: NamedSpawn[];
  triggers: TriggerVolume[];
  doors: DoorInfo[];
  useObjects: UseObject[];
  secrets: SecretZone[];
  /** Mobilier physique `prop_*` — l'état de partie (PV, destruction) vit dans
   * `PropSystem` (`game/level/props.ts`), reconstruit à chaque chargement.
   * see: docs/reference/conventions-nommage.md#props-physiques */
  props: PropInfo[];
  /** Vitrages `vitre_*` — l'état de partie (PV, casse) vit dans `VitreSystem`
   * (`game/level/vitres.ts`), reconstruit à chaque chargement comme `PropSystem`.
   * see: docs/reference/conventions-nommage.md#préfixe-vitre */
  vitres: VitreInfo[];
  /** Sanitaires `sanitaire_*` (cuvettes, urinoirs) — l'état de partie (cassé,
   * délai de soulagement) vit dans `SanitaireSystem` (`game/level/sanitaires.ts`)
   * et `session.sanitaireReliefCooldown`, reconstruits à chaque chargement
   * comme `VitreSystem`.
   * see: docs/reference/conventions-nommage.md#préfixe-sanitaire */
  sanitaires: SanitaireInfo[];
  /** Meshes RENDUS des sanitaires (lots fusionnés), élagués par distance comme les `use_*` — voir `SanitaireMergeResult.rendus`. */
  sanitaireRendus: SanitaireRendu[];
  /** Lampes `light_*` instanciées, déjà rattachées à `root`. Exposées pour le
   * pool de lampes (`render/lightPool.ts`), qui décide lesquelles restent
   * allumées — leur nombre seul ne suffit pas à ça.
   * see: docs/decisions/0026-visibilite-par-espace-et-pool-de-lampes.md */
  lights: THREE.PointLight[];
  stats: LevelStats;
  /**
   * Retire `root` de la scène et libère tous les corps/colliders Rapier et
   * ressources GPU de ce niveau. Sûr à appeler plusieurs fois — idempotence
   * GARANTIE par `Scope.close`, pas par un flag maintenu à la main.
   * see: docs/pipeline/niveau-blender.md#cycle-de-vie-du-levelhandle
   */
  dispose(): void;
}

/** Portée d'usage d'un `use_*`, mètres — voir reference/conventions-nommage.md. */
const USE_RANGE_METERS = 2;

/** Signe d'un mesh `col_*` oublié en high-poly — voir
 * reference/conventions-nommage.md. */
const MAX_COLLIDER_TRIANGLES = 50_000;

// Erreurs typées (jalon M2) — une par cas de dégradation. Patron uniforme
// "fail immédiatement rattrapé au point de détection" pour les 7 cas.
// see: docs/pipeline/niveau-blender.md#cycle-de-vie-du-levelhandle

/** `col_*`/`col_hull_*`/`col_mesh_*` sans géométrie valide (position absente)
 * ou avec 0 triangle. `prefixLabel` est le libellé du chemin emprunté
 * (`"col_*"` couvre aussi `col_mesh_*`, un alias du même chemin trimesh),
 * pas forcément le préfixe réel de l'objet. */
export class MissingColliderGeometryError extends Schema.TaggedError<MissingColliderGeometryError>()(
  "MissingColliderGeometryError",
  {
    name: Schema.String,
    prefixLabel: Schema.Literals(["col_*", "col_hull_*"]),
    reason: Schema.Literals(["missing-geometry", "zero-triangles"]),
  },
) {}

/** `col_*` dépassant `MAX_COLLIDER_TRIANGLES` — jamais bloquant, le collider
 * est créé quand même (diagnostic de mesh oublié en high-poly). */
export class OversizedColliderWarning extends Schema.TaggedError<OversizedColliderWarning>()(
  "OversizedColliderWarning",
  {
    name: Schema.String,
    triangleCount: Schema.Number,
  },
) {}

/** `spawn_player` absent du niveau. */
export class MissingSpawnPlayerError extends Schema.TaggedError<MissingSpawnPlayerError>()(
  "MissingSpawnPlayerError",
  {},
) {}

/** `spawn_player` présent plus d'une fois — seul le premier rencontré compte. */
export class DuplicateSpawnPlayerError extends Schema.TaggedError<DuplicateSpawnPlayerError>()(
  "DuplicateSpawnPlayerError",
  { count: Schema.Number },
) {}

/** `trig_*` dont la géométrie n'est pas une box axis-aligned (locale). */
export class NonBoxTriggerError extends Schema.TaggedError<NonBoxTriggerError>()("NonBoxTriggerError", {
  name: Schema.String,
}) {}

/** `use_*` sans `extras.target` — jamais bloquant, l'objet est quand même
 * retourné avec `targetName: null`. */
export class UntargetedUseObjectWarning extends Schema.TaggedError<UntargetedUseObjectWarning>()(
  "UntargetedUseObjectWarning",
  { name: Schema.String },
) {}

/** `use_*` dont `extras.card`/`extras.requires` ne nomme aucune carte
 * connue — une faute de frappe dans Blender, qui rendrait sinon la porte
 * ouverte à tous ou la carte introuvable, EN SILENCE. Jamais bloquant :
 * l'objet est retourné avec le champ correspondant à `null`. */
export class UnknownLoyaltyCardWarning extends Schema.TaggedError<UnknownLoyaltyCardWarning>()(
  "UnknownLoyaltyCardWarning",
  { name: Schema.String, property: Schema.String, value: Schema.String },
) {}

/** `use_*` dont `extras.soin` n'est pas un nombre strictement positif — une
 * trousse qui ne soignerait rien, ou une faute de frappe. Jamais bloquant :
 * l'objet est retourné avec `heals: null`. */
export class InvalidHealAmountWarning extends Schema.TaggedError<InvalidHealAmountWarning>()(
  "InvalidHealAmountWarning",
  { name: Schema.String, value: Schema.String, property: Schema.String },
) {}

/** `prop_*` dont `extras.matiere` n'est pas une matière connue — jamais
 * bloquant : le prop est construit avec `DEFAULT_PROP_MATERIAL`. */
export class UnknownPropMaterialWarning extends Schema.TaggedError<UnknownPropMaterialWarning>()(
  "UnknownPropMaterialWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `prop_*` dont `extras.masse`/`extras.pv` n'est pas un nombre strictement
 * positif — jamais bloquant : la propriété est ignorée et le prop prend le
 * défaut du préfixe (masse de repli, ou indestructible pour `pv`). */
export class InvalidPropNumberWarning extends Schema.TaggedError<InvalidPropNumberWarning>()(
  "InvalidPropNumberWarning",
  { name: Schema.String, property: Schema.String, value: Schema.String },
) {}

/** `door_*` dont `extras.mouvement` n'est pas une valeur connue — jamais
 * bloquant : la porte est construite avec `DEFAULT_DOOR_MOVEMENT` (même
 * règle que `matiere` sur un `prop_*`). */
export class UnknownDoorMovementWarning extends Schema.TaggedError<UnknownDoorMovementWarning>()(
  "UnknownDoorMovementWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `vitre_*` dont `extras.pv` n'est pas un nombre strictement positif —
 * jamais bloquant : la vitre est construite INCASSABLE (même règle que `pv`
 * sur un `prop_*`). */
export class InvalidVitrePvWarning extends Schema.TaggedError<InvalidVitrePvWarning>()(
  "InvalidVitrePvWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `sanitaire_*` dont `extras.sorte` n'est pas `"cuvette"`/`"urinoir"` —
 * OBLIGATOIRE, contrairement à `matiere`/`mouvement` : absent OU inconnu
 * avertit bruyamment (jamais un silence). Jamais bloquant : le sanitaire est
 * construit avec `DEFAULT_SANITAIRE_KIND`. `value` vaut `"(absent)"` quand la
 * propriété n'existe pas du tout, pour distinguer les deux cas dans le
 * message sans dupliquer la classe d'erreur. */
export class UnknownSanitaireKindWarning extends Schema.TaggedError<UnknownSanitaireKindWarning>()(
  "UnknownSanitaireKindWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `sanitaire_*` dont `extras.pv` n'est pas un nombre strictement positif —
 * jamais bloquant : le sanitaire est construit incassable AU TIR DU JOUEUR
 * (même règle que `pv` sur un `vitre_*`/`prop_*` — un tir ENNEMI le casse
 * quand même d'un coup, voir `SanitaireSystem.tryBreakByColliderHandle`). */
export class InvalidSanitairePvWarning extends Schema.TaggedError<InvalidSanitairePvWarning>()(
  "InvalidSanitairePvWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `col_hull_*` dont `RAPIER.ColliderDesc.convexHull` retourne `null`
 * (sommets dégénérés) — toujours suivi d'un repli sur un collider trimesh
 * pour ce même mesh, jamais d'absence totale de collider. */
export class DegenerateConvexHullError extends Schema.TaggedError<DegenerateConvexHullError>()(
  "DegenerateConvexHullError",
  { name: Schema.String },
) {}

/** Échec réseau/parsing lors du chargement d'un `.glb`/`.gltf` par URL — la
 * SEULE des 7 erreurs de ce fichier qui n'a jamais été un "warning" :
 * `loadLevel` a toujours laissé cette erreur remonter à son appelant
 * (`hotReload.ts` la rattrape, pas ce fichier). */
export class LevelFetchError extends Schema.TaggedError<LevelFetchError>()("LevelFetchError", {
  url: Schema.String,
  cause: Schema.Defect(),
}) {}

function formatMissingColliderGeometry(error: MissingColliderGeometryError): string {
  const detail = error.reason === "missing-geometry" ? "sans géométrie valide" : "a 0 triangle";
  return `[level] "${error.name}" (${error.prefixLabel}) ${detail} — aucun collider créé.`;
}

function formatOversizedCollider(error: OversizedColliderWarning): string {
  return (
    `[level] "${error.name}" (col_*) : ${error.triangleCount} triangles, au-delà du seuil de ` +
    `${MAX_COLLIDER_TRIANGLES} — signe probable d'un mesh oublié en high-poly. ` +
    `Collider créé quand même.`
  );
}

function formatMissingSpawnPlayer(): string {
  return "[level] spawn_player absent du niveau — le joueur ne peut pas être positionné au chargement.";
}

function formatDuplicateSpawnPlayer(error: DuplicateSpawnPlayerError): string {
  return `[level] spawn_player en double (${error.count} occurrences) — seule la première rencontrée est utilisée.`;
}

function formatNonBoxTrigger(error: NonBoxTriggerError): string {
  return `[level] "${error.name}" (trig_*) n'est pas une géométrie box — trigger ignoré.`;
}

function formatUntargetedUseObject(error: UntargetedUseObjectWarning): string {
  return (
    `[level] "${error.name}" (use_*) n'a pas de cible référencée dans ses extras ` +
    `(custom property Blender "target" attendue) — objet interactif sans effet exploitable.`
  );
}

function formatUnknownLoyaltyCard(error: UnknownLoyaltyCardWarning): string {
  return (
    `[level] "${error.name}" (use_*) : propriété "${error.property}" = "${error.value}", ` +
    `qui n'est pas une carte de fidélité connue (${LOYALTY_CARDS.join(", ")}) — propriété ignorée.`
  );
}

function formatInvalidHealAmount(error: InvalidHealAmountWarning): string {
  const unite = error.property === "soin" ? "PV" : "munitions";
  return (
    `[level] "${error.name}" (use_*) : propriété "${error.property}" = "${error.value}", ` +
    `qui n'est pas un nombre de ${unite} strictement positif — propriété ignorée.`
  );
}

function formatUnknownPropMaterial(error: UnknownPropMaterialWarning): string {
  return (
    `[level] "${error.name}" (prop_*) : propriété "matiere" = "${error.value}", ` +
    `qui n'est pas une matière connue (${PROP_MATERIALS.join(", ")}) — ` +
    `repli sur "${DEFAULT_PROP_MATERIAL}".`
  );
}

function formatInvalidPropNumber(error: InvalidPropNumberWarning): string {
  const repli =
    error.property === "masse"
      ? `repli sur ${DEFAULT_PROP_MASS_KG} kg`
      : "prop laissé indestructible";
  return (
    `[level] "${error.name}" (prop_*) : propriété "${error.property}" = "${error.value}", ` +
    `qui n'est pas un nombre strictement positif — ${repli}.`
  );
}

function formatUnknownDoorMovement(error: UnknownDoorMovementWarning): string {
  return (
    `[level] "${error.name}" (door_*) : propriété "mouvement" = "${error.value}", ` +
    `qui n'est pas un mouvement connu (${DOOR_MOVEMENTS.join(", ")}) — repli sur "${DEFAULT_DOOR_MOVEMENT}".`
  );
}

function formatInvalidVitrePv(error: InvalidVitrePvWarning): string {
  return (
    `[level] "${error.name}" (vitre_*) : propriété "pv" = "${error.value}", ` +
    `qui n'est pas un nombre strictement positif — vitre laissée incassable.`
  );
}

function formatUnknownSanitaireKind(error: UnknownSanitaireKindWarning): string {
  return (
    `[level] "${error.name}" (sanitaire_*) : propriété "sorte" = "${error.value}", ` +
    `qui n'est pas une sorte connue (${SANITAIRE_KINDS.join(", ")}), et OBLIGATOIRE — ` +
    `repli sur "${DEFAULT_SANITAIRE_KIND}".`
  );
}

function formatInvalidSanitairePv(error: InvalidSanitairePvWarning): string {
  return (
    `[level] "${error.name}" (sanitaire_*) : propriété "pv" = "${error.value}", ` +
    `qui n'est pas un nombre strictement positif — sanitaire laissé incassable (au tir du joueur).`
  );
}

function formatDegenerateConvexHull(error: DegenerateConvexHullError): string {
  return (
    `[level] "${error.name}" (col_hull_*) : hull convexe dégénéré ` +
    `(RAPIER.ColliderDesc.convexHull a retourné null, sommets probablement coplanaires) ` +
    `— repli sur un collider trimesh pour ce mesh.`
  );
}

// Conversion de matériau — invariant #5.
// see: docs/systems/rendu.md#invariant-5-reconversion-depuis-gltfloader

function toLambert(mat: THREE.Material, hasVertexColors: boolean): THREE.MeshLambertMaterial {
  const src = mat as THREE.MeshStandardMaterial;
  const lambert = new THREE.MeshLambertMaterial({
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    map: src.map ?? null,
    transparent: src.transparent,
    opacity: src.opacity,
    side: src.side,
    alphaTest: src.alphaTest,
    vertexColors: hasVertexColors,
    // volontairement absents : roughnessMap/metalnessMap/normalMap/envMap —
    // c'est exactement ce que l'invariant #5 demande de jeter.
  });
  lambert.name = mat.name;
  if (lambert.map) {
    // Invariant #4 : `NearestFilter` à l'AGRANDISSEMENT, toujours — c'est lui
    // qui fait le gros pixel franc. La réduction (les surfaces vues de loin)
    // suit le mode courant : voir `configureRetroTexture` et l'ADR 0027.
    configureRetroTexture(lambert.map);
  }
  return lambert;
}

function convertToLambert(mesh: THREE.Mesh): void {
  const hasVertexColors = mesh.geometry.hasAttribute("color");
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((mat) => toLambert(mat, hasVertexColors));
  } else {
    mesh.material = toLambert(mesh.material, hasVertexColors);
  }
}

/**
 * `GLTFLoader` réécrit `.name` de chaque nœud importé (pour l'animation) —
 * lire `userData.name` (le nom brut préservé par `GLTFLoader`), jamais
 * `obj.name`, pour tout ce qui touche au contrat de nommage. Exception :
 * `findClipForObject` lit `mesh.name` (mangled) à dessein, car les pistes
 * d'animation sont nommées à partir de ce même nom réécrit.
 * see: docs/pipeline/niveau-blender.md#le-nom-tel-que-tapé-dans-blender
 */
function blenderName(obj: THREE.Object3D): string {
  const raw = (obj.userData as Record<string, unknown> | undefined)?.name;
  return typeof raw === "string" ? raw : obj.name;
}

/** Copie de `userData` pour `extras`, SANS la clé `name` que `GLTFLoader` y
 * injecte lui-même (voir `blenderName`) — ce n'est pas une custom property
 * Blender, l'exposer polluerait `extras.target`/`extras.hp`/etc. */
function cleanExtras(obj: THREE.Object3D): Record<string, unknown> {
  const { name: _internalName, ...rest } = obj.userData as Record<string, unknown>;
  return rest;
}

/**
 * `light_*` — une lampe du niveau, posée dans Blender comme un empty.
 *
 * Pourquoi un empty et non une vraie lampe Blender exportée en
 * `KHR_lights_punctual` : la scène Blender a DEUX éclairages qui n'ont rien à
 * voir. Les area lights servent au bake — grandes, douces, en forme de tube —
 * et l'unité de Blender (le watt) ne se convertit pas en intensité three.js.
 * Un empty porte exactement les paramètres de `THREE.PointLight`, lisibles tels
 * quels, et ne risque jamais d'être confondu avec une source de bake.
 *
 * Extras lus (tous optionnels) : `color` (« #rrggbb »), `intensity`,
 * `distance`, `decay`. Les défauts correspondent à un tube de néon de plafond.
 * see: docs/systems/rendu.md#éclairage-hybride-lampes-temps-réel--ombre-cuite
 */
function buildLevelLight(obj: THREE.Object3D, name: string): THREE.PointLight {
  const extras = cleanExtras(obj);
  const read = (key: string, fallback: number): number => {
    const value = extras[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  const color = typeof extras.color === "string" ? extras.color : "#ffffff";
  const light = new THREE.PointLight(
    new THREE.Color(color),
    read("intensity", 8),
    read("distance", 12),
    read("decay", 2),
  );
  light.name = name;
  obj.getWorldPosition(light.position);
  return light;
}

// Géométrie monde — voir le piège des transforms.
// see: docs/pipeline/niveau-blender.md#extraction-et-le-piège-des-transforms

function worldSpaceGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  return geo;
}

function buildSequentialIndex(vertexCount: number): Uint32Array {
  const idx = new Uint32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) idx[i] = i;
  return idx;
}

/** Un mesh est une "box" si TOUS ses sommets sont sur un coin de sa propre
 * bounding box locale — vérifié en espace LOCAL, pas monde : un cuboid
 * tourné par son parent reste valide (la rotation est portée par le corps
 * Rapier), une déformation non uniforme échoue quel que soit son alignement.
 * see: docs/pipeline/niveau-blender.md#hiérarchie-des-colliders */
function isAxisAlignedBox(geometry: THREE.BufferGeometry, epsilon = 1e-4): boolean {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!position || position.count === 0) return false;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  if (!bb) return false;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const onX = Math.abs(x - bb.min.x) < epsilon || Math.abs(x - bb.max.x) < epsilon;
    const onY = Math.abs(y - bb.min.y) < epsilon || Math.abs(y - bb.max.y) < epsilon;
    const onZ = Math.abs(z - bb.min.z) < epsilon || Math.abs(z - bb.max.z) < epsilon;
    if (!(onX && onY && onZ)) return false;
  }
  return true;
}

/** `col_*` : collider trimesh statique, mesh rendu invisible. Version
 * "brute" : échoue avec `MissingColliderGeometryError` plutôt que de
 * logguer elle-même — voir `buildStaticColliderSafe` pour la version
 * rattrapée utilisée par le traverse principal. */
function buildStaticColliderEffect(
  mesh: THREE.Mesh,
  name: string,
  prefixLabel: "col_*" | "col_hull_*",
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<boolean, MissingColliderGeometryError> {
  return Effect.gen(function* () {
    const worldGeometry = worldSpaceGeometry(mesh);
    const positionAttr = worldGeometry.getAttribute("position") as THREE.BufferAttribute | undefined;

    if (!positionAttr || positionAttr.count === 0) {
      worldGeometry.dispose();
      return yield* new MissingColliderGeometryError({ name, prefixLabel, reason: "missing-geometry" });
    }

    const indexAttr = worldGeometry.getIndex();
    const rawIndices = indexAttr ? indexAttr.array : buildSequentialIndex(positionAttr.count);
    const triangleCount = Math.floor(rawIndices.length / 3);

    if (triangleCount === 0) {
      worldGeometry.dispose();
      return yield* new MissingColliderGeometryError({ name, prefixLabel, reason: "zero-triangles" });
    }
    if (triangleCount > MAX_COLLIDER_TRIANGLES) {
      // Avertissement non bloquant : loggué immédiatement, la construction continue juste après.
      yield* Effect.fail(new OversizedColliderWarning({ name, triangleCount })).pipe(
        Effect.catch((error) => Effect.sync(() => console.error(formatOversizedCollider(error)))),
      );
    }

    const vertices =
      positionAttr.array instanceof Float32Array
        ? positionAttr.array
        : Float32Array.from(positionAttr.array as ArrayLike<number>);
    const indices = rawIndices instanceof Uint32Array ? rawIndices : Uint32Array.from(rawIndices as ArrayLike<number>);

    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    physics.world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices).setCollisionGroups(COLLISION_GROUPS.WORLD),
      body,
    );
    bodies.push(body);

    worldGeometry.dispose();
    return true;
  });
}

/** Version rattrapée de `buildStaticColliderEffect` : ne fait jamais échouer
 * l'appelant, logue et retourne `false` (comme l'ancien retour booléen) sur
 * `MissingColliderGeometryError`. */
function buildStaticColliderSafe(
  mesh: THREE.Mesh,
  name: string,
  prefixLabel: "col_*" | "col_hull_*",
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<boolean> {
  return buildStaticColliderEffect(mesh, name, prefixLabel, physics, bodies).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        console.error(formatMissingColliderGeometry(error));
        return false;
      }),
    ),
  );
}

/** `col_box_*` : cuboid inconditionnel, confiance à l'artiste (pas de
 * revalidation géométrique). Corps FIXED, groupe `COLLISION_GROUPS.WORLD`
 * (jamais `TRIGGER`/sensor — un `col_box_*` est un mur, pas un volume
 * logique). Centré sur la bounding box locale, comme `buildTriggerEffect`.
 * see: docs/pipeline/niveau-blender.md#hiérarchie-des-colliders */
function buildCuboidCollider(mesh: THREE.Mesh, physics: PhysicsWorld, bodies: RAPIER.RigidBody[]): void {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
  const localCenter = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);

  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  const discardedPosition = new THREE.Vector3();
  mesh.matrixWorld.decompose(discardedPosition, worldQuat, worldScale);

  const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);
  const halfExtents = new THREE.Vector3(
    Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
    Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
    Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
  );

  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
      .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }),
  );
  physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(
      COLLISION_GROUPS.WORLD,
    ),
    body,
  );
  bodies.push(body);
}

/** `col_hull_*` : convex hull, sommets en espace MONDE. Si
 * `RAPIER.ColliderDesc.convexHull` retourne `null` (hull dégénéré), repli
 * automatique sur `buildStaticColliderEffect` (trimesh) pour ce même mesh —
 * un `col_hull_*` ne doit jamais rester sans AUCUN collider. Version
 * "brute" : `buildConvexHullColliderSafe` fait le rattrapage complet.
 * see: docs/pipeline/niveau-blender.md#hiérarchie-des-colliders */
function buildConvexHullColliderEffect(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<"convexHull", MissingColliderGeometryError | DegenerateConvexHullError> {
  return Effect.gen(function* () {
    const worldGeometry = worldSpaceGeometry(mesh);
    const positionAttr = worldGeometry.getAttribute("position") as THREE.BufferAttribute | undefined;

    if (!positionAttr || positionAttr.count === 0) {
      worldGeometry.dispose();
      return yield* new MissingColliderGeometryError({ name, prefixLabel: "col_hull_*", reason: "missing-geometry" });
    }

    const points =
      positionAttr.array instanceof Float32Array
        ? positionAttr.array
        : Float32Array.from(positionAttr.array as ArrayLike<number>);
    worldGeometry.dispose();

    const desc = RAPIER.ColliderDesc.convexHull(points);
    if (!desc) {
      return yield* new DegenerateConvexHullError({ name });
    }

    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    physics.world.createCollider(desc.setCollisionGroups(COLLISION_GROUPS.WORLD), body);
    bodies.push(body);
    return "convexHull" as const;
  });
}

/** Version rattrapée de `buildConvexHullColliderEffect` : géométrie
 * manquante -> `null` ; hull dégénéré -> repli trimesh via
 * `buildStaticColliderSafe`. */
function buildConvexHullColliderSafe(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<"convexHull" | "trimesh" | null> {
  return buildConvexHullColliderEffect(mesh, name, physics, bodies).pipe(
    Effect.catchTags({
      MissingColliderGeometryError: (error) =>
        Effect.sync(() => {
          console.error(formatMissingColliderGeometry(error));
          return null;
        }),
      DegenerateConvexHullError: (error) =>
        Effect.gen(function* () {
          console.error(formatDegenerateConvexHull(error));
          // Label "col_*" volontaire (pas "col_hull_*") : fidèle au message
          // historique du repli trimesh, jamais paramétré par le préfixe réel.
          const created = yield* buildStaticColliderSafe(mesh, name, "col_*", physics, bodies);
          return created ? ("trimesh" as const) : null;
        }),
    }),
  );
}

/** `spawn_player` (Empty) : position + yaw. Voir la doc de `SpawnPoint` pour
 * la convention pieds/yeux. */
function extractSpawnPoint(obj: THREE.Object3D): SpawnPoint {
  const position = new THREE.Vector3();
  obj.getWorldPosition(position);

  const worldQuat = new THREE.Quaternion();
  obj.getWorldQuaternion(worldQuat);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat);
  // Convention yaw=0 -> avant = -Z, voir SpawnPoint.yaw.
  const yaw = Math.atan2(-forward.x, -forward.z);

  return { position, yaw };
}

/** `trig_*` : volume box, sensor Rapier. Version "brute" : échoue avec
 * `NonBoxTriggerError` si la géométrie n'est pas une box — voir
 * `buildTriggerSafe` pour la version rattrapée. */
function buildTriggerEffect(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<TriggerVolume, NonBoxTriggerError> {
  return Effect.gen(function* () {
    if (!isAxisAlignedBox(mesh.geometry)) {
      return yield* new NonBoxTriggerError({ name });
    }

    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
    const localCenter = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);

    const worldPosition = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    mesh.matrixWorld.decompose(worldPosition, worldQuat, worldScale);

    const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);
    const halfExtents = new THREE.Vector3(
      Math.abs((localSize.x * worldScale.x) / 2),
      Math.abs((localSize.y * worldScale.y) / 2),
      Math.abs((localSize.z * worldScale.z) / 2),
    );

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
        .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }),
    );
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setSensor(true)
        .setCollisionGroups(COLLISION_GROUPS.TRIGGER),
      body,
    );
    bodies.push(body);

    return {
      name,
      object: mesh,
      min: worldCenter.clone().sub(halfExtents),
      max: worldCenter.clone().add(halfExtents),
      extras: cleanExtras(mesh),
    };
  });
}

/** Version rattrapée de `buildTriggerEffect` : logue et retourne `null` sur
 * `NonBoxTriggerError`. */
function buildTriggerSafe(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<TriggerVolume | null> {
  return buildTriggerEffect(mesh, name, physics, bodies).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        console.error(formatNonBoxTrigger(error));
        return null;
      }),
    ),
  );
}

/** Cherche le clip glTF dont une piste cible ce nœud (par nom — voir
 * `PATH_PROPERTIES`/`targetName` de `GLTFLoader.js` : le nom de piste est
 * toujours `<nom du nœud>.<propriété>`). Ne joue rien, se contente d'exposer
 * le clip pour un futur `interactive.ts`. */
function findClipForObject(clips: THREE.AnimationClip[], object: THREE.Object3D): THREE.AnimationClip | null {
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const dot = track.name.indexOf(".");
      const nodeName = dot === -1 ? track.name : track.name.slice(0, dot);
      if (nodeName === object.name || nodeName === object.uuid) return clip;
    }
  }
  return null;
}

/**
 * `door_*` : porte ANIMÉE (`game/level/doors.ts::DoorSystem`, reconstruit à
 * chaque chargement comme `PropSystem`). Corps FIXE, posé à la pose FERMÉE
 * pour toujours — seul le collider est activé/désactivé, seul le MESH bouge.
 * Voir [ADR 0031](../../../docs/decisions/0031-portes-animees-et-vitres.md)
 * pour la cause racine (aucune porte ne bougeait à l'écran avant ce jalon) et
 * les choix ci-dessous.
 *
 * Le mesh est rattaché sous `root` (`root.attach`, comme un `prop_*`) : sa
 * pose LOCALE résultante EST la pose "fermée" que `DoorSystem` anime autour —
 * plus besoin de matrice inverse à chaque pas fixe, contrairement à
 * `PropSystem` qui relit un corps dynamique. Contrairement à l'ANCIEN
 * `buildDoor` ([ADR 0012](../../../docs/decisions/0012-porte-collider-non-recentre.md),
 * qui posait le corps sur la translation brute du mesh), le corps est
 * maintenant recentré sur la bounding box locale — comme `buildCuboidCollider`
 * — parce que le vantail n'est plus verrouillé-mais-mobile : un corps FIXE
 * pour de bon peut se permettre d'être exactement juste. Sans effet sur les
 * `.glb` déjà exportés (leurs vantaux ont l'origine déjà recentrée en
 * Blender pour compenser ce même écart, voir l'ADR 0012).
 */
function buildDoorEffect(
  mesh: THREE.Mesh,
  name: string,
  root: THREE.Object3D,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
  clips: THREE.AnimationClip[],
): Effect.Effect<DoorInfo> {
  return Effect.gen(function* () {
    const extras = cleanExtras(mesh);
    const movement = yield* readDoorMovement(name, extras.mouvement);

    root.attach(mesh);
    mesh.updateMatrixWorld(true);

    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    const localMin = bb.min.clone();
    const localMax = bb.max.clone();
    const localCenter = new THREE.Vector3().addVectors(localMin, localMax).multiplyScalar(0.5);
    const localSize = new THREE.Vector3().subVectors(localMax, localMin);

    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    const discardedPosition = new THREE.Vector3();
    mesh.matrixWorld.decompose(discardedPosition, worldQuat, worldScale);
    const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);

    const halfExtents = new THREE.Vector3(
      Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
      Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
      Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
    );

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
        .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }),
    );
    const collider = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(
        COLLISION_GROUPS.WORLD,
      ),
      body,
    );
    bodies.push(body);

    return {
      name,
      object: mesh,
      body,
      collider,
      halfExtents,
      localMin,
      localMax,
      closedPosition: mesh.position.clone(),
      closedQuaternion: mesh.quaternion.clone(),
      scale: mesh.scale.clone(),
      movement,
      clip: findClipForObject(clips, mesh),
      extras,
    };
  });
}

/**
 * `vitre_*` : mesh de verre plat, UN matériau (l'alpha `transparent`/
 * `opacity` du glTF a déjà été recopié par `toLambert`, appelé pour CE mesh
 * comme pour tous les autres avant le routage par préfixe). Collider cuboid
 * FIXE, groupe WORLD, tant que `solide !== false` — une verrière au plafond
 * (`solide: false`) n'a AUCUN collider et est incassable : un collider
 * au-dessus d'un sol serait pris pour le sol par le bake du graphe de
 * navigation, piège déjà connu des plafonds (voir `docs/reference/conventions-nommage.md`).
 *
 * Double face + pas d'écriture de profondeur : une teinte unique de vitrage
 * rend l'ordre de mélange indifférent, pas besoin de trier les fragments.
 *
 * Ne construit QUE le candidat — la fusion (`mergeVitreDecor`,
 * voir `LevelStats.vitreBatchCount`) et l'état de partie (PV, casse,
 * `VitreSystem`) vivent ailleurs, même séparation que `prop_*`/`PropSystem`.
 */
function buildVitreCandidateEffect(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<VitreCandidate> {
  return Effect.gen(function* () {
    const extras = cleanExtras(mesh);
    const solide = extras.solide !== false;
    const maxHp = solide ? yield* readVitrePv(name, extras.pv) : null;
    const givre = extras.givre === true;

    const material = mesh.material as THREE.MeshLambertMaterial;
    material.side = THREE.DoubleSide;
    material.depthWrite = false;

    let collider: RAPIER.Collider | null = null;
    let body: RAPIER.RigidBody | null = null;
    if (solide) {
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox!;
      const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
      const localCenter = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);

      const worldQuat = new THREE.Quaternion();
      const worldScale = new THREE.Vector3();
      const discardedPosition = new THREE.Vector3();
      mesh.matrixWorld.decompose(discardedPosition, worldQuat, worldScale);
      const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);

      const halfExtents = new THREE.Vector3(
        Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
        Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
        Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
      );

      body = physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
          .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }),
      );
      collider = physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(
          COLLISION_GROUPS.WORLD,
        ),
        body,
      );
      bodies.push(body);
    }

    return {
      name,
      mesh: mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>,
      collider,
      body,
      maxHp,
      givre,
      extras,
    };
  });
}

/** Lit `sorte` d'un `sanitaire_*` : OBLIGATOIRE, contrairement à
 * `matiere`/`mouvement` — absente ou inconnue avertit bruyamment dans LES
 * DEUX CAS (jamais un silence pour une propriété obligatoire), repli sur
 * `DEFAULT_SANITAIRE_KIND`. */
function readSanitaireKind(name: string, raw: unknown): Effect.Effect<SanitaireKind> {
  return Effect.gen(function* () {
    const sorte = parseSanitaireKind(raw);
    if (sorte) return sorte;
    const value = raw === undefined || raw === null || raw === "" ? "(absent)" : String(raw);
    yield* Effect.fail(new UnknownSanitaireKindWarning({ name, value })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownSanitaireKind(error)))),
    );
    return DEFAULT_SANITAIRE_KIND;
  });
}

/** Lit `pv` d'un `sanitaire_*` : absent -> `null` (incassable au tir du
 * joueur) sans bruit, présent mais pas un nombre strictement positif ->
 * `null` AVEC avertissement bruyant (même règle que `pv` sur un `vitre_*`). */
function readSanitairePv(name: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
    yield* Effect.fail(new InvalidSanitairePvWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidSanitairePv(error)))),
    );
    return null;
  });
}

/**
 * `sanitaire_*` : cuvette ou urinoir, UN mesh UN matériau — jamais de
 * `col_*` jumeau, le loader construit lui-même un collider cuboïde FIXE sur
 * la bbox monde, groupe WORLD (comme un `vitre_*` solide). Ne construit QUE
 * le candidat — la fusion (`mergeSanitaireDecor`) et l'état de partie
 * (`SanitaireSystem`) vivent ailleurs, même séparation que `vitre_*`/`prop_*`.
 * see: docs/reference/conventions-nommage.md#préfixe-sanitaire
 */
function buildSanitaireCandidateEffect(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<SanitaireCandidate> {
  return Effect.gen(function* () {
    const extras = cleanExtras(mesh);
    const kind = yield* readSanitaireKind(name, extras.sorte);
    const maxHp = yield* readSanitairePv(name, extras.pv);

    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
    const localCenter = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);

    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    const discardedPosition = new THREE.Vector3();
    mesh.matrixWorld.decompose(discardedPosition, worldQuat, worldScale);
    const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);

    const halfExtents = new THREE.Vector3(
      Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
      Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
      Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
    );

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
        .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }),
    );
    const collider = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(
        COLLISION_GROUPS.WORLD,
      ),
      body,
    );
    bodies.push(body);

    // Bbox MONDE réelle (le kit ne pose ses pièces qu'à des rotations
    // multiples de 90°, comme tout `col_box_*`/`prop_*`/`vitre_*` — même
    // hypothèse qu'ailleurs dans ce fichier) : sert au jet d'eau (bas-centre,
    // vers le haut), aussi l'ancrage du volume de visée du jet une fois cassé
    // (`SanitaireSystem.resolveAim`) — pas stockée telle quelle, seul
    // `jetOrigin` survit sur le candidat.
    const worldMin = worldCenter.clone().sub(halfExtents);
    const worldMax = worldCenter.clone().add(halfExtents);
    const jetOrigin = new THREE.Vector3((worldMin.x + worldMax.x) / 2, worldMin.y, (worldMin.z + worldMax.z) / 2);

    return {
      name,
      mesh: mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>,
      collider,
      body,
      kind,
      maxHp,
      jetOrigin,
      extras,
    };
  });
}

/**
 * Masse d'un `prop_*` qui ne déclare pas `masse`, en kg.
 *
 * Rapier déduirait sinon la masse d'une densité par défaut de 1000 kg/m³
 * (celle de l'eau) : une caisse d'un mètre de côté pèserait une tonne et le
 * joueur — 80 kg, `moveConfig.characterMass` — ne la bougerait pas d'un
 * millimètre. 25 kg se pousse en marchant dessus sans partir en glissade.
 */
const DEFAULT_PROP_MASS_KG = 25;

/** Frottement/rebond d'un prop : il glisse un peu et ne rebondit pas. Un
 * caddie qui rebondit se lit comme un ballon de plage. */
const PROP_FRICTION = 0.8;
const PROP_RESTITUTION = 0;

/** Amortissements : sans eux, un prop poussé sur un sol plat garde sa vitesse
 * très longtemps (Rapier n'a pas de frottement de roulement) et traverse la
 * pièce pour un coup d'épaule. */
const PROP_LINEAR_DAMPING = 0.6;
const PROP_ANGULAR_DAMPING = 0.8;

/** Lit `matiere` : absente -> défaut sans bruit, inconnue -> défaut AVEC
 * avertissement bruyant (même règle que `card` sur un `use_*`). */
function readPropMaterial(name: string, raw: unknown): Effect.Effect<PropMaterial> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return DEFAULT_PROP_MATERIAL;
    const matiere = parsePropMaterial(raw);
    if (matiere) return matiere;
    yield* Effect.fail(new UnknownPropMaterialWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownPropMaterial(error)))),
    );
    return DEFAULT_PROP_MATERIAL;
  });
}

/** Lit `masse`/`pv` : absente -> `null` sans bruit, présente mais pas un
 * nombre > 0 -> `null` AVEC avertissement bruyant. */
function readPropNumber(name: string, property: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
    yield* Effect.fail(new InvalidPropNumberWarning({ name, property, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidPropNumber(error)))),
    );
    return null;
  });
}

/** Lit `mouvement` d'un `door_*` : absent -> `DEFAULT_DOOR_MOVEMENT` sans
 * bruit, présent mais inconnu -> `DEFAULT_DOOR_MOVEMENT` AVEC avertissement
 * bruyant (même règle que `matiere` sur un `prop_*`). */
function readDoorMovement(name: string, raw: unknown): Effect.Effect<DoorMovement> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return DEFAULT_DOOR_MOVEMENT;
    const mouvement = parseDoorMovement(raw);
    if (mouvement) return mouvement;
    yield* Effect.fail(new UnknownDoorMovementWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownDoorMovement(error)))),
    );
    return DEFAULT_DOOR_MOVEMENT;
  });
}

/** Lit `pv` d'un `vitre_*` : absent -> `null` (incassable) sans bruit,
 * présent mais pas un nombre strictement positif -> `null` AVEC
 * avertissement bruyant (même règle que `pv` sur un `prop_*`). */
function readVitrePv(name: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
    yield* Effect.fail(new InvalidVitrePvWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidVitrePv(error)))),
    );
    return null;
  });
}

/**
 * `prop_*` : mobilier physique. Corps DYNAMIQUE libre (contrairement à
 * `door_*`, dynamique mais verrouillé), collider cuboid, groupe
 * `COLLISION_GROUPS.PROP`.
 *
 * Deux différences avec tous les autres préfixes, toutes deux nécessaires
 * parce que ce corps-ci est réellement libre :
 *
 * 1. **Le mesh est reparenté sous `root`** (`root.attach`, qui conserve la
 *    pose MONDE). Un prop resté sous un groupe Blender hériterait de la
 *    transformation de ce groupe EN PLUS de celle que la physique lui écrit.
 * 2. **Le corps est posé sur le CENTRE de la boîte, pas sur l'origine du
 *    mesh** — un corps dynamique tourne autour de son centre de masse. Le
 *    décalage entre les deux est conservé dans `PropInfo.centerOffset` et
 *    réappliqué au rendu ; c'est exactement le piège que `buildDoor` laisse
 *    ouvert (ADR 0012), sans conséquence pour un vantail verrouillé.
 *
 * Extras lus (tous optionnels) : `masse` (kg), `pv` (absent = indestructible),
 * `matiere` (son de casse + couleur des débris).
 * see: docs/reference/conventions-nommage.md#props-physiques
 */
function buildPropEffect(
  mesh: THREE.Mesh,
  name: string,
  root: THREE.Object3D,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<PropInfo> {
  return Effect.gen(function* () {
    const extras = cleanExtras(mesh);
    const matiere = yield* readPropMaterial(name, extras.matiere);
    const masse = yield* readPropNumber(name, "masse", extras.masse);
    const maxHp = yield* readPropNumber(name, "pv", extras.pv);

    root.attach(mesh);
    mesh.updateMatrixWorld(true);

    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
    const centerOffset = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);

    const worldPosition = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    mesh.matrixWorld.decompose(worldPosition, worldQuat, worldScale);
    const worldCenter = centerOffset.clone().applyMatrix4(mesh.matrixWorld);

    const halfExtents = new THREE.Vector3(
      Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
      Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
      Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
    );

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
        .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w })
        .setLinearDamping(PROP_LINEAR_DAMPING)
        .setAngularDamping(PROP_ANGULAR_DAMPING)
        // Un plomb de pompe transmet une impulsion franche à un objet léger :
        // sans CCD, un prop peut traverser un sol de 20 cm en un seul pas fixe.
        .setCcdEnabled(true),
    );
    const collider = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setMass(masse ?? DEFAULT_PROP_MASS_KG)
        .setFriction(PROP_FRICTION)
        .setRestitution(PROP_RESTITUTION)
        .setCollisionGroups(COLLISION_GROUPS.PROP),
      body,
    );
    bodies.push(body);

    return { name, object: mesh, body, collider, halfExtents, centerOffset, maxHp, matiere, extras };
  });
}

/** `use_*` : objet interactif, portée 2 m. Cible lue dans `extras.target`.
 * Absence de cible = `UntargetedUseObjectWarning`, loggué immédiatement
 * (jamais bloquant) — l'objet est quand même retourné avec
 * `targetName: null`. see: docs/pipeline/niveau-blender.md#objets-interactifs */
/** Lit une propriété de carte (`card`/`requires`) : absente -> `null` sans
 * bruit, présente mais inconnue -> `null` AVEC avertissement bruyant. */
function readCardProperty(name: string, property: string, raw: unknown): Effect.Effect<LoyaltyCard | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const card = parseLoyaltyCard(raw);
    if (card) return card;
    yield* Effect.fail(new UnknownLoyaltyCardWarning({ name, property, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownLoyaltyCard(error)))),
    );
    return null;
  });
}

/** Lit une quantité (`soin`, `munitions`) : absente -> `null` sans bruit,
 * présente mais pas un nombre > 0 -> `null` AVEC avertissement bruyant (même
 * règle que les cartes). */
function readAmountProperty(name: string, property: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const amount = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(amount) && amount > 0) return amount;
    yield* Effect.fail(new InvalidHealAmountWarning({ name, value: String(raw), property })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidHealAmount(error)))),
    );
    return null;
  });
}

function buildUseObjectEffect(mesh: THREE.Mesh, name: string): Effect.Effect<UseObject> {
  return Effect.gen(function* () {
    const position = new THREE.Vector3();
    mesh.getWorldPosition(position);

    const extras = cleanExtras(mesh);
    const targetName = typeof extras.target === "string" ? extras.target : null;
    const grantsCard = yield* readCardProperty(name, "card", extras.card);
    const requiresCard = yield* readCardProperty(name, "requires", extras.requires);
    const heals = yield* readAmountProperty(name, "soin", extras.soin);
    const ammo = yield* readAmountProperty(name, "munitions", extras.munitions);

    // Une carte ou une trousse à ramasser se suffit à elle-même : pas de
    // cible, donc pas d'avertissement — même exception de fond que
    // `use_crowbar`/`use_shotgun`, qui eux le déclenchent encore (leur effet
    // est câblé par nom, pas déclaré dans le `.glb`).
    if (!targetName && !grantsCard && heals === null && ammo === null) {
      yield* Effect.fail(new UntargetedUseObjectWarning({ name })).pipe(
        Effect.catch((error) => Effect.sync(() => console.error(formatUntargetedUseObject(error)))),
      );
    }

    return { name, object: mesh, position, range: USE_RANGE_METERS, targetName, grantsCard, requiresCard, heals, ammo, extras };
  });
}

/** `secret_*` : même traitement géométrique qu'un `trig_*` (bounding box
 * monde), mais AUCUNE exigence de forme box — un secret peut être une zone
 * irrégulière, sa détection appartient à `interactive.ts`, pas à ce loader. */
function buildSecretZone(mesh: THREE.Mesh, name: string): SecretZone {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  const corners = [
    new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z),
    new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z),
  ].map((v) => v.applyMatrix4(mesh.matrixWorld));

  const min = new THREE.Vector3(
    Math.min(corners[0].x, corners[1].x),
    Math.min(corners[0].y, corners[1].y),
    Math.min(corners[0].z, corners[1].z),
  );
  const max = new THREE.Vector3(
    Math.max(corners[0].x, corners[1].x),
    Math.max(corners[0].y, corners[1].y),
    Math.max(corners[0].z, corners[1].z),
  );

  return { name, object: mesh, min, max, extras: cleanExtras(mesh) };
}

/** Validation post-traversal du nombre de `spawn_player` rencontrés — même
 * patron "fail immédiatement rattrapé" que les cas par-mesh ci-dessus, juste
 * exécuté une fois après la boucle plutôt que par nœud. */
function validateSpawnPlayerCountEffect(count: number): Effect.Effect<void> {
  if (count === 0) {
    return Effect.fail(new MissingSpawnPlayerError({})).pipe(
      Effect.catch(() => Effect.sync(() => console.error(formatMissingSpawnPlayer()))),
    );
  }
  if (count > 1) {
    return Effect.fail(new DuplicateSpawnPlayerError({ count })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatDuplicateSpawnPlayer(error)))),
    );
  }
  return Effect.void;
}

// Point d'entrée.

/** Résultat brut de la construction, AVANT emballage en `LevelHandle` public
 * (qui ajoute `dispose()`, lié à un `Scope` géré par l'appelant — voir
 * `acquireLevelResourceEffect`/`toLevelHandle`). `bodies` est gardé ici, pas
 * dans `LevelStats`, parce que c'est une donnée de CYCLE DE VIE (nécessaire à
 * la libération), pas une statistique destinée à `main.ts`/`DebugPanel`. */
interface LevelResource extends Omit<LevelHandle, "dispose"> {
  readonly bodies: readonly RAPIER.RigidBody[];
}

/**
 * Construit un `LevelResource` à partir d'un résultat `GLTFLoader` déjà
 * parsé. Effect PURE côté entrée/sortie (aucun accès réseau/DOM) —
 * réutilisable depuis `loadLevelEffect` (navigateur) ou un harnais Node
 * headless qui appelle `GLTFLoader.parse` sur des octets lus par `fs`.
 *
 * `root.traverse` (callback synchrone) est collecté dans un tableau AVANT le
 * `Effect.gen` principal, parcouru ensuite par un `for` classique DANS le
 * générateur — un seul style de composition Effect pour toute la fonction.
 */
function buildLevelResourceEffect(
  gltf: GLTF,
  scene: THREE.Scene,
  physics: PhysicsWorld,
): Effect.Effect<LevelResource> {
  return Effect.gen(function* () {
    const root = gltf.scene;
    scene.add(root);
    // Un seul passage sur tout le sous-arbre AVANT toute lecture de matrixWorld.
    // see: docs/pipeline/niveau-blender.md#extraction-et-le-piège-des-transforms
    root.updateWorldMatrix(true, true);

    const nodes: THREE.Object3D[] = [];
    root.traverse((obj) => nodes.push(obj));

    const bodies: RAPIER.RigidBody[] = [];

    let spawnPlayer: SpawnPoint | null = null;
    let spawnPlayerCount = 0;
    const spawnSuits: NamedSpawn[] = [];
    const lights: THREE.PointLight[] = [];
    const spawnDirectors: NamedSpawn[] = [];
    const triggers: TriggerVolume[] = [];
    const doors: DoorInfo[] = [];
    const props: PropInfo[] = [];
    const vitreCandidates: VitreCandidate[] = [];
    const sanitaireCandidates: SanitaireCandidate[] = [];
    const useObjects: UseObject[] = [];
    const secrets: SecretZone[] = [];

    let colliderCount = 0;
    const colliderKindCounts = { cuboid: 0, convexHull: 0, trimesh: 0 };
    let unprefixedMeshCount = 0;

    // Un mesh sous une porte, un prop physique ou un objet interactif, ou visé
    // par une animation, bouge ou doit rester adressable : il ne rejoint jamais
    // un lot fusionné.
    const movableRoots = new Set(
      nodes.filter((o) => {
        const n = blenderName(o);
        return n.startsWith("door_") || n.startsWith("use_") || n.startsWith("prop_");
      }),
    );
    const animatedNodeNames = new Set(
      gltf.animations.flatMap((clip) => clip.tracks.map((t) => THREE.PropertyBinding.parseTrackName(t.name).nodeName)),
    );
    const isMovable = (obj: THREE.Object3D): boolean => {
      for (let o: THREE.Object3D | null = obj; o && o !== root; o = o.parent) {
        if (movableRoots.has(o) || animatedNodeNames.has(o.name)) return true;
      }
      return false;
    };
    const decorCandidates: THREE.Mesh[] = [];

    for (const obj of nodes) {
      // Nom "tel que tapé dans Blender", PAS `obj.name` — voir `blenderName`.
      const name = blenderName(obj);

      // Empties : jamais un THREE.Mesh, traités avant le filtre `instanceof`.
      if (name === "spawn_player") {
        spawnPlayerCount++;
        if (spawnPlayerCount === 1) spawnPlayer = extractSpawnPoint(obj);
        continue;
      }
      if (name.startsWith("spawn_suit_")) {
        const position = new THREE.Vector3();
        obj.getWorldPosition(position);
        spawnSuits.push({ name, position });
        continue;
      }
      if (name.startsWith("light_")) {
        // Attachée à `root` et non à la scène : elle disparaît avec le niveau,
        // comme tout le reste du `.glb`.
        lights.push(buildLevelLight(obj, name));
        continue;
      }
      if (name.startsWith("spawn_director_")) {
        const position = new THREE.Vector3();
        obj.getWorldPosition(position);
        spawnDirectors.push({ name, position });
        continue;
      }

      if (!(obj instanceof THREE.Mesh)) continue;

      // Invariant #5 (+ #4) : AVANT toute autre chose, pour CHAQUE mesh, préfixé ou non.
      convertToLambert(obj);

      // Sous-préfixes de `col_*` testés AVANT le `col_` générique ci-dessous :
      // sinon `"col_box_test".startsWith("col_")` (vrai aussi) fait tomber le
      // routage dans le mauvais cas, silencieusement.
      if (name.startsWith("col_box_")) {
        buildCuboidCollider(obj, physics, bodies);
        colliderCount++;
        colliderKindCounts.cuboid++;
        obj.visible = false;
        continue;
      }

      if (name.startsWith("col_hull_")) {
        const kind = yield* buildConvexHullColliderSafe(obj, name, physics, bodies);
        if (kind) {
          colliderCount++;
          colliderKindCounts[kind]++;
        }
        obj.visible = false;
        continue;
      }

      if (name.startsWith("col_mesh_")) {
        // Alias explicite du dernier recours (trimesh) — aucune nouvelle
        // logique, juste un branchement nommé plutôt qu'un fallthrough
        // implicite dans le `col_*` générique.
        const created = yield* buildStaticColliderSafe(obj, name, "col_*", physics, bodies);
        if (created) {
          colliderCount++;
          colliderKindCounts.trimesh++;
        }
        obj.visible = false;
        continue;
      }

      if (name.startsWith("col_")) {
        // Rétrocompatibilité (Zones A/B) : trimesh, sauf boîte détectée -> cuboid.
        // see: docs/pipeline/niveau-blender.md#hiérarchie-des-colliders
        if (isAxisAlignedBox(obj.geometry)) {
          buildCuboidCollider(obj, physics, bodies);
          colliderCount++;
          colliderKindCounts.cuboid++;
        } else {
          const created = yield* buildStaticColliderSafe(obj, name, "col_*", physics, bodies);
          if (created) {
            colliderCount++;
            colliderKindCounts.trimesh++;
          }
        }
        obj.visible = false;
        continue;
      }

      if (name.startsWith("trig_")) {
        const trigger = yield* buildTriggerSafe(obj, name, physics, bodies);
        if (trigger) triggers.push(trigger);
        obj.visible = false;
        continue;
      }

      if (name.startsWith("door_")) {
        doors.push(yield* buildDoorEffect(obj, name, root, physics, bodies, gltf.animations));
        continue; // reste visible : c'est un panneau de décor animé, pas un volume logique
      }

      if (name.startsWith("vitre_")) {
        vitreCandidates.push(yield* buildVitreCandidateEffect(obj, name, physics, bodies));
        continue; // reste visible : le rendu de la vitre EST son mesh, fusionné plus bas comme le décor
      }

      if (name.startsWith("sanitaire_")) {
        sanitaireCandidates.push(yield* buildSanitaireCandidateEffect(obj, name, physics, bodies));
        continue; // reste visible : le rendu du sanitaire EST son mesh, fusionné plus bas comme le décor
      }

      if (name.startsWith("prop_")) {
        props.push(yield* buildPropEffect(obj, name, root, physics, bodies));
        continue; // reste visible : un prop EST son rendu, il n'a pas de proxy séparé
      }

      if (name.startsWith("use_")) {
        useObjects.push(yield* buildUseObjectEffect(obj, name));
        continue; // reste visible (objet interactif physique, ex. un terminal)
      }

      if (name.startsWith("secret_")) {
        secrets.push(buildSecretZone(obj, name));
        obj.visible = false; // volume logique, comme trig_*
        continue;
      }

      // Mesh sans préfixe reconnu : rendu tel quel, SANS collider,
      // SILENCIEUSEMENT — comportement voulu, ne rien logger ici.
      unprefixedMeshCount++;
      if (!isMovable(obj)) decorCandidates.push(obj);
    }

    yield* validateSpawnPlayerCountEffect(spawnPlayerCount);

    for (const light of lights) root.add(light);

    const decor = mergeStaticDecor(root, decorCandidates);
    // Fusion DÉDIÉE des vitres (voir `mergeVitreDecor`) : contrairement au
    // reste du décor, chaque vitre doit garder sa propre plage de sommets
    // adressable pour se casser individuellement sans jamais coûter un lot de
    // dessin de plus (voir `LevelStats.vitreBatchCount`).
    const vitreMerge = mergeVitreDecor(root, vitreCandidates);
    // Fusion DÉDIÉE des sanitaires (voir `mergeSanitaireDecor`) : même raison
    // exacte que les vitres — chaque sanitaire garde sa propre plage de
    // sommets adressable pour se casser individuellement (voir
    // `LevelStats.sanitaireBatchCount`).
    const sanitaireMerge = mergeSanitaireDecor(root, sanitaireCandidates);
    // Vantaux regroupés par matériau (voir `batchDoorMeshes`) : un vantail
    // animé ne rejoint jamais le décor fusionné, mais vingt vantaux n'ont pas
    // à coûter vingt lots de dessin.
    const doorBatchCount = batchDoorMeshes(root, doors);

    const stats: LevelStats = {
      colliderCount,
      colliderKindCounts,
      spawnSuitCount: spawnSuits.length,
      spawnDirectorCount: spawnDirectors.length,
      triggerCount: triggers.length,
      doorCount: doors.length,
      useCount: useObjects.length,
      secretCount: secrets.length,
      unprefixedMeshCount,
      decorBatchCount: unprefixedMeshCount - decor.mergedMeshCount + decor.batchCount,
      lightCount: lights.length,
      propCount: props.length,
      vitreCount: vitreMerge.vitres.length,
      vitreBatchCount: vitreMerge.batchCount,
      doorBatchCount,
      sanitaireCount: sanitaireMerge.sanitaires.length,
      sanitaireBatchCount: sanitaireMerge.batchCount,
    };

    return {
      root,
      gltf,
      spawnPlayer,
      spawnSuits,
      spawnDirectors,
      triggers,
      doors,
      props,
      vitres: vitreMerge.vitres,
      sanitaires: sanitaireMerge.sanitaires,
      sanitaireRendus: sanitaireMerge.rendus,
      useObjects,
      secrets,
      lights,
      stats,
      bodies,
    };
  });
}

/** Fonction de RELEASE pour `Effect.acquireRelease` (voir
 * `acquireLevelResourceEffect`) — appelée exactement une fois par `Scope`. */
function disposeLevelResource(resource: LevelResource, scene: THREE.Scene, physics: PhysicsWorld): void {
  scene.remove(resource.root);
  for (const body of resource.bodies) physics.world.removeRigidBody(body); // retire aussi les colliders attachés
  resource.root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    // Un lot de vantaux porte aussi ses textures de matrices et d'indirection.
    if (obj instanceof THREE.BatchedMesh) obj.dispose();
    obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      const lambert = mat as THREE.MeshLambertMaterial;
      lambert.map?.dispose();
      lambert.dispose();
    }
  });
}

/** `buildLevelFromGltfEffect`/`loadLevelEffect` fournissent chacun un
 * `Scope` GÉRÉ MANUELLEMENT (pas `Effect.scoped`, qui le fermerait —donc
 * libérerait le niveau — immédiatement après sa construction) : le niveau
 * doit rester vivant jusqu'à un appel explicite à `dispose()`.
 * see: docs/pipeline/niveau-blender.md#cycle-de-vie-du-levelhandle */
function acquireLevelResourceEffect(
  gltf: GLTF,
  scene: THREE.Scene,
  physics: PhysicsWorld,
): Effect.Effect<LevelResource, never, Scope.Scope> {
  return Effect.acquireRelease(buildLevelResourceEffect(gltf, scene, physics), (resource) =>
    Effect.sync(() => disposeLevelResource(resource, scene, physics)),
  );
}

/** Emballe un `LevelResource` acquis sous `scope` en `LevelHandle` public :
 * `dispose()` ferme CE `scope` précis (créé manuellement par l'appelant, voir
 * `buildLevelFromGltfEffect`/`loadLevelEffect`), ce qui déclenche le
 * finalizer enregistré par `acquireLevelResourceEffect`. */
function toLevelHandle(resource: LevelResource, scope: Scope.Closeable): LevelHandle {
  return {
    root: resource.root,
    gltf: resource.gltf,
    spawnPlayer: resource.spawnPlayer,
    spawnSuits: resource.spawnSuits,
    spawnDirectors: resource.spawnDirectors,
    triggers: resource.triggers,
    doors: resource.doors,
    props: resource.props,
    vitres: resource.vitres,
    sanitaires: resource.sanitaires,
    sanitaireRendus: resource.sanitaireRendus,
    useObjects: resource.useObjects,
    secrets: resource.secrets,
    lights: resource.lights,
    stats: resource.stats,
    dispose: () => GameRuntime.runSync(Scope.close(scope, Exit.void)),
  };
}

/**
 * Version Effect de `buildLevelFromGltf`, exportée UNIQUEMENT pour les
 * tests (`@effect/vitest`) — `main.ts` n'importe jamais ce nom.
 * see: docs/pipeline/niveau-blender.md#cycle-de-vie-du-levelhandle
 */
export function buildLevelFromGltfEffect(
  gltf: GLTF,
  scene: THREE.Scene,
  physics: PhysicsWorld,
): Effect.Effect<LevelHandle> {
  return Effect.gen(function* () {
    const scope = Scope.makeUnsafe();
    const resource = yield* acquireLevelResourceEffect(gltf, scene, physics).pipe(Scope.provide(scope));
    return toLevelHandle(resource, scope);
  });
}

/**
 * Construit un `LevelHandle` à partir d'un résultat `GLTFLoader` déjà parsé.
 * Fonction PURE côté entrée/sortie (aucun accès réseau/DOM) — utilisable
 * aussi bien depuis `loadLevel` (navigateur) qu'un harnais Node headless
 * qui appelle `GLTFLoader.parse` sur des octets lus par `fs`. Synchrone, ne
 * suspend jamais (`GameRuntime.runSync` ne peut donc jamais déclencher son
 * garde-fou de suspension ici).
 */
export function buildLevelFromGltf(gltf: GLTF, scene: THREE.Scene, physics: PhysicsWorld): LevelHandle {
  return GameRuntime.runSync(buildLevelFromGltfEffect(gltf, scene, physics));
}

/** Version Effect de `loadLevel`, réservée aux tests comme
 * `buildLevelFromGltfEffect`. Seule fonction de ce fichier dont le canal
 * d'erreur n'est PAS `never` — voir la doc de `LevelFetchError`. */
export function loadLevelEffect(
  url: string,
  scene: THREE.Scene,
  physics: PhysicsWorld,
  onProgress?: (fraction: number) => void,
): Effect.Effect<LevelHandle, LevelFetchError> {
  return Effect.gen(function* () {
    const loader = new GLTFLoader();
    const gltf = yield* Effect.tryPromise({
      try: () =>
        loader.loadAsync(url, (event) => {
          // `total` vaut 0 si le serveur n'annonce pas de `Content-Length`
          // (réponse en flux, compression à la volée) : dans ce cas on ne
          // sait rien, et mentir vaut moins que se taire.
          if (onProgress && event.total > 0) onProgress(event.loaded / event.total);
        }),
      catch: (cause) => new LevelFetchError({ url, cause }),
    });
    return yield* buildLevelFromGltfEffect(gltf, scene, physics);
  });
}

/**
 * Charge un `.glb`/`.gltf` par URL et construit son `LevelHandle`. Seule
 * fonction de ce fichier qui touche le réseau — `buildLevelFromGltf`
 * au-dessus reste testable hors navigateur. Rejette avec `LevelFetchError`
 * en cas d'échec réseau/parsing (`hotReload.ts`, seul appelant, la rattrape).
 */
export async function loadLevel(
  url: string,
  scene: THREE.Scene,
  physics: PhysicsWorld,
  onProgress?: (fraction: number) => void,
): Promise<LevelHandle> {
  return GameRuntime.runPromise(loadLevelEffect(url, scene, physics, onProgress));
}
