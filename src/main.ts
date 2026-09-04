import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { initAudio, playDoorSfx, playEnemySfx, playImpactSfx, playSfx, playWeaponFireSfx } from "./core/audio";
import { input } from "./core/input";
import { duckMusicForHeroLine, initMusic, restoreMusicVolume } from "./core/music";
import { FIXED_DT, startLoop } from "./core/loop";
import { GameClock } from "./core/time";
import {
  emptyInputFrame,
  inputRecorder,
  recordingFromJson,
  recordingToJson,
  type InputFrame,
  type Recording,
} from "./core/inputRecorder";
import { createRenderer, INTERNAL_WIDTH, INTERNAL_HEIGHT } from "./render/renderer";
import { COLLISION_GROUPS, initPhysics, PhysicsWorld } from "./physics/world";
import { Effect } from "effect";
import { runGameplaySync } from "./core/runtime";
import { RenderService } from "./render/renderService";
import { buildGym } from "./game/level/gym";
import { createLevelSession, type LevelSession } from "./game/level/hotReload";
import { InteractionSystem } from "./game/level/interactive";
import type { DoorInfo, LevelStats, SecretZone } from "./game/level/loader";
import { LEVEL_CHOICES, type LevelDef } from "./game/level/levels";
import { PathfindingService, navGraphStats, type NavGraph } from "./game/level/pathfinding";
import { PlayerController } from "./game/player/controller";
import {
  FEEL_VARIANTS,
  fovForRunFactor,
  moveConfig,
  type MoveConfig,
} from "./game/player/moveConfig";
import { FLESH_MATERIAL, WeaponSystem } from "./game/player/weapons";
import {
  CROSSHAIR_VARIANTS,
  HITMARKER_VARIANTS,
  IMPACT_VARIANTS,
  RECOIL_VARIANTS,
  weaponConfig,
  type RecoilVariant,
  type WeaponConfig,
} from "./game/player/weaponConfig";
import { FxSystem } from "./render/fx";
import { Viewmodel } from "./render/viewmodel";
import { createWireframeToggle } from "./render/debugView";
import { HitmarkerOverlay } from "./render/hitmarker";
import { CrosshairOverlay } from "./render/crosshair";
import { BallisticsDebugOverlay } from "./render/ballisticsDebug";
import { BILLBOARD_COLUMNS, BillboardSprite, createPlaceholderAtlas } from "./render/billboard";
import { Suit, SUIT_ATLAS_ROWS } from "./game/entities/suit";
import { SuitManager } from "./game/entities/suitManager";
import { FLASH_VARIANTS, KNOCKBACK_VARIANTS, suitConfig, type SuitConfig } from "./game/entities/suitConfig";
import { Director, DIRECTOR_ATLAS_ROWS } from "./game/entities/director";
import { DirectorManager } from "./game/entities/directorManager";
import { directorConfig, type DirectorConfig } from "./game/entities/directorConfig";
import { useGameStore } from "./game/state";
import { createGameFlowActor } from "./ui/gameFlowMachine";
import { App } from "./ui/App";
import { LevelMenu } from "./ui/LevelMenu";
import { MainMenu } from "./ui/MainMenu";
import { RebindScreen } from "./ui/RebindScreen";

/** Garde verticale entre les pieds au spawn et le sol, en mètres : évite une
 * interpénétration au tout premier pas fixe (même garde que l'ancienne salle
 * de test). `buildGym` retourne la hauteur EXACTE du sol au point de spawn. */
const SPAWN_FEET_GUARD = 0.1;

// ---------------------------------------------------------------------------
// Jalon M8 (PLAN_EFFECT_XSTATE.md, §10) — types partagés d'une PARTIE.
//
// Déclarés à portée MODULE (pas à l'intérieur de `main()`) : `exposeDebugApi`
// (console `window.cassandre`) est un frère de `main()`, pas un enfant — il a
// besoin de voir `GameSession` sans que `main()` ait à le lui passer par un
// détour de type exporté séparément.
// ---------------------------------------------------------------------------

/** Porte de sortie en cours de glissement cosmétique (voir la doc dans `updateGameplay`). */
interface OpeningDoor {
  body: RAPIER.RigidBody;
  startY: number;
  targetY: number;
  t: number;
}

/** Suivi de franchissement de `door_e_exit` — voir `setupExitDoorTracking`. */
interface ExitDoorTracking {
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
 * partagés) RESTE VIVANT à travers un reset — voir la doc de tête de
 * `bootGameSession`/`teardownGameSession` pour la frontière exacte et sa
 * justification.
 *
 * Avant ce jalon, TOUT ce qui suit vivait en variables locales de `main()`,
 * construites UNE SEULE FOIS au boot (`CLAUDE.md` documentait explicitement
 * qu'aucun chemin de reset n'existait — jugé disproportionné en Phase 6).
 * Ce jalon construit ce chemin ; `GameSession` est la structure qui le rend
 * possible : au lieu de ~20 variables mutables indépendantes de `main()`,
 * UN SEUL objet remplacé d'un bloc à chaque reset (`currentSession = ...`).
 */
interface GameSession {
  /** Niveau/chemin de boot utilisé pour CETTE partie — permet à "Rejouer" de reconstruire EXACTEMENT le même choix. */
  choice: LevelDef;

  physics: PhysicsWorld;
  player: PlayerController;
  weapons: WeaponSystem;

  suitManager: SuitManager;
  /** Un `BillboardSprite` par Costard vivant/cadavre, voir `spawnSuitAt`. */
  suitSprites: Map<number, BillboardSprite>;
  directorManager: DirectorManager;
  directorSprites: Map<number, BillboardSprite>;

  /** Racine Three.js de la gym (chemin "gym" SEULEMENT, `null` sur le chemin "gltf") — voir la doc de `buildGym`. Un seul `scene.remove(gymRoot)` au teardown retire TOUTE la géométrie de la gym (murs, rampes, marches...) ET la balle de test (posée en enfant de ce groupe, voir `bootGameSession`), sans qu'aucun code de `gym.ts` n'ait besoin de retourner la liste de ce qu'il a créé. */
  gymRoot: THREE.Group | null;
  /** Balle de test (témoin de collision dynamique), chemin "gym" seulement — enfant de `gymRoot`, voir ci-dessus. */
  ballMesh: THREE.Mesh | null;
  ballBody: RAPIER.RigidBody | null;

  /** Session de niveau glTF (chemin "gltf" seulement) — `LevelSession.dispose()` (via `.stop()`) gère déjà lui-même le retrait de sa géométrie de `scene` et la libération GPU (voir `loader.ts::disposeLevelResource`), donc `teardownGameSession` n'a qu'à appeler `.stop()`. */
  gltfLevelSession: LevelSession | null;
  /** Graphe de praticabilité (Jalon M4) du niveau COURANT — rebaké à chaque `onLoaded`, voir `loadGltfLevel`. */
  currentNavGraph: NavGraph | null;

  /** Badge du Directeur : mesh visible tant qu'il n'a pas été ramassé — voir `updateGameplay`. */
  badgeMesh: THREE.Mesh | null;
  hasBadge: boolean;

  unlockedDoors: Set<string>;
  openingDoor: OpeningDoor | null;
  exitDoorTracking: ExitDoorTracking | null;
  /** Secrets déjà trouvés CETTE partie — `WeakSet` par référence de mesh, voir sa doc historique dans `updateGameplay`. */
  foundSecrets: WeakSet<THREE.Object3D>;

  /** PV courants du joueur, suivis localement — `setPlayerHp` prend une valeur absolue (voir `game/state.ts`), `main.ts` est le seul endroit qui connaît le dégât infligé. */
  playerHp: number;
  firstKillTriggered: boolean;
  lowHpLineTriggered: boolean;
  /** Idempotence de `handlePlayerHit` — voir sa doc. */
  deathHandled: boolean;
  /** Idempotence de `triggerLevelComplete` — voir sa doc. */
  levelCompleteHandled: boolean;
  /** Cooldown global des répliques du héros (15 s) — PROPRE À CETTE PARTIE : une réplique juste avant la mort ne doit pas geler le canal de la partie suivante. */
  lastHeroLineAt: number;
}

/**
 * Résout le `LevelDef` choisi pour ce boot, AVANT toute construction de scène
 * Three.js/monde Rapier — voir l'appel tout en haut de `main()`.
 *
 * Deux voies, dans cet ordre :
 *   1. `?level=<id>` dans l'URL. Si `<id>` correspond à une entrée du
 *      registre (`LEVEL_CHOICES`), elle est utilisée directement, SANS
 *      afficher le menu. Sinon (nom qui ne matche aucune entrée), il est
 *      traité comme un nom de fichier glTF BRUT à charger tel quel
 *      (`kind: "gltf"` implicite, pas de `startUnarmed`) — c'est le mode
 *      d'itération actuel pour tester une zone en cours d'export, avant
 *      qu'elle ait une entrée officielle dans le registre. Flexibilité
 *      délibérément préservée, ne pas la retirer.
 *   2. Sinon, affiche `LevelMenu` (voir `src/ui/LevelMenu.tsx`, composant
 *      purement présentationnel, non modifié ici) et attend le clic de
 *      l'utilisateur.
 *
 * Jalon M8 (PLAN_EFFECT_XSTATE.md, §10) : cette fonction n'est PAS touchée
 * par ce jalon (jugement explicite de la tâche : "la partie la moins
 * risquée", déjà testée, déjà en prod) — ni elle ni `resolveBootChoice`
 * ci-dessous n'envoient d'évènement à l'acteur de flux. `main.ts` envoie les
 * DEUX évènements qui encadrent tout ce sous-flux (`ENTER_MENU` avant,
 * `PLAY` après résolution) depuis son propre corps — voir la doc de tête de
 * `ui/gameFlowMachine.ts` pour la justification de ce choix, plus grossier
 * que la table de test complète.
 */
function resolveLevelChoice(root: ReturnType<typeof createRoot>): Promise<LevelDef> {
  const levelParam = new URLSearchParams(window.location.search).get("level");
  if (levelParam) {
    const registered = LEVEL_CHOICES.find((entry) => entry.id === levelParam);
    if (registered) return Promise.resolve(registered);
    return Promise.resolve({
      id: levelParam,
      label: levelParam,
      kind: "gltf",
      gltfName: levelParam,
    });
  }

  return new Promise((resolve) => {
    root.render(
      createElement(LevelMenu, {
        options: LEVEL_CHOICES.map((entry) => ({ id: entry.id, label: entry.label })),
        onChoose: (id) => {
          const chosen = LEVEL_CHOICES.find((entry) => entry.id === id);
          // `LevelMenu` n'appelle `onChoose` qu'avec un `id` qu'il a lui-même
          // reçu dans `options`, donc toujours résolvable ici — le fallback
          // ne sert qu'à satisfaire le type, jamais atteint en pratique.
          resolve(chosen ?? LEVEL_CHOICES[0]);
        },
      }),
    );
  });
}

/**
 * Porte d'entrée du jeu (Phase 6, plan section F — menu principal). Enrobe
 * `resolveLevelChoice` ci-dessus (INCHANGÉE) d'un nouveau menu principal,
 * SANS jamais l'afficher quand `?level=` est présent dans l'URL : LES DEUX
 * CHEMINS HISTORIQUES DOIVENT CONTINUER À FONCTIONNER EXACTEMENT COMME AVANT
 * (contrainte dure de la tâche) —
 *   1. `?level=<id enregistré>` : bypass total, aucun menu, jamais montré ;
 *   2. `?level=<nom>` non enregistré : fixture brute, idem.
 * Cette fonction délègue PUREMENT à `resolveLevelChoice` dans les deux cas
 * (return immédiat, `MainMenu` n'est même pas importé dans ce chemin) — la
 * logique elle-même n'est pas dupliquée, seulement enrobée.
 *
 * Absent de `?level=` : affiche `MainMenu` (Jouer / Options / Quitter).
 * "Jouer" résout DIRECTEMENT sur `hypermarche_complet` (le niveau complet,
 * chemin joueur normal) — SANS passer par `LevelMenu` (resté un outil de
 * DEV pour choisir une zone individuelle, voir son en-tête). `LevelMenu`
 * reste atteignable via le lien discret "Choisir une zone (dev)" de
 * `MainMenu`, qui délègue lui-même à `resolveLevelChoice` — c'est donc le
 * MÊME composant historique, jamais dupliqué ni réimplémenté. "Options"
 * affiche `RebindScreen` (plan section G), avec un retour vers ce même menu
 * principal (pas de pile de navigation : un seul niveau d'imbrication).
 *
 * Réutilisée par `main.ts::returnToMenu` (Jalon M8) EXACTEMENT comme au
 * tout premier boot — voir sa doc pour la raison pour laquelle "Retour au
 * menu principal" doit d'abord retirer `?level=` de l'URL (`history.replaceState`,
 * pas de rechargement) avant de rappeler cette fonction, sans quoi une
 * partie démarrée via `?level=zone_a_parking` reviendrait silencieusement
 * au même niveau au lieu du vrai menu principal.
 */
function resolveBootChoice(root: ReturnType<typeof createRoot>): Promise<LevelDef> {
  const levelParam = new URLSearchParams(window.location.search).get("level");
  if (levelParam) return resolveLevelChoice(root);

  const fullLevel = LEVEL_CHOICES.find((entry) => entry.id === "hypermarche_complet");
  // Filet de sécurité de TYPAGE uniquement, jamais atteint en pratique tant
  // que `levels.ts` garde cette entrée enregistrée — sans lui, "Jouer"
  // retomberait sur le tout premier choix du registre plutôt que de planter.
  const playChoice = fullLevel ?? LEVEL_CHOICES[0];

  return new Promise((resolve) => {
    function showMainMenu() {
      root.render(
        createElement(MainMenu, {
          onPlay: () => resolve(playChoice),
          onOptions: () => {
            root.render(createElement(RebindScreen, { onBack: showMainMenu }));
          },
          onChooseZone: () => {
            resolveLevelChoice(root).then(resolve);
          },
        }),
      );
    }
    showMainMenu();
  });
}

