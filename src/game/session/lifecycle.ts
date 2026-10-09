import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { INITIAL_PLAYER_MAX_HP } from "./player/playerState";
import { COLLISION_GROUPS, PhysicsWorld } from "../../physics/world";
import { DeterministicRandom } from "../../core/effect/random";
import { setAudioRandom } from "../../core/audio/audio";
import { initZoneAmbience, resetZoneAmbienceSession, stopZoneAmbienceSession } from "../../core/audio/zoneAmbience";
import { runGameplaySync } from "../../app/runtime/gameRuntime";
import { HERO_LINE_SEED } from "./presentation/heroLines";
import { createPlaceLineState } from "./player/placeLines";
import { createLevelScriptState } from "../level/scripting/levelScript";
import { createStreamState, STREAM_SEED } from "./stream/streamSim";
import { createInitialStats } from "./progression/score";
import { difficultyConfig } from "./progression/difficulty";
import { getDifficulty } from "../settings/difficultySettings";
import { suitConfig } from "../entities/suit/suitConfig";
import { directorConfig } from "../entities/director/directorConfig";
import { PlayerController } from "../player/movement/controller";
import { WeaponSystem } from "../player/weapons/weapons";
import { PathfindingService } from "../level/navigation/pathfinding";
import { buildTrainRideGym, type TrainRideGym } from "../level/catalog/trainRideGym";
import { buildTrainGym, type TrainGym } from "../level/catalog/trainGym";
import { buildGym } from "../level/catalog/gym";
import { SuitManager } from "../entities/suit/suitManager";
import { DirectorManager } from "../entities/director/directorManager";
import { useGameStore } from "../hud/state";
import { HEAL_PICKUP_RADIUS } from "../level/interactions/interactive";
import { type LevelDef } from "../level/catalog/levels";
import { chargerCiel } from "../../render/environment/ciel";
import { spawnSuitAt, loadGltfLevel } from "./spawning";
import { type GameSession } from "./gameSession";
import { type PersistentEngine } from "./gameEngine";
import { HeroPortrait } from "./presentation/heroPortrait";
import { createStaticSurfaceProbe } from "./presentation/surfaceProbe";
import { loadPickupResources, type PickupResources } from "../../render/pickups/pickupResources";
import type { SessionEntry } from "./campaign/campaignTypes";
import { applyArrival, captureArrival, metroArrival } from "./campaign/campaignArrival";
import { METRO_LEVEL_ID } from "./campaign/campaignCatalog";
/** Garde verticale entre les pieds au spawn et le sol, en mètres : évite une
 * interpénétration au tout premier pas fixe (même garde que l'ancienne salle
 * de test). `buildGym` retourne la hauteur EXACTE du sol au point de spawn. */
const SPAWN_FEET_GUARD = 0.1;

// see: docs/archive/systems-session.md#construire-une-partie
const BALL_RADIUS = 0.4;

// see: docs/archive/systems-rendu.md#éclairage-de-scène-selon-le-niveau
function applyLightRig(engine: PersistentEngine, choice: LevelDef): void {
  const mode = choice.lighting ?? "temps-reel";
  engine.ambientLight.intensity = mode === "bake" ? 1.0 : mode === "hybride" ? 0.18 : 0.4;
  engine.sunLight.intensity = mode === "temps-reel" ? 0.8 : 0.0;
  // Le ciel suit le niveau, comme la lumière : un niveau sans `ciel` retombe
  // sur la couleur de fond du renderer, et un reset vers la gym l'efface.
  engine.scene.background = choice.ciel ? chargerCiel(choice.ciel) : null;
}

export async function bootGameSession(engine: PersistentEngine, choice: LevelDef, entry: SessionEntry = { mode: "dev" }): Promise<GameSession> {
  await initZoneAmbience(choice.ambience);
  const pickupResources = await loadPickupResources();
  try {
    pickupResources.warmTextures(engine.renderer);
    if (import.meta.env.DEV && choice.kind === "train-ride-gym") {
      await engine.fx.warmEnemyAppearances(engine.camera, () => engine.renderer.render(engine.scene, engine.camera));
    }
    return buildGameSession(engine, choice, pickupResources, entry);
  } catch (error) {
    try { pickupResources.dispose(); } catch (releaseError) {
      throw new AggregateError([error, releaseError], "Construction de la session interrompue");
    }
    throw error;
  }
}

