import * as THREE from "three";
import type { createRoot } from "react-dom/client";

import { GameClock } from "../../core/time";
import { type Recording } from "../../core/inputRecorder";
import { createRenderer, INTERNAL_WIDTH, INTERNAL_HEIGHT } from "../../render/renderer";
import { FxSystem } from "../../render/fx";
import { Viewmodel } from "../../render/viewmodel";
import { createWireframeToggle } from "../../render/debugView";
import { HitmarkerOverlay } from "../../render/hitmarker";
import { CrosshairOverlay } from "../../render/crosshair";
import { BallisticsDebugOverlay } from "../../render/ballisticsDebug";
import { BILLBOARD_COLUMNS, createPlaceholderAtlas } from "../../render/billboard";
import { SUIT_ATLAS_ROWS } from "../entities/suit";
import { DIRECTOR_ATLAS_ROWS } from "../entities/director";
import { weaponConfig } from "../player/weaponConfig";
import { moveConfig } from "../player/moveConfig";
import { InteractionSystem } from "../level/interactive";
import { type GameFlowActor } from "../../ui/gameFlowMachine";
import type { GameSession } from "./gameSession";

/**
 * État PERSISTANT du process (construit une fois, survit à un reset de
 * partie) — pendant de `GameSession` (`gameSession.ts`), l'état PROPRE À
 * une partie.
 * see: docs/systems/session.md#létat-persistant-du-process-gameengine
 */
export interface GameEngine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Racine React de `#ui-root` — `App`/`LevelMenu`/`MainMenu`/`RebindScreen` s'y montent tour à tour. */
  root: ReturnType<typeof createRoot>;
  /** Acteur XState du flux d'écran (Jalon M8) — UN SEUL pour toute la durée de l'onglet, jamais recréé par `bootGameSession`/`replay`/`returnToMenu` (contrairement à `session`). */
  flowActor: GameFlowActor;

  /** PURE ACCUMULATEUR DE HITSTOP, aucun état de partie. */
  clock: GameClock;
  /** Rendu de l'impact de tir (muzzle flash, decals, particules, douilles, screenshake) — voir `render/fx.ts`. */
  fx: FxSystem;
  viewmodel: Viewmodel;
  crosshair: CrosshairOverlay;
  hitmarker: HitmarkerOverlay;
  ballisticsDebug: BallisticsDebugOverlay;

  /** Éclairage temps réel de la scène, réglé PAR NIVEAU (`LevelDef.bakedLighting`) — voir `lifecycle.ts::applyLightRig`. */
  ambientLight: THREE.AmbientLight;
  sunLight: THREE.DirectionalLight;

  /** Atlas UNIQUE, partagé par tous les Costards de toutes les parties — voir « LE PIÈGE DU PARTAGE DE TEXTURE » dans `render/billboard.ts`. */
  suitAtlas: THREE.Texture;
  directorAtlas: THREE.Texture;
  /** Géométrie/matériau du badge du Directeur, PARTAGÉS entre parties — seule l'instance de mesh (`session.badgeMesh`) est propre à une partie. */
  badgeGeometry: THREE.BoxGeometry;
  badgeMaterial: THREE.MeshLambertMaterial;

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
  /** Interaction (`use_*`, touche E) — UNE SEULE instance pour toute la durée de l'onglet, voir `game/level/interactive.ts`. */
  interaction: InteractionSystem;

  /** Session de partie COURANTE — remplace la variable mutable `currentSession` de `main()`. Réassigné par `lifecycle.ts::bootGameSession`/`replay`/`returnToMenu`, jamais par les fonctions qui construisent une NOUVELLE session (elles reçoivent cette nouvelle session en paramètre explicite tant qu'elle n'est pas encore devenue "la" session courante — voir la doc de `spawning.ts::spawnSuitAt`). */
  session: GameSession;

  /** Dernier enregistrement F9/F10 (`core/inputRecorder.ts`), pour rejeu (F10) et pour `window.cassandre.lastRecording`/`playRecording`. */
  lastRecording: Recording | null;
  /** FPS lissé, publié au `DebugPanel` (voir `loop/updateFx.ts`). */
  fpsSmoothed: number;
  /** Accumulateur temps réel pour le throttle 10 Hz de publication du `DebugPanel` (invariant #2). */
  debugAccumulator: number;
}

/**
 * `GameEngine` moins `session` — rompt un ordre de construction circulaire
 * entre `buildGameEngine` et la toute première `GameSession`.
 * see: docs/systems/session.md#un-type-intermédiaire-pour-éviter-une-dépendance-circulaire-persistentengine
 * see: docs/decisions/0014-gameengine-persistentengine-separes.md
 */
export type PersistentEngine = Omit<GameEngine, "session">;

