import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { PhysicsWorld } from "../../physics/world";
import type { LevelSession } from "../level/loading/hotReload";
import type { LevelDef } from "../level/catalog/levels";
import type { NavGraph } from "../level/navigation/pathfindingTypes";
import type { LevelSpaceData } from "../level/navigation/levelSpaces";
import type { PropSystem } from "../level/props/props";
import type { DoorSystem } from "../level/doors/doors";
import type { VitreSystem } from "../level/interactions/vitres";
import type { SanitaireSystem } from "../level/sanitaires/sanitaires";
import type { EcranSystem } from "../level/interactions/ecrans";
import type { CameraViewSystem } from "../level/interactions/cameras";
import { type SessionStats } from "./progression/score";
import { type BillboardSprite } from "../../render/sprites/billboard";
import { type DirectorManager } from "../entities/director/directorManager";
import { type SuitManager } from "../entities/suit/suitManager";
import { type PlayerController } from "../player/movement/controller";
import { type WeaponSystem } from "../player/weapons/weapons";
import { type LightPool } from "../../render/environment/lightPool";
import type { WeaponPickupBillboard } from "../../render/pickups/pickups";
import type { PickupResources } from "../../render/pickups/pickupResources";
import type { CardPickupBillboard } from "../../render/pickups/cardPickups";
import { type LoyaltyCard } from "../player/loyaltyCards";
import type { HeroLineId } from "./presentation/heroLines";
import type { LevelScriptState, ScriptTrigger } from "../level/scripting/levelScript";
import type { StreamState } from "./stream/streamSim";
import type { HeroPortrait } from "./presentation/heroPortrait";
import type { PlaceLineState } from "./player/placeLines";
/** Suivi de franchissement de `door_e_exit` — voir `game/session/progression/doors.ts::setupExitDoorTracking`. */
export interface ExitDoorTracking {
  /** Position MONDE du vantail au moment du déverrouillage (X/Z stables ensuite — seul le glissement cosmétique en Y bouge le corps, voir `OpeningDoor`). */
  doorPosition: THREE.Vector3;
  /** Direction MONDE unitaire perpendiculaire au plan du vantail (axe de franchissement) — voir `setupExitDoorTracking` pour la dérivation par rotation réelle du corps. */
  crossingAxis: THREE.Vector3;
  insideSign: 1 | -1;
  /** Demi-épaisseur LOCALE le long de l'axe choisi — valide malgré la rotation : c'est une longueur, pas une position. */
  halfExtentOnAxis: number;
}

// see: docs/archive/systems-session.md#létat-propre-à-une-partie-gamesession
export interface GameSession {
  /** Niveau/chemin de boot utilisé pour CETTE partie — permet à "Rejouer" de reconstruire EXACTEMENT le même choix. */
  choice: LevelDef;

  physics: PhysicsWorld;
  player: PlayerController;
  weapons: WeaponSystem;

  suitManager: SuitManager;
  /** Un `BillboardSprite` par Costard vivant/cadavre, voir `game/session/spawning.ts::spawnSuitAt`. */
  suitSprites: Map<number, BillboardSprite>;
  directorManager: DirectorManager;
  directorSprites: Map<number, BillboardSprite>;

  /** Racine Three.js de la gym (chemin "gym" SEULEMENT, `null` sur le chemin "gltf") — voir la doc de `buildGym`. Un seul `scene.remove(gymRoot)` au teardown retire TOUTE la géométrie de la gym (murs, rampes, marches...) ET la balle de test (posée en enfant de ce groupe, voir `game/session/lifecycle.ts::bootGameSession`), sans qu'aucun code de `gym.ts` n'ait besoin de retourner la liste de ce qu'il a créé. */
  gymRoot: THREE.Group | null;
  /** Balle de test (témoin de collision dynamique), chemin "gym" seulement — enfant de `gymRoot`, voir ci-dessus. */
  ballMesh: THREE.Mesh | null;
  ballBody: RAPIER.RigidBody | null;

