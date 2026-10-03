import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { DoorInfo } from "../doors/doorTypes";
import type { PropInfo } from "../props/props";
import type { VitreInfo } from "../interactions/vitres";
import type { SanitaireInfo, SanitaireRendu } from "../sanitaires/sanitaires";
import type { EcranInfo } from "../interactions/ecrans";
import type { CamPoint } from "../interactions/cameras";
import type { FoodItem } from "../interactions/food";
import type { LoyaltyCard } from "../../player/loyaltyCards";
export interface SpawnPoint {
  /** Position MONDE, pieds du joueur (pas les yeux).
   * see: docs/archive/pipeline-niveau-blender.md#convention-spawn_player */
  position: THREE.Vector3;
  /** Yaw, radians. Convention `main.ts`/`gym.ts` (Euler 'YXZ') : yaw=0 -> avant = -Z. */
  yaw: number;
}

export interface NamedSpawn {
  name: string;
  /** Position MONDE, pieds (même convention que `SpawnPoint.position`). */
  position: THREE.Vector3;
  /** Custom property Blender `groupe` : l'ennemi n'apparaît qu'au réveil de ce groupe par le script de niveau. `null` = présent dès le chargement. */
  group: string | null;
}

export interface TriggerVolume {
  name: string;
  object: THREE.Object3D;
  // see: docs/6-reference/notes-code-gameplay-niveau.md#chargement-et-ressources
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
  targetName: string | null;
  /** Carte de fidélité DONNÉE par cet objet (custom property Blender `card`)
   * — en fait un ramassage, consommé au premier usage. `null` si absent.
   * see: docs/archive/reference-conventions-nommage.md#cartes-de-fidélité */
  grantsCard: LoyaltyCard | null;
  /** Carte de fidélité EXIGÉE par cet objet (custom property Blender
   * `requires`) pour agir sur sa cible. `null` = aucune condition.
   * see: docs/archive/reference-conventions-nommage.md#cartes-de-fidélité */
  requiresCard: LoyaltyCard | null;
  // see: docs/archive/reference-conventions-nommage.md#boîtes-de-munitions
  ammo: number | null;
  // see: docs/archive/reference-conventions-nommage.md#trousses-de-soin
  heals: number | null;
  // see: docs/6-reference/conventions-nommage.md#nourriture
  aliment: FoodItem | null;
  // see: docs/archive/reference-conventions-nommage.md#préfixe-cam
  cameras: readonly string[] | null;
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
  // see: docs/decisions/0030-props-dynamiques.md
  propCount: number;
  /** `vitre_*` rencontrées, cassables ou non. */
  vitreCount: number;
  // see: docs/decisions/0031-portes-animees-et-vitres.md
  vitreBatchCount: number;
  doorBatchCount: number;
  /** `sanitaire_*` rencontrés (cuvettes et urinoirs), cassés ou non. */
  sanitaireCount: number;
  // see: docs/decisions/0032-sanitaires-utilisables.md
  sanitaireBatchCount: number;
  /** `ecran_*` rencontrés (chantier « Les coulisses »), cassés ou non. */
  ecranCount: number;
  ecranBatchCount: number;
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
   * `PropSystem` (`game/level/props/props.ts`), reconstruit à chaque chargement.
   * see: docs/archive/reference-conventions-nommage.md#props-physiques */
  props: PropInfo[];
  /** Vitrages `vitre_*` — l'état de partie (PV, casse) vit dans `VitreSystem`
   * (`game/level/interactions/vitres.ts`), reconstruit à chaque chargement comme `PropSystem`.
   * see: docs/archive/reference-conventions-nommage.md#préfixe-vitre */
  vitres: VitreInfo[];
  // see: docs/archive/reference-conventions-nommage.md#préfixe-sanitaire
  sanitaires: SanitaireInfo[];
  /** Meshes RENDUS des sanitaires (lots fusionnés), élagués par distance comme les `use_*` — voir `SanitaireMergeResult.rendus`. */
  sanitaireRendus: SanitaireRendu[];
  /** Écrans `ecran_*` (chantier « Les coulisses ») — l'état de partie (PV,
   * frame courante, casse) vit dans `EcranSystem` (`game/level/interactions/ecrans.ts`),
   * reconstruit à chaque chargement comme `VitreSystem`. */
  ecrans: EcranInfo[];
  /** `cam_*` du niveau — points de vue fixes cyclés par une console
   * (`UseObject.cameras`), voir `game/level/interactions/cameras.ts::CameraViewSystem`. */
  cams: CamPoint[];
  // see: docs/decisions/0026-visibilite-par-espace-et-pool-de-lampes.md
  lights: THREE.PointLight[];
  stats: LevelStats;
  suspend(): () => void;
  // see: docs/archive/pipeline-niveau-blender.md#cycle-de-vie-du-levelhandle
  dispose(): void;
}