/** Capsule Costard : demi-hauteur 0.5 + rayon 0.4 -> hauteur totale 1.8 m, choisie pour matcher EXACTEMENT `DEFAULT_HEIGHT` de `BillboardSprite` (voir `suitConfig.ts`) : `verticalAnchor: 0.5` fait donc coïncider le centre du sprite avec le centre de la capsule que `Suit` interpole, sans calcul de décalage supplémentaire. */
export const SUIT_SPRITE_HEIGHT = 1.8;
/** capsuleHalfHeight(0.6) + capsuleRadius(0.45) = 1.05 -> hauteur totale 2.1 m, même règle de correspondance exacte que `SUIT_SPRITE_HEIGHT`. */
export const DIRECTOR_SPRITE_HEIGHT = 2.1;

/**
 * `true` ssi le monde Rapier de `engine.session` est garanti vivant — pas
 * encore construit, ou déjà `free()`-é pendant la fenêtre transitoire de
 * `returnToMenu()`. À ne pas confondre avec la garde `flowActor`.
 * see: docs/systems/session.md#savoir-si-le-monde-physique-est-vivant-isphysicssessionlive
 * see: docs/decisions/0013-garde-flux-vs-monde-physique.md
 */
export function isPhysicsSessionLive(engine: GameEngine): boolean {
  const value = engine.flowActor.getSnapshot().value;
  return value === "playing" || value === "dead" || value === "levelComplete";
}

/**
 * Construit TOUT l'état PERSISTANT du jeu, appelée UNE SEULE FOIS par
 * `main()` avant le tout premier `bootGameSession`. Retourne
 * `PersistentEngine`, pas `GameEngine` : `session` n'existe pas encore.
 * see: docs/systems/session.md#létat-persistant-du-process-gameengine
 */