async function main() {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement;
  const root = createRoot(uiRoot);

  // --- Jalon M8 (PLAN_EFFECT_XSTATE.md, §10) : acteur de flux d'écran ------
  // Créé AVANT même le choix du niveau : `boot` est son état initial, et
  // `setFlowState` (store zustand) doit refléter cet état dès que possible,
  // pas seulement une fois la partie commencée. Un seul acteur pour toute la
  // durée de vie de l'onglet (voir la doc de tête de `gameFlowMachine.ts`) —
  // jamais recréé par `replay`/`returnToMenu` plus bas, contrairement à
  // `currentSession`.
  //
  // `actor.subscribe(...)`, PAS `@xstate/react` (interdit par le plan) :
  // React ne s'abonne qu'au store zustand (`state.flowState`), exactement le
  // pont déjà utilisé pour le reste de l'état de jeu exposé au HUD (invariant
  // #2). Un changement d'état de flux est un évènement DISCRET (un clic, une
  // mort, une sortie de niveau), pas un flux à 60 Hz — aucun throttle
  // nécessaire ici, contrairement à `setDebug`.
  const flowActor = createGameFlowActor();
  flowActor.subscribe((snapshot) => {
    useGameStore.getState().setFlowState(snapshot.value);
  });

  /**
   * `true` ssi `currentSession.physics.world` (plus bas) est GARANTI vivant
   * — càd ni pas encore construit (`boot`/`mainMenu`/`options`/`levelSelect`,
   * avant le tout premier `bootGameSession`), ni déjà `free()`-é (fenêtre
   * transitoire de `returnToMenu()` : `teardownGameSession` libère le monde
   * PUIS attend, potentiellement plusieurs secondes le temps que l'utilisateur
   * navigue le menu, avant que `bootGameSession` n'en construise un nouveau —
   * `currentSession` continue de POINTER vers l'ancien pendant cette fenêtre,
   * un objet JS valide mais dont le `physics.world` Rapier sous-jacent est
   * détruit côté WASM).
   *
   * Utilisé UNIQUEMENT par `stepPhysics` ci-dessous : `updateGameplay` a déjà
   * sa propre garde stricte (`=== "playing"` seulement, voir sa doc) ;
   * `interpolateVisuals`/`updateFx`/`render` ne touchent jamais Rapier
   * directement (vérifié : `PlayerController.eyePosition`/`viewBob`/
   * `runFactorAt`, l'interpolation des Costards/Directeur, `viewmodel.update`
   * ne lisent que des champs JS déjà calculés, jamais `this.kcc`/`this.body`)
   * — les laisser tourner sans garde pendant cette fenêtre est sans risque
   * (au pire, un rendu de scène momentanément vide derrière le menu, déjà
   * masqué par son fond opaque).
   */
  function isPhysicsSessionLive(): boolean {
    const value = flowActor.getSnapshot().value;
    return value === "playing" || value === "dead" || value === "levelComplete";
  }

  // --- Choix du niveau (Phase 5) — TOUT EN HAUT de `main()`, avant absolument
  // tout le reste du boot (avant `root.render(App)`, avant `input.attach`,
  // avant `initAudio`, avant la scène/caméra/renderer/physique). Invariant #2
  // (React ne touche jamais la boucle) est trivialement respecté ici : il n'y
  // a même pas encore de boucle à ce stade. Voir `game/level/levels.ts` pour
  // le registre — remplace l'ancien hardcode `levelParam === "zone_a_parking"`
  // documenté comme dette dans CLAUDE.md.
  //
  // `ENTER_MENU` envoyé ICI (pas dans `resolveBootChoice`, non touchée par ce
  // jalon) SEULEMENT si `?level=` est absent — sinon `resolveBootChoice`
  // bypass tout menu et `PLAY` (juste en dessous) transitionnera directement
  // depuis `boot`, jamais depuis `mainMenu`. Voir la doc de tête de
  // `ui/gameFlowMachine.ts` pour la raison pour laquelle la navigation
  // interne (Options, Choisir une zone) n'envoie PAS d'évènements
  // intermédiaires.
  if (!new URLSearchParams(window.location.search).get("level")) {
    flowActor.send({ type: "ENTER_MENU" });
  }
  // `resolveBootChoice` enrobe `resolveLevelChoice` d'un nouveau menu
  // principal (Phase 6) SANS jamais toucher son comportement historique
  // (`?level=`) — voir sa doc juste au-dessus.
  const choice = await resolveBootChoice(root);
  flowActor.send({ type: "PLAY" });

  input.attach(canvas);
  // Pools de SFX (tir, impact) : voir core/audio.ts. Placeholders
  // synthétiques présents depuis la Phase 3 (invariant #9 — pas des choix de
  // sound design arrêtés), géré silencieusement (un seul console.warn par id
  // manquant, jamais de throw). Initialisé avant startLoop, comme les autres
  // systèmes globaux.
  initAudio();
  // Musique + nappe d'ambiance (Phase 6) : voir core/music.ts pour la
  // séparation avec `audio.ts` (SFX ponctuels) — même discipline de
  // placeholder synthétique, module distinct car le pattern Howler diffère
  // (streaming en boucle, pas un pool de sources courtes).
  initMusic();

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
  const camera = new THREE.PerspectiveCamera(
    moveConfig.fovBase,
    INTERNAL_WIDTH / INTERNAL_HEIGHT,
    0.1,
    130,
  );

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

  await initPhysics();

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
  // bascule à chaud via `KeyB` plus bas dans `updateFx`.
  const ballisticsDebug = new BallisticsDebugOverlay(scene);

  // --- Ennemi « Costard » (Phase 3) — atlas/hauteur PARTAGÉS, PERSISTANTS ---
  // `BillboardSprite` clone en interne l'objet `THREE.Texture` par instance
  // (voir « LE PIÈGE DU PARTAGE DE TEXTURE » dans `render/billboard.ts`),
  // donc réutiliser cette même texture source pour chaque `new
  // BillboardSprite(...)`, PARTIE APRÈS PARTIE, est le pattern attendu — pas
  // besoin de la reconstruire à chaque `bootGameSession`.
  const suitAtlas = createPlaceholderAtlas(BILLBOARD_COLUMNS, SUIT_ATLAS_ROWS);
  // Capsule Costard : demi-hauteur 0.5 + rayon 0.4 -> hauteur totale 1.8 m,
  // choisie pour matcher EXACTEMENT `DEFAULT_HEIGHT` de `BillboardSprite`
  // (voir `suitConfig.ts`) : `verticalAnchor: 0.5` fait donc coïncider le
  // centre du sprite avec le centre de la capsule que `Suit` interpole,
  // sans calcul de décalage supplémentaire.
  const SUIT_SPRITE_HEIGHT = 1.8;

  // --- Ennemi « Directeur » (boss de fin, Zone E) — même discipline --------
  const directorAtlas = createPlaceholderAtlas(BILLBOARD_COLUMNS, DIRECTOR_ATLAS_ROWS);
  // capsuleHalfHeight(0.6) + capsuleRadius(0.45) = 1.05 -> hauteur totale
  // 2.1 m, même règle de correspondance exacte que `SUIT_SPRITE_HEIGHT`.
  const DIRECTOR_SPRITE_HEIGHT = 2.1;
  // Badge droppé à la mort : mesh visible géré ici (le Directeur/DirectorManager
  // restent purs de tout rendu, voir leur doc de tête) — placeholder simple
  // (invariant #9), retiré de la scène au ramassage OU à un `teardownGameSession`.
  // Géométrie/matériau PARTAGÉS entre parties (jamais mutés en place ailleurs
  // que par cette identité de couleur), seule l'INSTANCE de mesh (`session.badgeMesh`)
  // est propre à une partie.
  const badgeGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const badgeMaterial = new THREE.MeshLambertMaterial({ color: 0xffd54a });

  // Balle dynamique : témoin de non-régression des colliders, et témoin de
  // `setApplyImpulsesToDynamicBodies` — le joueur doit pouvoir la pousser.
  // Position vérifiée pour le hub de la gym (44x44 m, murs à x,z = ±22) :
  // au repos elle tombe vers (~1.9, ~0.4, ~1.6) en ~0.54 s, bien dégagée de
  // tout mur et directement dans le champ de vision du spawn (au spawn
  // (0, ~1.7, -10) regardant +Z, la balle est à ~17° hors axe, très en deçà
  // du demi-FOV ~54°). Sa dérive horizontale constante (pas d'amortissement)
  // la fait heurter le segment ouest du mur nord du hub vers t≈7.3 s, avant
  // d'atteindre l'ouverture du couloir (x∈[-3,3]) : elle reste contenue dans
  // le hub, jamais éjectée vers une autre aile.
  //
  // OBJET DE TEST DE LA GYM (pas du contenu générique de moteur) : construite
  // UNIQUEMENT sur le chemin "gym" (voir `bootGameSession`), ses coordonnées
  // n'ayant aucun sens sur le chemin glTF. Rayon PERSISTANT (pure constante),
  // le mesh/corps eux-mêmes sont RECRÉÉS à chaque `bootGameSession` — voir
  // `GameSession.ballMesh`/`ballBody`.
  const BALL_RADIUS = 0.4;
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
  // resets. Touche dédiée KeyV, gérée plus bas dans `updateFx`.
  const wireframeToggle = createWireframeToggle(scene);

  // Interaction (`use_*`, touche E) — voir `game/level/interactive.ts`. UNE
  // SEULE instance pour toute la durée de l'onglet (PERSISTANTE, Jalon M8) :
  // son `consumed` interne est un `WeakSet` par RÉFÉRENCE de mesh (voir sa
  // doc) — un reset remplace `session.gltfLevelSession`/ses `useObjects` par
  // de nouveaux objets, donc un `use_*` déjà consommé avant un reset
  // redevient naturellement consommable après, sans code de reset dédié.
  const interaction = new InteractionSystem();

  const liveFrame = emptyInputFrame();
  const eyePosition = new THREE.Vector3();
  const cameraEuler = new THREE.Euler(0, 0, 0, "YXZ");
  // Scratch du head bob : réutilisé à chaque frame, zéro allocation en régime établi.
  const viewBobOffset = new THREE.Vector3();
  // Origine de tir AUTHENTIQUE du pas fixe courant (position + eyeOffset, PAS
  // `player.eyePosition(alpha, …)` qui est interpolée pour le rendu) — voir
  // la note de déterminisme dans `WeaponSystem.update`.
  const weaponEyeOrigin = new THREE.Vector3();
  // Scratch de l'offset de screenshake, réutilisé à chaque frame (`fx.currentShakeOffset`).
  const shakeOffsetScratch = new THREE.Vector3();
  // Scratch d'interpolation des Costards, réutilisés séquentiellement pour
  // chaque `Suit` (consommés immédiatement par `sprite.updatePose`, jamais
  // retenus — sûr malgré le partage, comme `movementScratch` dans `suit.ts`).
  const suitPositionScratch = new THREE.Vector3();
  const suitForwardScratch = new THREE.Vector3();
  // Même rôle, pour le Directeur.
  const directorPositionScratch = new THREE.Vector3();
  const directorForwardScratch = new THREE.Vector3();
  // Scratch réutilisé par la vérification de franchissement de sortie (voir
  // `updateGameplay`) — zéro allocation en régime établi.
  const exitDoorOffsetScratch = new THREE.Vector3();

  // Constantes de porte/sortie de niveau (Zone E, `door_e_exit`) — voir la
  // doc de `OpeningDoor`/`ExitDoorTracking` en tête de fichier.
  const DOOR_OPEN_DURATION = 0.6;
  // Marge au-delà du vantail, m — évite un déclenchement au ras de la porte
  // (le joueur doit être VISIBLEMENT sorti, pas juste avoir franchi le plan).
  const EXIT_CROSSING_MARGIN = 1.0;

  // Objets interactifs "signature Duke" (micro d'annonces, toilettes) — PV
  // rendus par les toilettes : "+1 PV" au sens LITTÉRAL du plan (blague
  // assumée sur la valeur dérisoire, pas un vrai levier de gameplay). Leurs
  // répliques (`HERO_LINE_PA_MIC`/`HERO_LINE_TOILET`) passent par
  // `triggerHeroLine` ci-dessous, EXACTEMENT comme les autres répliques — un
  // seul canal, une seule discipline de cooldown, jamais un chemin parallèle.
  const HERO_LINE_PA_MIC = '"Client de la Zone C : le rayon reptiliens est en rupture de stock."';
  const HERO_LINE_TOILET = "Ça va mieux.";
  const TOILET_HEAL_AMOUNT = 1;
  // 5 répliques au total (fourchette du plan : 3 à 5). Ton : satire de la
  // CULTURE de la croyance, jamais de cible réelle — l'ennemi est
  // explicitement un "lézard" (reptilien fictif, cohérent avec la révélation
  // du Directeur), l'absurde est assumé.
  const HERO_LINE_FIRST_KILL = "Premier lézard neutralisé à l'écran. Ils vont encore dire que c'est un montage.";
  const HERO_LINE_SECRET_REACTION = "Je vous l'avais dit : il y a TOUJOURS une pièce cachée.";
  const HERO_LINE_LOW_HP = "Ça va, ÇA VA. Continuez de me suivre, c'est important.";

  const HUD_MESSAGE_DURATION_MS = 1800;
  /** Affiche un message HUD transitoire SYSTÈME, effacé après `HUD_MESSAGE_DURATION_MS`
   * (sauf s'il a déjà été remplacé par un autre message entre-temps). Canal
   * FACTUEL (porte, badge, secret n/total...), voir la doc de `hudMessage`
   * dans `game/state.ts` pour la ligne de partage avec `triggerHeroLine`
   * ci-dessous — AUCUN cooldown ici, contrairement aux répliques. Ne dépend
   * d'aucune partie en cours (store global) : pas de paramètre `session`. */
  function showHudMessage(text: string): void {
    useGameStore.getState().showHudMessage(text);
    window.setTimeout(() => {
      if (useGameStore.getState().hudMessage === text) {
        useGameStore.getState().showHudMessage(null);
      }
    }, HUD_MESSAGE_DURATION_MS);
  }

  // Cooldown global de 15 s MINIMUM entre deux répliques du héros, quelle
  // que soit la source (règle explicite du skill `audio-sfx-pipeline` — Duke
  // 3D lui-même souffre de l'enchaînement de one-liners). Durée d'affichage
  // volontairement plus longue que `HUD_MESSAGE_DURATION_MS` (1.8 s) : une
  // réplique "parlée" se lit plus lentement qu'un toast factuel court —
  // valeur de confort, pas un choix de tuning arrêté.
  const HERO_LINE_COOLDOWN_MS = 15000;
  const HERO_LINE_DISPLAY_MS = 4000;

  /**
   * Tente d'afficher une réplique du héros sur le canal DÉDIÉ
   * (`state.heroLine`, voir `ui/HeroLine.tsx`) — TOUTES les répliques du jeu
   * passent par cette fonction. Respecte le cooldown global — PROPRE À
   * `session` depuis ce jalon (`session.lastHeroLineAt`, voir sa doc) : une
   * réplique juste avant la mort ne doit pas geler le canal de la PROCHAINE
   * partie après "Rejouer". Retourne `false` sans effet si non écoulé.
   *
   * Ducking musique (-6 dB, remontée sur 400 ms) déclenché ICI. Le
   * `setTimeout` de restauration ne dépend d'AUCUN état de partie (juste du
   * texte affiché et du volume musique, tous deux globaux) : il reste
   * correct même si un reset survient pendant la fenêtre d'affichage.
   */
  function triggerHeroLine(session: GameSession, text: string): boolean {
    const now = performance.now();
    if (now - session.lastHeroLineAt < HERO_LINE_COOLDOWN_MS) return false;
    session.lastHeroLineAt = now;
    useGameStore.getState().showHeroLine(text);
    duckMusicForHeroLine();
    window.setTimeout(() => {
      if (useGameStore.getState().heroLine === text) {
        useGameStore.getState().showHeroLine(null);
      }
      restoreMusicVolume();
    }, HERO_LINE_DISPLAY_MS);
    return true;
  }

  // Compteur de "vues" (Phase 6, voir `debug.views` dans `game/state.ts`) —
  // gain ALÉATOIRE par kill (le gag du "clip qui buzz" disproportionné),
  // plage et multiplicateur ARBITRAIRES. `Math.random()` ici est SANS
  // CONSÉQUENCE sur le déterminisme du pas fixe : cette fonction n'est
  // appelée que depuis les boucles `deathEvents`, lues au TAUX D'AFFICHAGE
  // dans `updateFx` (jamais depuis `updateGameplay`).
  const VIEWS_GAIN_MIN = 40;
  const VIEWS_GAIN_MAX = 200;
  const VIEWS_DIRECTOR_MULTIPLIER = 4; // "la plus grosse révélation de la chaîne" mérite un pic plus marqué qu'un Costard ordinaire.
  function grantKillViews(multiplier = 1): void {
    const gain = Math.round((VIEWS_GAIN_MIN + Math.random() * (VIEWS_GAIN_MAX - VIEWS_GAIN_MIN)) * multiplier);
    useGameStore.getState().incrementViews(gain);
  }

  // Seuil de la réplique "PV bas" — fraction de `playerMaxHp`, PREMIER
  // franchissement DE LA PARTIE seulement (`session.lowHpLineTriggered`,
  // remis à `false` par `bootGameSession` à chaque nouvelle partie).
  const LOW_HP_HERO_LINE_THRESHOLD = 0.3;

  /**
   * Appelée juste après CHAQUE décrément de `session.playerHp` (boucles
   * `playerHitEvents` du Costard ET du Directeur, même contrat) — factorisé
   * pour ne pas dupliquer cette logique entre les deux. Détecte, dans
   * l'ordre : la réplique "PV bas" (premier franchissement de la partie), et
   * la mort. Un coup qui amène `playerHp` à 0 pile sous le seuil ne
   * déclenche PAS la réplique "PV bas" en plus de l'écran de mort
   * (`playerHp > 0` dans la condition ci-dessous) — la mort prime.
   *
   * Jalon M8 : envoie `DIED` à l'acteur de flux au lieu d'écrire
   * `state.isDead` directement (retiré de `game/state.ts`). L'idempotence
   * (`session.deathHandled`) reste nécessaire malgré la garde de
   * `updateGameplay` (`flowState !== "playing"` -> return) : PLUSIEURS
   * `playerHitEvents` peuvent arriver dans le MÊME pas fixe (deux Costards
   * qui touchent au même instant), or c'est `updateFx` (jamais gatée par le
   * flux — elle continue de drainer les files après la mort, voir sa doc)
   * qui les traite, un par un, dans la même frame — sans ce flag, le
   * deuxième appel enverrait un second `DIED` (no-op côté machine, la
   * transition n'existe pas depuis `dead`) et un second
   * `exitPointerLock()` (idempotent côté DOM) : inoffensif mais the flag
   * documente l'intention plutôt que de compter sur ces deux idempotences
   * accidentelles.
   */
  function handlePlayerHit(session: GameSession): void {
    const maxHp = useGameStore.getState().debug.playerMaxHp;
    if (!session.lowHpLineTriggered && session.playerHp > 0 && session.playerHp / maxHp <= LOW_HP_HERO_LINE_THRESHOLD) {
      session.lowHpLineTriggered = true;
      triggerHeroLine(session, HERO_LINE_LOW_HP);
    }
    if (!session.deathHandled && session.playerHp <= 0) {
      session.deathHandled = true;
      flowActor.send({ type: "DIED" });
      // Libère le pointeur : l'écran de mort a besoin du curseur pour ses
      // boutons "Rejouer"/"Retour au menu principal" (voir `DeathScreen.tsx`).
      document.exitPointerLock();
    }
  }

  /** Déverrouille le `door_*` nommé `targetName` (glissement + collider désactivé,
   * voir la doc de `OpeningDoor` en tête de fichier) — factorisé entre `onExitDoorUse`
   * (Zone E, gardé par badge) et `onFrozenStorageUse` (Zone B, sans garde) :
   * même mécanique de porte, seule la CONDITION d'appel diffère, décidée par
   * l'appelant avant d'invoquer cette fonction. Retourne `false` sans effet
   * si `targetName` ne correspond à aucun `door_*` du niveau courant (erreur
   * de données Blender, pas un état de jeu valide). */
  function unlockDoor(session: GameSession, targetName: string, successMessage: string): boolean {
    const door = (session.gltfLevelSession?.current?.doors ?? []).find((d) => d.name === targetName);
    if (!door) {
      console.error(`[main] use_* référence une porte introuvable ("${targetName}").`);
      return false;
    }
    session.unlockedDoors.add(targetName);
    const t = door.body.translation();
    session.openingDoor = { body: door.body, startY: t.y, targetY: t.y - door.halfExtents.y * 2, t: 0 };
    door.collider.setEnabled(false);
    showHudMessage(successMessage);
    playDoorSfx("unlock");
    return true;
  }

  /** Arme le suivi de franchissement pour `doorName` — voir la doc de `ExitDoorTracking`
   * en tête de fichier. Appelé UNIQUEMENT depuis `onExitDoorUse` pour
   * `"door_e_exit"`, jamais pour `door_b_frozen` (le secret 1 n'est pas une
   * sortie de niveau). */
  function setupExitDoorTracking(session: GameSession, doorName: string): void {
    const door = (session.gltfLevelSession?.current?.doors ?? []).find((d) => d.name === doorName);
    if (!door) return; // défensif : `unlockDoor` a déjà loggé une erreur si absent, rien à ajouter ici.

    // Axe LOCAL le plus fin (hors hauteur) = l'épaisseur du vantail, donc sa
    // normale — même heuristique que `buildCuboidCollider`/`buildDoor`
    // (les deux ne connaissent que des demi-étendues, jamais un "axe de
    // porte" explicite côté données Blender).
    const localThinIsX = Math.abs(door.halfExtents.x) <= Math.abs(door.halfExtents.z);
    const localAxis = localThinIsX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const r = door.body.rotation();
    const crossingAxis = localAxis.applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).normalize();

    const t = door.body.translation();
    const doorPosition = new THREE.Vector3(t.x, t.y, t.z);
    const playerOffset = new THREE.Vector3().subVectors(session.player.position, doorPosition);
    const insideSign: 1 | -1 = playerOffset.dot(crossingAxis) >= 0 ? 1 : -1;

    session.exitDoorTracking = {
      doorPosition,
      crossingAxis,
      insideSign,
      halfExtentOnAxis: localThinIsX ? door.halfExtents.x : door.halfExtents.z,
    };
  }

  /** Bascule vers l'écran de fin de niveau (Jalon M8 : envoie `LEVEL_COMPLETED`
   * à l'acteur de flux, remplace `state.setLevelComplete(true)`) — voir
   * `handlePlayerHit` pour la même discussion sur `session.levelCompleteHandled`
   * face à la garde `flowState !== "playing"` d'`updateGameplay`. Libère le
   * pointeur (même geste qu'à la mort) : l'écran de fin de niveau a besoin du
   * curseur pour ses boutons. */
  function triggerLevelComplete(session: GameSession): void {
    if (session.levelCompleteHandled) return;
    session.levelCompleteHandled = true;
    flowActor.send({ type: "LEVEL_COMPLETED" });
    document.exitPointerLock();
  }

  /**
   * Fait apparaître un Costard ET son `BillboardSprite`, toujours ensemble
   * (jamais l'un sans l'autre — un Costard sans sprite serait invisible mais
   * actif, un bug de lisibilité silencieux). `facing` par défaut : vise la
   * position COURANTE du joueur DE `session` au moment du spawn (pratique
   * aussi bien pour les 3 spawns initiaux que pour `cassandre.spawnSuit` en
   * cours de partie).
   *
   * `session` est un paramètre EXPLICITE (pas une lecture de la variable
   * mutable `currentSession` plus bas) : cette fonction est aussi appelée
   * DEPUIS `bootGameSession`, PENDANT la construction d'une NOUVELLE session
   * qui n'est pas encore devenue "la" session courante — lui faire lire
   * `currentSession` pousserait alors le Costard dans l'ANCIENNE partie
   * (celle en cours de remplacement), un bug d'un genre difficile à
   * repérer en jeu (le Costard semblerait juste ne jamais apparaître).
   */
  function spawnSuitAt(session: GameSession, x: number, feetY: number, z: number): Suit {
    const facing = new THREE.Vector3(session.player.position.x - x, 0, session.player.position.z - z);
    if (facing.lengthSq() < 1e-6) facing.set(0, 0, 1);
    facing.normalize();

    const suit = session.suitManager.spawnSuit(x, feetY, z, facing);
    const sprite = new BillboardSprite(scene, suitAtlas, {
      rows: SUIT_ATLAS_ROWS,
      height: SUIT_SPRITE_HEIGHT,
      verticalAnchor: 0.5,
    });
    session.suitSprites.set(suit.id, sprite);
    return suit;
  }

  /** Même rôle que `spawnSuitAt`, pour le Directeur — même raison pour le paramètre `session` explicite. */
  function spawnDirectorAt(session: GameSession, x: number, feetY: number, z: number): Director {
    const facing = new THREE.Vector3(session.player.position.x - x, 0, session.player.position.z - z);
    if (facing.lengthSq() < 1e-6) facing.set(0, 0, 1);
    facing.normalize();

    const director = session.directorManager.spawnDirector(x, feetY, z, facing);
    const sprite = new BillboardSprite(scene, directorAtlas, {
      rows: DIRECTOR_ATLAS_ROWS,
      height: DIRECTOR_SPRITE_HEIGHT,
      verticalAnchor: 0.5,
    });
    session.directorSprites.set(director.id, sprite);
    return director;
  }

  /**
   * Charge (ou recharge) `public/assets/levels/<name>.glb` DANS `session` —
   * voir `game/level/hotReload.ts` pour le mécanisme de session/hot reload
   * lui-même (INCHANGÉ par ce jalon). `session` explicite, même raison que
   * `spawnSuitAt` : appelée depuis `bootGameSession` pendant la construction
   * d'une session qui n'est pas encore `currentSession`, ET depuis la
   * console (`cassandre.level.load`, qui doit lui viser LA session
   * courante — voir `exposeDebugApi`).
   */
  function loadGltfLevel(session: GameSession, name: string): void {
    session.gltfLevelSession?.stop();
    const url = `/assets/levels/${name}.glb`;
    session.gltfLevelSession = createLevelSession(url, scene, session.physics, {
      onLoaded: (handle, info) => {
        const navGraphBounds = new THREE.Box3().setFromObject(handle.root);
        session.currentNavGraph = runGameplaySync(
          PathfindingService.use((pf) => pf.bake(session.physics, navGraphBounds)),
        );
        const navStats = navGraphStats(session.currentNavGraph);
        console.info(
          `[pathfinding] graphe baké — ${navStats.walkableCount}/${navStats.cellCount} cellules praticables, ` +
            `${navStats.edgeCount} arêtes (grille ${navStats.cols}×${navStats.rows}, pas ${navStats.cellSize} m)`,
        );

        console.info(
          `[level] "${name}.glb" chargé — colliders ${handle.stats.colliderCount}, ` +
            `spawns Costard ${handle.stats.spawnSuitCount}, spawns Directeur ${handle.stats.spawnDirectorCount}, ` +
            `triggers ${handle.stats.triggerCount}, ` +
            `portes ${handle.stats.doorCount}, use ${handle.stats.useCount}, ` +
            `secrets ${handle.stats.secretCount}, meshes non préfixés ${handle.stats.unprefixedMeshCount}`,
        );
        // Seul le TOUT PREMIER chargement DE CETTE SESSION déplace le
        // joueur : un hot reload ne doit JAMAIS respawn (voir la doc de tête
        // de `hotReload.ts`) — c'est le critère central de ce pipeline
        // (<60 s, joueur en place). `isFirstLoad` est réarmé à `true` par
        // `createLevelSession` à CHAQUE nouvel appel (nouvelle `session`,
        // donc nouvelle fermeture) — un "Rejouer" respawn donc bien le
        // joueur sur `spawn_player`, exactement comme le tout premier boot.
        if (info.isFirstLoad && handle.spawnPlayer) {
          session.player.spawn(handle.spawnPlayer.position.x, handle.spawnPlayer.position.y, handle.spawnPlayer.position.z);
          look.yaw = handle.spawnPlayer.yaw;
          look.pitch = 0;
        }

        // `handle.spawnSuits` (Empties `spawn_suit_*`, voir `loader.ts`) :
        // MÊME garde `isFirstLoad` que `spawn_player` juste au-dessus.
        // `SuitManager` n'expose aucun retrait en masse aujourd'hui (seul un
        // retrait par mort individuelle) — un hot reload PENDANT une partie
        // ne duplique donc jamais de Costards et n'interrompt jamais un
        // combat en cours.
        if (info.isFirstLoad) {
          for (const spawn of handle.spawnSuits) {
            spawnSuitAt(session, spawn.position.x, spawn.position.y, spawn.position.z);
          }
          // `handle.spawnDirectors` (Empties `spawn_director_*`) : même garde
          // `isFirstLoad`, même raison exacte que `spawn_suit_*` ci-dessus.
          for (const spawn of handle.spawnDirectors) {
            spawnDirectorAt(session, spawn.position.x, spawn.position.y, spawn.position.z);
          }
        }

        // Compteur de secrets (`debug.secretsTotal`) : fixé à CHAQUE
        // chargement (pas seulement `isFirstLoad`) puisque `handle.secrets`
        // change avec le niveau chargé — contrairement aux spawns, ce n'est
        // pas un événement ponctuel de partie mais une propriété du niveau
        // courant.
        useGameStore.getState().setSecretsTotal(handle.stats.secretCount);
      },
    });
  }

  /**
   * Wrapper console pour `PathfindingService.findPath` sur le graphe
   * COURANT DE `session` (`cassandre.pathfinding.findPath(...)`), pour
   * visualiser/vérifier un chemin en direct. `null` si aucun graphe n'est
   * encore baké ou si aucun chemin n'a été trouvé — jamais d'exception qui
   * remonterait à la console.
   */
  function debugFindPath(session: GameSession, from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
    const graph = session.currentNavGraph;
    if (!graph) return null;
    const result = runGameplaySync(
      PathfindingService.use((pf) => pf.findPath(graph, from, to)).pipe(Effect.catch(() => Effect.succeed(null))),
    );
    return result ? Array.from(result) : null;
  }

  /**
   * Jalon M8 (PLAN_EFFECT_XSTATE.md, §10) — construit une PARTIE complète :
   * `PhysicsWorld` (donc `player`/`weapons`/`suitManager`/`directorManager`,
   * tous construits À PARTIR de `physics`), la géométrie du niveau (gym ou
   * session glTF), tout l'état de suivi par partie (badge/porte/secrets...),
   * et remet `game/state.ts` (`debug`, `hudMessage`, `heroLine`) à ses
   * valeurs de boot. Appelée UNE FOIS au tout premier boot ET à nouveau à
   * chaque "Rejouer"/"Retour au menu" (`replay`/`returnToMenu` plus bas) —
   * c'est ce réemploi qui rend le reset possible : avant ce jalon, cette
   * séquence n'existait qu'inline dans `main()`, exécutée une seule fois.
   *
   * Ce qui N'EST PAS reconstruit ici (voir la doc de `GameSession`) :
   * `scene`/`camera`/`renderer`, `clock`, `fx`/`viewmodel`/`crosshair`/
   * `hitmarker`/`ballisticsDebug`/`wireframeToggle`, `look`/`lookDelta`,
   * `interaction`, tous les atlas/géométries/matériaux partagés — ces
   * systèmes sont STATELESS vis-à-vis d'une partie précise (ou leur état
   * interne, comme le `WeakSet` d'`interaction`, s'auto-invalide sans code
   * de reset dédié, voir sa doc).
   */
  function bootGameSession(choice: LevelDef): GameSession {
    // Remis à ses valeurs de boot AVANT de construire quoi que ce soit :
    // `session.playerHp` ci-dessous lit `debug.playerMaxHp` fraîchement reset.
    useGameStore.getState().resetGameStore();

    const physics = new PhysicsWorld();
    const player = new PlayerController(physics);

    let gymRoot: THREE.Group | null = null;
    let ballMesh: THREE.Mesh | null = null;
    let ballBody: RAPIER.RigidBody | null = null;

    // `buildGym` (géométrie + colliders de la gym) n'est appelé QUE sur le
    // chemin "gym" : sur le chemin "gltf", zéro géométrie/collider de la gym
    // ne doit exister en mémoire, pas juste être caché — les deux chemins
    // sont mutuellement exclusifs.
    if (choice.kind === "gym") {
      gymRoot = new THREE.Group();
      scene.add(gymRoot);
      const gym = buildGym(gymRoot, physics);
      player.spawn(gym.spawn.x, gym.spawn.y + SPAWN_FEET_GUARD, gym.spawn.z);
      look.yaw = gym.spawnYaw;
      look.pitch = 0;

      ballMesh = new THREE.Mesh(
        new THREE.SphereGeometry(BALL_RADIUS, 16, 12),
        new THREE.MeshLambertMaterial({ color: 0x4488cc }),
      );
      gymRoot.add(ballMesh); // enfant de gymRoot, pas de scene -- voir la doc de `GameSession.gymRoot`.

      ballBody = physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(3, 4, 0).setLinvel(-2, 0, 3),
      );
      physics.world.createCollider(
        RAPIER.ColliderDesc.ball(BALL_RADIUS)
          .setRestitution(0.7)
          // Groupe WORLD : elle doit rester heurtable par le joueur (un groupe
          // DEBRIS ne collisionnerait qu'avec le décor).
          .setCollisionGroups(COLLISION_GROUPS.WORLD),
        ballBody,
      );
    } else {
      // Chemin glTF : pas de spawn connu ici (le chargement, plus bas, est
      // asynchrone). Position transitoire sûre et documentée : le joueur
      // tombe quelques pas fixes dans le vide (gravité −25 m/s², invariant
      // #7) jusqu'à ce que le callback `onLoaded` de `loadGltfLevel` le
      // repositionne sur `spawn_player` du `.glb`.
      player.spawn(0, 2, 0);
      look.yaw = 0;
      look.pitch = 0;
    }

    const weapons = new WeaponSystem(physics, clock);
    const suitManager = new SuitManager(physics);
    const directorManager = new DirectorManager(physics);

    const session: GameSession = {
      choice,
      physics,
      player,
      weapons,
      suitManager,
      suitSprites: new Map(),
      directorManager,
      directorSprites: new Map(),
      gymRoot,
      ballMesh,
      ballBody,
      gltfLevelSession: null,
      currentNavGraph: null,
      badgeMesh: null,
      hasBadge: false,
      unlockedDoors: new Set(),
      openingDoor: null,
      exitDoorTracking: null,
      foundSecrets: new WeakSet(),
      playerHp: useGameStore.getState().debug.playerMaxHp,
      firstKillTriggered: false,
      lowHpLineTriggered: false,
      deathHandled: false,
      levelCompleteHandled: false,
      lastHeroLineAt: -Infinity,
    };

    // Loadout de départ : `LevelDef.startUnarmed` (registre `game/level/levels.ts`).
    if (choice.startUnarmed) {
      weapons.startUnarmed();
    }

    // 3 points de spawn dans le hub (chemin "gym" seulement — POSITIONS DE
    // TEST DE LA GYM, pas du contenu générique de moteur) : dispersés autour
    // du spawn joueur (0, 0, -10), à 15-22 m (au-delà de la portée de
    // mêlée, en-deçà de `suitConfig.sightRange`), et à >= 8 m de n'importe
    // quel mur du hub. Les niveaux glTF ont leurs propres `spawn_suit_*`,
    // consommés dans `loadGltfLevel` ci-dessus.
    if (choice.kind === "gym") {
      spawnSuitAt(session, -9, SPAWN_FEET_GUARD, 5);
      spawnSuitAt(session, 9, SPAWN_FEET_GUARD, 5);
      spawnSuitAt(session, 0, SPAWN_FEET_GUARD, 13);
    } else if (choice.gltfName) {
      loadGltfLevel(session, choice.gltfName);
    }

    return session;
  }

  /**
   * Jalon M8 — détruit une PARTIE complète : dispose la session de niveau
   * glTF (retire sa géométrie de `scene`, libère GPU — voir
   * `loader.ts::disposeLevelResource`, déjà correct, inchangé), retire toute
   * la géométrie propre à `session` de `scene` (gym + balle de test, en un
   * seul `scene.remove(gymRoot)` — voir la doc de `GameSession.gymRoot` —
   * puis dispose leurs géométries/matériaux, gym étant un chemin dev
   * potentiellement rejoué plusieurs fois de suite), dispose les sprites
   * billboard (Costards + Directeur, `BillboardSprite.dispose()` gère déjà
   * retrait de scène + libération géométrie/matériau/texture propres à
   * l'instance), retire le mesh du badge s'il traînait, puis
   * `physics.world.free()` EN DERNIER — API Rapier brute déjà utilisée ainsi
   * dans `simulateRecording` (`main.ts`), confirmée par
   * `node_modules/.../pipeline/world.d.ts` : libérer le monde libère TOUS
   * ses corps/colliders/`KinematicCharacterController` d'un coup, "no need
   * to call their `.free()` methods individually" — donc aucun nettoyage
   * Rapier séparé n'est nécessaire pour `player`/`suitManager`/
   * `directorManager`/`weapons`, qui deviennent simplement inatteignables et
   * seront ramassés par le GC JS normal.
   */
  function teardownGameSession(session: GameSession): void {
    session.gltfLevelSession?.stop();

    if (session.gymRoot) {
      session.gymRoot.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) material.dispose();
      });
      scene.remove(session.gymRoot);
    }

    for (const sprite of session.suitSprites.values()) sprite.dispose();
    session.suitSprites.clear();
    for (const sprite of session.directorSprites.values()) sprite.dispose();
    session.directorSprites.clear();

    // Géométrie/matériau du badge sont PARTAGÉS (`badgeGeometry`/`badgeMaterial`,
    // persistants) — seule l'instance de mesh est propre à la partie, donc
    // seul un `remove` est nécessaire ici, jamais de `dispose()` dessus.
    if (session.badgeMesh) scene.remove(session.badgeMesh);

    session.physics.world.free();
  }

  /**
   * "Rejouer" (`dead`/`levelComplete -> playing`) — reconstruit EXACTEMENT
   * le même `LevelDef` que la partie qui vient de se terminer
   * (`session.choice`). Aucun `root.render()` ici : `App` reste monté tout
   * du long (voir plus bas), seul `state.flowState` change (`DeathScreen`/
   * `LevelCompleteScreen` redeviennent `null`) — c'est ce qui rend "Rejouer"
   * instantané, sans le moindre rechargement de page.
   */
  function replay(): void {
    const choice = currentSession.choice;
    teardownGameSession(currentSession);
    currentSession = bootGameSession(choice);
    flowActor.send({ type: "REPLAY" });
  }

  /**
   * "Retour au menu principal" (`dead`/`levelComplete -> mainMenu`) —
   * détruit la partie courante puis réaffiche `MainMenu` en réutilisant
   * `resolveBootChoice` TEL QUEL (même fonction que le tout premier boot,
   * non dupliquée).
   *
   * Réplique la garantie de l'ancien `reloadToMainMenu()` (`ui/screenNav.ts`,
   * supprimé par ce jalon) : peu importe comment CETTE partie a démarré
   * (`?level=...` ou le vrai menu), "Retour au menu principal" doit
   * toujours retomber sur le VRAI menu principal, jamais rejouer
   * silencieusement le même `?level=` bypass. `resolveBootChoice` relit
   * `window.location.search` FRAÎCHEMENT à chaque appel (voir sa doc) — on
   * retire donc `level` de l'URL AVANT de la rappeler, via `history.replaceState`
   * (pas de rechargement de page, contrairement à l'ancienne implémentation).
   */
  function returnToMenu(): void {
    teardownGameSession(currentSession);
    flowActor.send({ type: "RETURN_TO_MENU" });

    const url = new URL(window.location.href);
    url.searchParams.delete("level");
    window.history.replaceState(null, "", url.toString());

    resolveBootChoice(root).then((choice) => {
      currentSession = bootGameSession(choice);
      root.render(createElement(App, { onReplay: replay, onReturnToMenu: returnToMenu }));
      flowActor.send({ type: "PLAY" });
    });
  }

  /**
   * Capture l'input du pas fixe courant. Le saut est CONSOMMÉ ici, une seule
   * fois. Lit par NOM D'ACTION (`core/input.ts::GameAction`), pas par code
   * brut : la table de bindings est rebindable/persistée dans `InputManager`,
   * `InputFrame` reste inchangé (mêmes champs, même sémantique) quel que soit
   * le binding physique réellement pressé.
   */
  function captureInputFrame(): InputFrame {
    liveFrame.forward = input.isActionDown("moveForward");
    liveFrame.back = input.isActionDown("moveBack");
    liveFrame.left = input.isActionDown("moveLeft");
    liveFrame.right = input.isActionDown("moveRight");
    liveFrame.sprint = input.isActionDown("sprint");
    liveFrame.jump = input.consumeActionJustPressed("jump");
    liveFrame.fire = input.consumeActionJustPressed("fire");
    liveFrame.switchToMelee = input.consumeActionJustPressed("switchMelee");
    liveFrame.switchToShotgun = input.consumeActionJustPressed("switchShotgun");
    liveFrame.use = input.consumeActionJustPressed("use");
    liveFrame.yaw = look.yaw;
    liveFrame.pitch = look.pitch;
    liveFrame.dx = lookDelta.dx;
    liveFrame.dy = lookDelta.dy;
    lookDelta.dx = 0;
    lookDelta.dy = 0;
    return liveFrame;
  }

  function startRecording(session: GameSession) {
    inputRecorder.startRecording(
      {
        position: { x: session.player.position.x, y: session.player.position.y, z: session.player.position.z },
        velocity: { x: session.player.velocity.x, y: session.player.velocity.y, z: session.player.velocity.z },
        yaw: look.yaw,
        pitch: look.pitch,
      },
      FIXED_DT,
    );
  }

  function startPlayback(session: GameSession, rec: Recording) {
    const feetY = rec.start.position.y - (moveConfig.capsuleHalfHeight + moveConfig.capsuleRadius);
    session.player.spawn(rec.start.position.x, feetY, rec.start.position.z);
    session.player.velocity.set(rec.start.velocity.x, rec.start.velocity.y, rec.start.velocity.z);
    look.yaw = rec.start.yaw;
    look.pitch = rec.start.pitch;
    inputRecorder.startPlayback(rec);
  }

  let lastRecording: Recording | null = null;

  let fpsSmoothed = 60;
  let debugAccumulator = 0;
  const DEBUG_UPDATE_INTERVAL = 1 / 10; // invariant #2 : 10 Hz maximum

  // --- Jalon M8 : construction de la toute première partie -----------------
  // Même chemin EXACTEMENT que "Rejouer"/"Retour au menu" (`replay`/
  // `returnToMenu` ci-dessus) : `bootGameSession` ne sait pas distinguer un
  // premier boot d'un reset, par construction.
  let currentSession: GameSession = bootGameSession(choice);

  // `<App/>` (HUD de prod + DebugPanel + écrans de fin de partie) monté
  // APRÈS la construction du monde (contrairement à avant ce jalon, où il
  // était monté juste après `resolveBootChoice`, avant même la scène/la
  // physique) : `onReplay`/`onReturnToMenu` référencent `currentSession`, qui
  // doit exister avant que ces callbacks puissent être invoqués — trivialement
  // vrai ici puisqu'un clic utilisateur ne peut survenir qu'après la fin de
  // ce script synchrone. Léger changement de timing (le HUD apparaît après
  // l'init physique/le premier chargement de niveau, quelques dizaines de ms
  // plus tard qu'avant) — sans effet observable en pratique, et plus correct
  // sémantiquement (afficher "PV: 100/100" avant qu'un joueur existe n'avait
  // pas vraiment de sens).
  root.render(createElement(App, { onReplay: replay, onReturnToMenu: returnToMenu }));

  startLoop({
    snapshotPrevious() {
      const session = currentSession;
      session.player.snapshotPrevious();
      session.weapons.snapshotPrevious();
      session.suitManager.snapshotPrevious();
      session.directorManager.snapshotPrevious();
      ballPrevPos.copy(ballCurrPos);
      ballPrevQuat.copy(ballCurrQuat);
    },

    // Décide le mouvement AVANT le step : la translation cible est consommée
    // par le `world.step()` du même pas fixe (voir l'ordre dans core/loop.ts).
    updateGameplay(dt) {
      const session = currentSession;

      // Mort / niveau terminé (Phase 6) : le pas fixe continue de tourner
      // (invariant #1, la boucle ne s'arrête JAMAIS), mais tout le gameplay
      // est ignoré une fois la partie hors de l'état "playing" — déplacement,
      // tir, dégâts, interactions. PAS une violation de l'invariant #10
      // ("aucune animation ne bloque le joueur") : cet invariant vise les
      // animations NON LÉTALES, pas une fin de partie légitime. Rien n'est
      // mis à jour ce pas-ci : le monde reste visuellement figé sur son
      // dernier état (prev === curr à chaque pas suivant), aucun jitter
      // d'interpolation.
      //
      // Jalon M8 (PLAN_EFFECT_XSTATE.md, §10) : lecture DIRECTE de l'acteur
      // de flux (`flowActor.getSnapshot().value`), PAS un aller-retour par le
      // store zustand (`state.flowState` n'existe que pour les composants
      // React, voir sa doc dans `game/state.ts`) — l'acteur est déjà
      // synchrone et disponible ici, un détour zustand n'apporterait rien au
      // pas fixe. Remplace les deux booléens `isDead`/`isLevelComplete`
      // retirés de `game/state.ts` par ce même jalon — c'est exactement le
      // travail que M6 avait explicitement REPORTÉ ici.
      if (flowActor.getSnapshot().value !== "playing") return;

      // Jalon M6 (PLAN_EFFECT_XSTATE.md, §8) : le corps du pas fixe devient un
      // seul Effect composé, séquencé en phases nommées — EXACTEMENT le même
      // ordre et les mêmes appels qu'avant ce jalon, aucune réorganisation.
      runGameplaySync(
        Effect.gen(function* () {
          const gameplayDt = clock.tick(dt);

          const activeFrame = yield* Effect.sync((): InputFrame => {
            let frame: InputFrame | null;
            if (inputRecorder.isPlaying()) {
              frame = inputRecorder.nextFrame();
              if (frame) {
                look.yaw = frame.yaw;
                look.pitch = frame.pitch;
              }
            } else {
              frame = captureInputFrame();
              if (inputRecorder.isRecording()) inputRecorder.record(frame);
            }
            return frame ?? emptyInputFrame();
          });

          yield* Effect.sync(() => session.player.update(gameplayDt, activeFrame));

          // Interaction (`use_*`, touche E) — APRÈS `player.update` (donc
          // `player.position` déjà avancée ce pas-ci) et AVANT `weapons.update`
          // pour qu'un ramassage et un tir puissent se produire dans le même pas
          // fixe (raffinement, pas une exigence). `useObjects` est RELUE ici à
          // chaque appel, jamais mise en cache : un hot reload remplace tout le
          // tableau (voir `interactive.ts`/`hotReload.ts`).
          yield* Effect.sync(() =>
            interaction.update(activeFrame.use, session.gltfLevelSession?.current?.useObjects ?? [], session.player.position, {
              onCrowbarPickup: () => session.weapons.pickUpMelee(),
              onShotgunPickup: () => session.weapons.pickUpShotgun(),
              onExitDoorUse: (targetName) => {
                if (session.unlockedDoors.has(targetName)) return; // déjà déverrouillée
                if (!session.hasBadge) {
                  showHudMessage("Badge du Directeur requis");
                  playDoorSfx("locked");
                  return;
                }
                // `targetName === "door_e_exit"` : seule cette porte arme le suivi
                // de fin de niveau (voir la doc de `ExitDoorTracking`) —
                // `door_b_frozen` (secret 1, `onFrozenStorageUse` ci-dessous)
                // partage la même mécanique de porte mais n'est jamais une sortie.
                if (unlockDoor(session, targetName, "Porte déverrouillée") && targetName === "door_e_exit") {
                  setupExitDoorTracking(session, targetName);
                }
              },
              onFrozenStorageUse: (targetName) => {
                if (session.unlockedDoors.has(targetName)) return; // déjà ouverte
                unlockDoor(session, targetName, "Rayon surgelés ouvert");
              },
              onPaMicUse: () => {
                triggerHeroLine(session, HERO_LINE_PA_MIC);
              },
              onToiletUse: () => {
                const maxHp = useGameStore.getState().debug.playerMaxHp;
                if (session.playerHp >= maxHp) {
                  showHudMessage("Vous êtes déjà en pleine forme.");
                  return;
                }
                session.playerHp = Math.min(maxHp, session.playerHp + TOILET_HEAL_AMOUNT);
                useGameStore.getState().setPlayerHp(session.playerHp);
                // Info FACTUELLE (canal système, sans cooldown) + réplique
                // (canal dédié, cooldownée) — voir la ligne de partage documentée
                // sur `hudMessage`/`heroLine` dans `game/state.ts`.
                showHudMessage(`+${TOILET_HEAL_AMOUNT} PV`);
                triggerHeroLine(session, HERO_LINE_TOILET);
              },
            }),
          );

          // Origine de tir du pas fixe COURANT, lue APRÈS `player.update` (donc
          // déjà avancée ce pas-ci) : centre de capsule + eyeOffset, jamais la
          // position interpolée pour le rendu. Voir la note de déterminisme dans
          // `WeaponSystem.update` — une origine interpolée casserait le rejeu
          // exact du raycast d'arme.
          yield* Effect.sync(() => {
            weaponEyeOrigin.set(
              session.player.position.x,
              session.player.position.y + session.player.eyeOffset,
              session.player.position.z,
            );
            session.weapons.update(gameplayDt, activeFrame, weaponEyeOrigin, activeFrame.yaw, activeFrame.pitch);
          });

          // APRÈS `weapons.update` : les `hitEvents` du pas courant existent déjà
          // (voir la doc de `SuitManager.update`). `player.position` sert de
          // cible de poursuite (XZ), `weaponEyeOrigin` — la même origine
          // AUTHENTIQUE que celle qui vient de servir aux raycasts d'armes,
          // jamais une position interpolée — sert de cible de ligne de
          // vue/visée pour les Costards.
          yield* Effect.sync(() => {
            session.suitManager.update(gameplayDt, session.player.position, weaponEyeOrigin, session.weapons.hitEvents, session.currentNavGraph);
            session.directorManager.update(gameplayDt, session.player.position, weaponEyeOrigin, session.weapons.hitEvents, session.currentNavGraph);
          });

          // Résolution badge / porte / sortie de niveau / secrets — même
          // ordre et mêmes corps qu'avant ce jalon, regroupés en une seule
          // phase finale (aucun de ces blocs ne dépend d'un Effect en soi).
          yield* Effect.sync(() => {
            // Badge du Directeur : apparition (mesh) à la mort, une seule fois ;
            // ramassage par proximité SEULE (pas de touche E, voir la doc de
            // `DirectorBadge`) — même discipline de mutation directe en pas fixe
            // que `interaction.update` ci-dessus pour `use_crowbar`.
            if (session.directorManager.badge && !session.badgeMesh) {
              session.badgeMesh = new THREE.Mesh(badgeGeometry, badgeMaterial);
              session.badgeMesh.position.copy(session.directorManager.badge.position);
              scene.add(session.badgeMesh);
            }
            if (session.directorManager.tryCollectBadge(session.player.position) && session.badgeMesh) {
              scene.remove(session.badgeMesh);
              session.badgeMesh = null;
              session.hasBadge = true;
              showHudMessage("Badge du Directeur récupéré");
            }

            // Glissement cosmétique de la porte débloquée (voir sa doc plus haut) —
            // le collider est déjà désactivé depuis le déverrouillage, ceci ne fait
            // que déplacer le mesh hors du passage.
            if (session.openingDoor) {
              session.openingDoor.t = Math.min(1, session.openingDoor.t + gameplayDt / DOOR_OPEN_DURATION);
              const y = session.openingDoor.startY + (session.openingDoor.targetY - session.openingDoor.startY) * session.openingDoor.t;
              const current = session.openingDoor.body.translation();
              session.openingDoor.body.setTranslation({ x: current.x, y, z: current.z }, true);
              if (session.openingDoor.t >= 1) session.openingDoor = null;
            }

            // Fin de niveau : franchissement du vantail déverrouillé — voir la
            // doc de `ExitDoorTracking` en tête de fichier. `exitDoorTracking`
            // reste `null` tant que `door_e_exit` n'a jamais été déverrouillée
            // sur CETTE session (armé uniquement dans `onExitDoorUse` ci-dessus) :
            // ce bloc ne se déclenche donc JAMAIS sur un niveau qui n'a pas cette
            // porte (`gym`, n'importe quelle zone individuelle A-D).
            if (session.exitDoorTracking) {
              exitDoorOffsetScratch.subVectors(session.player.position, session.exitDoorTracking.doorPosition);
              const signedInsideDistance =
                exitDoorOffsetScratch.dot(session.exitDoorTracking.crossingAxis) * session.exitDoorTracking.insideSign;
              if (signedInsideDistance < -(session.exitDoorTracking.halfExtentOnAxis + EXIT_CROSSING_MARGIN)) {
                triggerLevelComplete(session);
              }
            }

            // Secrets : présence dans le volume AABB, voir la doc de `foundSecrets`
            // dans `GameSession`. `secrets` est RELUE ici à chaque appel, jamais
            // mise en cache — même discipline que `useObjects`/`doors` ci-dessus.
            for (const secret of session.gltfLevelSession?.current?.secrets ?? []) {
              if (session.foundSecrets.has(secret.object)) continue;
              const p = session.player.position;
              const inside =
                p.x >= secret.min.x &&
                p.x <= secret.max.x &&
                p.y >= secret.min.y &&
                p.y <= secret.max.y &&
                p.z >= secret.min.z &&
                p.z <= secret.max.z;
              if (!inside) continue;
              session.foundSecrets.add(secret.object);
              useGameStore.getState().incrementSecretsFound();
              const found = useGameStore.getState().debug.secretsFound;
              const total = useGameStore.getState().debug.secretsTotal;
              // Info FACTUELLE (n/total, sans cooldown) + réplique de réaction
              // (canal dédié, cooldownée) — même partage que `onToiletUse`.
              showHudMessage(`Secret trouvé ! (${found}/${total})`);
              playSfx("secret_found");
              triggerHeroLine(session, HERO_LINE_SECRET_REACTION);
            }
          });
        }),
      );
    },

    stepPhysics(dt) {
      // Jalon M8 : voir la doc de `isPhysicsSessionLive` — sans cette garde,
      // la fenêtre transitoire de `returnToMenu()` (session déjà `free()`-ée,
      // pas encore remplacée) ferait planter cet appel (accès à un monde
      // Rapier WASM déjà libéré). PAS la même garde que `updateGameplay`
      // (celle-ci accepte aussi `dead`/`levelComplete` : le monde y est
      // encore parfaitement vivant, seul le CONTENU du pas fixe est ignoré,
      // invariant #1 — voir sa doc).
      if (!isPhysicsSessionLive()) return;
      const session = currentSession;
      // Jalon M6 (PLAN_EFFECT_XSTATE.md, §8) : fait partie du pas fixe au
      // sens de l'invariant #1 (comme `updateGameplay` ci-dessus), donc du
      // même périmètre — trivial, un seul `Effect.sync`, aucune séquence à
      // composer.
      runGameplaySync(
        Effect.sync(() => {
          session.physics.step(dt);
          // `ballBody` n'existe que sur le chemin "gym" (voir `bootGameSession`)
          // — rien à mettre à jour sinon, pas un bug.
          if (session.ballBody) {
            const t = session.ballBody.translation();
            const r = session.ballBody.rotation();
            ballCurrPos.set(t.x, t.y, t.z);
            ballCurrQuat.set(r.x, r.y, r.z, r.w);
          }
        }),
      );
    },

    interpolateVisuals(alpha) {
      const session = currentSession;
      // Jalon M7 (PLAN_EFFECT_XSTATE.md, §9) : ce callback tourne au TAUX
      // D'AFFICHAGE (pas le pas fixe) — même frontière synchrone stricte
      // (principe transverse #1 du plan : "pour tout ce qui vit dans le pas
      // fixe OU dans la boucle d'affichage"), donc même garde-fou
      // `runGameplaySync`. Composé en phases nommées, même discipline que
      // M6 pour `updateGameplay`.
      runGameplaySync(
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            if (session.ballMesh) {
              session.ballMesh.position.lerpVectors(ballPrevPos, ballCurrPos, alpha);
              session.ballMesh.quaternion.slerpQuaternions(ballPrevQuat, ballCurrQuat, alpha);
            }
          });

          // EXCEPTION EXPLICITE, non négociable (invariant #3, voir
          // PLAN_EFFECT_XSTATE.md §9) : la rotation caméra reste un
          // Effect.sync FEUILLE, sans aucune indirection de service — un
          // enveloppement plus profond (générateur imbriqué, service)
          // ajouterait de la latence de visée. Rotation lue au taux
          // d'affichage, jamais interpolée (latence de visée sinon).
          yield* Effect.sync(() => {
            const { dx, dy } = input.consumeMouseDelta();
            if (!inputRecorder.isPlaying()) {
              lookDelta.dx += dx;
              lookDelta.dy += dy;
              look.yaw -= dx * moveConfig.lookSensitivity;
              look.pitch -= dy * moveConfig.lookSensitivity;
              const pitchLimit = (moveConfig.pitchLimitDeg * Math.PI) / 180;
              look.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, look.pitch));
            }
            cameraEuler.set(look.pitch, look.yaw, 0);
            camera.quaternion.setFromEuler(cameraEuler);
          });

          yield* Effect.sync(() => {
            // Position caméra : capsule interpolée + hauteur des yeux.
            camera.position.copy(session.player.eyePosition(alpha, eyePosition));

            // Head bob + enfoncement de réception : ajoutés à la POSITION de la
            // caméra, jamais à sa rotation. La visée garde donc exactement la latence
            // et la stabilité qu'elle avait (invariant #3), et `player.eyePosition`
            // reste disponible non bobée comme origine de tir pour la Phase 2.
            const bob = session.player.viewBob(alpha, viewBobOffset);
            if (bob.x !== 0 || bob.y !== 0) {
              // Vecteur « droite » du joueur dans le plan horizontal. Avec l'Euler
              // 'YXZ' et un roll nul, l'axe droite de la caméra EST horizontal quel
              // que soit le pitch : (cos yaw, 0, −sin yaw), même convention que la
              // dérivation de wishX/wishZ dans PlayerController.update.
              camera.position.x += bob.x * Math.cos(look.yaw);
              camera.position.z += bob.x * -Math.sin(look.yaw);
              camera.position.y += bob.y;
            }

            // FOV : suit la vitesse horizontale RÉELLE (déjà reclippée sur le
            // mouvement effectivement réalisé — courir contre un mur n'élargit rien),
            // pas l'état de la touche sprint. Le facteur est lissé au pas fixe et
            // interpolé ici, donc la transition est continue à n'importe quel taux
            // d'affichage. `updateProjectionMatrix` n'est appelée que si la valeur
            // change vraiment : le lissage se colle exactement à sa cible, donc les
            // appels cessent dès que la vitesse est stable.
            const fov = fovForRunFactor(moveConfig, session.player.runFactorAt(alpha));
            if (camera.fov !== fov) {
              camera.fov = fov;
              camera.updateProjectionMatrix();
            }

            // Viewmodel : APRÈS que position/rotation/FOV de la caméra sont posés
            // ci-dessus — l'offset de `weapons.viewmodelPose` est purement local à
            // la caméra (voir `render/viewmodel.ts`), il n'a pas besoin de les lire,
            // mais reste cohérent dans la même frame en s'appliquant après eux.
            // Aucun reset explicite nécessaire au changement de session (Jalon M8) :
            // `viewmodel.update` relit `session.weapons.activeWeapon` EN DIRECT à
            // chaque frame, donc dès le premier appel qui suit un reset, il affiche
            // déjà la pose correcte pour la NOUVELLE session — voir la doc de tête
            // de `render/viewmodel.ts`.
            viewmodel.update(alpha, session.weapons);
          });

          yield* Effect.sync(() => {
            // Costards : position/forward interpolés (jamais les valeurs brutes du
            // pas fixe, voir la doc de `BillboardSprite.updatePose`), une fois par
            // Costard vivant OU cadavre (le cadavre reste affiché, figé).
            for (const suit of session.suitManager.suits) {
              const sprite = session.suitSprites.get(suit.id);
              if (!sprite) continue;
              const pos = suit.interpolatedPosition(alpha, suitPositionScratch);
              const fwd = suit.interpolatedForward(alpha, suitForwardScratch);
              sprite.updatePose(camera, pos, fwd, suit.spriteRow);
            }

            // Même chose pour le Directeur (au plus un, mais `directors` reste un
            // tableau — voir la doc de `DirectorManager`).
            for (const director of session.directorManager.directors) {
              const sprite = session.directorSprites.get(director.id);
              if (!sprite) continue;
              const pos = director.interpolatedPosition(alpha, directorPositionScratch);
              const fwd = director.interpolatedForward(alpha, directorForwardScratch);
              sprite.updatePose(camera, pos, fwd, director.spriteRow);
            }
          });
        }),
      );
    },

    updateFx(realDt, stats) {
      const session = currentSession;
      // Jalon M7 (PLAN_EFFECT_XSTATE.md, §9) : même frontière synchrone que
      // `interpolateVisuals` ci-dessus (taux d'affichage, principe
      // transverse #1) — composé en phases nommées, mêmes statements et même
      // ordre qu'avant ce jalon, aucune logique changée.
      runGameplaySync(
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            if (realDt > 0) {
              fpsSmoothed += (1 / realDt - fpsSmoothed) * 0.1;
            }

            fx.update(realDt);
            // Décroissance temps réel des minuteurs du hitmarker/réticule/gizmos —
            // même régime que `fx.update(realDt)` juste au-dessus, jamais le pas
            // fixe. `render()` (le dessin effectif des canvas 2D) est appelé en
            // tout dernier dans cette fonction, APRÈS les boucles ci-dessous qui
            // peuvent encore déclencher `hitmarker.trigger(...)`/`crosshair.notifyFire(...)`
            // pour CETTE frame.
            hitmarker.update(realDt);
            crosshair.update(realDt);
            ballisticsDebug.update(realDt);
          });

          yield* Effect.sync(() => {
            // Lecture NON DESTRUCTIVE de `weapons.fireEvents`/`hitEvents` : ces
            // files s'accumulent au fil des pas fixes de la frame et ne se vident
            // jamais toutes seules. clearFrameEvents() est appelé par `shell`, en
            // dernier, après consommation audio — ne JAMAIS l'appeler ici.
            for (const event of session.weapons.fireEvents) {
              fx.spawnMuzzleFlash(event.muzzlePosition, event.muzzleDirection, event.weapon);
              if (event.weapon === "shotgun") {
                fx.spawnShellCasing(event.muzzlePosition, event.muzzleDirection);
              }
              playWeaponFireSfx(event.weapon);
              // Réticule : pulsation à CHAQUE tir déclenché (indépendant d'un hit,
              // voir `CrosshairOverlay.notifyFire`), no-op si désactivée en config.
              crosshair.notifyFire();
              // Gizmos balistiques de debug : la forme RÉELLEMENT testée par ce
              // tir (voir `render/ballisticsDebug.ts`). Pompe : un rayon par
              // plomb, jusqu'à son impact ou `shotgunRange` (voir
              // `FireEvent.pelletEndpoints`). Pied-de-biche : la capsule de
              // `WeaponSystem.fireMelee`, reconstruite ici à partir de
              // `weaponConfig.meleeRange`/`meleeHitRadius` — mêmes nombres que la
              // requête Rapier, aucune duplication de valeur en dur.
              if (event.weapon === "shotgun" && event.pelletEndpoints) {
                ballisticsDebug.recordShotgunFire(event.muzzlePosition, event.pelletEndpoints);
              } else if (event.weapon === "melee") {
                ballisticsDebug.recordMeleeFire(
                  event.muzzlePosition,
                  event.muzzleDirection,
                  weaponConfig.meleeRange,
                  weaponConfig.meleeHitRadius,
                );
              }
            }
            for (const hit of session.weapons.hitEvents) {
              fx.spawnImpactDecal(hit.point, hit.normal, hit.material);
              fx.spawnImpactParticles(hit.point, hit.normal, hit.weapon);
              // Distinction mur/ennemi (retour playtest Phase 3, `IMPACT_VARIANTS`
              // dans `weaponConfig.ts`) : un hit ENEMY confirmé (matière `"flesh"`,
              // voir `FLESH_MATERIAL`/`materialForCollider` dans `weapons.ts`)
              // déclenche le shake `enemy*`, tout le reste (murs, décor) garde le
              // shake générique. Le hitstop, lui, est déjà branché à la source
              // dans `weapons.ts` (`triggerHitstopFor`) — pas dupliqué ici.
              const isEnemyHit = hit.material === FLESH_MATERIAL;
              fx.triggerShake(
                isEnemyHit ? weaponConfig.enemyShakeAmplitude : weaponConfig.shakeAmplitude,
                isEnemyHit ? weaponConfig.enemyShakeDuration : weaponConfig.shakeDuration,
              );
              // Hitmarker : uniquement sur un hit ENEMY confirmé — un hit mur n'a
              // pas vocation à alimenter ce canal (voir doc de `hitmarker.ts`).
              if (isEnemyHit) hitmarker.trigger("hit");
              playImpactSfx(hit.material);
            }
            // Clôture de la frame d'affichage pour les événements d'armes : TOUS
            // les lecteurs (`retro-render` ci-dessus, l'audio ci-dessus) ont fini
            // de lire `fireEvents`/`hitEvents` pour cette frame. Même principe que
            // `input.endFrame()` dans `core/loop.ts` — dernier appel de la chaîne,
            // jamais plus tôt (voir la doc de `clearFrameEvents` dans
            // `game/player/weapons.ts`).
            session.weapons.clearFrameEvents();
          });

          yield* Effect.sync(() => {
            // Décroissance TEMPS RÉEL du flash de dégâts de chaque Costard — jamais
            // au pas fixe (même séparation que `fx.update(realDt)` juste au-dessus).
            for (const sprite of session.suitSprites.values()) sprite.updateFlash(realDt);

            // Lecture NON DESTRUCTIVE des files de `suitManager`, même contrat que
            // `weapons.fireEvents`/`hitEvents` ci-dessus : tous les lecteurs
            // d'abord, `suitManager.clearFrameEvents()` en tout dernier.
            for (const event of session.suitManager.alertEvents) {
              void event; // pas de sprite dédié à l'alerte : la pose ALERTE (ligne d'atlas) suffit, le son est le seul canal supplémentaire ici.
              playEnemySfx("alert");
            }
            for (const event of session.suitManager.telegraphEvents) {
              void event;
              // Règle non négociable du skill : le son de télégraphie part AVANT
              // les dégâts (`suitConfig.attackTelegraphDuration` >= 0.2 s sépare ce
              // point de la résolution de l'attaque dans `Suit.runAttack`).
              playEnemySfx("telegraph");
            }
            for (const event of session.suitManager.hurtEvents) {
              // Triple feedback (skill enemy-state-machine) : flash blanc + son ici,
              // knockback déjà appliqué dans `Suit.applyDamage` (vélocité pilotée,
              // le Costard étant kinématique — voir sa doc). Durée du flash lue
              // depuis `suitConfig.hitFlashDuration` (tunable à chaud, voir sa doc
              // et `FLASH_VARIANTS`) au lieu de l'ancienne constante en dur.
              session.suitSprites.get(event.suit.id)?.setFlash(1, suitConfig.hitFlashDuration);
              playEnemySfx("hurt");
            }
            for (const event of session.suitManager.deathEvents) {
              if (event.gibs) {
                // Bout portant au pompe : gibs À LA PLACE de l'animation de mort
                // normale (le Costard reste en état "dead"/"corpse" côté simulation
                // pour la persistance du cadavre — seul le RENDU change ici).
                fx.spawnGibs(event.point, event.direction);
              }
              // Kill = sa propre fenêtre de hitmarker, distincte du hit simple (voir
              // `HitmarkerOverlay.trigger`) — confirmation visuelle qu'un Costard
              // vient d'être tué, indépendamment du sprite (qui peut être remplacé
              // par des gibs, donc potentiellement moins lisible ce pas-ci).
              hitmarker.trigger("kill");
              playEnemySfx("death");
              // Compteur de "vues" (Phase 6) + réplique "premier kill" (une seule
              // fois par partie, Costard OU Directeur confondus — voir la doc de
              // `GameSession.firstKillTriggered`).
              grantKillViews();
              if (!session.firstKillTriggered) {
                session.firstKillTriggered = true;
                triggerHeroLine(session, HERO_LINE_FIRST_KILL);
              }
            }
            for (const event of session.suitManager.playerHitEvents) {
              session.playerHp = Math.max(0, session.playerHp - event.amount);
              useGameStore.getState().setPlayerHp(session.playerHp);
              // Feedback via l'API PUBLIQUE déjà livrée de `fx`/`weapons`, aucune
              // modification de `render/fx.ts` : decal + particules au point
              // d'impact sur le joueur, léger screenshake dédié (`suitConfig`, pas
              // `weaponConfig` — c'est le coup encaissé, pas un tir du joueur).
              fx.spawnImpactDecal(event.point, event.normal, "flesh");
              fx.spawnImpactParticles(event.point, event.normal, "shotgun");
              fx.triggerShake(suitConfig.playerHitShakeAmplitude, suitConfig.playerHitShakeDuration);
              // PV bas / mort (Phase 6) — voir la doc de `handlePlayerHit`.
              handlePlayerHit(session);
            }
            session.suitManager.clearFrameEvents();
          });

          yield* Effect.sync(() => {
            // Même contrat (lecture non destructive, `clearFrameEvents()` en tout
            // dernier) pour le Directeur. Pas de réutilisation des sons `enemy_*` en
            // tant que "faits exprès pour le boss" — ce sont les mêmes placeholders
            // génériques que pour le Costard (invariant #9, aucun son dédié encore).
            for (const sprite of session.directorSprites.values()) sprite.updateFlash(realDt);

            for (const event of session.directorManager.alertEvents) {
              void event;
              playEnemySfx("alert");
            }
            for (const event of session.directorManager.telegraphEvents) {
              void event;
              playEnemySfx("telegraph");
            }
            for (const event of session.directorManager.hurtEvents) {
              session.directorSprites.get(event.director.id)?.setFlash(1, directorConfig.hitFlashDuration);
              playEnemySfx("hurt");
            }
            for (const event of session.directorManager.revealEvents) {
              // Bascule costume humain -> reptilien : teinte appliquée UNE FOIS ici
              // (événement discret), jamais reposée à chaque frame dans
              // `interpolateVisuals` — voir `Director.tintColor`/`revealed`.
              session.directorSprites.get(event.director.id)?.setTint(event.director.tintColor);
              fx.triggerShake(directorConfig.revealShakeAmplitude, directorConfig.revealShakeDuration);
            }
            for (const event of session.directorManager.deathEvents) {
              void event; // pas de gibs pour le Directeur (voir la doc de `DirectorManager`).
              hitmarker.trigger("kill");
              playEnemySfx("death");
              // Multiplicateur dédié : voir `VIEWS_DIRECTOR_MULTIPLIER`. Même garde
              // `firstKillTriggered` que le Costard — un seul flag, peu importe qui
              // décroche le tout premier kill de la partie.
              grantKillViews(VIEWS_DIRECTOR_MULTIPLIER);
              if (!session.firstKillTriggered) {
                session.firstKillTriggered = true;
                triggerHeroLine(session, HERO_LINE_FIRST_KILL);
              }
            }
            for (const event of session.directorManager.playerHitEvents) {
              session.playerHp = Math.max(0, session.playerHp - event.amount);
              useGameStore.getState().setPlayerHp(session.playerHp);
              fx.spawnImpactDecal(event.point, event.normal, "flesh");
              fx.spawnImpactParticles(event.point, event.normal, "shotgun");
              fx.triggerShake(directorConfig.playerHitShakeAmplitude, directorConfig.playerHitShakeDuration);
              handlePlayerHit(session);
            }
            session.directorManager.clearFrameEvents();
          });

          yield* Effect.sync(() => {
            // Offset de shake, ADDITIF, appliqué APRÈS le calcul de bob déjà posé
            // dans `interpolateVisuals` (qui s'exécute juste avant `updateFx` dans
            // l'ordre de la boucle, voir `core/loop.ts`) — jamais en écrasant
            // `player.eyePosition`/`camera.position` de base.
            camera.position.add(fx.currentShakeOffset(shakeOffsetScratch));

            // Outillage (hors gameplay, lu au taux d'affichage) : F9 enregistre,
            // F10 rejoue. Sert de harnais A/B et de preuve de déterminisme.
            // Jalon M8 : gardé par `isPhysicsSessionLive()` — `startRecording`/
            // `startPlayback` appellent `session.player.spawn(...)`, qui TOUCHE
            // Rapier (`body.setTranslation`) ; sans cette garde, appuyer sur
            // F9/F10 pendant la fenêtre transitoire de `returnToMenu()` (session
            // déjà `free()`-ée, pas encore remplacée) planterait — voir la doc de
            // `isPhysicsSessionLive`. Cas limite dev-only, coût de la garde nul.
            if (isPhysicsSessionLive()) {
              if (input.wasJustPressed("F9")) {
                if (inputRecorder.isRecording()) {
                  lastRecording = inputRecorder.stopRecording();
                  console.info(`[recorder] ${lastRecording?.frames.length ?? 0} pas fixes enregistrés`);
                } else {
                  startRecording(session);
                  console.info("[recorder] enregistrement démarré");
                }
              }
              if (input.wasJustPressed("F10") && lastRecording) {
                startPlayback(session, lastRecording);
                console.info(`[recorder] rejeu de ${lastRecording.frames.length} pas fixes`);
              }
            }
            // KeyV : wireframe de toute la scène, mutation ponctuelle sur appui
            // (invariant #2 — pas de lecture continue, pas de setState par frame).
            if (input.wasJustPressed("KeyV")) {
              const enabled = wireframeToggle.toggle();
              console.info(`[debug] wireframe ${enabled ? "activé" : "désactivé"}`);
            }
            // KeyB (ballistics) : gizmos balistiques de debug, actifs PAR DÉFAUT
            // (voir la doc de tête de `render/ballisticsDebug.ts`) — même pattern
            // de bascule ponctuelle que KeyV ci-dessus.
            if (input.wasJustPressed("KeyB")) {
              const enabled = ballisticsDebug.toggle();
              console.info(`[debug] gizmos balistiques ${enabled ? "activés" : "désactivés"}`);
            }

            debugAccumulator += realDt;
            if (debugAccumulator >= DEBUG_UPDATE_INTERVAL) {
              debugAccumulator = 0;
              useGameStore.getState().setDebug({
                fps: fpsSmoothed,
                position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                entityCount: (session.ballBody ? 1 : 0) + session.suitManager.suits.length,
                steps: stats.steps,
                // Jalon M7 (PLAN_EFFECT_XSTATE.md, §9) : voir la doc de
                // `LoopStats` (`core/loop.ts`) pour la définition exacte.
                gameplayMs: stats.gameplayMs,
                physicsMs: stats.physicsMs,
                renderMs: stats.renderMs,
                isGrounded: session.player.isGrounded,
                horizontalSpeed: session.player.horizontalSpeed,
                verticalSpeed: session.player.velocity.y,
                numCollisions: session.player.numCollisions,
                groundNormal: {
                  x: session.player.groundNormal.x,
                  y: session.player.groundNormal.y,
                  z: session.player.groundNormal.z,
                },
                shotgunAmmo: session.weapons.shotgunAmmo,
                shotgunMaxAmmo: weaponConfig.shotgunStartingAmmo,
                // HUD de prod (Phase 6, `ui/Hud.tsx`) : quel libellé afficher pour
                // "munitions" dépend de l'arme active, pas seulement du compte de
                // cartouches. Même throttle 10 Hz que le reste de ce bloc.
                activeWeapon: session.weapons.activeWeapon,
              });
            }
          });

          // Dessin du réticule/hitmarker EN TOUT DERNIER : après toutes les
          // phases ci-dessus qui ont pu appeler `crosshair.notifyFire(...)`/
          // `hitmarker.trigger(...)` pour cette frame (tir, hit ennemi, kill) —
          // voir la note plus haut. Le réticule d'abord (repère permanent), le
          // hitmarker ensuite (flash de confirmation, doit rester visible
          // par-dessus — voir la note de construction des deux overlays).
          yield* Effect.sync(() => {
            crosshair.render();
            hitmarker.render();
          });
        }),
      );
    },

    render() {
      // Jalon M7 (PLAN_EFFECT_XSTATE.md, §9) : seul appel qui touche
      // vraiment une API externe dans le chemin de rendu — voir
      // `RenderService` (`render/renderService.ts`).
      runGameplaySync(RenderService.use((rs) => rs.render(renderer, scene, camera)));
    },
  });

  exposeDebugApi(
    () => currentSession,
    spawnSuitAt,
    spawnDirectorAt,
    () => lastRecording,
    (rec) => startPlayback(currentSession, rec),
    loadGltfLevel,
    debugFindPath,
  );
}

