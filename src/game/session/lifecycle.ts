import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { createElement } from "react";

import { COLLISION_GROUPS, PhysicsWorld } from "../../physics/world";
import { DeterministicRandom } from "../../core/random";
import { input } from "../../core/input";
import { runGameplaySync } from "../../core/runtime";
import { SANITAIRE_RELIEF_LINE_SEED } from "./sanitaires";
import { createInitialStats } from "./score";
import { PlayerController } from "../player/controller";
import { WeaponSystem } from "../player/weapons";
import { buildGym } from "../level/gym";
import { SuitManager } from "../entities/suitManager";
import { DirectorManager } from "../entities/directorManager";
import { useGameStore } from "../state";
import { App } from "../../ui/App";
import { type LevelDef } from "../level/levels";
import { chargerCiel } from "../../render/ciel";
import { spawnSuitAt, loadGltfLevel } from "./spawning";
import { resolveBootChoice } from "./bootChoice";
import { type GameSession } from "./gameSession";
import { type GameEngine, type PersistentEngine } from "./gameEngine";
import {
  beginLoading,
  finishLoading,
  letBrowserPaint,
  waitForLoadingRetry,
} from "../../core/loadingProgress";

/** Garde verticale entre les pieds au spawn et le sol, en mètres : évite une
 * interpénétration au tout premier pas fixe (même garde que l'ancienne salle
 * de test). `buildGym` retourne la hauteur EXACTE du sol au point de spawn. */
const SPAWN_FEET_GUARD = 0.1;

/**
 * Rayon de la balle de test (chemin "gym" seulement) — témoin de
 * non-régression des colliders et de `setApplyImpulsesToDynamicBodies`.
 * Trajectoire vérifiée par calcul pour rester contenue dans le hub.
 * see: docs/systems/session.md#construire-une-partie
 */
const BALL_RADIUS = 0.4;

/**
 * Règle l'éclairage temps réel de la scène selon le niveau chargé.
 *
 * La scène porte depuis la Phase 1 une ambiante à 0.4 et un soleil à 0.8 :
 * c'est ce qui donne leur relief aux boîtes blanches de la gym, qui n'ont
 * aucune couleur cuite. Sur un niveau baké, ce rig fait double emploi, et par
 * une direction arbitraire (5, 10, 5) sans rapport avec les néons du plafond —
 * une face tournée à l'opposé perdait 60 % de sa luminosité cuite.
 *
 * Les trois modes, et ce que chacun attend du `.glb` :
 *
 * | mode | ambiante | soleil | le niveau doit fournir |
 * |---|---|---|---|
 * | `temps-reel` | 0.4 | 0.8 | rien (gym, zones A-E) |
 * | `bake` | 1.0 | 0 | une couleur de sommet portant TOUT l'éclairage |
 * | `hybride` | 0.18 | 0 | des `light_*` + une couleur de sommet d'OMBRE |
 *
 * En `hybride`, l'ambiante n'est pas nulle : les lampes du niveau ont une
 * portée finie et un recoin hors de portée de toutes tomberait au noir absolu,
 * ce qu'aucun jeu de cette époque ne fait.
 *
 * Réglage PAR NIVEAU et non global : les zones A-E ont été éclairées à l'œil
 * SOUS l'ancien rig, les basculer changerait leur aspect sans que personne
 * l'ait demandé — la bascule se décidera au jalon N10.
 * see: docs/systems/rendu.md#éclairage-de-scène-selon-le-niveau
 */
function applyLightRig(engine: PersistentEngine, choice: LevelDef): void {
  const mode = choice.lighting ?? "temps-reel";
  engine.ambientLight.intensity = mode === "bake" ? 1.0 : mode === "hybride" ? 0.18 : 0.4;
  engine.sunLight.intensity = mode === "temps-reel" ? 0.8 : 0.0;
  // Le ciel suit le niveau, comme la lumière : un niveau sans `ciel` retombe
  // sur la couleur de fond du renderer, et un reset vers la gym l'efface.
  engine.scene.background = choice.ciel ? chargerCiel(choice.ciel) : null;
}

/**
 * Construit une PARTIE complète : `PhysicsWorld` (donc `player`/`weapons`/
 * `suitManager`/`directorManager`, tous construits à partir de `physics`),
 * la géométrie du niveau (gym ou session glTF), tout l'état de suivi par
 * partie. Appelée une fois au tout premier boot ET à nouveau à chaque
 * "Rejouer"/"Retour au menu" — ce réemploi est ce qui rend le reset
 * possible.
 * see: docs/systems/session.md#construire-une-partie
 */