function buildGameSession(engine: PersistentEngine, choice: LevelDef, pickupResources: PickupResources, entry: SessionEntry): GameSession {
  // `GameClock` et `FxSystem` appartiennent au moteur persistant pour éviter
  // de recréer leurs pools, mais leur état transitoire appartient à UNE
  // partie. Le reset précède toute construction de la nouvelle session.
  engine.clock.reset();
  engine.fx.resetSession();
  engine.fx.setRandom(runGameplaySync(DeterministicRandom.useSync((random) => random.forSeed(0xf00d517))));
  setAudioRandom(runGameplaySync(DeterministicRandom.useSync((random) => random.forSeed(0xa0d105))));
  resetZoneAmbienceSession(runGameplaySync(DeterministicRandom.useSync((random) => random.forSeed(0xa4b1a7))));

  // Remis à ses valeurs de boot AVANT de construire quoi que ce soit :
  // Le HUD est réinitialisé ; la santé canonique appartient à la nouvelle session.
  useGameStore.getState().resetGameStore();

  const physics = new PhysicsWorld();
  const player = new PlayerController(physics);

  let trainGym: TrainGym | null = null;
  let trainRideGym: TrainRideGym | null = null;
  let gymRoot: THREE.Group | null = null;
  let ballMesh: THREE.Mesh | null = null;
  let ballBody: RAPIER.RigidBody | null = null;

  // see: docs/6-reference/notes-code-gameplay.md#session-et-moteur
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
  } else if (import.meta.env.DEV && choice.kind === "train-gym") {
    gymRoot = new THREE.Group();
    engine.scene.add(gymRoot);
    trainGym = buildTrainGym(gymRoot, physics);
    player.spawn(trainGym.spawn.x, trainGym.spawn.y + SPAWN_FEET_GUARD, trainGym.spawn.z);
    engine.look.yaw = trainGym.spawnYaw;
    engine.look.pitch = 0;
  } else if (import.meta.env.DEV && choice.kind === "train-ride-gym") {
    gymRoot = new THREE.Group();
    engine.scene.add(gymRoot);
    trainRideGym = buildTrainRideGym(gymRoot, physics);
    player.spawn(trainRideGym.spawn.x, trainRideGym.spawn.y + SPAWN_FEET_GUARD, trainRideGym.spawn.z);
    engine.look.yaw = 0;
    engine.look.pitch = 0;
  } else {
    player.spawn(0, 2, 0);
    engine.look.yaw = 0;
    engine.look.pitch = 0;
  }

  const weapons = new WeaponSystem(physics, engine.clock);
  const difficulty = entry.arrival?.difficulty ?? getDifficulty();
  const rules = difficultyConfig[difficulty];
  const enemyTuning = { hp: rules.enemyHp, damage: rules.enemyDamage };
  const suitManager = new SuitManager(physics, suitConfig, enemyTuning);
  const directorManager = new DirectorManager(physics, directorConfig, enemyTuning);

  const session: GameSession = {
    choice,
    trainGym,
    trainRideGym,
    difficulty,
    entryMode: entry.mode,
    entryArrival: null,
    completedArrival: null,
    devCompleteRequested: false,
    devCampaignCommands: [],
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
    levelSpaces: null,
    placeLines: new Map(),
    scriptTriggers: [],
    levelScript: createLevelScriptState(),
    lightPool: null,
    propSystem: null,
    doorSystem: trainRideGym?.doors ?? null,
    vitreSystem: null,
    sanitaireSystem: null,
    ecranSystem: null,
    cameraView: null,
    pickupResources,
    weaponPickupBillboards: [],
    cardPickupBillboards: [],
    sanitaireReliefCooldown: 0,
    droppedCardBillboard: null,
    cards: new Set(),
    perks: new Set(),
    pickupRadius: HEAL_PICKUP_RADIUS,
    killRushRemaining: 0,
    unlockedDoors: new Set(),
    exitDoorTracking: null,
    foundSecrets: new WeakSet(),
    secretsFound: 0,
    secretsTotal: 0,
    lastSafeGround: new THREE.Vector3(),
    playerHp: INITIAL_PLAYER_MAX_HP,
    playerMaxHp: INITIAL_PLAYER_MAX_HP,
    heroPortrait: new HeroPortrait(),
    firstKillTriggered: false,
    lowHpLineTriggered: false,
    stream: createStreamState(rules.donations),
    streamRandom: runGameplaySync(DeterministicRandom.useSync((random) => random.forSeed(STREAM_SEED))),
    deathHandled: false,
    levelCompleteHandled: false,
    lastHeroLineAt: -Infinity,
    lastHeroBarkAt: -Infinity,
    heroLinesSaid: new Set(),
    heroLineRandom: runGameplaySync(DeterministicRandom.useSync((random) => random.forSeed(HERO_LINE_SEED))),
    placeLine: createPlaceLineState(),
    stats: createInitialStats(),
  };

  engine.fx.setSurfaceProbe(createStaticSurfaceProbe(session));

  // Loadout de départ : `LevelDef.startUnarmed` (registre `game/level/catalog/levels.ts`).
  if (choice.startUnarmed) {
    weapons.startUnarmed();
  }

  const arrival = entry.arrival ?? (choice.id === METRO_LEVEL_ID ? metroArrival(difficulty) : null);
  if (arrival) applyArrival(session, arrival);
  session.entryArrival = captureArrival(session);
  useGameStore.getState().setCampaign({ levelId: choice.id, nextAvailable: false });
  useGameStore.getState().setDebug({ playerHp: session.playerHp, playerMaxHp: session.playerMaxHp, wallet: session.stream.wallet });

  applyLightRig(engine, choice);

  if (choice.kind === "gym") {
    spawnSuitAt(engine, session, -9, SPAWN_FEET_GUARD, 5);
    spawnSuitAt(engine, session, 9, SPAWN_FEET_GUARD, 5);
    spawnSuitAt(engine, session, 0, SPAWN_FEET_GUARD, 13);
    // Rencontre d'essai du Rampant (lot B4) : une meute de quatre, au fond de
    // la salle, à juger ici avant toute pose dans le niveau.
    for (const [x, z] of [[-6, 17], [-2, 19], [2, 19], [6, 17]] as const) {
      spawnSuitAt(engine, session, x, SPAWN_FEET_GUARD, z, "rampant");
    }
    // Rencontre d'essai du Vigile (lot B6) : seul, à l'écart, avec la place de lui tourner autour.
    spawnSuitAt(engine, session, -14, SPAWN_FEET_GUARD, -6, "vigile");
  } else if (trainGym) {
    session.currentNavGraph = runGameplaySync(PathfindingService.use((pathfinding) => pathfinding.bake(physics,
      new THREE.Box3(new THREE.Vector3(-9.5, -.4, -21.5), new THREE.Vector3(13.5, 3, 24.5)))));
    for (const [x, z] of [[9, -15], [12, -15], [9, -20], [12, -20]] as const) spawnSuitAt(engine, session, x, 1, z);
  } else if (trainRideGym) {
    session.currentNavGraph = runGameplaySync(PathfindingService.use((pathfinding) => pathfinding.bake(physics,
      new THREE.Box3(new THREE.Vector3(-1.5, -.4, -22), new THREE.Vector3(1.5, .4, 22)))));
  } else if (choice.gltfName) {
    loadGltfLevel(engine, session, choice.gltfName);
  }

  return session;
}