/**
 * Simulation hors écran d'une séquence enregistrée : même monde minimal, même
 * controller, aucune dépendance au rendu ni à l'horloge réelle.
 * Base du test de déterminisme et de l'A/B de config.
 */
function simulateRecording(rec: Recording, cfg: MoveConfig) {
  const world = new PhysicsWorld();
  const floor = world.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0));
  world.world.createCollider(
    RAPIER.ColliderDesc.cuboid(50, 0.1, 50).setCollisionGroups(COLLISION_GROUPS.WORLD),
    floor,
  );

  const sim = new PlayerController(world, cfg);
  const feetY = rec.start.position.y - (cfg.capsuleHalfHeight + cfg.capsuleRadius);
  sim.spawn(rec.start.position.x, feetY, rec.start.position.z);
  sim.velocity.set(rec.start.velocity.x, rec.start.velocity.y, rec.start.velocity.z);

  for (const frame of rec.frames) {
    sim.snapshotPrevious();
    sim.update(rec.fixedDt, frame);
    world.step(rec.fixedDt);
  }

  // Décalage de bob effectivement rendu au dernier pas (alpha = 1, soit la
  // frame d'affichage alignée sur le pas fixe). C'est la grandeur qui finit en
  // pixels : la comparer, et pas seulement ses entrées, est ce qui rend la
  // preuve de déterminisme utile pour `qa-evidence`.
  sim.viewBob(1, simBobScratch);

  const result = {
    position: { x: sim.position.x, y: sim.position.y, z: sim.position.z },
    velocity: { x: sim.velocity.x, y: sim.velocity.y, z: sim.velocity.z },
    distanceTravelled: sim.distanceTravelled,
    bobIntensity: sim.bobIntensity,
    bobOffset: { x: simBobScratch.x, y: simBobScratch.y },
    runFactor: sim.runFactor,
    fov: fovForRunFactor(cfg, sim.runFactor),
    landingDip: sim.landingDip,
  };
  world.world.free();
  return result;
}

