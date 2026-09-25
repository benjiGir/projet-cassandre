import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { PhysicsWorld } from "../../physics/world";
import type { LevelSession } from "../level/hotReload";
import type { LevelDef } from "../level/levels";
import type { NavGraph } from "../level/pathfinding";
import type { PropSystem } from "../level/props";
import type { DoorSystem } from "../level/doors";
import type { VitreSystem } from "../level/vitres";
import type { SanitaireSystem } from "../level/sanitaires";
import { type SessionStats } from "./score";
import { type BillboardSprite } from "../../render/billboard";
import { type DirectorManager } from "../entities/directorManager";
import { type SuitManager } from "../entities/suitManager";
import { type PlayerController } from "../player/controller";
import { type WeaponSystem } from "../player/weapons";
import { type LightPool } from "../../render/lightPool";
import { type LoyaltyCard } from "../player/loyaltyCards";

/** Suivi de franchissement de `door_e_exit` — voir `game/session/doors.ts::setupExitDoorTracking`. */
export interface ExitDoorTracking {
  /** Position MONDE du vantail au moment du déverrouillage (X/Z stables ensuite — seul le glissement cosmétique en Y bouge le corps, voir `OpeningDoor`). */
  doorPosition: THREE.Vector3;
  /** Direction MONDE unitaire perpendiculaire au plan du vantail (axe de franchissement) — voir `setupExitDoorTracking` pour la dérivation par rotation réelle du corps. */
  crossingAxis: THREE.Vector3;
  insideSign: 1 | -1;
  /** Demi-épaisseur LOCALE le long de l'axe choisi — valide malgré la rotation : c'est une longueur, pas une position. */
  halfExtentOnAxis: number;
}

