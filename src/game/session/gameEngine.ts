import * as THREE from "three";

import { GameClock } from "../../core/loop/time";
import type { Recording } from "../../core/input/inputTypes";
import { createRenderer, INTERNAL_WIDTH, INTERNAL_HEIGHT } from "../../render/pipeline/renderer";
import { FxSystem } from "../../render/fx/fx";
import { UseObjectCulling } from "../../render/environment/useObjectCulling";
import { Viewmodel } from "../../render/viewmodel/viewmodel";
import type { WeaponModels } from "../../render/viewmodel/viewmodelTypes";
import type { CardPickupTextures } from "../../render/pickups/cardPickups";
import { createWireframeToggle } from "../../render/debug/debugView";
import { HitmarkerOverlay } from "../../render/overlays/hitmarker";
import { CrosshairOverlay } from "../../render/overlays/crosshair";
import { CameraViewOverlay } from "../../render/overlays/cameraView";
import { BallisticsDebugOverlay } from "../../render/debug/ballisticsDebug";
import type { EnemySpriteSheet } from "../../render/sprites/enemySpriteTypes";
import { weaponConfig } from "../player/weapons/weaponConfig";
import { moveConfig } from "../player/movement/moveConfig";
import { InteractionSystem } from "../level/interactions/interactive";
import type { GameFlowPort } from "./flowPort";
import type { GameSession } from "./gameSession";

// see: docs/archive/systems-session.md#létat-persistant-du-process-gameengine
export interface GameEngine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Port applicatif du flux d'écran, sans dépendance vers React ou XState. */
  flow: GameFlowPort;

  /** Horloge persistante dont l'état transitoire est remis à zéro à chaque boot. */
  clock: GameClock;
  /** Rendu de l'impact de tir (muzzle flash, decals, particules, douilles, screenshake) — voir `render/fx/fx.ts`. */
  fx: FxSystem;
  viewmodel: Viewmodel;
  /** Élagage par distance des `use_*` — PERSISTANT, comme `fx`/`viewmodel` : il ne retient que des références faibles (voir `render/environment/useObjectCulling.ts`). */
  useObjectCulling: UseObjectCulling;
  /** Géométries des armes, partagées par le viewmodel et les ramassages posés dans les niveaux. */
  weaponModels: WeaponModels;
  crosshair: CrosshairOverlay;
  hitmarker: HitmarkerOverlay;
  ballisticsDebug: BallisticsDebugOverlay;
  /** Bruit/scanlines/étiquette pendant une vue par caméra (chantier « Les
   * coulisses », système 4) — voir `render/overlays/cameraView.ts`. */
  cameraViewOverlay: CameraViewOverlay;

  /** Éclairage temps réel de la scène, réglé PAR NIVEAU (`LevelDef.lighting`) — voir `lifecycle.ts::applyLightRig`. */
  ambientLight: THREE.AmbientLight;
  sunLight: THREE.DirectionalLight;

  /** Planches de sprites, chargées une fois au démarrage et partagées par tous les ennemis de toutes les parties — chaque `BillboardSprite` clone l'atlas (voir « LE PIÈGE DU PARTAGE DE TEXTURE » dans `render/sprites/billboard.ts`). */
  suitSheet: EnemySpriteSheet;
  directorSheet: EnemySpriteSheet;
  rampantSheet: EnemySpriteSheet;
  vigileSheet: EnemySpriteSheet;
  /** Sources des trois cartes, préchargées avant la boucle de jeu. */
  cardPickupTextures: CardPickupTextures;

  /** Scratch de la balle de test (chemin "gym" seulement) — PARTAGÉ entre `loop/stepPhysics.ts` (écrit `ballCurr*` depuis la physique) et `loop/interpolateVisuals.ts` (lit `ballPrev*`/`ballCurr*` pour lerp/slerp). */
  ballPrevPos: THREE.Vector3;
  ballPrevQuat: THREE.Quaternion;
  ballCurrPos: THREE.Vector3;
  ballCurrQuat: THREE.Quaternion;

  /** Yaw/pitch de visée — mutés directement par `lifecycle.ts::bootGameSession` (respawn) et `spawning.ts::loadGltfLevel` (repositionnement sur `spawn_player`), jamais recréés en objet neuf : `loop/interpolateVisuals.ts` ferme dessus par référence. */
  look: { yaw: number; pitch: number };
  /** Delta souris agrégé depuis le dernier pas fixe, pour l'enregistrement. */
  lookDelta: { dx: number; dy: number };

  /** Debug visuel rétro : wireframe togglable à chaud (KeyV, voir `loop/updateFx.ts`) — PERSISTANT, re-traverse `scene` à chaque appel. */
  wireframeToggle: ReturnType<typeof createWireframeToggle>;
  /** Interaction (`use_*`, touche E) — UNE SEULE instance pour toute la durée de l'onglet, voir `game/level/interactions/interactive.ts`. */
  interaction: InteractionSystem;

  /** Session de partie COURANTE — remplace la variable mutable `currentSession` de `main()`. Réassigné par `lifecycle.ts::bootGameSession`/`replay`/`returnToMenu`, jamais par les fonctions qui construisent une NOUVELLE session (elles reçoivent cette nouvelle session en paramètre explicite tant qu'elle n'est pas encore devenue "la" session courante — voir la doc de `spawning.ts::spawnSuitAt`). */
  session: GameSession;

  /** Dernier enregistrement F9/F10 (`core/input/inputRecorder.ts`), pour rejeu (F10) et pour `window.cassandre.lastRecording`/`playRecording`. */
  lastRecording: Recording | null;
  /** FPS lissé, publié au `DebugPanel` (voir `loop/updateFx.ts`). */
  fpsSmoothed: number;
  /** Accumulateur temps réel pour le throttle 10 Hz de publication du `DebugPanel` (invariant #2). */
  debugAccumulator: number;
}