const simBobScratch = new THREE.Vector3();

/**
 * Test de déterminisme : la même séquence d'input rejouée deux fois doit
 * produire le même état final à 1e-6 près. Un échec signale une source de
 * non-déterminisme dans le pas fixe (`Math.random` non seedé, `Date.now`,
 * ou une lecture d'input hors accumulateur).
 *
 * L'écart couvre aussi les grandeurs de VUE (bob, FOV, réception) : elles
 * finissent en pixels et doivent donc être reproductibles au même titre que la
 * position. Une horloge murale glissée dans le bob se verrait immédiatement
 * ici, sous forme d'un écart non nul sur `bobOffset` malgré des positions
 * identiques.
 */
function checkDeterminism(rec: Recording) {
  const a = simulateRecording(rec, moveConfig);
  const b = simulateRecording(rec, moveConfig);
  const delta = Math.max(
    Math.abs(a.position.x - b.position.x),
    Math.abs(a.position.y - b.position.y),
    Math.abs(a.position.z - b.position.z),
    Math.abs(a.velocity.x - b.velocity.x),
    Math.abs(a.velocity.y - b.velocity.y),
    Math.abs(a.velocity.z - b.velocity.z),
    Math.abs(a.distanceTravelled - b.distanceTravelled),
    Math.abs(a.bobOffset.x - b.bobOffset.x),
    Math.abs(a.bobOffset.y - b.bobOffset.y),
    Math.abs(a.fov - b.fov),
    Math.abs(a.landingDip - b.landingDip),
  );
  const passed = delta < 1e-6;
  console.info(
    `[determinism] ${rec.frames.length} pas fixes · écart max ${delta.toExponential(3)} · ${
      passed ? "OK" : "ÉCHEC"
    }`,
  );
  return { passed, delta, a, b };
}