export function bootGameSession(engine: PersistentEngine, choice: LevelDef): GameSession {
  // `GameClock` et `FxSystem` appartiennent au moteur persistant pour éviter
  // de recréer leurs pools, mais leur état transitoire appartient à UNE
  // partie. Le reset précède toute construction de la nouvelle session.
  engine.clock.reset();
  engine.fx.resetSession();

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
    engine.scene.add(gymRoot);
    const gym = buildGym(gymRoot, physics);
    player.spawn(gym.spawn.x, gym.spawn.y + SPAWN_FEET_GUARD, gym.spawn.z);
    engine.look.yaw = gym.spawnYaw;
    engine.look.pitch = 0;

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
    // #7) jusqu'à ce que le commit de `loadGltfLevel` le repositionne sur
    // `spawn_player` du `.glb`.
    player.spawn(0, 2, 0);
    engine.look.yaw = 0;
    engine.look.pitch = 0;
  }

  const weapons = new WeaponSystem(physics, engine.clock);
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
    levelLoadGeneration: 0,
    currentNavGraph: null,
    lightPool: null,
    propSystem: null,
    doorSystem: null,
    vitreSystem: null,
    sanitaireSystem: null,
    sanitaireReliefCooldown: 0,
    droppedCardMesh: null,
    cards: new Set(),
    unlockedDoors: new Set(),
    exitDoorTracking: null,
    foundSecrets: new WeakSet(),
    lastSafeGround: new THREE.Vector3(),
    playerHp: useGameStore.getState().debug.playerMaxHp,
    firstKillTriggered: false,
    lowHpLineTriggered: false,
    deathHandled: false,
    levelCompleteHandled: false,
    lastHeroLineAt: -Infinity,
    sanitaireReliefRandom: runGameplaySync(
      DeterministicRandom.useSync((random) => random.forSeed(SANITAIRE_RELIEF_LINE_SEED)),
    ),
    stats: createInitialStats(),
  };

  // Loadout de départ : `LevelDef.startUnarmed` (registre `game/level/levels.ts`).
  if (choice.startUnarmed) {
    weapons.startUnarmed();
  }

  applyLightRig(engine, choice);

  // 3 points de spawn dans le hub (chemin "gym" seulement — POSITIONS DE
  // TEST DE LA GYM, pas du contenu générique de moteur) : dispersés autour
  // du spawn joueur (0, 0, -10), à 15-22 m (au-delà de la portée de
  // mêlée, en-deçà de `suitConfig.sightRange`), et à >= 8 m de n'importe
  // quel mur du hub. Les niveaux glTF ont leurs propres `spawn_suit_*`,
  // consommés dans `loadGltfLevel` ci-dessus.
  if (choice.kind === "gym") {
    spawnSuitAt(engine, session, -9, SPAWN_FEET_GUARD, 5);
    spawnSuitAt(engine, session, 9, SPAWN_FEET_GUARD, 5);
    spawnSuitAt(engine, session, 0, SPAWN_FEET_GUARD, 13);
  } else if (choice.gltfName) {
    loadGltfLevel(engine, session, choice.gltfName);
  }

  return session;
}

/**
 * Détruit une PARTIE complète, dans un ordre précis : session de niveau
 * glTF, géométrie propre à `session` (gym + balle de test), sprites
 * billboard, mesh du badge, puis `physics.world.free()` EN DERNIER —
 * libérer le monde Rapier libère tous ses corps/colliders d'un coup, voir
 * pourquoi l'ordre compte.
 * see: docs/systems/session.md#démolir-une-partie
 */
export async function teardownGameSession(engine: PersistentEngine, session: GameSession): Promise<void> {
  session.levelLoadGeneration += 1;
  await session.gltfLevelSession?.stop();

  if (session.gymRoot) {
    session.gymRoot.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) material.dispose();
    });
    engine.scene.remove(session.gymRoot);
  }

  for (const sprite of session.suitSprites.values()) sprite.dispose();
  session.suitSprites.clear();
  for (const sprite of session.directorSprites.values()) sprite.dispose();
  session.directorSprites.clear();

  // Géométrie/matériau du badge sont PARTAGÉS (`engine.badgeGeometry`/
  // `engine.badgeMaterial`, persistants) — seule l'instance de mesh est
  // propre à la partie, donc seul un `remove` est nécessaire ici, jamais de
  // `dispose()` dessus.
  if (session.droppedCardMesh) engine.scene.remove(session.droppedCardMesh);

  // Jets d'eau permanents des sanitaires cassés (`FxSystem.addWaterJet`) :
  // propres à CETTE partie/CE niveau, comme les corps Rapier qui disparaissent
  // juste en dessous — un "Rejouer"/"Retour au menu" ne doit pas laisser un
  // jet de l'ancienne partie flotter dans la nouvelle.
  engine.fx.resetSession();

  session.physics.world.free();
}

