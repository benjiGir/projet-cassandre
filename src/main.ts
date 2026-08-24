import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { initAudio, playDoorSfx, playEnemySfx, playImpactSfx, playSfx, playWeaponFireSfx } from "./core/audio";
import { input } from "./core/input";
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
import { buildGym } from "./game/level/gym";
import { createLevelSession, type LevelSession } from "./game/level/hotReload";
import { InteractionSystem } from "./game/level/interactive";
import type { DoorInfo, LevelStats, SecretZone } from "./game/level/loader";
import { LEVEL_CHOICES, type LevelDef } from "./game/level/levels";
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
import { App } from "./ui/App";
import { LevelMenu } from "./ui/LevelMenu";

/** Garde verticale entre les pieds au spawn et le sol, en mètres : évite une
 * interpénétration au tout premier pas fixe (même garde que l'ancienne salle
 * de test). `buildGym` retourne la hauteur EXACTE du sol au point de spawn. */
const SPAWN_FEET_GUARD = 0.1;

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

async function main() {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement;

  // --- Choix du niveau (Phase 5) — TOUT EN HAUT de `main()`, avant absolument
  // tout le reste du boot (avant `root.render(App)`, avant `input.attach`,
  // avant `initAudio`, avant la scène/caméra/renderer/physique). Invariant #2
  // (React ne touche jamais la boucle) est trivialement respecté ici : il n'y
  // a même pas encore de boucle à ce stade. Voir `game/level/levels.ts` pour
  // le registre — remplace l'ancien hardcode `levelParam === "zone_a_parking"`
  // documenté comme dette dans CLAUDE.md.
  const root = createRoot(uiRoot);
  const choice = await resolveLevelChoice(root);
  root.render(createElement(App));

  input.attach(canvas);
  // Pools de SFX (tir, impact) : voir core/audio.ts. Aucun asset audio
  // n'existe encore dans le dépôt — c'est l'état attendu (invariant #9),
  // géré silencieusement (un seul console.warn par id manquant, jamais de
  // throw). Initialisé avant startLoop, comme les autres systèmes globaux.
  initAudio();

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
  const physics = new PhysicsWorld();

  const player = new PlayerController(physics);
  // `buildGym` (géométrie + colliders de la gym) n'est appelé QUE sur le
  // chemin "gym" : sur le chemin "gltf", zéro géométrie/collider de la gym ne
  // doit exister en mémoire, pas juste être caché (contrainte explicite de ce
  // slice) — les deux chemins sont mutuellement exclusifs.
  let initialYaw = 0;
  if (choice.kind === "gym") {
    const gym = buildGym(scene, physics);
    player.spawn(gym.spawn.x, gym.spawn.y + SPAWN_FEET_GUARD, gym.spawn.z);
    initialYaw = gym.spawnYaw;
  } else {
    // Chemin glTF : pas de `gym.spawn` disponible ici (le tout premier
    // chargement de `loadGltfLevel`, plus bas, est asynchrone et n'a même pas
    // encore démarré). Position transitoire sûre et documentée : le joueur
    // tombe quelques pas fixes dans le vide (gravité −25 m/s², invariant #7)
    // jusqu'à ce que le callback `onLoaded` de `loadGltfLevel` le repositionne
    // sur `spawn_player` du `.glb` (déjà gaté par `info.isFirstLoad &&
    // handle.spawnPlayer`, inchangé).
    //
    // Volontairement PAS de `await gltfLevelSession.ready` ici pour éliminer
    // ce délai : `ready` (voir `hotReload.ts`) ne se résout JAMAIS si ce
    // premier chargement échoue (glb 404 ou invalide pendant un export en
    // cours), ce qui bloquerait indéfiniment tout le boot du jeu pour un gain
    // purement cosmétique — décision assumée, pas un oubli.
    player.spawn(0, 2, 0);
  }

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
  // UNIQUEMENT sur le chemin "gym", ses coordonnées n'ayant aucun sens sur le
  // chemin glTF. `ballMesh`/`ballBody` restent `null` sinon ; `stepPhysics`/
  // `interpolateVisuals` plus bas gardent ces cas sûrs (rien à mettre à jour).
  const ballRadius = 0.4;
  let ballMesh: THREE.Mesh | null = null;
  let ballBody: RAPIER.RigidBody | null = null;
  const ballPrevPos = new THREE.Vector3();
  const ballPrevQuat = new THREE.Quaternion();
  const ballCurrPos = new THREE.Vector3(3, 4, 0);
  const ballCurrQuat = new THREE.Quaternion();
  if (choice.kind === "gym") {
    ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(ballRadius, 16, 12),
      new THREE.MeshLambertMaterial({ color: 0x4488cc }),
    );
    scene.add(ballMesh);

    ballBody = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(3, 4, 0).setLinvel(-2, 0, 3),
    );
    physics.world.createCollider(
      RAPIER.ColliderDesc.ball(ballRadius)
        .setRestitution(0.7)
        // Groupe WORLD : elle doit rester heurtable par le joueur (un groupe
        // DEBRIS ne collisionnerait qu'avec le décor, et le témoin de poussée
        // ne servirait plus à rien).
        .setCollisionGroups(COLLISION_GROUPS.WORLD),
      ballBody,
    );
  }

  // --- Vue : lue au taux d'affichage, jamais interpolée (invariant #3) -------
  const clock = new GameClock();
  // Construit juste après `clock` : le constructeur de `WeaponSystem` en
  // garde une référence pour déclencher le hitstop (`clock.triggerHitstop`)
  // à l'impact. Ordre minimal, rien d'autre n'a besoin d'être déplacé.
  const weapons = new WeaponSystem(physics, clock);
  // Rendu de l'impact de tir (muzzle flash, decals, particules, douilles,
  // screenshake) et mesh d'arme affiché à l'écran — voir `render/fx.ts` et
  // `render/viewmodel.ts` pour les choix documentés. Purement cosmétiques :
  // aucun des deux ne touche au pas fixe ni à `weapons`/`player`.
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

  // --- Ennemi « Costard » (Phase 3) -----------------------------------------
  // `SuitManager` possède `Suit[]` + le `KinematicCharacterController` PARTAGÉ
  // (voir la doc de tête de `game/entities/suit.ts`) ; `main.ts` possède le
  // pont vers le rendu/l'audio/le store (`BillboardSprite` par Costard,
  // `fx`/`playEnemySfx`/`setPlayerHp`), jamais l'inverse — même séparation que
  // `weapons`/`fx`/`audio` pour les armes du joueur.
  const suitManager = new SuitManager(physics);
  // Atlas UNIQUE, partagé par tous les Costards : `BillboardSprite` clone en
  // interne l'objet `THREE.Texture` par instance (voir « LE PIÈGE DU PARTAGE
  // DE TEXTURE » dans `render/billboard.ts`), donc réutiliser cette même
  // texture source pour chaque `new BillboardSprite(...)` est le pattern
  // attendu, pas un raccourci.
  const suitAtlas = createPlaceholderAtlas(BILLBOARD_COLUMNS, SUIT_ATLAS_ROWS);
  const suitSprites = new Map<number, BillboardSprite>();
  // Capsule Costard : demi-hauteur 0.5 + rayon 0.4 -> hauteur totale 1.8 m,
  // choisie pour matcher EXACTEMENT `DEFAULT_HEIGHT` de `BillboardSprite`
  // (voir `suitConfig.ts`) : `verticalAnchor: 0.5` fait donc coïncider le
  // centre du sprite avec le centre de la capsule que `Suit` interpole,
  // sans calcul de décalage supplémentaire.
  const SUIT_SPRITE_HEIGHT = 1.8;

  /**
   * Fait apparaître un Costard ET son `BillboardSprite`, toujours ensemble
   * (jamais l'un sans l'autre — un Costard sans sprite serait invisible mais
   * actif, un bug de lisibilité silencieux). `facing` par défaut : vise la
   * position COURANTE du joueur au moment du spawn (pratique aussi bien pour
   * les 3 spawns initiaux que pour `cassandre.spawnSuit` en cours de partie).
   */
  function spawnSuitAt(x: number, feetY: number, z: number): Suit {
    const facing = new THREE.Vector3(player.position.x - x, 0, player.position.z - z);
    if (facing.lengthSq() < 1e-6) facing.set(0, 0, 1);
    facing.normalize();

    const suit = suitManager.spawnSuit(x, feetY, z, facing);
    const sprite = new BillboardSprite(scene, suitAtlas, {
      rows: SUIT_ATLAS_ROWS,
      height: SUIT_SPRITE_HEIGHT,
      verticalAnchor: 0.5,
    });
    suitSprites.set(suit.id, sprite);
    return suit;
  }

  // --- Ennemi « Directeur » (boss de fin, Zone E) ---------------------------
  // Même séparation simulation/rendu que `SuitManager` ci-dessus. Câblage
  // MINIMAL de test (pas de spawn dans un niveau — la Zone E garde son
  // Costard placeholder, câblage niveau hors scope de cette passe) :
  // uniquement `cassandre.spawnDirector(x, y, z)` en console.
  const directorManager = new DirectorManager(physics);
  const directorAtlas = createPlaceholderAtlas(BILLBOARD_COLUMNS, DIRECTOR_ATLAS_ROWS);
  const directorSprites = new Map<number, BillboardSprite>();
  // capsuleHalfHeight(0.6) + capsuleRadius(0.45) = 1.05 -> hauteur totale
  // 2.1 m, même règle de correspondance exacte que `SUIT_SPRITE_HEIGHT`.
  const DIRECTOR_SPRITE_HEIGHT = 2.1;
  // Badge droppé à la mort : mesh visible géré ici (le Directeur/DirectorManager
  // restent purs de tout rendu, voir leur doc de tête) — placeholder simple
  // (invariant #9), retiré de la scène au ramassage.
  const badgeGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const badgeMaterial = new THREE.MeshLambertMaterial({ color: 0xffd54a });
  let badgeMesh: THREE.Mesh | null = null;
  // Progression joueur (survit à un hot reload de niveau, contrairement au
  // `LevelHandle` — voir `interactive.ts` pour la même discipline sur
  // `consumed`) : possession du badge du Directeur, condition d'ouverture de
  // `door_e_exit` (Zone E, `use_exit_door`).
  let hasBadge = false;

  // --- Porte de sortie verrouillée par badge (Zone E) -----------------------
  // `door_e_exit` (voir tools/blender/level_spec.py::ZONE_E) est verrouillée
  // par défaut (corps dynamique, translations/rotations lockées — voir
  // `loader.ts::buildDoor`). `use_exit_door` (portée 2m, touche E) la
  // déverrouille SEULEMENT si `hasBadge`. Le collider est désactivé
  // IMMÉDIATEMENT au déverrouillage (pas à la fin du glissement) : un joueur
  // qui vient de déverrouiller en restant devant ne doit jamais se sentir
  // bloqué par une porte qui "n'a pas fini son animation". Le glissement
  // lui-même (vers le bas, sur sa propre hauteur — `halfExtents.y * 2`) est
  // donc purement cosmétique, réalisé en écrivant directement `body.setTranslation`
  // chaque pas fixe (les locks de la porte contraignent le solveur physique,
  // pas une écriture directe de position — même principe que le KCC du
  // joueur qui ignore, lui aussi, tout lock).
  const DOOR_OPEN_DURATION = 0.6;
  interface OpeningDoor {
    body: RAPIER.RigidBody;
    startY: number;
    targetY: number;
    t: number;
  }
  let openingDoor: OpeningDoor | null = null;
  const unlockedDoors = new Set<string>();

  // --- Secrets (Phase 5, critère de validation du plan) ---------------------
  // Détection PASSIVE (pas de touche E, pas de `use_*`) : le joueur entre
  // dans le volume AABB d'un `secret_*`, c'est trouvé. Par RÉFÉRENCE DE MESH
  // dans un `WeakSet`, même discipline que `InteractionSystem.consumed`
  // (`interactive.ts`) — un hot reload remplace `handle.secrets` par de
  // nouveaux objets, donc un secret déjà trouvé avant un hot reload redevient
  // trouvable après (cas limite dev-only, pas un chemin joueur réel).
  const foundSecrets = new WeakSet<THREE.Object3D>();

  const HUD_MESSAGE_DURATION_MS = 1800;
  /** Affiche un message HUD transitoire, effacé après `HUD_MESSAGE_DURATION_MS`
   * (sauf s'il a déjà été remplacé par un autre message entre-temps). */
  function showHudMessage(text: string): void {
    useGameStore.getState().showHudMessage(text);
    window.setTimeout(() => {
      if (useGameStore.getState().hudMessage === text) {
        useGameStore.getState().showHudMessage(null);
      }
    }, HUD_MESSAGE_DURATION_MS);
  }

  /** Déverrouille le `door_*` nommé `targetName` (glissement + collider désactivé,
   * voir la doc de `openingDoor` plus haut) — factorisé entre `onExitDoorUse`
   * (Zone E, gardé par badge) et `onFrozenStorageUse` (Zone B, sans garde) :
   * même mécanique de porte, seule la CONDITION d'appel diffère, décidée par
   * l'appelant avant d'invoquer cette fonction. Retourne `false` sans effet
   * si `targetName` ne correspond à aucun `door_*` du niveau courant (erreur
   * de données Blender, pas un état de jeu valide). */
  function unlockDoor(targetName: string, successMessage: string): boolean {
    const door = (gltfLevelSession?.current?.doors ?? []).find((d) => d.name === targetName);
    if (!door) {
      console.error(`[main] use_* référence une porte introuvable ("${targetName}").`);
      return false;
    }
    unlockedDoors.add(targetName);
    const t = door.body.translation();
    openingDoor = { body: door.body, startY: t.y, targetY: t.y - door.halfExtents.y * 2, t: 0 };
    door.collider.setEnabled(false);
    showHudMessage(successMessage);
    playDoorSfx("unlock");
    return true;
  }

  function spawnDirectorAt(x: number, feetY: number, z: number): Director {
    const facing = new THREE.Vector3(player.position.x - x, 0, player.position.z - z);
    if (facing.lengthSq() < 1e-6) facing.set(0, 0, 1);
    facing.normalize();

    const director = directorManager.spawnDirector(x, feetY, z, facing);
    const sprite = new BillboardSprite(scene, directorAtlas, {
      rows: DIRECTOR_ATLAS_ROWS,
      height: DIRECTOR_SPRITE_HEIGHT,
      verticalAnchor: 0.5,
    });
    directorSprites.set(director.id, sprite);
    return director;
  }

  // 3 points de spawn dans le hub (>= 40x40 m, zone explicitement dédiée au
  // combat, voir `HUB_HALF`/`HUB_SIZE` de `game/level/gym.ts`) : dispersés
  // autour du spawn joueur (0, 0, -10), à 15-22 m (largement au-delà de la
  // portée de mêlée, en-deçà de `suitConfig.sightRange`), et à >= 8 m de
  // n'importe quel mur du hub (murs à x,z = ±22) pour ne jamais spawner
  // fusionné dans le décor.
  // `SPAWN_FEET_GUARD` : même garde anti-interpénétration que le spawn du
  // joueur ci-dessus — le sol du hub a sa surface exactement à y=0
  // (`gym.ts`), poser les pieds pile dessus violerait la marge de
  // `colliderOffset` du KCC dès le tout premier pas fixe.
  //
  // POSITIONS DE TEST DE LA GYM (pas du contenu générique de moteur) :
  // n'apparaissent QUE sur le chemin "gym" — les niveaux glTF ont leurs
  // propres `spawn_suit_*` (collectés dans `handle.spawnSuits` par
  // `loader.ts`), consommés séparément dans le callback `onLoaded` de
  // `loadGltfLevel` plus bas (voir sa doc pour la sémantique face au hot
  // reload). Effet de bord attendu : le Costard de la Zone A
  // (`spawn_suit_1`, scellé dans son alcôve) apparaît désormais réellement en
  // jeu — jusqu'ici jamais spawné malgré le compteur `spawns Costard 1`
  // affiché par `[level]`.
  if (choice.kind === "gym") {
    spawnSuitAt(-9, SPAWN_FEET_GUARD, 5);
    spawnSuitAt(9, SPAWN_FEET_GUARD, 5);
    spawnSuitAt(0, SPAWN_FEET_GUARD, 13);
  }
  // Debug visuel rétro : wireframe togglable à chaud sur toute la géométrie
  // de la scène (voir `render/debugView.ts`) — utile pour repérer le pavage
  // de boîtes/jonctions de la gym à l'œil. Touche dédiée KeyV, gérée plus bas
  // dans `updateFx` à côté du pattern F9/F10 existant.
  const wireframeToggle = createWireframeToggle(scene);
  // yaw initial = `initialYaw` (gym.spawnYaw sur le chemin "gym", 0 sur le
  // chemin glTF — voir sa résolution plus haut, à côté de `player.spawn`).
  // Convention vérifiée par calcul (voir gltf-level-conventions / commentaire
  // de gym.ts) : avec l'Euler 'YXZ' de la caméra ci-dessous et la dérivation
  // de wishX/wishZ dans PlayerController.update, yaw=0 -> avant = -Z, donc
  // yaw=π -> avant = +Z. gym.ts vise "regarder vers le couloir (nord, +Z)"
  // avec SPAWN_YAW = π :
  // c'est la valeur correcte, aucune correction de signe nécessaire.
  const look = { yaw: initialYaw, pitch: 0 };
  // Delta souris agrégé depuis le dernier pas fixe, pour l'enregistrement.
  const lookDelta = { dx: 0, dy: 0 };

  // --- Pipeline de niveau glTF (Phase 4/5) ---------------------------------
  // `loadGltfLevel` est défini INCONDITIONNELLEMENT : `window.cassandre.level.load(name)`
  // (raccourci dev existant, voir `exposeDebugApi` plus bas) doit pouvoir
  // charger n'importe quel `.glb` à la volée depuis la console, quel que soit
  // le niveau choisi au boot — comportement inchangé, hors scope de ce
  // slice. Le déclenchement AU BOOT, lui, est gaté par `choice.kind`
  // juste plus bas : exécuter le pipeline loader/hot-reload (voir
  // `game/level/loader.ts`/`hotReload.ts`) seulement si "Zone A — Parking" (ou
  // une fixture `?level=<nom>` non enregistrée) a été choisi — jamais en plus
  // de `gym.ts`, jamais par défaut.
  let gltfLevelSession: LevelSession | null = null;

  function loadGltfLevel(name: string): void {
    gltfLevelSession?.stop();
    const url = `/assets/levels/${name}.glb`;
    gltfLevelSession = createLevelSession(url, scene, physics, {
      onLoaded: (handle, info) => {
        console.info(
          `[level] "${name}.glb" chargé — colliders ${handle.stats.colliderCount}, ` +
            `spawns Costard ${handle.stats.spawnSuitCount}, spawns Directeur ${handle.stats.spawnDirectorCount}, ` +
            `triggers ${handle.stats.triggerCount}, ` +
            `portes ${handle.stats.doorCount}, use ${handle.stats.useCount}, ` +
            `secrets ${handle.stats.secretCount}, meshes non préfixés ${handle.stats.unprefixedMeshCount}`,
        );
        // Seul le TOUT PREMIER chargement déplace le joueur : un hot reload
        // ne doit JAMAIS respawn (voir la doc de tête de `hotReload.ts`) —
        // c'est le critère central de ce pipeline (<60 s, joueur en place).
        if (info.isFirstLoad && handle.spawnPlayer) {
          player.spawn(handle.spawnPlayer.position.x, handle.spawnPlayer.position.y, handle.spawnPlayer.position.z);
          look.yaw = handle.spawnPlayer.yaw;
          look.pitch = 0;
        }

        // `handle.spawnSuits` (Empties `spawn_suit_*`, voir `loader.ts`) :
        // MÊME garde `isFirstLoad` que `spawn_player` juste au-dessus, et pour
        // la même raison profonde — mais pas seulement par symétrie de style.
        // Deux sémantiques étaient possibles ici : vider `suitManager` et
        // re-spawn à CHAQUE `onLoaded` (y compris les hot reloads, cohérent
        // avec le reste de la géométrie qui se recharge à chaud), ou spawn
        // UNE SEULE FOIS au tout premier chargement. `SuitManager` n'expose
        // d'ailleurs aucun retrait en masse aujourd'hui (seul un retrait par
        // mort individuelle) — il aurait donc fallu l'ajouter pour la première
        // option, pour un bénéfice qui reste cosmétique en pratique (voir un
        // Costard bouger de 2 m dans Blender). Choix : `isFirstLoad` only.
        // Un hot reload pendant un playtest ne duplique donc jamais de
        // Costards et n'interrompt jamais un combat en cours — exactement la
        // même philosophie que la préservation de la position du joueur
        // documentée en tête de `hotReload.ts`. Contrepartie assumée :
        // déplacer un `spawn_suit_*` dans Blender et exporter n'est visible
        // qu'après un rechargement complet de page, pas en <60 s comme le
        // reste du pipeline — seule la géométrie/les triggers/les `use_*`
        // profitent du hot reload à chaud, pas le placement des ennemis.
        if (info.isFirstLoad) {
          for (const spawn of handle.spawnSuits) {
            spawnSuitAt(spawn.position.x, spawn.position.y, spawn.position.z);
          }
          // `handle.spawnDirectors` (Empties `spawn_director_*`) : même garde
          // `isFirstLoad`, même raison exacte que `spawn_suit_*` ci-dessus.
          for (const spawn of handle.spawnDirectors) {
            spawnDirectorAt(spawn.position.x, spawn.position.y, spawn.position.z);
          }
        }

        // Compteur de secrets (`debug.secretsTotal`) : fixé à CHAQUE chargement
        // (pas seulement `isFirstLoad`) puisque `handle.secrets` change avec le
        // niveau chargé — contrairement aux spawns, ce n'est pas un événement
        // ponctuel de partie mais une propriété du niveau courant.
        useGameStore.getState().setSecretsTotal(handle.stats.secretCount);
      },
    });
  }

  // Chargement au boot : QUE si le choix résolu tout en haut de `main()` est
  // du glTF (menu "Zone A — Parking", raccourci `?level=<id>` enregistré, ou
  // `?level=<nom>` NON enregistré traité comme fixture brute — voir
  // `resolveLevelChoice`). Sur le chemin "gym", `loadGltfLevel` n'est PAS
  // appelé du tout : zéro géométrie/collider/session glTF en mémoire, les
  // deux chemins restent mutuellement exclusifs comme pour `buildGym`
  // plus haut.
  if (choice.kind === "gltf" && choice.gltfName) {
    loadGltfLevel(choice.gltfName);
  }

  // Loadout de départ : remplace l'ancien hardcode `levelParam ===
  // "zone_a_parking"` (dette explicitement documentée dans CLAUDE.md) par la
  // métadonnée `LevelDef.startUnarmed` du registre (`game/level/levels.ts`).
  // Calculé et appliqué SYNCHRONEMENT ici, AVANT `startLoop` plus bas —
  // jamais depuis un callback asynchrone comme `onLoaded` d'une session de
  // niveau (qui arrive après un nombre indéterminé de frames et laisserait
  // le joueur armé pendant ce délai).
  if (choice.startUnarmed) {
    weapons.startUnarmed();
  }

  // Interaction (`use_*`, touche E) — voir `game/level/interactive.ts`. Une
  // seule instance, appelée à chaque pas fixe dans `updateGameplay` ci-dessous
  // (même discipline de déterminisme que `weapons`/`suitManager`).
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
  // PV courants du joueur, suivis localement : `setPlayerHp` prend une
  // valeur absolue, pas un delta (voir `game/state.ts`) — `main.ts` est le
  // seul endroit qui connaît le dégât infligé par une attaque de Costard.
  let playerHp = useGameStore.getState().debug.playerMaxHp;

  /** Capture l'input du pas fixe courant. Le saut est CONSOMMÉ ici, une seule fois. */
  function captureInputFrame(): InputFrame {
    liveFrame.forward = input.isDown("KeyW");
    liveFrame.back = input.isDown("KeyS");
    liveFrame.left = input.isDown("KeyA");
    liveFrame.right = input.isDown("KeyD");
    liveFrame.sprint = input.isDown("ShiftLeft");
    liveFrame.jump = input.consumeJustPressed("Space");
    liveFrame.fire = input.consumeJustPressed("Mouse0");
    liveFrame.switchToMelee = input.consumeJustPressed("Digit1");
    liveFrame.switchToShotgun = input.consumeJustPressed("Digit2");
    liveFrame.use = input.consumeJustPressed("KeyE");
    liveFrame.yaw = look.yaw;
    liveFrame.pitch = look.pitch;
    liveFrame.dx = lookDelta.dx;
    liveFrame.dy = lookDelta.dy;
    lookDelta.dx = 0;
    lookDelta.dy = 0;
    return liveFrame;
  }

  function startRecording() {
    inputRecorder.startRecording(
      {
        position: { x: player.position.x, y: player.position.y, z: player.position.z },
        velocity: { x: player.velocity.x, y: player.velocity.y, z: player.velocity.z },
        yaw: look.yaw,
        pitch: look.pitch,
      },
      FIXED_DT,
    );
  }

  function startPlayback(rec: Recording) {
    const feetY = rec.start.position.y - (moveConfig.capsuleHalfHeight + moveConfig.capsuleRadius);
    player.spawn(rec.start.position.x, feetY, rec.start.position.z);
    player.velocity.set(rec.start.velocity.x, rec.start.velocity.y, rec.start.velocity.z);
    look.yaw = rec.start.yaw;
    look.pitch = rec.start.pitch;
    inputRecorder.startPlayback(rec);
  }

  let lastRecording: Recording | null = null;

  let fpsSmoothed = 60;
  let debugAccumulator = 0;
  const DEBUG_UPDATE_INTERVAL = 1 / 10; // invariant #2 : 10 Hz maximum
  const ENTITY_COUNT = ballBody ? 1 : 0; // la balle SI présente (chemin "gym" uniquement) ; les Costards s'ajoutent dynamiquement via `suitManager.suits.length`

  startLoop({
    snapshotPrevious() {
      player.snapshotPrevious();
      weapons.snapshotPrevious();
      suitManager.snapshotPrevious();
      ballPrevPos.copy(ballCurrPos);
      ballPrevQuat.copy(ballCurrQuat);
    },

    // Décide le mouvement AVANT le step : la translation cible est consommée
    // par le `world.step()` du même pas fixe (voir l'ordre dans core/loop.ts).
    updateGameplay(dt) {
      const gameplayDt = clock.tick(dt);

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

      const activeFrame = frame ?? emptyInputFrame();
      player.update(gameplayDt, activeFrame);

      // Interaction (`use_*`, touche E) — APRÈS `player.update` (donc
      // `player.position` déjà avancée ce pas-ci) et AVANT `weapons.update`
      // pour qu'un ramassage et un tir puissent se produire dans le même pas
      // fixe (raffinement, pas une exigence). `useObjects` est RELUE ici à
      // chaque appel, jamais mise en cache : un hot reload remplace tout le
      // tableau (voir `interactive.ts`/`hotReload.ts`).
      interaction.update(activeFrame.use, gltfLevelSession?.current?.useObjects ?? [], player.position, {
        onCrowbarPickup: () => weapons.pickUpMelee(),
        onShotgunPickup: () => weapons.pickUpShotgun(),
        onExitDoorUse: (targetName) => {
          if (unlockedDoors.has(targetName)) return; // déjà déverrouillée
          if (!hasBadge) {
            showHudMessage("Badge du Directeur requis");
            playDoorSfx("locked");
            return;
          }
          unlockDoor(targetName, "Porte déverrouillée");
        },
        onFrozenStorageUse: (targetName) => {
          if (unlockedDoors.has(targetName)) return; // déjà ouverte
          unlockDoor(targetName, "Rayon surgelés ouvert");
        },
      });

      // Origine de tir du pas fixe COURANT, lue APRÈS `player.update` (donc
      // déjà avancée ce pas-ci) : centre de capsule + eyeOffset, jamais la
      // position interpolée pour le rendu. Voir la note de déterminisme dans
      // `WeaponSystem.update` — une origine interpolée casserait le rejeu
      // exact du raycast d'arme.
      weaponEyeOrigin.set(
        player.position.x,
        player.position.y + player.eyeOffset,
        player.position.z,
      );
      weapons.update(gameplayDt, activeFrame, weaponEyeOrigin, activeFrame.yaw, activeFrame.pitch);

      // APRÈS `weapons.update` : les `hitEvents` du pas courant existent déjà
      // (voir la doc de `SuitManager.update`). `player.position` sert de
      // cible de poursuite (XZ), `weaponEyeOrigin` — la même origine
      // AUTHENTIQUE que celle qui vient de servir aux raycasts d'armes,
      // jamais une position interpolée — sert de cible de ligne de
      // vue/visée pour les Costards.
      suitManager.update(gameplayDt, player.position, weaponEyeOrigin, weapons.hitEvents);
      directorManager.update(gameplayDt, player.position, weaponEyeOrigin, weapons.hitEvents);

      // Badge du Directeur : apparition (mesh) à la mort, une seule fois ;
      // ramassage par proximité SEULE (pas de touche E, voir la doc de
      // `DirectorBadge`) — même discipline de mutation directe en pas fixe
      // que `interaction.update` ci-dessus pour `use_crowbar`.
      if (directorManager.badge && !badgeMesh) {
        badgeMesh = new THREE.Mesh(badgeGeometry, badgeMaterial);
        badgeMesh.position.copy(directorManager.badge.position);
        scene.add(badgeMesh);
      }
      if (directorManager.tryCollectBadge(player.position) && badgeMesh) {
        scene.remove(badgeMesh);
        badgeMesh = null;
        hasBadge = true;
        showHudMessage("Badge du Directeur récupéré");
      }

      // Glissement cosmétique de la porte débloquée (voir sa doc plus haut) —
      // le collider est déjà désactivé depuis le déverrouillage, ceci ne fait
      // que déplacer le mesh hors du passage.
      if (openingDoor) {
        openingDoor.t = Math.min(1, openingDoor.t + gameplayDt / DOOR_OPEN_DURATION);
        const y = openingDoor.startY + (openingDoor.targetY - openingDoor.startY) * openingDoor.t;
        const current = openingDoor.body.translation();
        openingDoor.body.setTranslation({ x: current.x, y, z: current.z }, true);
        if (openingDoor.t >= 1) openingDoor = null;
      }

      // Secrets : présence dans le volume AABB, voir la doc de `foundSecrets`
      // plus haut. `secrets` est RELUE ici à chaque appel, jamais mise en
      // cache — même discipline que `useObjects`/`doors` ci-dessus (hot
      // reload remplace tout le tableau).
      for (const secret of gltfLevelSession?.current?.secrets ?? []) {
        if (foundSecrets.has(secret.object)) continue;
        const p = player.position;
        const inside =
          p.x >= secret.min.x &&
          p.x <= secret.max.x &&
          p.y >= secret.min.y &&
          p.y <= secret.max.y &&
          p.z >= secret.min.z &&
          p.z <= secret.max.z;
        if (!inside) continue;
        foundSecrets.add(secret.object);
        useGameStore.getState().incrementSecretsFound();
        const found = useGameStore.getState().debug.secretsFound;
        const total = useGameStore.getState().debug.secretsTotal;
        showHudMessage(`Secret trouvé ! (${found}/${total})`);
        playSfx("secret_found");
      }
    },

    stepPhysics(dt) {
      physics.step(dt);
      // `ballBody` n'existe que sur le chemin "gym" (voir sa construction
      // plus haut) — rien à mettre à jour sinon, pas un bug.
      if (ballBody) {
        const t = ballBody.translation();
        const r = ballBody.rotation();
        ballCurrPos.set(t.x, t.y, t.z);
        ballCurrQuat.set(r.x, r.y, r.z, r.w);
      }
    },

    interpolateVisuals(alpha) {
      if (ballMesh) {
        ballMesh.position.lerpVectors(ballPrevPos, ballCurrPos, alpha);
        ballMesh.quaternion.slerpQuaternions(ballPrevQuat, ballCurrQuat, alpha);
      }

      // Rotation vue lue au taux d'affichage, jamais interpolée (latence de visée sinon).
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

      // Position caméra : capsule interpolée + hauteur des yeux.
      camera.position.copy(player.eyePosition(alpha, eyePosition));

      // Head bob + enfoncement de réception : ajoutés à la POSITION de la
      // caméra, jamais à sa rotation. La visée garde donc exactement la latence
      // et la stabilité qu'elle avait (invariant #3), et `player.eyePosition`
      // reste disponible non bobée comme origine de tir pour la Phase 2.
      const bob = player.viewBob(alpha, viewBobOffset);
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
      const fov = fovForRunFactor(moveConfig, player.runFactorAt(alpha));
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }

      // Viewmodel : APRÈS que position/rotation/FOV de la caméra sont posés
      // ci-dessus — l'offset de `weapons.viewmodelPose` est purement local à
      // la caméra (voir `render/viewmodel.ts`), il n'a pas besoin de les lire,
      // mais reste cohérent dans la même frame en s'appliquant après eux.
      viewmodel.update(alpha, weapons);

      // Costards : position/forward interpolés (jamais les valeurs brutes du
      // pas fixe, voir la doc de `BillboardSprite.updatePose`), une fois par
      // Costard vivant OU cadavre (le cadavre reste affiché, figé).
      for (const suit of suitManager.suits) {
        const sprite = suitSprites.get(suit.id);
        if (!sprite) continue;
        const pos = suit.interpolatedPosition(alpha, suitPositionScratch);
        const fwd = suit.interpolatedForward(alpha, suitForwardScratch);
        sprite.updatePose(camera, pos, fwd, suit.spriteRow);
      }

      // Même chose pour le Directeur (au plus un, mais `directors` reste un
      // tableau — voir la doc de `DirectorManager`).
      for (const director of directorManager.directors) {
        const sprite = directorSprites.get(director.id);
        if (!sprite) continue;
        const pos = director.interpolatedPosition(alpha, directorPositionScratch);
        const fwd = director.interpolatedForward(alpha, directorForwardScratch);
        sprite.updatePose(camera, pos, fwd, director.spriteRow);
      }
    },

    updateFx(realDt, stats) {
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

      // Lecture NON DESTRUCTIVE de `weapons.fireEvents`/`hitEvents` : ces
      // files s'accumulent au fil des pas fixes de la frame et ne se vident
      // jamais toutes seules. clearFrameEvents() est appelé par `shell`, en
      // dernier, après consommation audio — ne JAMAIS l'appeler ici.
      for (const event of weapons.fireEvents) {
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
      for (const hit of weapons.hitEvents) {
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
      weapons.clearFrameEvents();

      // Décroissance TEMPS RÉEL du flash de dégâts de chaque Costard — jamais
      // au pas fixe (même séparation que `fx.update(realDt)` juste au-dessus).
      for (const sprite of suitSprites.values()) sprite.updateFlash(realDt);

      // Lecture NON DESTRUCTIVE des files de `suitManager`, même contrat que
      // `weapons.fireEvents`/`hitEvents` ci-dessus : tous les lecteurs
      // d'abord, `suitManager.clearFrameEvents()` en tout dernier.
      for (const event of suitManager.alertEvents) {
        void event; // pas de sprite dédié à l'alerte : la pose ALERTE (ligne d'atlas) suffit, le son est le seul canal supplémentaire ici.
        playEnemySfx("alert");
      }
      for (const event of suitManager.telegraphEvents) {
        void event;
        // Règle non négociable du skill : le son de télégraphie part AVANT
        // les dégâts (`suitConfig.attackTelegraphDuration` >= 0.2 s sépare ce
        // point de la résolution de l'attaque dans `Suit.runAttack`).
        playEnemySfx("telegraph");
      }
      for (const event of suitManager.hurtEvents) {
        // Triple feedback (skill enemy-state-machine) : flash blanc + son ici,
        // knockback déjà appliqué dans `Suit.applyDamage` (vélocité pilotée,
        // le Costard étant kinématique — voir sa doc). Durée du flash lue
        // depuis `suitConfig.hitFlashDuration` (tunable à chaud, voir sa doc
        // et `FLASH_VARIANTS`) au lieu de l'ancienne constante en dur.
        suitSprites.get(event.suit.id)?.setFlash(1, suitConfig.hitFlashDuration);
        playEnemySfx("hurt");
      }
      for (const event of suitManager.deathEvents) {
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
      }
      for (const event of suitManager.playerHitEvents) {
        playerHp = Math.max(0, playerHp - event.amount);
        useGameStore.getState().setPlayerHp(playerHp);
        // Feedback via l'API PUBLIQUE déjà livrée de `fx`/`weapons`, aucune
        // modification de `render/fx.ts` : decal + particules au point
        // d'impact sur le joueur, léger screenshake dédié (`suitConfig`, pas
        // `weaponConfig` — c'est le coup encaissé, pas un tir du joueur).
        fx.spawnImpactDecal(event.point, event.normal, "flesh");
        fx.spawnImpactParticles(event.point, event.normal, "shotgun");
        fx.triggerShake(suitConfig.playerHitShakeAmplitude, suitConfig.playerHitShakeDuration);
      }
      suitManager.clearFrameEvents();

      // Même contrat (lecture non destructive, `clearFrameEvents()` en tout
      // dernier) pour le Directeur. Pas de réutilisation des sons `enemy_*` en
      // tant que "faits exprès pour le boss" — ce sont les mêmes placeholders
      // génériques que pour le Costard (invariant #9, aucun son dédié encore).
      for (const sprite of directorSprites.values()) sprite.updateFlash(realDt);

      for (const event of directorManager.alertEvents) {
        void event;
        playEnemySfx("alert");
      }
      for (const event of directorManager.telegraphEvents) {
        void event;
        playEnemySfx("telegraph");
      }
      for (const event of directorManager.hurtEvents) {
        directorSprites.get(event.director.id)?.setFlash(1, directorConfig.hitFlashDuration);
        playEnemySfx("hurt");
      }
      for (const event of directorManager.revealEvents) {
        // Bascule costume humain -> reptilien : teinte appliquée UNE FOIS ici
        // (événement discret), jamais reposée à chaque frame dans
        // `interpolateVisuals` — voir `Director.tintColor`/`revealed`.
        directorSprites.get(event.director.id)?.setTint(event.director.tintColor);
        fx.triggerShake(directorConfig.revealShakeAmplitude, directorConfig.revealShakeDuration);
      }
      for (const event of directorManager.deathEvents) {
        void event; // pas de gibs pour le Directeur (voir la doc de `DirectorManager`).
        hitmarker.trigger("kill");
        playEnemySfx("death");
      }
      for (const event of directorManager.playerHitEvents) {
        playerHp = Math.max(0, playerHp - event.amount);
        useGameStore.getState().setPlayerHp(playerHp);
        fx.spawnImpactDecal(event.point, event.normal, "flesh");
        fx.spawnImpactParticles(event.point, event.normal, "shotgun");
        fx.triggerShake(directorConfig.playerHitShakeAmplitude, directorConfig.playerHitShakeDuration);
      }
      directorManager.clearFrameEvents();

      // Offset de shake, ADDITIF, appliqué APRÈS le calcul de bob déjà posé
      // dans `interpolateVisuals` (qui s'exécute juste avant `updateFx` dans
      // l'ordre de la boucle, voir `core/loop.ts`) — jamais en écrasant
      // `player.eyePosition`/`camera.position` de base.
      camera.position.add(fx.currentShakeOffset(shakeOffsetScratch));

      // Outillage (hors gameplay, lu au taux d'affichage) : F9 enregistre,
      // F10 rejoue. Sert de harnais A/B et de preuve de déterminisme.
      if (input.wasJustPressed("F9")) {
        if (inputRecorder.isRecording()) {
          lastRecording = inputRecorder.stopRecording();
          console.info(`[recorder] ${lastRecording?.frames.length ?? 0} pas fixes enregistrés`);
        } else {
          startRecording();
          console.info("[recorder] enregistrement démarré");
        }
      }
      if (input.wasJustPressed("F10") && lastRecording) {
        startPlayback(lastRecording);
        console.info(`[recorder] rejeu de ${lastRecording.frames.length} pas fixes`);
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
          entityCount: ENTITY_COUNT + suitManager.suits.length,
          steps: stats.steps,
          isGrounded: player.isGrounded,
          horizontalSpeed: player.horizontalSpeed,
          verticalSpeed: player.velocity.y,
          numCollisions: player.numCollisions,
          groundNormal: {
            x: player.groundNormal.x,
            y: player.groundNormal.y,
            z: player.groundNormal.z,
          },
          shotgunAmmo: weapons.shotgunAmmo,
          shotgunMaxAmmo: weaponConfig.shotgunStartingAmmo,
        });
      }

      // Dessin du réticule/hitmarker EN TOUT DERNIER : après toutes les
      // boucles ci-dessus qui ont pu appeler `crosshair.notifyFire(...)`/
      // `hitmarker.trigger(...)` pour cette frame (tir, hit ennemi, kill) —
      // voir la note plus haut. Le réticule d'abord (repère permanent), le
      // hitmarker ensuite (flash de confirmation, doit rester visible
      // par-dessus — voir la note de construction des deux overlays).
      crosshair.render();
      hitmarker.render();
    },

    render() {
      renderer.render(scene, camera);
    },
  });

  exposeDebugApi(
    player,
    weapons,
    suitManager,
    spawnSuitAt,
    directorManager,
    spawnDirectorAt,
    () => lastRecording,
    startPlayback,
    loadGltfLevel,
    () => gltfLevelSession?.current?.stats ?? null,
    () => hasBadge,
    () => {
      hasBadge = true;
    },
    () => gltfLevelSession?.current?.doors ?? [],
    () => gltfLevelSession?.current?.secrets ?? [],
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
      /** Référence directe, LECTURE/ÉCRITURE — pratique pour forcer `suits[i].state` depuis la console (mosaïque de diagnostic états × directions). */
      suits: Suit[];
      suitConfig: SuitConfig;
      /** Fait apparaître un Costard supplémentaire à la volée (pieds à `y`). Critère de rollback du plan : pousser jusqu'à 10-20 sans interface graphique dédiée. */
      spawnSuit: (x: number, y: number, z: number) => Suit;
      /** Nombre de Costards jamais spawnés (vivants + cadavres). */
      suitCount: () => number;
      /** Nombre de Costards encore en jeu (hors `dead`/`corpse`). */
      suitAliveCount: () => number;
      /** Mêmes rôles que `suits`/`suitConfig`/`spawnSuit`, pour le Directeur (boss Zone E) — voir `director.ts`/`directorManager.ts`. Aucun spawn de niveau ne l'appelle encore ; test manuel en console uniquement. */
      directors: Director[];
      /** Référence directe au manager complet (badge, files d'événements) — même précédent que `weapons` ci-dessus, utile pour du débogage console (ex. `cassandre.directorManager.badge`). */
      directorManager: DirectorManager;
      directorConfig: DirectorConfig;
      spawnDirector: (x: number, y: number, z: number) => Director;
      directorCount: () => number;
      directorAliveCount: () => number;
      /** Pipeline de niveau glTF (Phase 4), capacité ADDITIVE dev-only — voir
       * la doc de tête du bloc `loadGltfLevel` dans `main.ts`. */
      level: {
        /** Charge (ou recharge) `public/assets/levels/<name>.glb`, avec hot reload. */
        load: (name: string) => void;
        /** Compteurs du niveau glTF actuellement chargé, `null` si aucun. */
        stats: () => LevelStats | null;
      };
      /** Porte à badge (Zone E, `use_exit_door`/`door_e_exit`) : lecture/forçage de la possession du badge, pour tester sans tuer le Directeur en console. */
      hasBadge: () => boolean;
      giveBadge: () => void;
      doors: () => DoorInfo[];
      secrets: () => SecretZone[];
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

/** Point d'entrée console pour l'A/B de `feel-tuner` et les preuves de `qa-evidence`. */
function exposeDebugApi(
  player: PlayerController,
  weapons: WeaponSystem,
  suitManager: SuitManager,
  spawnSuit: (x: number, feetY: number, z: number) => Suit,
  directorManager: DirectorManager,
  spawnDirector: (x: number, feetY: number, z: number) => Director,
  lastRecording: () => Recording | null,
  playRecording: (rec: Recording) => void,
  loadGltfLevel: (name: string) => void,
  gltfLevelStats: () => LevelStats | null,
  hasBadge: () => boolean,
  giveBadge: () => void,
  doors: () => DoorInfo[],
  secrets: () => SecretZone[],
) {
  window.cassandre = {
    moveConfig,
    player,
    recorder: inputRecorder,
    lastRecording,
    playRecording,
    exportRecording: recordingToJson,
    importRecording: recordingFromJson,
    simulateRecording: (rec, cfg = moveConfig) => simulateRecording(rec, cfg),
    checkDeterminism,
    feelVariants: FEEL_VARIANTS,
    applyFeelVariant,
    weapons,
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
    suits: suitManager.suits,
    suitConfig,
    spawnSuit,
    suitCount: () => suitManager.suits.length,
    suitAliveCount: () => suitManager.suits.filter((s) => s.isAlive).length,
    directors: directorManager.directors,
    directorManager,
    directorConfig,
    spawnDirector,
    directorCount: () => directorManager.directors.length,
    directorAliveCount: () => directorManager.directors.filter((d) => d.isAlive).length,
    level: {
      load: loadGltfLevel,
      stats: gltfLevelStats,
    },
    /** Porte à badge (Zone E) : `hasBadge()` lit l'état réel, `giveBadge()`
     * force la possession pour tester `use_exit_door` sans devoir tuer le
     * Directeur en console (même précédent que `directorManager` pour ce
     * genre de test direct). */
    hasBadge,
    giveBadge,
    /** `door_*` du niveau glTF actuellement chargé — pour inspecter/piloter une porte depuis la console (même précédent que `directors`/`suits`). */
    doors,
    /** `secret_*` du niveau glTF actuellement chargé — pour inspecter les volumes AABB depuis la console (même précédent que `doors`). */
    secrets,
  };
}

main();