declare global {
  interface Window {
    cassandre: {
      moveConfig: MoveConfig;
      player: PlayerController;
      recorder: typeof inputRecorder;
      lastRecording: () => Recording | null;
      playRecording: (rec: Recording) => void;
      exportRecording: (rec: Recording) => string;
      importRecording: (json: string) => Recording;
      simulateRecording: (rec: Recording, cfg?: MoveConfig) => ReturnType<typeof simulateRecording>;
      checkDeterminism: (rec: Recording) => ReturnType<typeof checkDeterminism>;
      feelVariants: typeof FEEL_VARIANTS;
      applyFeelVariant: (name: keyof typeof FEEL_VARIANTS) => FeelVariantReport;
      weapons: WeaponSystem;
      weaponConfig: WeaponConfig;
      recoilVariants: typeof RECOIL_VARIANTS;
      applyRecoilVariant: (name: keyof typeof RECOIL_VARIANTS) => RecoilVariantReport;
      // --- Harnais de feedback de hit (retour playtest Phase 3) -------------
      impactVariants: typeof IMPACT_VARIANTS;
      applyImpactVariant: (name: keyof typeof IMPACT_VARIANTS) => ImpactVariantReport;
      hitmarkerVariants: typeof HITMARKER_VARIANTS;
      applyHitmarkerVariant: (name: keyof typeof HITMARKER_VARIANTS) => HitmarkerVariantReport;
      crosshairVariants: typeof CROSSHAIR_VARIANTS;
      applyCrosshairVariant: (name: keyof typeof CROSSHAIR_VARIANTS) => CrosshairVariantReport;
      knockbackVariants: typeof KNOCKBACK_VARIANTS;
      applyKnockbackVariant: (name: keyof typeof KNOCKBACK_VARIANTS) => KnockbackVariantReport;
      flashVariants: typeof FLASH_VARIANTS;
      applyFlashVariant: (name: keyof typeof FLASH_VARIANTS) => FlashVariantReport;
      /** Référence directe, LECTURE/ÉCRITURE — pratique pour forcer `suits[i].state` depuis la console (mosaïque de diagnostic états × directions). Jalon M8 : accesseur LIVE sur la session courante (getter), reste correct après un reset. */
      suits: Suit[];
      suitConfig: SuitConfig;
      /** Fait apparaître un Costard supplémentaire à la volée (pieds à `y`), DANS LA SESSION COURANTE. Critère de rollback du plan : pousser jusqu'à 10-20 sans interface graphique dédiée. */
      spawnSuit: (x: number, y: number, z: number) => Suit;
      /** Nombre de Costards jamais spawnés (vivants + cadavres), DANS LA SESSION COURANTE. */
      suitCount: () => number;
      /** Nombre de Costards encore en jeu (hors `dead`/`corpse`), DANS LA SESSION COURANTE. */
      suitAliveCount: () => number;
      /** Mêmes rôles que `suits`/`suitConfig`/`spawnSuit`, pour le Directeur (boss Zone E) — voir `director.ts`/`directorManager.ts`. Jalon M8 : `directors`/`directorManager` sont des accesseurs LIVE (getters). */
      directors: Director[];
      /** Référence directe au manager complet (badge, files d'événements) — même précédent que `weapons` ci-dessus, utile pour du débogage console. Getter LIVE (Jalon M8). */
      directorManager: DirectorManager;
      directorConfig: DirectorConfig;
      spawnDirector: (x: number, y: number, z: number) => Director;
      directorCount: () => number;
      directorAliveCount: () => number;
      /** Pipeline de niveau glTF (Phase 4), capacité ADDITIVE dev-only — voir
       * la doc de tête du bloc `loadGltfLevel` dans `main.ts`. Opère sur la
       * SESSION COURANTE (Jalon M8). */
      level: {
        /** Charge (ou recharge) `public/assets/levels/<name>.glb`, avec hot reload. */
        load: (name: string) => void;
        /** Compteurs du niveau glTF actuellement chargé, `null` si aucun. */
        stats: () => LevelStats | null;
      };
      /** Porte à badge (Zone E, `use_exit_door`/`door_e_exit`) : lecture/forçage de la possession du badge, pour tester sans tuer le Directeur en console. Opère sur la SESSION COURANTE. */
      hasBadge: () => boolean;
      giveBadge: () => void;
      doors: () => DoorInfo[];
      secrets: () => SecretZone[];
      /** Jalon M4 (PLAN_EFFECT_XSTATE.md) : graphe de praticabilité du niveau glTF courant, voir `game/level/pathfinding.ts`. */
      pathfinding: {
        graph: () => NavGraph | null;
        stats: () => ReturnType<typeof navGraphStats> | null;
        findPath: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[] | null;
      };
    };
  }
}

