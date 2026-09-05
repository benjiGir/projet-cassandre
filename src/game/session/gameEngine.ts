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
 * Extraction du refactor de `main.ts` (2229 lignes → modules, 2026-09-05) :
 * `GameEngine` est le PENDANT PERSISTANT de `GameSession` (`gameSession.ts`)
 * — tout ce que `main()` construisait UNE SEULE FOIS, avant ce jalon, en
 * variables locales fermées par ~15 fonctions imbriquées et les 5 callbacks
 * de la boucle. Ce jalon ne change AUCUN comportement observable : chaque
 * champ ci-dessous existait déjà, sous forme de `const`/`let` de `main()`,
 * documenté comme "PERSISTANT (Jalon M8)" — cette interface ne fait que
 * leur donner un nom collectif pour pouvoir les passer en paramètre
 * explicite aux fonctions désormais extraites, au lieu d'une fermeture.
 *
 * Ce qui N'EST PAS ici (déplacé en constantes/scratch MODULE-LOCAUX dans le
 * seul fichier qui les utilise, `game/loop/*.ts`/`game/session/*.ts`) :
 * tous les scratch vectors qui ne servent qu'à UNE SEULE phase de boucle
 * (ex. `eyePosition`/`cameraEuler` — uniquement `interpolateVisuals.ts`),
 * et toutes les constantes de réplique/porte/vue (`HERO_LINE_*`, `VIEWS_*`,
 * `DOOR_OPEN_DURATION`...) — aucune de ces valeurs ne change au fil d'une
 * partie, les rendre "persistantes" via `GameEngine` n'apporterait rien.
 * Seul `ballPrevPos`/`ballPrevQuat`/`ballCurrPos`/`ballCurrQuat` reste ici :
 * partagé entre DEUX fichiers (`loop/stepPhysics.ts` écrit `ballCurr*`,
 * `loop/interpolateVisuals.ts` lit les deux pour interpoler).
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
 * `GameEngine` MOINS `session` — résout un ordre de construction circulaire :
 * `buildGameEngine` ci-dessous doit exister AVANT que la toute première
 * `GameSession` puisse être construite (`lifecycle.ts::bootGameSession` lit
 * `scene`/`look`/`clock`/etc.), mais `GameEngine` exige `session` non-null.
 * `bootGameSession` est donc typée pour accepter `PersistentEngine` (elle ne
 * lit jamais `engine.session` — voir sa doc, elle EN CONSTRUIT une, elle ne
 * lit jamais la courante) : un `GameEngine` complet reste assignable ici par
 * sous-typage structurel (champ `session` en trop, ignoré), donc les
 * rappels ultérieurs (`replay`/`returnToMenu`, qui passent le `GameEngine`
 * complet) fonctionnent avec la MÊME fonction, sans caster quoi que ce soit.
 */
export type PersistentEngine = Omit<GameEngine, "session">;

/** Capsule Costard : demi-hauteur 0.5 + rayon 0.4 -> hauteur totale 1.8 m, choisie pour matcher EXACTEMENT `DEFAULT_HEIGHT` de `BillboardSprite` (voir `suitConfig.ts`) : `verticalAnchor: 0.5` fait donc coïncider le centre du sprite avec le centre de la capsule que `Suit` interpole, sans calcul de décalage supplémentaire. */
export const SUIT_SPRITE_HEIGHT = 1.8;
/** capsuleHalfHeight(0.6) + capsuleRadius(0.45) = 1.05 -> hauteur totale 2.1 m, même règle de correspondance exacte que `SUIT_SPRITE_HEIGHT`. */
export const DIRECTOR_SPRITE_HEIGHT = 2.1;

/**
 * `true` ssi `engine.session.physics.world` est GARANTI vivant — càd ni pas
 * encore construit (`boot`/`mainMenu`/`options`/`levelSelect`, avant le tout
 * premier `bootGameSession`), ni déjà `free()`-é (fenêtre transitoire de
 * `returnToMenu()` : `teardownGameSession` libère le monde PUIS attend,
 * potentiellement plusieurs secondes le temps que l'utilisateur navigue le
 * menu, avant que `bootGameSession` n'en construise un nouveau —
 * `engine.session` continue de POINTER vers l'ancien pendant cette fenêtre,
 * un objet JS valide mais dont le `physics.world` Rapier sous-jacent est
 * détruit côté WASM).
 *
 * Utilisé UNIQUEMENT par `loop/stepPhysics.ts` : `loop/updateGameplay.ts` a
 * déjà sa propre garde stricte (`=== "playing"` seulement, voir sa doc) ;
 * `interpolateVisuals`/`updateFx`/`render` ne touchent jamais Rapier
 * directement (vérifié : `PlayerController.eyePosition`/`viewBob`/
 * `runFactorAt`, l'interpolation des Costards/Directeur, `viewmodel.update`
 * ne lisent que des champs JS déjà calculés, jamais `this.kcc`/`this.body`)
 * — les laisser tourner sans garde pendant cette fenêtre est sans risque
 * (au pire, un rendu de scène momentanément vide derrière le menu, déjà
 * masqué par son fond opaque).
 */
export function isPhysicsSessionLive(engine: GameEngine): boolean {
  const value = engine.flowActor.getSnapshot().value;
  return value === "playing" || value === "dead" || value === "levelComplete";
}

/**
 * Construit TOUT l'état PERSISTANT du jeu — scène/caméra/renderer, horloge,
 * systèmes de rendu cosmétiques (fx/viewmodel/crosshair/hitmarker/gizmos
 * balistiques/wireframe), atlas/géométries partagés, visée, interaction.
 * Appelée UNE SEULE FOIS par `main()`, avant le tout premier
 * `lifecycle.ts::bootGameSession` (qui construit `engine.session` et doit
 * donc recevoir cet `engine` déjà prêt).
 *
 * `root`/`flowActor` sont construits par `main()` (avant le choix du niveau,
 * voir sa doc) et passés ici plutôt que reconstruits — `resolveBootChoice`
 * a déjà besoin de `root` avant que cette fonction ne soit appelable.
 * Retourne `PersistentEngine` (PAS `GameEngine`) : `session` n'existe pas
 * encore à ce stade — `main()` appelle `lifecycle.ts::bootGameSession` juste
 * après pour la construire, puis assemble le `GameEngine` complet (voir la
 * doc de `PersistentEngine` ci-dessus).
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

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  // --- Vue : lue au taux d'affichage, jamais interpolée (invariant #3) -------
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

  // --- Ennemi « Costard » (Phase 3) — atlas PARTAGÉ, PERSISTANT -------------
  // `BillboardSprite` clone en interne l'objet `THREE.Texture` par instance
  // (voir « LE PIÈGE DU PARTAGE DE TEXTURE » dans `render/billboard.ts`),
  // donc réutiliser cette même texture source pour chaque `new
  // BillboardSprite(...)`, PARTIE APRÈS PARTIE, est le pattern attendu — pas
  // besoin de la reconstruire à chaque `bootGameSession`.
  const suitAtlas = createPlaceholderAtlas(BILLBOARD_COLUMNS, SUIT_ATLAS_ROWS);

  // --- Ennemi « Directeur » (boss de fin, Zone E) — même discipline --------
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