  /** Session de niveau glTF (chemin "gltf" seulement) — `LevelSession.dispose()` (via `.stop()`) gère déjà lui-même le retrait de sa géométrie de `scene` et la libération GPU (voir `levelResources.ts::LevelResources`), donc `teardownGameSession` n'a qu'à appeler `.stop()`. */
  gltfLevelSession: LevelSession | null;
  /** Invalide une installation de niveau différée (changement console ou
   * teardown) avant qu'elle puisse publier une session sur un monde libéré. */
  levelLoadGeneration: number;
  /** Graphe de praticabilité (Jalon M4) du niveau COURANT — rebaké à chaque préparation validée, voir `game/session/spawning.ts::loadGltfLevel`. */
  currentNavGraph: NavGraph | null;
  /** Espaces du niveau COURANT (plan de masse et sous-zones `trig_*`), triés pour `levelSpaceAt` — `null` si le niveau n'en a aucun. */
  levelSpaces: readonly LevelSpaceData[] | null;
  /** Réplique de première visite par espace du niveau COURANT. */
  placeLines: ReadonlyMap<string, HeroLineId>;
  /** `trig_*` du niveau COURANT qui lancent un scénario. */
  scriptTriggers: readonly ScriptTrigger[];
  /** Déclencheurs franchis et scénarios en cours de CETTE partie — voir `level/scripting/levelScript.ts`. */
  levelScript: LevelScriptState;
  /** Pool de lampes du niveau COURANT (`null` tant qu'aucun niveau glTF n'est chargé, et sur le chemin "gym" qui n'a pas de `light_*`) — reconstruit à chaque commit, comme `currentNavGraph`. */
  lightPool: LightPool | null;
  // see: docs/archive/systems-physique.md#props-dynamiques
  propSystem: PropSystem | null;
  // see: docs/archive/reference-conventions-nommage.md#portes-animées
  doorSystem: DoorSystem | null;
  /** Vitrages (`vitre_*`) du niveau COURANT — PV et casses de CETTE partie,
   * reconstruits à chaque commit, comme `propSystem`/`doorSystem`.
   * see: docs/archive/reference-conventions-nommage.md#préfixe-vitre */
  vitreSystem: VitreSystem | null;
  /** Sanitaires (`sanitaire_*`) du niveau COURANT — état de casse de CETTE
   * partie, reconstruit à chaque commit comme `vitreSystem`.
   * see: docs/archive/reference-conventions-nommage.md#préfixe-sanitaire */
  sanitaireSystem: SanitaireSystem | null;
  /** Écrans (`ecran_*`) du niveau COURANT — état de partie (PV, frame,
   * casse), reconstruit à chaque commit comme `vitreSystem`.
   * see: docs/archive/reference-conventions-nommage.md#préfixe-ecran */
  ecranSystem: EcranSystem | null;
  /** Vue par caméra du niveau COURANT (console `use_*`/`cam_*`) — état de
   * partie (console active, index courant), reconstruit à chaque commit
   * comme `ecranSystem`. */
  cameraView: CameraViewSystem | null;
  // see: docs/archive/systems-rendu.md#armes-au-sol-2026-09-25
  /** Ressources partagées des ramassages, détenues jusqu’à l’arrêt de cette session. */
  pickupResources: PickupResources | null;
  weaponPickupBillboards: WeaponPickupBillboard[];
  /** Cartes du niveau, reconstruites au chargement et animées à l'affichage. */
  cardPickupBillboards: CardPickupBillboard[];
  // see: docs/decisions/0032-sanitaires-utilisables.md
  sanitaireReliefCooldown: number;

  /** Billboard autonome de la carte lâchée par le Directeur. */
  droppedCardBillboard: CardPickupBillboard | null;
  // see: docs/archive/reference-conventions-nommage.md#cartes-de-fidélité
  cards: Set<LoyaltyCard>;

  unlockedDoors: Set<string>;
  exitDoorTracking: ExitDoorTracking | null;
  /** Secrets déjà trouvés CETTE partie — `WeakSet` par référence de mesh, voir sa doc historique dans `game/loop/updateGameplay.ts`. */
  foundSecrets: WeakSet<THREE.Object3D>;
  secretsFound: number;
  secretsTotal: number;

  // see: docs/6-reference/notes-code-gameplay.md#session-et-moteur
  lastSafeGround: THREE.Vector3;

  /** PV courants du joueur, suivis localement — `setPlayerHp` prend une valeur absolue (voir `game/hud/state.ts`), `game/session`/`game/loop` sont les seuls endroits qui connaissent le dégât infligé. */
  playerHp: number;
  playerMaxHp: number;
  heroPortrait: HeroPortrait;
  firstKillTriggered: boolean;
  lowHpLineTriggered: boolean;
  /** Le direct : audience, abonnés, dons et chat de CETTE partie — voir `stream/streamSim.ts`. */
  stream: StreamState;
  /** Flux déterministe du direct, indépendant des FX, des armes et des ennemis. */
  streamRandom: () => number;
  /** Idempotence de `game/session/player/feedback.ts::applyPlayerDamage` — voir sa doc. */
  deathHandled: boolean;
  /** Idempotence de `game/session/progression/doors.ts::triggerLevelComplete` — voir sa doc. */
  levelCompleteHandled: boolean;
  /** Cooldown global des répliques du héros (15 s) — PROPRE À CETTE PARTIE : une réplique juste avant la mort ne doit pas geler le canal de la partie suivante. */
  lastHeroLineAt: number;
  /** Dernier cri court (douleur, réception), en ms de gameplay — voir `feedback.ts::triggerHeroBark`. */
  lastHeroBarkAt: number;
  /** Répliques déjà dites dans CETTE partie (règle `once` de `heroLines.ts`). */
  heroLinesSaid: Set<HeroLineId>;
  heroLineRandom: () => number;
  /** Suivi de la réplique de lieu en attente — voir `player/placeLines.ts`. */
  placeLine: PlaceLineState;

  // see: docs/archive/systems-session.md#récapitulatif-de-fin-de-partie
  stats: SessionStats;
}