interface FeelVariantReport {
  variant: keyof typeof FEEL_VARIANTS;
  bobVerticalAmplitude: number;
  bobLateralAmplitude: number;
  fovRange: string;
  landingDipMax: number;
}

/**
 * Applique une variante de feel de la VUE, à chaud.
 *
 * `player.applyConfig()` n'est délibérément PAS appelé : aucun champ de vue
 * n'est lu par Rapier, ils sont relus à chaque pas fixe et à chaque frame.
 * L'appeler recréerait la capsule pour rien.
 *
 * Protocole de comparaison, trois lignes :
 *   1. F9, cours et saute ~15 s dans le couloir nord, F9 pour arrêter ;
 *   2. `cassandre.applyFeelVariant("A")` puis F10 — recommence avec "B", "C" ;
 *   3. la course rejouée est identique au pas fixe près, seule la vue change :
 *      c'est la variante, pas ta façon de jouer, que tu compares.
 */
function applyFeelVariant(name: keyof typeof FEEL_VARIANTS): FeelVariantReport {
  Object.assign(moveConfig, FEEL_VARIANTS[name]);
  const report: FeelVariantReport = {
    variant: name,
    bobVerticalAmplitude: moveConfig.bobVerticalAmplitude,
    bobLateralAmplitude: moveConfig.bobLateralAmplitude,
    fovRange: `${moveConfig.fovBase}° → ${moveConfig.fovBase + moveConfig.fovRunBoost}°`,
    landingDipMax: moveConfig.landingDipMax,
  };
  console.info(`[feel] variante ${name} appliquée`, report);
  return report;
}