/**
 * TOUT l'état d'UNE PARTIE — ce qui est détruit et reconstruit à chaque
 * `bootGameSession`/`teardownGameSession`. Ce qui reste vivant à travers un
 * reset vit sur `GameEngine` (`gameEngine.ts`), pas ici.
 * see: docs/systems/session.md#létat-propre-à-une-partie-gamesession
 */
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

  /** Session de niveau glTF (chemin "gltf" seulement) — `LevelSession.dispose()` (via `.stop()`) gère déjà lui-même le retrait de sa géométrie de `scene` et la libération GPU (voir `loader.ts::disposeLevelResource`), donc `teardownGameSession` n'a qu'à appeler `.stop()`. */
  gltfLevelSession: LevelSession | null;
  /** Invalide une installation de niveau différée (changement console ou
   * teardown) avant qu'elle puisse publier une session sur un monde libéré. */
  levelLoadGeneration: number;
  /** Graphe de praticabilité (Jalon M4) du niveau COURANT — rebaké à chaque préparation validée, voir `game/session/spawning.ts::loadGltfLevel`. */
  currentNavGraph: NavGraph | null;
  /** Pool de lampes du niveau COURANT (`null` tant qu'aucun niveau glTF n'est chargé, et sur le chemin "gym" qui n'a pas de `light_*`) — reconstruit à chaque commit, comme `currentNavGraph`. */
  lightPool: LightPool | null;
  /** Mobilier physique (`prop_*`) du niveau COURANT — PV et destructions de
   * CETTE partie. Reconstruit à chaque commit, comme `currentNavGraph` et
   * `lightPool` : un hot reload rend leurs PV aux props, exactement comme il
   * rend le niveau à son état de fichier.
   * see: docs/systems/physique.md#props-dynamiques */
  propSystem: PropSystem | null;
  /** Portes animées (`door_*`) du niveau COURANT — reconstruites à chaque
   * commit, comme `propSystem`. Remplace l'ancien `openingDoor` (une
   * seule porte à la fois) : voir [ADR 0031](../../../docs/decisions/0031-portes-animees-et-vitres.md).
   * see: docs/reference/conventions-nommage.md#portes-animées */
  doorSystem: DoorSystem | null;
  /** Vitrages (`vitre_*`) du niveau COURANT — PV et casses de CETTE partie,
   * reconstruits à chaque commit, comme `propSystem`/`doorSystem`.
   * see: docs/reference/conventions-nommage.md#préfixe-vitre */
  vitreSystem: VitreSystem | null;
  /** Sanitaires (`sanitaire_*`) du niveau COURANT — état de casse de CETTE
   * partie, reconstruit à chaque commit comme `vitreSystem`.
   * see: docs/reference/conventions-nommage.md#préfixe-sanitaire */
  sanitaireSystem: SanitaireSystem | null;
  /**
   * Délai de gameplay restant, en SECONDES, avant le prochain soulagement
   * possible sur un sanitaire intact (règle Duke 3D : max/10 PV, 220 s de
   * délai GLOBAL, partagé par tous les sanitaires du niveau — un seul
   * compteur, pas un par appareil). Décrémenté au pas fixe par `gameplayDt`
   * (hitstop inclus, jamais `Date.now()`/temps mural — invariant #1/#13),
   * jamais par la casse d'un sanitaire ni un hot reload : c'est un état de
   * PARTIE, remis à 0 par `bootGameSession`.
   * see: docs/decisions/0032-sanitaires-utilisables.md
   */
  sanitaireReliefCooldown: number;

  /** Carte lâchée par le Directeur : mesh visible tant qu'elle n'a pas été ramassée — voir `game/loop/updateGameplay.ts`. */
  droppedCardMesh: THREE.Mesh | null;
  /** Cartes de fidélité en poche — les clés du niveau v2 (jalon N7). Survit
   * à un hot reload, comme le faisait le badge : c'est un état de PARTIE, pas
   * de niveau chargé.
   * see: docs/reference/conventions-nommage.md#cartes-de-fidélité */
  cards: Set<LoyaltyCard>;

  unlockedDoors: Set<string>;
  exitDoorTracking: ExitDoorTracking | null;
  /** Secrets déjà trouvés CETTE partie — `WeakSet` par référence de mesh, voir sa doc historique dans `game/loop/updateGameplay.ts`. */
  foundSecrets: WeakSet<THREE.Object3D>;

  /**
   * Dernier point où le joueur touchait le sol. Sert de filet : un niveau
   * construit sans y jouer finit toujours par avoir un trou, et une chute
   * hors du monde est sans retour (rien ne rattrape le joueur, la partie est
   * perdue sans écran de mort). Voir `RESCUE_FALL_DEPTH` dans
   * `game/loop/updateGameplay.ts`.
   */
  lastSafeGround: THREE.Vector3;

  /** PV courants du joueur, suivis localement — `setPlayerHp` prend une valeur absolue (voir `game/state.ts`), `game/session`/`game/loop` sont les seuls endroits qui connaissent le dégât infligé. */
  playerHp: number;
  firstKillTriggered: boolean;
  lowHpLineTriggered: boolean;
  /** Idempotence de `game/session/feedback.ts::applyPlayerDamage` — voir sa doc. */
  deathHandled: boolean;
  /** Idempotence de `game/session/doors.ts::triggerLevelComplete` — voir sa doc. */
  levelCompleteHandled: boolean;
  /** Cooldown global des répliques du héros (15 s) — PROPRE À CETTE PARTIE : une réplique juste avant la mort ne doit pas geler le canal de la partie suivante. */
  lastHeroLineAt: number;
  /**
   * Générateur RNG DÉDIÉ au choix de la réplique de soulagement des
   * sanitaires (`game/session/sanitaires.ts`) — invariant #12, jamais
   * `Math.random()` : la réplique est choisie DANS le pas fixe (un appui sur
   * E), donc le rejeu d'input en dépend. Construit UNE FOIS par partie
   * (`bootGameSession`, via `DeterministicRandom.forSeed`), même pattern que
   * `WeaponSystem.nextRandom`.
   */
  sanitaireReliefRandom: () => number;

  /**
   * Récap de fin de partie (`game/session/score.ts`) — compteurs avancés AU
   * PAS FIXE (`game/loop/updateGameplay.ts`), jamais par un évènement lu au
   * taux d'affichage (invariants #1/#12/#13). Remis à zéro à chaque
   * `bootGameSession`, comme le reste de cet objet.
   * see: docs/systems/session.md#récapitulatif-de-fin-de-partie
   */
  stats: SessionStats;
}
