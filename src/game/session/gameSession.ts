import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { PhysicsWorld } from "../../physics/world";
import type { LevelSession } from "../level/hotReload";
import type { LevelDef } from "../level/levels";
import type { NavGraph } from "../level/pathfinding";
import { type BillboardSprite } from "../../render/billboard";
import { type DirectorManager } from "../entities/directorManager";
import { type SuitManager } from "../entities/suitManager";
import { type PlayerController } from "../player/controller";
import { type WeaponSystem } from "../player/weapons";

/**
 * Extraction du refactor de `main.ts` (2229 lignes → modules, 2026-09-05) :
 * `GameSession`/`OpeningDoor`/`ExitDoorTracking` vivaient à portée module
 * dans `main.ts` depuis le jalon M8 (`PLAN_EFFECT_XSTATE.md`, §10) — ce
 * fichier les déplace tels quels, sans changement de forme. Voir
 * `game/session/gameEngine.ts` pour le pendant PERSISTANT (`GameEngine`,
 * survit à un reset) — `GameSession` reste l'état PROPRE À UNE PARTIE,
 * détruit/reconstruit à chaque `bootGameSession`/`teardownGameSession`.
 */

/** Porte de sortie en cours de glissement cosmétique (voir la doc dans `game/loop/updateGameplay.ts`). */
export interface OpeningDoor {
  body: RAPIER.RigidBody;
  startY: number;
  targetY: number;
  t: number;
}

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
 * `bootGameSession`/`teardownGameSession` (Jalon M8). Ce qui N'EST PAS ici
 * (`scene`/`camera`/`renderer`, `clock`, `fx`/`viewmodel`/`crosshair`/
 * `hitmarker`/`ballisticsDebug`/`wireframeToggle`, `look`/`lookDelta`,
 * `interaction`, `input`/`inputRecorder`, tous les atlas/géométries/matériaux
 * partagés) RESTE VIVANT à travers un reset — voir `game/session/gameEngine.ts`
 * (`GameEngine`) pour la frontière exacte et sa justification.
 *
 * Avant ce jalon, TOUT ce qui suit vivait en variables locales de `main()`,
 * construites UNE SEULE FOIS au boot (`CLAUDE.md` documentait explicitement
 * qu'aucun chemin de reset n'existait — jugé disproportionné en Phase 6).
 * Ce jalon construit ce chemin ; `GameSession` est la structure qui le rend
 * possible : au lieu de ~20 variables mutables indépendantes de `main()`,
 * UN SEUL objet remplacé d'un bloc à chaque reset (`engine.session = ...`).
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
  /** Graphe de praticabilité (Jalon M4) du niveau COURANT — rebaké à chaque `onLoaded`, voir `game/session/spawning.ts::loadGltfLevel`. */
  currentNavGraph: NavGraph | null;

  /** Badge du Directeur : mesh visible tant qu'il n'a pas été ramassé — voir `game/loop/updateGameplay.ts`. */
  badgeMesh: THREE.Mesh | null;
  hasBadge: boolean;

  unlockedDoors: Set<string>;
  openingDoor: OpeningDoor | null;
  exitDoorTracking: ExitDoorTracking | null;
  /** Secrets déjà trouvés CETTE partie — `WeakSet` par référence de mesh, voir sa doc historique dans `game/loop/updateGameplay.ts`. */
  foundSecrets: WeakSet<THREE.Object3D>;

  /** PV courants du joueur, suivis localement — `setPlayerHp` prend une valeur absolue (voir `game/state.ts`), `game/session`/`game/loop` sont les seuls endroits qui connaissent le dégât infligé. */
  playerHp: number;
  firstKillTriggered: boolean;
  lowHpLineTriggered: boolean;
  /** Idempotence de `game/session/feedback.ts::handlePlayerHit` — voir sa doc. */
  deathHandled: boolean;
  /** Idempotence de `game/session/doors.ts::triggerLevelComplete` — voir sa doc. */
  levelCompleteHandled: boolean;
  /** Cooldown global des répliques du héros (15 s) — PROPRE À CETTE PARTIE : une réplique juste avant la mort ne doit pas geler le canal de la partie suivante. */
  lastHeroLineAt: number;
}