interface RecoilVariantReport {
  variant: keyof typeof RECOIL_VARIANTS;
  meleeRecoil: RecoilVariant["meleeRecoil"];
  shotgunRecoil: RecoilVariant["shotgunRecoil"];
}

/**
 * Applique une variante de recul d'arme, à chaud — même protocole que
 * `applyFeelVariant` : F9 enregistre une séquence de tir, `applyRecoilVariant`
 * change la variante, F10 rejoue EXACTEMENT la même séquence (`InputFrame.fire`
 * est un front enregistré comme un autre), seul le recul diffère à l'écran.
 * Aucun `applyConfig()` nécessaire : le recul n'est lu par Rapier nulle part.
 */
function applyRecoilVariant(name: keyof typeof RECOIL_VARIANTS): RecoilVariantReport {
  Object.assign(weaponConfig, RECOIL_VARIANTS[name]);
  const report: RecoilVariantReport = {
    variant: name,
    meleeRecoil: weaponConfig.meleeRecoil,
    shotgunRecoil: weaponConfig.shotgunRecoil,
  };
  console.info(`[feel] variante de recul ${name} appliquée`, report);
  return report;
}

interface ImpactVariantReport {
  variant: keyof typeof IMPACT_VARIANTS;
  hitstop: string;
  enemyHitstop: string;
  shake: string;
  enemyShake: string;
}