export function buildGameEngine(
  canvas: HTMLCanvasElement,
  root: ReturnType<typeof createRoot>,
  flowActor: GameFlowActor,
): PersistentEngine {
  const scene = new THREE.Scene();
  // Far plane : la gym expose une ligne de vue dégagée du fond de l'aile
  // plateformes (z ≈ -49.75) au mur de fond du couloir (z ≈ +65.75), soit
  // ~115.5 m à x≈0 (aucun obstacle sur cet axe : rampes/plateformes laissent
  // un couloir libre entre leurs voies). 100 m clippait cette vue ; 130 m
  // garde ~15 m de marge sans dégrader la précision du depth buffer sur un
  // niveau en boîtes.
  //
  // FOV : valeur de repos lue dans `moveConfig` (`fovBase`, 75° — inchangée),
  // parce qu'elle forme un couple avec `fovRunBoost` et n'a de sens qu'à côté
  // de lui. Elle est réévaluée à chaque frame dans `interpolateVisuals`.
  const camera = new THREE.PerspectiveCamera(moveConfig.fovBase, INTERNAL_WIDTH / INTERNAL_HEIGHT, 0.1, 130);

  const renderer = createRenderer(canvas);

  // Le viewmodel (`render/viewmodel.ts`) est un ENFANT de la caméra : sans
  // que la caméra fasse elle-même partie du graphe de scène, ses enfants ne
  // sont jamais traversés au rendu (three.js parcourt `scene`, pas
  // `camera`) — resteraient positionnés correctement mais invisibles. Ajout
  // sans effet de bord : une caméra n'a pas de géométrie propre à dessiner,
  // `camera.position`/`camera.quaternion` restent posés directement dans
  // `interpolateVisuals` comme avant.
  scene.add(camera);

  // Rig hérité de la phase « boîtes blanches » : il éclaire la gym, qui n'a
  // aucun bake. Un niveau dont l'éclairage est CUIT dans les sommets le
  // rallume une seconde fois — `LevelDef.bakedLighting` le neutralise alors,
  // voir `lifecycle.ts::applyLightRig`.
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  // `clock` : PURE ACCUMULATEUR DE HITSTOP, aucun état de partie (Jalon M8) —
  // reste vivant à travers un reset, jamais reconstruit par
  // `bootGameSession`/`teardownGameSession`.
  const clock = new GameClock();
  // Rendu de l'impact de tir (muzzle flash, decals, particules, douilles,
  // screenshake) et mesh d'arme affiché à l'écran — voir `render/fx.ts` et
  // `render/viewmodel.ts` pour les choix documentés. Purement cosmétiques :
  // aucun des deux ne touche au pas fixe ni à `weapons`/`player`. PERSISTANTS
  // (Jalon M8) : liés à `scene`/`camera`, pas à une partie en particulier.
  const fx = new FxSystem(scene);
  const viewmodel = new Viewmodel(camera);
  // Réticule permanent (retour playtest son, voir `render/crosshair.ts`) :
  // overlay canvas 2D indépendant de React, même conteneur/config que le
  // hitmarker ci-dessous. Construit AVANT le hitmarker pour que celui-ci soit
  // ajouté APRÈS dans le DOM — un flash de hit reste donc visuellement
  // au-dessus du réticule statique, jamais masqué par lui.
  const crosshair = new CrosshairOverlay(document.getElementById("app") as HTMLDivElement, weaponConfig);
  // Hitmarker (retour playtest Phase 3, voir `render/hitmarker.ts`) : overlay
  // canvas 2D indépendant de React, monté sur `#app` (même conteneur que
  // `canvas#game`/`#ui-root`). Reçoit `weaponConfig` directement — SOURCE
  // UNIQUE DE VÉRITÉ déjà tunable à chaud, aucune copie de config nécessaire.
  const hitmarker = new HitmarkerOverlay(document.getElementById("app") as HTMLDivElement, weaponConfig);
  // Gizmos balistiques de debug (retour playtest : « rajouter ... des gizmos
  // pour voir sur quoi on tire »), voir `render/ballisticsDebug.ts`. Objets
  // 3D RÉELS ajoutés à `scene`, pas un overlay canvas — actif PAR DÉFAUT,
  // bascule à chaud via `KeyB` dans `loop/updateFx.ts`.
  const ballisticsDebug = new BallisticsDebugOverlay(scene);

  // `BillboardSprite` clone en interne l'objet `THREE.Texture` par instance
  // (voir « LE PIÈGE DU PARTAGE DE TEXTURE » dans `render/billboard.ts`),
  // donc réutiliser cette même texture source pour chaque `new
  // BillboardSprite(...)`, PARTIE APRÈS PARTIE, est le pattern attendu — pas
  // besoin de la reconstruire à chaque `bootGameSession`.
  const suitAtlas = createPlaceholderAtlas(BILLBOARD_COLUMNS, SUIT_ATLAS_ROWS);

  const directorAtlas = createPlaceholderAtlas(BILLBOARD_COLUMNS, DIRECTOR_ATLAS_ROWS);
  // Badge droppé à la mort : mesh visible géré ici (le Directeur/DirectorManager
  // restent purs de tout rendu, voir leur doc de tête) — placeholder simple
  // (invariant #9), retiré de la scène au ramassage OU à un `teardownGameSession`.
  // Géométrie/matériau PARTAGÉS entre parties (jamais mutés en place ailleurs
  // que par cette identité de couleur), seule l'INSTANCE de mesh
  // (`session.badgeMesh`) est propre à une partie.
  const badgeGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const badgeMaterial = new THREE.MeshLambertMaterial({ color: 0xffd54a });

  // Scratch de la balle de test (chemin "gym" seulement) — voir la doc de
  // `GameEngine.ballPrevPos`/`ballCurrPos` ci-dessus. Position initiale
  // (3, 4, 0) alignée sur la translation de spawn de `RAPIER.RigidBodyDesc`
  // construite dans `lifecycle.ts::bootGameSession`.
  const ballPrevPos = new THREE.Vector3();
  const ballPrevQuat = new THREE.Quaternion();
  const ballCurrPos = new THREE.Vector3(3, 4, 0);
  const ballCurrQuat = new THREE.Quaternion();

  // yaw/pitch de visée — PERSISTANTS (Jalon M8) : mutés directement par
  // `bootGameSession` (respawn) et par `loadGltfLevel` (repositionnement sur
  // `spawn_player` au premier chargement d'une NOUVELLE session), jamais
  // recréés en objet neuf — la lecture souris de `interpolateVisuals` (plus
  // bas) ferme dessus par référence, un nouvel objet romprait ce lien.
  // Convention vérifiée par calcul (voir gltf-level-conventions / commentaire
  // de gym.ts) : avec l'Euler 'YXZ' de la caméra ci-dessous et la dérivation
  // de wishX/wishZ dans PlayerController.update, yaw=0 -> avant = -Z, donc
  // yaw=π -> avant = +Z.
  const look = { yaw: 0, pitch: 0 };
  // Delta souris agrégé depuis le dernier pas fixe, pour l'enregistrement.
  const lookDelta = { dx: 0, dy: 0 };

  // Debug visuel rétro : wireframe togglable à chaud sur toute la géométrie
  // DE LA SCÈNE AU MOMENT DU TOGGLE (voir `render/debugView.ts`) — PERSISTANT,
  // re-traverse `scene` à chaque appel, ramasse donc automatiquement la
  // géométrie de la session COURANTE (gym ou gltf) sans rien savoir des
  // resets. Touche dédiée KeyV, gérée dans `loop/updateFx.ts`.
  const wireframeToggle = createWireframeToggle(scene);

  // Interaction (`use_*`, touche E) — voir `game/level/interactive.ts`. UNE
  // SEULE instance pour toute la durée de l'onglet (PERSISTANTE, Jalon M8) :
  // son `consumed` interne est un `WeakSet` par RÉFÉRENCE de mesh (voir sa
  // doc) — un reset remplace `session.gltfLevelSession`/ses `useObjects` par
  // de nouveaux objets, donc un `use_*` déjà consommé avant un reset
  // redevient naturellement consommable après, sans code de reset dédié.
  const interaction = new InteractionSystem();

  return {
    scene,
    camera,
    renderer,
    root,
    flowActor,
    clock,
    fx,
    viewmodel,
    crosshair,
    hitmarker,
    ballisticsDebug,
    ambientLight,
    sunLight: sun,
    suitAtlas,
    directorAtlas,
    badgeGeometry,
    badgeMaterial,
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