/**
 * "Rejouer" — reconstruit EXACTEMENT le même `LevelDef` que la partie qui
 * vient de se terminer. Aucun `root.render()` ici : `App` reste monté tout
 * du long, seul `state.flowState` change — c'est ce qui rend "Rejouer"
 * sans rechargement de page, après validation du nouveau niveau.
 * see: docs/systems/session.md#rejouer-et-retour-au-menu
 */
export async function replay(engine: GameEngine): Promise<void> {
  const choice = engine.session.choice;
  engine.flowActor.send({ type: "REPLAY" });
  beginLoading("Redémarrage de la partie", 0.02);
  await letBrowserPaint();
  await teardownGameSession(engine, engine.session);
  engine.session = bootGameSession(engine, choice);
  await waitForGameSessionReady(engine, engine.session);
}

/**
 * "Retour au menu principal" — détruit la partie courante puis réaffiche
 * `MainMenu` en réutilisant `resolveBootChoice` telle quelle.
 *
 * PIÈGE : `resolveBootChoice` relit `window.location.search` fraîchement à
 * chaque appel — retirer `level` de l'URL (`history.replaceState`, sans
 * rechargement) doit donc se faire AVANT de la rappeler, sinon une partie
 * démarrée via `?level=...` reviendrait silencieusement au même niveau au
 * lieu du vrai menu principal.
 * see: docs/systems/session.md#rejouer-et-retour-au-menu
 */
export async function returnToMenu(engine: GameEngine): Promise<void> {
  engine.flowActor.send({ type: "RETURN_TO_MENU" });
  await teardownGameSession(engine, engine.session);

  const url = new URL(window.location.href);
  url.searchParams.delete("level");
  window.history.replaceState(null, "", url.toString());

  const choice = await resolveBootChoice(engine.root);
  engine.flowActor.send({ type: "BEGIN_LOAD" });
  beginLoading("Démarrage", 0.02);
  engine.root.render(
    createElement(App, {
      onReplay: () => void replay(engine),
      onReturnToMenu: () => void returnToMenu(engine),
      onResume: () => resumeGame(engine),
    }),
  );
  await letBrowserPaint();
  engine.session = bootGameSession(engine, choice);
  await waitForGameSessionReady(engine, engine.session);
}

/**
 * Frontière unique entre « session construite » et « jeu autorisé ». Un
 * premier échec ne résout jamais silencieusement vers `playing` : l'écran
 * expose l'erreur, attend un clic, puis relance exactement la même session.
 */
export async function waitForGameSessionReady(engine: GameEngine, session: GameSession): Promise<boolean> {
  const levelSession = session.gltfLevelSession;
  if (levelSession) {
    let result = await levelSession.firstLoad;
    while (result.status === "failed") {
      engine.flowActor.send({ type: "LOAD_FAILED" });
      await waitForLoadingRetry(result.error);
      engine.flowActor.send({ type: "RETRY_LOAD" });
      beginLoading("Nouvelle tentative", 0.3);
      result = await levelSession.reload();
    }
    if (result.status === "cancelled") return false;
  }

  finishLoading();
  engine.flowActor.send({ type: "PLAY" });
  return true;
}

/**
 * "Reprendre" depuis la pause : redemande le verrouillage du pointeur —
 * geste utilisateur obligatoire, satisfait ici par le clic même sur le
 * bouton "Reprendre" (`PauseScreen`) — puis envoie `RESUME` à l'acteur de
 * flux. `clearPendingEdges()` vide les fronts de touches accumulés PENDANT
 * la pause (ex. taper une lettre en rebindant une touche dans l'onglet
 * Paramètres) : sans ça, une touche de gameplay pressée par erreur pendant
 * le menu serait consommée comme une vraie action au tout premier pas fixe
 * après la reprise.
 * see: docs/systems/session.md#pause
 */
export function resumeGame(engine: GameEngine): void {
  input.clearPendingEdges();
  input.requestPointerLockNow();
  engine.flowActor.send({ type: "RESUME" });
}