/**
 * Applique une variante de feedback d'impact (hitstop + screenshake,
 * distinction mur/ennemi) — retour playtest Phase 3, voir `IMPACT_VARIANTS`
 * dans `weaponConfig.ts` pour le contexte complet. Aucun `applyConfig()`
 * nécessaire (rien n'est lu par Rapier). Protocole F9/F10 : voir la note de
 * `IMPACT_VARIANTS` — viser un Costard à PV pleins pour une comparaison
 * propre, le recorder ne restaure pas l'état des Costards.
 */
function applyImpactVariant(name: keyof typeof IMPACT_VARIANTS): ImpactVariantReport {
  Object.assign(weaponConfig, IMPACT_VARIANTS[name]);
  const report: ImpactVariantReport = {
    variant: name,
    hitstop: `${(weaponConfig.hitstopDuration * 1000).toFixed(0)} ms @ ×${weaponConfig.hitstopScale}`,
    enemyHitstop: `${(weaponConfig.enemyHitstopDuration * 1000).toFixed(0)} ms @ ×${weaponConfig.enemyHitstopScale}`,
    shake: `${weaponConfig.shakeAmplitude} m / ${(weaponConfig.shakeDuration * 1000).toFixed(0)} ms`,
    enemyShake: `${weaponConfig.enemyShakeAmplitude} m / ${(weaponConfig.enemyShakeDuration * 1000).toFixed(0)} ms`,
  };
  console.info(`[feel] variante d'impact ${name} appliquée`, report);
  return report;
}

interface HitmarkerVariantReport {
  variant: keyof typeof HITMARKER_VARIANTS;
  enabled: boolean;
  hit: string;
  kill: string;
}

/**
 * Applique une variante de hitmarker, à chaud — voir `HITMARKER_VARIANTS`
 * dans `weaponConfig.ts`. Le marqueur lit `weaponConfig` en DIRECT (même
 * objet que la config passée à `HitmarkerOverlay`), donc l'effet est visible
 * dès le prochain hit ennemi, sans rien réinstancier.
 */
function applyHitmarkerVariant(name: keyof typeof HITMARKER_VARIANTS): HitmarkerVariantReport {
  Object.assign(weaponConfig, HITMARKER_VARIANTS[name]);
  const report: HitmarkerVariantReport = {
    variant: name,
    enabled: weaponConfig.hitmarkerEnabled,
    hit: `${weaponConfig.hitmarkerSize}px @ ${(weaponConfig.hitmarkerDuration * 1000).toFixed(0)} ms`,
    kill: `${weaponConfig.hitmarkerKillSize}px @ ${(weaponConfig.hitmarkerKillDuration * 1000).toFixed(0)} ms`,
  };
  console.info(`[feel] variante de hitmarker ${name} appliquée`, report);
  return report;
}

interface CrosshairVariantReport {
  variant: keyof typeof CROSSHAIR_VARIANTS;
  style: "cross" | "dot";
  pulse: string;
}

/**
 * Applique une variante de réticule, à chaud — voir `CROSSHAIR_VARIANTS`
 * dans `weaponConfig.ts`. Le réticule lit `weaponConfig` en DIRECT (même
 * objet que la config passée à `CrosshairOverlay`), donc l'effet est visible
 * dès la prochaine frame, sans rien réinstancier.
 */
function applyCrosshairVariant(name: keyof typeof CROSSHAIR_VARIANTS): CrosshairVariantReport {
  Object.assign(weaponConfig, CROSSHAIR_VARIANTS[name]);
  const report: CrosshairVariantReport = {
    variant: name,
    style: weaponConfig.crosshairStyle,
    pulse: weaponConfig.crosshairPulseEnabled
      ? `×${weaponConfig.crosshairPulseScale} @ ${(weaponConfig.crosshairPulseDuration * 1000).toFixed(0)} ms`
      : "désactivée",
  };
  console.info(`[feel] variante de réticule ${name} appliquée`, report);
  return report;
}

interface KnockbackVariantReport {
  variant: keyof typeof KNOCKBACK_VARIANTS;
  knockbackSpeed: number;
  knockbackDecayTime: number;
  knockbackUpBoost: number;
}

/**
 * Applique une variante de knockback Costard, à chaud — voir
 * `KNOCKBACK_VARIANTS` dans `suitConfig.ts`. `Suit` lit `this.cfg` (référence
 * partagée vers `suitConfig` par défaut), donc l'effet s'applique au PROCHAIN
 * coup encaissé par n'importe quel Costard, sans recréer aucun corps Rapier.
 */
function applyKnockbackVariant(name: keyof typeof KNOCKBACK_VARIANTS): KnockbackVariantReport {
  Object.assign(suitConfig, KNOCKBACK_VARIANTS[name]);
  const report: KnockbackVariantReport = {
    variant: name,
    knockbackSpeed: suitConfig.knockbackSpeed,
    knockbackDecayTime: suitConfig.knockbackDecayTime,
    knockbackUpBoost: suitConfig.knockbackUpBoost,
  };
  console.info(`[feel] variante de knockback ${name} appliquée`, report);
  return report;
}

interface FlashVariantReport {
  variant: keyof typeof FLASH_VARIANTS;
  hitFlashDuration: number;
}

/** Applique une variante de durée de flash de dégât, à chaud — voir `FLASH_VARIANTS` dans `suitConfig.ts`. */
function applyFlashVariant(name: keyof typeof FLASH_VARIANTS): FlashVariantReport {
  Object.assign(suitConfig, FLASH_VARIANTS[name]);
  const report: FlashVariantReport = { variant: name, hitFlashDuration: suitConfig.hitFlashDuration };
  console.info(`[feel] variante de flash ${name} appliquée`, report);
  return report;
}

/**
 * Point d'entrée console pour l'A/B de `feel-tuner` et les preuves de
 * `qa-evidence`. Jalon M8 (PLAN_EFFECT_XSTATE.md, §10) : `getSession`
 * remplace les références directes (`player`/`weapons`/`suitManager`/
 * `directorManager`) qui existaient avant ce jalon — CE fichier n'a
 * plus qu'UNE SEULE session possible tant qu'aucun reset n'a eu lieu, mais
 * `window.cassandre` doit rester correct APRÈS un "Rejouer"/"Retour au menu"
 * (`main()` appelle cette fonction UNE SEULE FOIS, jamais reconstruite à
 * chaque reset) : `getSession()` est donc appelée à chaque accès, jamais
 * mise en cache dans une variable locale de cette fonction.
 */
function exposeDebugApi(
  getSession: () => GameSession,
  spawnSuitAtSession: (session: GameSession, x: number, feetY: number, z: number) => Suit,
  spawnDirectorAtSession: (session: GameSession, x: number, feetY: number, z: number) => Director,
  lastRecording: () => Recording | null,
  playRecording: (rec: Recording) => void,
  loadGltfLevelSession: (session: GameSession, name: string) => void,
  debugFindPathSession: (session: GameSession, from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[] | null,
) {
  window.cassandre = {
    moveConfig,
    get player() {
      return getSession().player;
    },
    recorder: inputRecorder,
    lastRecording,
    playRecording,
    exportRecording: recordingToJson,
    importRecording: recordingFromJson,
    simulateRecording: (rec, cfg = moveConfig) => simulateRecording(rec, cfg),
    checkDeterminism,
    feelVariants: FEEL_VARIANTS,
    applyFeelVariant,
    get weapons() {
      return getSession().weapons;
    },
    weaponConfig,
    recoilVariants: RECOIL_VARIANTS,
    applyRecoilVariant,
    impactVariants: IMPACT_VARIANTS,
    applyImpactVariant,
    hitmarkerVariants: HITMARKER_VARIANTS,
    applyHitmarkerVariant,
    crosshairVariants: CROSSHAIR_VARIANTS,
    applyCrosshairVariant,
    knockbackVariants: KNOCKBACK_VARIANTS,
    applyKnockbackVariant,
    flashVariants: FLASH_VARIANTS,
    applyFlashVariant,
    get suits() {
      return getSession().suitManager.suits;
    },
    suitConfig,
    spawnSuit: (x, y, z) => spawnSuitAtSession(getSession(), x, y, z),
    suitCount: () => getSession().suitManager.suits.length,
    suitAliveCount: () => getSession().suitManager.suits.filter((s) => s.isAlive).length,
    get directors() {
      return getSession().directorManager.directors;
    },
    get directorManager() {
      return getSession().directorManager;
    },
    directorConfig,
    spawnDirector: (x, y, z) => spawnDirectorAtSession(getSession(), x, y, z),
    directorCount: () => getSession().directorManager.directors.length,
    directorAliveCount: () => getSession().directorManager.directors.filter((d) => d.isAlive).length,
    level: {
      load: (name) => loadGltfLevelSession(getSession(), name),
      stats: () => getSession().gltfLevelSession?.current?.stats ?? null,
    },
    /** Porte à badge (Zone E) : `hasBadge()` lit l'état réel, `giveBadge()`
     * force la possession pour tester `use_exit_door` sans devoir tuer le
     * Directeur en console (même précédent que `directorManager` pour ce
     * genre de test direct). */
    hasBadge: () => getSession().hasBadge,
    giveBadge: () => {
      getSession().hasBadge = true;
    },
    /** `door_*` du niveau glTF actuellement chargé — pour inspecter/piloter une porte depuis la console (même précédent que `directors`/`suits`). */
    doors: () => getSession().gltfLevelSession?.current?.doors ?? [],
    /** `secret_*` du niveau glTF actuellement chargé — pour inspecter les volumes AABB depuis la console (même précédent que `doors`). */
    secrets: () => getSession().gltfLevelSession?.current?.secrets ?? [],
    /** Jalon M4 (PLAN_EFFECT_XSTATE.md) : graphe de praticabilité du niveau glTF courant. `graph()` expose le `NavGraph` brut (tableaux typés, voir sa doc), `stats()` un résumé lisible, `findPath(from, to)` calcule un chemin en direct (`null` si pas de graphe/chemin) — même précédent console que `doors`/`secrets`. */
    pathfinding: {
      graph: () => getSession().currentNavGraph,
      stats: () => {
        const graph = getSession().currentNavGraph;
        return graph ? navGraphStats(graph) : null;
      },
      findPath: (from, to) => debugFindPathSession(getSession(), from, to),
    },
  };
}

main();