// see: docs/archive/systems-session.md#démolir-une-partie
export async function teardownGameSession(engine: PersistentEngine, session: GameSession): Promise<void> {
  session.levelLoadGeneration += 1;
  const errors: unknown[] = [];
  const release = (action: () => void): void => {
    try { action(); } catch (error) { errors.push(error); }
  };
  release(stopZoneAmbienceSession);
  // Attendre les acquisitions en vol avant de libérer les ressources qu'elles empruntent.
  try { await session.gltfLevelSession?.stop(); } catch (error) { errors.push(error); }
  release(() => session.pickupResources?.dispose());
  session.pickupResources = null;

  release(() => session.trainGym?.presentation.dispose());
  if (session.gymRoot) {
    release(() => session.trainRideGym?.presentation.dispose(session.gymRoot!));
    session.gymRoot.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      release(() => obj.geometry.dispose());
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) release(() => material.dispose());
    });
    release(() => engine.scene.remove(session.gymRoot!));
  }

  for (const sprite of session.suitSprites.values()) release(() => sprite.dispose());
  session.suitSprites.clear();
  for (const sprite of session.directorSprites.values()) release(() => sprite.dispose());
  session.directorSprites.clear();

  release(() => session.droppedCardBillboard?.dispose());
  session.droppedCardBillboard = null;

  release(() => engine.fx.resetSession());

  release(() => session.physics.world.free());
  if (errors.length > 0) throw new AggregateError(errors, "Libération incomplète de la session");
}