// see: docs/archive/systems-session.md#un-type-intermédiaire-pour-éviter-une-dépendance-circulaire-persistentengine
export type PersistentEngine = Omit<GameEngine, "session">;

// see: docs/archive/systems-session.md#savoir-si-le-monde-physique-est-vivant-isphysicssessionlive
export function isPhysicsSessionLive(engine: GameEngine): boolean {
  return engine.flow.isPhysicsLive();
}

export function buildGameEngine(
  canvas: HTMLCanvasElement,
  flow: GameFlowPort,
  sheets: { suit: EnemySpriteSheet; director: EnemySpriteSheet; rampant: EnemySpriteSheet; vigile: EnemySpriteSheet },
  weaponModels: WeaponModels,
  cardPickupTextures: CardPickupTextures,
): PersistentEngine {
  const scene = new THREE.Scene();
  // see: docs/6-reference/notes-code-gameplay.md#session-et-moteur
  const camera = new THREE.PerspectiveCamera(moveConfig.fovBase, INTERNAL_WIDTH / INTERNAL_HEIGHT, 0.1, 130);

  const renderer = createRenderer(canvas);

  scene.add(camera);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  // L'objet reste vivant à travers un reset ; `bootGameSession` remet son
  // temps écoulé et tout hitstop actif à zéro.
  const clock = new GameClock();
  const enemyAtlases = [sheets.suit, sheets.rampant, sheets.vigile].flatMap((sheet) =>
    Object.values(sheet.atlases).filter((atlas): atlas is THREE.Texture => atlas !== undefined),
  );
  const fx = new FxSystem(scene, enemyAtlases);
  const viewmodel = new Viewmodel(camera, weaponModels);
  const crosshair = new CrosshairOverlay(document.getElementById("app") as HTMLDivElement, weaponConfig);
  const hitmarker = new HitmarkerOverlay(document.getElementById("app") as HTMLDivElement, weaponConfig);
  const ballisticsDebug = new BallisticsDebugOverlay(scene);
  // Overlay de la vue par caméra (chantier « Les coulisses », système 4) :
  // même conteneur/canvas 2D que le réticule/hitmarker ci-dessus, voir
  // `render/overlays/cameraView.ts`.
  const cameraViewOverlay = new CameraViewOverlay(document.getElementById("app") as HTMLDivElement);

  const ballPrevPos = new THREE.Vector3();
  const ballPrevQuat = new THREE.Quaternion();
  const ballCurrPos = new THREE.Vector3(3, 4, 0);
  const ballCurrQuat = new THREE.Quaternion();

  const look = { yaw: 0, pitch: 0 };
  // Delta souris agrégé depuis le dernier pas fixe, pour l'enregistrement.
  const lookDelta = { dx: 0, dy: 0 };

  const wireframeToggle = createWireframeToggle(scene);

  const interaction = new InteractionSystem();

  return {
    scene,
    camera,
    renderer,
    flow,
    clock,
    fx,
    viewmodel,
    useObjectCulling: new UseObjectCulling(),
    weaponModels,
    crosshair,
    hitmarker,
    ballisticsDebug,
    cameraViewOverlay,
    ambientLight,
    sunLight: sun,
    suitSheet: sheets.suit,
    directorSheet: sheets.director,
    rampantSheet: sheets.rampant,
    vigileSheet: sheets.vigile,
    cardPickupTextures,
    ballPrevPos,
    ballPrevQuat,
    ballCurrPos,
    ballCurrQuat,
    look,
    lookDelta,
    wireframeToggle,
    interaction,
    lastRecording: null,
    fpsSmoothed: 60,
    debugAccumulator: 0,
  };
}
